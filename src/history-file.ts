// overworld.history (entity diffs, ocean changes and the hero position)
import { Reader } from './reader.ts';
import type { Position } from './types.ts';

/** An entity diff (type 1) or CREATION_OR_DESTRUCTION record (type 2) of entity `pid`; `destroyed` is set on type 2. */
export interface EntityAction {
    type: 1 | 2;
    pid: number;
    etype: number;
    blob: Uint8Array;
    key: number;
    destroyed?: boolean;
    start: boolean;
}

/** An OCEAN_CHANGE undo action: square `index` of Ocean_Map `pid` changed from `old` to `new`. */
export interface OceanChange {
    type: 3;
    pid: number;
    index: number;
    old: number;
    new: number;
    key: number;
    start: boolean;
}

/** An action of an undo record. */
export type UndoAction = EntityAction | OceanChange;

/**
 * A history as the page reads it: the entity types, every kept action, and the hero. The empty save the page shows
 * before a file is loaded is a History with only these fields (and `demo`, `fogStates` and `pinsOn`).
 */
export interface History {
    version: number;
    types: Array<{ name: string; version: number }>;
    actions: UndoAction[];
    hero: Position | null;
    heroKey: number;
    /** Every position a kept record shows the hero at, by "x,y,z". */
    heroes?: Map<string, Position>;
    /** [record key, position, whether it is the level-start record] per record. */
    heroAt?: Array<[key: number, hero: Position, start: boolean]>;
    /** The number of records read whole. */
    records?: number;
    /** Where the file stopped parsing. */
    error?: string | null;
    /** Region states per fog entity pid. */
    fogStates?: Map<number, Uint8Array>;
    /** The Area_Pins on at the start. */
    pinsOn?: number[];
    demo?: boolean;
}

/** What parseHistory returns: a History with the fields of a parsed file. */
export interface ParsedHistory extends History {
    heroes: Map<string, Position>;
    heroAt: Array<[key: number, hero: Position, start: boolean]>;
    records: number;
    error: string | null;
}

const HISTORY_VERSIONS = [70, 72, 73];

// One undo record: a fixed header, move transactions, lily groups, then undo actions. Move transactions, lily
// groups and scrape changes are skipped by size. Each action gets the record's key: the larger first move + span, then
// the later mip level (state.md "Overworld state from the save"); the level-start record after the mip levels
// (Action_Icon START, first move 0, no moves) ranks oldest. A record is applied to `history` only once it has been read
// whole.
function readUndoActions(reader: Reader, history: ParsedHistory, start: boolean, mipLevel: number): void {
    const firstMove = reader.n64();
    const span = reader.u32();
    reader.skip(20); // active guy, flags, time
    const hero: Position = [reader.s32(), reader.s32(), reader.s32()];
    const key = start ? 0 : (firstMove + span) * 16 + mipLevel;
    const actions: UndoAction[] = [];

    for (let remaining = reader.u32(); remaining > 0; remaining--) {
        const transactionVersion = reader.u16();
        reader.skip(32 + (transactionVersion >= 3 ? 1 : 0)); // times, id, duration, flags, lily group (v3+)
        // single move: u16 version + 145 bytes at every version (versioned members are structs, whose leaves are always
        // written), then its deprecated charm Move_Infos
        for (let moves = reader.n64(); moves > 0; moves--) {
            reader.skip(147);
            reader.skip(80 * reader.n64());
        }
    }

    // lily groups: a signed count byte, so one of 128 or more reads none
    for (let remaining = reader.s8(); remaining > 0; remaining--) {
        reader.skip(5);
        reader.skip(12 * reader.u32());
        reader.skip(16 * reader.u32());
    }

    for (let remaining = reader.u32(); remaining > 0; remaining--) {
        const actionStart = reader.position;
        const type = reader.u8();
        if (type === 1 || type === 2) {
            const entityAction: EntityAction = {
                type,
                pid: reader.u32(),
                etype: reader.n64(),
                blob: reader.bytes(reader.n64()),
                key,
                start,
            };
            // CREATION_OR_DESTRUCTION: 1 when the record destroyed the entity (the blob is the entity as it was), 0
            // when it created it
            if (type === 2) entityAction.destroyed = reader.u8() === 1;
            actions.push(entityAction);
        } else if (type === 3) {
            // ocean change, 10 bytes
            actions.push({
                type,
                pid: reader.u32(),
                index: reader.u32(),
                old: reader.u8(),
                new: reader.u8(),
                key,
                start,
            });
        } else if (type === 4) {
            reader.skip(9); // scrape change: s16 x, y, z, u8 old, new, axis
        } else {
            throw new Error(`unknown undo action type ${type} at byte ${actionStart}`);
        }
    }

    if (span && (hero[0] || hero[1] || hero[2])) {
        history.heroes.set(hero.join(','), hero);
        history.heroAt.push([key, hero, start]);
        if (history.heroKey < key) {
            history.hero = hero;
            history.heroKey = key;
        }
    }

    for (const action of actions) history.actions.push(action);
    history.records++;
}

/**
 * A file that stops parsing keeps the records read before the bad one; `error` says where it stopped and `records`
 * counts the records read whole.
 */
export function parseHistory(buffer: Uint8Array | ArrayBuffer): ParsedHistory {
    const reader = new Reader(buffer);
    const history: ParsedHistory = {
        version: reader.u32(),
        types: [],
        actions: [],
        hero: null,
        heroKey: -1,
        heroes: new Map(),
        heroAt: [],
        records: 0,
        error: null,
    };

    let versionTag = `v${history.version}`;
    if (!HISTORY_VERSIONS.includes(history.version)) versionTag += ', which the game does not load';
    reader.skip(12); // level data version, base entity version

    for (let remaining = reader.n64(); remaining > 0; remaining--) {
        history.types.push({ name: reader.str64(), version: reader.n64() });
    }

    reader.skip(24); // move counters
    const mipLevels = reader.u8();

    let where: string | undefined;
    let start: number | undefined;

    try {
        for (let mipLevel = 0; mipLevel < mipLevels; mipLevel++) {
            where = `mip level ${mipLevel} header`;
            start = reader.position;
            reader.skip(14);
            const recordCount = reader.n64();
            for (let i = 0; i < recordCount; i++) {
                where = `mip level ${mipLevel} record ${i + 1} of ${recordCount}`;
                start = reader.position;
                readUndoActions(reader, history, false, mipLevel);
            }
        }
        where = 'the level-start record';
        start = reader.position;
        readUndoActions(reader, history, true, 0);
        where = 'the trailer';
        start = reader.position;
        reader.skip(16); // active hero, next pid serials
        if (reader.left) throw new Error(`${reader.left} bytes left after the trailer`);
    } catch (caught) {
        const reason = caught instanceof Error ? caught.message : String(caught);
        const message = `${reason} (${versionTag}, ${where} at byte ${start})`;
        if (!history.records) throw new Error(message, { cause: caught });
        history.error = message;
        if (where !== 'the trailer') history.error += '; kept the records before it';
    }

    return history;
}
