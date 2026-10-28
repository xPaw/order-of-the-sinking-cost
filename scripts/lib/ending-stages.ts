// The hand-written stages of the endings after the first, in the order a run takes them (VIEWER.md "Goals (viewer)"),
// and the resolving of their names and pids to the indices data/progress.json holds.
import type {
    Area,
    EndingStage,
    EndingStageDone,
    EndingStageName,
    EndingStages,
    Freezer,
    KnownRoute,
    Progress,
    ProgressLevel,
    Teleporter,
    Tower,
} from '../../src/types.ts';
import { loadSchema } from './package.ts';

type NameSource = { area: string } | { level: string } | { tower: string[] } | { route: string };

type DoneSource =
    | { rule: 'achievement'; name: string }
    | { rule: 'tower'; tower: string[] }
    | { rule: 'freezers'; freezers: number[] }
    | { rule: 'solved'; level: string }
    | { rule: 'pads'; pads: number[] };

/**
 * One stage. `name`: the area, level, tower (by its flag names) or sky Way (by its known route's id) it is named after.
 * `done`: when it counts as done: an achievement earned, a tower active, Freezers (by pid) open, a level solved, or pads
 * (by pid) discovered. `seen`: pads (by pid) whose discovery shows the stage even while the game has not named its area.
 */
interface StageSource {
    name: NameSource;
    done: DoneSource;
    seen?: number[];
}

interface EndingSource {
    ending: string;
    stages: StageSource[];
}

// the sky hub's Freezers, each opened by its sky tower's Sign, and the sky towers' pads beside those Signs
const HIGH_HEROES_FREEZER = 95568981;
const HIGH_MIRRORS_FREEZER = 95568982;
const HIGH_SKIPPING_FREEZER = 95568983;
const HIGH_BEAM_FREEZER = 95568984;

const HIGH_HEROES_HUB_PAD = 106958293;
const HIGH_MIRRORS_HUB_PAD = 106958295;
const HIGH_SKIPPING_HUB_PAD = 106958297;
const HIGH_BEAM_HUB_PAD = 106958291;

// the underworld hub's MAJOR pad
const LOW_HUB_MAJOR_PAD = 63004652;

