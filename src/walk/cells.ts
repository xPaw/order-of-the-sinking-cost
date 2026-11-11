// Cell keys and their neighbours, sides and the per-cell bits of a walker's grid (world.md "Positions and cells",
// "Wrapping", "Map rooms")
import { PROG } from '../data.ts';

/**
 * The size and wrapping of a walker's grid, which the cell keys depend on: the grid's corner and size, its z range and
 * the fast-travel box (at and above z `boxZ` cells wrap inside the box, grid columns boxColumn..boxColumn+boxWidth-1,
 * rows boxRow..boxRow+boxHeight-1, instead of the whole grid).
 */
export interface GridDimensions {
    cornerX: number;
    cornerY: number;
    width: number;
    height: number;
    layerCells: number;
    zOffset: number;
    layerCount: number;
    boxZ: number;
    boxWidth: number;
    boxHeight: number;
    boxColumn: number;
    boxRow: number;
}

/**
 * A grid's dimensions and, per side and column, the column offset of the neighbour on that side: first the table for
 * the layers below the fast-travel box, then the one for the layers at and above it (`sideColumns`, see sideColumnsOf).
 */
export interface GridShape extends GridDimensions {
    sideColumns: Int32Array;
}

/** A grid step [dx, dy]. */
export type Step = [dx: number, dy: number];

/** `value` modulo `modulus`, in 0..modulus-1 also for a negative value. */
export function mod(value: number, modulus: number): number {
    return ((value % modulus) + modulus) % modulus;
}

/** A side (0 east, 1 north, 2 west, 3 south) as a step [dx, dy]; the flood takes the sides in SIDES order. */
export const STEP: Step[] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
];

export const SIDES: number[] = [0, 2, 1, 3];

/** A cell key's z layer is z + Z_BIAS. */
export const Z_BIAS = 80;

export const DIRS: Step[] = SIDES.map((side) => STEP[side]);

// per cell of a walker's grid: solid; supports the cell above (solid or a rock); holds the hero in its own cell (a lily or
// a floor); a shut Gate; then what stands there: a Rock, a living Monster, a movable, a beam stop (Trees, Signs,
// Treasure_Displays, Judges, the level data's beam stops, and the Rocks and movables other than MIRRORABLE Rocks and
// mirrorable Rovers)
export const SOLID = 1;
export const SUPPORT = 2;
export const FLOOR = 4;
export const GATE = 8;
export const ROCK = 16;
export const MONSTER = 32;
export const MOVABLE = 64;
export const BEAMSTOP = 128;

// fire runs until a solid voxel or rock, a shut Gate, a Monster or a movable; a goblin attacks the cell of a Rock or a
// movable, where the hero stands once he has pushed it away
export const FIRE_STOP = SOLID | SUPPORT | GATE | MONSTER | MOVABLE;

// a beam runs through walls, Guys, Monsters, MIRRORABLE Rocks and mirrorable Rovers
export const BEAM_STOP = GATE | BEAMSTOP;

// what the hero pushes (SINGLE_PUSH)
export const PUSH = ROCK | MONSTER | MOVABLE;

// per cell, next to the grid: the fence sides (bit per side), an attacked cell, a THROUGH beam's wall cell, a THROUGH
// beam, a TELEPORT line's target or Mirror (`swapTargets`, `mirrorSides`)
export const FIRE = 16;
export const THRU = 32;
export const BEAM = 64;
export const LINE_STOP = 128;

// per cell, next to the grid: which of the walker's per-cell lookups hold it, so a flood asks them only there: a
// powered beam's ENDPOINT, DOUBLE, ALTER, SQUEEZE or OPEN power; a Wardrobe; a magic-mirror hop, an elevator ride or a
// pad (the pad's cell and the cell above it); a drifting Lily's way; a closed Freezer (`frozen`); a rock bridge's water
// cell (`bridgeWater`); an ENDPOINT, DOUBLE or ALTER power a flood's pushes laid down (`optionalPowers`); a cell a
// kicked Lily drifts through (`kicks`); a cell a sunk Rover a flood pushed into water rides through
export const POWER_MARK = 1;
export const WARDROBE_MARK = 2;
export const TRAVEL_MARK = 4;
export const DRIFT_MARK = 8;
export const FROZEN_MARK = 16;
export const BRIDGE_MARK = 32;
export const KICK_MARK = 64;
export const RIDE_MARK = 128;
export const OPTION_MARK = 256;

/** Appends `value` to the list of `key` in `map`. */
export function addTo<Key, Value>(map: Map<Key, Value[]>, key: Key, value: Value): void {
    const list = map.get(key);
    if (list) {
        list.push(value);
    } else {
        map.set(key, [value]);
    }
}

/** The map column (row 0 = north, as in the layer images) of world square x, y. */
export function mapCol(x: number, y: number): number {
    const [mapWidth, mapHeight] = PROG.map.size;
    const [mapCornerX, mapCornerY] = PROG.map.corner;
    const mapRow = mapHeight - 1 - mod(y - mapCornerY, mapHeight);
    return mapRow * mapWidth + mod(x - mapCornerX, mapWidth);
}

/** The map column of a grid column and row. */
export function gridCol(column: number, row: number): number {
    const [gridCornerX, gridCornerY] = PROG.world.grid.corner;
    return mapCol(gridCornerX + column, gridCornerY + row);
}

