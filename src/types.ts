// The shapes of the data files the viewer embeds: data/progress.json (with data/world.json merged in) and
// data/walk.json, as docs/DATAFILES.md describes them. A trailing `exists` element of a world row is the entity's
// existence when the level loads; rows without it always exist.
import type { GlowGroup } from './map/level-icons.ts';

/** A world position. */
export type Position = [x: number, y: number, z: number];

/** A pair of world x and y values (a grid corner, a size). */
export type XY = [x: number, y: number];

/** One row of data/progress.json `levels`: an overworld Level_Entry. */
export interface ProgressLevel {
    /** The level name. */
    n: string;
    p: Position;
    /** Indices into `levels` of the levels that unlock it. */
    req: number[];
    /** 1 when any one of `req` unlocks it. */
    or?: number;
    /** 1 when it is gated but open from the start. */
    en?: number;
    /** Its tower_flags bits. */
    t?: number;
    /** The glow colour group of its pad. */
    glow: GlowGroup;
    /** 1 when its pad is the 16-point star of a tower level. */
    tower?: number;
    /** 1 for a dropdown. */
    d?: number;
    /** Its achievement name. */
    a?: string;
    /** [index into `sets`, place in the set from 1]. */
    set?: [setIndex: number, place: number];
    /** Index into `areas`. */
    area?: number;
    /** 1 when it lies outside every area box and is grouped with the nearest. */
    areaNear?: number;
    /** [index into `areas`, float_parameter] of every area box holding it, when more than one area does. */
    overlap?: Array<[areaIndex: number, floatParameter: number]>;
}

/** One row of data/progress.json `sets`. */
export interface LevelSet {
    name: string;
    /** The number of levels in the set that exist. */
    n: number;
}

/** One row of data/progress.json `towers`. */
export interface Tower {
    pid: number;
    /** Its tower_flags bits. */
    t: number;
    /** levels_required. */
    req: number;
    p: Position;
    /** Index into `teleporters` of its `teleporter_id` pad when that is a MINOR pad (a high tower's is a MAJOR one). */
    pad?: number;
    /** Index into `teleporters` of its `teleporter_id` pad when that is a MAJOR pad: a sky tower's pad in the sky hub. */
    hub?: number;
}

/** An unlock id of a Freezer that is not a level: a Sign by rank, a tower Sign, the gold-room Sign, or another. */
export interface FreezerSign {
    pid: number;
    rank?: number;
    /** Index into `towers`. */
    tower?: number;
    gold?: number;
}

/** One row of data/progress.json `freezers`: a Freezer. */
export interface Freezer {
    pid: number;
    p: Position;
    /** Its ground layer. */
    l: number;
    /** Indices into `levels` of the levels that unlock it. */
    req: number[];
    or?: number;
    /** 1 when partial_solve_count is set. */
    partial?: number;
    judge?: number;
    /** 1 for a model B Freezer (base.mesh GAME_OVER_Freezer_B), a doorway. */
    doorway?: 1;
    signs?: FreezerSign[];
}

/** One row of data/progress.json `signs`: a Sign that opens gates, or a tower status Sign. */
export interface Sign {
    pid: number;
    p: Position;
    l: number;
    rank?: number;
    /** Index into `towers`. */
    tower?: number;
    gold?: number;
    /** 1 for a tower status Sign. */
    status?: number;
    /** Indices into `freezers` of the gates that list it. */
    gates: number[];
}

/** One row of data/progress.json `voice_logs`. */
export interface VoiceLog {
    pid: number;
    p: Position;
    l: number;
    name: string;
    author?: string;
    /** 1 when it is already played in the level data. */
    d?: number;
}

/** One row of data/progress.json `view_givers`: a map scroll. */
export interface ViewGiver {
    pid: number;
    p: Position;
    l: number;
}