const ENDING_SOURCES: EndingSource[] = [
    {
        ending: 'ENDGAME2',
        stages: [
            {
                name: { area: 'area_s_upper_crossroads' },
                done: { rule: 'achievement', name: 'ASCEND' },
            },
            {
                name: { tower: ['HEROES', 'UPSTAIRS'] },
                done: { rule: 'tower', tower: ['HEROES', 'UPSTAIRS'] },
            },
            {
                name: { tower: ['MIRRORS', 'UPSTAIRS'] },
                done: { rule: 'tower', tower: ['MIRRORS', 'UPSTAIRS'] },
            },
            {
                name: { tower: ['SKIPPING', 'UPSTAIRS'] },
                done: { rule: 'tower', tower: ['SKIPPING', 'UPSTAIRS'] },
            },
            {
                name: { tower: ['PROMESST', 'UPSTAIRS'] },
                done: { rule: 'tower', tower: ['PROMESST', 'UPSTAIRS'] },
            },
            {
                name: { route: 'heroes_way' },
                done: { rule: 'freezers', freezers: [HIGH_HEROES_FREEZER] },
            },
            {
                name: { route: 'mirror_way' },
                done: { rule: 'freezers', freezers: [HIGH_MIRRORS_FREEZER] },
            },
            {
                name: { route: 'skipping_way' },
                done: { rule: 'freezers', freezers: [HIGH_SKIPPING_FREEZER] },
            },
            {
                name: { route: 'beam_way' },
                done: { rule: 'freezers', freezers: [HIGH_BEAM_FREEZER] },
            },
            // the sky hub with the end2 room above it: laser_pointer, then all_together_now
            {
                name: { area: 'area_s_antipode_high' },
                done: { rule: 'solved', level: 'all_together_now' },
                seen: [HIGH_HEROES_HUB_PAD, HIGH_MIRRORS_HUB_PAD, HIGH_SKIPPING_HUB_PAD, HIGH_BEAM_HUB_PAD],
            },
        ],
    },
    {
        ending: 'ENDGAME3',
        stages: [
            {
                name: { area: 'area_u_crossroads_low' },
                done: { rule: 'achievement', name: 'DESCEND' },
            },
            // the Low towers, each its own achievement; an active one's pad leads into the underworld hub
            {
                name: { tower: ['HEROES', 'MIRRORS', 'DOWNSTAIRS'] },
                done: { rule: 'tower', tower: ['HEROES', 'MIRRORS', 'DOWNSTAIRS'] },
            },
            {
                name: { tower: ['HEROES', 'SKIPPING', 'DOWNSTAIRS'] },
                done: { rule: 'tower', tower: ['HEROES', 'SKIPPING', 'DOWNSTAIRS'] },
            },
            {
                name: { tower: ['HEROES', 'PROMESST', 'DOWNSTAIRS'] },
                done: { rule: 'tower', tower: ['HEROES', 'PROMESST', 'DOWNSTAIRS'] },
            },
            {
                name: { tower: ['MIRRORS', 'SKIPPING', 'DOWNSTAIRS'] },
                done: { rule: 'tower', tower: ['MIRRORS', 'SKIPPING', 'DOWNSTAIRS'] },
            },
            {
                name: { tower: ['MIRRORS', 'PROMESST', 'DOWNSTAIRS'] },
                done: { rule: 'tower', tower: ['MIRRORS', 'PROMESST', 'DOWNSTAIRS'] },
            },
            {
                name: { tower: ['SKIPPING', 'PROMESST', 'DOWNSTAIRS'] },
                done: { rule: 'tower', tower: ['SKIPPING', 'PROMESST', 'DOWNSTAIRS'] },
            },
            {
                name: { area: 'area_u_antipode_low' },
                done: { rule: 'pads', pads: [LOW_HUB_MAJOR_PAD] },
                seen: [LOW_HUB_MAJOR_PAD],
            },
            // the rooms, named after their first level in the set and done once their exit Freezers open
            {
                name: { level: 'allocate_heroes_end3' },
                done: { rule: 'freezers', freezers: [115521060] },
            },
            {
                name: { level: 'design_corner' },
                done: { rule: 'freezers', freezers: [115520681] },
            },
            {
                name: { level: 'river_exploit_v2' },
                done: { rule: 'freezers', freezers: [115412927] },
            },
            {
                name: { level: 'simplify_wizard' },
                done: { rule: 'freezers', freezers: [115520798] },
            },
            {
                name: { level: 'end2_mirror1' },
                done: { rule: 'freezers', freezers: [115520818] },
            },
            {
                name: { level: 'end3_off_topic_alt' },
                done: { rule: 'freezers', freezers: [115520928] },
            },
            {
                name: { level: 'environment_art_grid' },
                done: { rule: 'solved', level: 'environment_art_objects' },
            },
            {
                name: { level: 'end3_pipeline_setup' },
                done: {
                    rule: 'freezers',
                    freezers: [115589257, 115589258, 115589259, 115589260, 115589263],
                },
            },
            {
                name: { level: 'end3_pipeline_aesthetics' },
                done: { rule: 'solved', level: 'end3_pipeline_aesthetics' },
            },
        ],
    },
];

interface EndingStageData {
    levels: ProgressLevel[];
    towers: Tower[];
    areas: Area[];
    freezers: Freezer[];
    teleporters: Teleporter[];
    routes: KnownRoute[];
    flagBits: Record<string, number>;
}

function levelIndex(data: EndingStageData, name: string): number {
    const found = data.levels.findIndex((level) => level.n === name);
    if (found < 0) throw new Error(`ending_stages: no level ${name}`);
    return found;
}

