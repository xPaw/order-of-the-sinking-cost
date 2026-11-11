// A hero who holds a skill fast-travels only between twins that a walk in the map room joins without a Wardrobe
import { describe, expect, test, vi } from 'vitest';
import { PROG } from '../src/data.ts';
import { WORLD } from '../src/world-data.ts';
import { walker } from '../src/walk/walker.ts';
import type { Walker } from '../src/walk/walker.ts';
import { NONE, pad } from './fixtures.ts';

vi.mock('../src/world-data.ts', () => import('./world-data-mock.ts'));
vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    return { SCHEMA, PROG: {}, WORLD: {}, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

const Z_OFFSET = 64;
const WIDTH = 12;
const MAP_ROOM_Z = 15;
const WIZARD = 2;

// A row of 12. The world pads A, B and C stand at columns 0, 2 and 6 at z 0, each in a cell walled in on both sides.
// The map room floor is at z 14 and its fast-travel box is the whole row. The twins of A, B and C stand at columns 0, 2
// and 11 at z 15; walls at column 3 keep the way round the row shut. Column 1 is open between twin A and twin B, and
// holds a Wardrobe when `wardrobe` is set.
function setup(wardrobe: boolean): Walker {
    const worldCells = new Set([0, 2, 6]);
    const solidColumns: number[] = [];
    const wet: number[] = [];

    for (let column = 0; column < WIDTH; column++) {
        const heights = [MAP_ROOM_Z - 1];
        if (!worldCells.has(column)) heights.push(0, 1);
        if (column === 3) heights.push(MAP_ROOM_Z, MAP_ROOM_Z + 1);
        solidColumns.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
        wet.push(0);
    }

    const zlayer = Array.from({ length: 256 }, (_, zByte) => (zByte - Z_OFFSET >= MAP_ROOM_Z ? 3 : 0));
    Object.assign(WORLD!, {
        solid: Uint8Array.from(solidColumns),
        groups: new Uint8Array(0),
        water: Uint8Array.from(wet),
    });

    const wardrobes = wardrobe ? [[40, 1, 0, MAP_ROOM_Z, 0, 2]] : [];
    Object.assign(PROG, {
        levels: [],
        freezers: [],
        teleporters: [
            pad({ pid: 1, p: [0, 0, 0], major: 1, en: 1, disc: 1, target: 11 }),
            pad({ pid: 2, p: [2, 0, 0], major: 1, en: 1, disc: 1, target: 12 }),
            pad({ pid: 3, p: [6, 0, 0], major: 1, en: 1, disc: 1, target: 13 }),
            pad({ pid: 11, p: [0, 0, MAP_ROOM_Z], l: 3, major: 1, en: 1, disc: 1, target: 1 }),
            pad({ pid: 12, p: [2, 0, MAP_ROOM_Z], l: 3, major: 1, en: 1, disc: 1, target: 2 }),
            pad({ pid: 13, p: [11, 0, MAP_ROOM_Z], l: 3, major: 1, en: 1, disc: 1, target: 3 }),
        ],
        world: {
            grid: {
                corner: [0, 0],
                size: [WIDTH, 1],
                zoff: Z_OFFSET,
                ft: { corner: [0, 0], size: [WIDTH, 1], z: MAP_ROOM_Z },
            },
            zlayer,
            groups: [],
            rocks: [],
            trees: [],
            lilies: [],
            floors: [],
            switches: [],
            gates: [],
            fences: [],
            oceans: [],
            elevators: [],
            wardrobes,
            monsters: [],
            movables: [],
            blockers: [],
            beam_stops: [],
            lights: [],
            bridges: [],
            mechs: [],
            magic_mirrors: [],
            skippable: [],
            teleport: [],
            area_pins: [],
            guy: [0, 0],
        },
    });

    const enabled = PROG.teleporters.map(() => ({ en: true, disc: true }));
    return walker(NONE, enabled, []);
}

// the world columns at z 0 that a hero starting on pad A in walk layer `layer` reaches
function reachedColumns(walkGrid: Walker, layer: number): number[] {
    const reached = walkGrid.flood([[walkGrid.cellOf(0, 0, 0), layer]]);
    const columns: number[] = [];

    for (const column of [0, 2, 6]) {
        if (reached.has(walkGrid.cellOf(column, 0, 0))) columns.push(column);
    }

    return columns;
}

describe('fast travel with a skill', () => {
    test('a default hero fast-travels to every pad, past a map-room Wardrobe', () => {
        expect(reachedColumns(setup(true), 0)).toEqual([0, 2, 6]);
    });

    test('a hero with a skill does not fast-travel past a map-room Wardrobe', () => {
        expect(reachedColumns(setup(true), WIZARD)).toEqual([0, 6]);
    });

    test('a hero with a skill fast-travels between twins joined without a Wardrobe', () => {
        expect(reachedColumns(setup(false), WIZARD)).toEqual([0, 2, 6]);
    });
});
