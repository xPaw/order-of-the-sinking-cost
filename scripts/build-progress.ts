// Builds data/progress.json (overworld levels, unlock gates, towers, areas, map) for the progress view from
// data/levels.json, plus data/level_areas.json, data/fog.json (build-fog.ts), map.json (build-map.ts) and world.json
// (build-world.ts) when present. Rules are described in docs/PROGRESSION.md.
//
// Reads levels.json, level_areas.json, fog.json, map.json and world.json from data/, and the overworld from
// <game>/data/levels.package (type defaults). Writes data/progress.json.
//
// Usage: node scripts/build-progress.ts [--game DIR]
import { existsSync, readFileSync, statSync } from 'node:fs';
import type { GlowGroup } from '../src/map/level-icons.ts';
import type {
    Area,
    EndgameWayIn,
    Freezer,
    FreezerSign,
    KnownRoute,
    LevelSet,
    Position,
    Progress,
    ProgressFog,
    ProgressLevel,
    ProgressMap,
    Sign,
    Teleporter,
    Tower,
    ViewGiver,
    WorldFile,
} from '../src/types.ts';
import type { FogFile, LevelAreasFile, LevelEntry, LevelsFile, PlacedEntity } from './lib/data-files.ts';
import { buildEndingStages } from './lib/ending-stages.ts';
import { flagsOf, get, positionOf, refOf, vectorOf, type Fields } from './lib/fields.ts';
import { buildKnownRoutes } from './lib/known-routes.ts';
import { modulo, roundTo, roundVector } from './lib/math.ts';
import { writeJsonAtomic } from './lib/output.ts';
import { Package, pidString, type EntitiesHeader, type EntityRecord } from './lib/package.ts';
import * as paths from './lib/paths.ts';

// The entities of one level by type name
type Overworld = LevelEntry['entities'];

type RawEntities = { header: EntitiesHeader; records: EntityRecord[] };

const FLAG_BITS: Record<string, number> = {
    HEROES: 1,
    MIRRORS: 2,
    SKIPPING: 4,
    PROMESST: 8,
    UPSTAIRS: 16,
    DOWNSTAIRS: 32,
};
const UNLOCK_KEYS = ['unlocked_by_id', 'unlocked_by_id2', 'unlocked_by_id3', 'unlocked_by_id4'];
// The Freezer model B mesh, a doorway; model A (GAME_OVER_Freezer_A) is a pod
const DOORWAY_MESH = 'GAME_OVER_Freezer_B';
const POSITION_PLACES = 2;
const DISTANCE_PLACES = 1;
// Tower_Flags bits that make a tower a high (UPSTAIRS) or low (DOWNSTAIRS) one
const HIGH_OR_LOW = 48;
const LOW = 32;
// The Sign that opens the gold rooms counts as this many solved levels' worth of rank in the viewer
const GOLD_RANK = 4;
// Each layer's crossroads hub: areas are ordered by distance from it
const HUBS: Record<string, string> = {
    ground: 'area_g_crossroads',
    sky: 'area_s_upper_crossroads',
    underworld: 'area_u_crossroads_low',
};
// Level_Entry glow groups by the hue (degrees) of `color_active`; a hue below `below` and not below an earlier one is in
// the group, and the rest (reds above all) fall to orange
const GLOW_GROUPS: { name: GlowGroup; below: number }[] = [
    { name: 'orange', below: 40 },
    { name: 'yellow', below: 70 },
    { name: 'green', below: 160 },
    { name: 'blue', below: 250 },
    { name: 'purple', below: 340 },
];
// The Level_Entry `style` of the pads drawn as a 16-point star: the tower levels' (and the end1 level's)
const TOWER_PAD_STYLE = 'SIXTEEN_POINTS';
const LAYER_OF_PREFIX: Record<string, string | undefined> = { g: 'ground', s: 'sky', u: 'underworld' };
const LAYER_RANK = ['ground', 'sky', 'underworld'];

function readTextIfPresent(path: string): string | null {
    if (existsSync(path)) return readFileSync(path, 'utf8');
    return null;
}

function entitiesOf(overworld: Overworld, typeName: string): PlacedEntity[] {
    return overworld[typeName] ?? [];
}

