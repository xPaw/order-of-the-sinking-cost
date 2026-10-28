// Falls, TELEPORT swaps, lily rides, gates that hold the hero up and plan searches through cycles, on tiny synthetic
// overworlds
import { describe, expect, test, vi } from 'vitest';
import { PROG, WORLD } from '../src/data.ts';
import { unlockPlan } from '../src/model/plans.ts';
import type { BaseProgress } from '../src/model/progress.ts';
import type { WhyBlocked } from '../src/model/way-in.ts';
import type { LatestValues } from '../src/save.ts';
import type { Freezer, WorldGrid } from '../src/types.ts';
import { walker } from '../src/walk/walker.ts';
import type { Walker } from '../src/walk/walker.ts';
import { f32, NONE } from './fixtures.ts';
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
    layers?: Array<[z: number, layer: number]>;
    grid?: Partial<WorldGrid>;
    extra?: Rows;
}

const Z_OFFSET = 64;
// A `width` x `height` grid. walls: per column (i + j * width) the solid z values; water: per column the indices into
// extra.oceans; layers: [z, layer] pairs, each layer from its z up
function world({ width, height = 1, walls = {}, water = {}, layers = [], grid = {}, extra = {} }: WorldOptions) {
    const solidColumns: number[] = [];
    const wet: number[] = [];
    for (let column = 0; column < width * height; column++) {
        const heights = walls[column] || [],
            oceanIndexes = water[column] || [];
        solidColumns.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
        wet.push(oceanIndexes.length, ...oceanIndexes.flatMap((oceanIndex) => [oceanIndex & 255, oceanIndex >> 8]));
    }
    const zlayer = Array.from({ length: 256 }, (_, zByte) => {
        let layer = 0;
        for (const [z, layerOfZ] of layers) if (zByte - Z_OFFSET >= z) layer = layerOfZ;
        return layer;
    });
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
            grid: { corner: [0, 0], size: [width, height], zoff: Z_OFFSET, ...grid },
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
// the reached cells at z as "i,j", sorted by row then column
const cells = (walkGrid: Walker, cellSet: Iterable<number>, z = 0) =>
    [...cellSet]
        .filter((cell) => Math.floor(cell / walkGrid.layerCells) - 80 === z)
        .map((cell) => [cell % walkGrid.width, Math.floor((cell % walkGrid.layerCells) / walkGrid.width)])
        .toSorted((first, second) => first[1] - second[1] || first[0] - second[0])
        .map((point) => point.join());
const columns = (walkGrid: Walker, cellSet: Iterable<number>, z = 0) =>
    cells(walkGrid, cellSet, z).map((point) => +point.split(',')[0]);
const lowest = (walkGrid: Walker, cellSet: Iterable<number>) =>
    Math.min(...[...cellSet].map((cell) => Math.floor(cell / walkGrid.layerCells) - 80));

describe('falls', () => {
    // a row of 3: column 0 a tower of wall up to z 19, the hero on top at z 20; columns 1 and 2 open down to the floor
    const tower = Array.from({ length: 20 }, (_, z) => z);
    test('a fall has no height limit', () => {
        world({ width: 3, walls: { 0: tower } });
        const walkGrid = walker(NONE, [], []);
        expect(columns(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 20)]), 0)).toEqual([1, 2]);
    });
    test('a pocket flood keeps the fall inside the layer it starts in', () => {
        world({ width: 3, walls: { 0: tower }, layers: [[10, 2]] });
        const walkGrid = walker(NONE, [], []);
        expect(columns(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 20)]), 0)).toEqual([1, 2]);
        expect(lowest(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 20)], null, null, { pocket: true }))).toBe(20);
    });
    test('a fall that starts in a map room does not drop out of it', () => {
        world({
            width: 3,
            walls: { 0: tower },
            layers: [[15, 3]],
            grid: { ft: { corner: [0, 0], size: [3, 1], z: 15 } },
        });
        const walkGrid = walker(NONE, [], []);
        expect(lowest(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 20)]))).toBe(20);
    });
});

