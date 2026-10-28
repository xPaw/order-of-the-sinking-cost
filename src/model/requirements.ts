// The requirement graph the plans are worked out over (VIEWER.md "The requirement graph")
import { PROG } from '../data.ts';
import type { FreezerSign, KnownRoute, RouteNeed } from '../types.ts';
import { ENDINGS, MARKER_RANKS } from './achievements.ts';
import { needMet, routeMet } from './known-routes.ts';
import type { NeedsView } from './known-routes.ts';
import type { BaseProgress } from './progress.ts';
import { signGateMet } from './unlocking.ts';

export const SIGN_INDEX = new Map((PROG.signs || []).map((sign, signIndex): [number, number] => [sign.pid, signIndex]));

/** How a requirement is met: all of its parts, the cheapest one of them, or the cheapest `k` of them. */
export type RequirementKind = 'and' | 'or' | 'k';

/** What a plan step stands for; `front` marks a level playable now, `alt` the options an OR requirement still has. */
interface StepMarks {
    front?: boolean;
    alt?: number;
}

/** A step for a level (l), Freezer (g), tower (t) or gold room (p), by index. */
export interface IndexedStep extends StepMarks {
    t: 'l' | 'g' | 't' | 'p';
    id: number;
}

/** A step for the way onto a layer (a), by layer key, or for a rank marker (e), by achievement name. */
export interface NamedStep extends StepMarks {
    t: 'a' | 'e';
    id: string;
}

/** A step for a sign rule (s): the sign's index when the sign is in `signs`, and its rule. */
export interface SignStep extends StepMarks {
    t: 's';
    id: number | undefined;
    g: FreezerSign;
}

/** A step for a known sky Way (w): its area's index and the index of the sky tower whose Sign it leads to. */
export interface WayStep extends StepMarks {
    t: 'w';
    id: number;
    tower: number;
}

export type PlanStep = IndexedStep | NamedStep | SignStep | WayStep;

/**
 * A requirement is met (nothing to do), a step with parts, or a part with no step of its own (an option list inside a
 * step). A step or part needs all its parts (AND), the cheapest one of them (OR), or the cheapest `k` of them (k of n).
 * Nodes of the plans: levels (l), Freezers (g), sign rules (s), towers (t).
 *   level, solved: met. Playable now (entered, partly solved or reachable): a step with no parts (`front`).
 *   level, locked: its unsolved requirements (all, or the cheapest one for an OR gate), and a closed Freezer it is
 *     frozen in.
 *   level, not reachable: the cheapest of its way-in gates (progress.wayIn; for a doorway, the cheapest way through it,
 *     all of its gates: progress.wayInChains) and the levels by a pad that reveals one in its pocket; with none, on a
 *     layer the walk reaches nowhere, the way onto that layer (a); else, when it has none, or none has a plan and each
 *     gate only leads to such a pad, a step of its own.
 *   Freezer, open: met. Closed: its unmet levels and signs (all, or the cheapest one for an OR gate; an OR gate with one
 *     met opens at the next overworld load, a step with no parts).
 *   way (w): a sky Way of the known routes (progress.json known_routes): met once its tower's hub quarter is reached
 *     (the tower's Sign read or faced, or its hub pad discovered); else what its route needs, all of the groups, one
 *     need of a group with several. The tower's Sign in the hub needs it too. A route to a level with unmet needs is one
 *     more way in to the level.
 *   sign: a tower sign whose tower is not active needs the tower; a rank sign the rank; the gold room sign the
 *     cheapest gold rooms (p) still to find, each its tower.
 *   rank r (a part): the cheapest of the ENDGAME levels and the rank markers (e: ASCEND, DESCEND) that give r or more.
 *   tower, active: met. Else the cheapest of its unsolved levels, as many as it still needs.
 */
export class Graph {
    keys: string[] = [];
    index = new Map<string, number>();

    // per requirement: the plan node (null for a part), 'and' | 'or' | 'k', k, part ids, met
    node: Array<PlanStep | null> = [];

