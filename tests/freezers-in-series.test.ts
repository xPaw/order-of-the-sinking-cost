// A pocket that bumps into a closed Freezer opening onto nothing but another closed Freezer needs both of them
import { expect, test, vi } from 'vitest';
import { PROG } from '../src/data.ts';
import type { History } from '../src/history-file.ts';
import { NO_HISTORY, reachability } from '../src/walk/reachability.ts';
import { level } from './fixtures.ts';

// A row of 9 at z 0 on the implicit ground floor, between the high walls of columns 0 and 8: level A at 1, Freezer 0
// at 2, an empty cell at 3, Freezer 1 at 4 and the hero at 6.
vi.mock('../src/world-data.ts', () => import('./world-data-mock.ts'));
vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    const WIDTH = 9,
        Z_OFFSET = 64,
        columns: number[] = [];
    for (let i = 0; i < WIDTH; i++) {
        let heights: number[] = [];
        if (i === 0 || i === 8) heights = [0, 1, 2, 3];
        columns.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
    }
    const WORLD = { solid: Uint8Array.from(columns), groups: new Uint8Array(0), water: new Uint8Array(WIDTH) };
    const progress = {
        levels: [{ n: 'A', p: [1, 0, 0], req: [] }],
        teleporters: [],
        freezers: [
            { pid: 90, p: [2, 0, 0], req: [] },
            { pid: 91, p: [4, 0, 0], req: [] },
        ],
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
    };
    return { SCHEMA, PROG: progress, WORLD, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

function reachWith(closedFreezers: boolean[]) {
    const history: History = {
        version: 0,
        types: [],
        hero: [6, 0, 0],
        heroKey: -1,
        heroes: new Map(),
        heroAt: [],
        actions: [],
    };
    const entered = PROG.levels.map(() => false);
    return reachability(history, NO_HISTORY, [], closedFreezers, entered);
}

test('a Freezer that opens onto another closed Freezer is a way in only with that one open too', () => {
    const reach = reachWith([true, true]);
    expect(reach.level).toEqual([false]);
    expect(reach.pocket.get(0)).toEqual([0]);
    expect(reach.chains.get(0)).toEqual(new Map([[0, [[0, 1]]]]));
});

test('a Freezer that opens onto a level is a way in on its own', () => {
    PROG.levels.push(level('B', { p: [3, 0, 0] }));

    try {
        const reach = reachWith([true, true]);
        expect(reach.pocket.get(0)).toContain(0);
        expect(reach.chains.has(0)).toBe(false);
    } finally {
        PROG.levels.pop();
    }
});

test('a Freezer on the edge of the reached cells is a way in on its own', () => {
    const reach = reachWith([true, false]);
    expect(reach.leads.get(0)).toEqual([0]);
    expect(reach.chains.has(0)).toBe(false);
});
