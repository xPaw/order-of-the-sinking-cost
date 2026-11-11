// The overworld's layers (ground, sky, underworld) and its wrapping (world.md "Ground layers", state.md "Fog of war")
import { PROG } from '../data.ts';

/** The fog's layers by their index in the level data. */
export const FOG_LAYER_KEYS = ['ground', 'underworld', 'sky'];

/** The layers in the order the page lists them. */
export const AREA_LAYERS = ['ground', 'sky', 'underworld'];

/** The map layer a height is on. */
export function mapLayerOf(z: number): string {
    const layers = PROG.map.layers;
    return (layers.find((layer) => z >= layer.z[0] && z < layer.z[1]) || layers[1] || layers[0]).key;
}

const LAYER_NAMES: Record<string, string> = { ground: 'Overworld', sky: 'High', underworld: 'Low' };

/** A layer's name on the page: the overworld, and the High and Low layers above and below it. */
export const layerName = (key: string): string => LAYER_NAMES[key] || key[0].toUpperCase() + key.slice(1);

/** The way into a layer in prose: "the way up to High", "the way down to Low". */
export function wayTo(key: string): string {
    if (key === 'sky') return `the way up to ${layerName(key)}`;
    if (key === 'underworld') return `the way down to ${layerName(key)}`;
    return `the way to ${layerName(key)}`;
}

/** The offset `delta` on a circle of length `size`, taken the short way round: in (-size/2, size/2]. */
export const wrapDelta = (delta: number, size: number): number => delta - Math.ceil(delta / size - 0.5) * size;
