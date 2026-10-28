// The goals ladder: its order and active goal, roles relative to a goal, what a level leads to, and spoiler-safe labels
import { describe, expect, test, vi } from 'vitest';
import { PROG, SCHEMA } from '../src/data.ts';
import { roleFor } from '../src/model/goal-roles.ts';
import type { GoalRoles } from '../src/model/goal-roles.ts';
import { activeGoal, goalLadder } from '../src/model/goals.ts';
import type { AchievementsGoal, EndingGoal, LadderGoal } from '../src/model/goals.ts';
import { goalsView } from '../src/model/goals-view.ts';
import type { EndingStatus, GoalsView } from '../src/model/goals-view.ts';
import type { NextStep } from '../src/model/next-steps.ts';
import { planAll } from '../src/model/plans.ts';
import type { BaseProgress, ShownProgress } from '../src/model/progress.ts';
import type { TowerProgress } from '../src/model/towers.ts';
import type { LevelState, SignRule } from '../src/model/unlocking.ts';
import type { WhyBlocked } from '../src/model/way-in.ts';
import { level } from './fixtures.ts';

// the sign table is read when requirements loads, so the gold Sign is in it from the start
vi.mock('../src/data.ts', async () => {
    const schema = (await import('../data/schema.json')).default;
    const data = { signs: [{ pid: 90, gold: 2, gates: [0, 1], p: [0, 0, 0] }] };
    return { SCHEMA: schema, PROG: data, WORLD: {}, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));
// the page, without its DOM
vi.mock('../src/view.ts', () => ({ show() {}, async showSave() {} }));
// the test levels have no map layers: everything stands on the ground
vi.mock('../src/model/layers.ts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../src/model/layers.ts')>()),
    layerName: (key: string) => key,
    mapLayerOf: () => 'ground',
}));

const achievementBit = (name: string) =>
    1n << BigInt(SCHEMA.enums.Achievement.values.find(([valueName]) => valueName === name)![1]);

const endingGoal = (goal: LadderGoal): EndingGoal => {
    if (goal.kind !== 'ending') throw new Error(`${goal.key} is no ending`);
    return goal;
};
const achievementsGoal = (goal: LadderGoal): AchievementsGoal => {
    if (goal.kind !== 'achievements') throw new Error(`${goal.key} is no achievements goal`);
    return goal;
};

interface SetupOptions {
    rooms?: number;
    achievements?: bigint;
    activated?: number[];
    visited?: number[];
}

