// Writes data/level-cells.json: for each map layer, the level whose door each standable cell is nearest to by
// walking, which the Reachable overlay shades by (docs/DATAFILES.md "level-cells.json", docs/VIEWER.md "The page
// (viewer)").
//
// Reads data/walk.json for the floor heights (run `npm run data:walk` first), so every Freezer is open in it.
//
// Usage: node scripts/build-level-cells.ts
//
// Output: per map layer key a zlib stream (base64) of one u16 (little endian) per map column (row 0 = north) holding the
// index of the nearest level, 0xFFFF where no door reaches the column.
import { statSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PROG } from '../src/data.ts';
import { mapLayerOf } from '../src/model/layers.ts';
import { NO_LEVEL } from '../src/types.ts';
import { mapCol } from '../src/walk/cells.ts';
import { FLOOR_HEIGHTS, walkReady } from '../src/walk-data.ts';
import { assignPatches } from './lib/level-patches.ts';
import type { Door } from './lib/level-patches.ts';
import { writeJsonAtomic } from './lib/output.ts';
import * as paths from './lib/paths.ts';

function doorsByLayer(): Record<string, Door[]> {
    const doors: Record<string, Door[]> = {};
    for (const layer of PROG.map.layers) doors[layer.key] = [];

    PROG.levels.forEach((level, levelIndex) => {
        const [x, y, z] = level.p;
        doors[mapLayerOf(z)].push({ level: levelIndex, column: mapCol(x, y) });
    });

    return doors;
}

async function main(): Promise<void> {
    paths.parseCommandLine();
    await walkReady;
    if (!FLOOR_HEIGHTS) throw new Error('no floor heights: run npm run data:walk first');

    const started = performance.now();
    const [width, height] = PROG.map.size;
    const doors = doorsByLayer();
    const layers: Record<string, string> = {};
    const counts: string[] = [];

    for (const layer of PROG.map.layers) {
        const heights = FLOOR_HEIGHTS[layer.key];
        const patches = assignPatches(heights, width, height, doors[layer.key]);
        const bytes = new Uint8Array(patches.buffer, patches.byteOffset, patches.byteLength);
        layers[layer.key] = deflateSync(bytes, { level: 9 }).toString('base64');

        const standable = heights.filter((value) => !Number.isNaN(value)).length;
        const assigned = patches.filter((value) => value !== NO_LEVEL).length;
        counts.push(`${layer.key} standable ${standable} assigned ${assigned} doors ${doors[layer.key].length}`);
    }

    const cellsPath = paths.data('level-cells.json');
    writeJsonAtomic(cellsPath, layers);
    const seconds = ((performance.now() - started) / 1000).toFixed(2);
    console.log(`${counts.join('; ')}; bytes ${statSync(cellsPath).size} in ${seconds} s`);
}

await main();
