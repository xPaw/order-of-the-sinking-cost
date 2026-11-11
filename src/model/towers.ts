// Towers: their worlds, layers, names and progress (progression.md "Tower")
import { PROG } from '../data.ts';
import type { Tower } from '../types.ts';
import { indicesWhere } from '../util.ts';

/**
 * A tower with its levels and how far it is: `normal` and `drop` are indices into the levels, `active` is enough normal
 * levels solved, `gold` every dropdown solved.
 */
export interface TowerProgress extends Tower {
    normal: number[];
    drop: number[];
    solvedNormal: number;
    active: boolean;
    gold: boolean;
}

/** The levels solved over the levels needed; while some of the tower's levels are under fog, over those shown and "+". */
export function towerLevelCount(tower: TowerProgress, shownLevels: number): string {
    if (shownLevels < tower.normal.length) return `${tower.solvedNormal} / ${shownLevels}+`;
    return `${tower.solvedNormal} / ${tower.req}`;
}

/** Bit, save enum letter, name, letter in tower pair names, name in the sky tower names (as Steam's "High Mirrors"). */
export const WORLDS: Array<[bit: number, saveLetter: string, name: string, pairLetter: string, skyName: string]> = [
    [1, 'H', 'Heroes', 'H', 'Heroes'],
    [2, 'M', 'Mirror Isles', 'M', 'Mirrors'],
    [4, 'S', 'Skipping Stones', 'S', 'Skipping Stones'],
    [8, 'P', 'Beamcasters', 'B', 'Beamcasters'],
];

/** A pair reads "HxM" and a single world (the sky towers) by its name. */
export const towerWorlds = (towerBits: number): string => {
    const worlds = WORLDS.filter(([bit]) => towerBits & bit);
    if (worlds.length === 1) return worlds[0][4];
    return worlds.map(([, , , pairLetter]) => pairLetter).join('x');
};

/**
 * A tower by its Steam achievement's name ("Antipode HxM", "High Mirrors", "Low SxB"); bit 16: a sky tower, bit 32: an
 * underworld tower.
 */
export function towerName(towerBits: number): string {
    const worlds = towerWorlds(towerBits);
    if (towerBits & 16) return `High ${worlds}`;
    if (towerBits & 32) return `Low ${worlds}`;
    return `Antipode ${worlds}`;
}

/** How the page names a sky Way while the game has not named its area: by the tower Sign it leads to. */
export function unnamedWayName(towerBits: number): string {
    return `Way to the ${towerName(towerBits)} sign`;
}

function towerAchievementSuffix(towerBits: number): string {
    if (towerBits & 16) return '_SKY';
    if (towerBits & 32) return '_UNDERWORLD';
    return '';
}

/** The Steam API name of a tower's achievement ("TOWER_HM", "TOWER_H_SKY"). */
export function towerAchievement(towerBits: number): string {
    const letters = WORLDS.filter(([bit]) => towerBits & bit)
        .map(([, saveLetter]) => saveLetter)
        .join('');
    return 'TOWER_' + letters + towerAchievementSuffix(towerBits);
}

/**
 * Per tower: its normal and dropdown levels, how many normal ones are solved, active (enough of them solved) and gold
 * (every dropdown solved).
 */
export function towerProgress(solved: (level: number) => boolean): TowerProgress[] {
    const levels = PROG.levels;
    return PROG.towers.map((tower) => {
        const members = indicesWhere(levels, (level) => level.t === tower.t);
        const normal = members.filter((index) => !levels[index].d);
        const drop = members.filter((index) => levels[index].d);
        const solvedNormal = normal.filter(solved).length;
        const solvedDrop = drop.filter(solved).length;
        return {
            ...tower,
            normal,
            drop,
            solvedNormal,
            active: solvedNormal >= tower.req,
            gold: solvedDrop === drop.length,
        };
    });
}