describe('TELEPORT swaps', () => {
    // a row of 11 at z 0: the hero's side 0..2, water 3..6 and 10 (surface 0), an island 7..9 with a Rock at 7; by
    // default a wall at 10 ends the line west of the hero
    const setup = (extra: Rows = {}, walls: Columns = { 10: [0] }, latest = NONE) => {
        const water: Columns = {};
        for (const i of [3, 4, 5, 6, 10]) water[i] = [0];
        world({
            width: 11,
            walls,
            water,
            extra: { oceans: [[1, 0, 0, 0, 0, 11, 1]], rocks: [[9, 7, 0, 0]], ...extra },
        });
        return walker(latest, [], []);
    };
    const wizard = (walkGrid: Walker, i: number) => walkGrid.flood([[walkGrid.cellOf(i, 0, 0), 2]]);
    test('the line crosses water and the hero swaps onto the first target', () => {
        const walkGrid = setup();
        expect(columns(walkGrid, walkGrid.flood([walkGrid.cellOf(1, 0, 0)]))).toEqual([0, 1, 2]);
        expect(columns(walkGrid, wizard(walkGrid, 1))).toEqual([0, 1, 2, 7, 8, 9]);
    });
    test('a wall, a Mirror met on an open side or a Wardrobe door edge ends the line', () => {
        const wall = setup({}, { 5: [0], 10: [0] });
        expect(columns(wall, wizard(wall, 1))).toEqual([0, 1, 2]);
        const mirror = setup({ movables: [[30, 5, 0, 0, 2]], mirror_facings: [[30, 0, 0]] });
        expect(columns(mirror, wizard(mirror, 1))).toEqual([0, 1, 2]);
        const door = setup({ wardrobes: [[40, 2, 0, 0, 0, 2]] });
        expect(columns(door, wizard(door, 1))).toEqual([0, 1, 2]);
    });
    // a Mirror on the island at 8 in place of the Rock; its facing is [quarter turns, shape]. A hero who swaps onto it
    // walks on to 7 and 9
    const mirrorAt = (facing: [turns: number, shape: number] | null, latest = NONE) => {
        const extra = { rocks: [], movables: [[30, 8, 0, 0, 2]], mirror_facings: facing ? [[30, ...facing]] : [] };
        return setup(extra, undefined, latest);
    };
    const MIRROR_FLAT = 0;
    const MIRROR_VERTICAL = 1;
    const MIRROR_VERTICAL_DOWN = 2;
    test('a Mirror met on its back or a closed side is a target; on an open side it ends the line', () => {
        // a flat Mirror at θ 0 is open on its west and south sides: the hero west of it meets an open side
        const open = mirrorAt([0, MIRROR_FLAT]);
        expect(columns(open, wizard(open, 1))).toEqual([0, 1, 2]);
        // at θ 180 it is open on its east and north sides: the hero meets its back, swaps onto it and swaps on
        const back = mirrorAt([2, MIRROR_FLAT]);
        expect(columns(back, wizard(back, 1))).toEqual([0, 1, 2, 7, 8, 9]);
        // at θ 90 it is open on its south and east sides: the west side is closed too
        const closed = mirrorAt([1, MIRROR_FLAT]);
        expect(columns(closed, wizard(closed, 1))).toEqual([0, 1, 2, 7, 8, 9]);
        // without a facing every side counts as open
        const unknown = mirrorAt(null);
        expect(columns(unknown, wizard(unknown, 1))).toEqual([0, 1, 2]);
    });
    test('a vertical Mirror is open on one horizontal side', () => {
        // open east at θ 0: the hero west of it meets a closed side; at θ 180 it is open west
        const closed = mirrorAt([0, MIRROR_VERTICAL]);
        expect(columns(closed, wizard(closed, 1))).toEqual([0, 1, 2, 7, 8, 9]);
        const open = mirrorAt([2, MIRROR_VERTICAL]);
        expect(columns(open, wizard(open, 1))).toEqual([0, 1, 2]);
        // a downward one is open west at θ 0 and east at θ 180
        const downOpen = mirrorAt([0, MIRROR_VERTICAL_DOWN]);
        expect(columns(downOpen, wizard(downOpen, 1))).toEqual([0, 1, 2]);
        const downClosed = mirrorAt([2, MIRROR_VERTICAL_DOWN]);
        expect(columns(downClosed, wizard(downClosed, 1))).toEqual([0, 1, 2, 7, 8, 9]);
    });
    test('the Mirror turned by the save is met on its latest facing', () => {
        const turned: LatestValues = {
            ...NONE,
            get: (pid: number, field: string) => {
                if (pid !== 30 || field !== 'base.theta_target') return undefined;
                return new Uint8Array(new Float32Array([180]).buffer);
            },
        };
        const walkGrid = mirrorAt([0, MIRROR_FLAT], turned);
        expect(columns(walkGrid, wizard(walkGrid, 1))).toEqual([0, 1, 2, 7, 8, 9]);
    });
    test('the line wraps around the world', () => {
        // walls at 3 and 4 end the line east; west of 0 it wraps to 10 and runs on to the Rock at 7
        const walkGrid = setup({}, { 3: [0], 4: [0] });
        expect(columns(walkGrid, wizard(walkGrid, 1))).toEqual([0, 1, 2, 7, 8, 9]);
    });
    test('the skill comes from a TELEPORT Wardrobe left by its door', () => {
        // a Wardrobe at 0 with its door on the east edge: the hero enters it by the door and leaves it again
        const walkGrid = setup({ wardrobes: [[40, 0, 0, 0, 0, 2]], teleport: [40] });
        expect(columns(walkGrid, walkGrid.flood([walkGrid.cellOf(1, 0, 0)]))).toEqual([0, 1, 2, 7, 8, 9]);
        const plain = setup({ wardrobes: [[40, 0, 0, 0, 0, 2]] });
        expect(columns(plain, plain.flood([plain.cellOf(1, 0, 0)]))).toEqual([0, 1, 2]);
    });
});

