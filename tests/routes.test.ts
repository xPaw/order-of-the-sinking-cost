// Routes on tiny synthetic overworlds: rock bridges in pocket floods, magic-mirror hops, the skip lane + TELEPORT
// swap, ALTER beams, OPEN beams opening Gates, requirement cycles, overlapping areas and mirror marks
import { describe, expect, test, vi } from 'vitest';
import { PROG, WORLD } from '../src/data.ts';
import { levelAreaOf } from '../src/model/areas.ts';
import { levelsNeedingLevel } from '../src/model/unlocking.ts';
import type { LatestValues, OceanChange } from '../src/save.ts';
import type { Area, ProgressLevel } from '../src/types.ts';
import { endpointTarget } from '../src/walk/beams.ts';
import type { EndpointBeam } from '../src/walk/beams.ts';
import type { FloodOptions } from '../src/walk/flood.ts';
import { levelGeometry } from '../src/walk/geometry.ts';
import { walker } from '../src/walk/walker.ts';
import type { Walker } from '../src/walk/walker.ts';
import { f32, freezerAt, NONE, progressLevel } from './fixtures.ts';
import type { Columns, Rows } from './fixtures.ts';

vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    return { SCHEMA, PROG: {}, WORLD: {}, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

interface WorldOptions {
    width: number;
    height?: number;
    walls?: Columns;
    water?: Columns;
    extra?: Rows;
}

const Z_OFFSET = 64;
const [OPEN, DOUBLE, ALTER] = [0, 3, 7];
// A `width` x `height` grid. walls: per column (i + j * width) the solid z values; water: per column the indices into
// extra.oceans
function world({ width, height = 1, walls = {}, water = {}, extra = {} }: WorldOptions) {
    const solidColumns: number[] = [];
    const wet: number[] = [];
    for (let column = 0; column < width * height; column++) {
        const heights = walls[column] || [],
            oceanIndexes = water[column] || [];
        solidColumns.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
        wet.push(oceanIndexes.length, ...oceanIndexes.flatMap((oceanIndex) => [oceanIndex & 255, oceanIndex >> 8]));
    }
    Object.assign(WORLD!, {
        solid: Uint8Array.from(solidColumns),
        groups: new Uint8Array(0),
        water: Uint8Array.from(wet),
    });
    Object.assign(PROG, {
        levels: [],
        teleporters: [],
        freezers: [],
        world: {
            grid: { corner: [0, 0], size: [width, height], zoff: Z_OFFSET },
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
            magic_mirrors: [],
            skippable: [],
            teleport: [],
            area_pins: [],
            guy: [0, 0],
            ...extra,
        },
    });
}
// a BEAM_POWERED Gem_Slot at (0, 0, 0): it powers every light in that room
const POWERED_ROOM = [[90, 0, 0, 0, 1]];
// the reached cells at z as "i,j", sorted by row then column
const cells = (walkGrid: Walker, cellSet: Iterable<number>, z = 0) =>
    [...cellSet]
        .filter((cell) => Math.floor(cell / walkGrid.layerCells) - 80 === z)
        .map((cell) => [cell % walkGrid.width, Math.floor((cell % walkGrid.layerCells) / walkGrid.width)])
        .toSorted((first, second) => first[1] - second[1] || first[0] - second[0])
        .map((point) => point.join());
const columns = (walkGrid: Walker, cellSet: Iterable<number>, z = 0) =>
    cells(walkGrid, cellSet, z).map((point) => +point.split(',')[0]);
const fill = (walkGrid: Walker, i: number, j: number, z: number, options?: FloodOptions) =>
    walkGrid.flood([walkGrid.cellOf(i, j, z)], null, null, options);

describe('rock bridges in pocket floods', () => {
    // walls under every column at z 0 but the water column 5 (surface 1); a Rock at 3 is pushed from 2 into the water
    // at 5; column 9 is a high wall
    const setup = () => {
        const walls: Columns = {};
        for (let i = 0; i < 10; i++) if (i !== 5) walls[i] = [0];
        walls[9] = [0, 1, 2, 3];
        world({
            width: 10,
            walls,
            water: { 5: [0] },
            extra: {
                oceans: [[1, 1, 0, 5, 0, 1, 1]],
                rocks: [[9, 3, 0, 1]],
                bridges: [[9, 2, 0, 1, 5, 0, 1]],
            },
        });
        return walker(NONE, [], []);
    };
    test('a walk crosses only from the push side', () => {
        const walkGrid = setup();
        expect(columns(walkGrid, fill(walkGrid, 0, 0, 1), 1)).toContain(7);
        expect(columns(walkGrid, fill(walkGrid, 7, 0, 1), 1)).toEqual([6, 7, 8]);
    });
    test('a pocket flood counts the bridge water cell as floor from either side', () => {
        const walkGrid = setup();
        expect(columns(walkGrid, fill(walkGrid, 7, 0, 1, { pocket: true }), 1)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });
});

describe('magic-mirror hops', () => {
    // an 8 x 8 grid, all wall at z 0 but the west arm (1..3, 4) and the south arm (4, 1..3) of a magic Mirror at (4, 4)
    // whose open arms face west and south
    const open = ['1,4', '2,4', '3,4', '4,1', '4,2', '4,3'];
    const setup = (extra: Rows = {}, moreOpen: string[] = []) => {
        const walls: Columns = {};
        for (let column = 0; column < 64; column++) {
            const point = `${column % 8},${Math.floor(column / 8)}`;
            if (!open.includes(point) && !moreOpen.includes(point)) walls[column] = [0];
        }
        world({ width: 8, height: 8, walls, extra: { magic_mirrors: [[5, 4, 4, 0, -1, 0, 0, -1, 0, 0]], ...extra } });
        return walker(NONE, [], []);
    };
    test('a hero on one arm lands as far down the other', () => {
        const walkGrid = setup();
        expect(cells(walkGrid, fill(walkGrid, 1, 4, 0))).toEqual(['4,1', '4,2', '4,3', '1,4', '2,4', '3,4']);
    });
    test('a second magic Mirror in the room stops every hop', () => {
        const walkGrid = setup({
            magic_mirrors: [
                [5, 4, 4, 0, -1, 0, 0, -1, 0, 0],
                [6, 7, 7, 0, 0, 0, 0, 0, 1, 0],
            ],
        });
        expect(cells(walkGrid, fill(walkGrid, 1, 4, 0))).toEqual(['1,4', '2,4', '3,4']);
    });
    test('a second flat magic Mirror with no target on its arms stops no hop', () => {
        // the second Mirror at (7, 7) stands in wall: both its arms end at once
        const walkGrid = setup({
            magic_mirrors: [
                [5, 4, 4, 0, -1, 0, 0, -1, 0, 0],
                [6, 7, 7, 0, -1, 0, 0, -1, 0, 0],
            ],
        });
        expect(cells(walkGrid, fill(walkGrid, 1, 4, 0))).toEqual(['4,1', '4,2', '4,3', '1,4', '2,4', '3,4']);
    });
    test('a second magic Mirror with a target on an arm stops every hop', () => {
        // the second Mirror at (7, 4) looks west over (6, 4) at a Monster in (5, 4)
        const walkGrid = setup(
            {
                magic_mirrors: [
                    [5, 4, 4, 0, -1, 0, 0, -1, 0, 0],
                    [6, 7, 4, 0, -1, 0, 0, -1, 0, 0],
                ],
                monsters: [[8, 5, 4, 0, -2]],
            },
            ['5,4', '6,4'],
        );
        expect(cells(walkGrid, fill(walkGrid, 1, 4, 0))).toEqual(['1,4', '2,4', '3,4']);
    });
    test('a hero in the rays of a second magic Mirror hops from the cells outside them', () => {
        // the second Mirror at (2, 6) looks south over (2, 5) to (2, 4), a cell of the first Mirror's west arm
        const walkGrid = setup(
            {
                magic_mirrors: [
                    [5, 4, 4, 0, -1, 0, 0, -1, 0, 0],
                    [6, 2, 6, 0, 0, -1, 1, 0, 0, 0],
                ],
            },
            ['2,5'],
        );
        const hopsFrom = (i: number) => walkGrid.hops.has(walkGrid.cellOf(i, 4, 0));
        expect([hopsFrom(1), hopsFrom(2), hopsFrom(3)]).toEqual([true, false, true]);
    });
    test('the hero must stand nearer than the first target on the other arm', () => {
        // a Monster at (4, 1), the third cell of the south arm, which the wall at (4, 0) keeps from being pushed
        const walkGrid = setup({ monsters: [[7, 4, 1, 0, -2]] });
        expect(cells(walkGrid, fill(walkGrid, 1, 4, 0))).toEqual(['4,2', '4,3', '1,4', '2,4', '3,4']);
    });
    test('a Mirror in a closed Freezer makes no hops', () => {
        setup({ magic_mirrors: [[5, 4, 4, 0, -1, 0, 0, -1, 0, 30]] });
        PROG.freezers = [freezerAt(30, [4, 4, 0])];
        const thawed = walker(NONE, [], [false]);
        const frozen = walker(NONE, [], [true]);
        expect(cells(thawed, fill(thawed, 1, 4, 0))).toContain('4,2');
        expect(cells(frozen, fill(frozen, 1, 4, 0))).toEqual(['1,4', '2,4', '3,4']);
    });
});

describe('magic-mirror hops between two facing Mirrors', () => {
    // a 12 x 8 grid, all wall at z 0 but a corridor (3..7, 4) between two magic Mirrors at (2, 4) and (8, 4) that face
    // each other, and the north arm of each Mirror ((2, 1..3) and (8, 1..3))
    const FIRST = [5, 2, 4, 0, 1, 0, 0, -1, 0, 0];
    const SECOND = [6, 8, 4, 0, -1, 0, 0, -1, 0, 0];
    const setup = ({ closed = [], extra = {} }: { closed?: string[]; extra?: Rows } = {}) => {
        const open = ['3,4', '4,4', '5,4', '6,4', '7,4', '2,1', '2,2', '2,3', '8,1', '8,2', '8,3'];
        const walls: Columns = {};
        for (let column = 0; column < 96; column++) {
            const point = `${column % 12},${Math.floor(column / 12)}`;
            if (!open.includes(point) || closed.includes(point)) walls[column] = [0];
        }
        world({ width: 12, height: 8, walls, extra: { magic_mirrors: [FIRST, SECOND], ...extra } });
        return walker(NONE, [], []);
    };
    const CORRIDOR = ['3,4', '4,4', '5,4', '6,4', '7,4'];
    test('a hero where both Mirrors reflect him lands on both islands', () => {
        const walkGrid = setup();
        expect(cells(walkGrid, fill(walkGrid, 3, 4, 0))).toEqual([
            '2,1',
            '8,1',
            '2,2',
            '8,2',
            '2,3',
            '8,3',
            ...CORRIDOR,
        ]);
    });
    test('a hero nearer to one Mirror than both arms allow hops nowhere', () => {
        // the wall at (8, 3) ends the second arm at two cells, so no cell is within reach of both arms
        const walkGrid = setup({ closed: ['8,3'] });
        expect(cells(walkGrid, fill(walkGrid, 3, 4, 0))).toEqual(CORRIDOR);
    });
    test('a target between the Mirrors ends the pair', () => {
        // a Monster at (7, 4), which the Mirror behind it keeps from being pushed
        const walkGrid = setup({ extra: { monsters: [[7, 7, 4, 0, -2]] } });
        expect(cells(walkGrid, fill(walkGrid, 3, 4, 0))).toEqual(['3,4', '4,4', '5,4', '6,4']);
    });
    test('a third magic Mirror in the room ends the pair', () => {
        const walkGrid = setup({ extra: { magic_mirrors: [FIRST, SECOND, [7, 10, 7, 0, 0, 0, 0, 0, 1, 0]] } });
        expect(cells(walkGrid, fill(walkGrid, 3, 4, 0))).toEqual(CORRIDOR);
    });
    test('a third flat magic Mirror with no target does not end the pair', () => {
        const walkGrid = setup({
            extra: { magic_mirrors: [FIRST, SECOND, [7, 10, 7, 0, -1, 0, 0, -1, 0, 0]] },
        });
        expect(cells(walkGrid, fill(walkGrid, 3, 4, 0))).toHaveLength(11);
    });
    test('a landing in a wall stops both hops', () => {
        const walkGrid = setup({ closed: ['2,1'] });
        expect(cells(walkGrid, fill(walkGrid, 3, 4, 0))).toEqual(CORRIDOR);
    });
    test('a hero on the north arm of one Mirror hops onto the corridor on his own', () => {
        // no target or ray of the other Mirror touches the arm, so the Mirror reflects him alone
        const walkGrid = setup();
        expect(cells(walkGrid, fill(walkGrid, 8, 1, 0))).toHaveLength(11);
    });
});

describe('magic-mirror hops off a Switch', () => {
    // the 8 x 8 grid of the hops above: a magic Mirror at (4, 4) with its west arm (1..3, 4) and its south arm
    // (4, 1..3); `north` opens the cells (1..3, 5) beside the west arm too. Flavor 7 has its Switch at `switchAt`
    // and the Gates `gates`
    const MIRROR = [[5, 4, 4, 0, -1, 0, 0, -1, 0, 0]];
    const setup = ({
        switchAt = [2, 4],
        gates,
        north = false,
        lane = false,
        switches = [],
        rocks = [],
    }: {
        switchAt?: number[];
        gates: number[][];
        north?: boolean;
        lane?: boolean;
        switches?: number[][];
        rocks?: number[][];
    }) => {
        const open = ['1,4', '2,4', '3,4', '4,1', '4,2', '4,3'];
        if (north) open.push('1,5', '2,5', '3,5');
        if (lane) open.push('1,5', '2,5', '1,6', '2,6');
        const walls: Columns = {};
        for (let column = 0; column < 64; column++)
            if (!open.includes(`${column % 8},${Math.floor(column / 8)}`)) walls[column] = [0];
        const switchRow = [60, 7, 0, ...switchAt, 0];
        world({
            width: 8,
            height: 8,
            walls,
            extra: { magic_mirrors: MIRROR, switches: [switchRow, ...switches], gates, rocks },
        });
        return walker(NONE, [], []);
    };
    // a plain Gate at (4, 3) and an open notted Gate at (4, 1), both on the south arm
    const southGates = [
        [61, 4, 3, 0, 0, 0, 7, 0, 5],
        [62, 4, 1, 0, 1, 1, 7, 0, 5],
    ];
    test('the hero on the Switch hops past the Gate he holds open and lands with the Switch released', () => {
        // pressed, the Gate at (4, 3) is open and the notted one at (4, 1) shut, so the hop from (2, 4) lands on
        // (4, 2); released, the notted Gate opens again and the hero walks on to (4, 1)
        const walkGrid = setup({ gates: southGates });
        expect(cells(walkGrid, fill(walkGrid, 2, 4, 0))).toEqual(['4,1', '4,2', '1,4', '2,4', '3,4']);
    });
    test('the hop lands in the released world even where an object can press the flavor later', () => {
        // `lane` opens (1..2, 5..6), and a Rock at (2, 5) is pushed south from (2, 6) onto the Switch, which shuts the
        // notted Gate at (4, 1) for the rest of the flood; the hop comes first, so the hero still walks to (4, 1)
        const walkGrid = setup({ gates: southGates, lane: true, rocks: [[64, 2, 5, 0]] });
        const reached = cells(walkGrid, fill(walkGrid, 2, 4, 0));
        expect(reached).toEqual(expect.arrayContaining(['4,1', '4,2', '4,3']));
    });
    test('a Gate he holds open on his own arm lets the ray reach him, and shuts again once he leaves', () => {
        // the Switch at (1, 4) and a plain Gate at (2, 4): he lands on (4, 1), walks to (4, 3) and hops back onto
        // (3, 4), but the Gate at (2, 4) is shut again
        const walkGrid = setup({ switchAt: [1, 4], gates: [[61, 2, 4, 0, 0, 0, 7, 0, 5]] });
        expect(cells(walkGrid, fill(walkGrid, 1, 4, 0))).toEqual(['4,1', '4,2', '4,3', '1,4', '3,4']);
    });
    // a second Switch of flavor 7 at (3, 5)
    const second = [[63, 7, 0, 3, 5, 0]];
    test('another Switch of the flavor with no object on it keeps the Gates as they are', () => {
        const walkGrid = setup({ gates: southGates, north: true, switches: second });
        expect(cells(walkGrid, fill(walkGrid, 2, 4, 0))).toEqual(['1,4', '2,4', '3,4', '1,5', '2,5', '3,5']);
    });
    test('an object on every other Switch of the flavor lets the hero hold his alone', () => {
        // a Rock at (2, 5) the hero pushes east from (1, 5) onto the second Switch
        const walkGrid = setup({ gates: southGates, north: true, switches: second, rocks: [[64, 2, 5, 0]] });
        expect(cells(walkGrid, fill(walkGrid, 2, 4, 0))).toEqual([
            '4,1',
            '4,2',
            '1,4',
            '2,4',
            '3,4',
            '1,5',
            '2,5',
            '3,5',
        ]);
    });
});

describe('skip lane and TELEPORT swap', () => {
    // a row at z 0 on the implicit ground floor: the hero's side 10..2 (wrapping), a SKIPPABLE Rock at 2, water at 3..5
    // and 8..9 (surface 0), the island 6..7; a TELEPORT Wardrobe at 11 with its door on the west edge
    const setup = (teleport = [40]) => {
        const water: Columns = {};
        for (const i of [3, 4, 5, 8, 9]) water[i] = [0];
        world({
            width: 12,
            water,
            extra: {
                oceans: [[1, 0, 0, 0, 0, 12, 1]],
                rocks: [[9, 2, 0, 0]],
                skippable: [9],
                wardrobes: [[40, 11, 0, 0, 2, 2]],
                teleport,
            },
        });
        return walker(NONE, [], []);
    };
    test('push, launch, then TELEPORT: the hero swaps onto the landing cell', () => {
        const walkGrid = setup();
        expect(
            walkGrid.lanes.map((lane) => [lane.pushCell, lane.landing].map((cell) => cell % walkGrid.width)),
        ).toEqual([[1, 6]]);
        expect(columns(walkGrid, fill(walkGrid, 0, 0, 0))).toEqual([0, 1, 2, 6, 7, 10, 11]);
    });
    test('without a TELEPORT Wardrobe there is no swap', () => {
        const walkGrid = setup([]);
        expect(columns(walkGrid, fill(walkGrid, 0, 0, 0))).toEqual([0, 1, 2, 10, 11]);
    });
    test('a pocket flood walks the lane backwards to the push side', () => {
        const walkGrid = setup();
        expect(columns(walkGrid, fill(walkGrid, 7, 0, 0))).toEqual([6, 7]);
        expect(columns(walkGrid, fill(walkGrid, 7, 0, 0, { pocket: true }))).toEqual([0, 1, 2, 6, 7, 10, 11]);
    });
});

describe('the Lilies a skipping stone kicks', () => {
    // A 6 x 3 grid at z 0. Row 1: the hero at 0, the stone at 1 with walls above and below (so it is pushed east only),
    // water at 2 and 3, then what `ahead` says at 4 and a wall at 5. Row 0 is wall. In row 2 a Lily floats at (3, 2),
    // beside (3, 1) and not beside (2, 1), with (3, 0) wall behind it, so a kick sends it nowhere but its own cell.
    const setup = ({ ahead, landing = false }: { ahead: string; landing?: boolean }) => {
        const walls: Columns = {
            0: [0],
            1: [0],
            2: [0],
            3: [0],
            4: [0],
            5: [0],
            11: [0],
            12: [0],
            13: [0],
            14: [0],
            16: [0],
            17: [0],
        };
        const water: Columns = { 8: [0], 15: [0] };
        const rocks = [[9, 1, 1, 0]];

        if (!landing) water[9] = [0];
        if (ahead === 'wall') walls[10] = [0];
        if (ahead === 'rock') rocks.push([10, 4, 1, 0]);

        world({
            width: 6,
            height: 3,
            walls,
            water,
            extra: {
                oceans: [[1, 0, 0, 0, 0, 6, 3]],
                rocks,
                skippable: [9],
                lilies: [[50, 3, 2, 0]],
            },
        });

        const walkGrid = walker(NONE, [], []);
        return walkGrid.kicks.map((kick) =>
            kick.cells.map(
                (cell) => (cell % walkGrid.width) + ',' + Math.floor((cell % walkGrid.layerCells) / walkGrid.width),
            ),
        );
    };
    test('the hop where the stone sinks in place against a wall kicks the Lily beside it', () => {
        expect(setup({ ahead: 'wall' })).toEqual([['3,2']]);
    });
    test('the hop where the stone sinks in place against a Rock kicks too', () => {
        expect(setup({ ahead: 'rock' })).toEqual([['3,2']]);
    });
    test('a stone supported where it is kicks nothing', () => {
        expect(setup({ ahead: 'wall', landing: true })).toEqual([]);
    });
});

describe('the ride of a Lily kicked off its start', () => {
    // a row of 8 at z 0 with a wall at 0 and water at 1..7; the Lily belongs at 1 and the save left it at 5, on a river
    // that flows east over 4..7. `heading` is the side of its first recorded move.
    const heldColumns = ({ heading, restingAt = 5 }: { heading?: number; restingAt?: number }) => {
        const water: Columns = {};
        for (let i = 1; i < 8; i++) water[i] = [0];
        world({
            width: 8,
            walls: { 0: [0] },
            water,
            extra: {
                oceans: [[1, 0, 0, 0, 0, 8, 1]],
                lilies: [[50, 1, 0, 0]],
                rivers: [4, 5, 6, 7].map((i) => [i, 0, 0, 1]),
            },
        });
        const firstHeadings = new Map<number, number>();
        if (heading !== undefined) firstHeadings.set(50, heading);
        const latest: LatestValues = {
            ...NONE,
            get: (pid: number, field: string) =>
                pid === 50 && field === 'base.position.x' ? f32(restingAt) : undefined,
            firstHeadings,
        };
        const walkGrid = walker(latest, [], []);
        const held: number[] = [];
        for (let column = 0; column < 8; column++) {
            const cell = walkGrid.cellOf(column, 0, 0);
            if (walkGrid.land(cell, false) === cell) held.push(column);
        }
        return held;
    };
    test('the cells it crossed on the way hold the hero when its first move went toward the river', () => {
        expect(heldColumns({ heading: 0 })).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });
    test('the first move away from the river, or none recorded, leaves the Lily at its drift alone', () => {
        expect(heldColumns({ heading: 2 })).toEqual([5, 6, 7]);
        expect(heldColumns({})).toEqual([5, 6, 7]);
    });
    test('a Lily that rests off the river stays where it is', () => {
        expect(heldColumns({ heading: 0, restingAt: 3 })).toEqual([3]);
    });
});

describe('ALTER beams', () => {
    test('ENDPOINT in ALTER jumps to the midpoint of the way to the end', () => {
        const beam: EndpointBeam = {
            cells: [10, 11, 12, 13, 14, 15, 16, 17, 18],
            side: 0,
            index: 2,
            atInfinity: false,
        };
        expect(endpointTarget(beam, true, false)).toBe(18);
        expect(endpointTarget(beam, false, false)).toBe(10);
        expect(endpointTarget(beam, true, true)).toBe(15);
        expect(endpointTarget(beam, false, true)).toBe(11);
    });
    // The walker's grid wraps in x and y and its ENDPOINT jumps follow horizontal beams only, so no walk reaches a beam
    // at infinity: the rule is tested on endpointTarget itself.
    test('ENDPOINT along a beam at infinity gives no landing, with or without ALTER', () => {
        const beam: EndpointBeam = { cells: [10, 11, 12, 13, 14, 15, 16, 17, 18], side: 0, index: 2, atInfinity: true };
        expect(endpointTarget(beam, true, false)).toBe(-1);
        expect(endpointTarget(beam, true, true)).toBe(-1);
        expect(endpointTarget(beam, false, false)).toBe(10);
        expect(endpointTarget(beam, false, true)).toBe(11);
    });
    // a row of 11 at z 0: DOUBLE (and ALTER) lights at 0 facing east; column 10 a wall and a beam stop
    const setup = (lights: number[][]) => {
        world({ width: 11, walls: { 10: [0] }, extra: { lights, beam_stops: [[10, 0, 0]], gem_slots: POWERED_ROOM } });
        return walker(NONE, [], []);
    };
    test('DOUBLE doubles each move, and triples it with ALTER', () => {
        const doubled = setup([[1, 0, 0, 0, 0, 0, 0, 0, DOUBLE]]);
        expect(columns(doubled, fill(doubled, 1, 0, 0))).toEqual([0, 1, 3, 5, 7, 9]);
        const tripled = setup([
            [1, 0, 0, 0, 0, 0, 0, 0, DOUBLE],
            [2, 0, 0, 0, 0, 0, 0, 0, ALTER],
        ]);
        expect(columns(tripled, fill(tripled, 1, 0, 0))).toEqual([0, 1, 3, 4, 6, 7, 9]);
    });
});

describe('OPEN beams and Gates', () => {
    // a row of 8 at z 0: a shut Gate at 3, column 7 a wall; lights at 0 facing east
    const setup = (lights: number[][], on = true) => {
        const gem_slots = on ? POWERED_ROOM : [];
        world({ width: 8, walls: { 7: [0] }, extra: { lights, gates: [[20, 3, 0, 0, 0, 0, 0, 0]], gem_slots } });
        return walker(NONE, [], []);
    };
    test('a hero in a powered OPEN beam opens the shut Gate ahead', () => {
        const walkGrid = setup([[1, 0, 0, 0, 0, 0, 0, 0, OPEN]]);
        expect(columns(walkGrid, fill(walkGrid, 1, 0, 0))).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
    test('an unpowered OPEN light opens nothing', () => {
        const walkGrid = setup([[1, 0, 0, 0, 0, 0, 0, 0, OPEN]], false);
        expect(columns(walkGrid, fill(walkGrid, 1, 0, 0))).toEqual([0, 1, 2]);
    });
    test('an ALTER beam on the same cells keeps the Gate shut', () => {
        const walkGrid = setup([
            [1, 0, 0, 0, 0, 0, 0, 0, OPEN],
            [2, 0, 0, 0, 0, 0, 0, 0, ALTER],
        ]);
        expect(columns(walkGrid, fill(walkGrid, 1, 0, 0))).toEqual([0, 1, 2]);
    });
    test('a shut Gate no beam reaches stays shut', () => {
        const walkGrid = setup([]);
        expect(columns(walkGrid, fill(walkGrid, 1, 0, 0))).toEqual([0, 1, 2]);
    });
});

describe('levels whose requirements need a level', () => {
    // 0 the level asked about; 1 needs 0; 2 needs 1 (AND); 3 is OR of 0 and 4, 4 needs 1; 5 is OR of 0 and 6 (6 solved);
    // 7 needs 0 but is enabled from the start
    const levels: ProgressLevel[] = [
        progressLevel({ req: [] }),
        progressLevel({ req: [0] }),
        progressLevel({ req: [1] }),
        progressLevel({ req: [0, 4], or: 1 }),
        progressLevel({ req: [1] }),
        progressLevel({ req: [0, 6], or: 1 }),
        progressLevel({ req: [] }),
        progressLevel({ req: [0], en: 1 }),
    ];
    const unlocks = levels.map((): { levels: number[] } => ({ levels: [] }));
    levels.forEach((level, i) => level.req.forEach((j) => unlocks[j].levels.push(i)));
    const solved = (i: number) => i === 6;
    test('AND levels through any requirement, OR levels through every option', () => {
        expect([...levelsNeedingLevel(levels, unlocks, solved, 0)].toSorted()).toEqual([1, 2, 3, 4]);
    });
});

describe('areas named by activated pins', () => {
    const area: Area = {
        local_area_name: '',
        display: '',
        image: '',
        p: [0, 0, 0],
        pin: 0,
        boxes: [],
        layer: '',
        order: 0,
    };
    test('the lowest float_parameter among the activated pins, else the level-data area', () => {
        PROG.areas = [100, 200, 300].map((pin): Area => ({ ...area, pin }));
        const level = progressLevel({
            area: 0,
            overlap: [
                [0, 2],
                [1, 200],
                [2, 200],
            ],
        });
        expect(levelAreaOf(level, new Set([100, 200, 300]))).toBe(0);
        expect(levelAreaOf(level, new Set([200, 300]))).toBe(1);
        expect(levelAreaOf(level, new Set([300]))).toBe(2);
        expect(levelAreaOf(level, new Set())).toBe(0);
        expect(levelAreaOf(progressLevel({ area: 2 }), new Set())).toBe(2);
    });
});

describe('the level geometry', () => {
    test('is built once for the same data and again for new data', () => {
        world({ width: 8 });
        const geometry = levelGeometry();
        expect(levelGeometry()).toBe(geometry);
        world({ width: 8 });
        expect(levelGeometry()).not.toBe(geometry);
    });
    test("walkers share it and a save's ocean change leaves it alone", () => {
        // column 4 holds ocean 0 (surface 1); the save floods ocean 1 (surface 2) over it
        world({
            width: 8,
            water: { 3: [0], 4: [0] },
            extra: {
                oceans: [
                    [30, 1, 0, 3, 0, 2, 1],
                    [31, 2, 0, 4, 0, 1, 1],
                ],
            },
        });
        const geometry = levelGeometry();
        const floodedSquare: OceanChange = { type: 3, pid: 31, index: 0, old: 0, new: 1, key: 0, start: false };
        const flooded = walker({ ...NONE, ocean: [floodedSquare] }, [], [], geometry);
        const dry = walker(NONE, [], [], geometry);
        expect(flooded.deep(flooded.cellOf(4, 0, 1))).toBe(true);
        expect(dry.deep(dry.cellOf(4, 0, 1))).toBe(false);
        expect(geometry.waterColumns[4]).toEqual([0]);
        expect(geometry.solidGrid.some((bits) => bits !== 0)).toBe(false);
    });
    test("a walker's grid is its own copy of the static voxels", () => {
        const walls: Columns = {};
        for (let column = 0; column < 8; column++) walls[column] = [0];
        world({ width: 8, walls, extra: { rocks: [[50, 3, 0, 1]] } });
        const geometry = levelGeometry();
        const first = walker(NONE, [], [], geometry);
        const second = walker(NONE, [], [], geometry);
        const reached = (walkGrid: Walker) => [...walkGrid.flood([walkGrid.cellOf(0, 0, 1)])];
        expect(reached(first).length).toBeGreaterThan(1);
        expect(reached(second)).toEqual(reached(first));
        expect(geometry.solidGrid.filter((bits) => bits !== 0).length).toBe(8);
    });
});

describe('mirror marks', () => {
    test('a destroyed Mirror leaves no mark', () => {
        world({ width: 8, extra: { mechs: [[2, 50, 4, 0, 0]] } });
        const near = (latest: LatestValues) => {
            const walkGrid = walker(latest, [], []);
            return walkGrid.mechAt(new Set([walkGrid.cellOf(4, 0, 0)]));
        };
        expect(near(NONE)).toBe(4);
        expect(near({ ...NONE, created: new Map([[50, { type: 'Mirror', destroyed: true }]]) })).toBe(0);
    });
});

describe('a Gem pushed onto its slot with turns', () => {
    const [LIGHT, SLOT, GEM] = [7, 8, 11];
    const [LIGHT_KIND, GEM_KIND, THROUGH] = [1, 0, 1];
    const [WIDTH, HEIGHT] = [12, 6];

    // A 12 x 6 room at z 0: walls round the edge and in columns 8 and 9, and the east end (10, 11) is closed but for
    // row 2. A powered-by-Gem THROUGH light at (1, 2) faces east along row 2; its room's slot is (5, 1). The Gem at
    // (3, 3) is on no straight line to the slot. `walls`: more wall cells as [i, j].
    const setup = (walls: Array<[i: number, j: number]> = []) => {
        const wallCells = new Set(walls.map(([i, j]) => i + j * WIDTH));
        for (let i = 0; i < WIDTH; i++) {
            wallCells.add(i);
            wallCells.add(i + (HEIGHT - 1) * WIDTH);
        }
        for (let j = 1; j < HEIGHT - 1; j++) {
            for (const i of [0, 8, 9]) wallCells.add(i + j * WIDTH);
            if (j !== 2) for (const i of [10, 11]) wallCells.add(i + j * WIDTH);
        }
        const wallColumns: Columns = {};
        for (const column of wallCells) wallColumns[column] = [0];
        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            extra: {
                lights: [[LIGHT, 1, 2, 0, 0, 0, 0, 0, THROUGH]],
                gem_slots: [[SLOT, 5, 1, 0, 0]],
                movables: [
                    [LIGHT, 1, 2, 0, LIGHT_KIND],
                    [GEM, 3, 3, 0, GEM_KIND],
                ],
            },
        });

        return walker(NONE, [], []);
    };
    const reachesEast = (walkGrid: Walker) => walkGrid.flood([walkGrid.cellOf(2, 2, 0)]).has(walkGrid.cellOf(10, 2, 0));

    test('powers the room when the push turns once', () => {
        expect(reachesEast(setup())).toBe(true);
    });
    test('stays put when the Gem cannot be pushed', () => {
        const walls: Array<[i: number, j: number]> = [
            [3, 2],
            [2, 3],
        ];
        expect(reachesEast(setup(walls))).toBe(false);
    });
});

describe('a Rock pushed into water with turns', () => {
    const [WIDTH, HEIGHT, ROCK] = [7, 4, 9];

    // A 7 x 4 slab with ground at z 0 that wraps in x and y. Columns 0 and 5 are wall but for the water cell (5, 1)
    // (surface z 1), so the east half (x 6) is reached only over a bridge there. The Rock at (2, 2) is pushed east,
    // north, then east into the water. `walls`: more wall cells as [i, j].
    const setup = (walls: Array<[i: number, j: number]> = []) => {
        const wallColumns: Columns = {};
        for (let column = 0; column < WIDTH * HEIGHT; column++) wallColumns[column] = [0];
        for (let j = 0; j < HEIGHT; j++) {
            wallColumns[j * WIDTH] = [0, 1, 2];
            wallColumns[5 + j * WIDTH] = [0, 1, 2];
        }
        delete wallColumns[5 + 1 * WIDTH];
        for (const [i, j] of walls) wallColumns[i + j * WIDTH] = [0, 1, 2];
        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            water: { [5 + 1 * WIDTH]: [0] },
            extra: {
                oceans: [[1, 1, 0, 5, 1, 1, 1]],
                rocks: [[ROCK, 2, 2, 1]],
            },
        });

        return walker(NONE, [], []);
    };
    const crosses = (walkGrid: Walker) => walkGrid.flood([walkGrid.cellOf(1, 2, 1)]).has(walkGrid.cellOf(6, 1, 1));

    test('makes the bridge when the pushes turn twice', () => {
        expect(crosses(setup())).toBe(true);
    });
    test('makes none when the last cell before the water is wall', () => {
        expect(crosses(setup([[4, 1]]))).toBe(false);
    });
});

