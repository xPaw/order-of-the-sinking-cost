// The second and third endings as ordered lists of stages (progress.json `ending_stages`)
import { describe, expect, test, vi } from 'vitest';
import { PROG, SCHEMA } from '../src/data.ts';
import { goalLadder } from '../src/model/goals.ts';
import { goalsView } from '../src/model/goals-view.ts';
import type { GoalsView } from '../src/model/goals-view.ts';
import type { NextStep } from '../src/model/next-steps.ts';
import { planAll } from '../src/model/plans.ts';
import type { BaseProgress, ShownProgress } from '../src/model/progress.ts';
import type { TowerProgress } from '../src/model/towers.ts';
import type { LevelState, SignRule } from '../src/model/unlocking.ts';
import type { EndingStages } from '../src/types.ts';
import { level, pad } from './fixtures.ts';

// the sign table is read when requirements loads, so the two hub Signs are in it from the start
vi.mock('../src/data.ts', async () => {
    const schema = (await import('../data/schema.json')).default;
    const data = {
        signs: [
            { pid: 90, tower: 0, gates: [0], p: [0, 0, 0] },
            { pid: 91, tower: 1, gates: [1], p: [0, 0, 0] },
        ],
    };
    return { SCHEMA: schema, PROG: data, WORLD: {}, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));
vi.mock('../src/view.ts', () => ({ show() {}, async showSave() {} }));
vi.mock('../src/model/layers.ts', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../src/model/layers.ts')>()),
    layerName: (key: string) => key,
    mapLayerOf: () => 'ground',
}));

function achievementBit(name: string): bigint {
    const bit = SCHEMA.enums.Achievement.values.find(([valueName]) => valueName === name)![1];
    return 1n << BigInt(bit);
}

const ROOM_A = 4;
const ROOM_B_FIRST = 5;
const ROOM_B_LAST = 6;
const FINAL_LOW = 7;
const FIRST_WAY_AREA = 4;
const SECOND_WAY_AREA = 5;

const ENDING_STAGES: EndingStages[] = [
    {
        ending: 'ENDGAME2',
        stages: [
            { name: { area: 0 }, done: { rule: 'achievement', name: 'ASCEND' }, seen: [] },
            { name: { tower: 0 }, done: { rule: 'tower', tower: 0 }, seen: [] },
            { name: { tower: 1 }, done: { rule: 'tower', tower: 1 }, seen: [] },
            { name: { route: 0 }, done: { rule: 'freezers', freezers: [0] }, seen: [] },
            { name: { route: 1 }, done: { rule: 'freezers', freezers: [1] }, seen: [] },
            { name: { area: 1 }, done: { rule: 'solved', level: 3 }, seen: [] },
        ],
    },
    {
        ending: 'ENDGAME3',
        stages: [
            { name: { area: 2 }, done: { rule: 'achievement', name: 'DESCEND' }, seen: [] },
            { name: { area: 3 }, done: { rule: 'pads', pads: [0] }, seen: [0] },
            { name: { level: ROOM_A }, done: { rule: 'freezers', freezers: [2] }, seen: [] },
            { name: { level: ROOM_B_FIRST }, done: { rule: 'solved', level: ROOM_B_LAST }, seen: [] },
            { name: { level: FINAL_LOW }, done: { rule: 'solved', level: FINAL_LOW }, seen: [] },
        ],
    },
];

interface SetupOptions {
    ascended?: boolean;
    descended?: boolean;
    /** Per sky tower, whether it is active. */
    active?: boolean[];
    /** Per sky tower, whether its hub Freezer is open. */
    open?: boolean[];
    /** Whether the first end3 room's exit Freezer is open. */
    roomOpen?: boolean;
    /** Whether the underworld hub's pad is discovered. */
    padFound?: boolean;
    solved?: number[];
}

