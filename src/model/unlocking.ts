// Level_Entry unlocking: which levels and Freezers are open, and what waits on a level
// (progression.md "Level_Entry unlocking and state", viewer.md "Level states (viewer)")
import { PROG } from '../data.ts';
import type { Freezer, FreezerSign, ProgressLevel } from '../types.ts';
import type { Status } from '../status-file.ts';
import type { TowerProgress } from './towers.ts';

/** Per level, its flags in the status; undefined for a level not entered yet. */
export type LevelFlags = Array<number | undefined>;

/** The state of a level: how far the player is in it, or what keeps them from it. */
export type LevelState = 'solved' | 'partial' | 'visited' | 'unlocked' | 'blocked' | 'locked';

/** Whether a level state shows the save in the level: solved, partially solved or entered. */
export function isEntered(state: LevelState): boolean {
    return state === 'solved' || state === 'partial' || state === 'visited';
}

const statusFlagCache = new WeakMap<object, Map<string, number>>();

function statusFlags(status: { levels: Status['levels'] }): Map<string, number> {
    let flags = statusFlagCache.get(status);
    if (!flags) {
        flags = new Map(status.levels.map((level) => [level.name, level.flags]));
        statusFlagCache.set(status, flags);
    }

    return flags;
}

/** What a Sign asks for: a rank, a tower activated or a number of gold rooms found. */
export type SignRule = Omit<FreezerSign, 'pid'>;

/** Per level, its flags in the status; undefined for a level not entered yet. */
export function levelFlagsOf(status: { levels: Status['levels'] }): LevelFlags {
    const flags = statusFlags(status);
    return PROG.levels.map((level) => flags.get(level.n));
}

export function isSolved(levelFlags: LevelFlags, level: number): boolean {
    return ((levelFlags[level] ?? 0) & 1) === 1;
}

export function isPartlySolved(levelFlags: LevelFlags, level: number): boolean {
    return ((levelFlags[level] ?? 0) & 2) !== 0;
}

/** Whether a level counts toward a Freezer: solved, or partly solved for a Freezer that takes that. */
export function gateOptionMet(freezer: Freezer, level: number, levelFlags: LevelFlags): boolean {
    if (isSolved(levelFlags, level)) return true;
    return !!freezer.partial && isPartlySolved(levelFlags, level);
}

/** Whether a sign's rule holds: the rank reached (255: any), the tower active, or enough gold rooms found. */
export function signRuleMet(
    sign: SignRule,
    status: { rank: number },
    towers: Array<TowerProgress | undefined>,
    goldFound: number,
): boolean {
    if (sign.rank) return sign.rank === 255 || sign.rank <= status.rank;
    if (sign.tower != null) return !!towers[sign.tower]?.active;
    if (sign.gold) return goldFound >= sign.gold;
    return false;
}

/** Whether a sign reads as satisfied to a Freezer: it is read, or it asks for nothing (no rank, tower or gold rooms). */
export function signGateMet(sign: FreezerSign, signRead: (pid: number) => boolean): boolean {
    if (!sign.rank && sign.tower == null && !sign.gold) return true;
    return signRead(sign.pid);
}

/** How far a sign has come: read, its rule holding but not read yet, or its rule not holding. */
export type SignState = 'read' | 'ready' | 'unmet';

export function signStateOf(
    progress: { signOk: (rule: SignRule) => boolean; signRead: (pid: number) => boolean },
    sign: FreezerSign,
): SignState {
    if (progress.signRead(sign.pid)) return 'read';
    if (progress.signOk(sign)) return 'ready';
    return 'unmet';
}

function gateSatisfied(freezer: Freezer, levelFlags: LevelFlags, signRead: (pid: number) => boolean): boolean {
    const optionsMet = [
        ...freezer.req.map((level) => gateOptionMet(freezer, level, levelFlags)),
        ...(freezer.signs || []).map((sign) => signGateMet(sign, signRead)),
    ];
    if (optionsMet.length === 0) return false;
    if (freezer.or) return optionsMet.some(Boolean);
    return optionsMet.every(Boolean);
}

/**
 * Freezers: opened when listed in the status, or when their gate is satisfied now (re-evaluated at every overworld load).
 * A Sign counts once it is read; its rule holding is not enough.
 */
export function freezersOpen(
    status: { openedFreezers: number[] },
    levelFlags: LevelFlags,
    signRead: (pid: number) => boolean,
): boolean[] {
    const listed = new Set(status.openedFreezers);
    return PROG.freezers.map((freezer) => {
        if (listed.has(freezer.pid)) return true;
        if (freezer.judge) return false;
        return gateSatisfied(freezer, levelFlags, signRead);
    });
}

function requirementsMet(level: ProgressLevel, levelFlags: LevelFlags): boolean {
    if (!level.req.length) return true;
    if (level.or) return level.req.some((required) => isSolved(levelFlags, required));
    return level.req.every((required) => isSolved(levelFlags, required));
}

// a level enabled in the level data is open from the start whatever its gate; without `doorReached` an open level
// counts as reachable
function levelState(
    level: ProgressLevel,
    index: number,
    levelFlags: LevelFlags,
    doorReached: readonly boolean[] | null,
): LevelState {
    if (isSolved(levelFlags, index)) return 'solved';
    if (isPartlySolved(levelFlags, index)) return 'partial';
    if (levelFlags[index] !== undefined) return 'visited';
    if (!level.en && !requirementsMet(level, levelFlags)) return 'locked';
    if (!doorReached || doorReached[index]) return 'unlocked';
    return 'blocked';
}

/** Per level its state; `doorReached`: per level, whether the hero can reach its door, null when the save has no history. */
export function levelStates(levelFlags: LevelFlags, doorReached: readonly boolean[] | null): LevelState[] {
    return PROG.levels.map((level, index) => levelState(level, index, levelFlags, doorReached));
}

// Whether a level opens only once its requirements are met: not enabled from the start, and (for an OR level) no
// option solved yet
function waitsForRequirements(level: ProgressLevel, solved: (level: number) => boolean): boolean {
    if (level.en || !level.req.length) return false;
    if (level.or && level.req.length > 1) return !level.req.some(solved);
    return true;
}

/**
 * The unsolved levels whose requirements need `level`: an AND level that requires it or such a level, an OR level all
 * of whose options are it or such levels. A walk back along `unlocks` (per level, the levels requiring it), counting
 * the options an OR level has left.
 */
export function levelsNeedingLevel(
    levels: ProgressLevel[],
    unlocks: Array<{ levels: number[] }>,
    solved: (level: number) => boolean,
    level: number,
): Set<number> {
    const needing = new Set<number>();
    const optionsLeft = new Map<number, Set<number>>();
    const queue = [level];

    while (queue.length) {
        const required = queue.pop()!;
        for (const dependent of unlocks[required].levels) {
            if (needing.has(dependent) || solved(dependent) || !waitsForRequirements(levels[dependent], solved)) {
                continue;
            }
            if (levels[dependent].or && levels[dependent].req.length > 1) {
                let left = optionsLeft.get(dependent);
                if (!left) {
                    left = new Set(levels[dependent].req);
                    optionsLeft.set(dependent, left);
                }
                left.delete(required);
                if (left.size) continue;
            }
            needing.add(dependent);
            queue.push(dependent);
        }
    }

    return needing;
}

/** The options of a level's or Freezer's requirements: its levels and signs. */
export const optionCount = (node: { req: number[]; signs?: unknown[] }): number =>
    node.req.length + (node.signs?.length ?? 0);
