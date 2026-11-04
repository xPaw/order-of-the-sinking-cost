// Fire, pushes, elevators and rock bridges on tiny synthetic overworlds (one row of cells)
import { describe, expect, test, vi } from 'vitest';
import { PROG, WORLD } from '../src/data.ts';
import type { LatestValues } from '../src/save.ts';
import type { Position } from '../src/types.ts';
import type { FloodOptions } from '../src/walk/flood.ts';
import { walker } from '../src/walk/walker.ts';
import type { Walker } from '../src/walk/walker.ts';
import { freezerAt, NONE, padAt } from './fixtures.ts';
import type { Columns, Rows } from './fixtures.ts';

vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    return { SCHEMA, PROG: {}, WORLD: {}, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

/** The rows a test adds to a world, and the switch-gate setup it varies. */
interface SwitchGateRows {
    switches?: number[][];
    gates?: number[][];
    rocks?: number[][];
}

const Z_OFFSET = 64;
// A `width` x 1 row; walls: per column the solid z values; water: per column the indices into extra.oceans
function world(width: number, walls: Columns = {}, extra: Rows = {}, water: Columns = {}) {
    const columns: number[] = [];
    const wet: number[] = [];
    for (let i = 0; i < width; i++) {
        const heights = walls[i] || [],
            oceanIndexes = water[i] || [];
        columns.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
        wet.push(oceanIndexes.length, ...oceanIndexes.flatMap((oceanIndex) => [oceanIndex & 255, oceanIndex >> 8]));
    }
    Object.assign(WORLD!, { solid: Uint8Array.from(columns), groups: new Uint8Array(0), water: Uint8Array.from(wet) });
    Object.assign(PROG, {
        levels: [],
        teleporters: [],
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
            movables: [],
            blockers: [],
            beam_stops: [],
            lights: [],
            bridges: [],
            mechs: [],
            area_pins: [],
            guy: [0, 0],
            // a BEAM_POWERED Gem_Slot powers the room, so every light here casts its beam
            gem_slots: [[90, 0, 0, 0, 1]],
            ...extra,
        },
    });
}
const xs = (walkGrid: Walker, cellSet: Iterable<number>, z: number) =>
    [...cellSet]
        .filter((cell) => Math.floor(cell / walkGrid.layerCells) - 80 === z)
        .map((cell) => cell % walkGrid.width)
        .toSorted((first, second) => first - second);
const fill = (walkGrid: Walker, i: number, z: number, protection = 0) =>
    walkGrid.flood([[walkGrid.cellOf(i, 0, z), protection]]);
// walls under every column at z 0, so the hero walks at z 1; column `width` - 1 a high wall that stops the wrap
const floor = (width: number, more: Columns = {}): Columns => ({
    ...Object.fromEntries(Array.from({ length: width }, (_, i) => [i, [0]])),
    [width - 1]: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    ...more,
});

