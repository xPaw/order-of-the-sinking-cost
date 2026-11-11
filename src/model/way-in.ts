// The way into a level its needs do not reach: the closed Freezers it sits behind from the start, less those it is
// behind only through itself (viewer.md "Ways in and leads", "Endgame way-in gates")
import { PROG } from '../data.ts';
import type { Freezer } from '../types.ts';
import { ICE } from '../walk/freezers.ts';
import { mapLayerOf } from './layers.ts';
import { directGatesOf, gatesBehindOf, tableNeedFreezers, tableWorld } from './level-freezers.ts';
import type { BehindState } from './level-freezers.ts';
import { ROLE } from './level-roles.ts';
import { gateOptionMet, levelsNeedingLevel, optionCount } from './unlocking.ts';
import type { LevelFlags, LevelState } from './unlocking.ts';

/** Per level, the levels that require it. */
export interface LevelUnlocks {
    levels: number[];
}

/**
 * The strongly connected components of a graph (nodes 0..n-1, edges[x]: the nodes x points to), Tarjan's algorithm
 * without recursion: per node its component's index.
 */
export function components(nodeCount: number, edges: number[][]): Int32Array {
    const index = new Int32Array(nodeCount).fill(-1);
    const low = new Int32Array(nodeCount);
    const component = new Int32Array(nodeCount).fill(-1);
    const onStack = new Uint8Array(nodeCount);
    const stack: number[] = [];
    let counter = 0;
    let count = 0;

    for (let root = 0; root < nodeCount; root++) {
        if (index[root] >= 0) continue;

        // the walk: [node, the next edge to follow]
        const walk: Array<[node: number, nextEdge: number]> = [[root, 0]];
        index[root] = low[root] = counter++;
        stack.push(root);
        onStack[root] = 1;

        while (walk.length) {
            const top = walk[walk.length - 1];
            const node = top[0];
            if (top[1] < edges[node].length) {
                const next = edges[node][top[1]++];
                if (index[next] < 0) {
                    index[next] = low[next] = counter++;
                    stack.push(next);
                    onStack[next] = 1;
                    walk.push([next, 0]);
                } else if (onStack[next]) {
                    low[node] = Math.min(low[node], index[next]);
                }
                continue;
            }

            walk.pop();
            if (walk.length) {
                const parent = walk[walk.length - 1][0];
                low[parent] = Math.min(low[parent], low[node]);
            }
            if (low[node] !== index[node]) continue;

            for (;;) {
                const member = stack.pop()!;
                onStack[member] = 0;
                component[member] = count;
                if (member === node) break;
            }
            count++;
        }
    }

    return component;
}

/**
 * The closed gates that are no way in: their requirements can be met only from behind the gate itself, through any
 * chain of gates and levels (viewer.md "Next steps"). Requirements (nodes: levels 0..L-1, then gates):
 * - a level its needs do not reach needs its way-in gates;
 * - a locked level its unsolved requirements (all, or one for an OR level) or the closed Freezer it is frozen in;
 * - a closed Freezer its unmet levels (all, or one for an OR gate; an OR gate with a met option or a sign needs none).
 *
 * Each node needs any one of its `any` (one is enough to hold it back) or all of its `all`. A gate can need itself
 * only inside a strongly connected component; per such gate, what cannot be met without it spreads back from it.
 */
