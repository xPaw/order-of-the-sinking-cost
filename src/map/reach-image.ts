// The Reachable overlay image of one map layer, from the cells nearest to the levels the save can reach (VIEWER.md "The
// page (viewer)")
import { PROG } from '../data.ts';
import type { Fog } from '../fog.ts';
import { LEVEL_CELLS } from '../level-cells.ts';
import type { LevelReach } from '../model/progress-model.ts';
import type { MapLayer } from '../types.ts';
import { INK_RGB, REACH_EDGE_RGB, REACH_RGB } from './colors.ts';
import type { Rgb } from './colors.ts';

/** A pixel's colour and alpha byte. */
type ReachPixel = [color: Rgb, alpha: number];

/** The Reachable images are painted MAP_SCALE pixels per square, so they stay crisp when zoomed. */
const MAP_SCALE = 4;

/** A data URL of a map-sized image (MAP_SCALE pixels per square) whose RGBA bytes fill(pixels) writes. */
function imageUrl(fill: (pixels: Uint8ClampedArray) => void): string {
    const [width, height] = PROG.map.size;
    const canvas = document.createElement('canvas');
    canvas.width = width * MAP_SCALE;
    canvas.height = height * MAP_SCALE;

    const context = canvas.getContext('2d')!;
    const image = context.createImageData(canvas.width, canvas.height);
    fill(image.data);
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
}

/** Writes a colour (and alpha) to the pixel at a byte offset of image data. */
const putPixel = (pixels: Uint8ClampedArray, offset: number, color: Rgb, alpha: number): void => {
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = alpha;
};

/** The byte offset of pixel (x, y) of square (i, j) in an image of a map width squares wide. */
const pixelOffset = (width: number, i: number, j: number, x: number, y: number): number =>
    ((j * MAP_SCALE + y) * width * MAP_SCALE + i * MAP_SCALE + x) * 4;

// the alpha of a reachable square's wash, of an entered level's wash, of the edge line and of an unreached square's
// dimming
const REACH_FILL = 0.32;

const ENTERED_FILL = 0.5;
const REACH_EDGE = 0.8;
const REACH_DIM = 0.18;

// per square of the overlay: left out (fogged), reachable, entered, dimmed
const LEFT_OUT = 0;

const REACHABLE = 1;
const ENTERED = 2;
const DIMMED = 3;

// a pixel's colour and alpha byte: the edge line, a reachable square's wash, an entered level's wash or an unreached
// square's dimming
const EDGE_PIXEL: ReachPixel = [REACH_EDGE_RGB, Math.round(255 * REACH_EDGE)];

const REACHABLE_PIXEL: ReachPixel = [REACH_RGB, Math.round(255 * REACH_FILL)];
const ENTERED_PIXEL: ReachPixel = [REACH_RGB, Math.round(255 * ENTERED_FILL)];
const DIMMED_PIXEL: ReachPixel = [INK_RGB, Math.round(255 * REACH_DIM)];

function reachPixel(onEdge: boolean, kind: number): ReachPixel {
    if (onEdge) return EDGE_PIXEL;
    if (kind === REACHABLE) return REACHABLE_PIXEL;
    if (kind === ENTERED) return ENTERED_PIXEL;
    return DIMMED_PIXEL;
}

// whether a square kind is marked: reachable or entered
const isMarked = (kind: number): boolean => kind === REACHABLE || kind === ENTERED;

/**
 * The overlay square kind of a level's cell: ENTERED where the save entered the level, REACHABLE where it can reach it,
 * DIMMED otherwise.
 */
function kindOf(level: number, reach: readonly LevelReach[]): number {
    // NO_LEVEL is past the last level, so it reads as unreached
    const levelReach = reach[level];
    if (levelReach === 'entered') return ENTERED;
    if (levelReach === 'reachable') return REACHABLE;
    return DIMMED;
}

/**
 * The Reachable overlay of one layer, MAP_SCALE pixels per square: squares nearest to a level that `reach` marks get a
 * light --reach wash (a stronger one when the level is entered) with a soft --reach-edge line inside them along the
 * sides that face unmarked squares; every other square is dimmed a little. With fog given, fogged squares are left out,
 * so the image holds nothing the fog hides. null when no square is marked, or the level cells are not unpacked.
 */
export function reachImage(layer: MapLayer, reach: readonly LevelReach[], fog?: Fog | null): string | null {
    const levelCells = LEVEL_CELLS?.[layer.key];
    if (!levelCells) return null;

    const [width, height] = PROG.map.size;
    const [cornerX, cornerY] = PROG.map.corner;
    const kinds = new Uint8Array(width * height);
    let anyReached = false;

    for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
            if (fog?.cover(layer.key, cornerX + i, cornerY + height - 1 - j)) continue;

            const square = j * width + i;
            kinds[square] = kindOf(levelCells[square], reach);
            if (kinds[square] !== DIMMED) anyReached = true;
        }
    }

    if (!anyReached) return null;

    const reached = (i: number, j: number): boolean => {
        if (i < 0 || j < 0 || i >= width || j >= height) return false;

        return isMarked(kinds[j * width + i]);
    };

    // per side (west, east, north, south) of the square drawn: whether a reached square faces an unreached one there
    const edges = [false, false, false, false];

    return imageUrl((pixels) => {
        for (let j = 0; j < height; j++) {
            for (let i = 0; i < width; i++) {
                const kind = kinds[j * width + i];
                if (kind === LEFT_OUT) continue;

                const marked = isMarked(kind);
                edges[0] = marked && !reached(i - 1, j);
                edges[1] = marked && !reached(i + 1, j);
                edges[2] = marked && !reached(i, j - 1);
                edges[3] = marked && !reached(i, j + 1);

                for (let y = 0; y < MAP_SCALE; y++) {
                    for (let x = 0; x < MAP_SCALE; x++) {
                        const onWest = edges[0] && x === 0;
                        const onEast = edges[1] && x === MAP_SCALE - 1;
                        const onNorth = edges[2] && y === 0;
                        const onSouth = edges[3] && y === MAP_SCALE - 1;
                        const [color, alpha] = reachPixel(onWest || onEast || onNorth || onSouth, kind);
                        putPixel(pixels, pixelOffset(width, i, j, x, y), color, alpha);
                    }
                }
            }
        }
    });
}
