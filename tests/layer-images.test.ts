// The offset of a layer image's repeating background: the corner's distance from the tile's origin, modulo the tile
import { expect, test } from 'vitest';
import { mod } from '../src/walk/cells.ts';

test('a negative multiple of the period wraps to zero, not the period', () => {
    expect(mod(-200, 100)).toBe(0);
});

test('a fractional offset wraps into the period', () => {
    expect(mod(-0.5, 2.5)).toBeCloseTo(2);
    expect(mod(5.25, 2.5)).toBeCloseTo(0.25);
});