/** A local area box, as data/level_areas.json stores it. */
export interface AreaBox {
    p: Position;
    /** Orientation quaternion (x, y, z, w). */
    q: [x: number, y: number, z: number, w: number];
    s: Position;
    /** props.box_extents. */
    e: Position;
    /** float_parameter: the priority, lower wins. */
    f: number;
    /** The wrap widths for x and y. */
    w: XY;
}

/** One row of data/progress.json `areas`. */
export interface Area {
    local_area_name: string;
    display: string;
    /** The emblem texture's name (`OverworldIcon_Soko_Prom`), empty for an area with none. */
    image: string;
    /** The label position. */
    p: Position;
    /** The Area_Pin pid. */
    pin: number;
    boxes: AreaBox[];
    layer: string;
    order: number;
}

/** data/progress.json `fog`. */
export interface ProgressFog {
    grid: { corner: XY; screen: XY; count: XY; wrapping: boolean };
    primary: Array<{ pid: number; layer: number }>;
    boxes: Array<{ pid: number; layer: number; min: Position; max: Position }>;
    /** Per level name, [layer, region]. */
    levels: Record<string, [layer: number, region: number]>;
    start: { hero: Position; regions: Record<string, number[]>; pins: number[] };
}

/** The key of a layer of the overhead map. */
export type MapLayerKey = 'underworld' | 'ground' | 'sky';

/** One layer of the overhead map. */
export interface MapLayer {
    key: MapLayerKey;
    name: string;
    z: [low: number, high: number];
}

/** One drawn Ocean_Map of the overhead map. */
export interface MapOcean {
    pid: number;
    /** Index into the map's `layers`. */
    layer: number;
    x0: number;
    y0: number;
    sx: number;
    sy: number;
    /** The drawn surface z. */
    zw: number;
    /** Base64 of the initial water bit mask. */
    water: string;
}

/** A MAIN_MAP Camera_Marker box: its centre and extents. */
export interface MapBox {
    c: Position;
    e: Position;
}

/** data/progress.json `map`: data/map.json and the main map boxes. */
export interface ProgressMap {
    corner: XY;
    size: XY;
    layers: MapLayer[];
    oceans: MapOcean[];
    main_box?: Record<string, MapBox | undefined>;
}

/** One row of data/progress.json `endgame_way_ins`: [level, freezer indices, 1 to replace the walk's gates]. */
export type EndgameWayIn = [level: number, freezers: number[], replace: number];

/** What a known route asks for: a level solved, a Freezer open or a Sign read, by index into `levels`, `freezers`, `signs`. */
export type RouteNeed = { level: number } | { freezer: number } | { sign: number } | { rock: number };

/** Where a known route takes the hero: a level's entrance, a teleporter (index into `teleporters`), or a position. */
export type RouteTarget = { level: number } | { pad: number } | { at: Position };

/**
 * One row of data/progress.json `known_routes`: a route the walk does not find, written by hand. With every group of
 * `needs` met (all of the groups needed, one of the needs inside a group) the hero reaches `to`. `area` and `tower` mark a
 * sky Way: the sky Way area (index into `areas`) that leads to the hub quarter of the sky tower (index into `towers`)
 * whose hub pad `to` is. `onto` (sky or underworld) marks the way onto that layer, which then asks for the route's needs.
 */
export interface KnownRoute {
    id: string;
    to: RouteTarget;
    needs: RouteNeed[][];
    area?: number;
    tower?: number;
    onto?: string;
}

/**
 * What names an ending's stage: an area, a level, a tower or a sky Way (a known route with an area and a tower), by
 * index into `areas`, `levels`, `towers`, `known_routes`.
 */
export type EndingStageName = { area: number } | { level: number } | { tower: number } | { route: number };

/**
 * When an ending's stage is done, by index into `freezers`, `teleporters` and `levels`:
 * - achievement: the achievement is earned;
 * - tower: the tower is active;
 * - freezers: every one of them is open;
 * - solved: the level is solved;
 * - pads: one of the pads is discovered.
 */
