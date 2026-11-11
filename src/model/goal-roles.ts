// Roles relative to a goal, from the requirement graph of the plans (viewer.md "Goal roles (viewer)")
import { PROG } from '../data.ts';
import type { Plans } from './plans.ts';
import type { Graph } from './requirements.ts';

/** Per OR and k of n requirement not met: its routes and the parts every route needs. */
export interface RouteGraph {
    routes: Array<number[] | null>;
    shared: Array<number[] | null>;
}

/** The roles relative to a goal: see goalRoles(). */
export interface GoalRoles {
    need: Uint8Array;
    from: Int32Array;
    weakAt: Int32Array;
    l: Uint8Array;
    g: Uint8Array;
}

// The requirements a requirement's plan runs through when it asks for one of its parts: itself when it is a step, else
// the steps that have it as a part (a rank, the options of an OR level)
function askers(graph: Graph, parents: number[][], id: number): number[] {
    if (graph.node[id]) return [id];
    const out: number[] = [];

    for (const parent of parents[id]) {
        if (graph.node[parent]) {
            out.push(parent);
        } else {
            out.push(...askers(graph, parents, parent));
        }
    }

    return out;
}

/**
 * The routes of a requirement: its parts, but for those whose plan runs back through it (a rank's ASCEND needs the way
 * onto the sky, which needs that rank). A part with no plan (it waits in a cycle of requirements) is still a route: the
 * requirement needs one of its parts whether or not a plan finds the way.
 */
export function goalRoutes(plans: Plans, id: number): number[] {
    const { G: graph, steps, settled, parents } = plans;
    const through = askers(graph, parents, id);
    return graph.parts[id].filter((part) => {
        if (settled[part] < 0) return true;
        return !through.some((asker) => steps[part]!.has(asker));
    });
}

// The parts every route needs: the parts each route needs all of (an AND route), shared by every route
function sharedParts(graph: Graph, routes: number[]): number[] {
    if (routes.some((route) => graph.kind[route] !== 'and')) return [];
    let shared = graph.parts[routes[0]];

    for (let routeIndex = 1; routeIndex < routes.length && shared.length; routeIndex++) {
        const parts = graph.parts[routes[routeIndex]];
        shared = shared.filter((part) => parts.includes(part));
    }

    return shared;
}

/**
 * Per OR and k of n requirement not met: its routes and the parts every route needs. They do not depend on the goal, so
 * every goal's marking reads the same ones.
 */
export function routeGraph(plans: Plans): RouteGraph {
    const { G: graph } = plans;
    const requirementCount = graph.keys.length;
    const routes = Array.from({ length: requirementCount }, (): number[] | null => null);
    const shared = Array.from({ length: requirementCount }, (): number[] | null => null);

    for (let id = 0; id < requirementCount; id++) {
        if (graph.kind[id] === 'and' || graph.met[id]) continue;
        // an OR with a part met needs nothing more
        if (graph.parts[id].some((part) => graph.met[part])) continue;
        const idRoutes = goalRoutes(plans, id);
        routes[id] = idRoutes;
        shared[id] = idRoutes.length > 1 ? sharedParts(graph, idRoutes) : [];
    }

    return { routes, shared };
}

/**
 * Roles relative to a goal (viewer.md "Goal roles (viewer)"): the requirement graph of the plans (planAll) walked back
 * from the goal's targets (requirement ids), so that every goal's roles come from the one static roles pass the graph
 * reads. need per requirement: 2 Required (on every route to a target), 1 Required as one of several (on some routes),
 * 0 not needed. An AND passes its strength to every part; an OR to its only route, else as one of several to each route
 * and in full to the parts every route needs; a k of n to its routes in full only when it needs all of them, else like
 * an OR. Met requirements need nothing. from: the requirement that marked each one first, nearest the targets; weakAt:
 * the OR or k of n nearest it where its chain toward the targets is one of several (-1 while Required). l and g: need
 * per level and Freezer. `routeMap` is routeGraph(plans).
 */
export function goalRoles(plans: Plans, routeMap: RouteGraph, targets: number[]): GoalRoles {
    const { G: graph } = plans;
    const requirementCount = graph.keys.length;
    const need = new Uint8Array(requirementCount);
    const from = new Int32Array(requirementCount).fill(-1);
    const weakAt = new Int32Array(requirementCount).fill(-1);
    const queue: number[] = [];

    const mark = (id: number, strong: boolean, by: number, junction: number) => {
        if (graph.met[id]) return;
        const value = strong ? 2 : 1;
        if (need[id] >= value) return;
        need[id] = value;
        from[id] = by;
        if (strong) weakAt[id] = -1;
        else weakAt[id] = junction;
        queue.push(id);
    };

    for (const id of targets) mark(id, true, -1, -1);

    // breadth first, so a requirement's `from` is the nearest to the targets
    for (let head = 0; head < queue.length; head++) {
        const id = queue[head];
        const strong = need[id] === 2;
        const kind = graph.kind[id];
        const parts = graph.parts[id];

        // a weak requirement's parts are weak from where it became weak
        const inherited = weakAt[id];
        if (kind === 'and') {
            for (const part of parts) mark(part, strong, id, inherited);
            continue;
        }

        const routes = routeMap.routes[id];
        if (!routes) continue;
        const needsAll = kind === 'or' ? routes.length === 1 : routes.length <= graph.k[id];
        if (needsAll) {
            for (const part of routes) mark(part, strong, id, inherited);
            continue;
        }
        for (const part of routeMap.shared[id]!) mark(part, strong, id, inherited);
        for (const part of routes) mark(part, false, id, id);
    }

    const levelBase = graph.index.get('l0') ?? 0;
    const gateBase = graph.index.get('g0') ?? 0;
    return {
        need,
        from,
        weakAt,
        l: need.subarray(levelBase, levelBase + PROG.levels.length),
        g: need.subarray(gateBase, gateBase + PROG.freezers.length),
    };
}

/**
 * A goal's role for a level ('l') or Freezer ('g'): 'req' on every route to it, 'one' on some routes, else 'optional';
 * null before the goal has roles.
 */
export function roleFor(
    goal: { roles?: GoalRoles } | null | undefined,
    kind: 'l' | 'g',
    id: number,
): 'req' | 'one' | 'optional' | null {
    const need = goal?.roles?.[kind];
    if (!need) return null;
    if (need[id] === 2) return 'req';
    if (need[id] === 1) return 'one';
    return 'optional';
}
