// Which level needs and pad routes a save has met the needs of (VIEWER.md "Level needs and pad routes")
import { PROG } from '../data.ts';
import type { PadRoute, RouteNeed } from '../types.ts';

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

/** Per level, whether its needs hold; undefined for a level with no needs in the data, which the walk decides. */
export function levelNeedsMet(view: NeedsView): Array<boolean | undefined> {
    return PROG.levels.map((level) => {
        if (level.needs === undefined) return undefined;
        return needsMet(level.needs, view);
    });
}