describe('a Gem pushed into water', () => {
    const [LIGHT, SLOT, FIRST, SECOND] = [7, 8, 11, 12];
    const [LIGHT_KIND, GEM_KIND] = [1, 0];
    const [WIDTH, HEIGHT] = [7, 4];

    // The slab of 'a Rock pushed into water with turns', with Gems for the Rock. The Gem at (2, 2) is pushed east, north,
    // then east into the water cell (5, 1); with `straight` the Gem at (3, 1) has a straight way into it. `room`: a
    // light at (1, 3) that a slot at (4, 3) powers, and `second`: a second Gem at
    // (2, 3) in that room.
    const setup = ({
        straight = false,
        room = false,
        second = false,
    }: {
        straight?: boolean;
        room?: boolean;
        second?: boolean;
    }) => {
        const wallColumns: Columns = {};
        for (let column = 0; column < WIDTH * HEIGHT; column++) wallColumns[column] = [0];
        for (let j = 0; j < HEIGHT; j++) {
            wallColumns[j * WIDTH] = [0, 1, 2];
            wallColumns[5 + j * WIDTH] = [0, 1, 2];
        }
        delete wallColumns[5 + 1 * WIDTH];

        const movables = [[FIRST, straight ? 3 : 2, straight ? 1 : 2, 1, GEM_KIND]];
        const extra: Rows = { oceans: [[1, 1, 0, 5, 1, 1, 1]], movables };
        if (straight) extra.bridges = [[FIRST, 2, 1, 1, 5, 1, 1]];
        if (second) movables.push([SECOND, 2, 3, 1, GEM_KIND]);
        if (room) {
            movables.push([LIGHT, 1, 3, 1, LIGHT_KIND]);
            extra.lights = [[LIGHT, 1, 3, 1, 0, 0, 0, 0, OPEN]];
            extra.gem_slots = [[SLOT, 4, 3, 1, 0]];
        }

        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            water: { [5 + 1 * WIDTH]: [0] },
            extra,
        });

        return walker(NONE, [], []);
    };
    const crosses = (walkGrid: Walker) => walkGrid.flood([walkGrid.cellOf(1, 2, 1)]).has(walkGrid.cellOf(6, 1, 1));

    test('sinks into a bridge when the pushes turn', () => {
        expect(crosses(setup({}))).toBe(true);
    });
    test('sinks into a bridge by a straight push', () => {
        expect(crosses(setup({ straight: true }))).toBe(true);
    });
    test('stays on the slot the room needs it for', () => {
        expect(crosses(setup({ room: true }))).toBe(false);
        expect(crosses(setup({ straight: true, room: true }))).toBe(false);
    });
    test('sinks when the room has more Gems than open slots', () => {
        expect(crosses(setup({ room: true, second: true }))).toBe(true);
        expect(crosses(setup({ straight: true, room: true, second: true }))).toBe(true);
    });
});

