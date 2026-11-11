// The page's data: the entity schema and data/progress.json, inlined at build time
import SCHEMA from '../data/schema.json' with { type: 'json' };
import PROG from '../data/progress.json' with { type: 'json' };
import type { MapLayerValues } from './types.ts';

/** The bytes of a base64 string. */
export function fromBase64(base64: string): Uint8Array<ArrayBuffer> {
    const text = atob(base64);
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    return bytes;
}

/** The bytes of a zlib stream given as base64. */
export const inflate = async (base64: string): Promise<Uint8Array> => {
    const compressed = new Blob([fromBase64(base64)]);
    const inflated = compressed.stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(inflated).arrayBuffer());
};

/** The three zlib + base64 layer strings of a data file, inflated and each one decoded to its layer's values. */
export async function inflateLayers<Value>(
    values: MapLayerValues<string>,
    decode: (bytes: Uint8Array) => Value,
): Promise<MapLayerValues<Value>> {
    const [underworld, ground, sky] = await Promise.all([
        inflate(values.underworld),
        inflate(values.ground),
        inflate(values.sky),
    ]);
    return { underworld: decode(underworld), ground: decode(ground), sky: decode(sky) };
}

export { SCHEMA, PROG };
