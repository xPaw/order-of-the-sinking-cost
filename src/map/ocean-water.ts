// The squares an OCEAN_CHANGE turned into water (state.md "Water in the save"), drawn over the map's images
import { fromBase64, PROG } from '../data.ts';
import type { LatestValues } from '../save.ts';
import { mapCol } from '../walk/cells.ts';
import { FLOOR_HEIGHTS } from '../walk-data.ts';

/** The squares of each map layer that a change turned into water, as world (x, y) per square. */
export type OceanSquares = Record<string, Array<[x: number, y: number]>>;

// the bytes of an Ocean_Map's base64 water mask, decoded once
const waterMasks = new WeakMap<object, Uint8Array>();

function waterMask(ocean: { water: string }): Uint8Array {
    let bytes = waterMasks.get(ocean);
    if (!bytes) {
        bytes = fromBase64(ocean.water);
        waterMasks.set(ocean, bytes);
    }

    return bytes;
}

const bitSet = (bits: Uint8Array, index: number): number => (bits[index >> 3] >> (index & 7)) & 1;

/**
 * Squares that an OCEAN_CHANGE of the save's latest state turned into water, per map layer, where the walk's floor lies
 * below the water surface (or there is no floor).
 */
export function oceanWater(latest: LatestValues | null | undefined): OceanSquares {
    const squares: OceanSquares = {};
    const map = PROG.map;
    if (!latest?.ocean.length || !map?.oceans) return squares;

    const oceanByPid = new Map(map.oceans.map((ocean) => [ocean.pid, ocean]));
    const [cornerX, cornerY] = map.corner;
    const [width, height] = map.size;

    for (const change of latest.ocean) {
        const ocean = oceanByPid.get(change.pid);
        if (!ocean) continue;

        const layer = map.layers[ocean.layer];
        if (!layer || !(change.new & 1) || change.index >= ocean.sx * ocean.sy) continue;

        // water from the start
        if (bitSet(waterMask(ocean), change.index)) continue;

        const square = mapCol(ocean.x0 + (change.index % ocean.sx), ocean.y0 + Math.floor(change.index / ocean.sx));
        const i = square % width;
        const j = height - 1 - Math.floor(square / width);
        const floorHeight = FLOOR_HEIGHTS?.[layer.key]?.[square];
        const hasFloor = floorHeight !== undefined && !Number.isNaN(floorHeight);
        if (hasFloor && floorHeight >= ocean.zw) continue;

        let layerSquares = squares[layer.key];
        if (!layerSquares) {
            layerSquares = [];
            squares[layer.key] = layerSquares;
        }
        layerSquares.push([cornerX + i, cornerY + j]);
    }

    return squares;
}