describe('a magic Mirror pushed into water', () => {
    const [MIRROR, MIRROR_KIND] = [9, 2];
    const [WIDTH, HEIGHT] = [7, 4];

    // The slab of 'a Gem pushed into water' with a flat magic Mirror at (2, 2) for the Gem. Pushed east, north, then east it
    // sinks in the water cell (5, 1), which then holds nobody.
    const setup = () => {
        const wallColumns: Columns = {};
        for (let column = 0; column < WIDTH * HEIGHT; column++) wallColumns[column] = [0];
        for (let j = 0; j < HEIGHT; j++) {
            wallColumns[j * WIDTH] = [0, 1, 2];
            wallColumns[5 + j * WIDTH] = [0, 1, 2];
        }
        delete wallColumns[5 + 1 * WIDTH];

        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            water: { [5 + 1 * WIDTH]: [0] },
            extra: {
                oceans: [[1, 1, 0, 5, 1, 1, 1]],
                movables: [[MIRROR, 2, 2, 1, MIRROR_KIND]],
                magic_mirrors: [[MIRROR, 2, 2, 1, -1, 0, 0, -1, 0, 0]],
            },
        });

        return walker(NONE, [], []);
    };

    test('is no bridge and holds no hero', () => {
        const walkGrid = setup();
        const reached = walkGrid.flood([walkGrid.cellOf(1, 2, 1)]);
        expect(reached.has(walkGrid.cellOf(5, 1, 1))).toBe(false);
        expect(reached.has(walkGrid.cellOf(6, 1, 1))).toBe(false);
    });
});