// Two sky towers of one level each (levels 0 and 1) with a hub Freezer each, the end2 room's level `laser_pointer`
// (2) and the ENDGAME2 level (3); the third ending's first room (4), the two levels of its second room (5, 6) and the
// level that earns ENDGAME3 (7)
function setup({
    ascended = false,
    descended = false,
    active = [false, false],
    open = [false, false],
    roomOpen = false,
    padFound = false,
    solved = [],
}: SetupOptions = {}) {
    Object.assign(PROG, {
        levels: [
            level('t0a', { t: 17 }),
            level('t1a', { t: 18 }),
            level('laser_pointer'),
            level('all_together_now', { a: 'ENDGAME2' }),
            level('room_a'),
            level('room_b_first'),
            level('room_b_last'),
            level('final_low', { a: 'ENDGAME3' }),
        ],
        freezers: [
            { req: [], signs: [{ pid: 90, tower: 0 }] },
            { req: [], signs: [{ pid: 91, tower: 1 }] },
            { req: [ROOM_A] },
        ],
        areas: [
            { local_area_name: 'area_s_upper_crossroads', display: 'Crossroads High', pin: 1 },
            { local_area_name: 'area_s_antipode_high', display: 'Antipode High', pin: 2 },
            { local_area_name: 'area_u_crossroads_low', display: 'Crossroads Low', pin: 3 },
            { local_area_name: 'area_u_antipode_low', display: 'Antipode Low', pin: 4 },
            { local_area_name: 'area_s_first_way', display: 'The First Way', pin: 5 },
            { local_area_name: 'area_s_second_way', display: 'The Second Way', pin: 6 },
        ],
        teleporters: [pad({ pid: 1, major: 1 })],
        gold_rooms: [],
        known_routes: [
            { id: 'first_way', to: { level: 0 }, needs: [], area: FIRST_WAY_AREA, tower: 0 },
            { id: 'second_way', to: { level: 1 }, needs: [], area: SECOND_WAY_AREA, tower: 1 },
        ],
        ending_stages: ENDING_STAGES,
    });
    const state = PROG.levels.map((): LevelState => 'unlocked');
    const towers = [17, 18].map((bits, towerIndex): TowerProgress => {
        if (active[towerIndex]) state[towerIndex] = 'solved';
        return {
            pid: 0,
            t: bits,
            req: 1,
            p: [0, 0, 0],
            normal: [towerIndex],
            drop: [],
            solvedNormal: Number(active[towerIndex]),
            active: active[towerIndex],
            gold: false,
        };
    });
    for (const levelIndex of solved) state[levelIndex] = 'solved';

    const signOk = (sign: SignRule) => sign.tower != null && towers[sign.tower].active;
    const base: BaseProgress & { hidden: boolean[]; towerHidden: boolean[] } = {
        state,
        unlocks: state.map(() => ({ levels: [] })),
        wayIn: state.map(() => null),
        wayInChains: state.map(() => null),
        wayInFixed: new Set(),
        why: state.map(() => null),
        behind: state.map(() => []),
        access: state.map(() => null),
        signAccess: [],
        signWayIn: [],
        ice: [],
        reach: null,
        lt: null,
        gateOpen: [...open, roomOpen],
        towers,
        tst: [{ en: true, disc: padFound }],
        goldFound: 0,
        signOk,
        signRead: () => false,
        rockSmashed: () => false,
        solved: 0,
        hidden: state.map(() => false),
        towerHidden: towers.map(() => false),
    };
    let achievements = 0n;
    if (ascended) achievements |= achievementBit('ASCEND');
    if (descended) achievements |= achievementBit('DESCEND');
    const status = { achievements };
    const progress: ShownProgress = {
        ...base,
        plans: planAll(base),
        needed: state.map((): NextStep | null => null),
        goals: [],
    };
    progress.goals = goalLadder(progress, status);
    return { progress, status };
}

interface ViewOptions {
    areaShown?: boolean;
    /** The only areas the game names, instead of all or none. */
    namedAreas?: number[];
    hiddenLevels?: number[];
    hiddenTowers?: number[];
}

