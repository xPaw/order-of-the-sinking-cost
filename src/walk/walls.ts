// The Wall_Sets, the entities that stand in cells and the Fences of a walker's grid (viewer.md "Cells")
import { latestF32, rawU16 } from '../save.ts';
import type { Creation } from '../save.ts';
import type { CellRow } from '../types.ts';
import { BEAMSTOP, cellOf, FLOOR, LINE_STOP, mod, MOVABLE, ROCK, SOLID, SUPPORT } from './cells.ts';
import { place, put } from './groups.ts';
import type { WalkGrid } from './walker.ts';

// Rock.properties
const MIRRORABLE = 1;

// the world.json movables kind of a Mirror
const MIRROR_KIND = 2;

// the movables kind placeEntity takes for what is not a movable
const NOT_MOVABLE = -1;

// the world.json mirror_facings shapes (1 is a vertical Mirror): at theta_target 0 a flat Mirror is open on its west
// and south sides, a vertical one on its east side, a vertical_downward one on its west side
const FLAT_MIRROR = 0;
const VERTICAL_DOWN_MIRROR = 2;

// every side of a Mirror
const EVERY_SIDE = 15;

/** A Mirror's level-data facing: theta_target in quarter turns, and its shape. */
export type MirrorFacing = [quarterTurns: number, shape: number];

/** The cell an entity stands in where the save last left it, else at its level-data column, row and z. */
export function latestCell(walkGrid: WalkGrid, pid: number, column: number, row: number, z: number): number {
    const latest = walkGrid.latest;
    const x = latestF32(latest, pid, 'base.position.x', column + walkGrid.cornerX);
    const y = latestF32(latest, pid, 'base.position.y', row + walkGrid.cornerY);
    const latestZ = latestF32(latest, pid, 'base.position.z', z);
    return cellOf(walkGrid, x, y, latestZ);
}

/** Places the Wall_Sets' walls, each set while it exists (place()); the static solid voxels are in the grid already. */
export function placeWallSets(walkGrid: WalkGrid): void {
    const grid = walkGrid.grid;

    for (const wallSet of walkGrid.geometry.wallSets) {
        place(walkGrid, wallSet.pid, wallSet.existence, () => {
            for (const cell of wallSet.cells) put(walkGrid, grid, cell, SOLID | SUPPORT);
        });
    }
}

/** Notes a TELEPORT line target at `cell`: anything the hero swaps with but a Mirror. */
export function noteTarget(walkGrid: WalkGrid, cell: number): void {
    walkGrid.swapTargets.add(cell);
    walkGrid.cellFlags[cell] |= LINE_STOP;
}

/** Notes the Mirror at `cell` with the sides a TELEPORT line meets it on and turns at. */
function noteMirror(walkGrid: WalkGrid, cell: number, openSides: number): void {
    walkGrid.mirrorSides.set(cell, openSides);
    walkGrid.cellFlags[cell] |= LINE_STOP;
}

/** Whether a Mirror with this facing is flat; one with no facing is taken to be flat. */
function isFlatMirror(facing: MirrorFacing | undefined): boolean {
    return !facing || facing[1] === FLAT_MIRROR;
}

/**
 * The sides a horizontal line meets the Mirror `pid` on and turns at, one bit per side: a flat Mirror is open on two
 * sides, a vertical one on one. `theta_target` is the save's latest, else the level data's `facing`. A Mirror with no
 * facing is open on every side.
 */
function openSidesOf(walkGrid: WalkGrid, pid: number, facing: MirrorFacing | undefined): number {
    if (!facing) return EVERY_SIDE;
    const [dataQuarterTurns, shape] = facing;

    let quarterTurns = dataQuarterTurns;
    const theta = latestF32(walkGrid.latest, pid, 'base.theta_target');
    if (theta !== undefined) quarterTurns = Math.round(theta / 90);

    if (shape === FLAT_MIRROR) {
        const westSide = mod(2 + quarterTurns, 4);
        const southSide = mod(3 + quarterTurns, 4);
        return (1 << westSide) | (1 << southSide);
    }

    if (shape === VERTICAL_DOWN_MIRROR) return 1 << mod(2 + quarterTurns, 4);
    return 1 << mod(quarterTurns, 4);
}

/**
 * The beam bits of a Rock or movable: a beam passes a Rock whose latest `properties` (else its level-data ones) hold
 * MIRRORABLE, and a mirrorable Rover.
 */
function beamBits(walkGrid: WalkGrid, pid: number, mirrorable: Set<number>): number {
    const properties = walkGrid.latest.get(pid, 'properties');

    let passes = false;
    if (properties) {
        passes = (rawU16(properties) & MIRRORABLE) !== 0;
    } else {
        passes = mirrorable.has(pid);
    }

    if (passes) return 0;
    return BEAMSTOP;
}

