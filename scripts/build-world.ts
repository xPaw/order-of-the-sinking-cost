// Builds data/world.json: the overworld's walkable-cell model (Wall_Set voxels, fences, gates, water, lilies, elevators,
// teleporters, Freezers) plus teleporter, treasure and gold-room tables, for the viewer's reachability and progress
// views. build-progress.ts merges it into data/progress.json; the viewer walks it (docs/VIEWER.md "The walk model (viewer)" and
// "Level roles (viewer)").
//
// Reads <game>/data/levels.package (overworld) and data/schema.json; writes data/world.json.
//
// Usage: node scripts/build-world.ts [--game DIR]
//
// world.json:
//   grid: {corner: [x, y], size: [W, H], zoff, ft}   cells wrap in x and y; z bytes are z + zoff; ft: {corner, size, z}
//          the fast-travel box (Settings fast_travel_corner / _extents): cells at z and above wrap inside it
//   zlayer: [256]   ground layer (0 ground, 1 underground, 2 sky, 3-5 fast-travel map rooms) of each integer z - zoff
//   solid: packed (zlib + base64), per column (row-major from the corner, j * W + i) u8 count n, then n u8
//          (z + zoff), ascending: Wall_Set voxels not in an existence group
//   groups: [{pid, exists, n}] Wall_Sets in an existence group (exists = level-data default); group_cells: packed
//          u8 triplets (i, j, z + zoff), n per group in order
//   floors: [[pid, i, j, z(, exists)]]   Fences with `blocking` and `is_floor`: a floor at the bottom of their own cell
//   oceans: [[pid, z, layer, i, j, sx, sy(, exists)]]   Ocean_Maps (every kind); square k is cell (i + k % sx, j + k // sx)
//   water: packed, per column u8 count n, then n u16 LE indices into `oceans`, ascending: maps with water (bit 0 of
//          ocean_values, after detect_holes) at that square in the level data
//   rivers: [[i, j, z, dir]]   river squares in the level data (water with a flow Direction, 1 E, 2 N, 3 W, 4 S) of
//          the Ocean_Maps the overhead map draws; z = the map's z
//   fences: [[pid, i, j, z, side(, exists)]]   a blocking non-floor Fence closes one edge of its cell (side 0 east,
//          1 north, 2 west, 3 south)
//   A row's `exists` (the level-data default, 0 or 1) is there only for an entity in an existence group or one the cell
//   lookup skips by its entity_flags (in_existence); the save's entity_flags CHANGEs override it.
//   gates: [[pid, i, j, z, open, notted, flavor, monster, closes(, exists)]]   Gates with their level-data `open`; a
//          closed one blocks its cell until a hero in an OPEN beam opens it; closes: the way a closing Gate pushes what
//          stands in its cell (side as `fences`, 4 up, 5 down)
//   switches: [[pid, flavor, pressed, i, j, z(, exists)]]   Switches; gates of the same flavor follow them
//   elevators: [[i, j, zb, i2, j2, zt, mask, pid, exists, pid2, exists2(, mask1, [rock pids])]]   per Elevator_Platform
//          its bottom and top Stairs frames (exists -1: not listed); mask bit 1 rides up, bit 2 down, with no Rock on the
//          platform; mask1 is the mask with one Rock left of the stacked Rocks listed (buildElevators())
//   freezers / teleporters: index into progress.json `freezers` / `teleporters` (cell = their p)
//   rocks: [[pid, i, j, z(, exists)]]   pushable Rocks in the level data; the save moves them (position CHANGE),
//          destroys them and creates others (CREATION_OR_DESTRUCTION)
//   bridges: [[rock or gem pid, push i, j, z, water i, j, z]]   rock and gem bridges (buildBridges())
//   movables: [[pid, i, j, z, kind(, exists)]]   pushed by the hero besides Rocks and Monsters (kind: index in MOVABLES)
//   blockers: [[pid, i, j, z(, exists)]]   Signs (FULL_GAME), Treasure_Displays, Judges: cannot be pushed, block the hero
//   lilies: [[pid, i, j, z(, exists)]]   Lily pads, standable at their own cell over water; rivers move them
//          (position CHANGE)
//   lily_spawns: [[spawner pid, i, j, z, lily pid, [[activator pid, i, j, z(, exists)]](, exists)]]   the Spawners that
//          respawn a Lily (`spawned_entity_id` is a Lily), at their own cell, with the Activators that run them. A Lily
//          Spawner stands in the Lily's own cell, but seven stand along a river row of the underworld for one Lily
//   rock_spawns: [[spawner pid, i, j, z, rock pid, [[activator pid, i, j, z(, exists)]](, exists)]]   the same for the
//          Spawners that respawn a Rock (`spawned_entity_id` is a Rock)
//   area_pins: [[pid, x, y, z]]   world positions; an `activated` Area_Pin (history CHANGE) is a flood-fill seed
//   mechs: [[kind, pid, i, j, z(, exists)]]   mechanics the walk does not model (0 dragon, 1 beam blocker Rock, 2 mirror,
//          3 skipping stone not sunk); they name why a level may still be reachable
//   monsters: [[pid, i, j, z, kind(, exists)]]   every Monster (each one stops dragon fire); kind is a DRAGON's facing
//          (the side its +x axis points to, as `fences`), -1 a GOBLIN (attacks the 6 cells next to it, above and below
//          included), -2 neither
//   beam_stops: [[i, j, z]]   Eggs: a beam ends in them (and in movables, blockers, Trees, Rocks, shut Gates and frozen
//          Freezers; Guys, Monsters, MIRRORABLE Rocks and mirrorable Rovers do not stop it)
//   mirrorable: [pid]   the Rocks whose `properties` hold MIRRORABLE and the Rovers with `mirrorable`: beams pass them
//   magic_mirrors: [[pid, i, j, z, ax, ay, bx, by, vertical, freezer(, exists)]]   magic Mirrors: a flat one's open arms
//          as grid steps (a, b), vertical ones with zero arms; freezer: the pid of the Freezer in its cell, else 0
//   mirror_facings: [[pid, quarter turns, shape]]   every Mirror: its level-data `theta_target` in quarter turns (the
//          save holds its changes), shape 0 flat, 1 vertical, 2 vertical_downward; they give the open sides a line meets
//          (docs/MOVEMENT.md "Mirrors turning fire and beams")
//   rover_facings: [[pid, quarter turns]]   every Rover: its level-data `theta_target` in quarter turns (the save holds
//          its changes); even runs it east-west, odd north-south (docs/MOVEMENT.md "Rovers")
//   skippable: [pid]   the SKIPPABLE Rocks (skipping stones)
//   teleport: [pid]   the Wardrobes whose skill_flags hold TELEPORT
//   charm: [pid]   the Wardrobes whose skill_flags hold CHARM
//   transmute: [pid]   the Wardrobes whose skill_flags hold TRANSMUTE
//   push: [pid]   the Wardrobes whose skill_flags hold SINGLE_PUSH
//   multipush: [pid]   the Wardrobes whose skill_flags hold MULTIPUSH
//   rod: [pid]   the Wardrobes whose inventory_flags hold WAND (the Rod)
//   trees: [[pid, i, j, z(, exists)]]   Trees: they stop dragon fire and beams while they exist (TRANSMUTE turns one into
//          a crystal Rock: a CREATION record destroys it)
//   lights: [[pid, i, j, z, side, up, down, powered, color(, exists)]]   every Promesst_Light; side as `fences` (its
//          +x axis), -1 off the grid axes; up / down: vertical_up / vertical_down; powered: the level-data `powered` (the
//          save holds its changes); color: its Promesst_Power value (1 THROUGH: its beam lets the hero through walls)
//   wardrobes: [[pid, i, j, z, side, skill(, exists)]]   a Wardrobe's door is the edge its +x axis points to (side as
//          `fences`): fire does not cross it; a hero leaving through it takes its skill (1 PROTECTION, 2 another skill,
//          0 none: inventory only) and one entering through it gets the default skill back
//   gem_slots: [[pid, i, j, z, beam_powered(, exists)]]   every Gem_Slot; beam_powered: its level-data `flags` hold
//          BEAM_POWERED (the save holds its changes). A room's lights are powered when its existing slots are all filled
//   held_gems: [pid]   the Gems whose level-data attached_to_entity_id names a holder (a Gem fills a slot only when free)
//   guy: [pid, protection]   the overworld Guy and whether its level-data skill_flags hold PROTECTION
//   egroups: [[pid, exists_by_default, [subgroup], [unexisted by], [member pid]]]   existence Groups (is_existence_group);
//          subgroup: its child existence Groups, unexisted by: the existence Groups whose unexist_this_id(2, 3) names
//          it (indices into egroups); member pid: its direct members other than Groups, those
//          EXISTS_FOR_COSMETIC_..., and those the cell lookup skips by their flags. Making a Group exist makes its
//          members exist and its subgroups too, except a subgroup that an existing Group unexists (src/walk/groups.ts)
//   teleporters `to`: the position of a target that is not a pad (a Marker), where the pad sends the mover
//   teleporters `g` / `ag`: the egroups index of the pad's own Group and of its also_exist_this_group_id Group, which
//          enabling the pad makes exist
import { deflateSync } from 'node:zlib';
import type {
    BridgeRow,
    CellRow,
    ElevatorRow,
    ExistenceGroup,
    GoldRoom,
    MechRow,
    OceanRow,
    Position,
    RiverRow,
    Schema,
    SpawnRow,
    Teleporter,
    TreasureDisplay,
    WorldGrid,
} from '../src/types.ts';
import { flagsOf, get, positionOf, refOf, requireNumber, type Fields } from './lib/fields.ts';
import {
    boundLayer,
    fastTravelBoxes,
    groundLayer,
    layerSettings,
    layerTable,
    type FastTravelBox,
    type LayerRange,
} from './lib/layers.ts';
import { compareNumberLists, modulo } from './lib/math.ts';
import { writeJsonAtomic } from './lib/output.ts';
import { Package, type Entity } from './lib/package.ts';
import * as paths from './lib/paths.ts';
import { isAxisAligned, oceanSquares, wallVoxels } from './lib/voxels.ts';

