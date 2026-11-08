// Builds the marker icons of the page from the game's own 3D models: src/assets/icons/<name>.avif (128 px); from the
// game's textures the area emblems area-<emblem>.avif, tower badges tower-<worlds>[-gold].avif, voice-log and hero; and the favicon
// src/assets/icons/favicon-<size>.png.
//
// Reads the overworld entities in <game>/data/levels.package (tints and glow colours), data/schema.json, and the render
// assets of the game folder: data-pc/*.compressed_mesh and *.texture, data/materials.package and
// data-common/overworld.all_paint_data (format in docs/GAMEDATA.md, Render assets).
// Writes src/assets/icons/.
//
// Usage: node scripts/build-icons.ts [--game DIR] [--only NAME[,NAME...]] [--png DIR]
//   --only   renders just those icons (names as in ICONS below, area-<emblem> or tower-<worlds>[-gold])
//   --png    also writes each icon as a PNG into DIR, without encoding AVIF; nothing goes to src/assets/icons/
//
// Encoding to AVIF needs ImageMagick (`magick`) with AVIF support, on the PATH or inside WSL.
//
// - Each icon is one mesh (or a few) of the entity type it marks, drawn with the tints of one placed entity of that
//   type, in an orthographic three-quarter view (camera south of the object, turned 25 degrees east, 42 degrees up; the
//   Level_Entry and Teleporter pads straight from above, the sign and the gate face-on) with smooth shading from
//   the vertex normals, a key light from the top left, a fill light and a rim light, a dark outline and a drop shadow.
// - The held-<object> icons show each kind of object in the world, e.g. what a closed Cage holds (names from lib/cage-contents.ts): each is a placed entity of
//   that kind with its own mesh and tints, a Mirror or Light seen from above so its facing shows.
// - The Teleporters' glowing parts take the entity's color_discovered. The level pads use the viewer's own stone and
//   glow colours (STONE_COLORS, GLOW_GROUPS), stronger than the game's, so the states tell apart at a glance.
// - An area emblem is the game's OverworldIcon_<emblem> texture, a tower badge its tower_status_<worlds>[_gold]
//   texture, the voice log its UI_Voice_Log_Activate and the hero its wheel_queen portrait (mip 0), scaled to the icon size with an area filter on premultiplied colours, fitted into the square
//   keeping its aspect.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { get, refOf, type Fields } from './lib/fields.ts';
import { Materials, normalized, type Color, type Shading, type ShadingEntity } from './lib/materials.ts';
import { rotateByQuaternion, type Quaternion, type Vector, type Vector4 } from './lib/math.ts';
import { allHeldObjects, type HeldObject } from './lib/cage-contents.ts';
import { readFirstFrame, skinMesh, worldMatrices } from './lib/animation.ts';
import { readMesh, type Mesh, type TriangleList } from './lib/mesh.ts';
import { PaintData } from './lib/paint.ts';
import { fitSquare } from './lib/image.ts';
import { Package, type Entity, type EntityPositions } from './lib/package.ts';
import type { Schema, WorldFile } from '../src/types.ts';
import * as paths from './lib/paths.ts';
import { encodePng } from './lib/png.ts';
import { renderMesh } from './lib/rasterizer.ts';
import { Textures, srgbToLinear } from './lib/textures.ts';

interface View {
    azimuth: number;
    elevation: number;
}

// A stone tint and glow in the viewer's colours as hex strings (glow null: no glowing parts; absent: the entity's own)
interface ViewerColors {
    stone: string;
    glow?: string | null;
}

// What to draw for one icon (the fields are described above ICONS)
interface IconSpec {
    name: string;
    type: string;
    mesh: string;
    where?: (fields: Fields) => boolean;
    parts?: string[];
    effect?: string;
    viewerColors?: ViewerColors;
    view?: View;
    outline?: number;
    shadow?: boolean;
    withTreasure?: boolean;
    pid?: number;
    oriented?: boolean;
}

// The options of IconSpec that decide how one mesh is shaded
type PartOptions = Pick<IconSpec, 'effect' | 'viewerColors'>;