function view(
    { progress, status }: ReturnType<typeof setup>,
    { areaShown = true, namedAreas, hiddenLevels = [], hiddenTowers = [] }: ViewOptions = {},
): GoalsView {
    for (const levelIndex of hiddenLevels) progress.hidden[levelIndex] = true;
    for (const towerIndex of hiddenTowers) progress.towerHidden[towerIndex] = true;
    const named = (area: number) => {
        if (namedAreas) return namedAreas.includes(area);
        return areaShown;
    };
    return goalsView({
        status,
        progress,
        levels: PROG.levels,
        endings: ['ENDGAME1', 'ENDGAME2', 'ENDGAME3'].map((name) => ({ name, earned: false, shown: true })),
        achievementHidden: () => false,
        achievementRule: () => undefined,
        areaShown: named,
        gateShown: () => true,
        gatePlace: () => '',
        signShown: () => true,
        stepShown: () => true,
        heroDist: () => 0,
    });
}

const endingOf = (goals: GoalsView, name: string) => goals.goals.find((goal) => goal.key === 'ending:' + name)!;
const labels = (goals: GoalsView, name: string) => endingOf(goals, name).children!.map((child) => child.label);
const dones = (goals: GoalsView, name: string) => endingOf(goals, name).children!.map((child) => child.done);
const activeLabels = (goals: GoalsView, name: string) =>
    endingOf(goals, name)
        .children!.filter((child) => child.active)
        .map((child) => child.label);

describe('the second ending as stages', () => {
    test('the children are the stages in order, each with its own done mark', () => {
        const goals = view(setup({ ascended: true, active: [true, false], open: [true, false] }));
        expect(labels(goals, 'ENDGAME2')).toEqual([
            'Crossroads High',
            'High Heroes',
            'High Mirrors',
            'The First Way',
            'The Second Way',
            'Antipode High',
        ]);
        expect(dones(goals, 'ENDGAME2')).toEqual([true, true, false, true, false, false]);
        expect(activeLabels(goals, 'ENDGAME2')).toEqual(['High Mirrors']);
    });

    test("a tower is done once active, its Way once the tower's hub Freezer is open", () => {
        const goals = view(setup({ ascended: true, active: [true, true], open: [true, false] }));
        expect(dones(goals, 'ENDGAME2')).toEqual([true, true, true, true, false, false]);
        expect(activeLabels(goals, 'ENDGAME2')).toEqual(['The Second Way']);
    });

    test('towers activated whose hub Freezers are closed leave the first Way the active stage', () => {
        const goals = view(setup({ ascended: true, active: [true, true] }));
        expect(dones(goals, 'ENDGAME2')).toEqual([true, true, true, false, false, false]);
        expect(activeLabels(goals, 'ENDGAME2')).toEqual(['The First Way']);
    });

    test('the hub stays active with every hub Freezer open until the ending level is solved', () => {
        const open = view(setup({ ascended: true, active: [true, true], open: [true, true], solved: [2] }));
        expect(dones(open, 'ENDGAME2')).toEqual([true, true, true, true, true, false]);
        expect(activeLabels(open, 'ENDGAME2')).toEqual(['Antipode High']);

        const solved = view(setup({ ascended: true, active: [true, true], open: [true, true], solved: [2, 3] }));
        expect(dones(solved, 'ENDGAME2')).toEqual([true, true, true, true, true, true]);
    });

    test('before the sky is reached the crossroads is the active stage', () => {
        const goals = view(setup());
        expect(activeLabels(goals, 'ENDGAME2')).toEqual(['Crossroads High']);
    });

    test('a tower asks for the tower and its Way for the hub Freezer', () => {
        const { progress } = setup();
        const ending = progress.goals[1];
        if (ending.kind !== 'ending') throw new Error('not an ending');

        const towerStages = ending.children!.filter((child) => child.kind === 'tower');
        const towerKeys = towerStages.map((child) => progress.plans.G.keys[child.targets[0]]);
        expect(towerKeys).toEqual(['t0', 't1']);

        const wayStages = ending.children!.filter((child) => child.kind === 'stage' && child.route !== undefined);
        const wayKeys = wayStages.map((child) => progress.plans.G.keys[child.targets[0]]);
        expect(wayKeys).toEqual(['g0', 'g1']);
    });

    test('a place is named once its area shows', () => {
        const goals = view(setup({ ascended: true }), { areaShown: false });
        expect(labels(goals, 'ENDGAME2')).toEqual([
            'High Heroes',
            'High Mirrors',
            'Way to the High Heroes sign',
            'Way to the High Mirrors sign',
        ]);
        expect(endingOf(goals, 'ENDGAME2').fogged).toBe(true);
    });

    test("a Way is named by its area while the area is named, else by its tower's sign", () => {
        const goals = view(setup({ ascended: true }), { namedAreas: [SECOND_WAY_AREA] });
        expect(labels(goals, 'ENDGAME2')).toEqual([
            'High Heroes',
            'High Mirrors',
            'Way to the High Heroes sign',
            'The Second Way',
        ]);
    });

    test('a Way is listed whenever its tower is, and not while the tower is under fog', () => {
        const goals = view(setup(), { areaShown: true, hiddenTowers: [1] });
        const wayLabels = labels(goals, 'ENDGAME2').filter((label) => label.includes('Way'));
        expect(wayLabels).toEqual(['The First Way']);
    });
});