// Three ground towers (HxM, HxS, MxS) of two levels needing one each, a gold room each. end1 sits behind Freezers 0
// and 1, both on the gold Sign (2 rooms). t0b is locked behind `key`; t2a is not reachable, behind gate 2 (needs
// `left`) or gate 3 (needs `right`). `activated` towers have their first level solved; `visited` rooms have their
// endpoint discovered (their towers must be activated too).
function setup({ rooms = 3, achievements = 0n, activated = [], visited = [] }: SetupOptions = {}) {
    Object.assign(PROG, {
        levels: [
            level('t0a', { t: 3 }),
            level('t0b', { t: 3, req: [7] }),
            level('t1a', { t: 5 }),
            level('t1b', { t: 5 }),
            level('t2a', { t: 6 }),
            level('t2b', { t: 6, req: [7] }),
            level('end1', { a: 'ENDGAME1' }),
            level('key'),
            level('left'),
            level('right'),
        ],
        freezers: [
            { req: [], signs: [{ pid: 90, gold: 2 }] },
            { req: [], signs: [{ pid: 90, gold: 2 }] },
            { req: [8], signs: [] },
            { req: [9], signs: [] },
        ],
        teleporters: [{ pid: 1 }, { pid: 2 }, { pid: 3 }, { pid: 4 }, { pid: 5 }, { pid: 6 }],
        gold_rooms: [
            { tower: 0, pad: 0, endpoint: 1 },
            { tower: 1, pad: 2, endpoint: 3 },
            { tower: 2, pad: 4, endpoint: 5 },
        ].slice(0, rooms),
    });
    const state: LevelState[] = [
        'unlocked',
        'locked',
        'unlocked',
        'unlocked',
        'blocked',
        'locked',
        'blocked',
        'unlocked',
    ];
    state.push('unlocked', 'unlocked');
    const wayIn = state.map((levelState): number[] | null => (levelState === 'blocked' ? [] : null));
    wayIn[6] = [0, 1];
    wayIn[4] = [2, 3];
    const towers = [3, 5, 6].map((towerId, ti): TowerProgress => ({
        pid: 0,
        t: towerId,
        req: 1,
        p: [0, 0, 0],
        normal: [2 * ti, 2 * ti + 1],
        drop: [],
        solvedNormal: 0,
        active: false,
        gold: false,
    }));
    for (const ti of activated) {
        state[2 * ti] = 'solved';
        towers[ti].solvedNormal = 1;
        towers[ti].active = true;
    }
    const tst = PROG.teleporters.map(() => ({ en: true, disc: false }));
    for (const room of visited) tst[PROG.gold_rooms[room].endpoint].disc = true;
    const signOk = (sign: SignRule) => !!sign.gold && visited.length >= sign.gold;
    const blockedWhy = (): WhyBlocked => ({ gates: [], pad: [], via: [], viaTowers: [], mech: [] });
    const baseProgress: BaseProgress & { hidden: boolean[]; towerHidden: boolean[] } = {
        state,
        unlocks: state.map(() => ({ levels: [] })),
        wayIn,
        wayInChains: state.map(() => null),
        wayInFixed: new Set(),
        why: state.map((levelState) => (levelState === 'blocked' ? blockedWhy() : null)),
        behind: wayIn.map((gates) => gates || []),
        access: state.map(() => null),
        signAccess: [],
        signWayIn: [],
        ice: [],
        reach: null,
        lt: null,
        gateOpen: PROG.freezers.map(() => false),
        towers,
        tst,
        goldFound: visited.length,
        signOk,
        // a Sign counts as read once its rule holds
        signRead: (pid: number) => signOk(PROG.signs.find((sign) => sign.pid === pid) ?? {}),
        rockSmashed: () => false,
        solved: 0,
        hidden: state.map(() => false),
        towerHidden: towers.map(() => false),
    };
    const status = { achievements };
    const progress: ShownProgress = {
        ...baseProgress,
        plans: planAll(baseProgress),
        needed: state.map((): NextStep | null => null),
        goals: [],
    };
    progress.goals = goalLadder(progress, status);
    return { progress, status };
}

interface ViewOptions {
    endings?: Array<Partial<EndingStatus>>;
    towerHidden?: boolean[];
    signShown?: boolean;
}

// the model's goals over a progress state; endings[i] says whether ending i is earned and shown
function view(
    { progress, status }: ReturnType<typeof setup>,
    { endings = [], towerHidden = [], signShown = true }: ViewOptions = {},
): GoalsView {
    towerHidden.forEach((hidden, ti) => (progress.towerHidden[ti] = hidden));
    return goalsView({
        status,
        progress,
        levels: PROG.levels,
        endings: ['ENDGAME1', 'ENDGAME2', 'ENDGAME3'].map((name, i) => ({
            name,
            earned: !!endings[i]?.earned,
            shown: endings[i]?.shown ?? true,
        })),
        achievementHidden: () => false,
        achievementRule: () => undefined,
        areaShown: () => true,
        gateShown: () => true,
        gatePlace: () => 'Heroes and Light',
        signShown: () => signShown,
        stepShown: (node) => node.t !== 't' || !progress.towerHidden[node.id],
        heroDist: () => 0,
    });
}
const nodeNeed = (progress: ShownProgress, goal: { roles?: GoalRoles }, key: string) =>
    goal.roles!.need[progress.plans.G.index.get(key)!];

describe('the goals ladder', () => {
    test('endings, achievements, Completionist; the first one not done is active', () => {
        const { progress } = setup();
        expect(progress.goals.map((goal) => goal.key)).toEqual([
            'ending:ENDGAME1',
            'ending:ENDGAME2',
            'ending:ENDGAME3',
            'achievements',
            'completionist',
        ]);
        expect(activeGoal(progress.goals)!.key).toBe('ending:ENDGAME1');
        expect(achievementsGoal(progress.goals[3]).children.some((child) => child.name === 'COMPLETIONIST')).toBe(
            false,
        );
        const later = setup({ achievements: achievementBit('ENDGAME1') });
        expect(later.progress.goals[0].done).toBe(true);
        expect(activeGoal(later.progress.goals)!.key).toBe('ending:ENDGAME2');
    });
});

