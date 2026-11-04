// The stored room answers: what an exhaustive push search of each screen room found, and which rooms a walker may
// use them for (VIEWER.md "Room answers")
import { cellOnSide, keyOf } from './cells.ts';
import { exists } from './groups.ts';
import type { LevelGeometry } from './geometry.ts';
import { PUSH_LAYER_BITS } from './skills.ts';
import type { WalkGrid } from './walker.ts';
import { latestCell } from './walls.ts';
import { latestF32 } from '../save.ts';

/**
 * One start of a room's search: the hero stands in the ground `reps` (one cell per start component) and the walk has
 * reached all of them. What the search found, with objects given by the cell the level data puts them in: `bridges`
 * per Rock (or spare Gem) the water cells it sinks in, `holders` per Switch cell the objects that stand on it,
 * `filled` per Gem_Slot cell the Gems that stand on it, and `dead` the Monsters that die.
 */
export interface RoomEntry {
    reps: number[];
    bridges: Map<number, number[]>;
    holders: Map<number, number[]>;
    filled: Map<number, number[]>;
    dead: Set<number>;
}

/**
 * A room's answer: its cells, the pids of the Monsters whose attacks cross it, and its starts. `opens`: the states of
 * the Freezers around the room (`boundaryFreezers()`) the answer holds for, each a bit set over those Freezers in
 * ascending order, a bit set for an open Freezer.
 */
export interface StoredRoom {
    cells: number[];
    attackers: number[];
    entries: RoomEntry[];
    opens: number[];
}

// how many Freezers around a room one open-state bit set covers; a room with more has an answer for all closed only
export const MAX_BOUNDARY_FREEZERS = 30;

/**
 * The entries of the rooms a walker may use, by each cell of those rooms, and `covered`: the cells of the rooms whose
 * answer the walker uses, whether or not the answer has entries (a room searched that has nothing to tell is covered
 * too). roomIndexOf() gives the stored answers the save leaves as they are; the walker adds the answers it searches on
 * its own grid for the other rooms (room-search.ts `searchTouchedRooms`).
 */
export interface RoomIndex {
    byCell: Map<number, RoomEntry[]>;
    covered: Set<number>;
}

/** No room answers. */
export const NO_ROOMS: RoomIndex = { byCell: new Map(), covered: new Set() };

/**
 * A stored room as plain numbers, for the file: [cells as differences from the one before (the first from 0),
 * attackers, entries, opens]; an entry is [reps, bridges, holders, filled, dead] and the first three are lists of [key,
 * count, values...].
 */
export type PackedRoom = [cells: number[], attackers: number[], entries: PackedEntry[], opens: number[]];
type PackedEntry = [reps: number[], bridges: number[], holders: number[], filled: number[], dead: number[]];

function packedMap(map: Map<number, number[]>): number[] {
    const flat: number[] = [];

    for (const [key, values] of map) {
        flat.push(key, values.length, ...values);
    }

    return flat;
}

function unpackedMap(flat: number[]): Map<number, number[]> {
    const map = new Map<number, number[]>();

    for (let at = 0; at < flat.length;) {
        const count = flat[at + 1];
        map.set(flat[at], flat.slice(at + 2, at + 2 + count));
        at += 2 + count;
    }

    return map;
}

/** The rooms as plain numbers. */
export function packRooms(rooms: StoredRoom[]): PackedRoom[] {
    return rooms.map((room) => {
        const cells: number[] = [];
        let before = 0;

        for (const cell of room.cells) {
            cells.push(cell - before);
            before = cell;
        }

        const entries = room.entries.map((entry): PackedEntry => {
            return [
                entry.reps,
                packedMap(entry.bridges),
                packedMap(entry.holders),
                packedMap(entry.filled),
                [...entry.dead],
            ];
        });

        return [cells, room.attackers, entries, room.opens];
    });
}

/** The rooms of their plain numbers. */
export function unpackRooms(packed: PackedRoom[]): StoredRoom[] {
    return packed.map(([differences, attackers, entries, opens]) => {
        const cells: number[] = [];
        let before = 0;

        for (const difference of differences) {
            before += difference;
            cells.push(before);
        }

        return {
            cells,
            attackers,
            entries: entries.map(([reps, bridges, holders, filled, dead]) => ({
                reps,
                bridges: unpackedMap(bridges),
                holders: unpackedMap(holders),
                filled: unpackedMap(filled),
                dead: new Set(dead),
            })),
            opens,
        };
    });
}

