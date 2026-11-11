// The level-data part of the walk: everything a walker's grid takes from data/progress.json and data/world.json alone,
// which no save changes (viewer.md "The walk model (viewer)")
import { PROG } from '../data.ts';
import type { ExistenceGroup, Freezer, SpawnRow, Teleporter, World } from '../types.ts';
import { WORLD, WORLD_FILE } from '../world-data.ts';
import type { WorldCells } from '../world-data.ts';
import { roomOf } from './beams.ts';
import { BEAMSTOP, cellOf, keyOf, mod, sideColumnsOf, SOLID, SUPPORT, Z_BIAS } from './cells.ts';
import type { GridDimensions, GridShape } from './cells.ts';
import { levelElevators } from './elevator.ts';
import type { ElevatorFrames } from './elevator.ts';
import { levelWaterColumns, oceanIndexOfPid } from './ocean.ts';
import type { LayerSource } from './ocean.ts';
import { levelWardrobes } from './skills.ts';
import type { WardrobeCell } from './skills.ts';
import { levelTwins, reveals } from './teleporters.ts';
import type { MirrorFacing } from './walls.ts';

/** A Wall_Set's pid and level-data `exists`, and the cell of each of its voxels. */
export interface WallSet {
    pid: number;
    existence: number | undefined;
    cells: Int32Array;
}

/**
 * A way to push a Rock or a Gem into water, in the level data: its pid, the hero's push cell and the water cell.
 */
export interface BridgeCells {
    pid: number;
    pushCell: number;
    waterCell: number;
}

/** A Spawner in the level data: the pid of the Lily or Rock it respawns and the cells of the Spawner and its Activators. */
export interface SpawnCells {
    spawnedPid: number;
    spawnerPid: number;
    spawnerCell: number;
    spawnerExistence: number | undefined;
    activators: Array<{ pid: number; cell: number; existence: number | undefined }>;
}

/** What the level data holds, as the geometry is built from it: the world, its cells, the pads and the Freezers. */
export interface LevelSource {
    world: World;
    teleporters: Teleporter[];
    freezers: Freezer[];
}

/**
 * Everything of a walker's grid that depends on the level data alone: the dimensions and the fast-travel box, the
 * static voxels, and the cells of each list of entities (a cell is -1 where the entity lies outside the z range), in
 * list order. A save decides which entities exist and where the movable ones stand; the walker reads this and never
 * changes it. Plain data (numbers, strings, arrays, typed arrays, and Maps and Sets of those), so it can be stored.
 * The per-list cell arrays are parallel to the `world` lists of the same name.
 */
export interface LevelGeometry extends GridShape, LayerSource {
    worldCells: WorldCells;
    teleporters: Teleporter[];
    // the cells of the grid: layerCount * layerCells
    volume: number;
    // the existence Groups, and per member pid its Group
    existenceGroups: ExistenceGroup[];
    groupOfMember: Map<number, number>;
    // per pad pid its index, per pad its cell and the world pads that reaching it reveals (ascending), and per world
    // pad the map-room pads that target it
    teleporterIndexOf: Map<number, number>;
    padCells: Int32Array;
    reveals: number[][];
    twinsOf: Map<number, number[]>;
    // per Freezer its cell, and per Freezer pid its index
    freezerCells: Int32Array;
    freezerIndexOf: Map<number, number>;
    // per cell of the grid: SOLID | SUPPORT for a static solid voxel, BEAMSTOP for a level-data beam stop
    solidGrid: Uint8Array;
    wallSets: WallSet[];
    // the pids of the Rocks of the level data, of the MIRRORABLE Rocks and mirrorable Rovers, and per Mirror its facing
    knownRocks: Set<number>;
    mirrorable: Set<number>;
    mirrorFacings: Map<number, MirrorFacing>;
    // per Rover its level-data theta_target in quarter turns
    roverFacings: Map<number, number>;
    rockCells: Int32Array;
    floorCells: Int32Array;
    treeCells: Int32Array;
    blockerCells: Int32Array;
    movableCells: Int32Array;
    fenceCells: Int32Array;
    switchCells: Int32Array;
    gateCells: Int32Array;
    lilySpawns: SpawnCells[];
    rockSpawns: SpawnCells[];
    bridges: BridgeCells[];
    elevators: ElevatorFrames[];
    wardrobes: WardrobeCell[];
    // per Gem_Slot its cell and its room ('' where the cell is -1)
    gemSlotCells: Int32Array;
    gemSlotRooms: string[];
    // water: per column the indices of the Ocean_Maps with water there, and per Ocean_Map pid its index
    waterColumns: Array<number[] | undefined>;
    oceanIndexOf: Map<number, number>;
    // per river cell, the side its current flows to
    flowSide: Map<number, number>;
}

/** The cells of the rows of a list of entities, which start with pid, column, row and z. */
function cellsOfRows(shape: GridShape, rows: ReadonlyArray<readonly [number, number, number, number, ...unknown[]]>) {
    const cells = new Int32Array(rows.length);

    rows.forEach(([, column, row, z], index) => {
        cells[index] = keyOf(shape, column, row, z);
    });

    return cells;
}