// The [i, j, z] cell of a grid position
type Cell = [i: number, j: number, z: number];
type Columns = Map<number, Set<number>>;

interface Side {
    dx: number;
    dy: number;
    side: number;
}

// The Wall_Sets in an existence group, with their level-data existence and cells
interface WallGroup {
    pid: number;
    exists: number;
    cells: Cell[];
}

const LEVEL = 'overworld';
const TYPES = new Set([
    'Settings',
    'Wall_Set',
    'Fence',
    'Stairs',
    'Teleporter',
    'Freezer',
    'Rock',
    'Group',
    'Treasure_Display',
    'Tower',
    'Camera_Marker',
    'Lily',
    'Area_Pin',
    'Gate',
    'Ocean_Map',
    'Switch',
    'Marker',
    'Monster',
    'Promesst_Light',
    'Mirror',
    'Tree',
    'Sign',
    'Gem',
    'Rover',
    'Friendly_Dragon',
    'Wardrobe',
    'Guy',
    'Egg',
    'Elevator_Platform',
    'Judge',
    'Gem_Slot',
    'Spawner',
    'Activator',
]);
// Pushed by the hero, other than Rocks and Monsters (which have their own lists); `movables` kind = index here
const MOVABLES = ['Gem', 'Promesst_Light', 'Mirror', 'Rover', 'Friendly_Dragon'];
// Cannot be pushed: they block the hero and hold up what stands on them
const BLOCKERS = ['Sign', 'Treasure_Display', 'Judge'];
const Z_OFFSET = 64;
const Z_BYTES = 256;
// Cell edge a move across a (dx, dy) step crosses: east, north, west, south
const SIDES: Side[] = [
    { dx: 1, dy: 0, side: 0 },
    { dx: 0, dy: 1, side: 1 },
    { dx: -1, dy: 0, side: 2 },
    { dx: 0, dy: -1, side: 3 },
];
const SKIPPED_FLAGS = ['EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY', 'NOT_SNAPPED_TO_GRID', 'PLAYABLE_IN_PRELUDE'];
const COSMETIC = 'EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY';
const MAX_BRIDGE_PUSH = 40;
// An Activator runs the Spawners named by its fields spawner_1 to spawner_16
const ACTIVATOR_SPAWNERS = 16;
// A bridge Rock sinks into water whose surface is within this many units of the Rock's z
const SURFACE_TOLERANCE = 0.6;
// Cell keys offset z by this much so that they stay positive
const KEY_Z_OFFSET = 4096;

// The cell a position rounds to: [x, y, z] as ints
function integerPosition(fields: Fields): Position {
    const [x, y, z] = positionOf(fields);
    return [Math.round(x), Math.round(y), Math.round(z)];
}

// Grid side (0 east, 1 north, 2 west, 3 south) the entity's local +x axis points to; null off the grid axes
function axisSide(fields: Fields): number | null {
    const qx = get(fields, 'base.orientation.x', 0);
    const qy = get(fields, 'base.orientation.y', 0);
    const qz = get(fields, 'base.orientation.z', 0);
    const qw = get(fields, 'base.orientation.w', 1);
    const axisX = 1 - 2 * (qy * qy + qz * qz);
    const axisY = 2 * (qx * qy + qz * qw);
    if (axisX > 0.5) return 0;
    if (axisX < -0.5) return 2;
    if (axisY > 0.5) return 1;
    if (axisY < -0.5) return 3;
    return null;
}

