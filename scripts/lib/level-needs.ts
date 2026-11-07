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

// Sets `needs`, `from` and `drop` on the levels the table lists with needs; a level the table gives 'unknown' keeps neither.
// Every level has to appear exactly once.
function applyLevelTable(data: TableData): void {
    const listed = new Set<string>();

    for (const row of LEVEL_TABLE) {
        for (const name of row.levels) {
            if (listed.has(name)) throw new Error(`${PREFIX}: level ${name} is listed twice`);
            listed.add(name);

            const level = data.levels[levelByName(data.levels, name, PREFIX)];
            if (row.needs !== 'unknown') level.needs = resolveNeeds(row.needs, data);
            if (row.drop !== undefined) level.drop = row.drop;
        }
    }

    const missing = data.levels.filter((level) => !listed.has(level.n)).map((level) => level.n);
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