describe('a magic Mirror pushed with turns', () => {
    const [WIDTH, HEIGHT, MIRROR] = [10, 9, 5];

    // A 10 x 9 grid at z 0 on the implicit ground floor. The open cells are row 4 (x 1..8), the loop x 1 and x 6 up to
    // row 8 and row 8 (x 1..6), the cell (7, 5) and the column x 4 below row 4: water at (4, 3), then ground at
    // (4, 2) and (4, 1), which a walk reaches over the water only by a hop. The magic Mirror at (6, 6) has its arms
    // west and south. Pushed south to (6, 4) and west to (4, 4), it hops a hero from (2, 4) to (4, 2). `walls`: more
    // wall cells as [i, j].
    const setup = (walls: Array<[i: number, j: number]> = []) => {
        const open = new Set(['4,3', '4,2', '4,1', '7,5']);
        for (let i = 1; i <= 8; i++) open.add(`${i},4`);
        for (let j = 4; j <= 8; j++) open.add(`1,${j}`).add(`6,${j}`);
        for (let i = 1; i <= 6; i++) open.add(`${i},8`);
        for (const [i, j] of walls) open.delete(`${i},${j}`);

        const wallColumns: Columns = {};
        for (let column = 0; column < WIDTH * HEIGHT; column++) {
            if (!open.has(`${column % WIDTH},${Math.floor(column / WIDTH)}`)) wallColumns[column] = [0];
        }

        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            water: { [4 + 3 * WIDTH]: [0] },
            extra: {
                oceans: [[1, 0, 0, 4, 3, 1, 1]],
                movables: [[MIRROR, 6, 6, 0, 2]],
                magic_mirrors: [[MIRROR, 6, 6, 0, -1, 0, 0, -1, 0, 0]],
            },
        });

        return walker(NONE, [], []);
    };
    const hops = (walkGrid: Walker) => walkGrid.flood([walkGrid.cellOf(6, 8, 0)]).has(walkGrid.cellOf(4, 2, 0));

    test('hops from the arm once the pushes turn onto the junction', () => {
        expect(hops(setup())).toBe(true);
    });
    test('hops nowhere when the push cell behind the last push is wall', () => {
        expect(hops(setup([[7, 4]]))).toBe(false);
    });
});