    kind: RequirementKind[] = [];
    k: number[] = [];
    parts: number[][] = [];
    met: boolean[] = [];

    // a step of its own once nothing else gives it a plan
    fallback: boolean[] = [];

    add(key: string, node: PlanStep | null, kind: RequirementKind = 'and', parts: number[] = [], needed = 0): number {
        const id = this.keys.length;
        this.keys.push(key);
        this.index.set(key, id);
        this.node.push(node);
        this.kind.push(kind);
        this.k.push(needed);
        this.parts.push(parts);
        this.met.push(false);
        this.fallback.push(false);
        return id;
    }
}

/** Builds the requirement graph of a campaign's progress. */
export function requirementGraph(progress: BaseProgress): Graph {
    const levels = PROG.levels;
    const freezers = PROG.freezers;
    const graph = new Graph();

    const levelId = levels.map((level, levelIndex) => graph.add('l' + levelIndex, { t: 'l', id: levelIndex }));
    const gateId = freezers.map((freezer, freezerIndex) => graph.add('g' + freezerIndex, { t: 'g', id: freezerIndex }));
    const towerId = progress.towers.map((tower, towerIndex) => graph.add('t' + towerIndex, { t: 't', id: towerIndex }));
    const signIds = new Map<string, number>();

    // the endings (PROGRESSION.md "Endings"): a rank r is the cheapest of the ways to it or past it, the ENDGAME levels
    // and the ASCEND and DESCEND markers. The way onto the sky (its pieces wait in rank 1 Freezers) comes after rank 1
    // and the way into the underworld after the sky, each a step of its own while the walk does not find it; ASCEND
    // and DESCEND stand on those layers.
    const access = new Map<string, number>();
    const rankId = new Map<number, number>();
    const ranked: Array<[rank: number, source: number]> = [];
    const rankReached = (rank: number) => progress.signOk({ rank });

    for (const [rank, name] of ENDINGS) {
        const levelIndex = levels.findIndex((level) => level.a === name);
        if (levelIndex >= 0) ranked.push([rank, levelId[levelIndex]]);
    }

    const signRanks = freezers.flatMap((freezer) => (freezer.signs || []).map((sign) => sign.rank || 0));

    for (const rank of new Set([1, 3, 5, ...signRanks])) {
        if (!rank || rank === 255) continue;
        const id = graph.add('r' + rank, null, 'or');
        if (rankReached(rank)) graph.met[id] = true;
        rankId.set(rank, id);
    }

    const accessId = (layer: string) => access.get(layer)!;
    access.set('sky', graph.add('a:sky', { t: 'a', id: 'sky' }, 'and', [rankId.get(1)!]));
    access.set('underworld', graph.add('a:underworld', { t: 'a', id: 'underworld' }, 'and', [accessId('sky')]));

    // the way onto a layer is met once the walk reaches a cell on it
    for (const [layer, id] of access) {
        const layerCols = progress.reach?.cols[layer];
        if (layerCols?.some((value) => value)) graph.met[id] = true;
    }

    for (const [name, rank, layer] of MARKER_RANKS) {
        const id = graph.add('e:' + name, { t: 'e', id: name }, 'and', [accessId(layer)]);
        if (rankReached(rank)) graph.met[id] = true;
        ranked.push([rank, id]);
    }

    for (const [rank, id] of rankId) {
        const sources = ranked.filter(([sourceRank]) => sourceRank >= rank);
        graph.parts[id] = sources.map(([, source]) => source);
    }

    // a gold room is found by stepping on its tower's MINOR pad once the tower is active
    const roomId = (PROG.gold_rooms || []).map((room, roomIndex) => {
        const id = graph.add('p' + roomIndex, { t: 'p', id: roomIndex });
        if (progress.tst?.[room.endpoint]?.disc) graph.met[id] = true;
        else if (progress.towers[room.tower]) graph.parts[id] = [towerId[room.tower]];
        return id;
    });

    // a sky Way (a known route with an area) is met once the tower's hub quarter is reached: its Sign is read or faced by
    // the walk, or the tower's hub pad is discovered. Else it asks for what its route needs (below, once the Signs exist).
    const needsView: NeedsView = {
        levelSolved: (level) => progress.state[level] === 'solved',
        freezerOpen: (freezerIndex) => progress.gateOpen[freezerIndex],
        signRead: progress.signRead,
        rockSmashed: progress.rockSmashed,
    };
    const wayOfTower = new Map<number, number>();
    const wayOfRoute = new Map<KnownRoute, number>();
    (PROG.known_routes || []).forEach((route) => {
        if (route.area === undefined || route.tower === undefined) return;

        const signIndex = PROG.signs.findIndex(
            (sign) => sign.tower === route.tower && !sign.status && sign.gates.length,
        );
        const hub = progress.towers[route.tower]?.hub;
        const id = graph.add('w' + route.area, { t: 'w', id: route.area, tower: route.tower }, 'and');
        wayOfTower.set(route.tower, id);
        wayOfRoute.set(route, id);

        const read = signIndex >= 0 && progress.signRead(PROG.signs[signIndex].pid);
        const faced = signIndex >= 0 && !!progress.reach?.signFaced[signIndex];
        const padFound = hub !== undefined && progress.tst[hub].disc;
        if (read || faced || padFound) graph.met[id] = true;
    });

    const signId = (rule: FreezerSign, freezerIndex: number | null, position: number): number => {
        const signIndex = SIGN_INDEX.get(rule.pid);
        const key = signIndex != null ? 's' + signIndex : 'x' + freezerIndex + ':' + position;
        if (!signIds.has(key)) {
            const id = graph.add(key, { t: 's', id: signIndex, g: rule });
            signIds.set(key, id);

            // a tower status sign is never read: its tower active is all it asks. Any other sign is a step of reading
            // it: its rule comes first, and the hero has to get to it.
            const isStatus = signIndex != null && !!PROG.signs[signIndex].status;
            if (isStatus) {
                if (progress.signOk(rule)) graph.met[id] = true;
            } else if (signGateMet(rule, progress.signRead)) {
                graph.met[id] = true;
            }

            if (!graph.met[id] && !progress.signOk(rule)) {
                if (rule.tower != null && progress.towers[rule.tower]) {
                    graph.parts[id] = [towerId[rule.tower]];
                } else if (rule.rank && rankId.has(rule.rank)) {
                    graph.parts[id] = [rankId.get(rule.rank)!];
                } else if (rule.gold) {
                    graph.kind[id] = 'k';
                    graph.k[id] = rule.gold - (progress.goldFound || 0);
                    graph.parts[id] = roomId.filter((room) => !graph.met[room]);
                }
            }

            // a tower Sign in the sky hub stands in its own quarter, which the tower's Way leads to
            const signTower = signIndex != null ? PROG.signs[signIndex].tower : undefined;
            const wayToSign = signTower != null ? wayOfTower.get(signTower) : undefined;
            if (!graph.met[id] && !isStatus && wayToSign !== undefined && !graph.met[wayToSign]) {
                graph.parts[id].push(wayToSign);
            }

            // the hero has to get to the Sign too: by one of the gates whose opening lets the walk face it, else onto
            // the layer the walk reaches nowhere
            let gates: number[] = [];
            let layer: string | null | undefined = null;
            if (!graph.met[id] && signIndex != null && !isStatus) {
                gates = progress.signWayIn?.[signIndex] ?? [];
                layer = progress.signAccess?.[signIndex];
            }

            if (gates.length > 0) {
                if (graph.kind[id] === 'k') {
                    const rooms = graph.add('k' + key, null, 'k', graph.parts[id], graph.k[id]);
                    graph.kind[id] = 'and';
                    graph.parts[id] = [rooms];
                }
                // gates that run in a cycle leave the way in without a plan: the Sign keeps its rule alone
                const gateParts = gates.map((gate) => gateId[gate]);
                const wayId = graph.add('n' + key, null, 'or', gateParts);
                graph.fallback[wayId] = true;
                graph.parts[id].push(wayId);
            } else if (layer && graph.kind[id] === 'and') {
                graph.parts[id].push(accessId(layer));
            }
        }
        return signIds.get(key)!;
    };

    (PROG.signs || []).forEach((sign, signIndex) => signId(sign, null, signIndex));

    // what a known route still asks for: each group of its needs not met yet, the need itself or an OR of the group's
    const needId = (need: RouteNeed): number | undefined => {
        if ('level' in need) return levelId[need.level];
        if ('freezer' in need) return gateId[need.freezer];
        if ('rock' in need) return undefined;
        return signIds.get('s' + need.sign)!;
    };
    const routeParts = (route: KnownRoute): number[] => {
        const parts: number[] = [];
        route.needs.forEach((group, groupIndex) => {
            if (group.some((need) => needMet(need, needsView))) return;

            // an empty group is a need that is not known, and a Rock to smash has no step: there is nothing to plan
            const members: number[] = [];
            for (const need of group) {
                const id = needId(need);
                if (id !== undefined) members.push(id);
            }
            if (members.length === 0) return;
            if (members.length === 1) {
                parts.push(members[0]);
                return;
            }
            parts.push(graph.add('ro' + route.id + '.' + groupIndex, null, 'or', members));
        });
        return parts;
    };

    // a sky Way asks for its route's needs unless its quarter is reached
    for (const [route, wayId] of wayOfRoute) {
        if (!graph.met[wayId]) graph.parts[wayId] = routeParts(route);
    }

    // the way onto a layer the walk reaches nowhere also asks for the needs of the routes that lead onto it
    for (const route of PROG.known_routes || []) {
        if (route.onto === undefined) continue;

        const layerId = accessId(route.onto);
        if (!graph.met[layerId]) graph.parts[layerId].push(...routeParts(route));
    }

    // a route to a level whose needs are not met yet is one more way in to it
    const routesToLevel = new Map<number, KnownRoute[]>();
    for (const route of PROG.known_routes || []) {
        if (!('level' in route.to) || routeMet(route, needsView)) continue;

        const known = routesToLevel.get(route.to.level) ?? [];
        known.push(route);
        routesToLevel.set(route.to.level, known);
    }

    // every way-in gate of a level the walk cannot reach only leads to a pad that reveals one in its pocket
    const onlyPadGates = (levelIndex: number, gateIndices: number[]) => {
        if (!gateIndices.length) return true;
        if (!progress.behind[levelIndex].length) return false;
        const padGates = new Set(progress.why[levelIndex]!.pad);
        return gateIndices.every((freezerIndex) => padGates.has(freezerIndex));
    };

    levels.forEach((level, levelIndex) => {
        const id = levelId[levelIndex];
        const levelState = progress.state[levelIndex];

        if (levelState === 'solved') {
            graph.met[id] = true;
            return;
        }

        if (levelState === 'visited' || levelState === 'partial' || levelState === 'unlocked') {
            graph.node[id]!.front = true;
            return;
        }

        if (levelState === 'locked') {
            const todo = level.req
                .filter((required) => progress.state[required] !== 'solved')
                .map((required) => levelId[required]);
            let parts = todo;
            if (level.or && level.req.length > 1) {
                graph.node[id]!.alt = todo.length;
                parts = [graph.add('o' + levelIndex, null, 'or', todo)];
            }

            const frozenIn = progress.ice?.[levelIndex];
            if (frozenIn !== undefined) parts = [...parts, gateId[frozenIn]];
            graph.parts[id] = parts;
            return;
        }

        graph.node[id]!.alt = 0;
        const gateIndices = progress.wayIn[levelIndex] || [];
        const viaLevels = progress.wayInFixed?.has(levelIndex) ? [] : progress.why[levelIndex]?.via || [];
        const viaTowers = progress.wayInFixed?.has(levelIndex) ? [] : progress.why[levelIndex]?.viaTowers || [];
        const levelChains = progress.wayInChains[levelIndex];

        // a doorway is entered by one of the ways through it, each needing all of its gates
        const wayParts = (freezerIndex: number) => {
            const chains = levelChains?.get(freezerIndex);
            if (!chains) return [gateId[freezerIndex]];

            return chains.map((chain) => {
                const key = 'w' + levelIndex + ':' + chain.join(',');
                return graph.add(
                    key,
                    null,
                    'and',
                    chain.map((gate) => gateId[gate]),
                );
            });
        };

        graph.kind[id] = 'or';
        graph.parts[id] = [
            ...gateIndices.flatMap(wayParts),
            ...viaLevels.map((via) => levelId[via]),
            ...viaTowers.map((tower) => towerId[tower]),
        ];

        for (const route of routesToLevel.get(levelIndex) ?? []) {
            const parts = routeParts(route);
            if (parts.length === 0) continue;
            if (parts.length === 1) {
                graph.parts[id].push(parts[0]);
                continue;
            }
            graph.parts[id].push(graph.add('rt' + route.id, null, 'and', parts));
        }

        const layer = progress.access?.[levelIndex];
        if (!graph.parts[id].length && layer) {
            // on a layer the walk reaches nowhere, with no gate leading in: it needs the way onto the layer
            graph.kind[id] = 'and';
            graph.parts[id] = [accessId(layer)];
            return;
        }

        if (onlyPadGates(levelIndex, gateIndices)) graph.fallback[id] = true;
        if (!graph.parts[id].length && graph.fallback[id]) graph.kind[id] = 'and';
    });

    // a level that also asks for the gates of the endgame table (all of them together, besides its way in)
    progress.wayInAll?.forEach((lift, levelIndex) => {
        const id = levelId[levelIndex];
        const liftGates = lift.map((freezerIndex) => gateId[freezerIndex]);
        let liftPart = liftGates[0];
        if (liftGates.length > 1) liftPart = graph.add('wa' + levelIndex, null, 'and', liftGates);

        const rest = graph.parts[id].filter((part) => !liftGates.includes(part));
        let restParts = rest;
        if (rest.length > 1 && graph.kind[id] === 'or') {
            restParts = [graph.add('wr' + levelIndex, null, 'or', rest)];
        }

        graph.kind[id] = 'and';
        graph.parts[id] = [liftPart, ...restParts];
    });

    freezers.forEach((freezer, freezerIndex) => {
        const id = gateId[freezerIndex];
        if (progress.gateOpen[freezerIndex]) {
            graph.met[id] = true;
            return;
        }

        const levelMet = (required: number) => {
            if (progress.state[required] === 'solved') return true;
            return !!freezer.partial && progress.state[required] === 'partial';
        };
        const items = [
            ...freezer.req.map((required) => ({ met: levelMet(required), id: levelId[required] })),
            ...(freezer.signs || []).map((rule, position) => ({
                met: signGateMet(rule, progress.signRead),
                id: signId(rule, freezerIndex, position),
            })),
        ];

        const todo = items.filter((item) => !item.met).map((item) => item.id);
        if (freezer.or && items.length > 1) {
            if (todo.length < items.length) return;
            graph.kind[id] = 'or';
            graph.node[id]!.alt = todo.length;
        }
        graph.parts[id] = todo;
    });

    progress.towers.forEach((tower, towerIndex) => {
        const id = towerId[towerIndex];
        if (tower.active) {
            graph.met[id] = true;
            return;
        }
        graph.kind[id] = 'k';
        graph.k[id] = tower.req - tower.solvedNormal;
        graph.parts[id] = tower.normal
            .filter((level) => progress.state[level] !== 'solved')
            .map((level) => levelId[level]);
    });

    return graph;
}