export function gatesBehindThemselves({
    state,
    wayIn,
    ice,
    gateOpen,
    met,
}: {
    state: LevelState[];
    wayIn: Array<number[] | null>;
    ice: Array<number | undefined>;
    gateOpen: boolean[];
    met: (freezer: Freezer, level: number) => boolean;
}): Set<number> {
    const levels = PROG.levels;
    const freezers = PROG.freezers;
    const nodeCount = levels.length + freezers.length;
    const any = Array.from({ length: nodeCount }, (): number[] => []);
    const all = Array.from({ length: nodeCount }, (): number[] => []);
    const gateNode = (freezerIndex: number) => levels.length + freezerIndex;

    levels.forEach((level, i) => {
        if (state[i] === 'blocked') {
            all[i] = (wayIn[i] || []).map(gateNode);
            return;
        }
        if (state[i] !== 'locked') return;

        const todo = level.req.filter((j) => state[j] !== 'solved');
        if (level.or && level.req.length > 1) all[i] = todo;
        else any[i] = todo;
        const frozenIn = ice[i];
        if (frozenIn !== undefined) any[i] = [...any[i], gateNode(frozenIn)];
    });

    freezers.forEach((freezer, freezerIndex) => {
        if (gateOpen[freezerIndex]) return;

        const node = gateNode(freezerIndex);
        const todo = freezer.req.filter((j) => !met(freezer, j));
        if (freezer.or && optionCount(freezer) > 1) {
            if (todo.length === freezer.req.length && !freezer.signs?.length) all[node] = todo;
            return;
        }
        any[node] = todo;
    });

    const edges = any.map((anyNodes, node) => [...anyNodes, ...all[node]]);
    const component = components(nodeCount, edges);
    const size = new Int32Array(nodeCount);
    for (const componentIndex of component) size[componentIndex]++;

    // within a component, who needs each node
    const neededBy = Array.from({ length: nodeCount }, (): number[] => []);
    edges.forEach((needed, node) => {
        for (const other of needed) {
            if (component[other] === component[node]) neededBy[other].push(node);
        }
    });

    const candidates = new Set<number>();

    const addCandidate = (freezerIndex: number) => {
        if (size[component[gateNode(freezerIndex)]] > 1) candidates.add(freezerIndex);
    };

    for (const gates of wayIn) {
        for (const freezerIndex of gates || []) addCandidate(freezerIndex);
    }

    const membersOf = new Map<number, number[]>();
    for (const freezerIndex of candidates) membersOf.set(component[gateNode(freezerIndex)], []);
    for (let node = 0; node < nodeCount; node++) membersOf.get(component[node])?.push(node);

    const behind = new Set<number>();
    const held = new Uint8Array(nodeCount);
    const left = new Int32Array(nodeCount);

    for (const freezerIndex of candidates) {
        const gate = gateNode(freezerIndex);
        const members = membersOf.get(component[gate])!;

        // an `all` with a part outside the component never waits on the gate alone
        for (const member of members) {
            held[member] = 0;
            const outside = all[member].some((other) => component[other] !== component[gate]);
            if (all[member].length > 0 && !outside) {
                left[member] = all[member].length;
            } else {
                left[member] = -1;
            }
        }
        held[gate] = 1;

        const queue = [gate];
        while (queue.length) {
            const node = queue.pop()!;
            for (const user of neededBy[node]) {
                if (held[user]) continue;

                if (!any[user].includes(node)) {
                    if (!all[user].includes(node)) continue;

                    left[user]--;
                    if (left[user] !== 0) continue;
                }
                held[user] = 1;
                queue.push(user);
            }
        }

        const anyHeld = any[gate].some((other) => other !== gate && held[other]);
        const allHeld = all[gate].length > 0 && all[gate].every((other) => held[other]);
        if (anyHeld || allHeld) behind.add(freezerIndex);
    }

    return behind;
}

/** Per level, the levels requiring it; a level enabled in the level data requires none. */
export function unlocksOf(): LevelUnlocks[] {
    const levels = PROG.levels;
    const unlocks = levels.map((): LevelUnlocks => ({ levels: [] }));
    levels.forEach((level, i) => {
        if (level.en) return;
        level.req.forEach((j) => unlocks[j].levels.push(i));
    });
    return unlocks;
}

/** Per level, the closed Freezer it is frozen in. */
export function frozenInOf(gateOpen: boolean[]): Array<number | undefined> {
    return ICE.map((freezerIndex) => {
        if (freezerIndex === undefined || gateOpen[freezerIndex]) return undefined;
        return freezerIndex;
    });
}

/**
 * Per level whose door the hero cannot reach, the closed Freezers the hero can act on next to get nearer to it
 * (level-freezers.ts gatesBehindOf); none for the others.
 */
export function gatesBehind(state: BehindState): number[][] {
    return gatesBehindOf(tableWorld(), tableNeedFreezers(), state);
}

/** Per closed Freezer, the levels whose door the hero cannot reach that have an unmet need standing for it. */
export function leadsOf(state: BehindState): number[][] {
    const direct = directGatesOf(tableWorld(), tableNeedFreezers(), state);
    const leads = PROG.freezers.map((): number[] => []);
    direct.forEach((freezerIndices, levelIndex) => {
        for (const freezerIndex of freezerIndices) leads[freezerIndex].push(levelIndex);
    });
    return leads;
}

/**
 * The levels their needs do not reach: a function that gives, per level, its way-in gates under the current level roles.
 * solved(i): whether level i is solved; unlocks: unlocksOf(); behind: gatesBehind(); ice: frozenInOf().
 */
