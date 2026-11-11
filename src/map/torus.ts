// Map coordinates on the wrapping overworld (WORLD.md "Wrapping"): world squares to map positions, the copies of the
// map shown around the first one, and the smallest box on the torus
import { PROG } from '../data.ts';
import { mod } from '../walk/cells.ts';

/** A map rectangle: x, y, width, height. */
export type Rect = [x: number, y: number, width: number, height: number];

// The overworld wraps on both axes. The svg terrain group (water, reach images, fog) is drawn once and use elements repeat
// it for two world sizes around; panzoom shows the ones the view reaches. The terrain image is not in the svg: it is a
// repeating background. The overlay group (markers, lines) is separate, with real copies of its marks, so that no copy's
// terrain covers the overhang of a neighbouring copy's markers.
const WRAP_REACH = 2;

/**
 * A map rectangle [x, y, w, h] and its copies shifted by whole world sizes that overlap the first copy of the map, so
 * that a rectangle reaching past an edge also covers the opposite side.
 */
export function wrapRect([x, y, width, height]: Rect): Rect[] {
    const [mapWidth, mapHeight] = PROG.map.size;
    const copies: Rect[] = [];

    for (let copyY = -1; copyY <= 1; copyY++) {
        for (let copyX = -1; copyX <= 1; copyX++) {
            const left = x + copyX * mapWidth;
            const top = y + copyY * mapHeight;
            if (left < mapWidth && left + width > 0 && top < mapHeight && top + height > 0) {
                copies.push([left, top, width, height]);
            }
        }
    }

    return copies;
}

/** The copies of the map as shifts in whole map sizes: copyX from firstX to lastX, copyY from firstY to lastY. */
export interface CopyRange {
    firstX: number;
    lastX: number;
    firstY: number;
    lastY: number;
}

/** Whether the copy shifted by (copyX, copyY) maps is in the range. */
export function isInRange(range: CopyRange, copyX: number, copyY: number): boolean {
    return copyX >= range.firstX && copyX <= range.lastX && copyY >= range.firstY && copyY <= range.lastY;
}

/** Whether two ranges hold the same copies. */
export function sameRange(first: CopyRange, second: CopyRange): boolean {
    return (
        first.firstX === second.firstX &&
        first.lastX === second.lastX &&
        first.firstY === second.firstY &&
        first.lastY === second.lastY
    );
}

/** A range to pass to copyRange, which a per-frame caller keeps and fills again each frame. */
export const newCopyRange = (): CopyRange => ({ firstX: 0, lastX: 0, firstY: 0, lastY: 0 });

/**
 * Sets `range` to the copies of the map that put the map position (x, y) inside the box [left, top, right, bottom]
 * (the view box widened by the reach of what is drawn there).
 */
export function copyRange(
    range: CopyRange,
    x: number,
    y: number,
    left: number,
    top: number,
    right: number,
    bottom: number,
): void {
    const [width, height] = PROG.map.size;
    range.firstX = Math.ceil((left - x) / width);
    range.lastX = Math.floor((right - x) / width);
    range.firstY = Math.ceil((top - y) / height);
    range.lastY = Math.floor((bottom - y) / height);
}

/**
 * The use elements that repeat the terrain group of the map (id-w) around the first copy, hidden until the view
 * reaches them. A hidden use has no href; its data-group holds the reference that panzoom sets when the use is shown.
 */
export function wrapCopies(id: string, mapWidth: number, mapHeight: number): string {
    let html = '';

    for (let copyY = -WRAP_REACH; copyY <= WRAP_REACH; copyY++) {
        for (let copyX = -WRAP_REACH; copyX <= WRAP_REACH; copyX++) {
            if (!copyX && !copyY) continue;
            const copyIndex = `data-kx="${copyX}" data-ky="${copyY}"`;
            const copyAt = `x="${copyX * mapWidth}" y="${copyY * mapHeight}"`;
            html += `<use data-group="#${id}-w" ${copyIndex} ${copyAt} style="display:none"/>`;
        }
    }

    return html;
}

/** Map position of a world square (not wrapped: rectangles may reach past the edge). */
export function rawXY(x: number, y: number): [number, number] {
    const [cornerX, cornerY] = PROG.map.corner;
    const mapHeight = PROG.map.size[1];
    return [x - cornerX + 0.5, mapHeight - (y - cornerY) - 0.5];
}

/** Map position of a world square, inside the first copy of the map. */
export function mapXY(x: number, y: number): [number, number] {
    const [mapWidth, mapHeight] = PROG.map.size;
    const [mapX, mapY] = rawXY(x, y);
    return [mod(mapX, mapWidth), mod(mapY, mapHeight)];
}

// the shortest span on a circle of length circumference that holds the intervals [start, end]: [start in
// [0, circumference), length]
function arc(intervals: Array<[number, number]>, circumference: number): [number, number] {
    const spans = intervals
        .map(([start, end]): [number, number] => [mod(start, circumference), Math.min(end - start, circumference)])
        .toSorted((left, right) => left[0] - right[0]);
    const [first] = spans;
    let reach = first[0] + first[1];
    let gap = 0;
    let from = 0;

    for (const [start, length] of spans.slice(1)) {
        if (start - reach > gap) {
            gap = start - reach;
            from = start;
        }
        reach = Math.max(reach, start + length);
    }

    if (first[0] + circumference - reach > gap) {
        gap = first[0] + circumference - reach;
        from = first[0];
    }

    if (gap > 0) return [from, circumference - gap];
    return [0, circumference];
}

/**
 * The smallest box [x, y, w, h] on the torus map holding the rectangles (map coordinates), positioned in the first copy.
 */
export function torusBox(rects: Rect[]): { x: number; y: number; w: number; h: number } {
    const [mapWidth, mapHeight] = PROG.map.size;
    const horizontalIntervals = rects.map((rect): [number, number] => [rect[0], rect[0] + rect[2]]);
    const verticalIntervals = rects.map((rect): [number, number] => [rect[1], rect[1] + rect[3]]);
    const [x, width] = arc(horizontalIntervals, mapWidth);
    const [y, height] = arc(verticalIntervals, mapHeight);
    return { x, y, w: width, h: height };
}