export type EndingStageDone =
    | { rule: 'achievement'; name: string }
    | { rule: 'tower'; tower: number }
    | { rule: 'freezers'; freezers: number[] }
    | { rule: 'solved'; level: number }
    | { rule: 'pads'; pads: number[] };

/** One stage of an ending; `seen` lists pads (indices into `teleporters`) whose discovery shows the stage by itself. */
export interface EndingStage {
    name: EndingStageName;
    done: EndingStageDone;
    seen: number[];
}

/** One row of data/progress.json `ending_stages`: the stages of an ending (by its achievement), in order. */
export interface EndingStages {
    ending: string;
    stages: EndingStage[];
}

/** world.grid: the overworld grid and the fast-travel box of the map rooms. */
export interface WorldGrid {
    corner: XY;
    size: XY;
    /** A z byte is z + zoff. */
    zoff: number;
    ft?: { corner: XY; size: XY; z: number };
}

/** world.groups: a Wall_Set with an `exists` entry and its number of cells in `group_cells`. */
export interface WallSetGroup {
    pid: number;
    exists: number;
    n: number;
}

/** world.egroups: an existence Group. Subgroups and unexisted-by are indices into `egroups`. */
export type ExistenceGroup = [
    pid: number,
    existsByDefault: number,
    subgroups: number[],
    unexistedBy: number[],
    members: number[],
];

/** An entity in one cell: world.floors, rocks, lilies, trees and blockers. */
export type CellRow = [pid: number, i: number, j: number, z: number, exists?: number];

/** world.lily_spawns, world.rock_spawns: a Spawner's cell, the pid of the Lily or Rock it respawns and the Activators that run it. */
export type SpawnRow = [
    spawnerPid: number,
    i: number,
    j: number,
    z: number,
    spawnedPid: number,
    activators: CellRow[],
    exists?: number,
];

/** world.fences: side 0 east, 1 north, 2 west, 3 south. */
export type FenceRow = [pid: number, i: number, j: number, z: number, side: number, exists?: number];

/** world.gates: `closes` is the way a closing Gate pushes what stands in it (side 0 east..3 south, 4 up, 5 down). */
export type GateRow = [
    pid: number,
    i: number,
    j: number,
    z: number,
    open: number,
    notted: number,
    flavor: number,
    monster: number,
    closes: number,
    exists?: number,
];

/** world.switches. */
export type SwitchRow = [
    pid: number,
    flavor: number,
    pressed: number,
    i: number,
    j: number,
    z: number,
    exists?: number,
];

/** world.oceans: square k is cell ((i + k % sizeX) mod W, (j + floor(k / sizeX)) mod H). */
export type OceanRow = [
    pid: number,
    z: number,
    layer: number,
    i: number,
    j: number,
    sizeX: number,
    sizeY: number,
    exists?: number,
];

/** world.rivers: direction 1 E, 2 N, 3 W, 4 S. */
export type RiverRow = [i: number, j: number, z: number, direction: number];

/**
 * world.elevators: an exists of -1 means the frame has no `exists` entry. The last two fields are only on an elevator
 * with Rocks stacked on its platform: the mask with one Rock left, and the stack's Rock pids, bottom first.
 */
export type ElevatorRow = [
    i: number,
    j: number,
    zBottom: number,
    i2: number,
    j2: number,
    zTop: number,
    mask: number,
    bottomPid: number,
    bottomExists: number,
    topPid: number,
    topExists: number,
    oneRockMask?: number,
    stack?: number[],
];

/** world.bridges: a Rock or Gem pushed from the push cell sinks into the water cell. */
export type BridgeRow = [
    pid: number,
    pushI: number,
    pushJ: number,
    pushZ: number,
    waterI: number,
    waterJ: number,
    waterZ: number,
];

/** world.movables: kind 0 Gem, 1 Promesst_Light, 2 Mirror, 3 Rover, 4 Friendly_Dragon. */
export type MovableRow = [pid: number, i: number, j: number, z: number, kind: number, exists?: number];