// the column offset in a z layer of the cell `columnsFromCorner` columns and `rowsFromCorner` rows from the box
// corner, wrapped inside the box
function inBox(walkGrid: GridDimensions, columnsFromCorner: number, rowsFromCorner: number): number {
    const { boxColumn, boxRow, boxWidth, boxHeight, width, height } = walkGrid;
    const column = mod(boxColumn + mod(columnsFromCorner, boxWidth), width);
    const row = mod(boxRow + mod(rowsFromCorner, boxHeight), height);
    return column + row * width;
}

/**
 * The cell key of world point x, y, z: (z + Z_BIAS) * width * height + row * width + column, with the column and row
 * wrapped in the grid (inside the fast-travel box at and above its z); -1 outside the z range.
 */
export function cellOf(walkGrid: GridDimensions, x: number, y: number, z: number): number {
    const cellZ = Math.round(z);
    if (cellZ < 1 - Z_BIAS || cellZ >= walkGrid.layerCount - Z_BIAS - 1) return -1;
    const { width, height, layerCells, boxZ, boxColumn, boxRow } = walkGrid;
    const column = Math.round(x) - walkGrid.cornerX;
    const row = Math.round(y) - walkGrid.cornerY;
    const layerStart = (cellZ + Z_BIAS) * layerCells;
    if (cellZ >= boxZ) return layerStart + inBox(walkGrid, column - boxColumn, row - boxRow);
    return layerStart + (mod(column, width) + mod(row, height) * width);
}

/** `value` (in -1..size) wrapped into 0..size-1. */
function wrapOnce(value: number, size: number): number {
    if (value < 0) return value + size;
    if (value >= size) return value - size;
    return value;
}

/** The cell dx, dy (each -1..1) away from `cell` (not negative) in the same z. */
export function neighbourOf(walkGrid: GridDimensions, cell: number, dx: number, dy: number): number {
    const { width, height, layerCells } = walkGrid;
    const inLayer = cell % layerCells;
    const layerStart = cell - inLayer;
    const column = inLayer % width;
    const row = (inLayer - column) / width;

    const boxLayerStart = (walkGrid.boxZ + Z_BIAS) * layerCells;
    if (cell >= boxLayerStart) {
        const boxColumn = mod(column - walkGrid.boxColumn, width);
        const boxRow = mod(row - walkGrid.boxRow, height);
        const insideBox = boxColumn < walkGrid.boxWidth && boxRow < walkGrid.boxHeight;
        if (insideBox) return layerStart + inBox(walkGrid, boxColumn + dx, boxRow + dy);
    }

    return layerStart + wrapOnce(column + dx, width) + wrapOnce(row + dy, height) * width;
}

/** The cell key of a grid column, row and z, without wrapping; -1 outside the z range. */
export function keyOf(walkGrid: GridDimensions, column: number, row: number, z: number): number {
    if (z < 1 - Z_BIAS || z >= walkGrid.layerCount - Z_BIAS - 1) return -1;
    return (z + Z_BIAS) * walkGrid.layerCells + row * walkGrid.width + column;
}

/**
 * The tables of GridShape.sideColumns: per side and column, the neighbour's column offset in the layer, for the layers
 * below the fast-travel box and then for the layers at and above it.
 */
export function sideColumnsOf(dimensions: GridDimensions): Int32Array {
    const layerCells = dimensions.layerCells;
    const boxLayerStart = (dimensions.boxZ + Z_BIAS) * layerCells;
    const sideColumns = new Int32Array(8 * layerCells);

    for (let side = 0; side < 4; side++) {
        const [dx, dy] = STEP[side];

        for (let column = 0; column < layerCells; column++) {
            const below = neighbourOf(dimensions, column, dx, dy);
            let boxed = below;

            if (Number.isFinite(boxLayerStart)) {
                boxed = neighbourOf(dimensions, boxLayerStart + column, dx, dy) - boxLayerStart;
            }

            sideColumns[side * layerCells + column] = below;
            sideColumns[(4 + side) * layerCells + column] = boxed;
        }
    }

    return sideColumns;
}

/** The cell next to `cell` on side `side`. */
export function cellOnSide(walkGrid: GridShape, cell: number, side: number): number {
    const layerCells = walkGrid.layerCells;
    const column = cell % layerCells;
    const layerStart = cell - column;
    let tableSide = side;
    if (layerStart >= (walkGrid.boxZ + Z_BIAS) * layerCells) tableSide += 4;

    return layerStart + walkGrid.sideColumns[tableSide * layerCells + column];
}

/**
 * How many steps on side `side` take `cell` round its row or column back to itself: the grid's width or height, the
 * box's inside the fast-travel box; 0 in the box layers outside the box, where the steps may enter the box and stay.
 */
function lineLength(walkGrid: GridShape, cell: number, side: number): number {
    const { width, height, layerCells } = walkGrid;
    const alongRow = side % 2 === 0;
    if (cell < (walkGrid.boxZ + Z_BIAS) * layerCells) return alongRow ? width : height;

    const inLayer = cell % layerCells;
    const column = inLayer % width;
    const row = (inLayer - column) / width;
    const insideBox =
        mod(column - walkGrid.boxColumn, width) < walkGrid.boxWidth &&
        mod(row - walkGrid.boxRow, height) < walkGrid.boxHeight;
    if (!insideBox) return 0;

    return alongRow ? walkGrid.boxWidth : walkGrid.boxHeight;
}

/** The cell `count` cells from `cell` along side `side`; whole rounds of a row or column are skipped. */
export function cellsOnSide(walkGrid: GridShape, cell: number, side: number, count: number): number {
    const length = lineLength(walkGrid, cell, side);
    let steps = count;
    if (length > 0) steps = count % length;

    let reached = cell;
    for (let step = 0; step < steps; step++) reached = cellOnSide(walkGrid, reached, side);

    return reached;
}