// 1 for a condition that holds, else undefined: a flag the output holds only when it is set
function flag(condition: boolean): 1 | undefined {
    if (condition) return 1;
    return undefined;
}

function flagsValue(names: string[]): number {
    return names.reduce((total, name) => total + FLAG_BITS[name], 0);
}

function roundedPosition(fields: Fields): Position {
    return roundVector(positionOf(fields), POSITION_PLACES);
}

// The pids a gate's id fields name (the ones that are set)
function gateIds(fields: Fields, keys: string[]): number[] {
    return keys.map((key) => refOf(fields[key])).filter(Boolean);
}

// The indices the pids have in `index`, leaving out the pids it does not hold
function indicesOf(pids: number[], index: Map<number, number>): number[] {
    const indices: number[] = [];
    for (const pid of pids) {
        const found = index.get(pid);
        if (found !== undefined) indices.push(found);
    }
    return indices;
}

// The first decoded value of a field in a level's entities of one type, as the type's default (the old value)
function typeDefault(pkg: Package, raw: RawEntities, typeName: string, field: string): unknown {
    for (const { type, blob } of raw.records) {
        const [name, version] = raw.header.types[type];
        if (name !== typeName) continue;
        const decoded = pkg.decode(blob, name, version, raw.header.base, { withOld: true });
        const decodedField = decoded[field];
        if (Array.isArray(decodedField)) return decodedField[0];
    }
    return null;
}

// [{ pid, fields }] of every entity of one type in a level package, without type defaults
function packageEntities(pkg: Package, raw: RawEntities, typeName: string): PlacedEntity[] {
    const entities: PlacedEntity[] = [];
    for (const { pid, type, blob } of raw.records) {
        const [name, version] = raw.header.types[type];
        if (name !== typeName) continue;
        entities.push({ id: pidString(pid), pid, fields: pkg.decode(blob, name, version, raw.header.base) });
    }
    return entities;
}

function hueOf(red: number, green: number, blue: number): number {
    const largest = Math.max(red, green, blue);
    const smallest = Math.min(red, green, blue);
    const spread = largest - smallest;
    let sector;
    if (largest === red) {
        sector = ((green - blue) / spread) % 6;
    } else if (largest === green) {
        sector = (blue - red) / spread + 2;
    } else {
        sector = (red - green) / spread + 4;
    }
    return modulo(sector * 60, 360);
}

// The glow group of a Level_Entry: the one its `color_active` hue is nearest to (reds count as orange, cyans as blue,
// magentas as purple)
function glowGroupOf(fields: Fields): GlowGroup {
    const hue = hueOf(
        get(fields, 'color_active.x', 0),
        get(fields, 'color_active.y', 0),
        get(fields, 'color_active.z', 0),
    );
    for (const group of GLOW_GROUPS) {
        if (hue < group.below) return group.name;
    }
    return 'orange';
}

function buildLevels(overworld: Overworld): { levels: ProgressLevel[]; index: Map<number, number> } {
    const entries = entitiesOf(overworld, 'Level_Entry').filter(
        (entry) => !entry.fields.currently_broken && !entry.fields.currently_disfavored,
    );
    const index = new Map<number, number>();
    entries.forEach((entry, i) => index.set(entry.pid, i));
    const levels = entries.map((entry) => {
        const fields = entry.fields;
        const required = gateIds(fields, UNLOCK_KEYS.slice(0, 3));
        const req = indicesOf(required, index);
        // the game evaluates a gate only while enabled_t_target is 0, so an enabled gated level is open from the start
        const enabled = flag(req.length > 0 && fields.enabled_t_target === 1);
        let towerFlags: number | undefined;
        if (fields.tower_flags) towerFlags = flagsValue(flagsOf(fields, 'tower_flags'));
        const achievement = get(fields, 'achievement', '');
        return {
            n: get(fields, 'level_name', ''),
            p: roundedPosition(fields),
            req,
            or: flag(Boolean(fields.unlock_is_or_gate) && required.length > 1),
            en: enabled,
            t: towerFlags,
            glow: glowGroupOf(fields),
            tower: flag(fields.style === TOWER_PAD_STYLE),
            d: flag(Boolean(fields.dropdown)),
            a: achievement || undefined,
        };
    });
    return { levels, index };
}

