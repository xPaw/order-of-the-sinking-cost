// Writes data/fog.json: the overworld fog-of-war regions, for drawing them on the map and hiding what is still fogged.
//
// Reads <game>/data/levels.package (overworld) and data/schema.json; writes data/fog.json.
//
// Usage: node scripts/build-fog.ts [--game DIR] [save_folder]
// With a save folder (a campaign holding overworld.history), also prints which regions that save has revealed.
// `start` is the fog the viewer shows before a save is loaded: the state of a new campaign, NEW_CAMPAIGN_START.
//
// Model (docs/state.md "Fog of war"):
// - Each primary Fog_Of_War (one per ground layer: ground, underworld, sky) splits the level into per-screen
//   regions: screen (sx, sy) = (int((x - corner.x) / squares_per_screen_x), int((y - corner.y) / squares_per_screen_y)),
//   region index = sx + screens_x * sy. Its region_states[index] is 0 FILLED, 1 PARTIAL (fading), 2 CLEARED.
// - A non-primary Fog_Of_War is a box (position +- props.box_extents) with a single region_states entry.
// - The state is entity state: the latest CHANGE of region_states in <campaign>/overworld.history.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createBlobDecoder, type FieldValue } from '../src/blob.ts';
import { parseHistory, type EntityAction } from '../src/history-file.ts';
import { parseStatus } from '../src/status-file.ts';
import type { Position, Schema } from '../src/types.ts';
import type { FogBox, FogClear, FogFile, FogPrimary } from './lib/data-files.ts';
import { get, positionOf, requireNumber, vectorOf, type Fields } from './lib/fields.ts';
import { GROUP_LAYER, LAYER_NAMES, fastTravelBoxes, groundLayer, layerSettings, layerTable } from './lib/layers.ts';
import { modulo, roundTo } from './lib/math.ts';
import { writeJsonAtomic } from './lib/output.ts';
import { Package, type Entity } from './lib/package.ts';
import * as paths from './lib/paths.ts';

// What the model is built from the level data alone: fog.json without the start state
type Fog = Omit<FogFile, 'start'>;
type LevelEntryRow = FogFile['level_entries'][number];

const LEVEL = 'overworld';
const FOG_TYPES = new Set([
    'Settings',
    'Fog_Of_War',
    'Fog_Of_War_Clear',
    'Fog_Of_War_Z',
    'Camera_Marker',
    'Group',
    'Level_Entry',
    'Area_Pin',
]);
const DIRECTIONS: Record<string, [dx: number, dy: number]> = {
    EAST: [1, 0],
    NORTH: [0, 1],
    WEST: [-1, 0],
    SOUTH: [0, -1],
};
const PLACES = 3;
// Vertical reach of a primary Fog_Of_War when it names none, and of a Fog_Of_War_Z that names a negative one
const DEFAULT_ASCENT = 6.5;
const DEFAULT_DESCENT = 4.5;
const REGION_STATES: FogFile['states'] = { 0: 'FILLED', 1: 'PARTIAL', 2: 'CLEARED' };
// A new campaign whose hero has walked everywhere reachable without solving anything (docs/state.md "Fog of war"): the
// hero's position, the cleared regions per Fog_Of_War pid and the activated Area_Pins
const NEW_CAMPAIGN_START: FogFile['start'] = {
    hero: [81, 76, 0],
    regions: { 58720295: [44, 45, 54, 55, 56, 65] },
    pins: [63002081, 63002091],
};

// A coordinate rounded to three places, null for infinity
function rounded(value: number): number | null {
    if (Math.abs(value) === Infinity) return null;
    return roundTo(value, PLACES);
}