describe('a magic Mirror on a Rover that sank', () => {
    const [WIDTH, HEIGHT, MIRROR, ROVER, ROCK] = [12, 7, 5, 6, 7];

    // A 12 x 7 grid with ground at z 0 (the hero stands at z 1) and wall elsewhere. Water (surface 1) fills x 3..8 of
    // rows 2 and 3. A Rover rests under the water at (6, 3), running east-west, so its track is (3..8, 3), and carries
    // a magic Mirror above it whose arms face east and south. The hero walks the ground west of the water (1..2, 3),
    // up column 1 and along row 5. The Mirror's south arm runs over the water (6, 2) to the island (6, 1, and 0), which
    // only a hop reaches. `shore`: ground at (9, 3..5) east of the water, where the hero hops from (9, 3). `rock`: a
    // Rock at (8, 4) for the hero to push south from (8, 5) onto (8, 3), the end of the track, where he hops from.
    // `walls`: cells to close.
    const setup = ({
        shore = false,
        rock = false,
        walls = [],
    }: { shore?: boolean; rock?: boolean; walls?: string[] } = {}) => {
        const open = new Set(['1,3', '2,3', '6,1', '6,0']);
        for (let j = 3; j <= 5; j++) open.add(`1,${j}`);
        for (let i = 1; i <= 8; i++) open.add(`${i},5`);
        if (shore) for (let j = 3; j <= 5; j++) open.add(`9,${j}`);
        if (rock) open.add('8,4');
        for (const point of walls) open.delete(point);

        const wallColumns: Columns = {};
        const waterColumns: Columns = {};
        for (let column = 0; column < WIDTH * HEIGHT; column++) {
            const i = column % WIDTH;
            const j = Math.floor(column / WIDTH);
            if (i >= 3 && i <= 8 && (j === 2 || j === 3)) {
                waterColumns[column] = [0];
            } else if (open.has(`${i},${j}`)) {
                wallColumns[column] = [0];
            } else {
                wallColumns[column] = [0, 1, 2];
            }
        }

        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            water: waterColumns,
            extra: {
                oceans: [[1, 1, 0, 3, 2, 6, 2]],
                movables: [
                    [ROVER, 6, 3, 0, 3],
                    [MIRROR, 6, 3, 1, 2],
                ],
                rover_facings: [[ROVER, 0]],
                magic_mirrors: [[MIRROR, 6, 3, 1, 1, 0, 0, -1, 0, 0]],
                rocks: rock ? [[ROCK, 8, 4, 1]] : [],
            },
        });

        return walker(NONE, [], []);
    };
    const reachesIsland = (walkGrid: Walker) =>
        walkGrid.flood([walkGrid.cellOf(1, 3, 1)]).has(walkGrid.cellOf(6, 1, 1));

    test('hops the hero from a cell past the track to the island', () => {
        expect(reachesIsland(setup({ shore: true }))).toBe(true);
    });
    test('takes no hop off a cell of the track, where the hero would ride the Rover', () => {
        expect(reachesIsland(setup())).toBe(false);
    });
    test('takes the hop off the end of the track once a Rock can sink there', () => {
        expect(reachesIsland(setup({ rock: true }))).toBe(true);
    });
    test('takes none when the Rock cannot be pushed onto the track', () => {
        expect(reachesIsland(setup({ rock: true, walls: ['8,5'] }))).toBe(false);
    });
});