function buildTowers(pkg: Package, raw: RawEntities, overworld: Overworld): Tower[] {
    const requiredDefault = typeDefault(pkg, raw, 'Tower', 'levels_required');
    if (typeof requiredDefault !== 'number') {
        throw new Error('Tower.levels_required has no type default in the overworld package');
    }
    const towers = entitiesOf(overworld, 'Tower').map((tower) => ({
        pid: tower.pid,
        t: flagsValue(flagsOf(tower.fields, 'tower_flags')),
        req: get(tower.fields, 'levels_required', requiredDefault),
        p: roundedPosition(tower.fields),
    }));
    return towers.toSorted(towerOrder);
}

// A Tower whose `teleporter_id` is a MINOR pad gets `pad`, the pad's index in `teleporters`: the ground and low towers'
// pads stand on or next to the tower, while a high tower's is a MAJOR pad elsewhere on the map
function addTowerPads(overworld: Overworld, towers: Tower[], teleporters: Teleporter[]): void {
    for (const entity of entitiesOf(overworld, 'Tower')) {
        const padPid = refOf(entity.fields.teleporter_id);
        const padIndex = teleporters.findIndex((pad) => pad.pid === padPid);
        if (padIndex < 0) continue;

        const tower = towers.find((candidate) => candidate.pid === entity.pid)!;
        if (teleporters[padIndex].major) {
            tower.hub = padIndex;
        } else {
            tower.pad = padIndex;
        }
    }
}

// The position of the overworld entity with this pid, whatever its type
function entityPosition(overworld: Overworld, pid: number): Position | undefined {
    for (const entities of Object.values(overworld)) {
        const found = entities?.find((entity) => entity.pid === pid);
        if (found) return roundedPosition(found.fields);
    }
    return undefined;
}

// The table of known routes (scripts/lib/known-routes.ts) with its names and pids resolved to indices
function resolveKnownRoutes(
    overworld: Overworld,
    levels: ProgressLevel[],
    towers: Tower[],
    freezers: Freezer[],
    signs: Sign[],
    areas: Area[],
    teleporters: Teleporter[],
    rockPids: Set<number>,
): KnownRoute[] {
    const skyTower = (flagName: string): number | undefined => {
        const towerFlags = FLAG_BITS[flagName] + FLAG_BITS.UPSTAIRS;
        const found = towers.findIndex((candidate) => candidate.t === towerFlags);
        if (found < 0) return undefined;
        return found;
    };

    return buildKnownRoutes({
        levels,
        freezers,
        signs,
        areas,
        teleporters,
        skyTower,
        positionOf: (pid) => entityPosition(overworld, pid),
        isRock: (pid) => rockPids.has(pid),
    });
}

// Plain towers first, then the high ones, then the low ones; by their flags within each
function towerOrder(first: Tower, second: Tower): number {
    const firstHighOrLow = Number((first.t & HIGH_OR_LOW) !== 0);
    const secondHighOrLow = Number((second.t & HIGH_OR_LOW) !== 0);
    if (firstHighOrLow !== secondHighOrLow) return firstHighOrLow - secondHighOrLow;
    const lowDifference = (first.t & LOW) - (second.t & LOW);
    if (lowDifference !== 0) return lowDifference;
    return first.t - second.t;
}

// The Signs a Freezer lists besides the levels that open it. On the overworld the other ids are all Signs.
function freezerSigns(
    ids: number[],
    index: Map<number, number>,
    signs: Map<number, Fields>,
    towerIndex: (pid: number) => number,
): FreezerSign[] {
    const listed: FreezerSign[] = [];
    for (const pid of ids) {
        if (index.has(pid)) continue;
        const sign = signs.get(pid);
        if (sign === undefined) {
            listed.push({ pid });
            continue;
        }
        const rank = get(sign, 'unlock_freezers_with_rank', 0);
        if (rank) listed.push({ pid, rank });
        else if (sign.tower_id) listed.push({ pid, tower: towerIndex(refOf(sign.tower_id)) });
        else if (sign.gold_room_connection_unlocker) listed.push({ pid, gold: GOLD_RANK });
        else listed.push({ pid });
    }
    return listed;
}