describe('a stone riding a Lily', () => {
    // two rows of 14 at z 0. Row 0: the hero's side 0..2 with a SKIPPABLE Rock at 2, water 3..10 (surface 0) with a
    // Lily at 6 on a river flowing east over 6..9, dry land 11..13 with a TELEPORT Wardrobe at 13 (door west). Row 1:
    // wall but the dry cell (8, 1).
    const setup = (
        lilies: number[][],
        more: Rows = {},
        { freezers = [], closed = [] }: { freezers?: Freezer[]; closed?: boolean[] } = {},
    ) => {
        const water: Columns = {};
        const walls: Columns = {};
        for (let i = 3; i <= 10; i++) water[i] = [0];
        for (let i = 0; i < 14; i++) if (i !== 8) walls[14 + i] = [0];
        world({
            width: 14,
            height: 2,
            walls,
            water,
            extra: {
                oceans: [[1, 0, 0, 0, 0, 14, 1]],
                rocks: [[9, 2, 0, 0]],
                skippable: [9],
                lilies,
                rivers: [6, 7, 8, 9].map((i) => [i, 0, 0, 1]),
                wardrobes: [[40, 13, 0, 0, 2, 2]],
                teleport: [40],
                ...more,
            },
        });
        PROG.freezers = freezers;
        return walker(NONE, [], closed);
    };
    const column = (walkGrid: Walker, cell: number) => cell % walkGrid.width;
    // per landing cell, the ride of a hero who swaps in at the landing and rides to the end
    const fullRides = (walkGrid: Walker) => {
        const rides = walkGrid.lanes
            .filter((lane) => lane.ride[0] === lane.landing)
            .map((lane) => lane.ride.map((cell) => column(walkGrid, cell)).join());
        return [...new Set(rides)].map((ride) => ride.split(',').map(Number));
    };
    test('the stone lands on the Lily anywhere along its drift, and it drifts on with the river until it is blocked', () => {
        const walkGrid = setup([[50, 6, 0, 0]]);
        expect(fullRides(walkGrid)).toEqual([[6, 7, 8, 9, 10], [7, 8, 9, 10], [8, 9, 10], [9, 10], [10], [11]]);
    });
    test('the Lily under the stone holds no hero, so a cell only it holds up is no line cell', () => {
        const walkGrid = setup([[50, 6, 0, 0]]);
        const onLily = walkGrid.lanes.filter((lane) => column(walkGrid, lane.landing) <= 10);
        const lineCells = new Set(onLily.flatMap((lane) => cells(walkGrid, lane.from)));
        expect([...lineCells].filter((cell) => ['6,0', '7,0', '8,0', '9,0', '10,0'].includes(cell))).toEqual([]);
        expect([...lineCells]).toEqual(expect.arrayContaining(['11,0', '8,1']));
        // a stone landing on dry land leaves the Lily free to hold the hero
        const onLand = walkGrid.lanes.filter((lane) => column(walkGrid, lane.landing) === 11);
        expect(onLand.flatMap((lane) => lane.from.map((cell) => column(walkGrid, cell)))).toContain(10);
    });
    test('a ride that reaches the cell the hero swapped from ends just before it', () => {
        // a shut Gate under the water at 10 holds the hero up there, on the Lily's way
        const walkGrid = setup([[50, 6, 0, 0]], { gates: [[20, 10, 0, -1, 0, 0, 0, 0]] });
        const fromTen = walkGrid.lanes.filter(
            (lane) => column(walkGrid, lane.landing) === 6 && lane.from.some((cell) => column(walkGrid, cell) === 10),
        );
        expect(fromTen.map((lane) => lane.ride.map((cell) => column(walkGrid, cell)))).toEqual([
            [6, 7, 8, 9],
            [7, 8, 9],
            [8, 9],
            [9],
        ]);
    });
    test('a hero who swaps onto it rides along and steps off', () => {
        const walkGrid = setup([[50, 6, 0, 0]]);
        expect(cells(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 0)]))).toContain('8,1');
        const noLily = setup([]);
        expect(cells(noLily, noLily.flood([noLily.cellOf(0, 0, 0)]))).not.toContain('8,1');
    });
    describe('with a Freezer on the Lily', () => {
        // the Lily rests at 6, off the river, which flows east over 7..9: only a stone kicks it along
        const freezers: Freezer[] = [{ pid: 1, p: [6, 0, 0], l: 0, req: [] }];
        const river = { rivers: [7, 8, 9].map((i) => [i, 0, 0, 1]) };
        const build = (closed: boolean[]) => setup([[50, 6, 0, 0]], river, { freezers, closed });
        const swapped = (closed: boolean[]) => {
            const walkGrid = build(closed);
            const front = new Set<number>();
            const reached = walkGrid.flood([walkGrid.cellOf(0, 0, 0)], null, front);
            return { lanes: walkGrid.lanes, reached: cells(walkGrid, reached), front: [...front] };
        };
        test('the lanes are found with the Freezer open, and name it', () => {
            const rideLanes = swapped([true]).lanes.filter((lane) => lane.ride.length > 1);
            expect(rideLanes.length).toBeGreaterThan(0);
            expect(rideLanes.every((lane) => lane.freezers.length === 1 && lane.freezers[0].freezerIndex === 0)).toBe(
                true,
            );
        });
        test('no lane is taken while the Freezer is closed, and the flood bumps into it', () => {
            const { reached, front } = swapped([true]);
            expect(reached).not.toContain('8,1');
            expect(front).toEqual([0]);
        });
        test('the hero swaps onto the stone and steps off once it is open', () => {
            const { reached, front } = swapped([false]);
            expect(reached).toContain('8,1');
            expect(front).toEqual([]);
        });
        test('a pocket flood from the island walks back along the ride to the push side', () => {
            const walkGrid = build([false]);
            const front = new Set<number>();
            const pocket = walkGrid.flood([walkGrid.cellOf(8, 1, 0)], null, front, { pocket: true });
            expect(cells(walkGrid, pocket)).toContain('0,0');
            expect([...front]).toEqual([]);
        });
        test('a pocket flood from the island bumps into the closed Freezer', () => {
            const walkGrid = build([true]);
            const front = new Set<number>();
            walkGrid.flood([walkGrid.cellOf(8, 1, 0)], null, front, { pocket: true });
            expect([...front]).toEqual([0]);
        });
        test('a pocket flood also bumps into the Freezer of the stone', () => {
            const both: Freezer[] = [...freezers, { pid: 2, p: [2, 0, 0], l: 0, req: [] }];
            const walkGrid = setup([[50, 6, 0, 0]], river, { freezers: both, closed: [true, true] });
            const front = new Set<number>();
            walkGrid.flood([walkGrid.cellOf(8, 1, 0)], null, front, { pocket: true });
            expect([...front].toSorted()).toEqual([0, 1]);
        });
    });
});

