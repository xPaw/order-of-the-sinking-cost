// What blocks the hero and what holds the hero up while a flood runs (MOVEMENT.md "Support", "Falling", VIEWER.md
// "Support and open cells")
import {
    BEAM,
    BRIDGE_MARK,
    DRIFT_MARK,
    FIRE,
    FLOOR,
    FROZEN_MARK,
    GATE,
    KICK_MARK,
    MONSTER,
    MOVABLE,
    OPTION_MARK,
    POWER_MARK,
    RIDE_MARK,
    SOLID,
    SUPPORT,
    THRU,
    Z_BIAS,
} from './cells.ts';
import type { FloodState } from './flood.ts';
import { deep, layerOf, waterAt } from './ocean.ts';
import type { WalkGrid } from './walker.ts';

/**
 * Whether a hero position is inside a wall that no beam runs through. Such a position seeds no walk: the save stores
 * the cell the hero stood in, so it is neither lifted on top of the wall nor dropped below it.
 */
export function insideWall(walkGrid: WalkGrid, cell: number): boolean {
    if (cell < 0) return false;
    return (walkGrid.grid[cell] & SOLID) !== 0 && !(walkGrid.cellFlags[cell] & THRU);
}

/**
 * Whether a Gate's cell is shut while a flood runs: a shut Gate the flood has not opened, or an open notted Gate that
 * a switch press has shut.
 */
export function gateShutNow(walkGrid: WalkGrid, floodState: FloodState, cell: number): boolean {
    const latchedShut = floodState.latchedShut;
    if (latchedShut.size && latchedShut.has(cell)) return true;
    if ((walkGrid.grid[cell] & (GATE | SOLID)) !== GATE) return false;
    return !floodState.opened.has(cell) && !floodState.unlatched.has(cell);
}

/** What the hero cannot enter: a closed Freezer, a solid voxel outside a THROUGH beam, a shut Gate. */
export function blocked(walkGrid: WalkGrid, floodState: FloodState, cell: number): boolean {
    if (walkGrid.marks[cell] & FROZEN_MARK) return true;
    if (walkGrid.grid[cell] & SOLID) return !(walkGrid.cellFlags[cell] & THRU);
    return gateShutNow(walkGrid, floodState, cell);
}

/**
 * What a mover in `from` cannot enter: what blocks the hero, and a THROUGH beam's wall cell unless the mover stands in
 * the beam.
 */
export function blockedFrom(walkGrid: WalkGrid, floodState: FloodState, from: number, cell: number): boolean {
    if (blocked(walkGrid, floodState, cell)) return true;
    return (walkGrid.cellFlags[cell] & THRU) !== 0 && !(walkGrid.cellFlags[from] & BEAM);
}

/** What a magic-mirror hop cannot land in: what blocks the hero, and any solid voxel, in a THROUGH beam too. */
export function hopBlocked(walkGrid: WalkGrid, floodState: FloodState, cell: number): boolean {
    return (walkGrid.grid[cell] & SOLID) !== 0 || blocked(walkGrid, floodState, cell);
}

/** Whether a Gate's cell is open while a flood runs because the flood opened it. */
function gateOpenedNow(walkGrid: WalkGrid, floodState: FloodState, cell: number): boolean {
    if ((walkGrid.grid[cell] & (GATE | SOLID)) !== GATE) return false;
    return floodState.opened.has(cell) || floodState.unlatched.has(cell);
}

/**
 * Whether a living Monster or a movable in `cell` holds up what stands above it: a Monster the flood has not got rid
 * of, a Gem, a Promesst_Light, a Rover, a Friendly_Dragon or a vertical Mirror. A flat Mirror holds nothing.
 */
function heldByEntity(walkGrid: WalkGrid, floodState: FloodState, cell: number): boolean {
    const bits = walkGrid.grid[cell];

    if (bits & MONSTER) {
        const monsterIndex = walkGrid.triggers.monsterGates.monsterAt.get(cell);
        return monsterIndex === undefined || !floodState.monsterGone[monsterIndex];
    }

    if (bits & MOVABLE) return !walkGrid.flatMirrors.has(cell);
    return false;
}

/**
 * Whether the cell below `cell` holds up what stands in it while a flood runs; a closed Freezer does, unless the flood
 * walks no Freezer tops.
 */
export function heldFromBelow(walkGrid: WalkGrid, floodState: FloodState, cell: number): boolean {
    const layerCells = walkGrid.layerCells;
    if (cell < layerCells) return false;

    const below = cell - layerCells;
    if (walkGrid.marks[below] & FROZEN_MARK && floodState.frozenHolds) return true;
    if (floodState.latchedShut.size && floodState.latchedShut.has(below)) return true;
    if ((walkGrid.grid[below] & SUPPORT) !== 0 && !gateOpenedNow(walkGrid, floodState, below)) return true;
    return heldByEntity(walkGrid, floodState, below);
}