function buildFreezers(
    overworld: Overworld,
    index: Map<number, number>,
    towers: Tower[],
    layerOf: (z: number) => number,
): { freezers: Freezer[]; signs: Map<number, Fields>; towerIndex: (pid: number) => number } {
    const signs = new Map<number, Fields>();
    for (const sign of entitiesOf(overworld, 'Sign')) signs.set(sign.pid, sign.fields);
    const towerIndex = (pid: number) => towers.findIndex((tower) => tower.pid === pid);
    const freezers = entitiesOf(overworld, 'Freezer').map((freezer) => {
        const fields = freezer.fields;
        const ids = gateIds(fields, UNLOCK_KEYS);
        const p = roundedPosition(fields);
        const req = indicesOf(ids, index);
        const partial = fields.partial_solve_count;
        const hasPartial = partial !== undefined && partial !== null && partial !== -1;
        let listedSigns: FreezerSign[] | undefined;
        if (req.length !== ids.length) listedSigns = freezerSigns(ids, index, signs, towerIndex);
        return {
            pid: freezer.pid,
            p,
            req,
            l: layerOf(p[2]),
            or: flag(Boolean(fields.unlock_is_or_gate) && ids.length > 1),
            signs: listedSigns,
            partial: flag(hasPartial),
            judge: flag(Boolean(fields.judge_unlock_level)),
            doorway: flag(get(fields, 'base.mesh', '') === DOORWAY_MESH),
        };
    });
    return { freezers, signs, towerIndex };
}

// Signs that open gates (by rank, tower or gold rooms) and tower status signs, with the gates that list each
function buildSignRows(
    signs: Map<number, Fields>,
    freezers: Freezer[],
    towerIndex: (pid: number) => number,
    layerOf: (z: number) => number,
): Sign[] {
    const rows: Sign[] = [];
    for (const [pid, sign] of signs) {
        const rank = get(sign, 'unlock_freezers_with_rank', 0);
        const gates: number[] = [];
        freezers.forEach((freezer, i) => {
            if ((freezer.signs ?? []).some((entry) => entry.pid === pid)) gates.push(i);
        });
        const p = roundedPosition(sign);
        let signRank: number | undefined;
        let tower: number | undefined;
        let gold: number | undefined;
        let status: 1 | undefined;
        if (rank) {
            signRank = rank;
        } else if (gates.length && sign.tower_id) {
            tower = towerIndex(refOf(sign.tower_id));
        } else if (gates.length && sign.gold_room_connection_unlocker) {
            gold = GOLD_RANK;
        } else if (sign.display_hook === 'TOWER_STATUS' && sign.tower_id) {
            tower = towerIndex(refOf(sign.tower_id));
            status = 1;
        } else {
            continue;
        }
        rows.push({ pid, p, l: layerOf(p[2]), rank: signRank, tower, gold, status, gates });
    }
    return rows;
}

// Each level's first set that is not a drafts set, with its place in the set (levels that exist only)
function assignSets(levelData: LevelsFile, levels: ProgressLevel[]): LevelSet[] {
    const known = new Set(levelData.levels.map((level) => level.name));
    const inSet = new Map<string, [name: string, place: number, size: number]>();
    for (const [name, allMembers] of Object.entries(levelData.level_sets)) {
        const members = allMembers.filter((member) => known.has(member));
        members.forEach((member, position) => {
            const current = inSet.get(member);
            if (!current || (current[0].startsWith('drafts') && !name.startsWith('drafts'))) {
                inSet.set(member, [name, position + 1, members.length]);
            }
        });
    }
    const table: LevelSet[] = [];
    for (const level of levels) {
        const found = inSet.get(level.n);
        if (!found) continue;
        let tableIndex = table.findIndex((entry) => entry.name === found[0]);
        if (tableIndex < 0) {
            table.push({ name: found[0], n: found[2] });
            tableIndex = table.length - 1;
        }
        level.set = [tableIndex, found[1]];
    }
    return table;
}

