// Fog of war: the regions a save has cleared, from data/fog.json via data/progress.json (state.md "Fog of war")
import { PROG } from './data.ts';
import { historyEntry } from './files.ts';
import { FOG_LAYER_KEYS } from './model/layers.ts';
import type { FoundOfTotal } from './model/totals.ts';
import { FOG_TYPE } from './schema-types.ts';
import { decodeBlob } from './save.ts';
import type { History } from './save.ts';
import type { Position } from './types.ts';
import { mod } from './walk/cells.ts';

/** A rectangle of world coordinates: x, y, width, height. */
export type FogRect = [x: number, y: number, width: number, height: number];

/** What a save has cleared of the fog. */
export interface Fog {
    /** Map layer keys with at least one fog region cleared. */
    knownLayers: () => string[];
    levelHidden: (name: string, position?: Position | null) => boolean;
    /** Whether a world point of one map layer lies under fog: in a region not cleared, or inside a FILLED fog box. */
    at: (key: string, x: number, y: number, z: number) => boolean;
    /** Fogged rectangles of one map layer, in world coordinates. */
    rects: (key: string) => FogRect[];
    /** Cleared regions of one map layer, in world coordinates. */
    open: (key: string) => FogRect[];
    /**
     * Whether the map draws fog over a square of one map layer: a region not cleared, or a FILLED fog box at any height,
     * since the map draws a box over its whole footprint.
     */
    cover: (key: string, x: number, y: number) => boolean;
    /** The cleared screens of one map layer's primary fog, over its screens. */
    screens: (key: string) => FoundOfTotal;
}

const fogCache = new WeakMap<object, Fog>();

// the region (screen) of the primary fog a world square is in; positions wrap with the world
function fogRegionAt(x: number, y: number): number {
    const grid = PROG.fog.grid;
    const [cornerX, cornerY] = grid.corner;
    const [screenWidth, screenHeight] = grid.screen;
    const [columns, rows] = grid.count;
    const column = mod(Math.floor((x - cornerX) / screenWidth), columns);
    const row = mod(Math.floor((y - cornerY) / screenHeight), rows);
    return column + columns * row;
}

// the region states of each fog entity in the history, by pid: the history's own, raised by its newest Fog_Of_War
// diffs
function regionStates(history: History): Map<number, Uint8Array> {
    const fogEntities = [...PROG.fog.primary, ...PROG.fog.boxes];
    const pids = new Set(fogEntities.map((fog) => fog.pid));
    const states = new Map(
        [...(history.fogStates || [])].map(([pid, regions]): [number, Uint8Array] => [pid, regions.slice()]),
    );

    for (const action of history.actions) {
        if (action.type === 3) continue;

        const pid = action.pid >>> 0;
        if (!pids.has(pid) || history.types[action.etype]?.name !== FOG_TYPE) continue;

        let diff;
        try {
            diff = decodeBlob(action.blob, FOG_TYPE, action.type === 1);
        } catch {
            continue;
        }
        const raw = diff.fields.find((field) => field.f.n === 'region_states')?.new?.raw;
        if (!raw) continue;

        // kept history only moves towards cleared, so the element-wise max is the current state
        const current = states.get(pid);
        if (!current || current.length !== raw.length) {
            states.set(pid, Uint8Array.from(raw));
        } else {
            raw.forEach((value, index) => {
                if (value > current[index]) current[index] = value;
            });
        }
    }

    return states;
}

