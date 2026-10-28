// Which known routes a save has met the needs of (VIEWER.md "Known routes")
import { PROG } from '../data.ts';
import type { KnownRoute, RouteNeed } from '../types.ts';

/** What a save says about the things a route can ask for. */
export interface NeedsView {
    levelSolved: (level: number) => boolean;
    freezerOpen: (freezer: number) => boolean;
    signRead: (pid: number) => boolean;
    rockSmashed: (pid: number) => boolean;
}

/** Whether a save meets one need of a route. */
export function needMet(need: RouteNeed, view: NeedsView): boolean {
    if ('level' in need) return view.levelSolved(need.level);
    if ('freezer' in need) return view.freezerOpen(need.freezer);
    if ('rock' in need) return view.rockSmashed(need.rock);
    return view.signRead(PROG.signs[need.sign].pid);
}

/** Whether a save meets every group of a route's needs, a group when one of its needs is met. */
export function routeMet(route: KnownRoute, view: NeedsView): boolean {
    return route.needs.every((group) => group.some((need) => needMet(need, view)));
}

/** The known routes whose needs a save meets. */
export function metRoutes(view: NeedsView): KnownRoute[] {
    return (PROG.known_routes || []).filter((route) => routeMet(route, view));
}
