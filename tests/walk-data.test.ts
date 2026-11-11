// data/walk.json against the walk on the current level data and code: a stale file (other inputs, or walk code that
// changed since `npm run data:walk`) fails here. The room answers are checked by their inputs; the full search that
// recomputes them runs only with WALK_FULL=1 (PowerShell: $env:WALK_FULL = '1'; npm test -- run tests/walk-data.test.ts)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { beforeAll, expect, test } from 'vitest';
import { roomsFile, storedRooms } from '../scripts/lib/stored-rooms.ts';
import { walkInputs } from '../scripts/lib/walk-inputs.ts';
import { PROG } from '../src/data.ts';
import type { WalkFile } from '../src/types.ts';
import { staticRoles } from '../src/model/static-roles.ts';
import { NO_HISTORY, floorHeights } from '../src/walk/reachability.ts';
import { packRooms, roomAnswers, setRoomAnswers } from '../src/walk/room-answers.ts';
import { searchRooms } from '../src/walk/room-search.ts';
import { teleporterStatesOf } from '../src/walk/teleporters.ts';
import { buildWalkGrid } from '../src/walk/walker.ts';
import { FLOOR_HEIGHTS, STATIC_ROLES, walkReady } from '../src/walk-data.ts';
import { worldReady } from '../src/world-data.ts';

const DATA = join(import.meta.dirname, '..', 'data');
const stored: WalkFile = JSON.parse(readFileSync(join(DATA, 'walk.json'), 'utf8'));
const FULL_SEARCH = process.env.WALK_FULL === '1';

beforeAll(async () => {
    await Promise.all([walkReady, worldReady]);
    setRoomAnswers(storedRooms());
});

test('walk.json was built from the current inputs', () => {
    const current = walkInputs();
    const storedInputs: Record<string, string> = stored.inputs;
    expect(Object.keys(storedInputs)).toEqual(Object.keys(current));
    for (const [name, hash] of Object.entries(current)) expect(storedInputs[name], name).toBe(hash);
});

test('the stored static roles are the ones the walk works out', () => {
    const live = staticRoles()!;
    expect([...STATIC_ROLES.need.l]).toEqual([...live.need.l]);
    expect([...STATIC_ROLES.need.g]).toEqual([...live.need.g]);
    expect(STATIC_ROLES.bg).toEqual(live.bg);
});

test('every Sign has an entry in the stored roles: the Freezers it sits behind, or null', () => {
    expect(STATIC_ROLES.bg.s).toHaveLength(PROG.signs.length);
    for (const behind of STATIC_ROLES.bg.s) {
        for (const freezerIndex of behind ?? []) expect(PROG.freezers[freezerIndex]).toBeDefined();
    }
});

test('a level the table needs is Required, as one of several when its group has several options', () => {
    const need = STATIC_ROLES.need.l;
    const missing: string[] = [];

    PROG.levels.forEach((row, index) => {
        if (need[index] === 0) return;

        for (const group of row.needs ?? []) {
            for (const option of group) {
                if (!('level' in option)) continue;

                const wanted = 1 + Number(need[index] === 2 && group.length === 1);
                if (need[option.level] < wanted) missing.push(`${row.n} -> ${PROG.levels[option.level].n}`);
            }
        }
    });

    expect(missing).toEqual([]);
});

test('the stored floor heights are the ones the walk works out', () => {
    const live = floorHeights()!;
    const storedFloors: Record<string, Float32Array> = FLOOR_HEIGHTS!;
    expect(Object.keys(storedFloors)).toEqual(Object.keys(live));
    for (const [key, heights] of Object.entries(live)) {
        const bytes = new Uint8Array(heights.buffer, heights.byteOffset, heights.byteLength);
        const storedHeights = storedFloors[key];
        const storedBytes = new Uint8Array(storedHeights.buffer, storedHeights.byteOffset, storedHeights.byteLength);
        expect(Buffer.from(storedBytes).equals(Buffer.from(bytes)), key).toBe(true);
    }
});

test.skipIf(!FULL_SEARCH)(
    'the stored room answers are the ones the room search works out',
    { timeout: 120_000 },
    () => {
        const used = roomAnswers();
        setRoomAnswers(null);

        try {
            const allFreezersClosed = PROG.freezers.map(() => true);
            const walkGrid = buildWalkGrid(NO_HISTORY, teleporterStatesOf(null), allFreezersClosed);
            const result = searchRooms(walkGrid);

            const rooms = roomsFile();
            const storedJson = inflateSync(Buffer.from(rooms.data, 'base64')).toString();
            expect(JSON.stringify(packRooms(result.rooms))).toBe(storedJson);
            expect(rooms.searched).toBe(result.searched);
            expect(rooms.variants).toBe(result.variants);
            const answered = result.rooms.filter((room) => room.entries.length > 0).length;
            expect(rooms.answered).toBe(answered);
            expect(rooms.empty).toBe(result.rooms.length - answered);
            expect(rooms.states).toBe(result.states);
            expect(rooms.capped).toEqual(result.capped);
        } finally {
            setRoomAnswers(used);
        }
    },
);