// The ways into the endgame areas, which the walk does not find (PROGRESSION.md "Endings"), from the gate unlockers and
// positions: rows [level, gates, replace], where replace says the gates stand in for the walk's way-in gates rather
// than filling in for none. The gates of a replace 1 row are alternatives; those of a replace 0 row are all needed.
// - The level that earns ENDGAME1 stands inside the gates of the gold room Sign.
// - The endgame2 room is entered from below, through the gates of the sky towers' Signs under it (inside the x, y span
//   of its levels), all of them; the level that earns ENDGAME2 lies above the room, behind every gate the set's other
//   levels open.
// - The endgame3 rooms form one chain in set order: a level lies behind the gates opened only by levels before it in
//   the set (the latest of those), leaving out a gate whose levels need the level itself; the first room has none.
function buildEndgameWayIns(
    levels: ProgressLevel[],
    sets: LevelSet[],
    freezers: Freezer[],
    signRows: Sign[],
    towers: Tower[],
): EndgameWayIn[] {
    const rows: EndgameWayIn[] = [];
    const membersOf = (name: string): number[] => {
        const setIndex = sets.findIndex((set) => set.name === name);
        const members = levels.map((level, i) => i).filter((i) => levels[i].set?.[0] === setIndex);
        return members.toSorted((first, second) => levels[first].set![1] - levels[second].set![1]);
    };
    // the gates opened by levels of the set alone, no sign
    const setGates = (members: number[]): number[] =>
        freezers
            .map((freezer, fi) => fi)
            .filter((fi) => {
                const freezer = freezers[fi];
                return !freezer.signs?.length && freezer.req.length && freezer.req.every((j) => members.includes(j));
            });
    const gold = signRows.find((row) => row.gold);
    levels.forEach((level, i) => {
        if (level.a === 'ENDGAME1' && gold) rows.push([i, gold.gates, 1]);
    });

    const room = membersOf('endgame2');
    const high = room.find((i) => levels[i].a === 'ENDGAME2');
    const floor = room.filter((i) => i !== high);
    if (floor.length) {
        const span = (axis: number): [number, number] => [
            Math.min(...floor.map((i) => levels[i].p[axis])),
            Math.max(...floor.map((i) => levels[i].p[axis])),
        ];
        const [[x0, x1], [y0, y1]] = [span(0), span(1)];
        const roomZ = Math.min(...floor.map((i) => levels[i].p[2]));
        const within = (p: Position): boolean => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
        const lift: number[] = [];
        for (const row of signRows) {
            if (row.tower == null || !(towers[row.tower].t & 16) || !within(row.p) || row.p[2] >= roomZ) continue;
            lift.push(...row.gates);
        }
        for (const i of floor) rows.push([i, lift.toSorted((a, b) => a - b), 0]);
        if (high !== undefined) {
            const below = setGates(room).filter((fi) => !freezers[fi].req.includes(high));
            rows.push([high, below, 0]);
        }
    }

    const chain = membersOf('endgame3');
    const place = new Map<number, number>();
    chain.forEach((i, n) => place.set(i, n));
    const placeOf = (level: number): number => place.get(level)!;
    // the set's levels that need level i: requiring it, or a level that does
    const needing = (i: number): Set<number> => {
        const out = new Set([i]);
        for (let grew = true; grew;) {
            grew = false;
            for (const j of chain)
                if (!out.has(j) && levels[j].req.some((r) => out.has(r))) {
                    out.add(j);
                    grew = true;
                }
        }
        return out;
    };
    const chainGates = setGates(chain);
    for (const i of chain) {
        const needs = needing(i);
        const before = chainGates.filter((fi) => {
            const opener = freezers[fi].req;
            return opener.every((j) => placeOf(j) < placeOf(i)) && !opener.some((j) => needs.has(j));
        });
        const latest = Math.max(-1, ...before.map((fi) => Math.max(...freezers[fi].req.map(placeOf))));
        const gates = before.filter((fi) => Math.max(...freezers[fi].req.map(placeOf)) === latest);
        rows.push([i, gates, 1]);
    }
    return rows.toSorted((first, second) => first[0] - second[0]);
}

