// The patch of each level on tiny grids: nearest door by walking, ties to the lower level, walls, and the wrap
import { describe, expect, test } from 'vitest';
import { assignPatches } from '../scripts/lib/level-patches.ts';
import { NO_LEVEL } from '../src/types.ts';

const WALL = NaN;

/** A grid of rows of heights (north first), with 'x' for a wall, as the flat heights the function reads. */
function grid(rows: Array<Array<number | 'x'>>): Float32Array {
    return Float32Array.from(rows.flat(), (value) => (value === 'x' ? WALL : value));
}

/** The patches as rows, for reading. */
function rowsOf(patches: Uint16Array, width: number): number[][] {
    const rows: number[][] = [];
    for (let start = 0; start < patches.length; start += width) {
        rows.push(Array.from(patches.subarray(start, start + width)));
    }
    return rows;
}

describe('assignPatches', () => {
    test('each cell goes to the nearer of two doors', () => {
        const heights = grid([[0, 0, 0, 0, 0, 0, 0]]);
        const patches = assignPatches(heights, 7, 1, [
            { level: 4, column: 1 },
            { level: 9, column: 4 },
        ]);
        // the last column is two steps from either door, so the lower level index has it
        expect(rowsOf(patches, 7)).toEqual([[4, 4, 4, 9, 9, 9, 4]]);
    });

    test('a cell the same distance from two doors goes to the lower level index', () => {
        const heights = grid([[0, 0, 0, 0, 0]]);
        const patches = assignPatches(heights, 5, 1, [
            { level: 7, column: 0 },
            { level: 2, column: 2 },
        ]);
        expect(rowsOf(patches, 5)).toEqual([[7, 2, 2, 2, 7]]);

        const swapped = assignPatches(heights, 5, 1, [
            { level: 2, column: 0 },
            { level: 7, column: 2 },
        ]);
        expect(rowsOf(swapped, 5)).toEqual([[2, 2, 7, 7, 2]]);
    });

    test('a wall between two doors sends the walk the long way round', () => {
        const heights = grid([
            [0, 'x', 0, 'x'],
            [0, 'x', 0, 'x'],
            [0, 0, 0, 0],
        ]);
        const patches = assignPatches(heights, 4, 3, [
            { level: 0, column: 0 },
            { level: 1, column: 2 },
        ]);
        // the open bottom row is the only way between the doors, and the cells in it that are as near to one as to the
        // other go to level 0
        expect(rowsOf(patches, 4)).toEqual([
            [0, NO_LEVEL, 1, NO_LEVEL],
            [0, NO_LEVEL, 1, NO_LEVEL],
            [0, 0, 1, 0],
        ]);
    });

    test('the map wraps at its edges', () => {
        const heights = grid([
            [0, 0, 0, 0],
            [0, 0, 0, 0],
            [0, 0, 0, 0],
        ]);
        const patches = assignPatches(heights, 4, 3, [{ level: 3, column: 0 }]);
        expect(rowsOf(patches, 4)).toEqual([
            [3, 3, 3, 3],
            [3, 3, 3, 3],
            [3, 3, 3, 3],
        ]);

        const walled = grid([
            [0, 'x', 'x', 0],
            ['x', 'x', 'x', 'x'],
            [0, 'x', 'x', 0],
        ]);
        const across = assignPatches(walled, 4, 3, [{ level: 5, column: 0 }]);
        // east of the last column is the first, and south of the last row the first
        expect(rowsOf(across, 4)).toEqual([
            [5, NO_LEVEL, NO_LEVEL, 5],
            [NO_LEVEL, NO_LEVEL, NO_LEVEL, NO_LEVEL],
            [5, NO_LEVEL, NO_LEVEL, 5],
        ]);
    });

    test('the walk steps down onto lower floors but never up', () => {
        const heights = grid([[2, 2, 0, 0, 2]]);
        const fromHigh = assignPatches(heights, 5, 1, [{ level: 1, column: 0 }]);
        expect(rowsOf(fromHigh, 5)).toEqual([[1, 1, 1, 1, 1]]);

        const fromLow = assignPatches(grid([[2, 2, 0, 0, 3]]), 5, 1, [{ level: 1, column: 3 }]);
        expect(rowsOf(fromLow, 5)).toEqual([[NO_LEVEL, NO_LEVEL, 1, 1, NO_LEVEL]]);
    });

    test('a door on a wall cell has no patch', () => {
        const patches = assignPatches(grid([[0, 'x', 0]]), 3, 1, [{ level: 0, column: 1 }]);
        expect(rowsOf(patches, 3)).toEqual([[NO_LEVEL, NO_LEVEL, NO_LEVEL]]);
    });
});
