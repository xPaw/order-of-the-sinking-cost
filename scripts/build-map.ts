// Builds data/map.json: the frame of the overhead map (its corner, size and height layers) and the overworld's
// Ocean_Maps, which build-progress.ts embeds for the viewer's map.
//
// Reads data/levels.json (overworld settings) and <game>/data/levels.package.
// Writes data/map.json.
//
// Usage: node scripts/build-map.ts [--game DIR]
//
// - Layers follow the game's ground layer table (layers.ts: Settings underground/skyground barriers and the
//   FAST_TRAVEL Camera_Markers); the fast-travel rooms are left out. A Group's bind_to_layer overrides z.
// - Water comes from Ocean_Map.ocean_values (bit 0 = water) in the level's initial state. Maps with detect_holes are
//   all water except under the voxels of the OCEAN_HOLE Wall_Sets that name them (ocean_hole_id); maps in an existence
//   group that do not exist at the start are skipped. A save's OCEAN_CHANGE actions only set flow bits and add water.
//
// map.json:
//   {corner: [x, y], size: [W, H], layers: [{key, name, z: [z0, z1]}], oceans: [...]}
//   corner is the world position of square (0, 0)'s centre; square (i, j) covers x in [corner.x + i - 0.5, +1) and
//   y in [corner.y + j - 0.5, +1). A layer holds the z in [z0, z1).
//   oceans: [{pid, layer (index into layers), x0, y0, sx, sy, zw, water}] for every Ocean_Map the overhead map draws:
//   ocean_values index k is world square (x0 + k % sx, y0 + floor(k / sx)), the water surface is at zw, and water =
//   base64 of the initial bit-0 mask, packed little-endian (bit k % 8 of byte k >> 3), holes applied.
import { readFileSync } from 'node:fs';
import type { MapLayerKey, MapOcean } from '../src/types.ts';
import type { LevelsFile, MapFile } from './lib/data-files.ts';
import { flagsOf, get, refOf, requireNumber, type Fields } from './lib/fields.ts';
import { boundLayer, fastTravelBoxes, groundLayer, layerSettings, layerTable, type LayerRange } from './lib/layers.ts';
import { roundTo } from './lib/math.ts';
import { writeJsonAtomic } from './lib/output.ts';
import { Package, type Entity } from './lib/package.ts';
import * as paths from './lib/paths.ts';
import { isAxisAligned, wallVoxels } from './lib/voxels.ts';

interface OutputLayer {
    key: MapLayerKey;
    name: string;
    fog: number;
}

// output layers, with their index in the ground layer table (0 ONGROUND, 1 UNDERGROUND, 2 SKYGROUND)
const LAYERS: OutputLayer[] = [
    { key: 'underworld', name: 'Underworld', fog: 1 },
    { key: 'ground', name: 'Ground', fog: 0 },
    { key: 'sky', name: 'Sky', fog: 2 },
];
// The Underworld has no lower barrier; its lowest surface lies at this z
const UNDERWORLD_BOTTOM = -57;
const MAP_TYPES = new Set(['Group', 'Wall_Set', 'Ocean_Map']);
const COSMETIC_ONLY = 'EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY';

// The overworld's entities that decide the water, with the lookups to place them on a layer
class Scenery {
    entities: Entity[];
    groups: Map<number, Fields>;
    existenceDefault: Map<number, boolean>;
    table: (LayerRange | null)[];
    layerIndex: Map<number, number>;

    constructor(pkg: Package) {
        this.entities = pkg.level('overworld', MAP_TYPES);
        this.groups = new Map();
        for (const entity of this.entities) {
            if (entity.type === 'Group') this.groups.set(entity.pid, entity.fields);
        }
        const withDefaults = pkg.levelWithDefaults('overworld', new Set(['Settings', 'Camera_Marker', 'Group']));
        const settings = withDefaults.find((entity) => entity.type === 'Settings')!.fields;
        const cameras = withDefaults.filter((entity) => entity.type === 'Camera_Marker');
        this.existenceDefault = new Map();
        for (const { type, pid, fields } of withDefaults) {
            if (type === 'Group' && fields.is_existence_group) {
                this.existenceDefault.set(pid, Boolean(fields.exists_by_default));
            }
        }
        this.table = layerTable(layerSettings(settings), fastTravelBoxes(cameras.map((entity) => entity.fields)));
        this.layerIndex = new Map(LAYERS.map((layer, index) => [layer.fog, index]));
    }

    // Whether an entity exists when the level loads (docs/entities.md "Existence groups"): a direct member of an
    // existence Group follows the Group's exists_by_default, another entity in an existence group its stored
    // CURRENTLY_EXISTS; an EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY one is no member and exists only by its flags
    existsAtLoad(fields: Fields): boolean {
        const flags = flagsOf(fields, 'base.entity_flags');
        const cosmetic = flags.includes(COSMETIC_ONLY);
        const group = refOf(fields['base.group_id']);
        if (this.existenceDefault.has(group) && !cosmetic) return this.existenceDefault.get(group)!;
        if (flags.includes('IN_EXISTENCE_GROUP')) return flags.includes('CURRENTLY_EXISTS');
        return !cosmetic;
    }