// A mesh with the positions and normals it is drawn with, its vertex paint and the shading of each triangle list
interface Part {
    mesh: Mesh;
    positions: Float32Array;
    normals: Float32Array;
    paint: Uint8Array;
    shadings: (Shading | null)[];
}

interface Context {
    materials: Materials;
    entities: Entity[];
    positions: EntityPositions;
    paint: PaintData;
}

interface Magick {
    command: string;
    prefix: string[];
    toPath: (path: string) => string;
}

const ICON_SIZE = 128;
const ICON_MARGIN = 5;
const OUTLINE_PIXELS = 1.4;
const AVIF_QUALITY = 82;
const FAVICON_SIZES = [32, 64];
const OVERWORLD = 'overworld';
const DEFAULT_VIEW: View = { azimuth: 25, elevation: 42 };
const FACE_VIEW: View = { azimuth: 90, elevation: 24 };
const TOP_VIEW: View = { azimuth: 0, elevation: 90 };
const FACING_VIEW: View = { azimuth: 0, elevation: 70 };
const WHITE: Color = [1, 1, 1];

// The area emblems of the game (`local_area_image` of an Area_Pin): one per world and one per pair of worlds. Soko is
// the Heroes, Prom the Beamcasters, Mirror the Mirror Isles and Skipping the Skipping Stones.
const EMBLEM_PREFIX = 'OverworldIcon_';
const AREA_EMBLEMS = [
    'Mirror',
    'Prom',
    'Skipping',
    'Soko',
    'Prom_Mirror',
    'Skipping_Mirror',
    'Skipping_Prom',
    'Soko_Mirror',
    'Soko_Prom',
    'Soko_Skipping',
];

// The tower badges of the game (tower_status_<worlds>[_gold]): one per world and one per pair of worlds, plain and gold.
// h is the Heroes, m the Mirror Isles, s the Skipping Stones and p the Beamcasters.
const TOWER_PREFIX = 'tower_status_';
const TOWER_BADGES = ['h', 'm', 's', 'p', 'hm', 'hs', 'hp', 'ms', 'mp', 'sp'];

const ENTITY_TYPES = new Set([
    'Freezer',
    'Sign',
    'Teleporter',
    'Level_Entry',
    'View_Giver',
    'Tower',
    'Treasure_Display',
    'Area_Pin',
    'Rock',
    'Gem',
    'Mirror',
    'Promesst_Light',
    'Rover',
    'Monster',
    'Wardrobe',
    'Lily',
    'Tree',
    'Friendly_Dragon',
]);

// The glow colours of the Level_Entry groups (`glow` in data/progress.json), each near the median of its group's
// `color_active`, tuned so the five tell apart at icon size
const GLOW_GROUPS = {
    green: '#4fe06c',
    orange: '#ff8a1e',
    yellow: '#ffd21a',
    blue: '#2ab4ff',
    purple: '#b048ff',
};

// The level pads in the viewer's own colours, stronger than the game's so the states tell apart at a glance: the
// stone's tint and the glow (null: no glowing parts; absent: the group's glow is added). A solved pad has a dim gold
// stone and no glow.
const STONE_COLORS = {
    locked: { stone: '#4a5058', glow: null },
    open: { stone: '#8c8a80' },
    solved: { stone: '#8a7440', glow: null },
};

// The Level_Entry models of each pad shape: the plain 8-point pads and the tower levels' 16-point ones
const PAD_SHAPES = [
    { prefix: 'level-', mesh: 'GAME_OVER_Entry_' },
    { prefix: 'level-tower-', mesh: 'GAME_OVER_Entry_Hero_' },
];

function levelPadSpecs(): IconSpec[] {
    const specs: IconSpec[] = [];
    for (const shape of PAD_SHAPES) {
        const locked = `${shape.mesh}Locked_A`;
        const available = `${shape.mesh}Available_A`;
        const pad = { type: 'Level_Entry', view: TOP_VIEW };
        specs.push({ ...pad, name: `${shape.prefix}locked`, mesh: locked, viewerColors: STONE_COLORS.locked });
        specs.push({
            ...pad,
            name: `${shape.prefix}solved`,
            mesh: available,
            viewerColors: STONE_COLORS.solved,
        });
        for (const [group, glow] of Object.entries(GLOW_GROUPS)) {
            specs.push({
                ...pad,
                name: `${shape.prefix}available-${group}`,
                mesh: available,
                viewerColors: { ...STONE_COLORS.open, glow },
            });
        }
    }
    return specs;
}

