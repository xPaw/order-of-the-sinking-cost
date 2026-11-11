// A level frozen in a closed Freezer starts its pocket walk in the Freezer's cell, not on top of it
import { expect, test, vi } from 'vitest';
import type { History } from '../src/history-file.ts';
import { NO_HISTORY, reachability } from '../src/walk/reachability.ts';

// A row of 10 at z 0 on the implicit ground floor: the hero at 0..2; walls at z 0 in columns 3..6 (a ledge at z 1)
// and a high wall in column 9. Freezer 0 holds level X in the wall cell (3, 0, 0); Freezer 1 sits in the air at
// (2, 0, 1), next to the ledge; level W stands in the pocket 7..8, which the ledge drops into.
vi.mock('../src/world-data.ts', () => import('./world-data-mock.ts'));
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
            { n: 'X', p: [3, 0, 0], req: [] },
            { n: 'W', p: [8, 0, 0], req: [] },
        ],
        teleporters: [],
        freezers: [
            { pid: 1, p: [3, 0, 0], req: [] },
            { pid: 2, p: [2, 0, 1], req: [] },
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
    return { SCHEMA, PROG, WORLD, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

test('the frozen level seeds its pocket from the gate cell', () => {
    const history: History = {
        version: 0,
        types: [],
        hero: [0, 0, 0],
        heroKey: -1,
        heroes: new Map(),
        heroAt: [],
        actions: [],
    };
    const reach = reachability(history, NO_HISTORY, [], [true, true], [false, false]);
    // X belongs to its own gate; the ledge's gate 1 leads nowhere W's pocket reaches
    expect(reach.pocket.get(0)).toEqual([0]);
    expect(reach.pocket.get(1) ?? []).not.toContain(1);
    expect(reach.level).toEqual([false, false]);
});