describe('a hero boarding a drifting Lily', () => {
    // two rows of 10 at z 0. Row 0: water 0..7 (surface 0) on a river flowing east, dry land 8..9 (the island). Row 1:
    // the hero's shore at 3..4, wall elsewhere.
    const setup = (lilies: number[][]) => {
        const water: Columns = {};
        const walls: Columns = {};
        for (let i = 0; i <= 7; i++) water[i] = [0];
        for (let i = 0; i < 10; i++) if (i !== 3 && i !== 4) walls[10 + i] = [0];
        world({
            width: 10,
            height: 2,
            walls,
            water,
            extra: {
                oceans: [[1, 0, 0, 0, 0, 10, 2]],
                lilies,
                rivers: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i, 0, 0, 1]),
            },
        });
        const walkGrid = walker(NONE, [], []);
        return cells(walkGrid, walkGrid.flood([walkGrid.cellOf(3, 1, 0)]));
    };
    test('the hero boards the Lily where its drift passes the shore and rides it to the island', () => {
        expect(setup([[50, 0, 0, 0]])).toEqual(expect.arrayContaining(['8,0', '9,0']));
        expect(setup([])).toEqual(['3,1', '4,1']);
    });
    test('a Lily whose drift starts past the shore is out of reach', () => {
        expect(setup([[50, 5, 0, 0]])).toEqual(['3,1', '4,1']);
    });
    test('a Lily that does not exist drifts nowhere', () => {
        expect(setup([[50, 0, 0, 0, 0]])).toEqual(['3,1', '4,1']);
    });
});

describe('a Lily a Spawner respawns on a river', () => {
    // as above, with no Lily in the level data: the Spawner (60) respawns Lily 50 in a river cell, and the hero's shore
    // at (3, 1) holds the Activator (70) that runs it
    const setup = (spawner: number[], activator: number[]) => {
        const water: Columns = {};
        const walls: Columns = {};
        for (let i = 0; i <= 7; i++) water[i] = [0];
        for (let i = 0; i < 10; i++) if (i !== 3 && i !== 4) walls[10 + i] = [0];
        world({
            width: 10,
            height: 2,
            walls,
            water,
            extra: {
                oceans: [[1, 0, 0, 0, 0, 10, 2]],
                lilies: [],
                lily_spawns: [[...spawner.slice(0, 4), 50, [activator], ...spawner.slice(4)]],
                rivers: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [i, 0, 0, 1]),
            },
        });
        const walkGrid = walker(NONE, [], []);
        return cells(walkGrid, walkGrid.flood([walkGrid.cellOf(3, 1, 0)]));
    };
    test('the hero who reaches the Activator boards the Lily and rides it to the island', () => {
        expect(setup([60, 0, 0, 0], [70, 3, 1, 0])).toEqual(expect.arrayContaining(['8,0', '9,0']));
    });
    test('an Activator the hero does not reach respawns nothing', () => {
        expect(setup([60, 0, 0, 0], [70, 9, 0, 0])).toEqual(['3,1', '4,1']);
    });
    test('an Activator or a Spawner that does not exist respawns nothing', () => {
        expect(setup([60, 0, 0, 0], [70, 3, 1, 0, 0])).toEqual(['3,1', '4,1']);
        expect(setup([60, 0, 0, 0, 0], [70, 3, 1, 0])).toEqual(['3,1', '4,1']);
    });
    test('a Spawner off a river drifts nowhere', () => {
        expect(setup([60, 9, 0, 0], [70, 3, 1, 0])).toEqual(['3,1', '4,1']);
    });
});

describe('a Rock a Spawner respawns', () => {
    // a row of 8 at z 0: dry 0..2 and 4..6, water at 3 (surface 0), a wall at 7. Rock 9 belongs at (1, 0) with its
    // Spawner (60); the save left it at (6, 0), out of reach. The hero starts at 0; the Activator (70) that runs the
    // Spawner stands at `activatorAt`
    const leftAt = (x: number): LatestValues => ({
        ...NONE,
        get: (pid: number, field: string) => (pid === 9 && field === 'base.position.x' ? f32(x) : undefined),
    });
    const setup = ({
        activatorAt = 0,
        activatorExists,
        spawnerExists,
        rockAt = 6,
    }: { activatorAt?: number; activatorExists?: number; spawnerExists?: number; rockAt?: number } = {}) => {
        const activator = [70, activatorAt, 0, 0];
        if (activatorExists !== undefined) activator.push(activatorExists);
        const spawner: Array<number | number[][]> = [60, 1, 0, 0, 9, [activator]];
        if (spawnerExists !== undefined) spawner.push(spawnerExists);

        world({
            width: 8,
            walls: { 7: [0] },
            water: { 3: [0] },
            extra: { oceans: [[1, 0, 0, 0, 0, 8, 1]], rocks: [[9, 1, 0, 0]], rock_spawns: [spawner] },
        });
        const walkGrid = walker(leftAt(rockAt), [], []);
        return columns(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 0)]));
    };
    test('the hero who reaches the Activator pushes the Rock from its Spawner into the water', () => {
        expect(setup()).toEqual([0, 1, 2, 3, 4, 5]);
    });
    test('an Activator the hero does not reach puts nothing back', () => {
        expect(setup({ activatorAt: 5 })).toEqual([0, 1, 2]);
    });
    test('an Activator or a Spawner that does not exist puts nothing back', () => {
        expect(setup({ activatorExists: 0 })).toEqual([0, 1, 2]);
        expect(setup({ spawnerExists: 0 })).toEqual([0, 1, 2]);
    });
    test('a Rock the save left at its Spawner needs no Activator', () => {
        expect(setup({ activatorAt: 5, rockAt: 1 })).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });
});

