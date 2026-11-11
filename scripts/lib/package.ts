// Reader for the game's level archive (data/levels.package, format in docs/gamedata.md) and the entities in it.
import { readFileSync } from 'node:fs';
import { atVersion } from '../../src/blob.ts';
import { Reader } from '../../src/reader.ts';
import type { Schema, SchemaField } from '../../src/types.ts';
import { Archive } from './archive.ts';
import { refOf, type Fields } from './fields.ts';
import * as paths from './paths.ts';

// A decoded field value: a number (a bigint when beyond the safe integers), a string, a flag or enum name, or a list
export type DecodedValue = string | number | bigint | boolean | DecodedValue[];

export interface EntityRecord {
    pid: number;
    type: number;
    blob: Uint8Array;
}

export interface EntitiesHeader {
    version: number;
    base: number;
    types: [name: string, version: number][];
}

export interface Entity {
    pid: number;
    id: string;
    type: string;
    fields: Fields;
}

export interface DecodeOptions {
    withOld?: boolean;
}

interface Layout {
    base: SchemaField[];
    derived: SchemaField[];
}

export interface EntityPositions {
    typeNames: string[];
    meshes: string[];
    entities: [pid: number, type: number, x: number, y: number, z: number, mesh: number][];
}

const ID_FIELD_NAMES = new Set([
    'group_id',
    'riding_on_id',
    'extension_of',
    'map_label_marker_id',
    'target_id',
    'also_discover',
    'also_discover2',
    'also_exist_this_group_id',
    'last_taken_gem_id_for_autosave',
    'primary_view_reenablement_marker',
]);
const INTEGER_TYPES = new Set(['u8', 's8', 'u16', 's16', 'u32', 's32', 'u64', 's64']);
// The Group.demo_existence values whose Groups exist in the full game
const FULL_GAME_EXISTENCE = new Set(['NONE', 'EXISTS_IF_FULL_GAME']);
const UTF8 = new TextDecoder();

export function pidString(pid: number): string {
    return `#${pid >>> 20}-${pid & 0xfffff}`;
}

// Whether a field holds the id of another entity: its name ends in _id (or _id2 to _id4), or is a known id name
function isIdField(name: string): boolean {
    const leaf = name.slice(name.lastIndexOf('.') + 1);
    if (leaf.includes('material')) return false;
    if (ID_FIELD_NAMES.has(leaf)) return true;
    return /_id[234]?$/.test(leaf);
}

export function loadSchema(path = paths.data('schema.json')): Schema {
    const schema: Schema = JSON.parse(readFileSync(path, 'utf8'));
    return schema;
}

function toNumberIfSafe(value: bigint): number | bigint {
    if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
    return value;
}

function hexOf(bytes: Uint8Array): string {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('hex');
}

// A fixed-size number or boolean read from raw bytes, or undefined for any other type
function plainValue(view: DataView, type: string): number | bigint | boolean | undefined {
    const size = view.byteLength;
    if (type === 'f32' && size === 4) return view.getFloat32(0, true);
    if (type === 'f64' && size === 8) return view.getFloat64(0, true);
    if (type === 'u8' && size === 1) return view.getUint8(0);
    if (type === 's8' && size === 1) return view.getInt8(0);
    if (type === 'u16' && size === 2) return view.getUint16(0, true);
    if (type === 's16' && size === 2) return view.getInt16(0, true);
    if (type === 'u32' && size === 4) return view.getUint32(0, true);
    if (type === 's32' && size === 4) return view.getInt32(0, true);
    if (type === 'u64' && size === 8) return toNumberIfSafe(view.getBigUint64(0, true));
    if (type === 's64' && size === 8) return toNumberIfSafe(view.getBigInt64(0, true));
    if (type === 'bool' && size === 1) return view.getUint8(0) !== 0;
    return undefined;
}

export class Package extends Archive {
    schema: Schema;
    layouts: Map<string, Layout>;

