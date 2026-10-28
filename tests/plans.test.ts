// Unlock plans worked out once for every requirement, the endgame chain in them, and the next steps
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PROG } from '../src/data.ts';
import { nextSteps, orderNextSteps } from '../src/model/next-steps.ts';
import type { NextStep } from '../src/model/next-steps.ts';
import { unlockPlan } from '../src/model/plans.ts';
import type { Plans } from '../src/model/plans.ts';
import type { BaseProgress } from '../src/model/progress.ts';
import type { TowerProgress } from '../src/model/towers.ts';
import type { LevelState, SignRule } from '../src/model/unlocking.ts';
import { SIGN_INDEX } from '../src/model/requirements.ts';
import { gatesBehindThemselves, signWayInOf } from '../src/model/way-in.ts';
import type { WhyBlocked } from '../src/model/way-in.ts';
import type { KnownRoute } from '../src/types.ts';
import type { Reachability } from '../src/walk/reachability.ts';
import { level } from './fixtures.ts';

vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    return { SCHEMA, PROG: {}, WORLD: {}, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

/** A progress with the plans and next steps built on it, which the tests set or clear. */
interface PlannedProgress extends BaseProgress {
    plans?: Plans | undefined;
    needed: Array<NextStep | null>;
}

const tower = (extra: Partial<TowerProgress>): TowerProgress => ({
    pid: 0,
    t: 0,
    req: 0,
    p: [0, 0, 0],
    normal: [],
    drop: [],
    solvedNormal: 0,
    active: false,
    gold: false,
    ...extra,
});
const keys = (P: PlannedProgress, root: Parameters<typeof unlockPlan>[1]) => [...unlockPlan(P, root)!.nodes.keys()];
const ruleOf = (pid: number) =>
    [...PROG.signs, ...PROG.freezers.flatMap((freezer) => freezer.signs || [])].find((sign) => sign.pid === pid)!;

interface ProgressOptions {
    state: LevelState[];
    wayIn?: Array<number[] | null>;
    towers?: TowerProgress[];
    rank?: number;
    extra?: Partial<PlannedProgress>;
}

// a progress state: `state` per level, way-in gates per blocked level, every gate closed
function progress({ state, wayIn = [], towers = [], rank = 0, extra = {} }: ProgressOptions): PlannedProgress {
    const towerAt: Array<TowerProgress | undefined> = towers;
    const signOk = (sign: SignRule) => {
        if (sign.rank) return sign.rank <= rank;
        if (sign.tower != null) return !!towerAt[sign.tower]?.active;
        return false;
    };
    const blockedWhy = (): WhyBlocked => ({ gates: [], pad: [], via: [], viaTowers: [], mech: [] });
    return {
        state,
        unlocks: state.map(() => ({ levels: [] })),
        wayIn: state.map((levelState, i) => (levelState === 'blocked' ? wayIn[i] || [] : null)),
        wayInChains: state.map(() => null),
        wayInFixed: new Set(),
        why: state.map((levelState) => (levelState === 'blocked' ? blockedWhy() : null)),
        behind: state.map((_, i) => wayIn[i] || []),
        access: state.map(() => null),
        signAccess: [],
        signWayIn: [],
        ice: [],
        reach: null,
        lt: null,
        solved: 0,
        gateOpen: PROG.freezers.map(() => false),
        towers,
        tst: (PROG.teleporters || []).map(() => ({ en: true, disc: false })),
        goldFound: 0,
        signOk,
        // a Sign counts as read once its rule holds
        signRead: (pid: number) => signOk(ruleOf(pid)),
        rockSmashed: () => false,
        needed: [],
        ...extra,
    };
}

describe('plans do not depend on the root', () => {
    // level 0 playable; levels 1 and 2 each behind gate 1 (needs 0) or gate 2 (needs 3, which needs 0 too)
    test("a requirement's plan is the same inside any other plan", () => {
        Object.assign(PROG, {
            levels: [level('a'), level('b'), level('c'), level('d', { req: [0] })],
            freezers: [
                { req: [2], signs: [] },
                { req: [0], signs: [] },
                { req: [3], signs: [] },
            ],
            signs: [],
            gold_rooms: [],
        });
        const P = progress({ state: ['unlocked', 'blocked', 'blocked', 'locked'], wayIn: [[], [0, 1], [2]] });
        expect(keys(P, ['level', 1])).toEqual(['l0', 'g1', 'l1']);
        expect(keys(P, ['level', 2])).toEqual(['l0', 'l3', 'g2', 'l2']);
        // gate 0 needs level 2, whose plan is the same here as on its own
        expect(keys(P, ['gate', 0])).toEqual(['l0', 'l3', 'g2', 'l2', 'g0']);
        const plan = unlockPlan(P, ['gate', 0])!;
        expect(plan.edges).toEqual([
            ['l0', 'l3'],
            ['l3', 'g2'],
            ['g2', 'l2'],
            ['l2', 'g0'],
        ]);
    });
    test('an OR takes its cheapest option; a cycle with no way out has no plan', () => {
        Object.assign(PROG, {
            levels: [
                level('a'),
                level('b', { req: [2, 0], or: 1 }),
                level('c', { req: [3] }),
                level('d', { req: [2] }),
            ],
            freezers: [],
            signs: [],
            gold_rooms: [],
        });
        const P = progress({ state: ['unlocked', 'locked', 'locked', 'locked'] });
        expect(keys(P, ['level', 1])).toEqual(['l0', 'l1']);
        expect(unlockPlan(P, ['level', 1])!.nodes.get('l1')!.alt).toBe(2);
        expect(unlockPlan(P, ['level', 2])).toBe(null);
    });
});

describe('a doorway onto another closed gate', () => {
    // level 1 sits behind gate 0, which opens onto nothing but gate 1; gate 0 needs level 0, gate 1 the locked level 2
    test('the plan takes both gates', () => {
        Object.assign(PROG, {
            levels: [level('a'), level('b'), level('c', { req: [0] })],
            freezers: [
                { req: [0], signs: [] },
                { req: [2], signs: [] },
            ],
            signs: [],
            gold_rooms: [],
        });
        const wayInChains = [null, new Map([[0, [[0, 1]]]]), null];
        const P = progress({ state: ['unlocked', 'blocked', 'locked'], wayIn: [null, [0]], extra: { wayInChains } });
        expect(keys(P, ['level', 1]).toSorted()).toEqual(['g0', 'g1', 'l0', 'l1', 'l2']);
    });
    test('a gate beyond it that needs the level behind it drops the way through', () => {
        Object.assign(PROG, {
            levels: [level('b'), level('open')],
            freezers: [
                { req: [1], signs: [] },
                { req: [0], signs: [] },
            ],
            signs: [],
            gold_rooms: [],
        });
        const state: LevelState[] = ['blocked', 'unlocked'];
        const behind = gatesBehindThemselves({
            state,
            wayIn: [[0], null],
            chains: [new Map([[0, [[0, 1]]]]), null],
            via: () => [],
            ice: state.map(() => undefined),
            gateOpen: [false, false],
            met: () => false,
        });
        expect([...behind]).toEqual([1]);
    });
});

describe('a gate that needs what sits behind it is no way in', () => {
    // gate 0 needs level 0, which sits behind gate 1; gate 1 needs level 1, which sits behind gate 0. Level 2 sits
    // behind gate 0 or gate 2, which needs the playable level 3.
    test('a two-gate cycle drops out of the way in; its levels become steps of their own', () => {
        Object.assign(PROG, {
            levels: [level('zach1'), level('airmail'), level('beyond'), level('open')],
            freezers: [
                { req: [0], signs: [] },
                { req: [1], signs: [] },
                { req: [3], signs: [] },
            ],
            signs: [],
            gold_rooms: [],
        });
        const state: LevelState[] = ['blocked', 'blocked', 'blocked', 'unlocked'];
        const wayIn = [[1], [0], [0, 2], null];
        const behind = gatesBehindThemselves({
            state,
            wayIn,
            via: () => [],
            ice: state.map(() => undefined),
            gateOpen: [false, false, false],
            met: () => false,
        });
        expect([...behind].toSorted()).toEqual([0, 1]);
        const kept = wayIn.map((gates) => gates && gates.filter((fi) => !behind.has(fi)));
        const P = progress({ state, wayIn: kept });
        expect(keys(P, ['level', 2])).toEqual(['l3', 'g2', 'l2']);
        expect(keys(P, ['level', 0])).toEqual(['l0']);
        expect(keys(P, ['level', 1])).toEqual(['l1']);
    });
    test('a cycle with a way out keeps its gates', () => {
        Object.assign(PROG, {
            levels: [level('zach1'), level('airmail'), level('open')],
            freezers: [
                { req: [0], signs: [] },
                { req: [1], signs: [] },
            ],
            signs: [],
            gold_rooms: [],
        });
        // level 1 is also reached by a pad from the playable level 2
        const state: LevelState[] = ['blocked', 'blocked', 'unlocked'];
        const behind = gatesBehindThemselves({
            state,
            wayIn: [[1], [0], null],
            via: (i) => (i === 1 ? [2] : []),
            ice: state.map(() => undefined),
            gateOpen: [false, false],
            met: () => false,
        });
        expect(behind.size).toBe(0);
    });
});

describe('towers and the endgame chain', () => {
    // two ground towers of 3 levels needing 2 each, one gold room per tower; end1 behind gate 0 on the gold Sign
    // (both rooms); the rank 1 Door gate 1 holds level 7
    const setup = (state: LevelState[], extra: Partial<ProgressOptions> = {}) => {
        Object.assign(PROG, {
            levels: [
                level('t0a', { t: 1 }),
                level('t0b', { t: 1 }),
                level('t0c', { t: 1, req: [0] }),
                level('t1a', { t: 2 }),
                level('t1b', { t: 2 }),
                level('t1c', { t: 2 }),
                level('end1', { a: 'ENDGAME1' }),
                level('after', {}),
            ],
            freezers: [
                { req: [], signs: [{ pid: 90, gold: 2 }] },
                { req: [], signs: [{ pid: 91, rank: 1 }] },
            ],
            signs: [
                { pid: 90, gold: 2, gates: [0], p: [0, 0, 0] },
                { pid: 91, rank: 1, gates: [1], p: [0, 0, 0] },
            ],
            teleporters: [{ pid: 1 }, { pid: 2 }, { pid: 3 }, { pid: 4 }],
            gold_rooms: [
                { tower: 0, pad: 0, endpoint: 1 },
                { tower: 1, pad: 2, endpoint: 3 },
            ],
        });
        const towers = [tower({ t: 1, req: 2, normal: [0, 1, 2] }), tower({ t: 2, req: 2, normal: [3, 4, 5] })];
        const wayIn = state.map((): number[] => []);
        wayIn[6] = [0];
        wayIn[7] = [1];
        return progress({ state, wayIn, towers, ...extra });
    };
    const open: LevelState[] = [
        'unlocked',
        'unlocked',
        'locked',
        'unlocked',
        'unlocked',
        'unlocked',
        'blocked',
        'blocked',
    ];
    test('a tower needs its cheapest levels, as many as it still needs', () => {
        expect(keys(setup(open), ['tower', 0])).toEqual(['l0', 'l1', 't0']);
    });
    test('a level reached through a Tower pad needs that Tower', () => {
        const P = setup(open);
        P.wayIn[7] = [];
        P.why[7] = { gates: [], pad: [], via: [], viaTowers: [0], mech: [] };
        expect(keys(P, ['level', 7])).toEqual(['l0', 'l1', 't0', 'l7']);
    });
    test('the gold Sign needs that many gold rooms, each its tower and a step onto its pad', () => {
        const plan = keys(setup(open), ['level', 6]);
        for (const key of ['t0', 'p0', 't1', 'p1', 'g0', 'l6']) expect(plan).toContain(key);
        // the sign rule step (keyed by gate and place here, as the sign table is read when the module loads)
        expect(plan.slice(-3)).toEqual(['x0:0', 'g0', 'l6']);
    });
    test('a rank Sign needs the ENDGAME level that gives the rank', () => {
        const plan = keys(setup(open), ['level', 7]);
        expect(plan).toContain('l6');
        expect(plan.slice(-3)).toEqual(['x1:0', 'g1', 'l7']);
    });
    test('an ending is no step of its own', () => {
        const P = setup(open);
        expect(unlockPlan(P, ['level', 6])!.steps).toBeGreaterThan(1);
        expect(unlockPlan(P, ['level', 6])!.nodes.get('l6')!.front).toBeUndefined();
    });
    test('a level on a layer the walk does not reach needs the way onto it, and the sky comes after rank 1', () => {
        const access = open.map((): string | null => null);
        access[7] = 'sky';
        const P = setup(open, { extra: { access } });
        P.wayIn[7] = [];
        const plan = keys(P, ['level', 7]);
        expect(plan.slice(-2)).toEqual(['a:sky', 'l7']);
        expect(plan).toContain('l6');
    });
    test('next steps lead with the steps toward the next ending', () => {
        const P = setup(open);
        P.plans = undefined;
        const status = { achievements: 0n };
        P.needed = nextSteps(P, status);
        expect(P.needed[0]!.ending).toBe(0);
        expect(P.needed[0]!.towers).toEqual([[0, 2]]);
        // level 7, not reachable, is a step of its own plan only: no tower, no ending, nothing after it
        expect(P.needed[7]).toEqual({ towers: [], down: new Set() });
        const shown = { level: () => true, gate: () => true, tower: () => true, dist: () => 0 };
        const ids = P.needed.map((needed, i) => (needed ? i : -1)).filter((i) => i >= 0);
        expect(orderNextSteps(P, ids, shown).slice(0, 2)).toEqual([0, 1]);
    });
});

describe('a Sign the walk cannot face yet', () => {
    // Sign 90 (rank 1) stands in a pocket behind gate 0 (needs level 0) and opens gate 1; level 1 is the ENDGAME1 level
    const setup = () => {
        Object.assign(PROG, {
            levels: [level('a'), level('end1', { a: 'ENDGAME1' })],
            freezers: [
                { req: [0], signs: [] },
                { req: [], signs: [{ pid: 90, rank: 1 }] },
            ],
            signs: [{ pid: 90, rank: 1, gates: [1], p: [0, 0, 0] }],
            gold_rooms: [],
        });
        // requirements.ts reads the Signs' indices when it loads, before the test sets them
        SIGN_INDEX.set(90, 0);
        const gateOpen = PROG.freezers.map(() => false);
        const reach = { signFaced: Uint8Array.of(0), signBehind: [[0, 1]] };
        const signWayIn = signWayInOf(reach, gateOpen);
        return { signWayIn, P: progress({ state: ['unlocked', 'unlocked'], extra: { signWayIn } }) };
    };
    afterEach(() => {
        SIGN_INDEX.delete(90);
    });
    test('its way in is the gates whose opening lets the walk face it, less the gates that wait on it', () => {
        expect(setup().signWayIn).toEqual([[0]]);
    });
    test('its plan takes one of those gates along with its rule', () => {
        const { P } = setup();
        const plan = keys(P, ['gate', 1]);
        for (const key of ['l0', 'g0', 'l1', 's0', 'g1']) expect(plan).toContain(key);
        expect(plan.indexOf('g0')).toBeLessThan(plan.indexOf('s0'));
    });
    test('a Sign with no gate leading to it keeps its rule alone', () => {
        const { P } = setup();
        P.signWayIn = [[]];
        const plan = keys(P, ['gate', 1]);
        expect(plan).toContain('s0');
        expect(plan).not.toContain('g0');
    });
});

// the parts of a reachability the Way reads: whether the walk faces a Sign, and the columns it reaches
const isReachability = (value: unknown): value is Reachability =>
    typeof value === 'object' && value !== null && 'signFaced' in value && 'cols' in value;

describe('a known sky Way', () => {
    // a sky tower of level 0 whose hub Sign 90 opens gate 0; the Way to its quarter (area 5) asks for level 1 and one
    // of levels 2 and 3 (none when `entry` is empty); the tower's hub pad is teleporter 7
    const setup = (entry: number[][], extra: Partial<PlannedProgress> = {}) => {
        Object.assign(PROG, {
            levels: [level('tw', { t: 17 }), level('first'), level('alt_a'), level('alt_b')],
            freezers: [{ req: [], signs: [{ pid: 90, tower: 0 }] }],
            signs: [{ pid: 90, tower: 0, gates: [0], p: [0, 0, 0] }],
            known_routes: [
                {
                    id: 'way',
                    to: { pad: 7 },
                    needs: entry.map((group) => group.map((member) => ({ level: member }))),
                    area: 5,
                    tower: 0,
                },
            ],
            gold_rooms: [],
            teleporters: Array.from({ length: 8 }, () => ({})),
        });
        SIGN_INDEX.set(90, 0);
        const towers = [tower({ t: 17, req: 1, normal: [0], hub: 7 })];
        return progress({ state: ['unlocked', 'unlocked', 'unlocked', 'unlocked'], towers, extra });
    };
    afterEach(() => {
        SIGN_INDEX.delete(90);
    });

    test('the hub Sign needs the Way, the Way its entry levels, one of the levels of a group', () => {
        const plan = keys(setup([[1], [2, 3]]), ['gate', 0]);
        expect(plan).toHaveLength(7);
        for (const key of ['l0', 't0', 'l1', 'w5', 's0', 'g0']) expect(plan).toContain(key);
        expect(plan.filter((key) => key === 'l2' || key === 'l3')).toHaveLength(1);
        expect(plan.indexOf('l1')).toBeLessThan(plan.indexOf('w5'));
        expect(plan.indexOf('w5')).toBeLessThan(plan.indexOf('s0'));
        expect(plan.indexOf('s0')).toBeLessThan(plan.indexOf('g0'));
    });

    test('a Way with no known entry levels is a bare step', () => {
        const plan = keys(setup([]), ['gate', 0]);
        expect(plan.toSorted()).toEqual(['g0', 'l0', 's0', 't0', 'w5']);
    });

    test('an entry level solved asks for nothing more', () => {
        const solved: LevelState[] = ['unlocked', 'solved', 'unlocked', 'solved'];
        const plan = keys(setup([[1], [2, 3]], { state: solved }), ['gate', 0]);
        expect(plan.toSorted()).toEqual(['g0', 'l0', 's0', 't0', 'w5']);
    });

    test('the Way is met once the Sign is read', () => {
        const plan = keys(setup([[1]], { signRead: () => true }), ['gate', 0]);
        expect(plan).not.toContain('w5');
    });

    test('the Way is met once the walk faces the Sign', () => {
        const reach: unknown = { signFaced: Uint8Array.of(1), signBehind: [[]], cols: {} };
        if (!isReachability(reach)) throw new Error('not a reachability');

        const plan = keys(setup([[1]], { reach }), ['gate', 0]);
        expect(plan).not.toContain('w5');
        expect(plan).toContain('s0');
    });

    test("the Way is met once the tower's hub pad is discovered", () => {
        const P = setup([[1]]);
        P.tst[7].disc = true;
        const plan = keys(P, ['gate', 0]);
        expect(plan).not.toContain('w5');
        expect(plan).toContain('s0');
    });
});

describe('a known route to a level', () => {
    // level 3 is not reachable and no gate leads in; the route to it needs level 0 and one of levels 1 and 2 (each
    // playable), or what `needs` says; freezer 0 (opened by level 2) is a way in of the walk when `wayIn` says so
    const setup = (needs: KnownRoute['needs'], wayIn: number[] = []) => {
        Object.assign(PROG, {
            levels: [level('a'), level('b'), level('c'), level('target')],
            freezers: [{ req: [2], signs: [] }],
            signs: [],
            known_routes: [{ id: 'to_target', to: { level: 3 }, needs }],
            gold_rooms: [],
        });
        const state: LevelState[] = ['unlocked', 'unlocked', 'unlocked', 'blocked'];
        return progress({ state, wayIn: [[], [], [], wayIn] });
    };

    test('a level with no gate leading in takes the route', () => {
        const plan = keys(setup([[{ level: 0 }], [{ level: 1 }, { level: 2 }]]), ['level', 3]);
        expect(plan).toContain('l0');
        expect(plan.filter((key) => key === 'l1' || key === 'l2')).toHaveLength(1);
        expect(plan).toContain('l3');
    });

    test('the route is one more way in, the cheapest way is taken', () => {
        const plan = keys(setup([[{ level: 0 }]], [0]), ['level', 3]);
        expect(plan).toContain('l0');
        expect(plan).not.toContain('g0');
    });

    test('a Freezer the route asks for is one of its steps', () => {
        const plan = keys(setup([[{ freezer: 0 }]]), ['level', 3]);
        expect(plan).toEqual(expect.arrayContaining(['l2', 'g0', 'l3']));
    });

    test('a level with no route keeps a step of its own', () => {
        const plan = keys(setup([]), ['level', 3]);
        expect(plan).toEqual(['l3']);
    });
});

describe('a level that asks for the endgame table gates', () => {
    // level 4 is not reachable; it needs gates 0 to 2 together (each opened by a playable level), and gate 3 (level 3)
    // is a way in the walk found
    const setup = (wayIn: number[], gateOpen: boolean[] = []) => {
        Object.assign(PROG, {
            levels: [level('a'), level('b'), level('c'), level('d'), level('room')],
            freezers: [
                { req: [0], signs: [] },
                { req: [1], signs: [] },
                { req: [2], signs: [] },
                { req: [3], signs: [] },
            ],
            signs: [],
            known_routes: [],
            gold_rooms: [],
        });
        const state: LevelState[] = ['unlocked', 'unlocked', 'unlocked', 'unlocked', 'blocked'];
        const wayInAll = new Map([[4, [0, 1, 2].filter((gate) => !gateOpen[gate])]]);
        const P = progress({ state, wayIn: [[], [], [], [], wayIn], extra: { wayInAll } });
        gateOpen.forEach((open, gate) => (P.gateOpen[gate] = open));
        return P;
    };

    test('with no way in of the walk, the level needs every one of them', () => {
        const plan = keys(setup([0, 1, 2]), ['level', 4]);
        for (const key of ['g0', 'g1', 'g2', 'l4']) expect(plan).toContain(key);
        expect(plan).not.toContain('g3');
    });

    test('besides a way in of the walk, the level needs both', () => {
        const plan = keys(setup([3]), ['level', 4]);
        for (const key of ['g0', 'g1', 'g2', 'g3', 'l4']) expect(plan).toContain(key);
    });

    test('a gate already open is left out', () => {
        const plan = keys(setup([1, 2], [true]), ['level', 4]);
        expect(plan).not.toContain('g0');
        expect(plan).toContain('g1');
        expect(plan).toContain('g2');
    });
});