describe('a Rover that sinks', () => {
    // three rows of 8 at z 0. Row 1: the hero's side 0..2, water 3 (surface 0), dry land 4..5, wall 6..7. Column 3 is
    // water in rows 0 and 2 too and wall elsewhere in those rows. A Rover (30) at `roverAt` runs along `turns` quarter
    // turns (odd: north-south). `wallAt`: a wall at z 0 in one more column; `exists`: the Rover's level-data `exists`
    const setup = (roverAt: number[], turns: number, { wallAt, exists }: { wallAt?: number; exists?: number } = {}) => {
        const water: Columns = {};
        const walls: Columns = {};
        for (let j = 0; j < 3; j++) water[j * 8 + 3] = [0];
        for (const j of [0, 2]) for (let i = 0; i < 8; i++) if (i !== 3) walls[j * 8 + i] = [0];
        walls[14] = [0];
        walls[15] = [0];
        if (wallAt !== undefined) walls[wallAt] = [0];

        const rover = [30, ...roverAt, 3];
        if (exists !== undefined) rover.push(exists);

        world({
            width: 8,
            height: 3,
            walls,
            water,
            extra: { oceans: [[1, 0, 0, 0, 0, 8, 3]], movables: [rover], rover_facings: [[30, turns]] },
        });
        const walkGrid = walker(NONE, [], []);
        return cells(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 1, 0)]));
    };
    const SHORES = ['0,1', '1,1', '2,1', '3,1', '4,1', '5,1'];
    test('a Rover pushed into water drives on along its axis: the hero boards it and steps off on the far shore', () => {
        expect(setup([1, 1, 0], 1)).toEqual(['3,0', ...SHORES, '3,2']);
    });
    test('a Rover that runs across the push joins the shores at its own cell only', () => {
        expect(setup([1, 1, 0], 0)).toEqual(SHORES);
    });
    test('a Rover the save left sunk is a ride from the start', () => {
        expect(setup([3, 1, -1], 1)).toEqual(['3,0', ...SHORES, '3,2']);
    });
    test('a track ends at a wall', () => {
        expect(setup([3, 1, -1], 1, { wallAt: 3 })).toEqual([...SHORES, '3,2']);
    });
    test('a Rover that does not exist runs nowhere', () => {
        expect(setup([3, 1, -1], 1, { exists: 0 })).toEqual(['0,1', '1,1', '2,1']);
    });
});

describe('a Lily that does not exist', () => {
    // a row of 4 at z 0: dry 0 and 2, water at 1 (surface 0) with a Lily, a wall at 3
    const setup = (lily: number[]) => {
        world({
            width: 4,
            walls: { 3: [0] },
            water: { 1: [0] },
            extra: { oceans: [[1, 0, 0, 0, 0, 4, 1]], lilies: [lily] },
        });
        const walkGrid = walker(NONE, [], []);
        return columns(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 0)]));
    };
    test('is no floor', () => {
        expect(setup([50, 1, 0, 0])).toEqual([0, 1, 2]);
        expect(setup([50, 1, 0, 0, 1])).toEqual([0, 1, 2]);
        expect(setup([50, 1, 0, 0, 0])).toEqual([0]);
    });
});

describe('a stone landing on a drifting Lily', () => {
    // three rows of 10 at z 0. Row 1: the hero's side 0..2 with a SKIPPABLE Rock at 2, water 3..7 (surface 0), dry
    // land 8..9. Column 6 is a river flowing north through all three rows (wrapping round), with a Lily at (6, 0);
    // rows 0 and 2 are wall elsewhere.
    const setup = (lilies: number[][]) => {
        const water: Columns = {};
        const walls: Columns = {};
        for (let i = 3; i <= 7; i++) water[10 + i] = [0];
        for (const j of [0, 2]) {
            water[j * 10 + 6] = [0];
            for (let i = 0; i < 10; i++) if (i !== 6) walls[j * 10 + i] = [0];
        }
        world({
            width: 10,
            height: 3,
            walls,
            water,
            extra: {
                oceans: [[1, 0, 0, 0, 0, 10, 3]],
                rocks: [[9, 2, 1, 0]],
                skippable: [9],
                lilies,
                rivers: [0, 1, 2].map((j) => [6, j, 0, 2]),
            },
        });
        const walkGrid = walker(NONE, [], []);
        return [
            ...new Set(
                walkGrid.lanes.map(
                    (lane) => `${lane.landing % walkGrid.width},${Math.floor(lane.landing / walkGrid.width) % 3}`,
                ),
            ),
        ];
    };
    test('the stone lands where the Lily drifts across its way, not only at the cell the save left it in', () => {
        expect(setup([[50, 6, 0, 0]])).toEqual(['6,1', '8,1']);
        expect(setup([])).toEqual(['8,1']);
    });
});