    constructor(path = paths.game('data', 'levels.package'), schema = loadSchema()) {
        super(path);
        this.schema = schema;
        this.layouts = new Map();
    }

    levels(): string[] {
        const names: string[] = [];
        for (const name of this.files.keys()) {
            if (name.endsWith('.entities')) names.push(baseName(name).slice(0, -'.entities'.length));
        }
        // code unit order (the default sort), so the level order does not depend on the machine's locale
        return names.toSorted();
    }

    // One level per line; `#` starts a comment, and `[version]` and `*directive` lines are not levels
    levelSets(): Map<string, string[]> {
        const sets = new Map<string, string[]>();
        for (const name of [...this.files.keys()].toSorted()) {
            if (!name.endsWith('.level_set')) continue;
            const members: string[] = [];
            for (const line of UTF8.decode(this.read(name)).split(/\r?\n/)) {
                const entry = line.split('#')[0].trim();
                if (entry && entry[0] !== '*' && entry[0] !== '[') members.push(entry);
            }
            sets.set(baseName(name).slice(0, -'.level_set'.length), members);
        }
        return sets;
    }

    // { header: { version, base, types: [[name, version]] }, records: [{ pid, type, blob }] }
    rawEntities(level: string): { header: EntitiesHeader; records: EntityRecord[] } {
        const reader = new Reader(this.read(`data-common/${level}.entities`));
        if (reader.str(4) !== 'enty') throw new Error('bad entities chunk');
        const version = reader.u16();
        if (version <= 6) {
            throw new Error(`entities chunk version ${version} in ${level} has no type table (expected 7 or later)`);
        }
        const base = reader.n64();
        const typeCount = reader.n64();
        const types: [string, number][] = [];
        for (let i = 0; i < typeCount; i++) types.push([reader.str64(), reader.n64()]);
        const count = reader.u32();
        const records: EntityRecord[] = [];
        for (let i = 0; i < count; i++) {
            const pid = reader.u32();
            const type = reader.u16();
            const blob = reader.bytes(reader.u32());
            records.push({ pid, type, blob });
        }
        if (reader.left) throw new Error(`${reader.left} trailing bytes in ${level}`);
        const header = { version, base, types };
        return { header, records: this.withoutDemoOnly(header, records) };
    }

    // The records that exist in the full game: a Group whose demo_existence names a demo phase is left out with its
    // members, and so are the Groups inside it and their members
    withoutDemoOnly(header: EntitiesHeader, records: EntityRecord[]): EntityRecord[] {
        const parentOf = new Map<number, number>();
        const demoOnly = new Set<number>();
        for (const { pid, type, blob } of records) {
            const [name, typeVersion] = header.types[type];
            if (name !== 'Group') continue;
            const fields = this.decode(blob, name, typeVersion, header.base);
            parentOf.set(pid, refOf(fields['base.group_id']));
            const demoExistence = fields.demo_existence;
            if (typeof demoExistence === 'string' && !FULL_GAME_EXISTENCE.has(demoExistence)) demoOnly.add(pid);
        }
        if (demoOnly.size === 0) return records;

        const demoOnlyGroups = [...parentOf.keys()].filter((pid) => {
            const seen = new Set<number>();
            for (let ancestor = pid; ancestor && !seen.has(ancestor); ancestor = parentOf.get(ancestor) ?? 0) {
                if (demoOnly.has(ancestor)) return true;
                seen.add(ancestor);
            }
            return false;
        });
        for (const pid of demoOnlyGroups) demoOnly.add(pid);
        return records.filter(({ pid, type, blob }) => {
            if (demoOnly.has(pid)) return false;
            const [name, typeVersion] = header.types[type];
            const fields = this.decode(blob, name, typeVersion, header.base);
            return !demoOnly.has(refOf(fields['base.group_id']));
        });
    }