/**
 * Whether the hero is held up in `cell`: by a solid voxel in the cell itself (entered only along a THROUGH beam; the
 * game holds an entity inside a wall), a lily or floor in the cell (a Lily on a river at every cell of its drift: the
 * hero boards it as it passes and rides it), solid, a rock, a living Monster or a movable below, a DOUBLE beam over
 * water (the hero stands on the surface), a rock bridge's water cell once its Rock sank (in a pocket flood always), a
 * cell a kicked Lily drifts through once the flood has reached the launch of the stone that kicks it, a cell over the
 * track of a Rover under water (always for one the save left there, else once the flood has sunk it), else the
 * implicit ground floor (z <= 0, z < 0 in water). The walker sets the cells' `marks` once the beams and the drift are
 * placed, before the first call.
 */
function supported(walkGrid: WalkGrid, floodState: FloodState, cell: number): boolean {
    if ((walkGrid.grid[cell] & (SOLID | FLOOR)) !== 0 || heldFromBelow(walkGrid, floodState, cell)) return true;
    const marks = walkGrid.marks[cell];
    if (marks & DRIFT_MARK) return true;
    if (marks & BRIDGE_MARK && (floodState.pocket || floodState.bridged.has(cell))) return true;
    if (marks & KICK_MARK && floodState.kicked.has(cell)) return true;
    if (marks & RIDE_MARK) return true;
    // a pocket flood holds the hero on a skip lane's ride, where a swapped hero rides
    if (marks & KICK_MARK && floodState.pocket && walkGrid.laneRides.has(cell)) return true;

    const layerCells = walkGrid.layerCells;
    const z = Math.floor(cell / layerCells) - Z_BIAS;
    const doubled =
        (marks & POWER_MARK && walkGrid.doubleBeams.has(cell)) ||
        (marks & OPTION_MARK && walkGrid.optionalPowers.doubleBeams.has(cell));
    if (doubled) {
        const waterZ = waterAt(walkGrid, cell % layerCells, z);
        if (waterZ != null && Math.abs(z - waterZ) < 0.6) return true;
    }

    if (z > 0 || layerOf(walkGrid, z) !== 0) return false;
    if (z < 0) return true;
    // at z 0 the ground floor holds the hero unless water lies over it
    return waterAt(walkGrid, cell % layerCells, z) == null;
}

/** Whether the hero can stand in `cell`: inside the grid, not blocked and held up. */
export function standable(walkGrid: WalkGrid, floodState: FloodState, cell: number): boolean {
    if (cell < 0 || cell >= walkGrid.grid.length) return false;
    return !blocked(walkGrid, floodState, cell) && supported(walkGrid, floodState, cell);
}

/**
 * The cell the hero stands in at `cell`, else one up or down, else -1. An Area_Pin (`up` false) is touched, not stood
 * on: one inside a wall does not put the hero on top of it.
 */
export function land(walkGrid: WalkGrid, floodState: FloodState, cell: number, up = true): number {
    if (cell < 0) return -1;
    if (standable(walkGrid, floodState, cell)) return cell;
    const above = cell + walkGrid.layerCells;
    const below = cell - walkGrid.layerCells;
    if (up && standable(walkGrid, floodState, above)) return above;
    if (standable(walkGrid, floodState, below)) return below;
    return -1;
}

/**
 * Whether `cell` at height z holds a pushed stone: a floor, or below it what holds up the cell above at some point of
 * the flood (a Gate the flood has opened held the stone before it opened; an open notted Gate a switch press has shut
 * holds it from then on; a closed Freezer), or a water cell the flood has bridged, whose sunk Rock holds up what is
 * pushed over it.
 */
export function holdsStone(walkGrid: WalkGrid, floodState: FloodState, cell: number, z: number): boolean {
    const { grid, marks, layerCells } = walkGrid;
    if (grid[cell] & FLOOR) return true;
    if (floodState.bridged.size !== 0 && floodState.bridged.has(cell)) return true;

    if (cell >= layerCells) {
        const below = cell - layerCells;
        const belowBits = grid[below];
        if (belowBits & SUPPORT) return true;
        if (marks[below] & FROZEN_MARK) return true;
        if (belowBits & (MONSTER | MOVABLE) && heldByEntity(walkGrid, floodState, below)) return true;
        if (floodState.latchedShut.size !== 0 && floodState.latchedShut.has(below)) return true;
    }

    return z <= 0 && layerOf(walkGrid, z) === 0 && waterAt(walkGrid, cell % layerCells, z) == null;
}

/**
 * Whether a hero falling into `cell` (at z) falls on through it: it is not blocked or attacked, and nothing holds the
 * hero there (off the ground layer and away from water only a floor or what stands below can).
 */
export function fallsThrough(walkGrid: WalkGrid, floodState: FloodState, cell: number, z: number): boolean {
    if (blocked(walkGrid, floodState, cell) || walkGrid.cellFlags[cell] & FIRE) return false;
    const columnHasWater = walkGrid.waterColumns[cell % walkGrid.layerCells] !== undefined;
    if (layerOf(walkGrid, z) === 0 || columnHasWater) {
        return !standable(walkGrid, floodState, cell) && !deep(walkGrid, cell);
    }

    return !(walkGrid.grid[cell] & FLOOR) && !heldFromBelow(walkGrid, floodState, cell);
}
