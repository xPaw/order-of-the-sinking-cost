// Dumps the game's level package: data/levels.json (progression entities and settings of every level) and
// data/level_entities/<level>.json (every entity's position, for the editor-style views).
//
// Reads <game>/data/levels.package and data/schema.json.
//
// Usage: node scripts/build-levels.ts [--game DIR] [--types-json FILE]
// With --types-json, only writes the [name, version] list of entity types in the package (input for the schema
// exporter, docs/gamedata.md "Reading the schema out of the binary").
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { countBy } from '../src/util.ts';
import type { LevelEntitiesFile, LevelEntry, LevelsFile, PlacedEntity } from './lib/data-files.ts';
import type { Fields } from './lib/fields.ts';
import { roundTo } from './lib/math.ts';
import { writeJsonAtomic } from './lib/output.ts';
import {
    Package,
    entityTypes,
    pidString,
    type DecodedValue,
    type EntitiesHeader,
    type EntityPositions,
    type EntityRecord,
} from './lib/package.ts';
import * as paths from './lib/paths.ts';

const PROGRESSION_TYPES = [
    'Level_Entry',
    'Level_Connector',
    'Overworld_Unlock',
    'Area_Pin',
    'Gem_Slot',
    'Treasure',
    'Treasure_Display',
    'Level_State',
    'Checkpoint',
    'Teleporter',
    'Artifact',
    'Voice_Log',
    'Marker',
    'Switch',
    'Freezer',
    'Tower',
    'Sign',
    'Door',
    'Settings',
];
const SETTINGS_SUMMARY = [
    'grid.squares_x',
    'grid.squares_y',
    'grid.num_squares',
    'grid.wrapping',
    'grid.corner.x',
    'grid.corner.y',
    'grid.corner.z',
    'squares_z',
    'story_tag',
    'special_level',
    'fast_travel_corner.x',
    'fast_travel_corner.y',
    'fast_travel_extents.x',
    'fast_travel_extents.y',
    'level_data_version',
    'designers',
    'intro_cutscene',
    'outro_cutscene',
    'story_proc',
    'story_proc_arg_string',
    'story_proc_arg_int',
    'sound_level_name',
];
// The base fields worth keeping on a progression entity
const KEPT_BASE_FIELDS = new Set([
    'base.position.x',
    'base.position.y',
    'base.position.z',
    'base.orientation.z',
    'base.orientation.w',
    'base.entity_flags',
    'base.entity_name',
    'base.group_id',
    'base.mesh',
]);
const POSITION_PLACES = 3;
const FIELD_PLACES = 4;

interface FoundLevel {
    header: EntitiesHeader;
    records: EntityRecord[];
    settings: Map<string, unknown>;
    entitiesByType: Map<string, PlacedEntity[]>;
}

// A level of levels.json before its settings are summed up, which needs the defaults seen in every level
interface LevelSummary extends Omit<LevelEntry, 'settings' | 'entities'> {
    settings: Map<string, unknown>;
    entities: Map<string, PlacedEntity[]>;
}

// A decoded value with its floats rounded to four places
function roundFloats(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(roundFloats);
    if (typeof value === 'number' && !Number.isInteger(value)) return roundTo(value, FIELD_PLACES);
    return value;
}

// The [old value, new value] pair of a field decoded with its old value
function isOldNewPair(value: unknown): value is [oldValue: DecodedValue, newValue: DecodedValue] {
    return Array.isArray(value) && value.length === 2;
}

// The [value, count] pairs with the highest counts, equal counts in first-seen order
function mostCommon<Value>(counts: Map<Value, number>, limit: number): [Value, number][] {
    return [...counts.entries()].toSorted((first, second) => second[1] - first[1]).slice(0, limit);
}

function levelsInSets(sets: Map<string, string[]>): Map<string, string[]> {
    const inSets = new Map<string, string[]>();
    for (const [setName, members] of sets) {
        for (const level of members) {
            let names = inSets.get(level);
            if (!names) {
                names = [];
                inSets.set(level, names);
            }
            names.push(setName);
        }
    }
    return inSets;
}

function positionsFile(level: string, { typeNames, meshes, entities }: EntityPositions): LevelEntitiesFile {
    const rows: LevelEntitiesFile['ents'] = entities.map(([pid, type, x, y, z, mesh]) => [
        pid,
        type,
        roundTo(x, POSITION_PLACES),
        roundTo(y, POSITION_PLACES),
        roundTo(z, POSITION_PLACES),
        mesh,
    ]);
    return {
        level,
        columns: ['pid', 'type', 'x', 'y', 'z', 'mesh'],
        types: typeNames,
        meshes,
        ents: rows,
    };
}

