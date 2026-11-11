// CREATION_OR_DESTRUCTION records and the teleporter discovery chain on tiny synthetic overworlds
import { describe, expect, test, vi } from 'vitest';
import { PROG } from '../src/data.ts';
import { WORLD } from '../src/world-data.ts';
import type { Creation, LatestValues } from '../src/save.ts';
import type { Position, Teleporter, World } from '../src/types.ts';
import { NO_HISTORY } from '../src/walk/reachability.ts';
import { reveals } from '../src/walk/teleporters.ts';
import type { TeleporterState } from '../src/walk/teleporters.ts';
import { walker } from '../src/walk/walker.ts';
import type { Walker } from '../src/walk/walker.ts';
import { f32, pad } from './fixtures.ts';

vi.mock('../src/world-data.ts', () => import('./world-data-mock.ts'));
vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    return { SCHEMA, PROG: {}, WORLD: {}, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

const Z_OFFSET = 64,
    MADE = (1023 << 20) + 1;
// A `width` x 1 row; walls: per column the solid z values
function world(
    width: number,
    walls: Record<number, number[]> = {},
    extra: Partial<World> = {},
    teleporters: Teleporter[] = [],
) {
    const columns: number[] = [];
    for (let i = 0; i < width; i++) {
        const heights = walls[i] || [];
        columns.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
    }
    Object.assign(WORLD!, { solid: Uint8Array.from(columns), groups: new Uint8Array(0), water: new Uint8Array(width) });
    Object.assign(PROG, {
        levels: [],
        teleporters,
        freezers: [],
        world: {
            grid: { corner: [0, 0], size: [width, 1], zoff: Z_OFFSET },
            zlayer: Array.from({ length: 256 }, () => 0),
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
            wardrobes: [],
            monsters: [],
            beam_stops: [],
            lights: [],
            mechs: [],
            area_pins: [],
            guy: [0, 0],
            ...extra,
        },
    });
}

type CreatedEntity = [pid: number, type: string, destroyed: boolean, position?: Position];

// latest values: `created` as [pid, type, destroyed, [x, y, z]]
function latest(created: CreatedEntity[] = []): LatestValues {
    const positions = new Map<number, Position>();
    const creations = new Map<number, Creation>();
    for (const [pid, type, destroyed, position] of created) {
        if (position) positions.set(pid, position);
        creations.set(pid, { type, destroyed });
    }

    return {
        ...NO_HISTORY,
        get: (pid: number, field: string) => {
            const position = positions.get(pid),
                axis = field.startsWith('base.position.') ? 'xyz'.indexOf(field.slice(-1)) : -1;
            return position && axis >= 0 ? f32(position[axis]) : undefined;
        },
        created: creations,
    };
}
const xs = (walkGrid: Walker, cellSet: Iterable<number>, z: number) =>
    [...cellSet]
        .filter((cell) => Math.floor(cell / walkGrid.layerCells) - 80 === z)
        .map((cell) => cell % walkGrid.width)
        .toSorted((first, second) => first - second);

describe('CREATION_OR_DESTRUCTION', () => {
    // walls at z 0 under columns 0-2 and 4-5 (the hero walks on top at z 1), none at column 3; 6-7 are wall at z 0 and 1
    const STEP: Record<number, number[]> = { 0: [0], 1: [0], 2: [0], 4: [0], 5: [0], 6: [0, 1], 7: [0, 1] };
    test('a created Rock supports the hero at its latest position', () => {
        world(8, STEP);
        const plain = walker(latest(), [], []);
        expect(xs(plain, plain.flood([plain.cellOf(0, 0, 1)]), 1)).toEqual([0, 1, 2]);
        const walkGrid = walker(latest([[MADE, 'Rock', false, [3, 0, 0]]]), [], []);
        expect(xs(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 1)]), 1)).toEqual([0, 1, 2, 3, 4, 5]);
    });
    test('a destroyed Rock supports nothing', () => {
        world(8, STEP, { rocks: [[50, 3, 0, 0]] });
        const kept = walker(latest(), [], []);
        expect(xs(kept, kept.flood([kept.cellOf(0, 0, 1)]), 1)).toEqual([0, 1, 2, 3, 4, 5]);
        const walkGrid = walker(latest([[50, 'Rock', true]]), [], []);
        expect(xs(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 1)]), 1)).toEqual([0, 1, 2]);
    });
    test('a destroyed dragon breathes no fire', () => {
        world(8, {}, { monsters: [[60, 0, 0, 0, 0]] });
        const walkGrid = walker(latest(), [], []);
        expect(xs(walkGrid, walkGrid.fire, 0)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        expect(walker(latest([[60, 'Monster', true]]), [], []).fire.size).toBe(0);
    });
    test('fire stops at a Tree only while it exists', () => {
        world(8, {}, { monsters: [[60, 0, 0, 0, 0]], trees: [[70, 3, 0, 0]] });
        const walkGrid = walker(latest(), [], []);
        expect(xs(walkGrid, walkGrid.fire, 0)).toEqual([1, 2]);
        expect(walker(latest([[70, 'Tree', true]]), [], []).fire.size).toBe(7);
    });
});

