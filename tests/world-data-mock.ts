// The `world-data` module for a test that mocks '../src/data.ts' with the world cells and the full level data beside the
// page's: `vi.mock('../src/world-data.ts', () => import('./world-data-mock.ts'))`
import * as data from '../src/data.ts';
import type { WorldFile } from '../src/types.ts';
import type { WorldCells } from '../src/world-data.ts';

interface MockedData {
    PROG: WorldFile;
    WORLD: WorldCells;
    worldReady: Promise<void>;
}

function isMockedData(module: object): module is MockedData {
    return 'PROG' in module && 'WORLD' in module && 'worldReady' in module;
}

if (!isMockedData(data)) throw new Error('the test mocks data.ts without the world data');

export const WORLD = data.WORLD;

export const worldReady = data.worldReady;

export const WORLD_FILE = {
    get world() {
        return data.PROG.world;
    },
    get teleporters() {
        return data.PROG.teleporters;
    },
};
