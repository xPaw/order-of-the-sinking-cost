// The room answers of data/rooms.json, unpacked, for the scripts and the tests that run the walker; the page does not
// load them.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import type { RoomsFile } from '../../src/types.ts';
import { unpackRooms } from '../../src/walk/room-answers.ts';
import type { PackedRoom, StoredRoom } from '../../src/walk/room-answers.ts';
import * as paths from './paths.ts';

/** data/rooms.json as the build wrote it. */
export function roomsFile(): RoomsFile {
    return JSON.parse(readFileSync(paths.data('rooms.json'), 'utf8'));
}

/** The answers in data/rooms.json. */
export function storedRooms(): StoredRoom[] {
    const json = inflateSync(Buffer.from(roomsFile().data, 'base64')).toString();
    const packed: PackedRoom[] = JSON.parse(json);
    return unpackRooms(packed);
}