// The progression entities and Settings of one level. Settings come back as the level's values (and every default
// seen goes into `settingsDefaults`); the other entities are grouped by type.
function progressionOf(pkg: Package, level: string, settingsDefaults: Map<string, unknown>): FoundLevel {
    const { header, records } = pkg.rawEntities(level);
    const settings = new Map<string, unknown>();
    const entitiesByType = new Map<string, PlacedEntity[]>();
    for (const { pid, type, blob } of records) {
        const [typeName, typeVersion] = header.types[type];
        if (!PROGRESSION_TYPES.includes(typeName)) continue;
        const fields = pkg.decode(blob, typeName, typeVersion, header.base, { withOld: true });
        if (typeName === 'Settings') {
            for (const [key, pair] of Object.entries(fields)) {
                if (!isOldNewPair(pair)) throw new Error(`Settings field ${key} in ${level} has no old value`);
                const [oldValue, newValue] = pair;
                if (!settingsDefaults.has(key)) settingsDefaults.set(key, oldValue);
                settings.set(key, newValue);
            }
            continue;
        }
        const kept: Fields = {};
        for (const [key, pair] of Object.entries(fields)) {
            if (!isOldNewPair(pair)) throw new Error(`${typeName} field ${key} in ${level} has no old value`);
            if (key.startsWith('base.') && !KEPT_BASE_FIELDS.has(key)) continue;
            kept[key] = roundFloats(pair[1]);
        }
        let entities = entitiesByType.get(typeName);
        if (!entities) {
            entities = [];
            entitiesByType.set(typeName, entities);
        }
        entities.push({ id: pidString(pid), pid, fields: kept });
    }
    return { header, records, settings, entitiesByType };
}

function levelSummary(level: string, inSets: Map<string, string[]>, found: FoundLevel): LevelSummary {
    const { header, records, settings, entitiesByType } = found;
    const namespaces = countBy(records, (record) => record.pid >>> 20);
    const typeCounts = countBy(records, (record) => header.types[record.type][0]);
    const progressionCounts: Record<string, number> = {};
    for (const typeName of PROGRESSION_TYPES) {
        const count = typeCounts.get(typeName);
        if (count) progressionCounts[typeName] = count;
    }
    return {
        name: level,
        level_sets: inSets.get(level) ?? [],
        entity_count: records.length,
        namespaces: mostCommon(namespaces, 6),
        type_counts: progressionCounts,
        settings,
        entities: entitiesByType,
    };
}

// The settings every summary lists, a level's own value or else the default of the type
function settingsSummary(settings: Map<string, unknown>, settingsDefaults: Map<string, unknown>): Fields {
    const summary: Fields = {};
    for (const key of SETTINGS_SUMMARY) {
        let value: unknown = null;
        if (settings.has(key)) value = settings.get(key);
        else if (settingsDefaults.has(key)) value = settingsDefaults.get(key);
        summary[key] = roundFloats(value);
    }
    return summary;
}

function buildLevels() {
    const pkg = new Package();
    const outputFolder = paths.data('level_entities');
    mkdirSync(outputFolder, { recursive: true });
    const sets = pkg.levelSets();
    const inSets = levelsInSets(sets);
    const settingsDefaults = new Map<string, unknown>();
    const summaries: LevelSummary[] = [];
    for (const level of pkg.levels()) {
        const found = progressionOf(pkg, level, settingsDefaults);
        summaries.push(levelSummary(level, inSets, found));
        writeJsonAtomic(join(outputFolder, level + '.json'), positionsFile(level, pkg.positions(level)));
    }
    for (const field of pkg.schema.types.Settings.fields!) {
        if ((field.k === 's' || field.k === 'r') && !settingsDefaults.has(field.n)) settingsDefaults.set(field.n, '');
    }
    const file: LevelsFile = {
        level_sets: Object.fromEntries(sets),
        levels: summaries.map((summary) => ({
            name: summary.name,
            level_sets: summary.level_sets,
            entity_count: summary.entity_count,
            namespaces: summary.namespaces,
            type_counts: summary.type_counts,
            settings: settingsSummary(summary.settings, settingsDefaults),
            entities: Object.fromEntries(summary.entities),
        })),
    };
    writeJsonAtomic(paths.data('levels.json'), file, { indent: 1 });
    const entityCount = summaries.reduce((total, summary) => total + summary.entity_count, 0);
    console.log('levels', summaries.length, 'entities', entityCount);
    pkg.close();
}

function main() {
    const { values } = paths.parseCommandLine({ 'types-json': { type: 'string' } });
    const typesJson = values['types-json'];
    if (!typesJson) {
        buildLevels();
        return;
    }
    const pkg = new Package();
    writeJsonAtomic(typesJson, entityTypes(pkg));
    pkg.close();
}

main();