const FAVICON: IconSpec = {
    name: 'favicon',
    type: 'Level_Entry',
    mesh: 'GAME_OVER_Entry_Available_A',
    parts: ['GAME_OVER_Entry_Solved_A'],
    viewerColors: { stone: '#b8902c', glow: '#e6b83a' },
    view: TOP_VIEW,
    outline: 0.5,
    shadow: false,
};

// The MINOR Teleporter pad: plain for the pads that hop across the map, gold (a gold room endpoint's) for the Antipode
// pads
const TELEPORTER_PAD: IconSpec = {
    name: 'teleporter-pad',
    type: 'Teleporter',
    mesh: 'GAME_OVER_Reset_C',
    effect: 'color_discovered',
    view: TOP_VIEW,
};

// type, mesh: the placed entity whose tints are used (the first with that mesh, and `where` true when given);
// parts: the meshes drawn, default the entity's own; effect: the entity colour field that colours the glowing parts;
// viewerColors: stone and glow colours that replace the entity's; outline: the outline width in output pixels and
// shadow: whether to draw the drop shadow, default OUTLINE_PIXELS and true
const ICONS: IconSpec[] = [
    { name: 'ice-cage', type: 'Freezer', mesh: 'GAME_OVER_Freezer_A' },
    { name: 'ice-gate', type: 'Freezer', mesh: 'GAME_OVER_Freezer_B', view: FACE_VIEW },
    { name: 'sign', type: 'Sign', mesh: 'overworld_plaque', view: FACE_VIEW },
    { name: 'teleporter', type: 'Teleporter', mesh: 'GAME_OVER_Reset_B', effect: 'color_discovered', view: TOP_VIEW },
    { ...TELEPORTER_PAD, name: 'pad', where: notGold },
    { ...TELEPORTER_PAD, name: 'gold-room', where: isGold },
    { name: 'map-scroll', type: 'View_Giver', mesh: 'GAME_EX_CamControl_Scroll' },
    { name: 'area-pin', type: 'Area_Pin', mesh: 'GAME_EX_CamControl_Map_Pin_A' },
    { name: 'treasure', type: 'Treasure_Display', mesh: 'GAME_SKIP_Treasure_Plinth_A', withTreasure: true },
    {
        name: 'treasure-taken',
        type: 'Treasure_Display',
        mesh: 'GAME_SKIP_Treasure_Plinth_A',
        parts: ['GAME_SKIP_Treasure_Chest_Open_A'],
    },
    ...levelPadSpecs(),
];

// The texture of an emblem is OverworldIcon_<emblem>; its icon is area-<emblem> in lower case with dashes
function emblemIconName(emblem: string): string {
    return 'area-' + emblem.toLowerCase().replaceAll('_', '-');
}

function isGold(fields: Fields): boolean {
    return fields.gold_room_endpoint === true;
}

function notGold(fields: Fields): boolean {
    return fields.gold_room_endpoint !== true;
}

// The vector field `prefix` (stored as prefix.x, prefix.y, ...), null when the entity has none
function vectorField(fields: Fields, prefix: string): Vector4 | null {
    if (!(`${prefix}.x` in fields)) return null;
    return [
        get(fields, `${prefix}.x`, 0),
        get(fields, `${prefix}.y`, 0),
        get(fields, `${prefix}.z`, 0),
        get(fields, `${prefix}.w`, 0),
    ];
}

// The red, green and blue of a vector field, white when the entity has none
function tintField(fields: Fields, prefix: string): Color {
    const vector = vectorField(fields, prefix);
    if (!vector) return WHITE;
    return [vector[0], vector[1], vector[2]];
}

