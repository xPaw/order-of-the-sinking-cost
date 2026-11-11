// The mechanics the walk models in part or not at all (viewer.md "What the walk leaves out")
import { rawU16 } from '../save.ts';
import { DIRS, keyOf, neighbourOf, Z_BIAS } from './cells.ts';
import { exists } from './groups.ts';
import { waterAt } from './ocean.ts';
import type { WalkGrid } from './walker.ts';
import { latestCell } from './walls.ts';

/** The unmodelled mechanics of world.mechs, by kind (the progress's `why`). */
export const MECHS: string[] = ['dragon', 'beam', 'mirror', 'stones'];

// the kinds of MECHS
const DRAGON = 0;
const BEAM = 1;
const MIRROR = 2;
const SKIPPING_STONE = 3;

// Rock.properties FLIPPING_TARGET: a skipping stone that sank
const FLIPPING_TARGET = 8;

/** Whether a skipping stone in `cell` sank: flipped (`properties` FLIPPING_TARGET), or under the water surface. */
function stoneSank(walkGrid: WalkGrid, pid: number, cell: number): boolean {
    const properties = walkGrid.latest.get(pid, 'properties');
    if (properties && rawU16(properties) & FLIPPING_TARGET) return true;
    const layerCells = walkGrid.layerCells;
    const cellZ = Math.floor(cell / layerCells) - Z_BIAS;
    const waterZ = waterAt(walkGrid, cell % layerCells, cellZ);
    return waterZ != null && cellZ < waterZ;
}

/**
 * The cell a mechanic of world.mechs is marked around, else -1: a mirror and a skipping stone where the save last
 * left them (a smashed or destroyed one is gone), a skipping stone unless it sank, the others at their level-data
 * cell.
 */
function mechanicCell(walkGrid: WalkGrid, kind: number, pid: number, column: number, row: number, z: number): number {
    if (kind === MIRROR) return latestCell(walkGrid, pid, column, row, z);
    if (kind === SKIPPING_STONE) {
        const cell = latestCell(walkGrid, pid, column, row, z);
        if (cell < 0 || stoneSank(walkGrid, pid, cell)) return -1;
        return cell;
    }

    return keyOf(walkGrid, column, row, z);
}

/** Whether every cell lies below the fast-travel box. */
function allBelowBox(walkGrid: WalkGrid, cells: Iterable<number>): boolean {
    for (const cell of cells) {
        if (Math.floor(cell / walkGrid.layerCells) - Z_BIAS >= walkGrid.boxZ) return false;
    }

    return true;
}

/**
 * Marks the mechanics the walk models only in part or not at all, by cell (bit 1 << kind: dragon, beam, mirror,
 * skipping stone): the 3 x 3 x 3 cells around each existing one, a dragon's fire, and the lights and their beams'
 * cells. Also fills `mechanicsNear`, the mechanics in or next to each cell, when every marked cell lies below the
 * fast-travel box: per cell, the cells whose step one way (DIRS) leads to it are its neighbours the other way, except
 * at the edge of the box, which wraps on its own.
 */
export function placeMechanics(walkGrid: WalkGrid): void {
    const { world, mechanics, grid, layerCells } = walkGrid;
    const mark = (cell: number, bit: number): void => {
        if (cell >= 0) mechanics.set(cell, (mechanics.get(cell) ?? 0) | bit);
    };

    for (const [kind, pid, column, row, z, existence] of world.mechs || []) {
        if (!exists(walkGrid, pid, existence)) continue;
        const cell = mechanicCell(walkGrid, kind, pid, column, row, z);
        if (cell < 0) continue;

        const bit = 1 << kind;

        for (let dz = -1; dz <= 1; dz++) {
            const layerCell = cell + dz * layerCells;
            if (layerCell < 0 || layerCell >= grid.length) continue;

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    mark(neighbourOf(walkGrid, layerCell, dx, dy), bit);
                }
            }
        }
    }

    for (const cell of walkGrid.burning) mark(cell, 1 << DRAGON);
    for (const cell of walkGrid.litCells) mark(cell, 1 << BEAM);

    if (!allBelowBox(walkGrid, mechanics.keys())) return;

    const mechanicsNear = new Map<number, number>();

    const noteNear = (cell: number): void => {
        if (mechanicsNear.has(cell)) return;

        let bits = mechanics.get(cell) ?? 0;
        for (const [dx, dy] of DIRS) bits |= mechanics.get(neighbourOf(walkGrid, cell, dx, dy)) ?? 0;
        mechanicsNear.set(cell, bits);
    };

    for (const cell of mechanics.keys()) {
        noteNear(cell);
        for (const [dx, dy] of DIRS) noteNear(neighbourOf(walkGrid, cell, -dx, -dy));
    }

    walkGrid.mechanicsNear = mechanicsNear;
}

/** The mechanics in or next to a set of cells (`mechanicsNear` null: some lie in the fast-travel rooms). */
export function mechAt(walkGrid: WalkGrid, cells: Set<number> | number[]): number {
    const { mechanics, mechanicsNear } = walkGrid;
    let bits = 0;
    if (!mechanics.size) return bits;

    if (!mechanicsNear) {
        for (const cell of cells) {
            bits |= mechanics.get(cell) ?? 0;
            for (const [dx, dy] of DIRS) bits |= mechanics.get(neighbourOf(walkGrid, cell, dx, dy)) ?? 0;
        }
        return bits;
    }

    // look up from the smaller side
    if (cells instanceof Set && mechanicsNear.size < cells.size) {
        for (const [cell, near] of mechanicsNear) {
            if ((near & ~bits) !== 0 && cells.has(cell)) bits |= near;
        }
        return bits;
    }

    for (const cell of cells) bits |= mechanicsNear.get(cell) ?? 0;
    return bits;
}
