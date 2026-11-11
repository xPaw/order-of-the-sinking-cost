// The Reachable overlay picks the cells of the levels the save can reach, and shades the entered ones more
import { beforeEach, expect, test, vi } from 'vitest';
import type { Fog } from '../src/fog.ts';
import type { LevelReach } from '../src/model/progress-model.ts';
import type { MapLayer } from '../src/types.ts';

const SCALE = 4;
const WIDTH = 4;
const HEIGHT = 2;

vi.mock('../src/data.ts', () => ({ PROG: { map: { size: [4, 2], corner: [0, 0] } } }));
// the level of each cell of a 4 x 2 map, north row first; 0xffff is no level
vi.mock('../src/level-cells.ts', () => ({
    LEVEL_CELLS: { ground: Uint16Array.from([0, 0, 1, 0xffff, 2, 2, 1, 1]) },
}));
vi.mock('../src/map/colors.ts', () => ({
    REACH_RGB: [10, 20, 30],
    INK_RGB: [1, 2, 3],
    REACH_EDGE_RGB: [200, 100, 50],
}));

const { reachImage } = await import('../src/map/reach-image.ts');

const layer = { key: 'ground', name: 'Ground', z: [0, 10] } as MapLayer;
let painted: Uint8ClampedArray | null = null;

beforeEach(() => {
    painted = null;
    const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({
            createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
            putImageData: (image: { data: Uint8ClampedArray }) => {
                painted = image.data;
            },
        }),
        toDataURL: () => 'data:image/png;base64,',
    };
    vi.stubGlobal('document', { createElement: () => canvas });
});

/** The RGBA of the pixel at (x, y) inside square (i, j). */
function pixel(i: number, j: number, x: number, y: number): number[] {
    const offset = ((j * SCALE + y) * WIDTH * SCALE + i * SCALE + x) * 4;
    return Array.from(painted!.subarray(offset, offset + 4));
}

const REACHABLE_FILL = [10, 20, 30, Math.round(255 * 0.32)];
const ENTERED_FILL = [10, 20, 30, Math.round(255 * 0.5)];
const DIMMED = [1, 2, 3, Math.round(255 * 0.18)];
const EDGE = [200, 100, 50, Math.round(255 * 0.8)];

test('squares of a reachable level get the light wash, entered ones the stronger wash, the rest are dimmed', () => {
    const reach: LevelReach[] = ['reachable', null, 'entered'];
    expect(reachImage(layer, reach)).not.toBeNull();

    // the middle of a square, clear of its edge line
    expect(pixel(0, 0, 1, 1)).toEqual(REACHABLE_FILL);
    expect(pixel(2, 0, 1, 1)).toEqual(DIMMED);
    expect(pixel(0, 1, 1, 1)).toEqual(ENTERED_FILL);
    // the square no level reaches
    expect(pixel(3, 0, 1, 1)).toEqual(DIMMED);
});

test('a reached square has an edge line along the sides that face unreached squares only', () => {
    reachImage(layer, ['reachable', null, null]);

    // square (1, 0) is reached: its west side faces the map border and its east side an unreached square
    expect(pixel(1, 0, 3, 1)).toEqual(EDGE);
    // its west neighbour is reached too, so the line is not there
    expect(pixel(1, 0, 0, 1)).toEqual(REACHABLE_FILL);
});

test('nothing is drawn when no level is reachable', () => {
    expect(reachImage(layer, [null, null, null])).toBeNull();
});

test('a fogged square is left out', () => {
    const fog: Fog = {
        knownLayers: () => ['ground'],
        levelHidden: () => false,
        at: () => false,
        rects: () => [],
        open: () => [],
        cover: (_key, x, y) => x === 0 && y === HEIGHT - 1,
        screens: () => [0, 0],
    };
    reachImage(layer, ['reachable', null, null], fog);

    // world y = HEIGHT - 1 is the north row, so square (0, 0) is fogged
    expect(pixel(0, 0, 1, 1)).toEqual([0, 0, 0, 0]);
    expect(pixel(1, 0, 1, 1)).toEqual(REACHABLE_FILL);
});