// The colour a glowing part emits for a state colour [r, g, b, intensity]: its hue, dimmer for a dim or weak colour
function glowColor(state: Vector4): Color {
    const hue = normalized([state[0], state[1], state[2]]);
    const largest = Math.max(state[0], state[1], state[2], 1e-6);
    const brightness = 0.5 + (0.5 * Math.min(state[3], 30)) / 30;
    const strength = brightness * Math.sqrt(Math.min(1, largest));
    return [hue[0] * strength, hue[1] * strength, hue[2] * strength];
}

function hexToLinear(hex: string): Color {
    const red = parseInt(hex.slice(1, 3), 16);
    const green = parseInt(hex.slice(3, 5), 16);
    const blue = parseInt(hex.slice(5, 7), 16);
    return [srgbToLinear(red), srgbToLinear(green), srgbToLinear(blue)];
}

function pickEntity(entities: Entity[], spec: IconSpec): Entity {
    for (const entity of entities) {
        if (entity.type !== spec.type) continue;
        if (entity.fields['base.mesh'] !== spec.mesh) continue;
        if (spec.pid !== undefined && entity.pid !== spec.pid) continue;
        if (spec.where && !spec.where(entity.fields)) continue;
        return entity;
    }
    throw new Error(`${spec.name}: no ${spec.type} with mesh ${spec.mesh}`);
}

// The material names an entity draws in place of its mesh's own, by material index
function materialOverrides(fields: Fields): string[] {
    const value = fields['base.materials'];
    if (Array.isArray(value)) return value;
    return [];
}

// Skinned meshes drawn in the first frame of the animation a sleeping monster plays instead of the bind pose
const IDLE_CLIPS = new Map([
    ['soko1_goblin', 'goblin_inactive_idle_02'],
    ['soko1_dragon', 'sokodragon_inactive_idle_02'],
    ['CHAR_Dragon_Adult_A', 'promAdultDragon_inactive_idle_01'],
]);

// A mesh placed at `offset`, its triangles' materials shaded for `entity`
function loadPart(meshName: string, entity: Pick<Entity, 'pid' | 'fields'>, context: Context, spec: PartOptions): Part {
    const mesh = readMesh(meshName);
    const lod = mesh.lods[0];
    const overrides = materialOverrides(entity.fields);
    const shadingEntity: ShadingEntity = {
        tintA: tintField(entity.fields, 'base.tint_color_a'),
        tintB: tintField(entity.fields, 'base.tint_color_b'),
        effectColor: null,
        noGlow: false,
        accessoryMask: null,
    };
    const accessoryMask = entity.fields['accessory_mask'];
    if (typeof accessoryMask === 'number') shadingEntity.accessoryMask = accessoryMask;
    if (spec.effect) shadingEntity.effectColor = glowColor(vectorField(entity.fields, spec.effect)!);
    if (spec.viewerColors) {
        const stone = hexToLinear(spec.viewerColors.stone);
        shadingEntity.tintA = stone;
        shadingEntity.tintB = stone;
        if (spec.viewerColors.glow) {
            shadingEntity.effectColor = hexToLinear(spec.viewerColors.glow);
        } else {
            shadingEntity.noGlow = true;
        }
    }
    const shadings = lod.lists.map((list) => {
        let materialName = mesh.materials[list.material];
        if (overrides[list.material]) materialName = overrides[list.material];
        return context.materials.shading(materialName, shadingEntity);
    });
    const paint = context.paint.forMesh(entity.pid, mesh);
    const idleClip = IDLE_CLIPS.get(meshName);
    if (idleClip === undefined) return { mesh, positions: mesh.positions, normals: mesh.normals, paint, shadings };
    const { positions, normals } = skinMesh(mesh, worldMatrices(readFirstFrame(idleClip)));
    return { mesh, positions, normals, paint, shadings };
}