// Distance around the world's wrap: the shorter way between two coordinates that are `size` apart in a loop
function wrapDistance(delta: number, size: number | null): number {
    if (!size) return Math.abs(delta);
    return Math.min(modulo(delta, size), modulo(-delta, size));
}

function buildAreas(areaData: LevelAreasFile, levels: ProgressLevel[], worldMap: ProgressMap | null): Area[] {
    const names = Object.keys(areaData.areas);
    const areas = Object.entries(areaData.areas).map(([name, area]): Area => {
        // Areas are grouped by layer (name prefix g_/s_/u_)
        const prefix = name.split('_')[1].slice(0, 1);
        return {
            local_area_name: name,
            display: area.display_name || name,
            image: area.local_area_image,
            p: area.map_label_position || area.position,
            pin: area.pin,
            boxes: area.local_area_boxes,
            layer: LAYER_OF_PREFIX[prefix] ?? 'ground',
            order: 0,
        };
    });
    for (const level of levels) {
        const info = areaData.levels[level.n];
        if (info === undefined) continue;
        if (info.local_area_name && names.includes(info.local_area_name)) {
            level.area = names.indexOf(info.local_area_name);
            // in boxes of several areas: [area index, float_parameter] per box, the save's activated pins pick one
            if (info.overlap) {
                level.overlap = info.overlap.map(([name, priority]): [number, number] => [
                    names.indexOf(name),
                    priority,
                ]);
            }
        } else if (info.nearest_local_area_name && names.includes(info.nearest_local_area_name)) {
            // outside every local_area box, so the game shows no area there; group it with the nearest box
            level.area = names.indexOf(info.nearest_local_area_name);
            level.areaNear = 1;
        }
    }
    // Within a layer, areas are ordered by distance from that layer's crossroads hub
    const byName = new Map<string, Area>();
    for (const area of areas) byName.set(area.local_area_name, area);
    // the world wraps around at its edges (map.json size)
    let width: number | null = null;
    let height: number | null = null;
    if (worldMap) {
        width = worldMap.size[0];
        height = worldMap.size[1];
    }
    const hubDistance = areas.map((area) => {
        const hub = (byName.get(HUBS[area.layer]) ?? area).p;
        const dx = wrapDistance(area.p[0] - hub[0], width);
        const dy = wrapDistance(area.p[1] - hub[1], height);
        return roundTo(Math.sqrt(dx ** 2 + dy ** 2), DISTANCE_PLACES);
    });
    const order = areas.map((_, i) => i);
    order.sort((first, second) => {
        const byLayer = LAYER_RANK.indexOf(areas[first].layer) - LAYER_RANK.indexOf(areas[second].layer);
        if (byLayer) return byLayer;
        return hubDistance[first] - hubDistance[second];
    });
    order.forEach((areaIndex, rank) => {
        areas[areaIndex].order = rank;
    });
    return areas;
}

function buildFogSummary(fog: FogFile): ProgressFog {
    const levelRegions: ProgressFog['levels'] = {};
    for (const [name, layer, region] of fog.level_entries) levelRegions[name] = [layer, region];
    return {
        grid: fog.grid,
        primary: fog.primary.map((entry) => ({ pid: entry.pid, layer: entry.layer })),
        boxes: fog.boxes
            .filter((box) => !box.only_overhang)
            .map((box) => ({ pid: box.pid, layer: box.layer, min: box.min, max: box.max })),
        levels: levelRegions,
        start: fog.start,
    };
}

// Per map layer, the box of its MAIN_MAP Camera_Marker (the overhead map's view of the whole layer): centre, extents
function addMainBoxes(pkg: Package, raw: RawEntities, worldMap: ProgressMap): void {
    for (const { fields } of packageEntities(pkg, raw, 'Camera_Marker')) {
        if (fields.overhead_map_type !== 'MAIN_MAP') continue;
        const centre = roundedPosition(fields);
        const extents = roundVector(vectorOf(fields, 'props.box_extents'), POSITION_PLACES);
        const z = centre[2];
        const layer = worldMap.layers.find((candidate) => candidate.z[0] <= z && z < candidate.z[1]);
        if (!layer) continue;
        worldMap.main_box ??= {};
        worldMap.main_box[layer.key] = { c: centre, e: extents };
    }
}