describe('roles relative to a goal', () => {
    test('an ending needs the gold Sign on every route, its gates and the towers one of several', () => {
        const { progress } = setup();
        const ending = progress.goals[0];
        expect(roleFor(ending, 'l', 6)).toBe('req');
        expect(roleFor(ending, 'g', 0)).toBe('one');
        expect(roleFor(ending, 'g', 1)).toBe('one');
        // the Sign both gates ask for
        expect(nodeNeed(progress, ending, 's0')).toBe(2);
        // 2 of the 3 gold rooms, each its tower
        for (const key of ['p0', 'p1', 'p2', 't0', 't1', 't2']) expect(nodeNeed(progress, ending, key)).toBe(1);
        expect(roleFor(ending, 'l', 0)).toBe('one');
        expect(roleFor(ending, 'l', 7)).toBe('one');
        // a goal asks for nothing outside its routes
        expect(roleFor(endingGoal(progress.goals[0]).children![1], 'l', 0)).toBe('optional');
    });
    test('with as many gold rooms left as the Sign needs, every tower is on every route', () => {
        const { progress } = setup({ rooms: 2 });
        const ending = progress.goals[0];
        expect(nodeNeed(progress, ending, 't0')).toBe(2);
        expect(nodeNeed(progress, ending, 't1')).toBe(2);
        // a tower still needs only one of its levels
        expect(roleFor(ending, 'l', 2)).toBe('one');
        expect(roleFor(ending, 'l', 4)).toBe('optional');
    });
});

describe('what a level leads to', () => {
    test('the tower and the levels it has left, the level it unlocks, the Freezer it opens', () => {
        const model = view(setup());
        const ending = model.goals[0];
        const leads = new Map(model.goalLevels(ending).map((entry) => [PROG.levels[entry.i].n, entry]));
        expect(leads.get('t0a')!.leadsTo).toBe('Antipode HxM · 1 to go');
        expect(leads.get('key')!.leadsTo).toBe('unlocks t0b');
        expect(leads.get('left')!.leadsTo).toBe('opens ice cage Heroes and Light · one of 2 routes');
        expect(leads.get('end1')!.leadsTo).toBe('Endgame');
        // playable first, then not reachable, then locked
        const groups = model.goalLevels(ending).map((entry) => entry.group);
        expect(groups).toEqual(
            groups.toSorted(
                (first, second) =>
                    ['playable', 'blocked', 'locked'].indexOf(first) -
                    ['playable', 'blocked', 'locked'].indexOf(second),
            ),
        );
    });
    test('a tower under fog is not named', () => {
        const model = view(setup(), { towerHidden: [true, false, false] });
        const leads = new Map(model.goalLevels(model.goals[0]).map((entry) => [PROG.levels[entry.i].n, entry.leadsTo]));
        expect(leads.get('t0a')).not.toContain('HxM');
    });
});