function buildFog(pkg: Package): Fog {
    const entities = pkg.levelWithDefaults(LEVEL, FOG_TYPES);
    const byType = new Map<string, Entity[]>();
    for (const entity of entities) {
        let sameType = byType.get(entity.type);
        if (!sameType) {
            sameType = [];
            byType.set(entity.type, sameType);
        }
        sameType.push(entity);
    }
    const ofType = (name: string) => byType.get(name) ?? [];
    const settings = ofType('Settings')[0].fields;
    const cornerX = get(settings, 'per_screen_camera_corner.x', 0);
    const cornerY = get(settings, 'per_screen_camera_corner.y', 0);
    const screenX = requireNumber(settings, 'squares_per_screen_x');
    const screenY = requireNumber(settings, 'squares_per_screen_y');
    const hasScreens = Boolean(settings.per_screen_camera);
    let countX = 1;
    let countY = 1;
    if (hasScreens) {
        countX = Math.max(1, Math.ceil(requireNumber(settings, 'grid.squares_x') / screenX));
        countY = Math.max(1, Math.ceil(requireNumber(settings, 'grid.squares_y') / screenY));
    }
    if (countX < 2) countX = 1;
    if (countY < 2) countY = 1;
    const wrapping = Boolean(settings['grid.wrapping']);
    const table = layerTable(
        layerSettings(settings),
        fastTravelBoxes(ofType('Camera_Marker').map((entity) => entity.fields)),
    );
    const groupLayers = new Map<number, number | null>();
    for (const entity of ofType('Group')) {
        const layerName = entity.fields.bind_to_layer;
        let layer: number | null = null;
        if (typeof layerName === 'string') layer = GROUP_LAYER[layerName] ?? null;
        groupLayers.set(entity.pid, layer);
    }

    const layerOf = (fields: Fields) => {
        const group = fields['base.group_id'];
        const groupLayer = Array.isArray(group) ? (groupLayers.get(group[1]) ?? null) : null;
        return groundLayer(table, positionOf(fields)[2], groupLayer);
    };
    const regionOf = (x: number, y: number) => {
        let regionX = Math.floor((x - cornerX) / screenX);
        let regionY = Math.floor((y - cornerY) / screenY);
        if (wrapping) {
            regionX = modulo(regionX, countX);
            regionY = modulo(regionY, countY);
        }
        if (regionX >= 0 && regionX < countX && regionY >= 0 && regionY < countY) return regionX + countX * regionY;
        return -1;
    };

    const primary: FogPrimary[] = [];
    const boxes: FogBox[] = [];
    for (const entity of ofType('Fog_Of_War')) {
        const fields = entity.fields;
        const position = positionOf(fields);
        const name = get(fields, 'base.entity_name', '');
        if (fields.primary) {
            const ascent = get(fields, 'ascent', DEFAULT_ASCENT);
            const descent = get(fields, 'descent', DEFAULT_DESCENT);
            primary.push({
                pid: entity.pid,
                id: entity.id,
                name,
                layer: layerOf(fields),
                z: position[2],
                zmin: rounded(position[2] - descent),
                zmax: rounded(position[2] + ascent),
                z_overrides: [],
            });
            continue;
        }
        const extent = vectorOf(fields, 'props.box_extents');
        const min: Position = [
            roundTo(position[0] - extent[0], PLACES),
            roundTo(position[1] - extent[1], PLACES),
            roundTo(position[2] - extent[2], PLACES),
        ];
        const max: Position = [
            roundTo(position[0] + extent[0], PLACES),
            roundTo(position[1] + extent[1], PLACES),
            roundTo(position[2] + extent[2], PLACES),
        ];
        boxes.push({
            pid: entity.pid,
            id: entity.id,
            name,
            layer: layerOf(fields),
            min,
            max,
            regions: fields.clear_as_part_of_room ? 0 : 1,
            only_overhang: Boolean(fields.only_overhang_no_fog),
        });
    }
    const primaryOfLayer = new Map(primary.map((fog) => [fog.layer, fog]));
    for (const entity of ofType('Fog_Of_War_Z')) {
        const fields = entity.fields;
        const position = positionOf(fields);
        const fog = primaryOfLayer.get(layerOf(fields));
        const region = regionOf(position[0], position[1]);
        if (!fog || region < 0 || fog.z_overrides.some((override) => override[0] === region)) continue;
        const ascent = get(fields, 'ascent', 0);
        const descent = get(fields, 'descent', 0);
        fog.z_overrides.push([
            region,
            rounded(position[2] - (descent < 0 ? DEFAULT_DESCENT : descent)),
            rounded(position[2] + (ascent < 0 ? DEFAULT_ASCENT : ascent)),
            entity.id,
        ]);
    }
    for (const fog of primary) fog.z_overrides.sort((first, second) => first[0] - second[0]);

    const clears: FogClear[] = [];
    for (const entity of ofType('Fog_Of_War_Clear')) {
        const fields = entity.fields;
        const position = positionOf(fields);
        const region = regionOf(position[0], position[1]);
        const direction = get(fields, 'clear_neighboring_screen', 'NONE');
        let to = -1;
        if (direction in DIRECTIONS && region >= 0) {
            let regionX = (region % countX) + DIRECTIONS[direction][0];
            let regionY = Math.floor(region / countX) + DIRECTIONS[direction][1];
            if (wrapping) {
                regionX = modulo(regionX, countX);
                regionY = modulo(regionY, countY);
            }
            if (regionX >= 0 && regionX < countX && regionY >= 0 && regionY < countY) to = regionX + countX * regionY;
        }
        clears.push({
            id: entity.id,
            layer: layerOf(fields),
            region,
            dir: direction,
            to,
            radius: rounded(get(fields, 'radius', 0)),
        });
    }
    const levelEntries: FogFile['level_entries'] = [];
    for (const entity of ofType('Level_Entry')) {
        const fields = entity.fields;
        if (fields.currently_broken || fields.currently_disfavored) continue;
        const position = positionOf(fields);
        levelEntries.push([get(fields, 'level_name', ''), layerOf(fields), regionOf(position[0], position[1])]);
    }
    const areaPins: FogFile['area_pins'] = [];
    for (const entity of ofType('Area_Pin')) {
        const fields = entity.fields;
        const position = positionOf(fields);
        areaPins.push([
            entity.id,
            get(fields, 'local_area_name', ''),
            layerOf(fields),
            regionOf(position[0], position[1]),
        ]);
    }
    const layers: FogFile['layers'] = [];
    table.forEach((range, index) => {
        if (range) layers.push({ index, name: LAYER_NAMES[index], zmin: rounded(range[0]), zmax: rounded(range[1]) });
    });
    return {
        level: LEVEL,
        grid: { corner: [cornerX, cornerY], screen: [screenX, screenY], count: [countX, countY], wrapping },
        layers,
        states: REGION_STATES,
        primary,
        boxes,
        clears,
        level_entries: levelEntries,
        area_pins: areaPins,
    };
}

