// Level needs and pad routes: which ones a save meets, what a met pad route gives the walk, and how the needs of a
// level decide whether it is reachable
import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import type { History } from '../src/history-file.ts';
import { levelNeedsMet, metPadRoutes, needsMet } from '../src/model/route-needs.ts';
import type { NeedsView } from '../src/model/route-needs.ts';
import type { PadRoute, RouteNeed } from '../src/types.ts';
import { NO_HISTORY, reachability } from '../src/walk/reachability.ts';

// A row of 10 at z 0 on the implicit ground floor: the hero at 0..2; walls at z 0 in columns 3..6 (a ledge at z 1)
// and a high wall in column 9. Level A stands where the hero does, level V and level W in the pocket 7..8, which the
// walk from the hero does not reach.
vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    const WIDTH = 10,
        Z_OFFSET = 64,
        columns: number[] = [];
    for (let i = 0; i < WIDTH; i++) {
        let heights: number[] = [];
        if (i >= 3 && i <= 6) heights = [0];
        if (i === 9) heights = [0, 1, 2, 3];
        columns.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
    }
    const WORLD = { solid: Uint8Array.from(columns), groups: new Uint8Array(0), water: new Uint8Array(WIDTH) };
    const PROG = {
        levels: [
            { n: 'A', p: [1, 0, 0], req: [] },
            { n: 'V', p: [7, 0, 0], req: [] },
            { n: 'W', p: [8, 0, 0], req: [] },
        ],
        teleporters: [],
        freezers: [],
        signs: [{ pid: 90, p: [0, 0, 0], l: 0, gates: [] }],
        map: { size: [WIDTH, 1], corner: [0, 0], layers: [{ key: 'ground', z: [-8, 8] }] },
        world: {
            grid: { corner: [0, 0], size: [WIDTH, 1], zoff: Z_OFFSET },
            zlayer: Array.from({ length: 256 }, () => 0),
            groups: [],
            rocks: [],
            lilies: [],
            floors: [],
            switches: [],
            gates: [],
            fences: [],
            oceans: [],
            elevators: [],
            wardrobes: [],
            monsters: [],
            beam_stops: [],
            mechs: [],
            lights: [],
            area_pins: [],
            guy: [0, 0],
        },
        pad_routes: [] as unknown[],
    };
    return { SCHEMA, PROG, WORLD, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

const history: History = {
    version: 0,
    types: [],
    hero: [0, 0, 0],
    heroKey: -1,
    heroes: new Map(),
    heroAt: [],
    actions: [],
};

const walk = (padRoutes: PadRoute[], needsHold: Array<boolean | undefined> = [], entered = [false, false, false]) =>
    reachability(history, NO_HISTORY, [], [], entered, padRoutes, needsHold);

describe('a pad route in the walk', () => {
    test('with no route the pocket stays out of reach', () => {
        expect(walk([]).level).toEqual([true, false, false]);
    });

    test('a route to a position seeds the walk there', () => {
        const route: PadRoute = { id: 'to_cell', to: { at: [7, 0, 0] }, needs: [[{ level: 0 }]] };
        expect(walk([route]).level).toEqual([true, true, true]);
    });
});

describe('the needs of a level in the walk', () => {
    test('needs that hold seed the walk at the level, so the levels beside it count as reached', () => {
        expect(walk([], [undefined, undefined, true]).level).toEqual([true, true, true]);
    });

    test('needs that do not hold make a level the walk reaches unreachable', () => {
        expect(walk([], [false, undefined, undefined]).level).toEqual([false, false, false]);
    });

    test('needs that do not hold block a level beyond the walk and seed nothing', () => {
        expect(walk([], [undefined, false, undefined]).level).toEqual([true, false, false]);
    });

    test('a level with no needs in the data keeps the walk answer', () => {
        expect(walk([], [undefined, undefined, undefined]).level).toEqual([true, false, false]);
        expect(walk([]).level).toEqual([true, false, false]);
    });

    test('a level the save entered stays reached whatever its needs say', () => {
        expect(walk([], [false, undefined, undefined], [true, false, false]).level).toEqual([true, false, false]);
    });
});

const view = (solved: number[], read: number[] = []): NeedsView => ({
    levelSolved: (level) => solved.includes(level),
    signRead: (pid) => read.includes(pid),
});

const { PROG } = await import('../src/data.ts');

// runs with the needs of a level set, and puts the data back whatever the run does
function withNeeds(levelIndex: number, needs: RouteNeed[][], run: () => void): void {
    const level = PROG.levels[levelIndex];
    Object.assign(level, { needs });
    try {
        run();
    } finally {
        delete level.needs;
    }
}

describe('the needs of a route', () => {
    const routeWith = (needs: RouteNeed[][]): PadRoute => ({ id: 'r', to: { pad: 0 }, needs });

    test('every group needs one of its needs', () => {
        const needs: RouteNeed[][] = [[{ level: 0 }], [{ level: 1 }, { level: 2 }]];
        expect(needsMet(needs, view([0]))).toBe(false);
        expect(needsMet(needs, view([1]))).toBe(false);
        expect(needsMet(needs, view([0, 2]))).toBe(true);
    });

    test('a Sign needs to be read', () => {
        const needs: RouteNeed[][] = [[{ sign: 0 }]];
        expect(needsMet(needs, view([], []))).toBe(false);
        expect(needsMet(needs, view([], [90]))).toBe(true);
    });

    test('a group with no need is one nothing meets', () => {
        expect(needsMet([[]], view([0, 1, 2]))).toBe(false);
    });

    test('no group is always met', () => {
        expect(needsMet([], view([]))).toBe(true);
    });

    test('metPadRoutes keeps the routes the save meets', () => {
        const met = routeWith([[{ level: 0 }]]);
        const unmet = { ...routeWith([[{ level: 1 }]]), id: 'other' };
        Object.assign(PROG, { pad_routes: [met, unmet] });
        try {
            expect(metPadRoutes(view([0]))).toEqual([met]);
        } finally {
            Object.assign(PROG, { pad_routes: [] });
        }
    });

    test('levelNeedsMet is undefined for a level with no needs', () => {
        withNeeds(0, [], () => {
            withNeeds(1, [[{ level: 0 }]], () => {
                expect(levelNeedsMet(view([]))).toEqual([true, false, undefined]);
                expect(levelNeedsMet(view([0]))).toEqual([true, true, undefined]);
            });
        });
    });

    test('a level with an empty needs list is reached from the start, even beyond the walk', () => {
        withNeeds(1, [], () => {
            expect(walk([], levelNeedsMet(view([]))).level).toEqual([true, true, true]);
        });
    });
});

describe('the needs a level table row sets', () => {
    const built: { levels: { n: string; needs?: unknown }[] } = JSON.parse(
        readFileSync(new URL('../data/progress.json', import.meta.url), 'utf8'),
    );
    const needsOf = (name: string) => built.levels.find((level) => level.n === name)?.needs;

    test('a row keeps needs that are only the unlocks of its level', () => {
        expect(needsOf('snipperclips_square')).toHaveLength(1);
        expect(needsOf('mirror_4')).toBeDefined();
    });
});