/** The grid's dimensions and fast-travel box. */
function gridShapeOf(world: World): GridShape {
    const gridData = world.grid;
    const [cornerX, cornerY] = gridData.corner;
    const [width, height] = gridData.size;
    const layerCells = width * height;
    const zOffset = gridData.zoff;
    const layerCount = 256 - zOffset + Z_BIAS + 2;

    let boxZ = Infinity;
    let boxWidth = width;
    let boxHeight = height;
    let boxColumn = 0;
    let boxRow = 0;
    const fastTravel = gridData.ft;

    if (fastTravel) {
        boxZ = fastTravel.z;
        [boxWidth, boxHeight] = fastTravel.size;
        boxColumn = mod(fastTravel.corner[0] - cornerX, width);
        boxRow = mod(fastTravel.corner[1] - cornerY, height);
    }

    const dimensions: GridDimensions = {
        cornerX,
        cornerY,
        width,
        height,
        layerCells,
        zOffset,
        layerCount,
        boxZ,
        boxWidth,
        boxHeight,
        boxColumn,
        boxRow,
    };

    return { ...dimensions, sideColumns: sideColumnsOf(dimensions) };
}

/** The static solid voxels, and the level data's beam stops, per cell of the grid. */
function solidGridOf(shape: GridShape, world: World, worldCells: WorldCells, volume: number): Uint8Array {
    const { layerCells, zOffset } = shape;
    const solidGrid = new Uint8Array(volume);
    const solid = worldCells.solid;

    // per column: a count, then that many z bytes
    let offset = 0;

    for (let column = 0; column < layerCells; column++) {
        for (let count = solid[offset++]; count > 0; count--) {
            const zByte = solid[offset++];
            solidGrid[(zByte - zOffset + Z_BIAS) * layerCells + column] = SOLID | SUPPORT;
        }
    }

    for (const [i, j, z] of world.beam_stops || []) {
        const cell = keyOf(shape, i, j, z);
        if (cell >= 0) solidGrid[cell] |= BEAMSTOP;
    }

    return solidGrid;
}

/** The Wall_Sets, each with the cells of its voxels. */
function wallSetsOf(shape: GridShape, world: World, worldCells: WorldCells): WallSet[] {
    const { layerCells, zOffset, width } = shape;
    const groupCells = worldCells.groups;
    const wallSets: WallSet[] = [];

    // per Wall_Set in list order, its cells as (column, row, z byte) triplets
    let offset = 0;

    for (const group of world.groups) {
        const cells = new Int32Array(group.n);

        for (let member = 0; member < group.n; member++) {
            const column = groupCells[offset];
            const row = groupCells[offset + 1];
            const zByte = groupCells[offset + 2];
            cells[member] = (zByte - zOffset + Z_BIAS) * layerCells + row * width + column;
            offset += 3;
        }

        wallSets.push({ pid: group.pid, existence: group.exists, cells });
    }

    return wallSets;
}

/** The Spawners of `rows`, with their cells and those of the Activators that run them. */
function spawnsOf(shape: GridShape, rows: SpawnRow[]): SpawnCells[] {
    const spawns: SpawnCells[] = [];

    for (const [spawnerPid, i, j, z, spawnedPid, activators, spawnerExistence] of rows) {
        spawns.push({
            spawnedPid,
            spawnerPid,
            spawnerCell: keyOf(shape, i, j, z),
            spawnerExistence,
            activators: activators.map(([pid, activatorI, activatorJ, activatorZ, existence]) => ({
                pid,
                cell: keyOf(shape, activatorI, activatorJ, activatorZ),
                existence,
            })),
        });
    }

    return spawns;
}

/** The ways to push each Rock into water, with their cells. */
function bridgesOf(shape: GridShape, world: World): BridgeCells[] {
    const bridges: BridgeCells[] = [];

    for (const [pid, pushI, pushJ, pushZ, waterI, waterJ, waterZ] of world.bridges || []) {
        const pushCell = keyOf(shape, pushI, pushJ, pushZ);
        const waterCell = keyOf(shape, waterI, waterJ, waterZ);
        bridges.push({ pid, pushCell, waterCell });
    }

    return bridges;
}

/** The side each river cell's current flows to. */
function flowSideOf(shape: GridShape, world: World): Map<number, number> {
    const flowSide = new Map<number, number>();

    for (const [i, j, z, direction] of world.rivers || []) {
        // a Direction (1 E, 2 N, 3 W, 4 S) as a side
        flowSide.set(keyOf(shape, i, j, z), direction - 1);
    }

    return flowSide;
}

/** Per Gem_Slot, its cell and its room. */
function gemSlotsOf(shape: GridShape & LayerSource, world: World): { cells: Int32Array; rooms: string[] } {
    const slots = world.gem_slots || [];
    const cells = new Int32Array(slots.length);
    const rooms: string[] = [];

    slots.forEach(([, i, j, z], index) => {
        const cell = keyOf(shape, i, j, z);
        cells[index] = cell;

        if (cell < 0) {
            rooms.push('');
        } else {
            rooms.push(roomOf(shape, cell));
        }
    });

    return { cells, rooms };
}