// A history record outranks another by being the level-start record, then by the larger first move + span, then by the
// later mip level (the key of its actions)
function isNewer(candidate: EntityAction, other: EntityAction): boolean {
    if (candidate.start !== other.start) return candidate.start;
    return candidate.key > other.key;
}

function readHistory(path: string, schema: Schema) {
    const history = parseHistory(readFileSync(path));
    const decodeBlob = createBlobDecoder(schema);
    const typeName = (action: EntityAction) => history.types[action.etype]?.name;
    return { history, decodeBlob, typeName };
}

// The decoded new value of one field of a Fog_Of_War or Area_Pin action's blob
function newFieldValue(
    decodeBlob: ReturnType<typeof createBlobDecoder>,
    action: EntityAction,
    typeName: string,
    fieldName: string,
): FieldValue | null {
    const decoded = decodeBlob(action.blob, typeName, action.type === 1);
    for (const field of decoded.fields) {
        const name = (field.derived ? '' : 'base.') + field.f.n;
        if (name === fieldName) return field.new;
    }
    return null;
}

// Latest region_states per Fog_Of_War pid from an overworld.history: the level-start record first, else the record
// whose first move + span is largest
function saveStates(path: string, pids: Set<number>, schema: Schema): Map<number, number[]> {
    const { history, decodeBlob, typeName } = readHistory(path, schema);
    const best = new Map<number, { action: EntityAction; states: number[] }>();
    for (const action of history.actions) {
        if (action.type !== 1 && action.type !== 2) continue;
        if (!pids.has(action.pid) || typeName(action) !== 'Fog_Of_War') continue;
        const value = newFieldValue(decodeBlob, action, 'Fog_Of_War', 'region_states');
        if (!value) continue;
        const known = best.get(action.pid);
        if (!known || isNewer(action, known.action)) best.set(action.pid, { action, states: Array.from(value.raw!) });
    }
    return new Map([...best].map(([pid, entry]) => [pid, entry.states]));
}