// The grid steps [dx, dy] of a flat Mirror's two open arms: its local +x and +y axes, reversed
function mirrorArms(fields: Fields): [[dx: number, dy: number], [dx: number, dy: number]] {
    const qx = get(fields, 'base.orientation.x', 0);
    const qy = get(fields, 'base.orientation.y', 0);
    const qz = get(fields, 'base.orientation.z', 0);
    const qw = get(fields, 'base.orientation.w', 1);
    const axisX = [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy + qz * qw)];
    const axisY = [2 * (qx * qy - qz * qw), 1 - 2 * (qx * qx + qz * qz)];
    return [
        [-Math.round(axisX[0]) || 0, -Math.round(axisX[1]) || 0],
        [-Math.round(axisY[0]) || 0, -Math.round(axisY[1]) || 0],
    ];
}

// side, up, down of a Promesst_Light's beam
function beamDirection(fields: Fields): [side: number, up: number, down: number] {
    const side = axisSide(fields);
    return [side === null ? -1 : side, Number(Boolean(fields.vertical_up)), Number(Boolean(fields.vertical_down))];
}

// False for a Sign of the demo only (demo_phase other than FULL_GAME)
function isFullGame(entity: Entity): boolean {
    return entity.type !== 'Sign' || get(entity.fields, 'demo_phase', 'FULL_GAME') === 'FULL_GAME';
}

// The overworld's entities by type, its grid and the existence-group table that every row builder needs
class World {
    entities: Entity[];
    byType: Map<string, Entity[]>;
    settings: Fields;
    cornerX: number;
    cornerY: number;
    width: number;
    height: number;
    fastTravel: FastTravelBox[];
    table: (LayerRange | null)[];
    groups: Map<number, Fields>;
    groupDefault: Map<number, boolean>;
    rockBit: Record<string, number>;
    power: Record<string, number>;

    constructor(entities: Entity[], schema: Schema) {
        this.entities = entities;
        this.byType = new Map();
        for (const entity of entities) {
            let sameType = this.byType.get(entity.type);
            if (!sameType) {
                sameType = [];
                this.byType.set(entity.type, sameType);
            }
            sameType.push(entity);
        }
        this.settings = this.ofType('Settings')[0].fields;
        this.cornerX = requireNumber(this.settings, 'grid.corner.x');
        this.cornerY = requireNumber(this.settings, 'grid.corner.y');
        this.width = requireNumber(this.settings, 'grid.squares_x');
        this.height = requireNumber(this.settings, 'grid.squares_y');
        this.fastTravel = fastTravelBoxes(this.ofType('Camera_Marker').map((entity) => entity.fields));
        this.table = layerTable(layerSettings(this.settings), this.fastTravel);
        this.groups = new Map();
        for (const entity of this.ofType('Group')) this.groups.set(entity.pid, entity.fields);
        this.groupDefault = new Map();
        for (const [pid, fields] of this.groups) {
            if (fields.is_existence_group) this.groupDefault.set(pid, Boolean(fields.exists_by_default));
        }
        this.rockBit = Object.fromEntries(schema.enums['Rock.properties'].values);
        this.power = Object.fromEntries(schema.enums.Promesst_Power.values);
    }

    ofType(name: string): Entity[] {
        return this.byType.get(name) ?? [];
    }

    // The grid cell [i, j] of a world x, y (the world wraps in both directions)
    cell(x: number, y: number): [i: number, j: number] {
        return [modulo(x - this.cornerX, this.width), modulo(y - this.cornerY, this.height)];
    }

    // The [i, j, z] cell of an entity
    cellOf(fields: Fields): Cell {
        const [x, y, z] = integerPosition(fields);
        const [i, j] = this.cell(x, y);
        return [i, j, z];
    }

    // A number that identifies an [i, j, z] cell, for sets and maps of cells
    key(i: number, j: number, z: number): number {
        return ((z + KEY_Z_OFFSET) * this.height + j) * this.width + i;
    }

    columnKey(i: number, j: number): number {
        return j * this.width + i;
    }

    // [listed, exists]: whether a row gets an `exists` entry, and its level-data value. On level load every existence
    // Group takes its exists_by_default (its stored `exists` is ignored) and sets CURRENTLY_EXISTS on its direct
    // members to match, so a member's stored flag is ignored too; a member EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY
    // is left out. The game's cell lookup skips an entity IN_EXISTENCE_GROUP without CURRENTLY_EXISTS, one
    // EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY, a NOT_SNAPPED_TO_GRID one other than a Door (no Door is in these
    // lists) and a PLAYABLE_IN_PRELUDE one unless the level is doing its prelude (the overworld has none).
    existence(fields: Fields): [listed: boolean, exists: boolean] {
        const flags = flagsOf(fields, 'base.entity_flags');
        const skipped = SKIPPED_FLAGS.some((flag) => flags.includes(flag));
        const group = refOf(fields['base.group_id']);
        if (this.groupDefault.has(group) && !flags.includes(COSMETIC)) {
            return [true, this.groupDefault.get(group)! && !skipped];
        }
        if (flags.includes('IN_EXISTENCE_GROUP')) return [true, flags.includes('CURRENTLY_EXISTS') && !skipped];
        return [skipped, false];
    }

    // The trailing `exists` column of a row: the level-data value when the entity has one, else nothing
    existsColumn(fields: Fields): number[] {
        const [listed, exists] = this.existence(fields);
        if (listed) return [Number(exists)];
        return [];
    }

    // [pid, i, j, z, exists?]
    cellRow(entity: Entity): CellRow {
        const [i, j, z] = this.cellOf(entity.fields);
        const row: CellRow = [entity.pid, i, j, z];
        row.push(...this.existsColumn(entity.fields));
        return row;
    }

    // [pid, i, j, z, ...extra, exists?]
    row(entity: Entity, ...extra: number[]): number[] {
        return [entity.pid, ...this.cellOf(entity.fields), ...extra, ...this.existsColumn(entity.fields)];
    }

    // A Rock's `properties` bits from the decoded flags (names, plus a number for unnamed bits)
    rockBits(fields: Fields): number {
        const flags = fields.properties ?? [];
        let bits = 0;
        for (const flag of Array.isArray(flags) ? flags : [flags]) {
            if (typeof flag === 'string') bits += this.rockBit[flag] ?? 0;
            else if (typeof flag === 'number') bits += flag;
        }
        return bits;
    }

    // The Promesst_Power value of a light's color, 0 for none
    powerOf(color: unknown): number {
        if (typeof color !== 'string') return 0;
        return this.power[color] ?? 0;
    }

    // The layer of a Teleporter: its Group chain's bind_to_layer, else the layer its z falls in
    teleporterLayer(fields: Fields): number {
        return groundLayer(this.table, positionOf(fields)[2], boundLayer(this.groups, fields));
    }
}