describe('a skipping stone launched by a hero with CHARM', () => {
    const [WIDTH, HEIGHT, STONE] = [12, 5, 9];

    // A 12 x 5 grid at z 0 on the implicit ground floor. The Wardrobe (11, 2) has its door on the west edge and gives
    // CHARM; the land row 2 runs west to (8, 2). Row 1 is water (surface 0) from x 3 to 7 but for the islet (4, 1),
    // which holds the Switch of flavor 7, and the islet (8, 1) holds the MIRRORABLE skipping stone. The islets have
    // walls to the north and south or water beside them, and (9, 1) is wall, so nothing pushes the stone. The Gate
    // (10, 3) leads to (10, 4). A hero at (9, 2) steps west, and the stone, two cells off, steps west into the water,
    // skips over x 7..5 and stops on the Switch. `walls`: more wall cells as [i, j]. `freezer`: the stone's Freezer, closed
    // when true, open when false, none when null.
    const setup = ({
        walls = [],
        charm = [40],
        freezer = null,
    }: { walls?: Array<[i: number, j: number]>; charm?: number[]; freezer?: boolean | null } = {}) => {
        const open = new Set(['4,1', '8,1', '3,1', '5,1', '6,1', '7,1', '10,3', '10,4']);
        for (let i = 8; i <= 11; i++) open.add(`${i},2`);
        for (const [i, j] of walls) open.delete(`${i},${j}`);

        const wallColumns: Columns = {};
        const water: Columns = {};
        for (let column = 0; column < WIDTH * HEIGHT; column++) {
            if (!open.has(`${column % WIDTH},${Math.floor(column / WIDTH)}`)) wallColumns[column] = [0];
        }
        for (const i of [3, 5, 6, 7]) water[i + WIDTH] = [0];

        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            water,
            extra: {
                oceans: [[1, 0, 0, 0, 1, WIDTH, 1]],
                rocks: [[STONE, 8, 1, 0]],
                skippable: [STONE],
                mirrorable: [STONE],
                wardrobes: [[40, 11, 2, 0, 2, 2]],
                charm,
                switches: [[60, 7, 0, 4, 1, 0]],
                gates: [[61, 10, 3, 0, 0, 0, 7, 0, 5]],
            },
        });
        if (freezer !== null) PROG.freezers = [freezerAt(30, [8, 1, 0])];

        return walker(NONE, [], freezer === null ? [] : [freezer]);
    };
    const opens = (walkGrid: Walker, options?: FloodOptions) =>
        walkGrid.flood([walkGrid.cellOf(11, 2, 0)], null, null, options);
    const reachesPocket = (walkGrid: Walker) => opens(walkGrid).has(walkGrid.cellOf(10, 4, 0));

    test('presses the Switch the stone lands on, which opens the Gate', () => {
        expect(reachesPocket(setup())).toBe(true);
    });
    test('presses nothing without a CHARM Wardrobe', () => {
        expect(reachesPocket(setup({ charm: [] }))).toBe(false);
    });
    test('presses nothing when no cell by the stone has an open step west', () => {
        expect(
            reachesPocket(
                setup({
                    walls: [
                        [8, 2],
                        [9, 2],
                    ],
                }),
            ),
        ).toBe(false);
    });
    test('a stone in a closed Freezer notes the Freezer and presses once it is open', () => {
        const stoneFront = new Set<number>();
        const closed = setup({ freezer: true });
        expect(opens(closed, { stoneFront }).has(closed.cellOf(10, 4, 0))).toBe(false);
        expect([...stoneFront]).toEqual([0]);
        expect(reachesPocket(setup({ freezer: false }))).toBe(true);
    });
});

describe('a monster Gate and the Monsters pushed to their death', () => {
    const [WIDTH, HEIGHT, GOAL] = [11, 4, 10];

    // An 11 x 4 grid at z 0 on the implicit ground floor. The open cells are row 0 (x 1..10) and the rooms of rows 1
    // and 2 (x 3..7). A monster Gate at (9, 0) shuts the goal (10, 0). `monsters`: the Monsters as [pid, i, j, kind]
    // (kind 2: a dragon breathing west, 0: east, -2: a plain Monster); `water`: a water cell as [i, j]; `walls`: more
    // wall cells as [i, j].
    const setup = ({
        monsters,
        water = [],
        walls = [],
    }: {
        monsters: number[][];
        water?: number[];
        walls?: number[][];
    }) => {
        const open = new Set<string>();
        for (let i = 1; i <= 10; i++) open.add(`${i},0`);
        for (let i = 3; i <= 7; i++) open.add(`${i},1`).add(`${i},2`);
        for (const [i, j] of walls) open.delete(`${i},${j}`);

        const wallColumns: Columns = {};
        const waterColumns: Columns = {};
        const oceans: number[][] = [];

        if (water.length > 0) {
            const [waterI, waterJ] = water;
            open.add(`${waterI},${waterJ}`);
            waterColumns[waterI + waterJ * WIDTH] = [0];
            oceans.push([1, 0, 0, waterI, waterJ, 1, 1]);
        }

        for (let column = 0; column < WIDTH * HEIGHT; column++) {
            if (!open.has(`${column % WIDTH},${Math.floor(column / WIDTH)}`)) wallColumns[column] = [0];
        }

        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            water: waterColumns,
            extra: {
                oceans,
                monsters: monsters.map(([pid, i, j, kind]) => [pid, i, j, 0, kind]),
                gates: [[61, 9, 0, 0, 0, 0, 0, 1, 5]],
            },
        });

        return walker(NONE, [], []);
    };
    const opens = (walkGrid: Walker) => walkGrid.flood([walkGrid.cellOf(1, 0, 0)]).has(walkGrid.cellOf(GOAL, 0, 0));

    describe('into water', () => {
        // the Monster at (4, 1) is pushed east from (3, 1) to (5, 1) and into the water at (6, 1)
        const room = { monsters: [[1, 4, 1, -2]], water: [6, 1] };

        test('opens the Gate once the only Monster of its room drowns', () => {
            expect(opens(setup(room))).toBe(true);
        });
        test('keeps the Gate shut when the Monster cannot be pushed to the water', () => {
            expect(opens(setup({ ...room, walls: [[5, 1]] }))).toBe(false);
        });
        test('keeps the Gate shut while another Monster of the room lives', () => {
            expect(opens(setup({ ...room, monsters: [...room.monsters, [2, 7, 2, -2]] }))).toBe(false);
        });
    });

    describe('into fire', () => {
        // a dragon at (7, 2) breathes west along row 2; the dragon at (4, 1) breathes east and is pushed north from
        // (4, 0) into that fire, where the two dragons burn each other
        const room = {
            monsters: [
                [1, 4, 1, 0],
                [2, 7, 2, 2],
            ],
        };

        test('opens the Gate once two dragons that face each other burn', () => {
            expect(opens(setup(room))).toBe(true);
        });
        test('keeps the Gate shut when the dragon cannot reach the fire', () => {
            expect(
                opens(
                    setup({
                        ...room,
                        walls: [
                            [4, 2],
                            [3, 1],
                        ],
                    }),
                ),
            ).toBe(false);
        });
        test('keeps the Gate shut when the other dragon faces away', () => {
            expect(
                opens(
                    setup({
                        monsters: [
                            [1, 4, 1, 0],
                            [2, 7, 2, 0],
                        ],
                    }),
                ),
            ).toBe(false);
        });
    });
});

describe('a Monster pushed beside a goblin', () => {
    const [WIDTH, HEIGHT, GOAL] = [24, 4, 10];

    // A 24 x 4 grid at z 0 on the implicit ground floor. The open cells are row 0 (x 1..10), the cell (3, 1), row 2
    // (x 3..18) and the goblin's cell. A monster Gate at (9, 0) shuts the goal (10, 0). Its room ends at column 18, so a
    // goblin in column 19 or beyond stands in the next room and holds the Gate shut by nothing. A plain Monster at
    // (16, 2) is pushed east from (15, 2), to (17, 2) and to (18, 2). `goblin`: the goblin's column in row 2 (the cells
    // between 18 and it are wall); `fences`: Fences as [i, j, side].
    const setup = ({ goblin = 19, fences = [] }: { goblin?: number; fences?: number[][] } = {}) => {
        const open = new Set<string>();
        for (let i = 1; i <= 10; i++) open.add(`${i},0`);
        for (let i = 3; i <= 18; i++) open.add(`${i},2`);
        open.add('3,1').add(`${goblin},2`);

        const wallColumns: Columns = {};
        for (let column = 0; column < WIDTH * HEIGHT; column++) {
            if (!open.has(`${column % WIDTH},${Math.floor(column / WIDTH)}`)) wallColumns[column] = [0];
        }

        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            extra: {
                monsters: [
                    [1, 16, 2, 0, -2],
                    [2, goblin, 2, 0, -1],
                ],
                gates: [[61, 9, 0, 0, 0, 0, 0, 1, 5]],
                fences: fences.map(([i, j, side], index) => [80 + index, i, j, 0, side]),
            },
        });

        return walker(NONE, [], []);
    };
    const opens = (walkGrid: Walker) => walkGrid.flood([walkGrid.cellOf(1, 0, 0)]).has(walkGrid.cellOf(GOAL, 0, 0));

    test('opens the Gate once the only Monster of its room is pushed next to the goblin', () => {
        expect(opens(setup())).toBe(true);
    });
    test('keeps the Gate shut when no cell the Monster reaches is beside the goblin', () => {
        expect(opens(setup({ goblin: 20 }))).toBe(false);
    });
    test('keeps the Gate shut when a Fence stands between the goblin and the Monster', () => {
        expect(opens(setup({ fences: [[18, 2, 0]] }))).toBe(false);
    });
});

