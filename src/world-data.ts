// The walk's data: data/world.json, and its static cells unpacked. Only scripts and tests import this module, so the
// page bundle never holds it.
import WORLD_FILE from '../data/world.json' with { type: 'json' };
import { inflate } from './data.ts';

/** The world cells of data/world.json, unpacked: static solid voxels, Wall_Set group cells and water per column. */
export interface WorldCells {
    solid: Uint8Array;
    groups: Uint8Array;
    water: Uint8Array;
}

/** null until `worldReady` settles. */
export let WORLD: WorldCells | null = null;

async function unpackWorld(): Promise<void> {
    const world = WORLD_FILE.world;

    try {
        const [solid, groups, water] = await Promise.all([
            inflate(world.solid),
            inflate(world.group_cells),
            inflate(world.water),
        ]);
        WORLD = { solid, groups, water };
    } catch (error) {
        console.error('world data', error);
    }
}

/** Settles once the world cells are unpacked (or failed to be). */
export const worldReady: Promise<void> = unpackWorld();

export { WORLD_FILE };