function boundsOf(part: Part): { low: number[]; high: number[] } {
    const lod = part.mesh.lods[0];
    const low = [Infinity, Infinity, Infinity];
    const high = [-Infinity, -Infinity, -Infinity];
    lod.lists.forEach((list, index) => {
        if (!part.shadings[index]) return;
        for (let k = list.first; k < list.first + list.count; k++) {
            const vertex = lod.indices[k];
            for (let axis = 0; axis < 3; axis++) {
                const value = part.positions[vertex * 3 + axis];
                low[axis] = Math.min(low[axis], value);
                high[axis] = Math.max(high[axis], value);
            }
        }
    });
    return { low, high };
}

// One part moved by `offset` and scaled by `scale`, as a copy
function placed(part: Part, offset: number[], scale: number): Part {
    const positions = new Float32Array(part.positions.length);
    for (let k = 0; k < positions.length; k++) positions[k] = part.positions[k] * scale + offset[k % 3];
    return { ...part, positions };
}

// One part turned by the entity's orientation quaternion, as a copy
function oriented(part: Part, entity: Entity): Part {
    const quaternion: Quaternion = [
        get(entity.fields, 'base.orientation.x', 0),
        get(entity.fields, 'base.orientation.y', 0),
        get(entity.fields, 'base.orientation.z', 0),
        get(entity.fields, 'base.orientation.w', 1),
    ];
    const positions = new Float32Array(part.positions.length);
    const normals = new Float32Array(part.normals.length);
    for (let k = 0; k < positions.length; k += 3) {
        const position: Vector = [part.positions[k], part.positions[k + 1], part.positions[k + 2]];
        const normal: Vector = [part.normals[k], part.normals[k + 1], part.normals[k + 2]];
        positions.set(rotateByQuaternion(quaternion, position), k);
        normals.set(rotateByQuaternion(quaternion, normal), k);
    }
    return { ...part, positions, normals };
}

// Several parts as one mesh: vertices, paint and triangle lists appended, the material indices made unique
function merge(parts: Part[]): Part {
    if (parts.length === 1) return parts[0];
    let vertexCount = 0;
    for (const part of parts) vertexCount += part.mesh.vertexCount;
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const normals = new Float32Array(vertexCount * 3);
    const paint = new Uint8Array(vertexCount * 4);
    const lists: TriangleList[] = [];
    const indices: number[] = [];
    const shadings: (Shading | null)[] = [];
    let vertexOffset = 0;
    for (const part of parts) {
        positions.set(part.positions, vertexOffset * 3);
        uvs.set(part.mesh.uvs, vertexOffset * 2);
        normals.set(part.normals, vertexOffset * 3);
        paint.set(part.paint, vertexOffset * 4);
        const lod = part.mesh.lods[0];
        lod.lists.forEach((list, index) => {
            lists.push({ material: 0, count: list.count, first: indices.length });
            shadings.push(part.shadings[index]);
            for (let k = list.first; k < list.first + list.count; k++) indices.push(lod.indices[k] + vertexOffset);
        });
        vertexOffset += part.mesh.vertexCount;
    }
    // The renderer reads only the vertex count, the uvs and the triangle lists of the mesh
    const mesh: Mesh = {
        ...parts[0].mesh,
        vertexCount,
        uvs,
        lods: [{ lists, indices: Uint32Array.from(indices) }],
    };
    return { mesh, positions, normals, paint, shadings };
}

// The treasure item stands on top of the plinth, at most half the plinth's width across
function plinthWithTreasure(plinth: Part, item: Part): Part {
    const plinthBounds = boundsOf(plinth);
    const itemBounds = boundsOf(item);
    const plinthWidth = Math.max(
        plinthBounds.high[0] - plinthBounds.low[0],
        plinthBounds.high[1] - plinthBounds.low[1],
    );
    const itemWidth = Math.max(itemBounds.high[0] - itemBounds.low[0], itemBounds.high[1] - itemBounds.low[1]);
    const scale = Math.min(1, (plinthWidth * 0.5) / itemWidth);
    const offset = [
        -((itemBounds.low[0] + itemBounds.high[0]) / 2) * scale,
        -((itemBounds.low[1] + itemBounds.high[1]) / 2) * scale,
        plinthBounds.high[2] - itemBounds.low[2] * scale,
    ];
    return merge([plinth, placed(item, offset, scale)]);
}