/** Region states per fog entity, from the newest Fog_Of_War diffs in overworld.history; null without that file. */
export function fogOf(camp: string): Fog | null {
    if (!PROG.fog) return null;

    const historyFile = historyEntry(camp);
    if (!historyFile) return null;

    const history = historyFile.parsed!;
    const cached = fogCache.get(history);
    if (cached) return cached;

    const states = regionStates(history);
    const grid = PROG.fog.grid;
    const [cornerX, cornerY] = grid.corner;
    const [screenWidth, screenHeight] = grid.screen;
    const [columns, rows] = grid.count;
    const regionCount = columns * rows;

    const primary = PROG.fog.primary.map((fog) => {
        const regions = states.get(fog.pid);
        if (regions && regions.length === regionCount) return { layer: fog.layer, regions };
        return { layer: fog.layer, regions: null };
    });

    const boxes = PROG.fog.boxes.map((box) => {
        const boxState = states.get(box.pid)?.[0] ?? 0;
        return { ...box, filled: boxState <= 0 };
    });
    const fogged = (layer: number, region: number) => {
        const layerFog = primary.find((fog) => fog.layer === layer);
        return !!layerFog && (!layerFog.regions || layerFog.regions[region] === 0);
    };

    const inXY = (box: { min: Position; max: Position }, x: number, y: number) =>
        x >= box.min[0] && x < box.max[0] && y >= box.min[1] && y < box.max[1];
    const inBox = (layer: number, x: number, y: number, z: number) =>
        boxes.some((box) => box.filled && box.layer === layer && inXY(box, x, y) && z >= box.min[2] && z < box.max[2]);
    const underBox = (layer: number, x: number, y: number) =>
        boxes.some((box) => box.filled && box.layer === layer && inXY(box, x, y));
    const regionRect = (region: number): FogRect => [
        cornerX + screenWidth * (region % columns),
        cornerY + screenHeight * Math.floor(region / columns),
        screenWidth,
        screenHeight,
    ];

    const fog: Fog = {
        knownLayers: () =>
            FOG_LAYER_KEYS.filter((_key, layer) =>
                primary.some((entity) => entity.layer === layer && entity.regions?.some((value) => value > 0)),
            ),
        levelHidden: (name, position) => {
            const levelRegion = PROG.fog.levels[name];
            if (!levelRegion) return false;
            if (fogged(levelRegion[0], levelRegion[1])) return true;
            return !!position && inBox(levelRegion[0], position[0], position[1], position[2]);
        },
        at: (key, x, y, z) => {
            const layer = FOG_LAYER_KEYS.indexOf(key);
            return layer >= 0 && (fogged(layer, fogRegionAt(x, y)) || inBox(layer, x, y, z));
        },
        rects: (key) => {
            const layer = FOG_LAYER_KEYS.indexOf(key);
            if (layer < 0) return [];

            const rects: FogRect[] = [];
            for (let region = 0; region < regionCount; region++) {
                if (fogged(layer, region)) rects.push(regionRect(region));
            }
            for (const box of boxes) {
                if (box.filled && box.layer === layer) {
                    rects.push([box.min[0], box.min[1], box.max[0] - box.min[0], box.max[1] - box.min[1]]);
                }
            }
            return rects;
        },
        open: (key) => {
            const layer = FOG_LAYER_KEYS.indexOf(key);
            const rects: FogRect[] = [];
            if (layer < 0) return rects;

            for (let region = 0; region < regionCount; region++) {
                if (!fogged(layer, region)) rects.push(regionRect(region));
            }
            return rects;
        },
        cover: (key, x, y) => {
            const layer = FOG_LAYER_KEYS.indexOf(key);
            return layer >= 0 && (fogged(layer, fogRegionAt(x, y)) || underBox(layer, x, y));
        },
        screens: (key) => {
            const layer = FOG_LAYER_KEYS.indexOf(key);
            if (layer < 0) return [0, 0];

            let cleared = 0;
            for (let region = 0; region < regionCount; region++) {
                if (!fogged(layer, region)) cleared++;
            }
            return [cleared, regionCount];
        },
    };

    fogCache.set(history, fog);
    return fog;
}

/** With no fog data, everything but what the save shows the player has done counts as fogged. */
export const NO_FOG: Fog = {
    knownLayers: () => ['ground'],
    levelHidden: () => true,
    at: () => true,
    open: () => [],
    cover: () => true,
    screens: () => [0, 0],
    rects: () => {
        const [cornerX, cornerY] = PROG.map?.corner || [0, 0];
        const [width, height] = PROG.map?.size || [0, 0];
        return [[cornerX, cornerY, width, height]];
    },
};