describe('a Lily carrying a Monster', () => {
    // three rows of 10 at z 0. Row 1: the hero's side 0..2 with a SKIPPABLE Rock at 2, water 3..6 (surface 0), wall at
    // 7. Column 6 is a river flowing north through all three rows (wrapping round), with a Lily at (6, 0); rows 0 and 2
    // are wall elsewhere, but for the dry cell (5, 0), a line cell from (6, 0).
    const rideCells = (monsters: number[][]) => {
        const water: Columns = {};
        const walls: Columns = { 17: [0] };
        for (let i = 3; i <= 6; i++) water[10 + i] = [0];
        for (const j of [0, 2]) {
            water[j * 10 + 6] = [0];
            for (let i = 0; i < 10; i++) if (i !== 6 && j * 10 + i !== 5) walls[j * 10 + i] = [0];
        }
        world({
            width: 10,
            height: 3,
            walls,
            water,
            extra: {
                oceans: [[1, 0, 0, 0, 0, 10, 3]],
                rocks: [[9, 2, 1, 0]],
                skippable: [9],
                lilies: [[50, 6, 0, 0]],
                rivers: [0, 1, 2].map((j) => [6, j, 0, 2]),
                monsters,
            },
        });
        const walkGrid = walker(NONE, [], []);
        // the stone lands on the Lily at (6, 1) and kicks it east, into the wall, leaving it to the river: on through
        // (6, 2) and round to (6, 0), where the hero on (5, 0) swaps onto the stone
        const landing = walkGrid.cellOf(6, 1, 0);
        const lanes = walkGrid.lanes.filter((lane) => lane.landing === landing);
        return cells(walkGrid, new Set(lanes.flatMap((lane) => lane.ride)));
    };
    test('the Monster rides the Lily, so the Lily drifts on through the cell the Monster stood in', () => {
        // a Monster of kind -2 attacks no cell
        expect(rideCells([[60, 6, 0, 0, -2]])).toEqual(['6,0']);
        expect(rideCells([])).toEqual(['6,0']);
    });
});

describe('Gates that hold the hero up', () => {
    // a row of 7 at z 0: dry 0..2 and 4..5, water at 3 (surface 0) over a Gate at (3, 0, -1), a wall at 6
    const setup = (gate: number[], switches: number[][] = [], more: Rows = {}) => {
        world({
            width: 7,
            walls: { 6: [0] },
            water: { 3: [0] },
            extra: { oceans: [[1, 0, 0, 0, 0, 7, 1]], gates: [[20, 3, 0, -1, ...gate]], switches, ...more },
        });
        const walkGrid = walker(NONE, [], []);
        return columns(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 0)]));
    };
    test('a shut Gate under the water holds the hero at the surface; an open one does not', () => {
        expect(setup([0, 0, 0, 0])).toEqual([0, 1, 2, 3, 4, 5]);
        expect(setup([1, 0, 0, 0])).toEqual([0, 1, 2]);
    });
    test('a notted Gate stays open while its Switch is unpressed, even with the Switch in reach', () => {
        expect(setup([1, 1, 7, 0], [[60, 7, 0, 1, 0, 0]])).toEqual([0, 1, 2]);
    });
    test('a notted Gate whose Switch the save has pressed is shut and holds the hero up', () => {
        expect(setup([1, 1, 7, 0], [[60, 7, 1, 1, 0, 0]])).toEqual([0, 1, 2, 3, 4, 5]);
    });
    test('a notted Gate shuts and holds the hero up once the walk can push a Rock onto its Switch', () => {
        expect(setup([1, 1, 7, 0], [[60, 7, 0, 2, 0, 0]], { rocks: [[30, 1, 0, 0]] })).toEqual([0, 1, 2, 3, 4, 5]);
    });
});