describe('a TRANSMUTE hero', () => {
    const [WIDTH, HEIGHT, DRUID, TREE, DRAGON] = [8, 4, 70, 71, 72];

    // An 8 x 4 grid at z 0 on the implicit ground floor. The open cells are row 0 (x 1..6) and the cell (2, 1), which
    // joins it. A TRANSMUTE Wardrobe at (1, 0) has its door on its east edge: stepping out through it gives the hero
    // TRANSMUTE and no push, and stepping back in gives the push back; (2, 1) is another way onto (2, 0) with the
    // push. `extra`: more level data; `walls`: more wall cells as [i, j].
    const setup = ({
        extra,
        walls = [],
        druids = [DRUID],
    }: {
        extra: Rows;
        walls?: Array<[i: number, j: number]>;
        druids?: number[];
    }) => {
        const open = new Set(['2,1']);
        for (let i = 1; i <= 6; i++) open.add(`${i},0`);
        for (const [i, j] of walls) open.delete(`${i},${j}`);

        const wallColumns: Columns = {};
        for (let column = 0; column < WIDTH * HEIGHT; column++) {
            if (!open.has(`${column % WIDTH},${Math.floor(column / WIDTH)}`)) wallColumns[column] = [0];
        }

        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            extra: { wardrobes: [[DRUID, 1, 0, 0, 0, 2]], transmute: druids, ...extra },
        });

        return walker(NONE, [], []);
    };
    const reaches = (walkGrid: Walker, i: number) =>
        walkGrid.flood([walkGrid.cellOf(2, 1, 0)]).has(walkGrid.cellOf(i, 0, 0));

    describe('and a Tree', () => {
        // the Tree at (3, 0) is turned into a crystal from (2, 0), then pushed east to (4, 0) by the hero who has
        // his push back
        const room = { extra: { trees: [[TREE, 3, 0, 0]] } };

        test('turns it into a crystal he pushes on and walks into its cell', () => {
            expect(reaches(setup(room), 3)).toBe(true);
        });
        test('leaves the Tree standing with no TRANSMUTE Wardrobe', () => {
            expect(reaches(setup({ ...room, druids: [] }), 3)).toBe(false);
        });
        test('cannot push the crystal into a wall', () => {
            expect(reaches(setup({ ...room, walls: [[4, 0]] }), 3)).toBe(false);
        });
    });

    describe('and a dragon', () => {
        // the dragon at (3, 0) breathes north into wall; the monster Gate at (5, 0) holds its room shut until the
        // dragon is a crystal
        const room = {
            extra: { monsters: [[DRAGON, 3, 0, 0, 1]], gates: [[61, 5, 0, 0, 0, 0, 0, 1, 5]] },
        };

        test('turns it into a crystal, which opens the monster Gate of its room', () => {
            expect(reaches(setup(room), 5)).toBe(true);
        });
        test('leaves the Gate shut while another Monster of the room lives', () => {
            const extra = { monsters: [...room.extra.monsters, [73, 6, 0, 0, -2]], gates: room.extra.gates };
            expect(reaches(setup({ extra }), 5)).toBe(false);
        });
    });
});

describe('Rocks sunk side by side in a gap', () => {
    const [WIDTH, HEIGHT, WATER_ROW] = [11, 5, 2];
    const [FIRST, SECOND, THIRD] = [31, 32, 33];

    // An 11 x 5 grid with ground at z 0 (hero level z 1). The room x 0..4 is open; a corridor along row 2 runs east
    // from x 5 + `gap` to x 9, and `gap` water cells (surface z 1) at x 5.. of row 2 lie between the room and the
    // corridor, the rest of columns 5.. being wall. Rocks: the first at (3, 2) on the water row, the second at (4, 3)
    // and the third at (4, 1), each pushed onto the water row to follow it. `rocks`: how many of the three stand there.
    // `walls`: more wall cells as [i, j]. `straight`: the first Rock has a straight bridge from (2, 2) into the first
    // water cell.
    const setup = (
        gap: number,
        rocks: number,
        { walls = [], straight = false }: { walls?: Array<[i: number, j: number]>; straight?: boolean } = {},
    ) => {
        const wallColumns: Columns = {};
        for (let column = 0; column < WIDTH * HEIGHT; column++) {
            const i = column % WIDTH;
            const j = Math.floor(column / WIDTH);
            const inGap = j === WATER_ROW && i >= 5 && i < 5 + gap;
            const inCorridor = j === WATER_ROW && i >= 5 + gap && i < WIDTH - 1;
            if (inGap) continue;

            if (i >= 5 && !inCorridor) {
                wallColumns[column] = [0, 1, 2];
            } else {
                wallColumns[column] = [0];
            }
        }
        for (const [i, j] of walls) wallColumns[i + j * WIDTH] = [0, 1, 2];

        const water: Columns = {};
        for (let i = 5; i < 5 + gap; i++) water[i + WATER_ROW * WIDTH] = [0];

        const placed = [
            [FIRST, 3, 2, 1],
            [SECOND, 4, 3, 1],
            [THIRD, 4, 1, 1],
        ];

        const bridges: number[][] = [];
        if (straight) bridges.push([FIRST, 2, WATER_ROW, 1, 5, WATER_ROW, 1]);

        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            water,
            extra: {
                oceans: [[1, 1, 0, 5, WATER_ROW, gap, 1]],
                rocks: placed.slice(0, rocks),
                bridges,
            },
        });

        return walker(NONE, [], []);
    };
    const reached = (walkGrid: Walker) => walkGrid.flood([walkGrid.cellOf(0, WATER_ROW, 1)]);
    const crosses = (walkGrid: Walker, gap: number) => reached(walkGrid).has(walkGrid.cellOf(5 + gap, WATER_ROW, 1));
    const standsOn = (walkGrid: Walker, i: number) => reached(walkGrid).has(walkGrid.cellOf(i, WATER_ROW, 1));

    test('two Rocks close a gap of two water cells', () => {
        expect(crosses(setup(2, 2), 2)).toBe(true);
    });
    test('three Rocks close a gap of three water cells', () => {
        expect(crosses(setup(3, 3), 3)).toBe(true);
    });
    test('a gap of two water cells is left open by one Rock, which does not sink', () => {
        const walkGrid = setup(2, 1);
        expect(crosses(walkGrid, 2)).toBe(false);
        expect(standsOn(walkGrid, 5)).toBe(false);
    });
    test('two Rocks do not close three water cells', () => {
        const walkGrid = setup(3, 2);
        expect(crosses(walkGrid, 3)).toBe(false);
        expect(standsOn(walkGrid, 5)).toBe(false);
    });
    test('the second Rock cannot close the gap when it cannot be pushed onto the water row', () => {
        expect(crosses(setup(2, 2, { walls: [[4, 4]] }), 2)).toBe(false);
    });
    test('a Rock rolls over the cell a straight bridge sank and closes the gap', () => {
        expect(crosses(setup(2, 2, { straight: true }), 2)).toBe(true);
    });
});