describe('fire', () => {
    // a goblin at column 4 attacks its own cell, columns 3 and 5 and the cells above and below it
    const goblin = { monsters: [[9, 4, 0, 1, -1]] };
    test('a goblin attacks its own cell and the 6 cells next to it, above and below included', () => {
        world(8, floor(8, { 4: [] }), goblin);
        const walkGrid = walker(NONE, [], []);
        expect([1, 2].map((z) => xs(walkGrid, walkGrid.fire, z))).toEqual([[3, 4, 5], [4]]);
        expect(xs(walkGrid, walkGrid.fire, 0)).toEqual([4]);
    });
    test('a shut Gate or a Monster beside the goblin shields nothing', () => {
        world(8, floor(8, { 4: [] }), {
            ...goblin,
            gates: [[61, 5, 0, 1, 0, 0, 7, 0, 5]],
            monsters: [...goblin.monsters, [10, 3, 0, 1, 0]],
        });
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, walkGrid.fire, 1)).toEqual([3, 4, 5]);
    });
    describe('a Fence on the edge', () => {
        // a Fence on the east side of column 4 parts the goblin from column 5; a SQUEEZE light at column 1 casts a beam
        // over columns 2-6 (an Egg at 7 ends it)
        const fenced = { ...goblin, fences: [[70, 4, 0, 1, 0]] };
        const squeeze = { lights: [[50, 1, 0, 1, 0, 0, 0, 1, 9]], beam_stops: [[7, 0, 1]] };
        test('spares the cell behind it', () => {
            world(8, floor(8, { 4: [] }), fenced);
            const walkGrid = walker(NONE, [], []);
            expect(xs(walkGrid, walkGrid.fire, 1)).toEqual([3, 4]);
        });
        test('spares nothing when the goblin stands in a SQUEEZE beam', () => {
            world(8, floor(8, { 4: [] }), { ...fenced, ...squeeze });
            const walkGrid = walker(NONE, [], []);
            expect(xs(walkGrid, walkGrid.fire, 1)).toEqual([3, 4, 5]);
        });
    });
    describe('a wall beside the goblin', () => {
        // a wall at column 5 for z 0..1; a THROUGH light at column 1 casts a beam over columns 2-6 (an Egg at 7 ends it)
        const walled = floor(8, { 4: [], 5: [0, 1] });
        const through = { lights: [[50, 1, 0, 1, 0, 0, 0, 1, 1]], beam_stops: [[7, 0, 1]] };
        test('is not attacked', () => {
            world(8, walled, goblin);
            const walkGrid = walker(NONE, [], []);
            expect(xs(walkGrid, walkGrid.fire, 1)).toEqual([3, 4]);
        });
        test('is attacked when the goblin stands in a THROUGH beam', () => {
            world(8, walled, { ...goblin, ...through });
            const walkGrid = walker(NONE, [], []);
            expect(xs(walkGrid, walkGrid.fire, 1)).toEqual([3, 4, 5]);
        });
    });
    test('a hero without PROTECTION does not enter an attacked cell; one with it does', () => {
        world(8, floor(8), goblin);
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 1), 1)).toEqual([0, 1, 2]);
        expect(xs(walkGrid, fill(walkGrid, 0, 1, 1), 1)).toContain(3);
    });
});

describe('pushes', () => {
    test('a push into a wall blocks the step', () => {
        world(8, floor(8, { 4: [0, 1] }), { rocks: [[9, 3, 0, 1]] });
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 1), 1)).toEqual([0, 1, 2]);
    });
    test('a push into open space lets the hero through', () => {
        world(8, floor(8), { rocks: [[9, 3, 0, 1]] });
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 1), 1)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
    test('a push into another pushable blocks the step', () => {
        world(8, floor(8), { rocks: [[9, 3, 0, 1]], movables: [[10, 4, 0, 1, 0]] });
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 1), 1)).toEqual([0, 1, 2]);
    });
    test('a Sign blocks the hero and holds him up', () => {
        world(8, floor(8, { 5: [] }), {
            blockers: [
                [10, 3, 0, 1],
                [11, 5, 0, 0],
            ],
        });
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 1), 1)).toEqual([0, 1, 2]);
        expect(xs(walkGrid, fill(walkGrid, 4, 1), 1)).toEqual([4, 5, 6]);
    });
});

describe('elevators', () => {
    // frames at column 2, z 1 and z 5; columns 3-4 are walls up to z 4, so the hero walks on at z 5 from the top
    const walls = floor(7, { 3: [0, 1, 2, 3, 4], 4: [0, 1, 2, 3, 4] });
    const lift = (mask: number) => ({ elevators: [[2, 0, 1, 2, 0, 5, mask, 20, -1, 21, -1]] });
    test('mask bit 1 rides up from the bottom frame to the top frame itself', () => {
        world(7, walls, lift(1));
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 1), 5)).toEqual([2, 3, 4]);
    });
    test('without bit 1 the bottom frame leads nowhere; bit 2 rides down from the top', () => {
        world(7, walls, lift(2));
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 1), 5)).toEqual([]);
        expect(xs(walkGrid, fill(walkGrid, 4, 5), 1)).toEqual([0, 1, 2, 5]);
    });
    test('mask 0 links nothing', () => {
        world(7, walls, lift(0));
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 1), 5)).toEqual([]);
    });
});