describe('switch presses', () => {
    test('a notted Gate that a press shuts blocks its own cell', () => {
        // two rows of 10 at z 0. Row 0: the hero at 0, a Rock at 1, a flavor-7 Switch at 2, dry 3, a shut flavor-8 Gate
        // at 4, dry 5, an open notted flavor-7 Gate at 6, dry 7..8, a wall at 9. Row 1: dry 0, a Rock at 1, a flavor-8
        // Switch at 2, then wall. One pass presses both flavors, so the hero reaches the notted Gate after it shuts.
        const walls: Columns = {};
        for (let i = 3; i < 10; i++) walls[10 + i] = [0];
        walls[9] = [0];
        world({
            width: 10,
            height: 2,
            walls,
            extra: {
                rocks: [
                    [30, 1, 0, 0],
                    [31, 1, 1, 0],
                ],
                switches: [
                    [60, 7, 0, 2, 0, 0],
                    [62, 8, 0, 2, 1, 0],
                ],
                gates: [
                    [70, 4, 0, 0, 0, 0, 8, 0],
                    [71, 6, 0, 0, 1, 1, 7, 0],
                ],
            },
        });
        const walkGrid = walker(NONE, [], []);
        const row = cells(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 0)])).filter((cell) => cell.endsWith(',0'));
        expect(row).toEqual(['0,0', '1,0', '2,0', '3,0', '4,0', '5,0']);
    });
    test('an object is pushed through a Gate a press has opened', () => {
        // three rows of 11 at z 0. Row 0: the hero at 0, a Rock at 1, a flavor-7 Switch at 2, a Rock at 3, a shut
        // flavor-7 Gate at 4, a flavor-8 Switch at 5, dry 6, a shut flavor-8 Gate at 7, dry 8..9, a wall at 10. Rows 1
        // and 2: dry 0..3, then wall, so the hero can push the second Rock aside and stand in its cell. Opening the
        // flavor-7 Gate lets that Rock be pushed through it onto the flavor-8 Switch.
        const walls: Columns = { 10: [0] };
        for (const j of [1, 2]) for (let i = 4; i < 11; i++) walls[j * 11 + i] = [0];
        world({
            width: 11,
            height: 3,
            walls,
            extra: {
                rocks: [
                    [30, 1, 0, 0],
                    [31, 3, 0, 0],
                ],
                switches: [
                    [60, 7, 0, 2, 0, 0],
                    [62, 8, 0, 5, 0, 0],
                ],
                gates: [
                    [70, 4, 0, 0, 0, 0, 7, 0],
                    [71, 7, 0, 0, 0, 0, 8, 0],
                ],
            },
        });
        const walkGrid = walker(NONE, [], []);
        const row = cells(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 0)])).filter((cell) => cell.endsWith(',0'));
        expect(row).toEqual(['0,0', '1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '7,0', '8,0', '9,0']);
    });
    test('an object that presses the Switch of one flavor presses no other', () => {
        // three rows of 10 at z 0. Row 0: the hero at 0, a Rock at 1, a flavor-7 Switch at 2, a flavor-8 Switch at 3,
        // dry 4, a shut flavor-7 Gate at 5, dry 6, a shut flavor-8 Gate at 7, dry 8, a wall at 9. Rows 1 and 2: dry 0..4,
        // then wall. The Rock reaches either Switch, and the flavor-7 Gate comes first in the latch order, so the Rock
        // rests on the flavor-7 Switch and the flavor-8 Gate stays shut.
        const walls: Columns = { 9: [0] };
        for (const j of [1, 2]) for (let i = 5; i < 10; i++) walls[j * 10 + i] = [0];
        world({
            width: 10,
            height: 3,
            walls,
            extra: {
                rocks: [[30, 1, 0, 0]],
                switches: [
                    [60, 7, 0, 2, 0, 0],
                    [62, 8, 0, 3, 0, 0],
                ],
                gates: [
                    [70, 5, 0, 0, 0, 0, 7, 0],
                    [71, 7, 0, 0, 0, 0, 8, 0],
                ],
            },
        });
        const walkGrid = walker(NONE, [], []);
        const row = cells(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 0)])).filter((cell) => cell.endsWith(',0'));
        expect(row).toEqual(['0,0', '1,0', '2,0', '3,0', '4,0', '5,0', '6,0']);
    });
});

describe('a skipping stone onto a Switch', () => {
    // three rows of 10 at z 0. Row 0: the hero at 0, a Rock at 1, dry 2, water 3..5 (surface 0), an islet 6 with a
    // Switch, a shut Gate of its flavor at 7, dry 8, a wall at 9. Row 1: dry 0..6, the hero's way round to the Switch,
    // then wall. Row 2: wall.
    const setup = (skippable: number[], more: Rows = {}, wet = [3, 4, 5]) => {
        const water: Columns = {};
        const walls: Columns = { 9: [0] };
        for (const i of wet) water[i] = [0];
        for (let i = 7; i < 10; i++) walls[10 + i] = [0];
        for (let i = 0; i < 10; i++) walls[20 + i] = [0];
        world({
            width: 10,
            height: 3,
            walls,
            water,
            extra: {
                oceans: [[1, 0, 0, 0, 0, 10, 1]],
                rocks: [[9, 1, 0, 0]],
                skippable,
                switches: [[60, 7, 0, 6, 0, 0]],
                gates: [[61, 7, 0, 0, 0, 0, 7, 0]],
                ...more,
            },
        });
        const walkGrid = walker(NONE, [], []);
        return cells(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 0)])).filter((cell) => cell.endsWith(',0'));
    };
    test('a stone pushed into the water skips onto the Switch and opens its gates', () => {
        expect(setup([9])).toEqual(['0,0', '1,0', '2,0', '6,0', '7,0', '8,0']);
    });
    test('a plain Rock sinks, and the hero alone on the Switch keeps them shut', () => {
        expect(setup([])).toEqual(['0,0', '1,0', '2,0', '6,0']);
    });
    test('the stone stops on a Lily in its way, but skips on over a drifting one', () => {
        const lilies = [[50, 4, 0, 0]];
        expect(setup([9], { lilies })).toEqual(['0,0', '1,0', '2,0', '4,0', '6,0']);
        const rivers = [[4, 0, 0, 2]];
        expect(setup([9], { lilies, rivers })).toEqual(['0,0', '1,0', '2,0', '4,0', '6,0', '7,0', '8,0']);
    });
    test('a Lily that does not exist stops no stone', () => {
        expect(setup([9], { lilies: [[50, 4, 0, 0, 0]] })).toEqual(['0,0', '1,0', '2,0', '6,0', '7,0', '8,0']);
    });
    test('a stone pushed onto a drifting Lily is launched from it', () => {
        // dry 3, the Lily at 4 and water at 5 only
        const more = { lilies: [[50, 4, 0, 0]], rivers: [[4, 0, 0, 2]] };
        expect(setup([9], more, [4, 5])).toEqual(['0,0', '1,0', '2,0', '3,0', '4,0', '6,0', '7,0', '8,0']);
    });
});

