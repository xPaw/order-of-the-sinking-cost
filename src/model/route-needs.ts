// Which level needs and pad routes a save has met the needs of (viewer.md "Level needs and pad routes")
import { PROG } from '../data.ts';
import type { PadRoute, ProgressLevel, RouteNeed } from '../types.ts';

/** What a save says about the things a route can ask for. */
export interface NeedsView {
    levelSolved: (level: number) => boolean;
    signRead: (pid: number) => boolean;
}

/** Whether a save meets one need. */
export function needMet(need: RouteNeed, view: NeedsView): boolean {
    if ('level' in need) return view.levelSolved(need.level);
    if ('sign' in need) return view.signRead(PROG.signs[need.sign].pid);
    return unknownNeed(need);
}

/** The requirement graph nodes a need can point at. */
export interface NeedNodes {
    levelId: number[];
    signId: (sign: number) => number;
}

/** The graph node a need asks for. */
export function needId(need: RouteNeed, nodes: NeedNodes): number {
    if ('level' in need) return nodes.levelId[need.level];
    if ('sign' in need) return nodes.signId(need.sign);
    return unknownNeed(need);
}

function unknownNeed(need: never): never {
    throw new Error('Unknown need ' + JSON.stringify(need));
}

/** Whether a save meets every group of needs, a group when one of its needs is met. */
export function needsMet(needs: RouteNeed[][], view: NeedsView): boolean {
    return needs.every((group) => group.some((need) => needMet(need, view)));
}

/** The pad routes whose needs a save meets. */
export function metPadRoutes(view: NeedsView): PadRoute[] {
    return (PROG.pad_routes || []).filter((route) => needsMet(route.needs, view));
}

/**
 * Per level, whether it is reached by what its data lists: it is when the save entered it, or its needs hold and it is
 * not frozen in a closed Freezer. Undefined for a level with no needs in the data.
 */
export function reachedByNeeds(
    needsHold: ReadonlyArray<boolean | undefined>,
    entered: readonly boolean[],
    frozenIn: ReadonlyArray<number | undefined>,
): Array<boolean | undefined> {
    return PROG.levels.map((_, levelIndex) => {
        const hold = needsHold[levelIndex];
        if (hold === undefined) return undefined;
        if (entered[levelIndex]) return true;
        return hold && frozenIn[levelIndex] === undefined;
    });
}

// whether a level's needs hold when a need on a level of its own `req` counts as met once that level is reached
function doorNeedsMet(level: ProgressLevel, view: NeedsView, reached: readonly boolean[]): boolean {
    const groups = level.needs ?? [];
    return groups.every((group) =>
        group.some((need) => {
            if ('level' in need && level.req.includes(need.level) && reached[need.level]) return true;
            return needMet(need, view);
        }),
    );
}

/** Per level, whether it is reached by its needs, and whether the hero can walk up to its door. */
export interface NeedsReach {
    /** Whether the save entered the level, or its needs hold and it is not frozen in a closed Freezer; true for a level with no needs in the data. */
    reached: boolean[];
    /** Whether the level is reached, or its needs hold with a need on a level of its own `req` counting once that level is reached. */
    doorReached: boolean[];
}

/** Per level, the reach by its needs and the reach of its door. */
export function needsReach(
    view: NeedsView,
    entered: readonly boolean[],
    frozenIn: ReadonlyArray<number | undefined>,
): NeedsReach {
    const tableReach = reachedByNeeds(levelNeedsMet(view), entered, frozenIn);
    const reached = tableReach.map((levelReached) => levelReached ?? true);
    const doorReached = PROG.levels.map((level, levelIndex) => {
        if (reached[levelIndex]) return true;
        // the plain needs failed: only a need on a level of its own `req` can still be met
        if (frozenIn[levelIndex] !== undefined || level.req.length === 0) return false;
        return doorNeedsMet(level, view, reached);
    });
    return { reached, doorReached };
}

/** Per level, whether its needs hold; undefined for a level with no needs in the data. */
export function levelNeedsMet(view: NeedsView): Array<boolean | undefined> {
    return PROG.levels.map((level) => {
        if (level.needs === undefined) return undefined;
        return needsMet(level.needs, view);
    });
}