let stored: StoredRoom[] | null = null;
let touchListsOf = new WeakMap<LevelGeometry, TouchLists>();

/** Sets the answers the walkers use (null: none, every search runs live). */
export function setRoomAnswers(rooms: StoredRoom[] | null): void {
    stored = rooms;
    touchListsOf = new WeakMap();
}

/** The answers the walkers use, null when none are set. */
export function roomAnswers(): StoredRoom[] | null {
    return stored;
}

// what an entity a room's check looks at is
const KIND_ROCK = 0;
const KIND_MOVABLE = 1;
const KIND_MONSTER = 2;
const KIND_SWITCH = 3;
const KIND_GATE = 4;
const KIND_SLOT = 5;
const KIND_STILL = 6;

/** An entity of the level data in a room or beside it: what to compare with the save's latest values. */
interface TouchRow {
    pid: number;
    kind: number;
    column: number;
    row: number;
    z: number;
    cell: number;
    existence: number | undefined;
    // a Switch's pressed, a Gate's open
    flag: boolean;
}

/** What the check of a room reads: its entities, Wall_Sets, Freezers and Ocean_Maps, and the cells' columns. */
interface TouchList {
    rows: TouchRow[];
    wallSets: number[];
    freezers: number[];
    oceans: number[];
    columns: number[];
}

/** The check lists of every stored room, and the rooms a cell lies in or beside (`roomsAt`). */
interface TouchLists {
    rooms: TouchList[];
    roomsAt: Map<number, number[]>;
    monsterRows: Map<number, TouchRow>;
}

function isDefaultExistence(existence: number | undefined): boolean {
    return existence === undefined || !!existence;
}

/** The cells of a room and the cells touching them: beside on every side, above and below. */
function roomAndHalo(geometry: LevelGeometry, cells: number[]): Set<number> {
    const around = new Set<number>(cells);
    const { layerCells } = geometry;

    for (const cell of cells) {
        around.add(cell + layerCells);
        around.add(cell - layerCells);
        for (let side = 0; side < 4; side++) around.add(cellOnSide(geometry, cell, side));
    }

    return around;
}

/** The indices of the Freezers whose cell is in `around`, ascending. */
function freezersIn(geometry: LevelGeometry, around: Set<number>): number[] {
    const freezers: number[] = [];

    geometry.freezerCells.forEach((cell, freezerIndex) => {
        if (around.has(cell)) freezers.push(freezerIndex);
    });

    return freezers;
}

/**
 * The Freezers in a room's cells or beside them (a cell beside it, above or below): those whose state an answer for
 * the room depends on, ascending. A room's `opens` are bit sets over this list.
 */
export function boundaryFreezers(geometry: LevelGeometry, cells: number[]): number[] {
    return freezersIn(geometry, roomAndHalo(geometry, cells));
}

/** The rows of the level data a room's check looks at, with their kind. */
function levelRows(geometry: LevelGeometry): TouchRow[] {
    const world = geometry.world;
    const rows: TouchRow[] = [];

    const add = (
        pid: number,
        column: number,
        row: number,
        z: number,
        kind: number,
        existence: number | undefined,
        flag = false,
    ): void => {
        const cell = keyOf(geometry, column, row, z);
        rows.push({ pid, kind, column, row, z, cell, existence, flag });
    };

    for (const [pid, column, row, z, existence] of world.rocks) add(pid, column, row, z, KIND_ROCK, existence);
    for (const [pid, column, row, z, existence] of world.floors) add(pid, column, row, z, KIND_STILL, existence);
    for (const [pid, column, row, z, existence] of world.trees || []) add(pid, column, row, z, KIND_STILL, existence);
    for (const [pid, column, row, z, existence] of world.blockers || []) {
        add(pid, column, row, z, KIND_STILL, existence);
    }
    for (const [pid, column, row, z, existence] of world.lilies) add(pid, column, row, z, KIND_ROCK, existence);
    for (const [pid, column, row, z, , existence] of world.movables || []) {
        add(pid, column, row, z, KIND_MOVABLE, existence);
    }
    for (const [pid, column, row, z, , existence] of world.fences) add(pid, column, row, z, KIND_STILL, existence);
    for (const [pid, column, row, z, , existence] of world.monsters || []) {
        add(pid, column, row, z, KIND_MONSTER, existence);
    }
    for (const [pid, column, row, z, , existence] of world.gem_slots || []) {
        add(pid, column, row, z, KIND_SLOT, existence);
    }

    for (const [pid, , pressed, column, row, z, existence] of world.switches) {
        add(pid, column, row, z, KIND_SWITCH, existence, !!pressed);
    }

    for (const [pid, column, row, z, open, , , , , existence] of world.gates) {
        add(pid, column, row, z, KIND_GATE, existence, !!open);
    }

    return rows;
}