function buildScene(spec: IconSpec, context: Context): Part {
    const entity = pickEntity(context.entities, spec);
    const meshNames = spec.parts ?? [spec.mesh];
    const parts = meshNames.map((name) => loadPart(name, entity, context, spec));
    if (spec.oriented) return merge(parts.map((part) => oriented(part, entity)));
    if (spec.withTreasure) {
        const treasurePid = refOf(entity.fields.treasure_mesh_id);
        const treasure = context.positions.entities.find((candidate) => candidate[0] === treasurePid);
        if (!treasure) throw new Error(`${spec.name}: no entity ${treasurePid} for the treasure`);
        const treasureMesh = context.positions.meshes[treasure[5]];
        const item = loadPart(treasureMesh, { fields: { 'base.materials': [] }, pid: treasurePid }, context, {});
        return plinthWithTreasure(parts[0], item);
    }
    return merge(parts);
}

// The Mirrors and Promesst_Lights show which way they face; the other objects look the same turned any way
const ORIENTED_TYPES = new Set(['Mirror', 'Promesst_Light']);

// One icon per kind of object in the world (cage-contents.ts), drawn from a placed entity of that kind with its own
// mesh, tints and, for a Mirror or Light, its facing
function heldSpecs(entities: Entity[], schema: Schema): IconSpec[] {
    const worldFile: WorldFile = JSON.parse(readFileSync(paths.data('world.json'), 'utf8'));
    const entityByPid = new Map(entities.map((entity) => [entity.pid, entity]));
    const meshOf = (pid: number): string => {
        const mesh = entityByPid.get(pid)?.fields['base.mesh'];
        if (typeof mesh !== 'string') throw new Error(`${pid} has no mesh`);
        return mesh;
    };

    // The first object of each kind, except that a kind drawn in several meshes (the Rocks) takes the most common one
    const held = allHeldObjects(worldFile.world, schema);
    const meshCounts = new Map<string, number>();
    for (const object of held) {
        const key = `${object.name} ${meshOf(object.pid)}`;
        meshCounts.set(key, (meshCounts.get(key) ?? 0) + 1);
    }
    const kinds = new Map<string, HeldObject>();
    for (const object of held) {
        const best = kinds.get(object.name);
        const count = meshCounts.get(`${object.name} ${meshOf(object.pid)}`)!;
        if (!best || count > meshCounts.get(`${best.name} ${meshOf(best.pid)}`)!) kinds.set(object.name, object);
    }

    const specs: IconSpec[] = [];
    for (const object of kinds.values()) {
        const mesh = meshOf(object.pid);
        const spec: IconSpec = { name: object.name, type: object.type, mesh, pid: object.pid };
        if (ORIENTED_TYPES.has(object.type)) spec.oriented = true;
        if (object.type === 'Mirror') spec.view = FACING_VIEW;
        if (object.type === 'Promesst_Light' || object.type === 'Lily') spec.view = TOP_VIEW;
        specs.push(spec);
    }
    return specs.toSorted((a, b) => a.name.localeCompare(b.name));
}

function renderIcon(spec: IconSpec, context: Context, size: number, margin: number): Uint8Array {
    const scene = buildScene(spec, context);
    return renderMesh({
        ...scene,
        view: spec.view ?? DEFAULT_VIEW,
        size,
        margin,
        outline: spec.outline ?? OUTLINE_PIXELS,
        shadow: spec.shadow ?? true,
    });
}

function findMagick(): Magick {
    try {
        execFileSync('magick', ['-version'], { stdio: 'ignore' });
        return { command: 'magick', prefix: [], toPath: (path: string) => path };
    } catch {
        // not on the Windows PATH; try WSL
    }
    const toWslPath = (path: string) => '/mnt/' + path[0].toLowerCase() + path.slice(2).replaceAll('\\', '/');
    execFileSync('wsl.exe', ['-e', 'magick', '-version'], { stdio: 'ignore' });
    return { command: 'wsl.exe', prefix: ['-e', 'magick'], toPath: toWslPath };
}