describe('rock bridges', () => {
    // ground at z 0 (the implicit floor) but for a water channel at columns 4-5, a wall at 9; Rocks at 2 and on the wall
    const run = (bridges: number[][]) => {
        world(
            10,
            { 9: [0, 1] },
            {
                oceans: [[30, 0, 0, 4, 0, 2, 1]],
                rocks: [
                    [40, 2, 0, 0],
                    [41, 9, 0, 2],
                ],
                bridges,
            },
            { 4: [0], 5: [0] },
        );
        const walkGrid = walker(NONE, [], []);
        return xs(walkGrid, fill(walkGrid, 0, 0), 0);
    };
    test('no bridge: the water stops the walk', () => {
        expect(run([])).toEqual([0, 1, 2, 3]);
    });
    test('a Rock bridges one water cell, however many ways it has', () => {
        expect(
            run([
                [40, 1, 0, 0, 4, 0, 0],
                [40, 1, 0, 0, 5, 0, 0],
            ]),
        ).toEqual([0, 1, 2, 3, 4]);
    });
    test('two Rocks bridge two cells', () => {
        expect(
            run([
                [40, 1, 0, 0, 4, 0, 0],
                [41, 2, 0, 0, 5, 0, 0],
            ]),
        ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });
    test("a Rock that sank with turns leaves its cell to the next Rock's pushes", () => {
        // water at columns 5 and 7, a wall at 10; heroes at 1 and 3. The Rock at 4 sinks at 5, and the Rock at 2 is
        // pushed through 4 and over that bridge to sink at 7
        world(
            11,
            { 10: [0, 1] },
            {
                oceans: [
                    [30, 0, 0, 5, 0, 1, 1],
                    [31, 0, 0, 7, 0, 1, 1],
                ],
                rocks: [
                    [40, 4, 0, 0],
                    [41, 2, 0, 0],
                ],
            },
            { 5: [0], 7: [1] },
        );
        const walkGrid = walker(NONE, [], []);
        const reached = walkGrid.flood([
            [walkGrid.cellOf(1, 0, 0), 0],
            [walkGrid.cellOf(3, 0, 0), 0],
        ]);
        expect(xs(walkGrid, reached, 0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
});

describe('switch gates', () => {
    // a Switch at column 2 and a shut Gate of its flavor at column 4
    const run = (more: SwitchGateRows = {}) => {
        world(10, floor(10), {
            switches: [[60, 7, 0, 2, 0, 1], ...(more.switches || [])],
            gates: [[61, 4, 0, 1, 0, 0, 7, 0, 5], ...(more.gates || [])],
            rocks: more.rocks || [],
        });
        const walkGrid = walker(NONE, [], []);
        return xs(walkGrid, fill(walkGrid, 0, 1), 1);
    };
    test('a Switch only the hero stands on keeps its gates shut', () => {
        expect(run()).toEqual([0, 1, 2, 3]);
    });
    test("pushing a Rock onto every Switch of a flavor not pressed opens the flavor's shut gates", () => {
        expect(run({ rocks: [[64, 1, 0, 1]] })).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });
    test('one object for a flavor with two Switches keeps its gates shut, with the hero on the other', () => {
        expect(run({ switches: [[62, 7, 0, 3, 0, 1]], rocks: [[64, 1, 0, 1]] })).toEqual([0, 1, 2, 3]);
    });
    test('a Switch of the flavor behind the gate keeps it shut', () => {
        expect(run({ switches: [[62, 7, 0, 6, 0, 1]] })).toEqual([0, 1, 2, 3]);
    });
    // an open notted Gate of the same flavor at column 7
    const notted = [[63, 7, 0, 1, 1, 1, 7, 0, 5]];
    test('a flavor with notted gates and no object for its Switch stays as it is', () => {
        expect(run({ gates: notted })).toEqual([0, 1, 2, 3]);
    });
    test("a press opens a flavor's shut gates and shuts its notted ones together", () => {
        expect(run({ gates: notted, rocks: [[64, 1, 0, 1]] })).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
});

describe('a Switch under water', () => {
    // walls under every column at z 0 but for a pool at column 3 whose floor holds a Switch at z 0; a Rock at column
    // 2; a shut Gate of the Switch's flavor at column 8, west of the start across the wrap
    const run = (surface: number) => {
        const walls = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, [0]]));
        walls[3] = [];
        world(
            10,
            walls,
            {
                oceans: [[30, surface, 0, 3, 0, 1, 1]],
                switches: [[60, 7, 0, 3, 0, 0]],
                gates: [[61, 8, 0, 1, 0, 0, 7, 0, 5]],
                rocks: [[64, 2, 0, 1]],
            },
            { 3: [0] },
        );
        const walkGrid = walker(NONE, [], []);
        return xs(walkGrid, fill(walkGrid, 0, 1), 1);
    };
    test('a Rock pushed into the water sinks onto it when it lies one below the surface, opening the Gate', () => {
        expect(run(1)).toEqual([0, 1, 2, 4, 5, 6, 7, 8, 9]);
    });
    test('deeper down, the Rock stops at the surface - 1 above it', () => {
        expect(run(2)).toEqual([0, 1, 2, 9]);
    });
});

describe('closing Gates', () => {
    // a Switch at column 4 beside a shut Gate of its flavor at column 5, closing up (4) or down (5); columns 6-10 are
    // a step up, walls to z 1, so the hero walks at z 2 there
    const run = ({
        closes = 4,
        switchColumn = 4,
        more = {},
    }: { closes?: number; switchColumn?: number; more?: SwitchGateRows } = {}) => {
        const step = { 6: [0, 1], 7: [0, 1], 8: [0, 1], 9: [0, 1], 10: [0, 1] };
        world(12, floor(12, step), {
            switches: [[60, 7, 0, switchColumn, 0, 1], ...(more.switches || [])],
            gates: [[61, 5, 0, 1, 0, 0, 7, 0, closes]],
            rocks: more.rocks || [],
        });
        const walkGrid = walker(NONE, [], []);
        return xs(walkGrid, fill(walkGrid, 3, 1), 2);
    };
    test('a hero stepping off the Switch into the Gate is lifted onto the cell above as it closes', () => {
        expect(run()).toEqual([5, 6, 7, 8, 9, 10]);
    });
    test('a Gate that closes downward lifts nobody', () => {
        expect(run({ closes: 5 })).toEqual([]);
    });
    test('a Switch two cells from the Gate lifts nobody', () => {
        expect(run({ switchColumn: 3 })).toEqual([]);
    });
    // a second Switch of the flavor at column 1, and a Rock at column 2 the hero pushes onto it from column 3
    const second = [[62, 7, 0, 1, 0, 1]];
    test('another Switch of the flavor with no object keeps the Gate shut', () => {
        expect(run({ more: { switches: second } })).toEqual([]);
    });
    test('an object on every other Switch of the flavor lets the hero hold the last one', () => {
        expect(run({ more: { switches: second, rocks: [[64, 2, 0, 1]] } })).toEqual([5, 6, 7, 8, 9, 10]);
    });
});

describe('Rod launches', () => {
    // a shut Gate at column 1 with floor beyond it at column 0; the hero starts at column 2, a Wardrobe at column 3
    // whose door faces east, a Rock at column 5 and a Switch of the Gate's flavor at column 7, past a wall at column 6
    interface RodRun {
        rod?: number[];
        latest?: LatestValues;
        walls?: Columns;
        more?: Rows;
    }
    const run = ({ rod = [40], latest = NONE, walls = { 6: [0, 1] }, more = {} }: RodRun = {}) => {
        world(12, floor(12, walls), {
            wardrobes: [[40, 3, 0, 1, 0, 0]],
            rod,
            rocks: [[64, 5, 0, 1]],
            switches: [[60, 7, 0, 7, 0, 1]],
            gates: [[61, 1, 0, 1, 0, 0, 7, 0, 5]],
            ...more,
        });
        const walkGrid = walker(latest, [], []);
        return xs(walkGrid, fill(walkGrid, 2, 1), 1);
    };
    test('a hero without the Rod cannot push the Rock past the wall onto the Switch', () => {
        expect(run({ rod: [] })).toEqual([2, 3, 4]);
    });
    test("a hero who left the Rod Wardrobe's door launches the Rock over the wall onto the Switch", () => {
        expect(run()).toEqual([0, 1, 2, 3, 4]);
    });
    test('a hero who holds the Rod in the save launches it too', () => {
        const holdsRod: LatestValues = {
            ...NONE,
            get: (pid, field) =>
                field === 'inventory_flags' ? new Uint8Array(new Uint32Array([0x400]).buffer) : undefined,
        };
        expect(run({ rod: [], latest: holdsRod })).toEqual([0, 1, 2, 3, 4]);
    });
    test('a launch ignores a Fence between the Rock and the Switch', () => {
        // no wall; the Switch at column 6, behind a Fence on the Rock's east edge
        const fenced = { walls: {}, more: { switches: [[60, 7, 0, 6, 0, 1]], fences: [[70, 5, 0, 1, 0]] } };
        expect(run({ rod: [], ...fenced })).toEqual([2, 3, 4]);
        expect(run(fenced)).toEqual([0, 1, 2, 3, 4]);
    });
});

describe('Freezers', () => {
    // a pit at column 3 holds a Freezer at z 0
    const run = (closed: boolean) => {
        world(8, floor(8, { 3: [] }));
        PROG.freezers = [freezerAt(0, [3, 0, 0])];
        const walkGrid = walker(NONE, [], [closed]);
        return xs(walkGrid, fill(walkGrid, 0, 1), 1);
    };
    test('a closed Freezer holds up the hero on top of it', () => {
        expect(run(true)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
    test('an open Freezer leaves a pit the hero falls into', () => {
        expect(run(false)).toEqual([0, 1, 2]);
    });
    test('a flood that walks no Freezer tops stops at the closed Freezer', () => {
        world(8, floor(8, { 3: [] }));
        PROG.freezers = [freezerAt(0, [3, 0, 0])];
        const walkGrid = walker(NONE, [], [true]);
        const options = { reveal: false, pocket: true, frozenHolds: false };
        const reached = walkGrid.flood([walkGrid.cellOf(0, 0, 1)], null, null, options);
        expect(xs(walkGrid, reached, 1)).toEqual([0, 1, 2]);
    });
    // a ledge at z 3 over columns 0..1, a pit at column 2 holding the Freezer, then a floor at z 1 over columns 3..5
    const dropOntoFreezer = (options: FloodOptions) => {
        world(8, { 0: [0, 1, 2], 1: [0, 1, 2], 3: [0], 4: [0], 5: [0], 7: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
        PROG.freezers = [freezerAt(0, [2, 0, 0])];
        const walkGrid = walker(NONE, [], [true]);
        const reached = walkGrid.flood([walkGrid.cellOf(0, 0, 3)], null, null, options);
        return [3, 1].map((z) => xs(walkGrid, reached, z));
    };
    test('a flood that walks no Freezer tops walks off a ledge into the pit and no further', () => {
        expect(dropOntoFreezer({ pocket: true, frozenHolds: false })).toEqual([[0, 1], []]);
    });
    test('a fall lands on the closed Freezer when the flood lets drops land on tops', () => {
        expect(dropOntoFreezer({ pocket: true, frozenHolds: false, topDrops: true })).toEqual([
            [0, 1],
            [2, 3, 4, 5],
        ]);
    });
    test('a step from the side still does not land on the closed Freezer', () => {
        world(8, floor(8, { 3: [] }));
        PROG.freezers = [freezerAt(0, [3, 0, 0])];
        const walkGrid = walker(NONE, [], [true]);
        const options = { reveal: false, pocket: true, frozenHolds: false, topDrops: true };
        const reached = walkGrid.flood([walkGrid.cellOf(0, 0, 1)], null, null, options);
        expect(xs(walkGrid, reached, 1)).toEqual([0, 1, 2]);
    });
});

describe('skills', () => {
    test('a hero with PROTECTION pushes nothing', () => {
        world(8, floor(8), { rocks: [[9, 3, 0, 1]] });
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 1), 1)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(xs(walkGrid, fill(walkGrid, 0, 1, 1), 1)).toEqual([0, 1, 2]);
    });
});

describe('water', () => {
    test('a jump marker does not let the hero into deep water: he lands at the surface - 1 and drowns', () => {
        world(8, { 7: [0, 1] }, { oceans: [[30, 0, 0, 4, 0, 2, 1]], jumps: [[3, 0, 0, 1]] }, { 4: [0], 5: [0] });
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 0), 0)).toEqual([0, 1, 2, 3]);
        expect(xs(walkGrid, fill(walkGrid, 0, 0), -1)).toEqual([]);
    });
});

describe('beam powers', () => {
    // a powered light at column 1 facing east, its beam over columns 2-6 (an Egg at 7 ends it); a wall at column 5
    const run = (color: number, more: Rows = {}) => {
        world(10, floor(10, { 5: [0, 1] }), {
            lights: [[50, 1, 0, 1, 0, 0, 0, 1, color]],
            beam_stops: [[7, 0, 1]],
            ...more,
        });
        const walkGrid = walker(NONE, [], []);
        return xs(walkGrid, fill(walkGrid, 0, 1), 1);
    };
    test('OPEN: the wall stops the walk', () => {
        expect(run(0)).toEqual([0, 1, 2, 3, 4]);
    });
    test('ENDPOINT: a move along the beam jumps to its last cell, against it to its first (from an end: no move)', () => {
        expect(run(5)).toEqual([0, 1, 2, 6]);
    });
    test('DOUBLE: a move in the beam goes two cells, checking the destination only', () => {
        expect(run(3)).toEqual([0, 1, 2, 4, 6, 7, 8]);
    });
    test('ALTER in the same cells leaves the move a plain step', () => {
        expect(
            run(5, {
                lights: [
                    [50, 1, 0, 1, 0, 0, 0, 1, 5],
                    [51, 1, 0, 1, 0, 0, 0, 1, 7],
                ],
            }),
        ).toEqual([0, 1, 2, 3, 4]);
    });
    test('SQUEEZE: a hero in the beam passes Fences', () => {
        world(10, floor(10), { fences: [[70, 3, 0, 1, 0]] });
        const plain = walker(NONE, [], []);
        expect(xs(plain, fill(plain, 0, 1), 1)).toEqual([0, 1, 2, 3]);
        world(10, floor(10), { fences: [[70, 3, 0, 1, 0]], lights: [[50, 1, 0, 1, 0, 0, 0, 1, 9]] });
        const walkGrid = walker(NONE, [], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 1), 1)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });
    // water at columns 3-6 (surface 0); a light at column 1, its beam over columns 2-7 (an Egg at 8 ends it)
    const sea = (color: number) => {
        world(
            10,
            { 9: [0, 1] },
            { oceans: [[30, 0, 0, 3, 0, 4, 1]], lights: [[50, 1, 0, 0, 0, 0, 0, 1, color]], beam_stops: [[8, 0, 0]] },
            { 3: [0], 4: [0], 5: [0], 6: [0] },
        );
        const walkGrid = walker(NONE, [], []);
        return xs(walkGrid, fill(walkGrid, 0, 0), 0);
    };
    test('DOUBLE over water holds the hero at the surface', () => {
        expect(sea(0)).toEqual([0, 1, 2]);
        expect(sea(3)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });
});

describe('THROUGH beams', () => {
    // a wall at column 5 for z 0..1 and a THROUGH light at column 8 facing west, its beam over the wall; the hero walks
    // east from column 0 at z 1
    const pushInto = (more: Rows) => {
        world(12, floor(12, { 5: [0, 1] }), { lights: [[50, 8, 0, 1, 2, 0, 0, 1, 1]], ...more });
        const walkGrid = walker(NONE, [], []);
        return xs(walkGrid, fill(walkGrid, 0, 1), 1);
    };
    test('a Rock the beam stops at is not pushed into the wall cell', () => {
        expect(pushInto({ rocks: [[20, 4, 0, 1]] })).toEqual([0, 1, 2, 3]);
    });
    test('a MIRRORABLE Rock or a Monster in the beam is pushed into the wall cell', () => {
        expect(pushInto({ rocks: [[20, 4, 0, 1]], mirrorable: [20] })).toContain(4);
        expect(pushInto({ monsters: [[20, 4, 0, 1, -2]] })).toContain(4);
    });
    test('a pad lands the hero in the wall cell only from the beam', () => {
        // a THROUGH light at column 3 facing east, its beam over columns 4-7 (an Egg at 8 ends it); a high wall at
        // column 2 keeps the hero on the pad at column 1, whose Marker is in the wall cell
        world(12, floor(12, { 2: [0, 1, 2, 3], 5: [0, 1] }), {
            lights: [[50, 3, 0, 1, 0, 0, 0, 1, 1]],
            beam_stops: [[8, 0, 1]],
        });
        PROG.teleporters = [padAt(80, [1, 0, 1], 81, [5, 0, 1])];
        const walkGrid = walker(NONE, [{ en: true, disc: true }], []);
        expect(xs(walkGrid, fill(walkGrid, 0, 1), 1)).toEqual([0, 1]);
    });
});

describe('pads to a Marker', () => {
    // a minor pad at column 1 whose target is a Marker above column 6; a wall at column 5
    const run = (to: Position, water: Columns = {}, oceans: number[][] = []) => {
        world(
            10,
            floor(10, { 5: [0, 1], ...Object.fromEntries(Object.keys(water).map((column) => [column, []])) }),
            { oceans },
            water,
        );
        PROG.teleporters = [padAt(80, [1, 0, 1], 81, to)];
        const walkGrid = walker(NONE, [{ en: true, disc: true }], []);
        return xs(walkGrid, fill(walkGrid, 0, 1), 1);
    };
    test('the mover lands on the first supported cell at or below the Marker', () => {
        expect(run([6, 0, 7])).toEqual([0, 1, 2, 3, 4, 6, 7, 8]);
    });
    test('a pad frozen in a closed Freezer under the hero sends him nowhere', () => {
        // a pit at column 3 holds the Freezer, the pad in it; a wall at column 5
        const walkOverFreezer = (closed: boolean) => {
            world(10, floor(10, { 3: [], 5: [0, 1] }));
            PROG.freezers = [freezerAt(0, [3, 0, 0])];
            PROG.teleporters = [padAt(80, [3, 0, 0], 81, [6, 0, 7])];
            const walkGrid = walker(NONE, [{ en: true, disc: true }], [closed]);
            return xs(walkGrid, fill(walkGrid, 0, 1), 1);
        };
        expect(walkOverFreezer(true)).toEqual([0, 1, 2, 3, 4]);
        expect(walkOverFreezer(false)).toEqual([0, 1, 2, 6, 7, 8]);
    });
    test('a pad to a pad frozen in a closed Freezer sends the mover nowhere', () => {
        // the pad at column 1 targets the pad at column 6, inside the Freezer there; a wall at column 5
        const walkToFrozenPad = (closed: boolean) => {
            world(10, floor(10, { 5: [0, 1] }));
            PROG.freezers = [freezerAt(0, [6, 0, 1])];
            PROG.teleporters = [padAt(80, [1, 0, 1], 81), padAt(81, [6, 0, 1], 80)];
            const pads = [
                { en: true, disc: true },
                { en: true, disc: true },
            ];
            const walkGrid = walker(NONE, pads, [closed]);
            const reached = fill(walkGrid, 0, 1);
            return [1, 2].map((z) => xs(walkGrid, reached, z));
        };
        expect(walkToFrozenPad(true)).toEqual([[0, 1, 2, 3, 4], []]);
        expect(walkToFrozenPad(false)).toEqual([[0, 1, 2, 3, 4, 6, 7, 8], []]);
    });
    test('a Marker over deep water sends the mover nowhere', () => {
        world(10, floor(10, { 5: [0, 1], 6: [], 7: [] }), { oceans: [[30, 0, 0, 6, 0, 2, 1]] }, { 6: [0], 7: [0] });
        PROG.teleporters = [padAt(80, [1, 0, 1], 81, [6, 0, 7])];
        const walkGrid = walker(NONE, [{ en: true, disc: true }], []);
        const reached = fill(walkGrid, 0, 1);
        expect([0, -1, -2].flatMap((z) => xs(walkGrid, reached, z))).toEqual([]);
        expect(xs(walkGrid, reached, 1)).toEqual([0, 1, 2, 3, 4]);
    });
});