describe('a skipping stone that sinks in place', () => {
    // row 0: the hero at 0, the stone at 1, dry 2, water from 3 on and a wall after the water. Row 1 is wall but for a
    // dry cell under the last water cell, which only a bridge there reaches. Row 2 is wall.
    const setup = (waterEnd: number, skippable: number[], more: Rows = {}) => {
        const water: Columns = {};
        const walls: Columns = {};
        for (let i = 3; i <= waterEnd; i++) water[i] = [0];
        for (let i = waterEnd + 1; i < 8; i++) walls[i] = [0];
        for (let i = 0; i < 8; i++) {
            if (i !== waterEnd) walls[8 + i] = [0];
            walls[16 + i] = [0];
        }
        world({
            width: 8,
            height: 3,
            walls,
            water,
            extra: { oceans: [[1, 0, 0, 0, 0, 8, 1]], rocks: [[9, 1, 0, 0]], skippable, ...more },
        });
        const walkGrid = walker(NONE, [], []);
        return cells(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 0, 0)]));
    };
    test('the hero pushes it on from the cell it started in, and it sinks against the wall in the last water cell', () => {
        expect(setup(3, [9])).toEqual(['0,0', '1,0', '2,0', '3,0', '3,1']);
    });
    test('a stone that sinks far from the shore joins no ground the hero reaches', () => {
        expect(setup(5, [9])).toEqual(['0,0', '1,0', '2,0']);
    });
    test('a plain Rock sinks in the first water cell instead, where it joins nothing', () => {
        expect(setup(5, [])).toEqual(['0,0', '1,0', '2,0']);
    });
});

describe('a magic-mirror hop onto a sunk skipping stone', () => {
    // 10 x 5 at z 0 (# wall, ~ water, M the flat magic Mirror with its arms west and north). The hero starts at (0, 1)
    // and pushes the stone at (1, 1) east: it skips over (3..6, 1) and sinks in (6, 1) against the wall. Only a hop
    // reaches that cell: from (3, 4), three cells out on the Mirror's west arm, the hero lands three cells up its north
    // arm. The dry cell (6, 0) beyond it joins no other ground.
    const MAP = ['######.###', '...~~~~###', '...###~###', '......~###', '..#...M###', '##########'];
    const setup = (skippable: number[]) => {
        const water: Columns = {};
        const walls: Columns = {};
        MAP.forEach((row, j) => {
            [...row].forEach((tile, i) => {
                if (tile === '~') water[i + j * 10] = [0];
                if (tile === '#') walls[i + j * 10] = [0];
            });
        });
        world({
            width: 10,
            height: 6,
            walls,
            water,
            extra: {
                oceans: [[1, 0, 0, 0, 0, 10, 1]],
                rocks: [[9, 1, 1, 0]],
                skippable,
                magic_mirrors: [[5, 6, 4, 0, -1, 0, 0, -1, 0, 0]],
            },
        });
        const walkGrid = walker(NONE, [], []);
        return cells(walkGrid, walkGrid.flood([walkGrid.cellOf(0, 1, 0)]));
    };
    test('the hop lands on the sunk stone, which joins the dry cell beyond it', () => {
        expect(setup([9])).toContain('6,1');
        expect(setup([9])).toContain('6,0');
    });
    test('a plain Rock sinks short of the cell, so the hop lands in water', () => {
        expect(setup([])).not.toContain('6,1');
    });
});

describe('unlock plans through cycles', () => {
    // level 0 playable; level 1 behind gate 0 (needs level 2) or gate 1 (needs level 0); level 2 behind gate 2 (needs
    // level 1): planning level 2 runs into itself through gate 0 and takes gate 1
    const setup = (): BaseProgress => {
        Object.assign(PROG, {
            levels: [0, 1, 2].map((i) => ({ n: 'l' + i, req: [], p: [0, 0, 0] })),
            freezers: [[2], [0], [1]].map((req) => ({ req, signs: [] })),
            signs: [],
        });
        const blockedWhy = (): WhyBlocked => ({ gates: [], pad: [], via: [], viaTowers: [], mech: [] });
        return {
            state: ['unlocked', 'blocked', 'blocked'],
            unlocks: [{ levels: [] }, { levels: [] }, { levels: [] }],
            wayIn: [[], [0, 1], [2]],
            wayInChains: [null, null, null],
            wayInFixed: new Set(),
            why: [null, blockedWhy(), blockedWhy()],
            behind: [[], [0, 1], [2]],
            access: [null, null, null],
            signAccess: [],
            signWayIn: [],
            ice: [],
            reach: null,
            lt: null,
            solved: 0,
            gateOpen: [false, false, false],
            tst: [],
            goldFound: 0,
            towers: [],
            signOk: () => true,
            signRead: () => true,
            rockSmashed: () => false,
        };
    };
    test('a plan does not run through the key it is the plan of', () => {
        const progress = setup();
        expect([...unlockPlan(progress, ['level', 1])!.nodes.keys()]).toEqual(['l0', 'g1', 'l1']);
        expect([...unlockPlan(progress, ['level', 2])!.nodes.keys()]).toEqual(['l0', 'g1', 'l1', 'g2', 'l2']);
        expect([...unlockPlan(progress, ['gate', 0])!.nodes.keys()]).toEqual(['l0', 'g1', 'l1', 'g2', 'l2', 'g0']);
    });
});
