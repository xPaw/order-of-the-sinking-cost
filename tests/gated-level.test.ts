// The pocket of a level in a shut Gate's cell starts in the Gate's cell, not on its top
import { expect, test, vi } from 'vitest';
import type { History } from '../src/history-file.ts';
import { NO_HISTORY, reachability } from '../src/walk/reachability.ts';

// A row of 10 at z 0 on the implicit ground floor. The hero at column 1, Freezer 0 in column 2, a floor at column 3,
// level X in a shut Gate at column 4, a wall at z 0 in column 5 (its top level with the Gate's), a floor at column 6
// and Freezer 1 in column 7. Columns 0 and 9 are high walls.
vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    const WIDTH = 10,
        Z_OFFSET = 64,
        columns: number[] = [];
    for (let i = 0; i < WIDTH; i++) {
        let heights: number[] = [];
        if (i === 5) heights = [0];
        if (i === 0 || i === 9) heights = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        columns.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
    }
    const WORLD = { solid: Uint8Array.from(columns), groups: new Uint8Array(0), water: new Uint8Array(WIDTH) };
    const PROG = {
        levels: [{ n: 'X', p: [4, 0, 0], req: [] }],
        teleporters: [],
        freezers: [
            { pid: 90, p: [2, 0, 0], req: [], l: 1 },
            { pid: 91, p: [7, 0, 0], req: [], l: 1 },
        ],
        map: { size: [WIDTH, 1], corner: [0, 0], layers: [{ key: 'ground', z: [-8, 12] }] },
        world: {
            grid: { corner: [0, 0], size: [WIDTH, 1], zoff: Z_OFFSET },
            zlayer: Array.from({ length: 256 }, () => 0),
            groups: [],
            rocks: [],
            lilies: [],
            floors: [],
            switches: [],
            gates: [[61, 4, 0, 0, 0, 0, 7, 0, 5]],
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
    return { SCHEMA, PROG, WORLD, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

test('a level in a shut Gate is walked from the Gate, which keeps the wall top beside it out of its pocket', () => {
    const history: History = {
        version: 0,
        types: [],
        hero: [1, 0, 0],
        heroKey: -1,
        heroes: new Map(),
        heroAt: [],
        actions: [],
    };
    const reach = reachability(history, NO_HISTORY, [], [true, true], [false]);
    expect(reach.level).toEqual([false]);
    // Freezer 0 leads to X; from the Gate's top the walk would cross the wall top to the floor before Freezer 1
    expect(reach.leads.get(0)).toEqual([0]);
    expect(reach.pocket.has(1)).toBe(false);
});
