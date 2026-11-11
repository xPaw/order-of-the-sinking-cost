// The walk results that come from the level data alone, worked out at build time (data/walk.json, written by
// scripts/build-walk.ts): the static level roles and the floor heights the map draws. The build script does not import
// this module, so it runs before walk.json exists.
import WALK from '../data/walk.json' with { type: 'json' };
import { inflateLayers } from './data.ts';
import type { MapLayerValues, WalkFile } from './types.ts';

const NO_FLOOR = 0;
const FLOOR_OFFSET = 128;

/** The static roles of data/walk.json unpacked: a role per level and per Freezer, and what each sits behind. */
export interface StoredRoles {
    need: { l: Uint8Array; g: Uint8Array };
    bg: WalkFile['roles']['bg'];
}

function storedRoles(roles: WalkFile['roles']): StoredRoles {
    const digits = (text: string) => Uint8Array.from(text, Number);
    return {
        need: { l: digits(roles.need.l), g: digits(roles.need.g) },
        bg: roles.bg,
    };
}

function floorColumns(bytes: Uint8Array): Float32Array {
    const heights = new Float32Array(bytes.length);
    for (let column = 0; column < bytes.length; column++) {
        if (bytes[column] === NO_FLOOR) heights[column] = NaN;
        else heights[column] = bytes[column] - FLOOR_OFFSET;
    }

    return heights;
}

/** The static roles, as staticRoles() (src/model/static-roles.ts) returns them. */
export const STATIC_ROLES = storedRoles(WALK.roles);

/** Per map layer key, as floorHeights() (src/walk/reachability.ts) returns them; null until walkReady. */
export let FLOOR_HEIGHTS: MapLayerValues<Float32Array> | null = null;

/** The floor heights are unpacked. */
export const walkReady: Promise<void> = inflateLayers(WALK.floors, floorColumns)
    .then((floors) => {
        FLOOR_HEIGHTS = floors;
    })
    .catch((error) => console.error('walk data', error));
