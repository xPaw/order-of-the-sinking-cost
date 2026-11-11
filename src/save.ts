// Save files: Status.sokoban_status, overworld.history and entity diff blobs
import { SCHEMA } from './data.ts';
import { createBlobDecoder } from './blob.ts';
import { LATEST_TYPES } from './schema-types.ts';
import type { DecodedBlob } from './blob.ts';
import type { History, OceanChange } from './history-file.ts';
import type { SchemaField } from './types.ts';

export { parseHistory } from './history-file.ts';
export type { History, OceanChange } from './history-file.ts';
export { parseStatus } from './status-file.ts';

/** The latest CREATION_OR_DESTRUCTION record of an entity. */
export interface Creation {
    type: string | undefined;
    destroyed: boolean;
}

/**
 * latestOf() of a history: the latest raw value per (pid, field), the ocean changes, the created entities and the Guys'
 * skill changes.
 */
export interface LatestValues {
    get(pid: number, field: string): Uint8Array | undefined;
    ocean: OceanChange[];
    created: Map<number, Creation>;
    skills: Map<number, Array<[key: number, skillFlags: number]>>;
    firstHeadings: Map<number, number>;
}

interface Keyed<Value> {
    key: number;
    value: Value;
}

// Latest value per (pid, field) of the entity state the overworld views use, and per (pid, square) of ocean changes
const LATEST_FIELDS = [
    'base.entity_flags',
    'base.position.x',
    'base.position.y',
    'base.position.z',
    'discovered',
    'enabled_t_target',
    'activated',
    'open',
    'pressed',
    'played',
    'activation_order',
    'base.theta_target',
    'dead_t',
    'skill_flags',
    'inventory_flags',
    'powered',
    'properties',
    'exists',
    'flags',
    'attached_to_entity_id',
    'rank_satisfied',
];

// LATEST_FIELDS indices: by name, and per schema field descriptor ('base.' + its name for a base field; -1 when not kept)
const LATEST_INDEX = new Map<string, number>(LATEST_FIELDS.map((name, index) => [name, index]));

const fieldIndex = new WeakMap<SchemaField, number>();

const latestIndex = (field: SchemaField, derived: boolean): number => {
    let index = fieldIndex.get(field);
    if (index === undefined) {
        index = LATEST_INDEX.get((derived ? '' : 'base.') + field.n) ?? -1;
        fieldIndex.set(field, index);
    }

    return index;
};

const latestCache = new WeakMap<History, LatestValues>();

/** Makes latestOf(history) return `latest`: a history whose latest values are built by hand, for tests and scripts. */
export function overrideLatest(history: History, latest: LatestValues): void {
    latestCache.set(history, latest);
}

const ZERO32 = new Uint8Array(4);
const LATEST_FIELD_SLOTS = 32;

/**
 * Values are keyed pid * LATEST_FIELD_SLOTS + LATEST_FIELDS index. On equal keys the first CHANGE wins, but a
 * CREATION_OR_DESTRUCTION action wins over the actions before it (an Activator reset destroys and creates the same pid
 * in one record).
 * `created`: per pid with CREATION_OR_DESTRUCTION records, the latest one's { type, destroyed }; a created entity's blob
 * holds the whole entity, a position axis missing from it is 0. `skills`: per Guy pid, [record key, skill_flags] of its
 * CHANGE actions, in history order. `firstHeadings`: per Lily pid, the side (0 east, 1 north, 2 west, 3 south) of the
 * first `moving_direction` the history records for it: the way its first move went.
 */