/** world.magic_mirrors: (ax, ay) and (bx, by) are a flat mirror's open sides as grid steps. */
export type MagicMirrorRow = [
    pid: number,
    i: number,
    j: number,
    z: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
    vertical: number,
    freezer: number,
    exists?: number,
];

/** world.mirror_facings: theta_target in quarter turns, shape 0 flat, 1 vertical, 2 vertical_downward. */
export type MirrorFacingRow = [pid: number, quarterTurns: number, shape: number];

/** world.rover_facings: theta_target in quarter turns; even runs the Rover east-west, odd north-south. */
export type RoverFacingRow = [pid: number, quarterTurns: number];

/** world.area_pins: world positions. */
export type AreaPinRow = [pid: number, x: number, y: number, z: number];

/** world.mechs: kind 0 dragon, 1 beam blocker, 2 mirror, 3 skipping stone. */
export type MechRow = [kind: number, pid: number, i: number, j: number, z: number, exists?: number];

/** world.monsters: kind is a dragon's facing side, -1 a goblin, -2 neither. */
export type MonsterRow = [pid: number, i: number, j: number, z: number, kind: number, exists?: number];

/** world.beam_stops. */
export type BeamStopRow = [i: number, j: number, z: number];

/** world.lights: side -1 is off the grid axes; color is the Promesst_Power value. */
export type LightRow = [
    pid: number,
    i: number,
    j: number,
    z: number,
    side: number,
    up: number,
    down: number,
    powered: number,
    color: number,
    exists?: number,
];

/** world.gem_slots. */
export type GemSlotRow = [pid: number, i: number, j: number, z: number, beamPowered: number, exists?: number];

/** world.wardrobes: skill 1 PROTECTION, 2 another skill, 0 none. */
export type WardrobeRow = [pid: number, i: number, j: number, z: number, side: number, skill: number, exists?: number];

/** data/world.json `world`: the overworld as walkable cells. */
export interface World {
    grid: WorldGrid;
    /** The ground layer of each integer z = index - zoff. */
    zlayer: number[];
    /** zlib + base64 of the static solid voxels per column. */
    solid: string;
    groups: WallSetGroup[];
    /** zlib + base64 of the (i, j, z + zoff) cells of `groups`. */
    group_cells: string;
    egroups: ExistenceGroup[];
    floors: CellRow[];
    fences: FenceRow[];
    gates: GateRow[];
    switches: SwitchRow[];
    oceans: OceanRow[];
    /** zlib + base64 of the indices into `oceans` with water per column. */
    water: string;
    rivers: RiverRow[];
    elevators: ElevatorRow[];
    rocks: CellRow[];
    bridges: BridgeRow[];
    movables: MovableRow[];
    blockers: CellRow[];
    /** The pids of the MIRRORABLE Rocks and mirrorable Rovers. */
    mirrorable: number[];
    magic_mirrors: MagicMirrorRow[];
    mirror_facings: MirrorFacingRow[];
    rover_facings?: RoverFacingRow[];
    /** The pids of the SKIPPABLE Rocks. */
    skippable: number[];
    /** The pids of the TELEPORT Wardrobes. */
    teleport: number[];
    /** The pids of the CHARM Wardrobes. */
    charm?: number[];
    /** The pids of the TRANSMUTE Wardrobes. */
    transmute?: number[];
    /** The pids of the Wardrobes that give the Rod (inventory_flags WAND). */
    rod?: number[];
    trees: CellRow[];
    lilies: CellRow[];
    lily_spawns?: SpawnRow[];
    rock_spawns?: SpawnRow[];
    area_pins: AreaPinRow[];
    mechs: MechRow[];
    monsters: MonsterRow[];
    beam_stops: BeamStopRow[];
    lights: LightRow[];
    gem_slots: GemSlotRow[];
    /** The pids of the Gems held by another entity. */
    held_gems: number[];
    wardrobes: WardrobeRow[];
    guy: [pid: number, protection: number];
}