    // Output layer index of an entity, -1 for the fast-travel rooms
    outputLayer(fields: Fields): number {
        const z = get(fields, 'base.position.z', 0);
        const layer = groundLayer(this.table, z, boundLayer(this.groups, fields));
        return this.layerIndex.get(layer) ?? -1;
    }

    // The z range [low, top) of an output layer
    zRange(layer: OutputLayer): LayerRange {
        const [low, top] = this.table[layer.fog]!;
        if (Number.isFinite(low)) return [low, top];
        return [UNDERWORLD_BOTTOM, top];
    }
}

// OCEAN_HOLE Wall_Sets by the Ocean_Map they cut (ocean_hole_id)
function oceanHoles(scenery: Scenery): Map<number, Fields[]> {
    const holes = new Map<number, Fields[]>();
    for (const entity of scenery.entities) {
        const fields = entity.fields;
        if (entity.type !== 'Wall_Set' || fields.kind !== 'OCEAN_HOLE') continue;
        const target = refOf(fields.ocean_hole_id);
        if (!target) continue;
        let cutting = holes.get(target);
        if (!cutting) {
            cutting = [];
            holes.set(target, cutting);
        }
        cutting.push(fields);
    }
    return holes;
}

function packBits(values: Int32Array): Buffer {
    const bytes = new Uint8Array(Math.ceil(values.length / 8));
    values.forEach((value, k) => {
        if (value & 1) bytes[k >> 3] |= 1 << (k & 7);
    });
    return Buffer.from(bytes);
}

// The squares of a detect_holes map: all water, minus the voxels of the OCEAN_HOLE Wall_Sets that name it
function cutHoles(values: Int32Array, holes: Fields[], origin: number[], squares: number[]): void {
    for (let k = 0; k < values.length; k++) values[k] |= 1;
    for (const hole of holes) {
        for (const [x, y] of wallVoxels(hole)) {
            const i = Math.round(x - origin[0]);
            const j = Math.round(y - origin[1]);
            if (i >= 0 && i < squares[0] && j >= 0 && j < squares[1]) values[i + j * squares[0]] &= ~1;
        }
    }
}

// The Ocean_Maps the overhead map draws, in their initial state
function readOceans(scenery: Scenery): MapOcean[] {
    const holes = oceanHoles(scenery);
    const oceans: MapOcean[] = [];
    for (const entity of scenery.entities) {
        if (entity.type !== 'Ocean_Map') continue;
        const fields = entity.fields;
        const layer = scenery.outputLayer(fields);
        if (layer < 0) continue;
        if (!scenery.existsAtLoad(fields)) continue;
        const squares = [get(fields, 'grid.squares_x', 0), get(fields, 'grid.squares_y', 0)];
        const storedValues = fields.ocean_values;
        const values = Int32Array.from(Array.isArray(storedValues) ? storedValues : []);
        if (values.length !== squares[0] * squares[1]) continue;
        // an `oceans` entry maps square k to (x0 + k % sx, y0 + floor(k / sx)): an unrotated map only
        if (!isAxisAligned(fields)) {
            throw new Error(`Ocean_Map ${entity.id} is rotated; map.json oceans cannot hold it`);
        }
        const origin = [
            get(fields, 'base.position.x', 0) + get(fields, 'grid.corner.x', 0),
            get(fields, 'base.position.y', 0) + get(fields, 'grid.corner.y', 0),
        ];
        if (fields.detect_holes) cutHoles(values, holes.get(entity.pid) ?? [], origin, squares);
        // the ocean mesh sits `sink` below the map's z; a negative sink (the type default, -1) means 0.1
        const sink = get(fields, 'sink', -1);
        let surface = get(fields, 'base.position.z', 0) - 0.1;
        if (sink >= 0) surface = get(fields, 'base.position.z', 0) - sink;
        if (fields.kind === 'PLAYER_BLOCKING_ONLY') continue;
        oceans.push({
            pid: entity.pid,
            layer,
            x0: Math.round(origin[0]),
            y0: Math.round(origin[1]),
            sx: squares[0],
            sy: squares[1],
            zw: roundTo(surface, 3),
            water: packBits(values).toString('base64'),
        });
    }
    return oceans;
}

function buildMap(): void {
    const levels: LevelsFile = JSON.parse(readFileSync(paths.data('levels.json'), 'utf8'));
    const settings = levels.levels.find((level) => level.name === 'overworld')!.settings;
    const corner: MapFile['corner'] = [
        requireNumber(settings, 'grid.corner.x'),
        requireNumber(settings, 'grid.corner.y'),
    ];
    const size: MapFile['size'] = [
        requireNumber(settings, 'grid.squares_x'),
        requireNumber(settings, 'grid.squares_y'),
    ];
    const pkg = new Package();
    const scenery = new Scenery(pkg);
    pkg.close();
    console.log('layer table', scenery.table);
    console.log(`loaded ${scenery.entities.length} entities`);

    const oceans = readOceans(scenery);
    console.log('oceans', oceans.length);

    const out: MapFile = { corner, size, layers: [], oceans };
    for (const layer of LAYERS) {
        const [low, top] = scenery.zRange(layer);
        out.layers.push({ key: layer.key, name: layer.name, z: [roundTo(low, 3), roundTo(top, 3)] });
        console.log(layer.key, 'z', low, top);
    }
    writeJsonAtomic(paths.data('map.json'), out);
}

paths.parseCommandLine();
buildMap();
