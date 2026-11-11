// The level cells reader: a stored layer unpacks to its grid
import { deflateSync } from 'node:zlib';
import { beforeAll, expect, test, vi } from 'vitest';
import { NO_LEVEL } from '../src/types.ts';

const NONE = NO_LEVEL;
const GROUND = [3, 3, NONE, 12, 0, 300];

function stored(values: number[]): string {
    const cells = Uint16Array.from(values);
    const bytes = new Uint8Array(cells.buffer);
    return deflateSync(bytes).toString('base64');
}

vi.mock('../data/level-cells.json', () => ({
    default: { underworld: stored([NONE]), ground: stored(GROUND), sky: stored([1, 2]) },
}));

// the module's binding is read after the cells are unpacked, as the unpacking runs on the platform's streams
const levelCells = await import('../src/level-cells.ts');

beforeAll(async () => {
    await levelCells.levelCellsReady;
});

test('a layer unpacks to the stored level per cell', () => {
    expect([...levelCells.LEVEL_CELLS!.ground]).toEqual(GROUND);
    expect([...levelCells.LEVEL_CELLS!.sky]).toEqual([1, 2]);
});

test('a cell no level reaches reads as NO_LEVEL', () => {
    expect(levelCells.LEVEL_CELLS!.ground[2]).toBe(NO_LEVEL);
    expect(levelCells.LEVEL_CELLS!.underworld[0]).toBe(NO_LEVEL);
});
