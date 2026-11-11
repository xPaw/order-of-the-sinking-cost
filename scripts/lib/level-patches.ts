// The patch of each level: the standable cells of a map layer nearer to its door by walking than to any other door's
// (viewer.md "The page (viewer)", the Reachable overlay)
import { NO_LEVEL } from '../../src/types.ts';
import { STEP } from '../../src/walk/cells.ts';

/** A level's door: the level's index and the column of the map layer its door stands in. */
export interface Door {
    level: number;
    column: number;
}

/**
 * The index of the nearest level per column of one layer, `width` x `height` columns (row 0 = north), wrapping at the
 * edges. `heights` holds the highest z the hero stands at per column, NaN where he stands nowhere. A multi-source
 * breadth-first search from the doors, one step to a side at a time, onto a column that stands no higher than the one
 * it leaves (the hero never steps up, and falls without harm). A column that two doors reach in the same number of steps
 * goes to the lower level index. Columns no door reaches hold NO_LEVEL.
 */
export function assignPatches(
    heights: Float32Array,
    width: number,
    height: number,
    doors: readonly Door[],
): Uint16Array {
    const patches = new Uint16Array(width * height).fill(NO_LEVEL);
    let frontier: number[] = [];

    for (const door of doors) {
        if (Number.isNaN(heights[door.column])) continue;

        if (patches[door.column] === NO_LEVEL) {
            frontier.push(door.column);
            patches[door.column] = door.level;
        } else if (door.level < patches[door.column]) {
            patches[door.column] = door.level;
        }
    }

    while (frontier.length > 0) {
        const next: number[] = [];
        // the level a column gets from this round's frontier; the lowest index among the columns that step onto it
        const claimed = new Map<number, number>();

        for (const column of frontier) {
            const level = patches[column];
            const x = column % width;
            const y = Math.floor(column / width);

            for (const [dx, dy] of STEP) {
                const stepX = (x + dx + width) % width;
                const stepY = (y + dy + height) % height;
                const target = stepY * width + stepX;
                if (patches[target] !== NO_LEVEL) continue;
                if (!(heights[target] <= heights[column])) continue;

                const earlier = claimed.get(target);
                if (earlier === undefined) {
                    claimed.set(target, level);
                    next.push(target);
                } else if (level < earlier) {
                    claimed.set(target, level);
                }
            }
        }

        for (const [column, level] of claimed) patches[column] = level;
        frontier = next;
    }

    return patches;
}