// The Wall_Set voxels: columns (cell column -> set of z) for those always there, and the existence groups' cells
function collectWalls(world: World): { columns: Columns; groups: WallGroup[] } {
    const columns: Columns = new Map();
    const groups: WallGroup[] = [];
    for (const wall of world.ofType('Wall_Set')) {
        const fields = wall.fields;
        if (fields.kind === 'OCEAN_HOLE') continue;
        const [listed, exists] = world.existence(fields);
        const cells = wallVoxels(fields).map(([x, y, z]): Cell => {
            const [i, j] = world.cell(x, y);
            return [i, j, z];
        });
        if (listed) {
            groups.push({ pid: wall.pid, exists: Number(exists), cells });
            continue;
        }
        for (const [i, j, z] of cells) {
            const key = world.columnKey(i, j);
            let zs = columns.get(key);
            if (!zs) {
                zs = new Set();
                columns.set(key, zs);
            }
            zs.add(z);
        }
    }
    return { columns, groups };
}

// A blocking floor Fence is a floor at the bottom of its own cell: it holds the hero in that cell and blocks vertical
// moves through it; a non-blocking one does nothing
function collectFloors(world: World): CellRow[] {
    const floors: CellRow[] = [];
    for (const fence of world.ofType('Fence')) {
        if (!(fence.fields.is_floor && fence.fields.blocking)) continue;
        floors.push(world.cellRow(fence));
    }
    return floors;
}

// A fence blocks a move out of its cell along its local +x axis and a move into its cell against it
// (|axis . direction| > 0.5); fences tilted off the grid axes block nothing
function collectFences(world: World): number[][] {
    const fences: number[][] = [];
    for (const fence of world.ofType('Fence')) {
        if (!fence.fields.blocking || fence.fields.is_floor) continue;
        const side = axisSide(fence.fields);
        if (side === null) continue;
        fences.push(world.row(fence, side));
    }
    return fences;
}

// The way a closing Gate pushes what stands in its cell (0 east, 1 north, 2 west, 3 south, 4 up, 5 down): its local −z
// axis (local −x when `sideways`), reversed by `negate_direction`, rounded to the nearest grid axis
function closingSide(fields: Fields): number {
    const qx = get(fields, 'base.orientation.x', 0);
    const qy = get(fields, 'base.orientation.y', 0);
    const qz = get(fields, 'base.orientation.z', 0);
    const qw = get(fields, 'base.orientation.w', 1);
    let axis = [2 * (qx * qz + qy * qw), 2 * (qy * qz - qx * qw), 1 - 2 * (qx * qx + qy * qy)];
    if (fields.sideways) axis = [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy + qz * qw), 2 * (qx * qz - qy * qw)];
    let sign = -1;
    if (fields.negate_direction) sign = 1;
    const [pushX, pushY, pushZ] = axis.map((value) => sign * value);
    const largest = Math.max(Math.abs(pushX), Math.abs(pushY), Math.abs(pushZ));
    if (Math.abs(pushZ) === largest) return pushZ > 0 ? 4 : 5;
    if (Math.abs(pushX) === largest) return pushX > 0 ? 0 : 2;
    return pushY > 0 ? 1 : 3;
}

function collectGates(world: World): number[][] {
    return world.ofType('Gate').map((gate) => {
        const fields = gate.fields;
        return world.row(
            gate,
            Number(Boolean(fields.open)),
            Number(Boolean(fields.notted)),
            get(fields, 'flavor', 0),
            Number(Boolean(fields.is_monster_gate)),
            closingSide(fields),
        );
    });
}

// [pid, i, j, z, armA dx, armA dy, armB dx, armB dy, vertical, freezer pid(, exists)] per magic Mirror; a flat one's
// arms are its two open sides (mirrorArms), a vertical one's arms are 0; freezer pid: the Freezer in its cell, else 0
function collectMagicMirrors(world: World): number[][] {
    const freezerAt = new Map<number, number>();
    for (const freezer of world.ofType('Freezer'))
        freezerAt.set(world.key(...world.cellOf(freezer.fields)), freezer.pid);
    const rows: number[][] = [];
    for (const mirror of world.ofType('Mirror')) {
        const fields = mirror.fields;
        if (!fields.is_magic) continue;
        const vertical = Boolean(fields.is_vertical);
        let arms: [[number, number], [number, number]] = [
            [0, 0],
            [0, 0],
        ];
        if (!vertical) arms = mirrorArms(fields);
        const freezer = freezerAt.get(world.key(...world.cellOf(fields))) ?? 0;
        rows.push(world.row(mirror, ...arms[0], ...arms[1], Number(vertical), freezer));
    }
    return rows;
}

// [pid, quarter turns of theta_target, shape] per Mirror; shape 0 flat, 1 vertical, 2 vertical_downward
function collectMirrorFacings(world: World): [pid: number, quarterTurns: number, shape: number][] {
    return world.ofType('Mirror').map((mirror) => {
        const fields = mirror.fields;
        const quarterTurns = modulo(Math.round(get(fields, 'base.theta_target', 0) / 90), 4);
        let shape = 0;
        if (fields.is_vertical && fields.is_vertical_downward) {
            shape = 2;
        } else if (fields.is_vertical) {
            shape = 1;
        }
        return [mirror.pid, quarterTurns, shape];
    });
}

// [pid, quarter turns] per Rover: its level-data `theta_target`. Even is a Rover that runs east-west, odd north-south.
function collectRoverFacings(world: World): [pid: number, quarterTurns: number][] {
    return world.ofType('Rover').map((rover) => {
        const quarterTurns = modulo(Math.round(get(rover.fields, 'base.theta_target', 0) / 90), 4);
        return [rover.pid, quarterTurns];
    });
}

// The pids of the Wardrobes whose `field` (skill_flags or inventory_flags) holds `flag`
function wardrobesWithFlag(world: World, field: string, flag: string): number[] {
    const wardrobes = world.ofType('Wardrobe').filter((wardrobe) => flagsOf(wardrobe.fields, field).includes(flag));
    return wardrobes.map((wardrobe) => wardrobe.pid).toSorted((first, second) => first - second);
}

function collectSwitches(world: World): number[][] {
    return world.ofType('Switch').map((entity) => {
        const fields = entity.fields;
        const [i, j, z] = world.cellOf(fields);
        const exists = world.existsColumn(fields);
        return [entity.pid, get(fields, 'flavor', 0), Number(Boolean(fields.pressed)), i, j, z, ...exists];
    });
}

