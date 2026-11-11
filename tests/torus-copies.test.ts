// The copies of the map that a marker is shown in are the ones the view reaches
import { expect, test, vi } from 'vitest';
import { copyRange, isInRange, newCopyRange, sameRange, wrapCopies } from '../src/map/torus.ts';

vi.mock('../src/data.ts', () => ({ PROG: { map: { size: [100, 50], corner: [0, 0] } } }));

type ViewBox = [left: number, top: number, right: number, bottom: number];

// the copies of the range as [copyX, copyY] shifts, row by row; adding zero turns the negative zero of a ceiling into
// zero, which toEqual tells apart
function shifts(x: number, y: number, view: ViewBox, reach: number): Array<[number, number]> {
    const [left, top, right, bottom] = view;
    const range = newCopyRange();
    copyRange(range, x, y, left - reach, top - reach, right + reach, bottom + reach);

    const copies: Array<[number, number]> = [];
    for (let copyY = range.firstY; copyY <= range.lastY; copyY++) {
        for (let copyX = range.firstX; copyX <= range.lastX; copyX++) copies.push([copyX + 0, copyY + 0]);
    }
    return copies;
}

test('the range is written into the object given, which later calls reuse', () => {
    const range = newCopyRange();
    copyRange(range, 70, 20, 60, 5, 240, 45);
    expect([range.firstX + 0, range.lastX, range.firstY + 0, range.lastY]).toEqual([0, 1, 0, 0]);

    copyRange(range, 10, 20, 60, 5, 95, 45);
    expect(range.firstX).toBeGreaterThan(range.lastX);
});

test('a view inside the first copy shows the marker once', () => {
    expect(shifts(40, 20, [10, 5, 90, 45], 0)).toEqual([[0, 0]]);
});

test('a view past the east edge shows the marker in the next copy', () => {
    expect(shifts(10, 20, [60, 5, 140, 45], 0)).toEqual([[1, 0]]);
    expect(shifts(70, 20, [60, 5, 140, 45], 0)).toEqual([[0, 0]]);
});

test('a view wider than the map shows the marker in each copy it spans', () => {
    expect(shifts(70, 20, [60, 5, 240, 45], 0)).toEqual([
        [0, 0],
        [1, 0],
    ]);
});

test('the reach brings in a copy whose marker is just outside the view', () => {
    expect(shifts(10, 20, [60, 5, 95, 45], 0)).toEqual([]);
    expect(shifts(10, 20, [60, 5, 95, 45], 20)).toEqual([[1, 0]]);
});

test('a wrap copy starts hidden and carries its group without an href', () => {
    const html = wrapCopies('map', 100, 50);
    expect(html.match(/<use /g)).toHaveLength(24);
    expect(html).not.toContain('href="');
    expect(html).toContain('data-group="#map-w" data-kx="-2" data-ky="-2" x="-200" y="-100" style="display:none"');
});

test('a range holds the copies between its ends', () => {
    const range = { firstX: -1, lastX: 1, firstY: 0, lastY: 0 };
    expect(isInRange(range, 1, 0)).toBe(true);
    expect(isInRange(range, 2, 0)).toBe(false);
    expect(isInRange(range, 0, 1)).toBe(false);
});

test('ranges are the same when all four ends are', () => {
    const range = { firstX: -1, lastX: 1, firstY: 0, lastY: 0 };
    expect(sameRange(range, { ...range })).toBe(true);
    expect(sameRange(range, { ...range, lastY: 1 })).toBe(false);
});

test('the copies cover both axes', () => {
    expect(shifts(50, 25, [-60, -30, 60, 30], 0)).toEqual([
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
    ]);
});