export function latestOf(history: History): LatestValues {
    const cached = latestCache.get(history);
    if (cached) return cached;

    const values = new Map<number, Keyed<Uint8Array>>();
    const ocean = new Map<string, Keyed<OceanChange>>();
    const creations = new Map<number, Keyed<Creation>>();
    const skills = new Map<number, Array<[number, number]>>();
    const headings = new Map<number, Keyed<number>>();
    const put = <Entry, Value>(
        map: Map<Entry, Keyed<Value>>,
        entry: Entry,
        key: number,
        value: Value,
        later = false,
    ) => {
        const existing = map.get(entry);
        if (!existing || key > existing.key || (later && key === existing.key)) map.set(entry, { key, value });
    };

    for (const action of history.actions) {
        if (action.type === 3) {
            put(ocean, action.pid + ':' + action.index, action.key, action);
            continue;
        }

        const typeName = history.types[action.etype]?.name;
        const isCreation = action.type === 2;
        if (isCreation) put(creations, action.pid, action.key, { type: typeName, destroyed: action.destroyed! }, true);
        if (typeName === undefined || !LATEST_TYPES.has(typeName) || (isCreation && action.destroyed)) continue;

        let decoded: DecodedBlob;
        try {
            decoded = decodeBlob(action.blob, typeName, action.type === 1);
        } catch {
            continue;
        }

        // bits 1..3: the position axes the blob holds
        let positionAxes = 0;
        for (const field of decoded.fields) {
            const slot = latestIndex(field.f, field.derived);
            if (slot >= 0 && field.new.raw) {
                put(values, action.pid * LATEST_FIELD_SLOTS + slot, action.key, field.new.raw, isCreation);
            }
            if (isCreation && slot >= 1 && slot <= 3) positionAxes |= 1 << slot;
            if (typeName === 'Lily' && !isCreation && field.f.n === 'moving_direction' && field.new.raw) {
                const direction = field.new.raw[0];
                const first = headings.get(action.pid);
                if (direction >= 1 && direction <= 4 && (!first || action.key < first.key)) {
                    headings.set(action.pid, { key: action.key, value: direction - 1 });
                }
            }
            if (typeName === 'Guy' && !isCreation && field.f.n === 'skill_flags' && field.new.raw) {
                if (!skills.has(action.pid)) skills.set(action.pid, []);
                skills.get(action.pid)!.push([action.key, rawU32(field.new.raw)]);
            }
        }
        if (isCreation) {
            for (let axis = 1; axis <= 3; axis++) {
                if (positionAxes & (1 << axis)) continue;

                put(values, action.pid * LATEST_FIELD_SLOTS + axis, action.key, ZERO32, true);
            }
        }
    }

    const latest: LatestValues = {
        get: (pid, field) => {
            const index = LATEST_INDEX.get(field);
            if (index === undefined) return undefined;
            return values.get(pid * LATEST_FIELD_SLOTS + index)?.value;
        },
        ocean: [...ocean.values()].map((change) => change.value),
        created: new Map([...creations].map(([pid, creation]) => [pid, creation.value])),
        skills,
        firstHeadings: new Map([...headings].map(([pid, heading]) => [pid, heading.value])),
    };

    latestCache.set(history, latest);
    return latest;
}

const rawDataView = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
export const rawF32 = (bytes: Uint8Array): number => rawDataView(bytes).getFloat32(0, true);
export const rawU32 = (bytes: Uint8Array): number => rawDataView(bytes).getUint32(0, true);
export const rawU16 = (bytes: Uint8Array): number => rawDataView(bytes).getUint16(0, true);

/** A latest flag byte (1: set) of latestOf() values `latest`, else `fallback`. */
export const latestFlag = (latest: LatestValues | null, pid: number, field: string, fallback?: unknown): boolean => {
    const raw = latest?.get(pid, field);
    return raw ? raw[0] === 1 : !!fallback;
};

/** A latest f32 of latestOf() values `latest`, else `fallback`. */
export function latestF32(latest: LatestValues | null, pid: number, field: string): number | undefined;
export function latestF32(latest: LatestValues | null, pid: number, field: string, fallback: number): number;

export function latestF32(latest: LatestValues | null, pid: number, field: string, fallback?: number) {
    const raw = latest?.get(pid, field);
    return raw ? rawF32(raw) : fallback;
}

/** Guy.skill_flags PROTECTION, TELEPORT, CHARM and TRANSMUTE. */
export const PROTECTION_FLAG = 16;

export const TELEPORT_FLAG = 8;

export const CHARM_FLAG = 64;

export const TRANSMUTE_FLAG = 32;

/** Guy.inventory_flags WAND: the hero holds the Rod. */
export const WAND_FLAG = 0x400;

/**
 * "x,y,z" of the kept hero positions whose record ends with the Guy holding the skill `flag` (by his skill_flags
 * changes by key; at the start he holds PROTECTION when the level data gives it).
 */
export function heroesWithSkill(history: History, guy: [pid: number, protection: number], flag: number): Set<string> {
    const skillChanges = (latestOf(history).skills.get(guy[0]) || []).toSorted((left, right) => left[0] - right[0]);
    const heroes = new Set<string>();
    let skillFlags = guy[1] ? PROTECTION_FLAG : 0;
    let nextChange = 0;

    for (const [key, position] of (history.heroAt || []).toSorted((left, right) => left[0] - right[0])) {
        while (nextChange < skillChanges.length && skillChanges[nextChange][0] <= key) {
            skillFlags = skillChanges[nextChange][1];
            nextChange++;
        }
        if (skillFlags & flag) heroes.add(position.join(','));
    }

    return heroes;
}

/** The kept hero positions whose record ends with the Guy holding PROTECTION. */
export const protectedHeroes = (history: History, guy: [pid: number, protection: number]): Set<string> =>
    heroesWithSkill(history, guy, PROTECTION_FLAG);

/** An entity diff blob, decoded by the schema. */
export const decodeBlob = createBlobDecoder(SCHEMA);