// Water squares: detect_holes maps start all water and lose it under their OCEAN_HOLE Wall_Set voxels
function collectOceans(world: World) {
    const holes = new Map<number, Set<string>>();
    for (const wall of world.ofType('Wall_Set')) {
        const fields = wall.fields;
        if (fields.kind !== 'OCEAN_HOLE') continue;
        const target = refOf(fields.ocean_hole_id);
        if (!target) continue;
        let cut = holes.get(target);
        if (!cut) {
            cut = new Set();
            holes.set(target, cut);
        }
        for (const [x, y] of wallVoxels(fields)) cut.add(`${x},${y}`);
    }
    const oceans: OceanRow[] = [];
    const surfaces: number[] = [];
    const water = new Map<number, number[]>();
    const rivers: RiverRow[] = [];
    for (const map of world.ofType('Ocean_Map')) {
        const fields = map.fields;
        const [listed, exists] = world.existence(fields);
        const squaresX = get(fields, 'grid.squares_x', 0);
        const squaresY = get(fields, 'grid.squares_y', 0);
        const storedValues = fields.ocean_values;
        const values: number[] = Array.isArray(storedValues) ? [...storedValues] : [];
        if (values.length !== squaresX * squaresY) continue;
        // an `oceans` row maps square k to cell (i + k % sx, j + floor(k / sx)), which holds only for an unrotated map
        if (!isAxisAligned(fields)) throw new Error(`Ocean_Map ${map.id} is rotated; world.oceans cannot hold it`);
        const x0 = Math.round(get(fields, 'base.position.x', 0) + get(fields, 'grid.corner.x', 0));
        const y0 = Math.round(get(fields, 'base.position.y', 0) + get(fields, 'grid.corner.y', 0));
        const squares = oceanSquares(fields);
        if (fields.detect_holes) {
            const mapHoles = holes.get(map.pid) ?? new Set();
            squares.forEach(([x, y], k) => {
                if (mapHoles.has(`${x},${y}`)) values[k] &= ~1;
                else values[k] |= 1;
            });
        }
        const surface = get(fields, 'base.position.z', 0);
        // river squares of the maps the overhead map draws (build-map.ts): water with a flow direction
        const isDrawn = fields.kind !== 'PLAYER_BLOCKING_ONLY' && (exists || !listed);
        values.forEach((value, k) => {
            if (!(value & 1)) return;
            const [i, j] = world.cell(...squares[k]);
            const column = world.columnKey(i, j);
            let wetOceans = water.get(column);
            if (!wetOceans) {
                wetOceans = [];
                water.set(column, wetOceans);
            }
            wetOceans.push(oceans.length);
            const flow = (value >> 2) & 7;
            if (isDrawn && flow) rivers.push([i, j, Math.round(surface), flow]);
        });
        const [i0, j0] = world.cell(x0, y0);
        const ocean: OceanRow = [map.pid, surface, groundLayer(world.table, surface), i0, j0, squaresX, squaresY];
        if (listed) ocean.push(Number(exists));
        oceans.push(ocean);
        surfaces.push(surface);
    }
    return { oceans, surfaces, water, rivers };
}

// [i, j, zb, i2, j2, zt, mask, bottom pid, bottom exists, top pid, top exists(, one-Rock mask, stack pids)] per
// Elevator_Platform (bottom frame first; exists -1 when not listed). mask bit 1 rides up from the bottom frame, bit 2
// down from the top, with no Rock on the platform. A static solid voxel between the frames stops the platform: no link.
// A Rock in the platform's resting cell keeps the hero off at that end, and is pushed off at the other end only through
// a frame cell with two opposite open sides: the one-Rock mask. A stack of two or more Rocks is not one push: no link.
// The last two fields are on an elevator with Rocks stacked on the platform, their pids bottom first; the walk counts
// how many are left.
function buildElevators(
    world: World,
    columns: Columns,
    groupSolid: Set<number>,
    fenceKeys: Set<number>,
    rockAt: Map<number, number>,
): ElevatorRow[] {
    const stairs = new Map<number, Entity>();
    for (const entity of world.ofType('Stairs')) stairs.set(entity.pid, entity);
    const isSolid = (i: number, j: number, z: number) =>
        columns.get(world.columnKey(i, j))?.has(z) || groupSolid.has(world.key(i, j, z));
    const isOpenSide = (x: number, y: number, z: number, step: Side) => {
        const [i, j] = world.cell(x, y);
        const [ni, nj] = world.cell(x + step.dx, y + step.dy);
        const opposite = (step.side + 2) % 4;
        if (isSolid(ni, nj, z)) return false;
        if (fenceKeys.has(world.key(i, j, z) * 4 + step.side)) return false;
        return !fenceKeys.has(world.key(ni, nj, z) * 4 + opposite);
    };
    const sideStep = (side: number) => SIDES[side];
    const hasOpenPair = (x: number, y: number, z: number) => {
        const eastWest = isOpenSide(x, y, z, sideStep(0)) && isOpenSide(x, y, z, sideStep(2));
        if (eastWest) return true;
        return isOpenSide(x, y, z, sideStep(1)) && isOpenSide(x, y, z, sideStep(3));
    };
    const existsOrNone = (fields: Fields) => {
        const [listed, exists] = world.existence(fields);
        if (listed) return Number(exists);
        return -1;
    };

    const rows: ElevatorRow[] = [];
    for (const platform of world.ofType('Elevator_Platform')) {
        const fields = platform.fields;
        const bottom = stairs.get(refOf(fields.bottom_owner));
        const top = stairs.get(refOf(fields.top_owner));
        if (!bottom || !top) continue;
        const bottomAt = integerPosition(bottom.fields);
        const topAt = integerPosition(top.fields);
        const platformAt = integerPosition(fields);
        const [i, j] = world.cell(bottomAt[0], bottomAt[1]);
        const [i2, j2] = world.cell(topAt[0], topAt[1]);
        let mask = 3;
        for (let z = bottomAt[2] + 1; z < topAt[2]; z++) {
            if (columns.get(world.columnKey(i, j))?.has(z)) mask = 0;
        }
        const [pi, pj] = world.cell(platformAt[0], platformAt[1]);
        const stack: number[] = [];
        let rockPid = rockAt.get(world.key(pi, pj, platformAt[2]));
        while (rockPid !== undefined) {
            stack.push(rockPid);
            rockPid = rockAt.get(world.key(pi, pj, platformAt[2] + stack.length));
        }
        const atTop = Math.abs(platformAt[2] - topAt[2]) < Math.abs(platformAt[2] - bottomAt[2]);
        let oneRockMask = mask;
        if (atTop) oneRockMask &= hasOpenPair(...bottomAt) ? 1 : 0;
        else oneRockMask &= hasOpenPair(...topAt) ? 2 : 0;
        const row: ElevatorRow = [
            i,
            j,
            bottomAt[2],
            i2,
            j2,
            topAt[2],
            mask,
            bottom.pid,
            existsOrNone(bottom.fields),
            top.pid,
            existsOrNone(top.fields),
        ];
        if (stack.length) row.push(oneRockMask, stack);
        rows.push(row);
    }
    // by bottom z, then j, then i
    const order = (row: ElevatorRow) => [row[2], row[1], row[0]];
    return rows.toSorted((first, second) => compareNumberLists(order(first), order(second)));
}