/** The geometry of the level data: what the walker builds before a save says what exists and where things stand. */
export function buildLevelGeometry(source: LevelSource, worldCells: WorldCells): LevelGeometry {
    const world = source.world;
    const shape = gridShapeOf(world);
    const volume = shape.layerCount * shape.layerCells;
    const layered = { ...shape, world };

    const existenceGroups = world.egroups || [];
    const groupOfMember = new Map<number, number>();

    existenceGroups.forEach(([, , , , members], groupIndex) => {
        for (const pid of members) groupOfMember.set(pid, groupIndex);
    });

    const teleporters = source.teleporters;
    const teleporterIndexOf = new Map<number, number>();

    teleporters.forEach((teleporter, padIndex) => {
        teleporterIndexOf.set(teleporter.pid, padIndex);
    });

    const padCells = new Int32Array(teleporters.length);

    teleporters.forEach((teleporter, padIndex) => {
        padCells[padIndex] = cellOf(shape, ...teleporter.p);
    });

    const freezerCells = new Int32Array(source.freezers.length);
    const freezerIndexOf = new Map<number, number>();

    source.freezers.forEach((freezer, freezerIndex) => {
        freezerCells[freezerIndex] = cellOf(shape, ...freezer.p);
        freezerIndexOf.set(freezer.pid, freezerIndex);
    });

    const mirrorFacings = new Map<number, MirrorFacing>();

    for (const [pid, quarterTurns, mirrorShape] of world.mirror_facings || []) {
        mirrorFacings.set(pid, [quarterTurns, mirrorShape]);
    }

    const roverFacings = new Map<number, number>(world.rover_facings || []);

    const switchCells = new Int32Array(world.switches.length);

    world.switches.forEach(([, , , column, row, z], index) => {
        switchCells[index] = keyOf(shape, column, row, z);
    });

    const gemSlots = gemSlotsOf(layered, world);

    return {
        ...shape,
        world,
        worldCells,
        teleporters,
        volume,
        existenceGroups,
        groupOfMember,
        teleporterIndexOf,
        padCells,
        reveals: reveals(teleporters),
        twinsOf: levelTwins(teleporters, teleporterIndexOf),
        freezerCells,
        freezerIndexOf,
        solidGrid: solidGridOf(shape, world, worldCells, volume),
        wallSets: wallSetsOf(shape, world, worldCells),
        knownRocks: new Set(world.rocks.map(([pid]) => pid)),
        mirrorable: new Set(world.mirrorable || []),
        mirrorFacings,
        roverFacings,
        rockCells: cellsOfRows(shape, world.rocks),
        floorCells: cellsOfRows(shape, world.floors),
        treeCells: cellsOfRows(shape, world.trees || []),
        blockerCells: cellsOfRows(shape, world.blockers || []),
        movableCells: cellsOfRows(shape, world.movables || []),
        fenceCells: cellsOfRows(shape, world.fences),
        switchCells,
        gateCells: cellsOfRows(shape, world.gates),
        lilySpawns: spawnsOf(shape, world.lily_spawns || []),
        rockSpawns: spawnsOf(shape, world.rock_spawns || []),
        bridges: bridgesOf(shape, world),
        elevators: levelElevators(shape, world),
        wardrobes: levelWardrobes(shape, world),
        gemSlotCells: gemSlots.cells,
        gemSlotRooms: gemSlots.rooms,
        waterColumns: levelWaterColumns(shape, world, worldCells),
        oceanIndexOf: oceanIndexOfPid(world),
        flowSide: flowSideOf(shape, world),
    };
}

// the level data the built geometry came from, compared by identity: a page has one overworld, so the geometry is
// built once; a program that swaps the data (the tests do) gets a new one
let builtFrom: unknown[] = [];
let built: LevelGeometry | null = null;

/** Whether the level data at hand is the data `builtFrom` holds. */
function sameLevelData(current: unknown[]): boolean {
    if (current.length !== builtFrom.length) return false;

    for (let index = 0; index < current.length; index++) {
        if (current[index] !== builtFrom[index]) return false;
    }

    return true;
}

/** The geometry of the page's level data, built on first use. Needs the world cells (wait for `worldReady`). */
export function levelGeometry(): LevelGeometry {
    if (!WORLD) throw new Error('levelGeometry() needs the world cells: wait for worldReady');

    const source: LevelSource = {
        world: WORLD_FILE.world,
        teleporters: WORLD_FILE.teleporters,
        freezers: PROG.freezers,
    };
    const current = [source.world, WORLD.solid, WORLD.groups, WORLD.water, source.teleporters, source.freezers];
    if (built && sameLevelData(current)) return built;

    built = buildLevelGeometry(source, WORLD);
    builtFrom = current;
    return built;
}
