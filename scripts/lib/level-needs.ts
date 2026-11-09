// Resolves the names and pids of the hand-written table (level-table.ts) to the indices data/progress.json holds
// (VIEWER.md "Level needs and pad routes")
import type {
    Area,
    PadRoute,
    Position,
    ProgressLevel,
    RouteNeed,
    RouteTarget,
    Sign,
    Teleporter,
} from '../../src/types.ts';
import { areaByName, levelByName, signByPid } from './index-lookup.ts';
import { LEVEL_TABLE, PAD_ROUTES } from './level-table.ts';
import type { Need, PadRouteRow } from './level-table.ts';

const PREFIX = 'level_table';

/** What the names and pids of the table resolve against. */
export interface TableData {
    levels: ProgressLevel[];
    signs: Sign[];
    areas: Area[];
    teleporters: Teleporter[];
    /** The index into `towers` of the sky tower with this flag name. */
    skyTower: (flagName: string) => number | undefined;
    /** The position of the overworld entity with this pid. */
    positionOf: (pid: number) => Position | undefined;
}

function resolveNeed(source: Need, data: TableData): RouteNeed {
    if ('level' in source) return { level: levelByName(data.levels, source.level, PREFIX) };

    if ('sign' in source) return { sign: signByPid(data.signs, source.sign, PREFIX) };

    throw new Error(`${PREFIX}: unknown need ${JSON.stringify(source)}`);
}

function resolveNeeds(sources: Need[][], data: TableData): RouteNeed[][] {
    return sources.map((group) => group.map((need) => resolveNeed(need, data)));
}

function resolveTarget(pid: number, data: TableData): RouteTarget {
    const pad = data.teleporters.findIndex((candidate) => candidate.pid === pid);
    if (pad >= 0) return { pad };

    const at = data.positionOf(pid);
    if (at === undefined) throw new Error(`${PREFIX}: no overworld entity ${pid}`);
    return { at };
}

function resolvePadRoute(source: PadRouteRow, data: TableData): PadRoute {
    const route: PadRoute = {
        id: source.id,
        to: resolveTarget(source.to, data),
        needs: resolveNeeds(source.needs, data),
    };

    if (source.area !== undefined) route.area = areaByName(data.areas, source.area, PREFIX);

    if (source.tower !== undefined) {
        const tower = data.skyTower(source.tower);
        if (tower === undefined) throw new Error(`${PREFIX}: no sky tower ${source.tower}`);
        route.tower = tower;
    }

    return route;
}

// The needs a level's game unlocks make: each required level, or one group of them for a level any one of which unlocks
function unlockNeeds(level: ProgressLevel): RouteNeed[][] {
    const options = level.req.map((required): RouteNeed => ({ level: required }));
    if (options.length === 0) return [];
    if (level.or) return [options];
    return options.map((option) => [option]);
}

function needKey(need: RouteNeed): string {
    return 'level' in need ? `level:${need.level}` : `sign:${need.sign}`;
}

function groupKey(group: RouteNeed[]): string {
    return group.map(needKey).toSorted().join(',');
}

// Whether a level with unlocks has no needs beyond them
function onlyUnlocks(needs: RouteNeed[][], level: ProgressLevel): boolean {
    if (level.req.length === 0) return false;

    const unlocks = new Set(unlockNeeds(level).map(groupKey));
    const keys = new Set(needs.map(groupKey));
    return keys.size === unlocks.size && [...keys].every((key) => unlocks.has(key));
}

// Sets `needs` and `drop` on the levels the table lists. A level whose needs are only its game unlocks, unless the row is
// `known`, or that has none, keeps no `needs` and is left to the walk. Every level has to appear.
function applyLevelTable(data: TableData): void {
    for (const [name, row] of Object.entries(LEVEL_TABLE)) {
        const level = data.levels[levelByName(data.levels, name, PREFIX)];
        if (row.needs !== undefined) {
            const needs = resolveNeeds(row.needs, data);
            if (row.known || !onlyUnlocks(needs, level)) level.needs = needs;
        }
        if (row.drop !== undefined) level.drop = row.drop;
    }

    const missing = data.levels.filter((level) => !Object.hasOwn(LEVEL_TABLE, level.n)).map((level) => level.n);
    if (missing.length > 0) throw new Error(`${PREFIX}: no entry for ${missing.join(', ')}`);
}

/**
 * Resolves the table against the data: sets the needs of the levels, and returns the pad routes. A name, Sign or Rock
 * the data lacks fails the build.
 */
export function resolveLevelTable(data: TableData): PadRoute[] {
    applyLevelTable(data);
    return PAD_ROUTES.map((source) => resolvePadRoute(source, data));
}
