// Achievements, the endings and the rank markers (progression.md "Achievements and ranks", "Endings")
import { PROG, SCHEMA } from '../data.ts';
import { towerAchievement } from './towers.ts';
import type { TowerProgress } from './towers.ts';

/** What earns an achievement the page can say: the levels it asks for, the tower, or the layer a rank marker stands on. */
export interface AchievementRule {
    text: string;
    levels?: number[];
    tower?: TowerProgress;
    layer?: string;
}

/** The rank each ending's achievement gives. */
export const ENDINGS: Array<[rank: number, achievement: string]> = [
    [1, 'ENDGAME1'],
    [3, 'ENDGAME2'],
    [5, 'ENDGAME3'],
];

// Steam's English achievement names, by the game's `Achievement` value name (the Steam API name)
const ACHIEVEMENT_NAMES: Record<string, string> = {
    GOLD_HM: 'Gold HxM',
    GOLD_HS: 'Gold HxS',
    GOLD_HP: 'Gold HxB',
    GOLD_MS: 'Gold MxS',
    GOLD_MP: 'Gold MxB',
    GOLD_SP: 'Gold SxB',
    TOWER_HM: 'Antipode HxM',
    TOWER_HS: 'Antipode HxS',
    TOWER_HP: 'Antipode HxB',
    TOWER_MS: 'Antipode MxS',
    TOWER_MP: 'Antipode MxB',
    TOWER_SP: 'Antipode SxB',
    TOWER_H_SKY: 'High Heroes',
    TOWER_M_SKY: 'High Mirrors',
    TOWER_S_SKY: 'High Skipping Stones',
    TOWER_P_SKY: 'High Beamcasters',
    TOWER_HM_UNDERWORLD: 'Low HxM',
    TOWER_HS_UNDERWORLD: 'Low HxS',
    TOWER_HP_UNDERWORLD: 'Low HxB',
    TOWER_MS_UNDERWORLD: 'Low MxS',
    TOWER_MP_UNDERWORLD: 'Low MxB',
    TOWER_SP_UNDERWORLD: 'Low SxB',
    ASCEND: 'Ascend',
    DESCEND: 'Descend',
    ENDGAME1: 'Endgame',
    ENDGAME2: 'Endgame High',
    ENDGAME3: 'Endgame Low',
    COMPLETIONIST: 'Completionist',
    HEROES: 'Heroes',
    MIRRORS: 'Mirror Isles',
    SKIPPING: 'Skipping Stones',
    PROMISE: 'Beamcasters',
};

/** An achievement's Steam name; a value Steam does not list reads in sentence case ("NEW_THING" -> "New thing"). */
export function achievementName(name: string): string {
    if (ACHIEVEMENT_NAMES[name]) return ACHIEVEMENT_NAMES[name];
    return (name[0] + name.slice(1).toLowerCase()).replace(/_/g, ' ');
}

/** The grant_rank markers: achievement, rank, the layer they stand on. */
export const MARKER_RANKS: Array<[achievement: string, rank: number, layer: string]> = [
    ['ASCEND', 2, 'sky'],
    ['DESCEND', 4, 'underworld'],
];

/** The achievement that gives rank `rank`: an ending's or a grant_rank marker's. */
export function rankAchievement(rank: number): string | null {
    const ending = ENDINGS.find(([endingRank]) => endingRank === rank);
    if (ending) return ending[1];
    const marker = MARKER_RANKS.find(([, markerRank]) => markerRank === rank);
    return marker?.[0] ?? null;
}

/** Whether the status holds the achievement. */
export function hasAchievement(status: { achievements: bigint }, name: string): boolean {
    const bit = SCHEMA.enums.Achievement?.values.find(([valueName]) => valueName === name)?.[1];
    return bit != null && ((BigInt.asUintN(64, status.achievements) >> BigInt(bit)) & 1n) === 1n;
}

/** What earns each achievement the page can say, by achievement name. */
export function achievementRules(progress: { towers: TowerProgress[] }): Map<string, AchievementRule> {
    const rules = new Map<string, AchievementRule>();
    PROG.levels.forEach((level, index) => {
        if (level.a) rules.set(level.a, { text: '', levels: [index] });
    });

    for (const tower of progress.towers) {
        rules.set(towerAchievement(tower.t), { text: 'Required levels solved', tower });
    }

    rules.set('ASCEND', { text: 'Rank Pusher', layer: 'sky' });
    rules.set('DESCEND', { text: 'Rank Intrepid', layer: 'underworld' });
    rules.set('COMPLETIONIST', { text: 'All levels' });
    return rules;
}

/** The game's achievements in value order (value 0 is none). */
export function achievementNames(): string[] {
    return (SCHEMA.enums.Achievement?.values || []).filter(([, value]) => value > 0).map(([name]) => name);
}
