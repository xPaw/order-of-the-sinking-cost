// The pocket of a level walks onto a closed Freezer's top by a fall, not by a step from the side
import { expect, test, vi } from 'vitest';
import type { History } from '../src/history-file.ts';
import { NO_HISTORY, reachability } from '../src/walk/reachability.ts';

// A row of 12 at z 0 on the implicit ground floor. Columns 1..3: a ledge (hero at z 3) with level X at (2, 0, 3).
// Column 4: a pit holding Freezer 0, so a fall from the ledge lands on its top at z 1. Columns 5..7: a floor at z 1.
// Column 8: Freezer 1 in the floor's way. Column 9: a high wall that keeps the hero (at column 10) out of it all;
// columns 0 and 11 are high walls too.
vi.mock('../src/world-data.ts', () => import('./world-data-mock.ts'));
vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    const WIDTH = 12,
        Z_OFFSET = 64,
        columns: number[] = [];
    for (let i = 0; i < WIDTH; i++) {
        let heights: number[] = [];
        if (i >= 1 && i <= 3) heights = [0, 1, 2];
        if ((i >= 5 && i <= 8) || i === 10) heights = [0];
        if (i === 0 || i === 9 || i === 11) heights = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        columns.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
    }
    const WORLD = { solid: Uint8Array.from(columns), groups: new Uint8Array(0), water: new Uint8Array(WIDTH) };
    const PROG = {
        levels: [{ n: 'X', p: [2, 0, 3], req: [] }],
        teleporters: [],
        freezers: [
            { pid: 90, p: [4, 0, 0], req: [], l: 1 },
            { pid: 91, p: [8, 0, 1], req: [], l: 1 },
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
    return { SCHEMA, PROG, WORLD, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

test('a fall from the pocket onto a closed Freezer lands on its top, which leads to the Freezers beyond', () => {
    const history: History = {
        version: 0,
        types: [],
        hero: [10, 0, 1],
        heroKey: -1,
        heroes: new Map(),
        heroAt: [],
        actions: [],
    };
    const reach = reachability(history, NO_HISTORY, [], [true, true], [false]);
    expect(reach.level).toEqual([false]);
    // the pocket of X holds the ledge, the top of Freezer 0 and the floor past it, which bumps into Freezer 1
    expect([...reach.pocket.keys()]).toEqual([1]);
    expect(reach.pocket.get(1)).toEqual([0]);
});