    // The base fields and the type's own fields present at the given versions
    layout(typeName: string, typeVersion: number, baseVersion: number): Layout {
        const key = `${typeName}@${typeVersion}@${baseVersion}`;
        let layout = this.layouts.get(key);
        if (!layout) {
            const typeFields = this.schema.types[typeName].fields;
            if (typeFields === undefined) throw new Error(`no schema for entity type ${typeName}`);
            layout = {
                base: atVersion(this.schema.base.fields, baseVersion),
                derived: atVersion(typeFields, typeVersion),
            };
            this.layouts.set(key, layout);
        }
        return layout;
    }

    readValue(reader: Reader, descriptor: SchemaField): DecodedValue {
        if (descriptor.k === 's' || descriptor.k === 'r') return reader.str64();
        if (descriptor.k === 'a') {
            const count = reader.n64();
            const element = descriptor.e!;
            const items: DecodedValue[] = [];
            for (let i = 0; i < count; i++) items.push(this.readValue(reader, element));
            return items;
        }
        const raw = reader.bytes(descriptor.sz!);
        const type = descriptor.enum_t || descriptor.t;
        const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        const value = plainValue(view, type);
        if (value !== undefined) {
            if (descriptor.enum !== undefined) return this.enumValue(descriptor.enum, value);
            return value;
        }
        if (type.startsWith('[]f32')) {
            const floats: number[] = [];
            for (let at = 0; at + 4 <= raw.length; at += 4) {
                floats.push(view.getFloat32(at, true));
            }
            return floats;
        }
        return hexOf(raw);
    }

    // An enum value as its name, the names of the flags set (and the leftover bits), or the number when unnamed
    enumValue(name: string, value: number | bigint | boolean): DecodedValue {
        const info = this.schema.enums[name];
        if (!info) return value;
        if (!info.flags) {
            for (const [valueName, bits] of info.values) {
                if (Number(value) === bits) return valueName;
            }
            return value;
        }
        const wanted = BigInt(value);
        const names: DecodedValue[] = [];
        let rest = wanted;
        for (const [flagName, bits] of info.values) {
            if (bits === 0) continue;
            const mask = BigInt(bits);
            if ((wanted & mask) !== mask) continue;
            names.push(flagName);
            rest &= ~mask;
        }
        if (rest !== 0n) names.push(toNumberIfSafe(rest));
        return names;
    }

    // An entity blob as { field name: new value }, or { field name: [old, new] } with withOld: the old value is the type
    // default. Base fields are named base.<name>; ids of other entities become ["#namespace-serial", pid].
    decode(
        blob: Uint8Array,
        typeName: string,
        typeVersion: number,
        baseVersion = 25,
        { withOld = false }: DecodeOptions = {},
    ): Fields {
        const { base, derived } = this.layout(typeName, typeVersion, baseVersion);
        const reader = new Reader(blob);
        const out: Fields = {};
        while (reader.left) {
            const header = reader.u16();
            const isDerived = (header & 0x1000) !== 0;
            const descriptor = (isDerived ? derived : base)[header & 0xfff];
            let oldValue: DecodedValue = this.readValue(reader, descriptor);
            let newValue: DecodedValue = this.readValue(reader, descriptor);
            if (reader.u8() !== 0xfd) throw new Error(`bad terminator after ${descriptor.n} in ${typeName}`);
            const name = isDerived ? descriptor.n : 'base.' + descriptor.n;
            if (isIdField(descriptor.n) && INTEGER_TYPES.has(descriptor.t) && typeof newValue === 'number') {
                newValue = newValue ? [pidString(newValue), newValue] : 0;
                if (typeof oldValue === 'number') oldValue = oldValue ? [pidString(oldValue), oldValue] : 0;
            }
            out[name] = withOld ? [oldValue, newValue] : newValue;
        }
        return out;
    }

