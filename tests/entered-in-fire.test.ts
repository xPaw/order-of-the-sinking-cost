// A level entered from an attacked cell with nothing under it: the hero stood there held by PROTECTION
import { expect, test, vi } from 'vitest';
import type { History } from '../src/history-file.ts';
import { NO_HISTORY, reachability } from '../src/walk/reachability.ts';

// A row of 8 on the implicit ground floor, with no wall. A goblin in the air at (5, 0, 3) attacks the cell (4, 0, 3),
// where level X has its entrance; nothing holds up a hero there but PROTECTION.
vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    const WIDTH = 8,
        Z_OFFSET = 64,
        columns: number[] = [];
    for (let i = 0; i < WIDTH; i++) columns.push(0);
    const WORLD = { solid: Uint8Array.from(columns), groups: new Uint8Array(0), water: new Uint8Array(WIDTH) };
    const PROG = {
        levels: [{ n: 'X', p: [4, 0, 3], req: [] }],
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
            monsters: [[9, 5, 0, 3, -1]],
            mechs: [],
            lights: [],
            area_pins: [],
            guy: [0, 0],
        },
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

test('an entered level whose entrance is an attacked cell with no floor is reached', () => {
    const reach = reachability(history, NO_HISTORY, [], [], [true]);
    expect(reach.level).toEqual([true]);
});

test('the same level is not reached while it is not entered', () => {
    const reach = reachability(history, NO_HISTORY, [], [], [false]);
    expect(reach.level).toEqual([false]);
});
