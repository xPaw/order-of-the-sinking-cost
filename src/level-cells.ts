// The level of each map cell, from data/level-cells.json (written by scripts/build-level-cells.ts): per map layer, the
// level whose door the cell is nearest to by walking
import CELLS from '../data/level-cells.json' with { type: 'json' };
import { inflateLayers } from './data.ts';
import type { MapLayerValues } from './types.ts';

function levelColumns(bytes: Uint8Array): Uint16Array {
    return new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Uint16Array.BYTES_PER_ELEMENT);
}

/** Per map layer key, the index of the nearest level per map column (row 0 = north), NO_LEVEL for none; null until levelCellsReady. */
export let LEVEL_CELLS: MapLayerValues<Uint16Array> | null = null;

/** The cells are unpacked. They are small, so they unpack at load rather than on first use. */
export const levelCellsReady: Promise<void> = inflateLayers(CELLS, levelColumns)
    .then((cells) => {
        LEVEL_CELLS = cells;
    })
    .catch((error) => console.error('level cells', error));