describe('the target of a TELEPORT swap', () => {
    // Builds the walker. A hero in walk layer 2 seeds a flood with [cell, 2].
    const build = () => walker(NONE, [], []);
    const wizardFlood = (walkGrid: Walker, i: number, j: number, z = 0) =>
        walkGrid.flood([[walkGrid.cellOf(i, j, z), 2]]);
    // The solid z values per column of a grid: `wall` in every column not in `openCells` ("i,j"), `floor` in the rest
    const solidColumns = (
        width: number,
        height: number,
        openCells: Set<string>,
        wall: number[],
        floor: number[] = [],
    ) => {
        const solid: Columns = {};
        for (let column = 0; column < width * height; column++) {
            const isOpen = openCells.has(`${column % width},${Math.floor(column / width)}`);
            solid[column] = isOpen ? floor : wall;
        }
        return solid;
    };

    describe('landing on a Switch', () => {
        // A row of 8 at z 0 on the implicit ground floor: the hero starts at 0, the Switch of flavor 7 is at 1 and the
        // Rock at `rockAt`; the shut Gate of flavor 7 at 4 closes the way to 5. `wall`: a wall cell.
        const setup = ({ rockAt = 2, wall = -1 }: { rockAt?: number; wall?: number } = {}) => {
            const walls: Columns = { 6: [0], 7: [0] };
            if (wall >= 0) walls[wall] = [0];
            world({
                width: 8,
                walls,
                extra: {
                    rocks: [[64, rockAt, 0, 0]],
                    switches: [[60, 7, 0, 1, 0, 0]],
                    gates: [[61, 4, 0, 0, 0, 0, 7, 0, 5]],
                },
            });
            return build();
        };

        test('presses it, which opens the Gate', () => {
            const walkGrid = setup();
            expect(columns(walkGrid, wizardFlood(walkGrid, 0, 0))).toEqual([0, 1, 2, 3, 4, 5]);
        });
        test('presses nothing when a wall ends the line from the Switch', () => {
            const walkGrid = setup({ rockAt: 3, wall: 2 });
            expect(columns(walkGrid, wizardFlood(walkGrid, 0, 0))).toEqual([0, 1]);
        });
    });

    describe('filling a Gem_Slot', () => {
        const [LIGHT, SLOT, GEM] = [7, 8, 11];
        const [LIGHT_KIND, GEM_KIND, THROUGH] = [1, 0, 1];
        const [WIDTH, HEIGHT] = [12, 6];

        // A 12 x 6 room at z 0: walls round the edge and in columns 8 and 9, and the east end (10, 11) is closed but for
        // row 2. A powered-by-Gem THROUGH light at (1, 2) faces east along row 2; its room's slot is (5, 1) and the Gem
        // is at (5, 3), in line with the slot. `extraWalls`: more wall cells as [i, j].
        const setup = (extraWalls: Array<[i: number, j: number]> = []) => {
            const wallCells = new Set(extraWalls.map(([i, j]) => i + j * WIDTH));
            for (let i = 0; i < WIDTH; i++) {
                wallCells.add(i);
                wallCells.add(i + (HEIGHT - 1) * WIDTH);
            }
            for (let j = 1; j < HEIGHT - 1; j++) {
                for (const i of [0, 8, 9]) wallCells.add(i + j * WIDTH);
                if (j !== 2) for (const i of [10, 11]) wallCells.add(i + j * WIDTH);
            }
            const walls: Columns = {};
            for (const column of wallCells) walls[column] = [0];
            world({
                width: WIDTH,
                height: HEIGHT,
                walls,
                extra: {
                    lights: [[LIGHT, 1, 2, 0, 0, 0, 0, 0, THROUGH]],
                    gem_slots: [[SLOT, 5, 1, 0, 0]],
                    movables: [
                        [LIGHT, 1, 2, 0, LIGHT_KIND],
                        [GEM, 5, 3, 0, GEM_KIND],
                    ],
                },
            });
            return build();
        };
        const reachesEast = (walkGrid: Walker) => wizardFlood(walkGrid, 5, 1).has(walkGrid.cellOf(10, 2, 0));

        test('powers the room, and the light casts its beam', () => {
            expect(reachesEast(setup())).toBe(true);
        });
        test('powers nothing when a wall ends the line from the slot', () => {
            expect(reachesEast(setup([[5, 2]]))).toBe(false);
        });
    });

    describe('sinking into water', () => {
        const [WIDTH, HEIGHT, ROCK] = [7, 4, 9];

        // A 7 x 4 slab with ground at z 0. The corridor is row 1 (x 1..3 and the island 5) with the water cell (4, 1)
        // (surface z 1) between; the Rock at (2, 2) is boxed in by walls, so only a swap moves it. A hero in layer 2 at
        // (2, 1) swaps it into (2, 1); a hero in layer 0 at (1, 1) pushes it east, twice, into the water. `walls`: more
        // wall cells as [i, j].
        const setup = (walls: Array<[i: number, j: number]> = []) => {
            const open = new Set(['1,1', '2,1', '3,1', '5,1', '2,2']);
            for (const [i, j] of walls) open.delete(`${i},${j}`);
            const solid = solidColumns(WIDTH, HEIGHT, open, [0, 1, 2], [0]);
            delete solid[4 + 1 * WIDTH];
            world({
                width: WIDTH,
                height: HEIGHT,
                walls: solid,
                water: { [4 + 1 * WIDTH]: [0] },
                extra: { oceans: [[1, 1, 0, 4, 1, 1, 1]], rocks: [[ROCK, 2, 2, 1]] },
            });
            return build();
        };
        const crosses = (walkGrid: Walker) =>
            walkGrid
                .flood([
                    [walkGrid.cellOf(1, 1, 1), 0],
                    [walkGrid.cellOf(2, 1, 1), 2],
                ])
                .has(walkGrid.cellOf(5, 1, 1));

        test('makes the bridge once the hero pushes the swapped Rock into the water', () => {
            expect(crosses(setup())).toBe(true);
        });
        test('makes none when the last cell before the water is wall', () => {
            expect(crosses(setup([[3, 1]]))).toBe(false);
        });
    });

    describe('unblocking a beam', () => {
        const [LIGHT, ROCK] = [7, 12];
        const [LIGHT_KIND, THROUGH] = [1, 1];
        const [WIDTH, HEIGHT] = [12, 5];

        // A 12 x 5 room at z 0 where only row 2 (x 1..7 and 10, 11) and the cells (6, 0) and (6, 1) are open. A powered
        // THROUGH light at (1, 2) faces east; the Rock at (6, 2) stops its beam, and walls at x 8 and 9 shut off the east
        // end. A hero in layer 2 at (6, 0) swaps with the Rock, which lands off the beam's line. `walls`: more wall
        // cells as [i, j]; `side`: whether (6, 0) and (6, 1) are open; `from`: where the hero starts.
        const setup = ({
            walls = [],
            side = true,
            from = [6, 0],
        }: { walls?: Array<[i: number, j: number]>; side?: boolean; from?: [i: number, j: number] } = {}) => {
            const open = new Set(['10,2', '11,2']);
            if (side) open.add('6,0').add('6,1');
            for (let i = 1; i <= 7; i++) open.add(`${i},2`);
            for (const [i, j] of walls) open.delete(`${i},${j}`);
            world({
                width: WIDTH,
                height: HEIGHT,
                walls: solidColumns(WIDTH, HEIGHT, open, [0]),
                extra: {
                    lights: [[LIGHT, 1, 2, 0, 0, 0, 0, 0, THROUGH]],
                    gem_slots: POWERED_ROOM,
                    movables: [[LIGHT, 1, 2, 0, LIGHT_KIND]],
                    rocks: [[ROCK, 6, 2, 0]],
                },
            });
            const walkGrid = build();
            return wizardFlood(walkGrid, ...from).has(walkGrid.cellOf(10, 2, 0));
        };

        test('lets the beam run on, through the walls to the east end', () => {
            expect(setup()).toBe(true);
        });
        test('leaves it stopped when a wall ends the line from the hero', () => {
            expect(setup({ walls: [[6, 1]] })).toBe(false);
        });
        test('leaves it stopped when the Rock would land on the beam', () => {
            // a hero in the beam at (4, 2) swaps with the Rock east of him, and it would stop the beam at (4, 2); no
            // cell off the beam leads to the Rock
            expect(setup({ side: false, from: [4, 2] })).toBe(false);
        });
    });
});

describe('a Rock far from its Switch', () => {
    const [WIDTH, HEIGHT, SWITCH, GATE, ROCK] = [40, 20, 60, 61, 62];

    // A 40 x 20 slab of open ground inside a wall border. The pocket cell (20, 18) is shut in by walls and the Gate
    // (20, 17) of flavor 7, whose Switch lies at (1, 1) and which a Rock at (37, 17) presses after more than 50 pushes:
    // more than 256 cells of the walk back from the Switch. `walls`: more wall cells as [i, j].
    const setup = (walls: Array<[i: number, j: number]> = []) => {
        const wallCells = new Set(['19,18', '21,18']);
        for (const [i, j] of walls) wallCells.add(`${i},${j}`);

        const wallColumns: Columns = {};
        for (let column = 0; column < WIDTH * HEIGHT; column++) {
            const [i, j] = [column % WIDTH, Math.floor(column / WIDTH)];
            const border = i === 0 || j === 0 || i === WIDTH - 1 || j === HEIGHT - 1;
            if (border || wallCells.has(`${i},${j}`)) wallColumns[column] = [0];
        }

        world({
            width: WIDTH,
            height: HEIGHT,
            walls: wallColumns,
            extra: {
                switches: [[SWITCH, 7, 0, 1, 1, 0]],
                gates: [[GATE, 20, 17, 0, 0, 0, 7, 0, 5]],
                rocks: [[ROCK, 37, 17, 0]],
            },
        });

        return walker(NONE, [], []);
    };
    const reachesPocket = (walkGrid: Walker) => fill(walkGrid, 10, 10, 0).has(walkGrid.cellOf(20, 18, 0));

    test('presses the Switch', () => {
        expect(reachesPocket(setup())).toBe(true);
    });
    test('presses nothing when walls box the Rock in', () => {
        expect(
            reachesPocket(
                setup([
                    [36, 17],
                    [37, 16],
                ]),
            ),
        ).toBe(false);
    });
});