// Prints which fog regions a save has revealed, and how many of the levels in its Status file lie in fogged regions
function printSaveReport(fog: Fog, folder: string, pids: Set<number>, schema: Schema): void {
    const [countX, countY] = fog.grid.count;
    const states = saveStates(join(folder, 'overworld.history'), pids, schema);
    const layerName = new Map(fog.layers.map((layer) => [layer.index, layer.name]));
    const shown = new Map<number, Set<number>>();
    for (const primary of fog.primary) {
        const state = states.get(primary.pid) ?? Array<number>(countX * countY).fill(0);
        const revealed: number[] = [];
        state.forEach((value, index) => {
            if (value) revealed.push(index);
        });
        shown.set(primary.layer, new Set(revealed));
        console.log(
            `${primary.id} ${primary.name} layer ${layerName.get(primary.layer)}: ${revealed.length}/${state.length} regions revealed`,
            revealed,
        );
    }
    for (const box of fog.boxes) {
        if (states.has(box.pid)) console.log('box', box.id, 'state', states.get(box.pid));
    }
    const isShown = (entry: LevelEntryRow) => shown.get(entry[1])?.has(entry[2]) ?? false;
    const visible = fog.level_entries.filter(isShown);
    console.log(`level entries in revealed regions: ${visible.length} / ${fog.level_entries.length}`);
    const statusPath = join(folder, 'Status.sokoban_status');
    if (!existsSync(statusPath)) return;
    const known = new Set(parseStatus(readFileSync(statusPath)).levels.map((level) => level.name));
    const onOverworld = new Map(fog.level_entries.map((entry) => [entry[0], entry]));
    const hidden = [...known].filter((name) => onOverworld.has(name) && !isShown(onOverworld.get(name)!)).toSorted();
    const knownOnOverworld = [...known].filter((name) => onOverworld.has(name)).length;
    console.log(
        `levels with Status state: ${knownOnOverworld} on the overworld, ${hidden.length} of them in fogged regions`,
        hidden.map((name) => [name, layerName.get(onOverworld.get(name)![1]), onOverworld.get(name)![2]]),
    );
}

function main(): void {
    const { positionals } = paths.parseCommandLine({}, true);
    const pkg = new Package();
    const fog = buildFog(pkg);
    const schema = pkg.schema;
    pkg.close();
    const pids = new Set([...fog.primary.map((entry) => entry.pid), ...fog.boxes.map((entry) => entry.pid)]);
    const file: FogFile = { ...fog, start: NEW_CAMPAIGN_START };
    writeJsonAtomic(paths.data('fog.json'), file);
    const [countX, countY] = fog.grid.count;
    console.log(
        `fog.json: grid ${countX}x${countY}, ${fog.primary.length} primary, ${fog.boxes.length} boxes, ` +
            `${fog.clears.length} clear markers, ${fog.level_entries.length} level entries`,
    );
    if (positionals[0]) printSaveReport(fog, positionals[0], pids, schema);
}

main();