// [spawner pid, i, j, z, spawned pid, [activator rows](, exists)]: the Spawners whose spawned entity is of `type`. An
// Activator runs the Spawners named by its spawner_1 to spawner_16 fields.
function buildSpawns(world: World, type: string): SpawnRow[] {
    const spawnedPids = new Set(world.ofType(type).map((entity) => entity.pid));
    const spawns: SpawnRow[] = [];
    for (const spawner of world.ofType('Spawner')) {
        const spawnedPid = refOf(spawner.fields.spawned_entity_id);
        if (!spawnedPids.has(spawnedPid)) continue;

        const activators = world
            .ofType('Activator')
            .filter((activator) => activatorRunsSpawner(activator, spawner.pid))
            .map((activator) => world.cellRow(activator));
        const [i, j, z] = world.cellOf(spawner.fields);
        const spawn: SpawnRow = [spawner.pid, i, j, z, spawnedPid, activators];
        spawn.push(...world.existsColumn(spawner.fields));
        spawns.push(spawn);
    }
    return spawns;
}

function activatorRunsSpawner(activator: Entity, spawnerPid: number): boolean {
    for (let number = 1; number <= ACTIVATOR_SPAWNERS; number++) {
        if (activator.fields[`spawner_${number}`] === spawnerPid) return true;
    }
    return false;
}

// [rock or gem pid, push cell i, j, z, water cell i, j, z]: a non-SKIPPABLE Rock or a Gem standing on support that the
// hero, from the standable push cell behind it, pushes in a straight line over supported, fence-free cells (no solid,
// Gate, Freezer or other Rock) into a water cell (a map surface within 0.6 of z) with nothing at z - 1, where it sinks
// to the surface - 1 in any depth and holds the hero up.
function buildBridges(
    world: World,
    columns: Columns,
    fenceKeys: Set<number>,
    blockedKeys: Set<number>,
    rocks: CellRow[],
    floors: CellRow[],
    surfaces: number[],
    water: Map<number, number[]>,
): BridgeRow[] {
    const isSolid = (i: number, j: number, z: number) => columns.get(world.columnKey(i, j))?.has(z) ?? false;
    const rockKeys = new Set(rocks.map((rock) => world.key(rock[1], rock[2], rock[3])));
    const floorKeys = new Set(floors.map((floor) => world.key(floor[1], floor[2], floor[3])));
    const neighbour = (i: number, j: number, dx: number, dy: number): [number, number] => [
        modulo(i + dx, world.width),
        modulo(j + dy, world.height),
    ];
    const hasEdge = (a: Cell, b: Cell, side: number) =>
        fenceKeys.has(world.key(...a) * 4 + side) || fenceKeys.has(world.key(...b) * 4 + ((side + 2) % 4));
    const isSupported = (i: number, j: number, z: number) =>
        isSolid(i, j, z - 1) || rockKeys.has(world.key(i, j, z - 1)) || floorKeys.has(world.key(i, j, z));
    const isWet = (i: number, j: number, z: number) =>
        (water.get(world.columnKey(i, j)) ?? []).some((index) => Math.abs(surfaces[index] - z) < SURFACE_TOLERANCE);

    const bridges: BridgeRow[] = [];
    for (const rock of [...world.ofType('Rock'), ...world.ofType('Gem')]) {
        const fields = rock.fields;
        if (rock.type === 'Rock' && world.rockBits(fields) & world.rockBit.SKIPPABLE) continue;
        const [i, j, z] = world.cellOf(fields);
        if (!isSupported(i, j, z)) continue;
        for (const { dx, dy, side } of SIDES) {
            const push: Cell = [...neighbour(i, j, -dx, -dy), z];
            if (isSolid(...push) || !isSupported(...push) || hasEdge(push, [i, j, z], side)) continue;
            let at: Cell = [i, j, z];
            for (let step = 0; step < MAX_BRIDGE_PUSH; step++) {
                const next: Cell = [...neighbour(at[0], at[1], dx, dy), z];
                const key = world.key(...next);
                if (isSolid(...next) || blockedKeys.has(key) || rockKeys.has(key) || hasEdge(at, next, side)) break;
                if (isSupported(...next)) {
                    at = next;
                    continue;
                }
                if (isWet(...next) && !isSolid(next[0], next[1], z - 1)) bridges.push([rock.pid, ...push, ...next]);
                break;
            }
        }
    }
    return bridges;
}

// [kind, pid, i, j, z(, exists)] of the entities the walk does not model: 0 a dragon (DRAGON Monster), 1 a beam blocker
// (a Rock named *beam_blocker or *beam_barrier*), 2 a Mirror or a MIRRORABLE Rock, 3 a SKIPPABLE Rock (a skipping
// stone) that is not a FLIPPING_TARGET
function buildMechanics(world: World): MechRow[] {
    const mechanics: MechRow[] = [];
    const add = (kind: number, entity: Entity) => mechanics.push([kind, ...world.cellRow(entity)]);
    for (const monster of world.ofType('Monster')) {
        if (flagsOf(monster.fields, 'constant_flags').includes('DRAGON')) add(0, monster);
    }
    for (const mirror of world.ofType('Mirror')) add(2, mirror);
    const bit = world.rockBit;
    for (const rock of world.ofType('Rock')) {
        const name = get(rock.fields, 'base.entity_name', '') || '';
        const bits = world.rockBits(rock.fields);
        if (name.includes('beam_blocker') || name.includes('beam_barrier')) add(1, rock);
        if (bits & bit.MIRRORABLE) add(2, rock);
        if (bits & bit.SKIPPABLE && !(bits & bit.FLIPPING_TARGET)) add(3, rock);
    }
    return mechanics;
}

// Per column j * W + i: u8 count n, then n u8 (z + Z_OFFSET), ascending
function packColumns(world: World, columns: Columns): Buffer {
    const bytes: number[] = [];
    for (let j = 0; j < world.height; j++) {
        for (let i = 0; i < world.width; i++) {
            const zs = [...(columns.get(world.columnKey(i, j)) ?? [])]
                .map((z) => z + Z_OFFSET)
                .filter((z) => z >= 0 && z < Z_BYTES)
                .toSorted((first, second) => first - second);
            bytes.push(zs.length, ...zs);
        }
    }
    return Buffer.from(bytes);
}

// Per column j * W + i: u8 count n, then n u16 LE indices, ascending
function packIndexColumns(world: World, columns: Map<number, number[]>): Buffer {
    const bytes: number[] = [];
    for (let j = 0; j < world.height; j++) {
        for (let i = 0; i < world.width; i++) {
            const indexes = [...(columns.get(world.columnKey(i, j)) ?? [])].toSorted((first, second) => first - second);
            bytes.push(indexes.length);
            for (const index of indexes) bytes.push(index & 0xff, index >> 8);
        }
    }
    return Buffer.from(bytes);
}