/** One row of data/world.json `teleporters`: a pad. */
export interface Teleporter {
    pid: number;
    p: Position;
    /** Its ground layer. */
    l: number;
    /** 1 for a MAJOR pad. */
    major: number;
    /** The target_id pid. */
    target: number;
    /** 1 when enabled in the level data. */
    en: number;
    also?: number;
    also2?: number;
    /** 1 when discovered in the level data. */
    disc?: number;
    gold?: number;
    ex?: number;
    /** Index into `egroups` of the pad's own Group. */
    g?: number;
    /** Index into `egroups` of its also_exist_this_group_id Group. */
    ag?: number;
    /** The position of a target that is not a pad. */
    to?: Position;
}

/** One row of data/world.json `treasure_displays`. */
export interface TreasureDisplay {
    pid: number;
    p: Position;
    /** treasure_index. */
    i: number;
}

/** One row of data/world.json `gold_rooms`: indices into `towers` (in progress.json) and `teleporters`. */
export interface GoldRoom {
    tower: number;
    pad: number;
    endpoint: number;
}

/** data/world.json. */
export interface WorldFile {
    world: World;
    teleporters: Teleporter[];
    treasure_displays: TreasureDisplay[];
    gold_rooms: GoldRoom[];
}

/** data/progress.json. */
export interface Progress extends WorldFile {
    levels: ProgressLevel[];
    sets: LevelSet[];
    towers: Tower[];
    freezers: Freezer[];
    signs: Sign[];
    treasures: number;
    voice_logs: VoiceLog[];
    view_givers: ViewGiver[];
    areas: Area[];
    fog: ProgressFog;
    map: ProgressMap;
    endgame_way_ins: EndgameWayIn[];
    known_routes: KnownRoute[];
    ending_stages: EndingStages[];
}

/** Per map layer key, one value per map column. */
export type MapLayerValues<Value> = Record<MapLayerKey, Value>;

/** data/walk.json: what the walk works out from the level data alone. */
export interface WalkFile {
    /** The SHA-256 (hex) of each input file. */
    inputs: { 'progress.json': string; 'world.json': string };
    roles: {
        /** One digit per level and per Freezer: 2 Required, 1 Required as one of several, 0 Optional. */
        need: { l: string; g: string };
        /** Per level and per Freezer, the indices into `freezers` of the Freezers it sits behind. */
        bg: { l: number[][]; g: number[][] };
    };

    /** Per map layer key, zlib + base64 of the highest z where the walk stands the hero, plus 128. */
    floors: MapLayerValues<string>;

    /**
     * The push search of the screen rooms: how many rooms it searched with every Freezer closed, how many with some
     * Freezers open, how many answers it stores that have something to tell, how many it stores for rooms with nothing
     * to tell, no start or too many positions, how many positions it visited, the first cell of each room that hit the
     * cap, and zlib + base64 of the answers as JSON.
     */
    rooms: {
        searched: number;
        variants: number;
        answered: number;
        empty: number;
        states: number;
        capped: number[];
        data: string;
    };
}

/** One field of an entity type in data/schema.json: k is p plain (sz bytes), s string, r resource name or a array of `e`. */
export interface SchemaField {
    /** The field's index in its type's field list. */
    i: number;
    n: string;
    /** [first version, last version] of the type that has it; -1 for no bound. */
    v: [first: number, last: number];
    k: 'p' | 's' | 'r' | 'a';
    sz?: number;
    t: string;
    enum?: string;
    enum_t?: string;
    notes?: string[];
    at?: number;
    e?: SchemaField;
}

/** One entity type in data/schema.json. */
export interface SchemaType {
    version: number;
    size: number;
    fields?: SchemaField[];
    missing?: boolean;
}

/** One enum in data/schema.json: its names and values. */
export interface SchemaEnum {
    flags: boolean;
    values: Array<[name: string, value: number]>;
}

/** data/schema.json: the entity types by name, the fields every entity has and the enums. */
export interface Schema {
    base: { name: string; fields: SchemaField[] };
    types: Record<string, SchemaType>;
    enums: Record<string, SchemaEnum>;
}
