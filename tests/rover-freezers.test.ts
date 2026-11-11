// A pocket that bumps into a closed Freezer holding a Rover is a way into the levels the Rover ferries it to
import { expect, test, vi } from 'vitest';
import { PROG } from '../src/data.ts';
import type { History } from '../src/history-file.ts';
import { NO_HISTORY, reachability } from '../src/walk/reachability.ts';

// Three rows of 10 at z 0. Row 1: the pocket of level A at 0..2, water at 3 (surface 0), the far shore of level B at
// 4..5, walls at 6, 8 and 9 (the grid wraps) and the hero at 7. Column 3 is water in rows 0 and 2 too and wall elsewhere in those rows. A
// movable (30) at (1, 1, 0) is a Rover running north-south; Freezer 0 holds it.
vi.mock('../src/world-data.ts', () => import('./world-data-mock.ts'));
vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    const WIDTH = 10,
        HEIGHT = 3,
        Z_OFFSET = 64,
        solid: number[] = [],
        wet: number[] = [];
    for (let j = 0; j < HEIGHT; j++) {
        for (let i = 0; i < WIDTH; i++) {
            let heights: number[] = [];
            if ((j !== 1 && i !== 3) || (j === 1 && (i === 6 || i >= 8))) heights = [0];
            solid.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
            wet.push(...(i === 3 ? [1, 0, 0] : [0]));
        }
    }
    const WORLD = { solid: Uint8Array.from(solid), groups: new Uint8Array(0), water: Uint8Array.from(wet) };
    const progress = {
        levels: [
            { n: 'A', p: [0, 1, 0], req: [] },
            { n: 'B', p: [5, 1, 0], req: [] },
        ],
        teleporters: [],
        freezers: [{ pid: 1, p: [1, 1, 0], req: [] }],
        map: { size: [WIDTH, HEIGHT], corner: [0, 0], layers: [{ key: 'ground', z: [-8, 8] }] },
        world: {
            grid: { corner: [0, 0], size: [WIDTH, HEIGHT], zoff: Z_OFFSET },
            zlayer: Array.from({ length: 256 }, () => 0),
            groups: [],
            rocks: [],
            lilies: [],
            floors: [],
            switches: [],
            gates: [],
            fences: [],
            oceans: [[1, 0, 0, 0, 0, WIDTH, HEIGHT]],
            elevators: [],
            wardrobes: [],
            monsters: [],
            movables: [[30, 1, 1, 0, 3]],
            rover_facings: [[30, 1]],
            beam_stops: [],
            mechs: [],
            lights: [],
            area_pins: [],
            guy: [7, 1],
        },
    };
    return { SCHEMA, PROG: progress, WORLD, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

function levelsBehindFreezer() {
    const history: History = {
        version: 0,
        types: [],
        hero: [7, 1, 0],
        heroKey: -1,
        heroes: new Map(),
        heroAt: [],
        actions: [],
    };
    const reach = reachability(history, NO_HISTORY, [], [true], [false, false]);
    return reach.pocket.get(0);
}

test('the Rover in a closed Freezer ferries the pocket to the levels past the water', () => {
    expect(levelsBehindFreezer()).toEqual([0, 1]);
});

test('a closed Freezer that holds another movable leads to the pocket only', () => {
    const movable = PROG.world.movables[0];
    movable[4] = 4;

    try {
        expect(levelsBehindFreezer()).toEqual([0]);
    } finally {
        movable[4] = 3;
    }
});
