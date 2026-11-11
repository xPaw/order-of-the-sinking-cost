// Ground layers and water: the Ocean_Maps per column and the surface over a cell (world.md "Ground layers", state.md
// "Water in the save", movement.md "Water")
import type { World } from '../types.ts';
import type { WorldCells } from '../world-data.ts';
import { mod, Z_BIAS } from './cells.ts';
import type { GridShape } from './cells.ts';
import { place, put } from './groups.ts';
import type { WalkGrid } from './walker.ts';

/** What a z's ground layer depends on: the grid's z offset and the level data's layers. */
export interface LayerSource {
    zOffset: number;
    world: World;
}

/** The ground layer of height z. */
export function layerOf(source: LayerSource, z: number): number {
    const zIndex = Math.min(Math.max(z + source.zOffset, 0), 255);
    return source.world.zlayer[zIndex];
}

/**
 * The surface z of the first water map at the column in z's ground layer and at most 2.1 above z (the highest such),
 * else null.
 */
export function waterAt(walkGrid: WalkGrid, column: number, z: number): number | null {
    const oceanIndices = walkGrid.waterColumns[column];
    if (!oceanIndices) return null;
    const layer = layerOf(walkGrid, z);
    const oceans = walkGrid.world.oceans;
    const liveOceans = walkGrid.liveOceans;

    for (const oceanIndex of oceanIndices) {
        const ocean = oceans[oceanIndex];
        const oceanZ = ocean[1];
        if (liveOceans[oceanIndex] && ocean[2] === layer && oceanZ <= z + 2.1) return oceanZ;
    }

    return null;
}

/**
 * Whether water cancels a fall step into height z at the column: the surface lies more than 1 and less than 3 above z
 * (movement.md "Falling"), so a falling object stops one cell above, at surface - 1. Above the surface a fall passes.
 */
export function waterStopsFall(walkGrid: WalkGrid, column: number, z: number): boolean {
    const surface = waterAt(walkGrid, column, z);
    return surface != null && surface - 3 < z && z < surface - 1;
}

/** More than 0.1 under a water surface: a walk can't step there (swimming, or being carried over the sea). */
export function deep(walkGrid: WalkGrid, cell: number): boolean {
    const z = Math.floor(cell / walkGrid.layerCells) - Z_BIAS;
    const surface = waterAt(walkGrid, cell % walkGrid.layerCells, z);
    return surface != null && z < surface - 0.1;
}

/** Whether `cell` at height z is water level with z (surface within 0.5). */
export function levelWater(walkGrid: WalkGrid, cell: number, z: number): boolean {
    const surface = waterAt(walkGrid, cell % walkGrid.layerCells, z);
    return surface != null && surface >= z - 0.5 && surface < z + 0.5;
}

/** The order of the Ocean_Maps over a column, as the game keeps them: by map z, highest first, then by index. */
function highestFirst(world: World): (first: number, second: number) => number {
    return (first, second) => {
        const zDifference = world.oceans[second][1] - world.oceans[first][1];
        if (zDifference !== 0) return zDifference;
        return first - second;
    };
}

/** Per Ocean_Map pid, its index in `world.oceans`. */
export function oceanIndexOfPid(world: World): Map<number, number> {
    const oceanIndexOf = new Map<number, number>();
    world.oceans.forEach(([pid], oceanIndex) => {
        oceanIndexOf.set(pid, oceanIndex);
    });

    return oceanIndexOf;
}

/** Per column of the grid, the indices of the Ocean_Maps with water there in the level data, in the game's order. */
export function levelWaterColumns(shape: GridShape, world: World, worldCells: WorldCells): Array<number[] | undefined> {
    const water = worldCells.water;
    const waterColumns = Array.from<number[] | undefined>({ length: shape.layerCells });
    const higherFirst = highestFirst(world);

    // per column: a count, then that many u16 ocean indices
    let offset = 0;

    for (let column = 0; column < shape.layerCells; column++) {
        const count = water[offset++];
        if (!count) continue;

        const oceanIndices: number[] = [];
        waterColumns[column] = oceanIndices;

        for (let entry = 0; entry < count; entry++) {
            oceanIndices.push(water[offset] | (water[offset + 1] << 8));
            offset += 2;
        }

        oceanIndices.sort(higherFirst);
    }

    return waterColumns;
}

/**
 * Fills in the water: the walker's columns are the level data's, and the save's changes copy the columns they touch
 * (the level data is shared between walkers); and which Ocean_Maps exist.
 */
export function placeWater(walkGrid: WalkGrid): void {
    const { world, geometry, width, height, liveOceans } = walkGrid;
    const higherFirst = highestFirst(world);
    let changedColumns: Set<number> | null = null;

    for (const change of walkGrid.latest.ocean) {
        const oceanIndex = geometry.oceanIndexOf.get(change.pid);
        if (oceanIndex === undefined || !(change.new & 1)) continue;

        const [, , , oceanColumn, oceanRow, sizeX] = world.oceans[oceanIndex];
        const squareColumn = mod(oceanColumn + (change.index % sizeX), width);
        const squareRow = mod(oceanRow + Math.floor(change.index / sizeX), height);
        const column = squareColumn + squareRow * width;

        if (!changedColumns) {
            changedColumns = new Set();
            walkGrid.waterColumns = geometry.waterColumns.slice();
        }

        const waterColumns = walkGrid.waterColumns;
        let oceanIndices = waterColumns[column];
        if (!oceanIndices) {
            oceanIndices = [];
            waterColumns[column] = oceanIndices;
            changedColumns.add(column);
        } else if (!changedColumns.has(column)) {
            oceanIndices = [...oceanIndices];
            waterColumns[column] = oceanIndices;
            changedColumns.add(column);
        }

        if (!oceanIndices.includes(oceanIndex)) {
            oceanIndices.push(oceanIndex);
            oceanIndices.sort(higherFirst);
        }
    }

    world.oceans.forEach(([pid, , , , , , , existence], oceanIndex) => {
        place(walkGrid, pid, existence, () => put(walkGrid, liveOceans, oceanIndex, 1));
    });
}