function areaIndex(data: EndingStageData, name: string): number {
    const found = data.areas.findIndex((area) => area.local_area_name === name);
    if (found < 0) throw new Error(`ending_stages: no area ${name}`);
    return found;
}

function towerIndex(data: EndingStageData, flagNames: string[]): number {
    let flags = 0;
    for (const flagName of flagNames) {
        const bits = data.flagBits[flagName];
        if (bits === undefined) throw new Error(`ending_stages: no tower flag ${flagName}`);
        flags += bits;
    }

    const found = data.towers.findIndex((tower) => tower.t === flags);
    if (found < 0) throw new Error(`ending_stages: no tower ${flagNames.join('+')}`);
    return found;
}

function routeIndex(data: EndingStageData, id: string): number {
    const found = data.routes.findIndex((route) => route.id === id);
    if (found < 0) throw new Error(`ending_stages: no known route ${id}`);

    const route = data.routes[found];
    if (route.area === undefined || route.tower === undefined) {
        throw new Error(`ending_stages: known route ${id} is no sky Way`);
    }
    return found;
}

function freezerIndex(data: EndingStageData, pid: number): number {
    const found = data.freezers.findIndex((freezer) => freezer.pid === pid);
    if (found < 0) throw new Error(`ending_stages: no Freezer ${pid}`);
    return found;
}

function padIndex(data: EndingStageData, pid: number): number {
    const found = data.teleporters.findIndex((pad) => pad.pid === pid);
    if (found < 0) throw new Error(`ending_stages: no pad ${pid}`);
    return found;
}

function achievementName(name: string): string {
    const values = loadSchema().enums.Achievement?.values ?? [];
    const found = values.some(([valueName]) => valueName === name);
    if (!found) throw new Error(`ending_stages: no achievement ${name}`);
    return name;
}

function resolveName(data: EndingStageData, source: NameSource): EndingStageName {
    if ('area' in source) return { area: areaIndex(data, source.area) };
    if ('level' in source) return { level: levelIndex(data, source.level) };
    if ('tower' in source) return { tower: towerIndex(data, source.tower) };
    return { route: routeIndex(data, source.route) };
}

function resolveDone(data: EndingStageData, source: DoneSource): EndingStageDone {
    if (source.rule === 'achievement') return { rule: 'achievement', name: achievementName(source.name) };
    if (source.rule === 'tower') {
        return { rule: 'tower', tower: towerIndex(data, source.tower) };
    }
    if (source.rule === 'freezers') {
        return { rule: 'freezers', freezers: source.freezers.map((pid) => freezerIndex(data, pid)) };
    }
    if (source.rule === 'solved') return { rule: 'solved', level: levelIndex(data, source.level) };
    return { rule: 'pads', pads: source.pads.map((pid) => padIndex(data, pid)) };
}

function resolveStage(data: EndingStageData, source: StageSource): EndingStage {
    const seenPids = source.seen ?? [];
    return {
        name: resolveName(data, source.name),
        done: resolveDone(data, source.done),
        seen: seenPids.map((pid) => padIndex(data, pid)),
    };
}

/**
 * The hand-written stages of the endings with their names resolved to indices; a name the data lacks fails the build.
 * Empty until the progress rows hold the areas and the pads.
 */
export function buildEndingStages(progress: Partial<Progress>, flagBits: Record<string, number>): EndingStages[] {
    const { levels, towers, areas, freezers, teleporters, known_routes: routes } = progress;
    if (!levels || !towers || !areas || !freezers || !teleporters || !routes) return [];

    const data: EndingStageData = { levels, towers, areas, freezers, teleporters, routes, flagBits };
    return ENDING_SOURCES.map((source): EndingStages => ({
        ending: achievementName(source.ending),
        stages: source.stages.map((stage) => resolveStage(data, stage)),
    }));
}