export function wayInFor({
    levelFlags,
    solved,
    state,
    unlocks,
    behind,
    gateOpen,
    ice,
}: {
    levelFlags: LevelFlags;
    solved: (level: number) => boolean;
    state: LevelState[];
    unlocks: LevelUnlocks[];
    behind: number[][];
    gateOpen: boolean[];
    ice: Array<number | undefined>;
}) {
    const levels = PROG.levels;
    const levelsNeeding = (level: number) => levelsNeedingLevel(levels, unlocks, solved, level);

    // whether what a closed gate still needs is all within(level) (for an OR gate: every option, and it has no sign)
    const needsOnly = (freezerIndex: number, within: (j: number) => boolean) => {
        const freezer = PROG.freezers[freezerIndex];
        const todo = freezer.req.filter((j) => !gateOptionMet(freezer, j, levelFlags));
        if (freezer.or && optionCount(freezer) > 1) {
            return !freezer.signs?.length && todo.length > 0 && todo.every(within);
        }
        return todo.some(within);
    };

    // a closed gate is no way into a level when what it still needs is the level itself, or levels whose own
    // requirements need the level
    const inner = (freezerIndex: number, level: number, needing: Set<number>) =>
        needsOnly(freezerIndex, (j) => j === level || needing.has(j));

    // wayIn: per level its needs do not reach, the closed gates that are a way in: the ones it sits behind from the
    // start (the static roles), without the gates inner() rules out; in the endgame areas the level data's way-in gates
    // stand in for those or fill in where there are none (progress.json endgame_way_ins)
    const endgameWayIn = new Map(
        (PROG.endgame_way_ins || []).map(([level, gates, replace]): [number, { gates: number[]; replace: number }] => [
            level,
            { gates, replace },
        ]),
    );

    const gateMet = (freezer: Freezer, level: number) => gateOptionMet(freezer, level, levelFlags);

    // the way-in gates, less the gates whose requirements can be met only from behind them (gatesBehindThemselves)
    const wayInOf = () => {
        const wayInAll = new Map<number, number[]>();
        const wayIn = state.map((levelState, i): number[] | null => {
            if (levelState !== 'blocked') return null;

            const table = endgameWayIn.get(i);
            const tableGates = table ? table.gates.filter((freezerIndex) => !gateOpen[freezerIndex]) : [];
            if (table?.replace) return tableGates;
            // the gates of a row that only fills in are all needed, besides the walk's way in
            if (tableGates.length) wayInAll.set(i, tableGates);
            const needing = levelsNeeding(i);
            const gates = behind[i].filter((freezerIndex) => !inner(freezerIndex, i, needing));
            if (!gates.length) return tableGates;
            return gates;
        });
        const behindThemselves = gatesBehindThemselves({ state, wayIn, ice, gateOpen, met: gateMet });
        if (!behindThemselves.size) return { wayIn, wayInAll };

        const keptWayIn = wayIn.map(
            (gates) => gates?.filter((freezerIndex) => !behindThemselves.has(freezerIndex)) ?? null,
        );
        return { wayIn: keptWayIn, wayInAll };
    };

    return wayInOf;
}

/** The map layers that hold a level whose door the hero can reach (`doorReached`: per level); every layer without it. */
export function layersReachedOf(doorReached: readonly boolean[] | null): Set<string> {
    const layers = new Set<string>();
    if (!doorReached) {
        for (const layer of PROG.map?.layers || []) layers.add(layer.key);
        return layers;
    }

    PROG.levels.forEach((level, i) => {
        if (doorReached[i]) layers.add(mapLayerOf(level.p[2]));
    });
    return layers;
}

/**
 * Per level its needs do not reach on a layer where no level is reached (sky, underworld), that layer; else the sky,
 * when no level there is reached and the level data enters the level from the sky.
 */
export function accessOf(state: LevelState[], layersReached: ReadonlySet<string>): Array<string | null> {
    return state.map((levelState, i) => {
        if (levelState !== 'blocked') return null;

        const layer = mapLayerOf(PROG.levels[i].p[2]);
        if (layer !== 'ground' && !layersReached.has(layer)) return layer;
        if (PROG.levels[i].drop !== undefined && !layersReached.has('sky')) return 'sky';
        return null;
    });
}

/** Whether closed gate `freezer` waits on the Sign `pid`: it lists it and no other option opens the gate. */
function gateNeedsSign(freezer: Freezer, pid: number): boolean {
    if (freezer.or && optionCount(freezer) > 1) return false;
    return !!freezer.signs?.some((rule) => rule.pid === pid);
}

/**
 * Per Sign, whether a hero can face it: every Freezer it sits behind from the start is open. A Sign the static roles
 * never reach is not faced.
 */
export function signsFacedOf(gateOpen: boolean[]): boolean[] {
    return (PROG.signs || []).map((sign, signIndex) => {
        const behind = ROLE?.bg.s[signIndex];
        if (!behind) return false;
        return behind.every((freezerIndex) => gateOpen[freezerIndex]);
    });
}

/**
 * Per Sign the hero cannot face yet, its way-in gates: the closed Freezers it sits behind, less the gates that wait on
 * the Sign itself. A gate that waits on a level only the Sign leads to is not looked for; the plans leave a requirement
 * that runs in a cycle without a plan.
 */
export function signWayInOf(signFaced: boolean[], gateOpen: boolean[]): number[][] {
    return (PROG.signs || []).map((sign, signIndex) => {
        if (signFaced[signIndex]) return [];

        const behind = ROLE?.bg.s[signIndex] ?? [];
        const closed = behind.filter((freezerIndex) => !gateOpen[freezerIndex]);
        return closed.filter((freezerIndex) => !gateNeedsSign(PROG.freezers[freezerIndex], sign.pid));
    });
}

/** Per Sign the hero cannot face yet on a layer where no level is reached (sky, underworld), that layer. */
export function signAccessOf(signFaced: boolean[], layersReached: ReadonlySet<string>): Array<string | null> {
    return (PROG.signs || []).map((sign, i) => {
        if (signFaced[i]) return null;

        const layer = mapLayerOf(sign.p[2]);
        if (layer === 'ground' || layersReached.has(layer)) return null;
        return layer;
    });
}