/** The check lists of the stored rooms on this level data. */
function touchLists(geometry: LevelGeometry, rooms: StoredRoom[]): TouchLists {
    const roomsAt = new Map<number, number[]>();
    const lists: TouchList[] = rooms.map(() => ({ rows: [], wallSets: [], freezers: [], oceans: [], columns: [] }));

    rooms.forEach(({ cells }, roomIndex) => {
        const around = roomAndHalo(geometry, cells);
        lists[roomIndex].freezers = freezersIn(geometry, around);

        for (const cell of around) {
            const at = roomsAt.get(cell);
            if (at) {
                at.push(roomIndex);
            } else {
                roomsAt.set(cell, [roomIndex]);
            }
        }

        const columns = new Set<number>();
        for (const cell of cells) columns.add(cell % geometry.layerCells);
        lists[roomIndex].columns = [...columns];

        const oceans = new Set<number>();
        for (const column of columns) {
            for (const oceanIndex of geometry.waterColumns[column] ?? []) oceans.add(oceanIndex);
        }

        lists[roomIndex].oceans = [...oceans];
    });

    const monsterRows = new Map<number, TouchRow>();

    for (const row of levelRows(geometry)) {
        if (row.kind === KIND_MONSTER) monsterRows.set(row.pid, row);
        for (const roomIndex of roomsAt.get(row.cell) ?? []) lists[roomIndex].rows.push(row);
    }

    geometry.wallSets.forEach((wallSet, wallSetIndex) => {
        const touched = new Set<number>();
        for (const cell of wallSet.cells) {
            for (const roomIndex of roomsAt.get(cell) ?? []) touched.add(roomIndex);
        }

        for (const roomIndex of touched) lists[roomIndex].wallSets.push(wallSetIndex);
    });

    return { rooms: lists, roomsAt, monsterRows };
}

/** Whether the save leaves the entity `pid` existing as the level data has it: on its own and through its Group. */
function existsAsLevel(walkGrid: WalkGrid, pid: number, existence: number | undefined): boolean {
    const { groupOfMember, groupExists, existenceGroups } = walkGrid;
    if (exists(walkGrid, pid, existence) !== isDefaultExistence(existence)) return false;

    const groupIndex = groupOfMember.get(pid);
    if (groupIndex === undefined) return true;

    return groupExists[groupIndex] === !!existenceGroups[groupIndex][1];
}

/** Whether the save leaves the entity of `row` as the level data has it, for what a push search reads. */
function rowAsLevel(walkGrid: WalkGrid, row: TouchRow): boolean {
    const latest = walkGrid.latest;
    const { pid, kind, existence } = row;

    if (!existsAsLevel(walkGrid, pid, existence)) return false;
    if (kind === KIND_STILL) return true;

    if (kind === KIND_SWITCH) {
        const pressed = latest.get(pid, 'pressed');
        return pressed === undefined || (pressed[0] !== 0) === row.flag;
    }

    if (kind === KIND_GATE) {
        const open = latest.get(pid, 'open');
        return open === undefined || (open[0] !== 0) === row.flag;
    }

    if (kind === KIND_SLOT) return latest.get(pid, 'flags') === undefined;

    const movedX = latest.get(pid, 'base.position.x') !== undefined;
    const movedY = latest.get(pid, 'base.position.y') !== undefined;
    const movedZ = latest.get(pid, 'base.position.z') !== undefined;
    const moved = movedX || movedY || movedZ;
    if (moved && latestCell(walkGrid, pid, row.column, row.row, row.z) !== row.cell) return false;

    if (kind === KIND_ROCK) return latest.get(pid, 'properties') === undefined;

    if (latest.get(pid, 'base.theta_target') !== undefined) return false;

    if (kind === KIND_MONSTER) return latestF32(latest, pid, 'dead_t', 0) <= 0;

    return latest.get(pid, 'properties') === undefined && latest.get(pid, 'attached_to_entity_id') === undefined;
}