function main(): void {
    paths.parseCommandLine();
    const levelData: LevelsFile = JSON.parse(readFileSync(paths.data('levels.json'), 'utf8'));
    const overworldLevel = levelData.levels.find((level) => level.name === 'overworld');
    if (!overworldLevel) throw new Error('data/levels.json has no overworld level');
    const overworld = overworldLevel.entities;
    const areaText = readTextIfPresent(paths.data('level_areas.json'));
    const areaData: LevelAreasFile | null = areaText === null ? null : JSON.parse(areaText);
    const fogText = readTextIfPresent(paths.data('fog.json'));
    const fog: FogFile | null = fogText === null ? null : JSON.parse(fogText);
    const mapText = readTextIfPresent(paths.data('map.json'));
    const worldMap: ProgressMap | null = mapText === null ? null : JSON.parse(mapText);
    const pkg = new Package();
    const raw = pkg.rawEntities('overworld');

    const { levels, index } = buildLevels(overworld);
    const towers = buildTowers(pkg, raw, overworld);
    const fogLayers = fog ? fog.layers : [];
    const layerOf = (z: number): number => {
        for (const layer of fogLayers) {
            if ((layer.zmin === null || layer.zmin <= z) && (layer.zmax === null || z <= layer.zmax))
                return layer.index;
        }
        return 0;
    };
    const { freezers, signs, towerIndex } = buildFreezers(overworld, index, towers, layerOf);
    const signRows = buildSignRows(signs, freezers, towerIndex, layerOf);
    const sets = assignSets(levelData, levels);

    const out: Partial<Progress> = {
        levels,
        sets,
        towers,
        freezers,
        signs: signRows,
        endgame_way_ins: buildEndgameWayIns(levels, sets, freezers, signRows, towers),
        treasures: entitiesOf(overworld, 'Treasure_Display').length,
    };
    // voice logs (heard once a played change is recorded; `d` when the level data starts them heard) and the map scrolls
    out.voice_logs = entitiesOf(overworld, 'Voice_Log').map((log) => {
        const p = roundedPosition(log.fields);
        const author = get(log.fields, 'author', '');
        return {
            pid: log.pid,
            p,
            name: get(log.fields, 'name', ''),
            l: layerOf(p[2]),
            author: author || undefined,
            d: flag(Boolean(log.fields.played)),
        };
    });
    out.view_givers = packageEntities(pkg, raw, 'View_Giver').map((giver): ViewGiver => {
        const p = roundedPosition(giver.fields);
        return { pid: giver.pid, p, l: layerOf(p[2]) };
    });
    out.known_routes = [];
    if (areaData) out.areas = buildAreas(areaData, levels, worldMap);
    if (fog) out.fog = buildFogSummary(fog);
    if (worldMap) {
        out.map = worldMap;
        addMainBoxes(pkg, raw, worldMap);
    }
    pkg.close();
    const worldText = readTextIfPresent(paths.data('world.json'));
    const rockPids = new Set<number>();
    if (worldText !== null) {
        const world: WorldFile = JSON.parse(worldText);
        for (const room of world.gold_rooms) room.tower = towers.findIndex((tower) => tower.pid === room.tower);
        addTowerPads(overworld, towers, world.teleporters);
        for (const rock of world.world.rocks) rockPids.add(rock[0]);
        Object.assign(out, world);
    }
    if (out.areas && out.teleporters) {
        out.known_routes = resolveKnownRoutes(
            overworld,
            levels,
            towers,
            freezers,
            signRows,
            out.areas,
            out.teleporters,
            rockPids,
        );
    }
    out.ending_stages = buildEndingStages(out, FLAG_BITS);
    const progressPath = paths.data('progress.json');
    writeJsonAtomic(progressPath, out);
    const gated = levels.filter((level) => level.req.length).length;
    console.log(
        `levels ${levels.length} gated ${gated} towers ${towers.length} freezers ${freezers.length} ` +
            `areas ${(out.areas ?? []).length} bytes ${statSync(progressPath).size}`,
    );
}

main();