    // Entities of the given type names (all when null) as [{ pid, id, type, fields }] in file order
    level(level: string, types: Set<string> | null = null, decodeOptions: DecodeOptions = {}): Entity[] {
        const { header, records } = this.rawEntities(level);
        const entities: Entity[] = [];
        for (const { pid, type, blob } of records) {
            const [name, typeVersion] = header.types[type];
            if (types && !types.has(name)) continue;
            const fields = this.decode(blob, name, typeVersion, header.base, decodeOptions);
            entities.push({ pid, id: pidString(pid), type: name, fields });
        }
        return entities;
    }

    // Map of type name -> { field name: type default } for the given types, from every level of the package: each blob
    // stores the type default of every field it holds as the old value, so a field that no blob in one level stores
    // still gets its default from another level. A type's scan ends once each of its fields has a default.
    typeDefaults(types: Set<string>): Map<string, Fields> {
        const defaults = new Map<string, Fields>([...types].map((name) => [name, {}]));
        const open = new Set(types);
        for (const level of this.levels()) {
            if (open.size === 0) break;
            const { header, records } = this.rawEntities(level);
            for (const { type, blob } of records) {
                const [name, typeVersion] = header.types[type];
                if (!open.has(name)) continue;
                const typeDefaults = defaults.get(name)!;
                const pairs = this.decode(blob, name, typeVersion, header.base, { withOld: true });
                for (const [key, pair] of Object.entries(pairs)) {
                    if (!Array.isArray(pair)) continue;
                    const oldValue = pair[0];
                    if (!(key in typeDefaults)) typeDefaults[key] = oldValue;
                }
                const { base, derived } = this.layout(name, typeVersion, header.base);
                if (Object.keys(typeDefaults).length === base.length + derived.length) open.delete(name);
            }
        }
        return defaults;
    }

    // Like level(), with every field filled in: a field missing from a blob holds the type default (typeDefaults)
    levelWithDefaults(level: string, types: Set<string>, decodeOptions: DecodeOptions = {}): Entity[] {
        const defaults = this.typeDefaults(types);
        const entities = this.level(level, types, decodeOptions);
        for (const entity of entities) entity.fields = { ...defaults.get(entity.type), ...entity.fields };
        return entities;
    }

    // Per entity [pid, type index, x, y, z, mesh index or -1] with the positions read straight from the blob (a missing
    // field is 0), plus the type names and the mesh names in first-use order
    positions(level: string): EntityPositions {
        const { header, records } = this.rawEntities(level);
        const meshIndex = new Map<string, number>();
        const entities: EntityPositions['entities'] = [];
        for (const { pid, type, blob } of records) {
            const [name, typeVersion] = header.types[type];
            const baseFields = this.layout(name, typeVersion, header.base).base;
            const position = [0, 0, 0];
            let mesh = -1;
            const reader = new Reader(blob);
            while (reader.left) {
                const fieldHeader = reader.u16();
                if (fieldHeader & 0x1000) break;
                const index = fieldHeader & 0xfff;
                const descriptor = baseFields[index];
                if (index <= 2) {
                    reader.skip(4);
                    position[index] = reader.f32();
                } else if (descriptor.n === 'mesh') {
                    reader.str64();
                    const meshName = reader.str64();
                    if (!meshIndex.has(meshName)) meshIndex.set(meshName, meshIndex.size);
                    mesh = meshIndex.get(meshName)!;
                    break;
                } else {
                    this.readValue(reader, descriptor);
                    this.readValue(reader, descriptor);
                }
                reader.u8();
            }
            entities.push([pid, type, position[0], position[1], position[2], mesh]);
        }
        return { typeNames: header.types.map(([name]) => name), meshes: [...meshIndex.keys()], entities };
    }
}

// Sorted [name, version] of every entity type used by any level
export function entityTypes(pkg: Package): [name: string, version: number][] {
    const seen = new Map<string, number>();
    for (const level of pkg.levels()) {
        for (const [name, version] of pkg.rawEntities(level).header.types) seen.set(name, version);
    }
    return [...seen.keys()].toSorted().map((name): [string, number] => [name, seen.get(name)!]);
}

function baseName(path: string): string {
    return path.split('/').pop()!;
}