/**
 * Which of the Freezers in `freezers` are open, as a bit set (bit n: the nth Freezer), else -1 when one beyond
 * MAX_BOUNDARY_FREEZERS is open: no answer holds for that.
 */
function openFreezers(closedFreezers: readonly boolean[], freezers: number[]): number {
    let open = 0;

    for (let bit = 0; bit < freezers.length; bit++) {
        if (closedFreezers[freezers[bit]]) continue;
        if (bit >= MAX_BOUNDARY_FREEZERS) return -1;

        open |= 1 << bit;
    }

    return open;
}

/** Whether the save leaves a stored room as the level data has it, for what its search read. */
function roomAsLevel(
    walkGrid: WalkGrid,
    room: StoredRoom,
    list: TouchList,
    lists: TouchLists,
    createdAt: Set<number>,
): boolean {
    const { geometry, closedFreezers, liveOceans } = walkGrid;

    for (const row of list.rows) {
        if (!rowAsLevel(walkGrid, row)) return false;
    }

    for (const pid of room.attackers) {
        const row = lists.monsterRows.get(pid);
        if (row && !rowAsLevel(walkGrid, row)) return false;
    }

    for (const wallSetIndex of list.wallSets) {
        const { pid, existence } = geometry.wallSets[wallSetIndex];
        if (!existsAsLevel(walkGrid, pid, existence)) return false;
    }

    if (!room.opens.includes(openFreezers(closedFreezers, list.freezers))) return false;

    if (walkGrid.waterColumns !== geometry.waterColumns) {
        for (const column of list.columns) {
            if (walkGrid.waterColumns[column] !== geometry.waterColumns[column]) return false;
        }
    }

    for (const oceanIndex of list.oceans) {
        const existence = geometry.world.oceans[oceanIndex][7];
        if ((liveOceans[oceanIndex] !== 0) !== isDefaultExistence(existence)) return false;
    }

    for (const cell of room.cells) {
        if (createdAt.has(cell)) return false;
    }

    return true;
}

/** The cells the Rocks and Trees the save created stand in. */
function createdCells(walkGrid: WalkGrid): Set<number> {
    const cells = new Set<number>();

    for (const [pid, created] of walkGrid.latest.created) {
        if (created.destroyed) continue;
        if (created.type !== 'Rock' && created.type !== 'Tree') continue;

        const cell = latestCell(walkGrid, pid, 0, 0, 0);
        if (cell >= 0) cells.add(cell);
    }

    return cells;
}

/**
 * The room answers this walker may use: those of the rooms the save leaves as the level data has them (the entities in
 * or beside the room, its Groups, Wall_Sets and water, and no created Rock or Tree in it) with the Freezers around the
 * room in a state the answer holds for. None where no answers are set.
 */
export function roomIndexOf(walkGrid: WalkGrid): RoomIndex {
    const rooms = stored;
    if (!rooms) return NO_ROOMS;

    const geometry = walkGrid.geometry;
    let lists = touchListsOf.get(geometry);
    if (!lists) {
        lists = touchLists(geometry, rooms);
        touchListsOf.set(geometry, lists);
    }

    const createdAt = createdCells(walkGrid);
    const index: RoomIndex = { byCell: new Map(), covered: new Set() };

    rooms.forEach((room, roomIndex) => {
        if (!roomAsLevel(walkGrid, room, lists.rooms[roomIndex], lists, createdAt)) return;

        for (const cell of room.cells) {
            index.covered.add(cell);
            if (room.entries.length > 0) index.byCell.set(cell, room.entries);
        }
    });

    return index;
}

/**
 * The entries of `entries` the walk can use: every start cell reached by the hero in a pushing layer (or standing in a
 * cell `outside` the flood). The start cells not reached go to `watch`, so a search that asks again when one of them
 * is reached finds the entry.
 */
export function reachedEntries(
    walkGrid: WalkGrid,
    outside: Set<number> | null,
    entries: RoomEntry[],
    watch: number[],
): RoomEntry[] {
    const { visited } = walkGrid;
    const reached: RoomEntry[] = [];

    for (const entry of entries) {
        let allReached = true;

        for (const rep of entry.reps) {
            if ((visited[rep] & PUSH_LAYER_BITS) !== 0 || outside?.has(rep) === true) continue;
            allReached = false;
            watch.push(rep);
        }

        if (allReached) reached.push(entry);
    }

    return reached;
}
