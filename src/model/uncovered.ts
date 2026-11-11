// How much of the map the fog has uncovered: the cleared screens of each layer's primary fog (state.md "Fog of war")
import type { Fog } from '../fog.ts';
import { inFindLayer } from './find-kinds.ts';
import { AREA_LAYERS, layerName } from './layers.ts';
import type { FoundOfTotal } from './totals.ts';

export interface Uncovered {
    screens: FoundOfTotal;
    /** "Overworld 70 / 120 · High 17 / 120", over the layers counted. */
    byLayer: string;
}

/** The cleared screens over every screen, of the layers in `known` (null: every layer), or of `scope` alone. */
export function uncoveredOf(fog: Fog, known: string[] | null, scope: string | null): Uncovered {
    let cleared = 0;
    let total = 0;
    const parts: string[] = [];
    for (const key of AREA_LAYERS) {
        if (known && !known.includes(key)) continue;
        if (!inFindLayer(scope, key)) continue;

        const [layerCleared, layerTotal] = fog.screens(key);
        if (layerTotal <= 0) continue;

        cleared += layerCleared;
        total += layerTotal;
        parts.push(`${layerName(key)} ${layerCleared} / ${layerTotal}`);
    }

    return { screens: [cleared, total], byLayer: parts.join(' · ') };
}