// zlib stream (JS: new DecompressionStream('deflate')), base64
function pack(bytes: Uint8Array): string {
    return deflateSync(bytes, { level: 9 }).toString('base64');
}

// MAJOR teleporters pair a world pad with its twin in a fast-travel map room (layers 3-5); MINOR ones are one-way pads
// to target_id. enabled_t_target > 0 and (MAJOR) discovered decide whether a pad works. also / also2: the
// also_discover / also_discover2 pads its discovery enables and discovers too (reveals() in src/walk/teleporters.ts)
function buildTeleporters(world: World, groupIndex: Map<number, number>) {
    const pads: Teleporter[] = [];
    for (const teleporter of world.ofType('Teleporter')) {
        const fields = teleporter.fields;
        const pad: Teleporter = {
            pid: teleporter.pid,
            p: integerPosition(fields),
            l: world.teleporterLayer(fields),
            major: Number(fields.teleporter_type === 'MAJOR'),
            target: refOf(fields.target_id),
            en: Number(get(fields, 'enabled_t_target', 0) > 0),
        };
        const also = refOf(fields.also_discover);
        if (also) pad.also = also;
        const also2 = refOf(fields.also_discover2);
        if (also2) pad.also2 = also2;
        if (fields.discovered) pad.disc = 1;
        if (fields.gold_room_endpoint) pad.gold = 1;
        const [listed, exists] = world.existence(fields);
        if (listed) pad.ex = Number(exists);
        const ownGroup = groupIndex.get(refOf(fields['base.group_id']));
        if (ownGroup !== undefined) pad.g = ownGroup;
        const alsoExistGroup = groupIndex.get(refOf(fields.also_exist_this_group_id));
        if (alsoExistGroup !== undefined) pad.ag = alsoExistGroup;
        pads.push(pad);
    }
    const padIndex = new Map<number, number>();
    pads.forEach((pad, index) => padIndex.set(pad.pid, index));
    // a pad whose target is not a pad (a Marker) sends the mover to the target's position: `to`
    const positions = new Map<number, Position>();
    for (const entity of world.entities) positions.set(entity.pid, integerPosition(entity.fields));
    for (const pad of pads) {
        const targetPosition = positions.get(pad.target);
        if (pad.target && !padIndex.has(pad.target) && targetPosition) pad.to = targetPosition;
    }
    return { pads, padIndex };
}

function buildTreasures(world: World): TreasureDisplay[] {
    const treasures = world.ofType('Treasure_Display').map((entity) => ({
        pid: entity.pid,
        p: integerPosition(entity.fields),
        i: get(entity.fields, 'treasure_index', 0),
    }));
    return treasures.toSorted((first, second) => first.i - second.i);
}

// Gold rooms: each ground-floor Tower's teleporter_id is a MINOR pad (disabled until the tower activates) whose target
// is a gold_room_endpoint pad in the gold hub
function buildGoldRooms(world: World, pads: Teleporter[], padIndex: Map<number, number>): GoldRoom[] {
    const rooms: GoldRoom[] = [];
    for (const tower of world.ofType('Tower')) {
        const padPid = refOf(tower.fields.teleporter_id);
        const padPosition = padIndex.get(padPid);
        if (padPosition === undefined) continue;
        const pad = pads[padPosition];
        const endpoint = padIndex.get(pad.target);
        if (endpoint === undefined || !pads[endpoint].gold) continue;
        rooms.push({ tower: tower.pid, pad: padPosition, endpoint });
    }
    return rooms;
}

// The existence Groups sorted by pid as [pid, exists by default, subgroup indexes, unexisted-by indexes, member pids],
// and the pid -> index map
function buildExistenceGroups(world: World) {
    const pids = [...world.groupDefault.keys()].toSorted((first, second) => first - second);
    const index = new Map<number, number>();
    pids.forEach((pid, i) => index.set(pid, i));
    const groups: ExistenceGroup[] = pids.map((pid) => [pid, Number(world.groupDefault.get(pid)), [], [], []]);
    for (const pid of pids) {
        for (const key of ['unexist_this_id', 'unexist_this_id2', 'unexist_this_id3']) {
            const target = refOf(world.groups.get(pid)![key]);
            const targetIndex = index.get(target);
            if (targetIndex === undefined) continue;
            const unexistedBy = groups[targetIndex][3];
            if (!unexistedBy.includes(pid)) unexistedBy.push(index.get(pid)!);
        }
    }
    for (const entity of world.entities) {
        const groupPosition = index.get(refOf(entity.fields['base.group_id']));
        if (groupPosition === undefined) continue;
        if (entity.type === 'Group') {
            const entityPosition = index.get(entity.pid);
            if (entityPosition !== undefined) groups[groupPosition][2].push(entityPosition);
        } else if (!SKIPPED_FLAGS.some((flag) => flagsOf(entity.fields, 'base.entity_flags').includes(flag))) {
            groups[groupPosition][4].push(entity.pid);
        }
    }
    return { groups, index };
}

function sortedCells(cells: Iterable<Cell>): Cell[] {
    return [...cells].toSorted(compareNumberLists);
}