describe('teleporter discovery chain', () => {
    // 0 world pad: target 1 (its map-room twin), also_discover 2; 2: also_discover2 3; 3: also_discover 4
    const TELEPORTERS = [
        pad({ pid: 11, l: 0, major: 1, target: 12, also: 13 }),
        pad({ pid: 12, l: 3, major: 1, target: 11 }),
        pad({ pid: 13, l: 0, major: 1, target: 0, also2: 14 }),
        pad({ pid: 14, l: 0, major: 1, also: 15 }),
        pad({ pid: 15, l: 1, major: 1 }),
    ];
    test('target and also_discover chain, also_discover2 does not', () => {
        const revealed = reveals(TELEPORTERS);
        expect(revealed[0]).toEqual([2, 3]);
        expect(revealed[2]).toEqual([3]);
        expect(revealed[3]).toEqual([4]);
        expect(revealed[1]).toEqual([0, 2, 3]);
        expect(revealed[4]).toEqual([]);
    });
    test('discovery stops at a pad already discovered on the way', () => {
        const ring = [pad({ pid: 1, l: 0, also: 2 }), pad({ pid: 2, l: 0, also: 1, also2: 3 }), pad({ pid: 3, l: 0 })];
        expect(reveals(ring)).toEqual([[1, 2], [0, 2], []]);
    });
    describe('in the walk', () => {
        // a ground row split by walls at 4, 7 and 11: world pad A at 1, world pad B at 5; their map-room twins TA and TB
        // stand on a strip at z 10 (walls at z 9 under 8-10); TA discovers TB, whose target is B
        const pads = (exists?: number) => [
            pad({ pid: 21, p: [1, 0, 0], l: 0, major: 1, target: 23, ...(exists === undefined ? {} : { ex: exists }) }),
            pad({ pid: 22, p: [5, 0, 0], l: 0, major: 1, target: 24 }),
            pad({ pid: 23, p: [8, 0, 10], l: 3, major: 1, target: 21, also: 24 }),
            pad({ pid: 24, p: [10, 0, 10], l: 3, major: 1, target: 22 }),
        ];
        const STRIP: Record<number, number[]> = { 4: [0], 7: [0], 11: [0], 8: [9], 9: [9], 10: [9] };
        const run = (tst: TeleporterState[], teleporterPads = pads(), walls = STRIP) => {
            world(12, walls, {}, teleporterPads);
            const walkGrid = walker(latest(), tst, []);
            return xs(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 0)]), 0);
        };
        const ON: TeleporterState = { en: true, disc: false },
            ALL = [ON, ON, ON, ON];
        test('reaching an enabled MAJOR pad reaches the pads it reveals', () => {
            expect(run(ALL)).toEqual([0, 1, 2, 3, 5, 6]);
        });
        test('a revealed pad whose twin no walk reaches from the revealing twin is not reached', () => {
            expect(run(ALL, pads(), { ...STRIP, 9: [9, 10] })).toEqual([0, 1, 2, 3]);
        });
        test('a disabled pad reveals nothing', () => {
            expect(run([{ en: false, disc: false }, ON, ON, ON])).toEqual([0, 1, 2, 3]);
        });
        test('a revealing pad that does not exist reveals nothing', () => {
            expect(run(ALL, pads(0))).toEqual([0, 1, 2, 3]);
        });
        test('pockets of cells leave the revealed pads out', () => {
            world(12, STRIP, {}, pads());
            const walkGrid = walker(latest(), ALL, []);
            expect(xs(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 0)], null, null, { reveal: false }), 0)).toEqual([
                0, 1, 2, 3,
            ]);
        });
    });
    describe('a MAJOR pad trip', () => {
        // a ground row split by walls at 4, 8 and 11: discovered MAJOR pads A at 1 and B at 6, and a Rock at 7 that no
        // push moves; a hero with TELEPORT at B swaps with it
        const pads = () => [
            pad({ pid: 41, p: [1, 0, 0], l: 0, major: 1 }),
            pad({ pid: 42, p: [6, 0, 0], l: 0, major: 1 }),
        ];
        const WALLS: Record<number, number[]> = { 4: [0], 8: [0], 11: [0] };
        const FOUND: TeleporterState = { en: true, disc: true };
        const run = (layer: number) => {
            world(12, WALLS, { rocks: [[43, 7, 0, 0]] }, pads());
            const walkGrid = walker(latest(), [FOUND, FOUND], []);
            return xs(walkGrid, walkGrid.flood([[walkGrid.cellOf(0, 0, 0), layer]]), 0);
        };
        test('keeps the hero with TELEPORT, who swaps with the Rock', () => {
            expect(run(2)).toEqual([0, 1, 2, 3, 5, 6, 7]);
        });
        test('keeps a pushing hero, whose push the wall behind the Rock stops', () => {
            expect(run(0)).toEqual([0, 1, 2, 3, 5, 6]);
        });
    });
    describe('a MINOR pad trip', () => {
        // a ground row split by walls at 4 and 7: MINOR pad A at 1 (enabled) targets pad B at 5, which the save leaves
        // disabled; B targets pad C at 9
        const pads = () => [
            pad({ pid: 31, p: [1, 0, 0], l: 0, major: 0, target: 32 }),
            pad({ pid: 32, p: [5, 0, 0], l: 0, major: 0, target: 33 }),
            pad({ pid: 33, p: [9, 0, 0], l: 0, major: 0, target: 31 }),
        ];
        const WALLS: Record<number, number[]> = { 4: [0], 7: [0] };
        const ON: TeleporterState = { en: true, disc: false },
            OFF: TeleporterState = { en: false, disc: false };
        const run = (tst: TeleporterState[], seeds: number[], teleporterPads = pads()) => {
            world(12, WALLS, {}, teleporterPads);
            const walkGrid = walker(latest(), tst, []);
            return xs(walkGrid, walkGrid.flood(seeds.map((x) => walkGrid.cellOf(x, 0, 0))), 0);
        };
        test('enables the target pad, which then sends the hero on', () => {
            expect(run([ON, OFF, ON], [0])).toEqual([0, 1, 2, 3, 5, 6, 8, 9, 10, 11]);
        });
        test('a disabled pad reached without a trip sends nobody', () => {
            expect(run([ON, OFF, ON], [5])).toEqual([5, 6]);
        });
        test('a hero already standing on the target pad takes it once enabled', () => {
            expect(run([ON, OFF, ON], [0, 5])).toEqual([0, 1, 2, 3, 5, 6, 8, 9, 10, 11]);
        });
        test('the trip enables the pad for one flood only', () => {
            world(12, WALLS, {}, pads());
            const walkGrid = walker(latest(), [ON, OFF, ON], []);
            walkGrid.flood([walkGrid.cellOf(0, 0, 0)]);
            expect(xs(walkGrid, walkGrid.flood([walkGrid.cellOf(5, 0, 0)]), 0)).toEqual([5, 6]);
        });
    });
});