describe('the third ending as stages', () => {
    test('the children are the stages in order, each with its own done mark', () => {
        const goals = view(setup({ descended: true, padFound: true, roomOpen: true }));
        expect(labels(goals, 'ENDGAME3')).toEqual([
            'Crossroads Low',
            'Antipode Low',
            'room_a',
            'room_b_first',
            'final_low',
        ]);
        expect(dones(goals, 'ENDGAME3')).toEqual([true, true, true, false, false]);
        expect(activeLabels(goals, 'ENDGAME3')).toEqual(['room_b_first']);
    });

    test('a room is done by its exit Freezer, the next by the level that ends it', () => {
        const none = view(setup({ descended: true, padFound: true, solved: [ROOM_B_FIRST] }));
        expect(dones(none, 'ENDGAME3')).toEqual([true, true, false, false, false]);
        expect(activeLabels(none, 'ENDGAME3')).toEqual(['room_a']);

        const last = view(setup({ descended: true, padFound: true, roomOpen: true, solved: [ROOM_B_LAST] }));
        expect(dones(last, 'ENDGAME3')).toEqual([true, true, true, true, false]);
        expect(activeLabels(last, 'ENDGAME3')).toEqual(['final_low']);
    });

    test('the underworld hub is done when its pad is discovered', () => {
        const before = view(setup({ descended: true }));
        expect(dones(before, 'ENDGAME3')).toEqual([true, false, false, false, false]);
        expect(activeLabels(before, 'ENDGAME3')).toEqual(['Antipode Low']);
    });

    test('a room asks for its exit Freezer and the pad for nothing', () => {
        const { progress } = setup();
        const ending = progress.goals[2];
        if (ending.kind !== 'ending') throw new Error('not an ending');

        const targets = ending.children!.map((child) => child.targets.map((id) => progress.plans.G.keys[id]));
        expect(targets[1]).toEqual([]);
        expect(targets[2]).toEqual(['g2']);
        expect(targets[3]).toEqual(['l' + ROOM_B_LAST]);
    });

    test('nothing under fog is named, and the ending says more is under fog', () => {
        const fogged = view(setup(), { areaShown: false, hiddenLevels: [ROOM_A, FINAL_LOW] });
        expect(labels(fogged, 'ENDGAME3')).toEqual(['room_b_first']);
        expect(endingOf(fogged, 'ENDGAME3').fogged).toBe(true);
    });

    test('a pad found shows the underworld hub although its area is not named', () => {
        const found = view(setup({ padFound: true }), { areaShown: false, hiddenLevels: [ROOM_A, FINAL_LOW] });
        expect(labels(found, 'ENDGAME3')).toEqual(['Antipode Low', 'room_b_first']);
        expect(endingOf(found, 'ENDGAME3').fogged).toBe(true);
    });

    test('with every stage shown the ending is not fogged', () => {
        const shown = view(setup());
        expect(endingOf(shown, 'ENDGAME3').fogged).toBe(false);
    });
});