// The world model with the teleporters, treasure displays and gold rooms, as written to world.json
function buildWorld(pkg: Package) {
    const entities = pkg.levelWithDefaults(LEVEL, TYPES);
    const world = new World(entities, pkg.schema);
    const { settings } = world;

    const { columns, groups } = collectWalls(world);
    const floors = collectFloors(world);
    const fences = collectFences(world);
    const gates = collectGates(world);
    const switches = collectSwitches(world);
    const { oceans, surfaces, water, rivers } = collectOceans(world);

    const usableGroups = groups.filter(
        (group) => group.cells.length && group.cells.every(([, , z]) => z + Z_OFFSET >= 0 && z + Z_OFFSET < Z_BYTES),
    );
    const rockAt = new Map<number, number>();
    for (const rock of world.ofType('Rock')) rockAt.set(world.key(...world.cellOf(rock.fields)), rock.pid);
    const groupSolid = new Set<number>();
    for (const group of groups) {
        if (!group.exists) continue;
        for (const [i, j, z] of group.cells) groupSolid.add(world.key(i, j, z));
    }
    const fenceKeys = new Set(fences.map((fence) => world.key(fence[1], fence[2], fence[3]) * 4 + fence[4]));
    const elevators = buildElevators(world, columns, groupSolid, fenceKeys, rockAt);

    // dragon fire and goblin attacks hold a hero with PROTECTION over water (docs/VIEWER.md "The walk model (viewer)")
    const monsters = world.ofType('Monster').map((monster) => {
        const flags = flagsOf(monster.fields, 'constant_flags');
        const facing = flags.includes('DRAGON') ? axisSide(monster.fields) : null;
        if (facing !== null) return world.row(monster, facing);
        if (flags.includes('GOBLIN')) return world.row(monster, -1);
        return world.row(monster, -2);
    });
    const wardrobes: number[][] = [];
    for (const wardrobe of world.ofType('Wardrobe')) {
        const side = axisSide(wardrobe.fields);
        const skills = flagsOf(wardrobe.fields, 'skill_flags');
        if (side === null) continue;
        if (skills.includes('PROTECTION')) wardrobes.push(world.row(wardrobe, side, 1));
        else if (skills.length) wardrobes.push(world.row(wardrobe, side, 2));
        else wardrobes.push(world.row(wardrobe, side, 0));
    }
    const guy = world.ofType('Guy').at(0);
    const rocks = world.ofType('Rock').map((rock) => world.cellRow(rock));

    // at and above the lowest FAST_TRAVEL Camera_Marker box (its centre z minus extent, minus 0.5) positions wrap inside
    // the fast-travel box instead of the grid
    const grid: WorldGrid = {
        corner: [world.cornerX, world.cornerY],
        size: [world.width, world.height],
        zoff: Z_OFFSET,
    };
    if (world.fastTravel.length) {
        const lowest = world.fastTravel.reduce((best, box) => (isLowerBox(box, best) ? box : best));
        grid.ft = {
            corner: [get(settings, 'fast_travel_corner.x', 0), get(settings, 'fast_travel_corner.y', 0)],
            size: [get(settings, 'fast_travel_extents.x', 0), get(settings, 'fast_travel_extents.y', 0)],
            z: Math.ceil(lowest.z - Math.abs(lowest.extent) - 0.5),
        };
    }

    const { groups: existenceGroups, index: groupIndex } = buildExistenceGroups(world);
    const blockedKeys = new Set(gates.map((gate) => world.key(gate[1], gate[2], gate[3])));
    for (const freezer of world.ofType('Freezer')) blockedKeys.add(world.key(...world.cellOf(freezer.fields)));
    const zLayers: number[] = [];
    for (let z = 0; z < Z_BYTES; z++) zLayers.push(groundLayer(world.table, z - Z_OFFSET));

    const rovers = world.ofType('Rover').filter((rover) => rover.fields.mirrorable);
    const mirrorableRocks = world
        .ofType('Rock')
        .filter((rock) => world.rockBits(rock.fields) & world.rockBit.MIRRORABLE);
    const eggCells = world.ofType('Egg').map((egg) => world.cellOf(egg.fields));
    const skippableRocks = world.ofType('Rock').filter((rock) => world.rockBits(rock.fields) & world.rockBit.SKIPPABLE);

    const model = {
        grid,
        zlayer: zLayers,
        solid: pack(packColumns(world, columns)),
        floors,
        oceans,
        water: pack(packIndexColumns(world, water)),
        rivers,
        fences,
        gates,
        switches,
        groups: usableGroups.map((group) => ({ pid: group.pid, exists: group.exists, n: group.cells.length })),
        group_cells: pack(
            Buffer.from(usableGroups.flatMap((group) => group.cells.flatMap(([i, j, z]) => [i, j, z + Z_OFFSET]))),
        ),
        elevators,
        rocks,
        bridges: buildBridges(world, columns, fenceKeys, blockedKeys, rocks, floors, surfaces, water),
        lilies: world.ofType('Lily').map((lily) => world.cellRow(lily)),
        lily_spawns: buildSpawns(world, 'Lily'),
        rock_spawns: buildSpawns(world, 'Rock'),
        area_pins: world.ofType('Area_Pin').map((pin) => [pin.pid, ...integerPosition(pin.fields)]),
        mechs: buildMechanics(world),
        monsters,
        movables: MOVABLES.flatMap((type, kind) => world.ofType(type).map((entity) => world.row(entity, kind))),
        blockers: BLOCKERS.flatMap((type) =>
            world
                .ofType(type)
                .filter(isFullGame)
                .map((entity) => world.cellRow(entity)),
        ),
        beam_stops: sortedCells(uniqueCells(eggCells)),
        mirrorable: [...mirrorableRocks, ...rovers]
            .map((entity) => entity.pid)
            .toSorted((first, second) => first - second),
        magic_mirrors: collectMagicMirrors(world),
        mirror_facings: collectMirrorFacings(world),
        rover_facings: collectRoverFacings(world),
        skippable: skippableRocks.map((rock) => rock.pid).toSorted((first, second) => first - second),
        teleport: wardrobesWithFlag(world, 'skill_flags', 'TELEPORT'),
        charm: wardrobesWithFlag(world, 'skill_flags', 'CHARM'),
        transmute: wardrobesWithFlag(world, 'skill_flags', 'TRANSMUTE'),
        push: wardrobesWithFlag(world, 'skill_flags', 'SINGLE_PUSH'),
        multipush: wardrobesWithFlag(world, 'skill_flags', 'MULTIPUSH'),
        rod: wardrobesWithFlag(world, 'inventory_flags', 'WAND'),
        trees: world.ofType('Tree').map((tree) => world.cellRow(tree)),
        lights: world
            .ofType('Promesst_Light')
            .map((light) =>
                world.row(
                    light,
                    ...beamDirection(light.fields),
                    Number(Boolean(light.fields.powered)),
                    world.powerOf(light.fields.color),
                ),
            ),
        wardrobes,
        gem_slots: world
            .ofType('Gem_Slot')
            .map((slot) => world.row(slot, Number(flagsOf(slot.fields, 'flags').includes('BEAM_POWERED')))),
        held_gems: world
            .ofType('Gem')
            .filter((gem) => refOf(gem.fields.attached_to_entity_id) !== 0)
            .map((gem) => gem.pid),
        guy: guy ? [guy.pid, Number(flagsOf(guy.fields, 'skill_flags').includes('PROTECTION'))] : [0, 0],
        egroups: existenceGroups,
    };
    const { pads, padIndex } = buildTeleporters(world, groupIndex);
    return {
        world: model,
        teleporters: pads,
        treasure_displays: buildTreasures(world),
        gold_rooms: buildGoldRooms(world, pads, padIndex),
    };
}

// Whether a box is lower than another: the lower z, then the smaller extent
function isLowerBox(box: FastTravelBox, best: FastTravelBox): boolean {
    if (box.z !== best.z) return box.z < best.z;
    return box.extent < best.extent;
}

// The cells without repeats, in first-seen order
function uniqueCells(cells: Cell[]): Iterable<Cell> {
    const seen = new Map<string, Cell>();
    for (const cell of cells) seen.set(cell.join(','), cell);
    return seen.values();
}

function main(): void {
    paths.parseCommandLine();
    const pkg = new Package();
    const result = buildWorld(pkg);
    pkg.close();
    writeJsonAtomic(paths.data('world.json'), result);
    const { world, teleporters, gold_rooms: goldRooms } = result;
    console.log(
        `world.json: ${world.groups.length} groups, ${world.elevators.length} elevators, ` +
            `${teleporters.length} teleporters, ${goldRooms.length} gold rooms`,
    );
}

main();