/** The bits of an entity the save created: a Rock (a TRANSMUTE crystal) not in the level data, or a Tree. */
function createdBits(
    walkGrid: WalkGrid,
    pid: number,
    created: Creation,
    knownRocks: Set<number>,
    mirrorable: Set<number>,
): number {
    if (created.destroyed) return 0;
    if (created.type === 'Rock' && !knownRocks.has(pid)) return SUPPORT | ROCK | beamBits(walkGrid, pid, mirrorable);
    if (created.type === 'Tree') return SOLID | SUPPORT | BEAMSTOP;
    return 0;
}

/**
 * Places the entities that stand in cells. Rocks and movables stand where the save last left them, the others at
 * their level-data cell. Rocks hold up what stands on them; Trees (while they exist: TRANSMUTE turns one into a
 * crystal Rock), Signs, Treasure_Displays and Judges cannot be pushed: they block the hero, hold up what stands on
 * them and stop beams. Returns the Rocks still at their level-data cell.
 */
export function placeEntities(walkGrid: WalkGrid): Set<number> {
    const { world, geometry, grid } = walkGrid;
    const { knownRocks, mirrorable, mirrorFacings } = geometry;
    const unmoved = new Set<number>();

    // `levelCell`: the entity's cell in the level data
    const placeEntity = (
        entity: CellRow,
        levelCell: number,
        atLatestCell: boolean,
        bits: number,
        movableKind: number,
    ): void => {
        const [pid, column, row, z, existence] = entity;
        const cell = atLatestCell ? latestCell(walkGrid, pid, column, row, z) : levelCell;
        if (cell < 0) return;

        let cellBits = bits;
        if (bits & (ROCK | MOVABLE)) cellBits = bits | beamBits(walkGrid, pid, mirrorable);

        place(walkGrid, pid, existence, () => {
            put(walkGrid, grid, cell, cellBits);
            if (movableKind === MIRROR_KIND && isFlatMirror(mirrorFacings.get(pid))) walkGrid.flatMirrors.add(cell);
            if (walkGrid.writeLog) return;

            if (bits & ROCK) {
                if (cell === levelCell) unmoved.add(pid);
                noteTarget(walkGrid, cell);
                walkGrid.rocks.push({ pid, cell });
            }

            if (bits & MOVABLE) {
                if (movableKind === MIRROR_KIND) {
                    noteMirror(walkGrid, cell, openSidesOf(walkGrid, pid, mirrorFacings.get(pid)));
                } else {
                    noteTarget(walkGrid, cell);
                }
            }
        });
    };

    world.rocks.forEach((rock, index) => {
        placeEntity(rock, geometry.rockCells[index], true, SUPPORT | ROCK, NOT_MOVABLE);
    });

    world.floors.forEach((floor, index) => {
        placeEntity(floor, geometry.floorCells[index], false, FLOOR, NOT_MOVABLE);
    });

    (world.trees || []).forEach((tree, index) => {
        placeEntity(tree, geometry.treeCells[index], false, SOLID | SUPPORT | BEAMSTOP, NOT_MOVABLE);
    });

    (world.blockers || []).forEach((blocker, index) => {
        placeEntity(blocker, geometry.blockerCells[index], false, SOLID | SUPPORT | BEAMSTOP, NOT_MOVABLE);
    });

    (world.movables || []).forEach(([pid, column, row, z, kind, existence], index) => {
        const movable: CellRow = [pid, column, row, z, existence];
        placeEntity(movable, geometry.movableCells[index], true, MOVABLE, kind);
    });

    // the Rocks (TRANSMUTE crystals) and Trees the save created, where it last left them
    for (const [pid, created] of walkGrid.latest.created) {
        const bits = createdBits(walkGrid, pid, created, knownRocks, mirrorable);
        if (!bits) continue;

        const cell = latestCell(walkGrid, pid, 0, 0, 0);
        if (cell < 0) continue;

        grid[cell] |= bits;

        if (bits & ROCK) {
            noteTarget(walkGrid, cell);
            walkGrid.rocks.push({ pid, cell });
        }
    }

    return unmoved;
}

/** Places the blocking Fences: one bit per fenced side of a cell in `cellFlags`. */
export function placeFences(walkGrid: WalkGrid): void {
    const { world, geometry } = walkGrid;

    world.fences.forEach(([pid, , , , side, existence], index) => {
        const cell = geometry.fenceCells[index];
        if (cell < 0) return;
        place(walkGrid, pid, existence, () => put(walkGrid, walkGrid.cellFlags, cell, 1 << side));
    });
}

/** Whether a Fence stands on side `side` of `cell`, or on the facing side of its neighbour that way. */
export function fenced(walkGrid: WalkGrid, cell: number, side: number, neighbour: number): boolean {
    const cellFlags = walkGrid.cellFlags;
    if ((cellFlags[cell] >> side) & 1) return true;
    const facingSide = (side + 2) % 4;
    return ((cellFlags[neighbour] >> facingSide) & 1) !== 0;
}
