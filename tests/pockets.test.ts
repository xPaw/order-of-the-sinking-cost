// A level that lies in more than one pocket takes what each of them gives, whatever order the pockets are walked in
import { expect, test, vi } from 'vitest';
import type { History } from '../src/history-file.ts';
import { NO_HISTORY, reachability } from '../src/walk/reachability.ts';

// A row of 14 at z 0 on the implicit ground floor: the hero at 12..0 between the high walls of columns 1 and 11. Walls
// at z 0 in columns 2..4 and 8..10 make two ledges at z 1, level A on the west one and level C on the east one; both
// drop into the pit 5..7, where level B stands and from which no step climbs back. A beam blocker Rock at (2, 0, 2)
// marks the cells around the west ledge.
vi.mock('../src/world-data.ts', () => import('./world-data-mock.ts'));
vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    const WIDTH = 14,
        Z_OFFSET = 64,
        columns: number[] = [];
    for (let i = 0; i < WIDTH; i++) {
        let heights: number[] = [];
        if ((i >= 2 && i <= 4) || (i >= 8 && i <= 10)) heights = [0];
        if (i === 1 || i === 11) heights = [0, 1, 2, 3];
        columns.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
    }
    const WORLD = { solid: Uint8Array.from(columns), groups: new Uint8Array(0), water: new Uint8Array(WIDTH) };
    const PROG = {
        levels: [
            { n: 'A', p: [2, 0, 1], req: [] },
            { n: 'B', p: [6, 0, 0], req: [] },
            { n: 'C', p: [10, 0, 1], req: [] },
        ],
        teleporters: [],
        freezers: [],
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
            mechs: [[1, 50, 2, 0, 2]],
            lights: [],
            area_pins: [],
            guy: [0, 0],
        },
    };
    return { SCHEMA, PROG, WORLD, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

test('a level in two pockets takes the mechanics of both', () => {
    const history: History = {
        version: 0,
        types: [],
        hero: [0, 0, 0],
        heroKey: -1,
        heroes: new Map(),
        heroAt: [],
        actions: [],
    };
    const reach = reachability(history, NO_HISTORY, [], [], [false, false, false]);
    expect(reach.level).toEqual([false, false, false]);
    // A's pocket (with the marked ledge) and C's pocket (without) both hold the pit, so B keeps the beam blocker
    // whichever pocket is walked last
    expect([...reach.mech]).toEqual([2, 2, 0]);
});
