// Known routes: which ones a save meets, and the shortcut a met route gives the walk
import { describe, expect, test, vi } from 'vitest';
import type { History } from '../src/history-file.ts';
import { metRoutes, routeMet } from '../src/model/known-routes.ts';
import type { NeedsView } from '../src/model/known-routes.ts';
import type { KnownRoute } from '../src/types.ts';
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
        known_routes: [] as unknown[],
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

const walk = (routes: KnownRoute[]) => reachability(history, NO_HISTORY, [], [], [false, false, false], routes);

describe('a known route in the walk', () => {
    test('with no route the pocket stays out of reach', () => {
        expect(walk([]).level).toEqual([true, false, false]);
    });

    test('a route to a level seeds the walk there, so the levels beside it count as reached', () => {
        const route: KnownRoute = { id: 'to_w', to: { level: 2 }, needs: [[{ level: 0 }]] };
        expect(walk([route]).level).toEqual([true, true, true]);
    });

    test('a route to a position seeds the walk there', () => {
        const route: KnownRoute = { id: 'to_cell', to: { at: [7, 0, 0] }, needs: [[{ level: 0 }]] };
        expect(walk([route]).level).toEqual([true, true, true]);
    });
});

describe('the needs of a known route', () => {
    const routeWith = (needs: KnownRoute['needs']): KnownRoute => ({ id: 'r', to: { level: 2 }, needs });
    const view = (solved: number[], open: number[] = [], read: number[] = [], smashed: number[] = []): NeedsView => ({
        levelSolved: (level) => solved.includes(level),
        freezerOpen: (freezer) => open.includes(freezer),
        signRead: (pid) => read.includes(pid),
        rockSmashed: (pid) => smashed.includes(pid),
    });

    test('every group needs one of its needs', () => {
        const route = routeWith([[{ level: 0 }], [{ level: 1 }, { level: 2 }]]);
        expect(routeMet(route, view([0]))).toBe(false);
        expect(routeMet(route, view([1]))).toBe(false);
        expect(routeMet(route, view([0, 2]))).toBe(true);
    });

    test('a Freezer needs to be open and a Sign read', () => {
        const route = routeWith([[{ freezer: 4 }], [{ sign: 0 }]]);
        expect(routeMet(route, view([], [4], []))).toBe(false);
        expect(routeMet(route, view([], [], [90]))).toBe(false);
        expect(routeMet(route, view([], [4], [90]))).toBe(true);
    });

    test('a Rock needs to be smashed', () => {
        const route = routeWith([[{ level: 0 }], [{ rock: 7 }]]);
        expect(routeMet(route, view([0]))).toBe(false);
        expect(routeMet(route, view([0], [], [], [7]))).toBe(true);
    });

    test('a group with no need is one nothing meets', () => {
        expect(routeMet(routeWith([[]]), view([0, 1, 2]))).toBe(false);
    });

    test('a route with no group is always met', () => {
        expect(routeMet(routeWith([]), view([]))).toBe(true);
    });

    test('metRoutes keeps the routes the save meets', async () => {
        const { PROG } = await import('../src/data.ts');
        const met = routeWith([[{ level: 0 }]]);
        const unmet = { ...routeWith([[{ level: 1 }]]), id: 'other' };
        Object.assign(PROG, { known_routes: [met, unmet] });
        expect(metRoutes(view([0]))).toEqual([met]);
        Object.assign(PROG, { known_routes: [] });
    });
});