function encodeAvif(magick: Magick, pngPath: string, avifPath: string): void {
    const args = [...magick.prefix, magick.toPath(pngPath), '-quality', String(AVIF_QUALITY), magick.toPath(avifPath)];
    execFileSync(magick.command, args, { stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
}

function main(): void {
    const { values } = paths.parseCommandLine({
        only: { type: 'string' },
        png: { type: 'string' },
        size: { type: 'string' },
    });
    let iconSize = ICON_SIZE;
    if (values.size) iconSize = Number(values.size);
    let wanted: Set<string> | null = null;
    if (values.only) wanted = new Set(values.only.split(','));
    const textures = new Textures();
    const materials = new Materials(textures);
    const pkg = new Package();
    const context: Context = {
        materials,
        entities: pkg.levelWithDefaults(OVERWORLD, ENTITY_TYPES),
        positions: pkg.positions(OVERWORLD),
        paint: new PaintData(OVERWORLD),
    };
    pkg.close();

    const outputDirectory = join(paths.ROOT, 'src', 'assets', 'icons');
    const pngDirectory = values.png;
    if (pngDirectory) {
        mkdirSync(pngDirectory, { recursive: true });
    } else {
        mkdirSync(outputDirectory, { recursive: true });
    }
    // Set when AVIFs are written: the encoder, and the folder the intermediate PNGs go through
    let avif: { magick: Magick; workDirectory: string } | null = null;
    if (!pngDirectory) {
        avif = { magick: findMagick(), workDirectory: mkdtempSync(join(tmpdir(), 'soko-icons-')) };
    }

    let totalBytes = 0;
    const writeIcon = (name: string, rgba: Uint8Array): void => {
        const png = encodePng(rgba, iconSize, iconSize);
        if (pngDirectory) {
            writeFileSync(join(pngDirectory, `${name}.png`), png);
            console.log(`${name}.png`);
            return;
        }
        const pngPath = join(avif!.workDirectory, `${name}.png`);
        const avifPath = join(outputDirectory, `${name}.avif`);
        writeFileSync(pngPath, png);
        encodeAvif(avif!.magick, pngPath, avifPath);
        const bytes = statSync(avifPath).size;
        totalBytes += bytes;
        console.log(`${name}.avif ${bytes} bytes`);
    };

    for (const spec of [...ICONS, ...heldSpecs(context.entities, pkg.schema)]) {
        if (wanted && !wanted.has(spec.name)) continue;
        writeIcon(spec.name, renderIcon(spec, context, iconSize, ICON_MARGIN));
    }

    const textureIcons: { name: string; texture: string }[] = [
        { name: 'voice-log', texture: 'UI_Voice_Log_Activate' },
        { name: 'hero', texture: 'wheel_queen' },
    ];
    for (const emblem of AREA_EMBLEMS) {
        textureIcons.push({ name: emblemIconName(emblem), texture: `${EMBLEM_PREFIX}${emblem}` });
    }

    for (const worlds of TOWER_BADGES) {
        textureIcons.push({ name: `tower-${worlds}`, texture: `${TOWER_PREFIX}${worlds}` });
        textureIcons.push({ name: `tower-${worlds}-gold`, texture: `${TOWER_PREFIX}${worlds}_gold` });
    }

    for (const { name, texture: textureName } of textureIcons) {
        if (wanted && !wanted.has(name)) continue;
        const texture = textures.get(textureName);
        if (!texture) throw new Error(`no texture ${textureName} for the icon ${name}`);
        const level = texture.level(0);
        writeIcon(name, fitSquare(level.pixels, level.width, level.height, iconSize));
    }

    if (!wanted || wanted.has('favicon')) {
        let directory = outputDirectory;
        if (pngDirectory) directory = pngDirectory;
        for (const size of FAVICON_SIZES) {
            const rgba = renderIcon(FAVICON, context, size, 1);
            const path = join(directory, `favicon-${size}.png`);
            writeFileSync(path, encodePng(rgba, size, size));
            console.log(`favicon-${size}.png`);
        }
    }
    if (avif) rmSync(avif.workDirectory, { recursive: true });
    materials.close();
    if (totalBytes) console.log(`total ${totalBytes} bytes`);
}

main();
