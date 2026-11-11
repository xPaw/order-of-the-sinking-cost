// Writes data/walk.json: what the walk model works out from the level data alone, so the page does not redo it on
// every load.
//
// Reads data/progress.json (the world cells come in through it from data/world.json); writes data/walk.json and
// data/rooms.json.
//
// Usage: node scripts/build-walk.ts [--game DIR]
//
// Output (docs/VIEWER.md "The walk model (viewer)" and "Level roles (viewer)"):
//   walk.json, which the page loads:
//   inputs: per input file name (in data/), the SHA-256 of its bytes, and the SHA-256 of the room search's sources
//     (scripts/lib/walk-inputs.ts); tests/walk-data.test.ts fails when they no longer match. The full recompute of the
//     room answers is opt-in there (WALK_FULL=1)
//   roles: staticRoles() (src/model/static-roles.ts). need.l / need.g: one digit per level / Freezer, 2 Required, 1 Required as
//     one of several, 0 Optional; bg.g / bg.s: per Freezer / Sign, the Freezers it sits behind
//   floors: floorHeights() (src/walk/reachability.ts), per map layer key a zlib stream (base64) of one byte per map column (row 0 =
//     north): the highest z where the hero can stand there plus 128, 0 where he stands nowhere
//   rooms.json, for the scripts and the tests: the push search of the screen rooms (src/walk/room-search.ts), run first
//     on the level data alone: how many rooms it searched with every Freezer closed, how many with some Freezers open,
//     how many answers it stores, the positions it visited, the first cell of each room that hit the cap, and the
//     answers (packRooms in src/walk/room-answers.ts) as a zlib stream (base64) of JSON. The roles and the floors are
//     worked out with these answers in use.
import { statSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PROG } from '../src/data.ts';
import { worldReady } from '../src/world-data.ts';
import { staticRoles } from '../src/model/static-roles.ts';
import { NO_HISTORY, floorHeights } from '../src/walk/reachability.ts';
import { packRooms, setRoomAnswers } from '../src/walk/room-answers.ts';
import { searchRooms } from '../src/walk/room-search.ts';
import { teleporterStatesOf } from '../src/walk/teleporters.ts';
import type { StoredRoles } from '../src/walk-data.ts';
import { buildWalkGrid } from '../src/walk/walker.ts';
import { writeJsonAtomic } from './lib/output.ts';
import * as paths from './lib/paths.ts';
import { walkInputs } from './lib/walk-inputs.ts';

const NO_FLOOR = 0;
const FLOOR_OFFSET = 128;

function packedRoles(roles: StoredRoles) {
    const digits = (need: Uint8Array) => [...need].join('');
    return {
        need: { l: digits(roles.need.l), g: digits(roles.need.g) },
        bg: roles.bg,
    };
}

function floorByte(z: number): number {
    if (Number.isNaN(z)) return NO_FLOOR;
    const value = z + FLOOR_OFFSET;
    if (!Number.isInteger(value) || value <= NO_FLOOR || value > 255) throw new Error(`floor height ${z} has no byte`);
    return value;
}

function packedFloors(heights: Record<string, Float32Array>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, columns] of Object.entries(heights)) {
        const bytes = Uint8Array.from(columns, floorByte);
        out[key] = deflateSync(bytes, { level: 9 }).toString('base64');
    }
    return out;
}

/** The room search on the level data alone (the new game's start: every Freezer closed), as the file holds it. */
function packedRooms() {
    const allFreezersClosed = PROG.freezers.map(() => true);
    const walkGrid = buildWalkGrid(NO_HISTORY, teleporterStatesOf(null), allFreezersClosed);
    const result = searchRooms(walkGrid);
    const json = JSON.stringify(packRooms(result.rooms));

    const answered = result.rooms.filter((room) => room.entries.length > 0).length;

    const packed = {
        searched: result.searched,
        variants: result.variants,
        answered,
        empty: result.rooms.length - answered,
        states: result.states,
        capped: result.capped,
        data: deflateSync(Buffer.from(json), { level: 9 }).toString('base64'),
    };

    return { packed, rooms: result.rooms };
}

async function main(): Promise<void> {
    paths.parseCommandLine();
    await worldReady;
    const started = performance.now();
    const { packed, rooms } = packedRooms();
    const searchSeconds = (performance.now() - started) / 1000;
    setRoomAnswers(rooms);
    const roles = staticRoles();
    if (!roles) throw new Error('no static roles: progress.json has no world cells or no start position');
    const heights = floorHeights();
    if (!heights) throw new Error('no floor heights: progress.json has no world cells');
    const out = {
        inputs: walkInputs(),
        roles: packedRoles(roles),
        floors: packedFloors(heights),
    };
    const walkPath = paths.data('walk.json');
    writeJsonAtomic(walkPath, out);
    writeJsonAtomic(paths.data('rooms.json'), packed);
    const required = [...roles.need.l].filter((need) => need > 0).length;
    console.log(
        `levels ${roles.need.l.length} required ${required} gates ${roles.need.g.length} ` +
            `floor layers ${Object.keys(heights).length} rooms searched ${packed.searched} ` +
            `variants ${packed.variants} answered ${packed.answered} empty ${packed.empty} ` +
            `capped ${packed.capped.length} states ${packed.states} search ${searchSeconds.toFixed(1)} s ` +
            `bytes ${statSync(walkPath).size}`,
    );
}

await main();