describe('the first ending and its ground towers', () => {
    const endingOf = (model: GoalsView) => model.goals[0];
    const childKeys = (goal: { children?: Array<{ key: string }> }) => goal.children!.map((child) => child.key);

    test('a tower with an Antipode teleporter is listed under the first ending', () => {
        const all = setup();
        expect(childKeys(endingGoal(all.progress.goals[0]))).toEqual(['tower:0', 'tower:1', 'tower:2']);
        expect(endingGoal(all.progress.goals[0]).children!.every((child) => child.kind === 'antipode')).toBe(true);
        const two = setup({ rooms: 2 });
        expect(childKeys(endingGoal(two.progress.goals[0]))).toEqual(['tower:0', 'tower:1']);
        expect(endingGoal(two.progress.goals[1]).children).toBeUndefined();
        const model = view(setup());
        expect(endingOf(model).children!.map((child) => child.label)).toEqual([
            'Antipode HxM',
            'Antipode HxS',
            'Antipode MxS',
        ]);
        expect(model.goalByKey('tower:1')).toBe(endingOf(model).children![1]);
    });
    test("a tower not activated counts its levels; the child's levels are the tower's", () => {
        const model = view(setup());
        const child = model.goalByKey('tower:0')!;
        expect(child.progress).toEqual([0, 1]);
        expect(child.unit).toBe('levels');
        expect(child.next).toBe(null);
        expect(child.done).toBe(false);
        const names = model.goalLevels(child).map((entry) => PROG.levels[entry.i].n);
        expect(names.toSorted()).toEqual(['key', 't0a', 't0b']);
        expect(model.goalLevels(child).find((entry) => PROG.levels[entry.i].n === 't0a')!.leadsTo).toBe(
            'Antipode HxM · 1 to go',
        );
    });
    test('an activated tower is not done until its teleporter is visited; its next step is the pad', () => {
        const activatedState = setup({ activated: [0] });
        const activated = view(activatedState);
        const child = activated.goalByKey('tower:0')!;
        expect(child.done).toBe(false);
        expect(child.next).toBe('Antipode teleporter · Antipode HxM');
        expect(child.progress).toEqual([1, 1]);
        // it asks for its teleporter, which only waits for the step onto the pad now
        const teleporter = activatedState.progress.plans.G.index.get('p0')!;
        expect(child.targets).toEqual([teleporter]);
        expect(nodeNeed(activatedState.progress, child, 'p0')).toBe(2);
        expect([...activatedState.progress.plans.steps[teleporter]!]).toEqual([teleporter]);
        expect(endingOf(activated).progress).toEqual([0, 2]);
        const visited = view(setup({ activated: [0], visited: [0] }));
        expect(visited.goalByKey('tower:0')!.done).toBe(true);
        expect(visited.goalByKey('tower:0')!.next).toBe(null);
        expect(endingOf(visited).progress).toEqual([1, 2]);
        // the active child is the first one not done
        expect(endingOf(visited).children!.find((each) => each.active)!.key).not.toBe('tower:0');
    });
    test("the ending counts the teleporters visited of the Sign's need, then its plan steps", () => {
        const none = view(setup());
        expect(endingOf(none).progress).toEqual([0, 2]);
        expect(endingOf(none).left).toBeGreaterThan(0);
        const enough = view(setup({ activated: [0, 1], visited: [0, 1] }));
        expect(endingOf(enough).progress).toBe(null);
        expect(endingOf(enough).left).toBeGreaterThan(0);
        expect(enough.goalByKey('tower:2')!.onPlan).toBe(false);
        const earned = view(setup({ achievements: achievementBit('ENDGAME1') }), { endings: [{ earned: true }] });
        expect(endingOf(earned).done).toBe(true);
        expect(endingOf(earned).progress).toBe(null);
    });
    test('the towers on the cheapest plan come first', () => {
        // tower 2 activated: its teleporter is a one-step plan, so it and one of the others make the cheapest two
        const model = view(setup({ activated: [2] }));
        const children = endingOf(model).children!;
        expect(children.filter((child) => child.onPlan).length).toBe(2);
        expect(children.map((child) => child.onPlan)).toEqual([true, true, false]);
        expect(model.goalByKey('tower:2')!.onPlan).toBe(true);
        expect(children.find((child) => child.active)).toBe(children[0]);
    });
    test('with spoilers hidden a tower under fog is left out, and the count needs the Sign shown', () => {
        const fogged = view(setup(), { towerHidden: [true, false, false] });
        expect(endingOf(fogged).children!.map((child) => child.label)).toEqual(['Antipode HxS', 'Antipode MxS']);
        expect(endingOf(fogged).fogged).toBe(true);
        expect(endingOf(fogged).progress).toEqual([0, 2]);
        expect(fogged.goalByKey('tower:0')).toBe(null);
        const signUnderFog = view(setup(), { signShown: false });
        expect(endingOf(signUnderFog).progress).toBe(null);
        expect(endingOf(signUnderFog).left).toBeGreaterThan(0);
    });
});

describe('spoiler labels', () => {
    test('an ending not shown is left out of the ladder; the ones shown carry their Steam names', () => {
        const endingLabels = (model: GoalsView) =>
            model.goals.filter((goal) => goal.kind === 'ending').map((goal) => goal.label);
        const first = view(setup(), { endings: [{}, { shown: false }, { shown: false }] });
        expect(endingLabels(first)).toEqual(['Endgame']);
        expect(first.goals[1].key).toBe('achievements');
        const firstEarned = view(setup({ achievements: achievementBit('ENDGAME1') }), {
            endings: [{ earned: true }, {}, { shown: false }],
        });
        expect(endingLabels(firstEarned)).toEqual(['Endgame', 'Endgame High']);
    });
});
