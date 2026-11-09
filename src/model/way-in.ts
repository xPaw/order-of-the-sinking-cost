// The way into a level the walk cannot reach: the closed gates that lead into its pocket, less those it is
// behind only through itself (VIEWER.md "Pockets, leads and why", "Endgame way-in gates")
import { PROG } from '../data.ts';
import type { Freezer } from '../types.ts';
import { ICE } from '../walk/freezers.ts';
import { MECHS } from '../walk/mechanics.ts';
import type { Reachability } from '../walk/reachability.ts';
import { ROLE } from './level-roles.ts';
import type { TowerProgress } from './towers.ts';
import { gateOptionMet, levelsNeedingLevel, optionCount } from './unlocking.ts';
import type { LevelFlags, LevelState } from './unlocking.ts';

/** Why a level the walk cannot reach may still be: the closed gates that lead into its pocket, those among them that only lead to a pad, the levels by such a pad, the inactive towers whose pad leads in and the unmodelled mechanics there. */
export interface WhyBlocked {
    gates: number[];
    pad: number[];
    via: number[];
    viaTowers: number[];
    mech: string[];
}

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
 * chain of gates and levels (VIEWER.md "Next steps"). Requirements (nodes: levels 0..L-1, then gates, then the ways
 * through a doorway):
 * - a level the walk cannot reach needs one of its way-in gates or of the levels by a pad (`via`); in place of a
 *   doorway, one of the ways through it (`chains`), and a way through needs all of its gates;
 * - a locked level its unsolved requirements (all, or one for an OR level) or the closed Freezer it is frozen in;
 * - a closed Freezer its unmet levels (all, or one for an OR gate; an OR gate with a met option or a sign needs none).
 *
 * Each node needs any one of its `any` (one is enough to hold it back) or all of its `all`. A gate can need itself
 * only inside a strongly connected component; per such gate, what cannot be met without it spreads back from it.
 */
export function gatesBehindThemselves({
    state,
    wayIn,
    chains = [],
    via,
    ice,
    gateOpen,
    met,
}: {
    state: LevelState[];
    wayIn: Array<number[] | null>;
    chains?: Array<Map<number, number[][]> | null>;
    via: (level: number) => number[] | undefined;
    ice: Array<number | undefined>;
    gateOpen: boolean[];
    met: (freezer: Freezer, level: number) => boolean;
}): Set<number> {
    const levels = PROG.levels;
    const freezers = PROG.freezers;
    let chainCount = 0;
    for (const levelChains of chains) {
        for (const ways of levelChains?.values() ?? []) chainCount += ways.length;
    }

    const nodeCount = levels.length + freezers.length + chainCount;
    const any = Array.from({ length: nodeCount }, (): number[] => []);
    const all = Array.from({ length: nodeCount }, (): number[] => []);
    const gateNode = (freezerIndex: number) => levels.length + freezerIndex;
    let nextChainNode = levels.length + freezers.length;

    // a way through a doorway is held back by any one of its gates
    const wayNodes = (level: number, freezerIndex: number) => {
        const ways = chains[level]?.get(freezerIndex);
        if (!ways) return [gateNode(freezerIndex)];

        return ways.map((chain) => {
            const node = nextChainNode++;
            any[node] = chain.map(gateNode);
            return node;
        });
    };

    levels.forEach((level, i) => {
        if (state[i] === 'blocked') {
            const gateNodes = (wayIn[i] || []).flatMap((freezerIndex) => wayNodes(i, freezerIndex));
            all[i] = [...gateNodes, ...(via(i) || [])];
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

    for (const levelChains of chains) {
        for (const ways of levelChains?.values() ?? []) {
            for (const chain of ways) chain.forEach(addCandidate);
        }
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

/** Per level, the closed gates whose leads, pocket or light leads hold it. */
export function gatesBehind(reach: Reachability | null): number[][] {
    const behind = PROG.levels.map((): number[] => []);

    for (const byGate of [reach?.leads, reach?.pocket, reach?.lightLeads]) {
        byGate?.forEach((levelIndices, freezerIndex) => {
            levelIndices.forEach((i) => behind[i].push(freezerIndex));
        });
    }

    return behind;
}

/**
 * The levels the walk cannot reach: why (per level, the gates and mechanics that may still lead in), wayInOf() (per
 * level, its way-in gates under the current level roles, and per doorway among them the ways through it), wayInFixed
 * (the levels whose way in is the level data's alone) and ice (per level, the closed Freezer it is frozen in).
 * solved(i): whether level i is solved; unlocks: unlocksOf(); behind: gatesBehind(reach).
 */
export function wayInModel({
    levelFlags,
    solved,
    state,
    reach,
    unlocks,
    behind,
    gateOpen,
    towers,
}: {
    levelFlags: LevelFlags;
    solved: (level: number) => boolean;
    state: LevelState[];
    reach: Reachability | null;
    unlocks: LevelUnlocks[];
    behind: number[][];
    gateOpen: boolean[];
    towers: TowerProgress[];
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

    // a closed gate is no way into a level when what it still needs is the level itself, levels from which the walk
    // reaches the level without it, or levels whose own requirements need the level
    const inner = (freezerIndex: number, level: number, needing: Set<number>) =>
        needsOnly(freezerIndex, (j) => j === level || needing.has(j) || !!reach?.from.get(j)?.has(level));

    // why a level the walk cannot reach may still be: the closed gates that lead into its pocket (pad: those that lead
    // to a pad revealing one in the pocket, not into the pocket itself; via: the levels by such a pad) and the unmodelled
    // mechanics there; a level with neither has no known route
    const why = state.map((levelState, i): WhyBlocked | null => {
        if (levelState !== 'blocked' || !reach) return null;

        const needing = levelsNeeding(i);
        const gates = behind[i].filter((freezerIndex) => !inner(freezerIndex, i, needing));
        const viaPads = reach.viaPads.get(i);
        return {
            gates,
            pad: gates.filter((freezerIndex) => viaPads?.gates.includes(freezerIndex)),
            via: (viaPads?.levels || []).filter((j) => state[j] !== 'solved'),
            viaTowers: (viaPads?.towers || []).filter((tower) => !towers[tower].active),
            mech: MECHS.filter((mechanic, bit) => (reach.mech[i] >> bit) & 1),
        };
    });

    // wayIn: per level the walk cannot reach, the closed gates that are a way in: those leading into its pocket, else
    // (none leads in) the ones it sits behind from the start (the static roles), without the gates inner() rules out
    // (or, when that leaves none, with the ones it rules out only for a level that has a way in of its own); in the
    // endgame areas, which the walk does not find its way into, the level data's way-in gates stand in for those or fill
    // in where there are none (progress.json endgame_way_ins)
    const endgameWayIn = new Map(
        (PROG.endgame_way_ins || []).map(([level, gates, replace]): [number, { gates: number[]; replace: number }] => [
            level,
            { gates, replace },
        ]),
    );

    // inner() where a level the walk reaches the level from counts as a way in when it has a way in of its own, one
    // that is no gate of the level's pocket: the walk leads on from it to the level
    const innerWithoutLead = (freezerIndex: number, level: number, needing: Set<number>) => {
        const hasOwnWayIn = (j: number) => !!why[j]?.gates.some((gate) => !behind[level].includes(gate));
        const within = (j: number) => {
            if (j === level || needing.has(j)) return true;
            return !!reach?.from.get(j)?.has(level) && !hasOwnWayIn(j);
        };
        return needsOnly(freezerIndex, within);
    };

    const walkWayIn = (level: number) => {
        const needing = levelsNeeding(level);

        let closed = behind[level];
        if (!closed.length) {
            const behindFromStart = ROLE?.bg.l[level] || [];
            closed = behindFromStart.filter((freezerIndex) => !gateOpen[freezerIndex]);
        }

        const gates = closed.filter((freezerIndex) => !inner(freezerIndex, level, needing));
        if (gates.length) return gates;

        // none leads in: a gate that waits on a level with a way in of its own, from which the walk reaches this one,
        // is still a way in, through that level
        return closed.filter((freezerIndex) => !innerWithoutLead(freezerIndex, level, needing));
    };

    // the levels whose way in is the level data's alone (no levels by a pad either)
    const replacedLevels = [...endgameWayIn].filter(([, row]) => row.replace).map(([level]) => level);
    const wayInFixed = new Set(replacedLevels);

    // per level, the closed Freezer it is frozen in
    const ice = ICE.map((freezerIndex) => {
        if (freezerIndex === undefined || gateOpen[freezerIndex]) return undefined;
        return freezerIndex;
    });

    const gateMet = (freezer: Freezer, level: number) => gateOptionMet(freezer, level, levelFlags);

    // the doorways among a level's way-in gates, each with the ways through it whose gates beyond it inner() leaves; a
    // doorway with none left is no way in
    const chainsOf = (level: number, gates: number[]) => {
        const levelChains = new Map<number, number[][]>();
        const walkChains = reach?.chains.get(level);
        if (!walkChains) return { gates, levelChains };

        const needing = levelsNeeding(level);
        const kept = gates.filter((freezerIndex) => {
            const chains = walkChains.get(freezerIndex);
            if (!chains) return true;

            const open = chains.filter((chain) =>
                chain.every((gate) => gate === freezerIndex || !inner(gate, level, needing)),
            );
            if (open.length === 0) return false;
            levelChains.set(freezerIndex, open);
            return true;
        });
        return { gates: kept, levelChains };
    };

    // the way-in gates and their chains, less the gates whose requirements can be met only from behind them
    // (gatesBehindThemselves): a doorway loses the ways through such a gate, and once it has none it is no way in
    const wayInOf = () => {
        const wayInChains = state.map((): Map<number, number[][]> | null => null);
        const wayInAll = new Map<number, number[]>();
        const wayIn = state.map((levelState, i): number[] | null => {
            if (levelState !== 'blocked') return null;

            const table = endgameWayIn.get(i);
            const tableGates = table ? table.gates.filter((freezerIndex) => !gateOpen[freezerIndex]) : [];
            if (table?.replace) return tableGates;
            // the gates of a row that only fills in are all needed, besides the walk's way in
            if (tableGates.length) wayInAll.set(i, tableGates);
            const { gates, levelChains } = chainsOf(i, walkWayIn(i));
            if (!gates.length) return tableGates;
            if (levelChains.size) wayInChains[i] = levelChains;
            return gates;
        });
        const behindThemselves = gatesBehindThemselves({
            state,
            wayIn,
            chains: wayInChains,
            via: (level) => (wayInFixed.has(level) ? [] : why[level]?.via),
            ice,
            gateOpen,
            met: gateMet,
        });
        if (!behindThemselves.size) return { wayIn, wayInChains, wayInAll };

        const isOpenWay = (chain: number[]) => chain.every((freezerIndex) => !behindThemselves.has(freezerIndex));
        const keptChains = wayInChains.map((levelChains) => {
            if (!levelChains) return null;

            const kept = new Map<number, number[][]>();
            for (const [freezerIndex, chains] of levelChains) {
                const open = chains.filter(isOpenWay);
                if (open.length) kept.set(freezerIndex, open);
            }
            if (!kept.size) return null;
            return kept;
        });
        const keptWayIn = wayIn.map((gates, i) => {
            if (!gates) return null;

            const levelChains = keptChains[i];
            return gates.filter((freezerIndex) => {
                if (behindThemselves.has(freezerIndex)) return false;
                if (!wayInChains[i]?.has(freezerIndex)) return true;
                return !!levelChains?.has(freezerIndex);
            });
        });
        return { wayIn: keptWayIn, wayInChains: keptChains, wayInAll };
    };

    return { why, wayInOf, wayInFixed, ice };
}

/**
 * Per level the walk cannot reach on a layer where it reaches nothing (sky, underworld), that layer; else the sky,
 * when the walk reaches nothing there and the level data enters the level from the sky.
 */
export function accessOf(state: LevelState[], reach: Reachability | null): Array<string | null> {
    const layers = PROG.map?.layers || [];
    const layerReached = new Map(
        layers.map((layer): [string, boolean] => [layer.key, !!reach?.cols[layer.key]?.some((value) => value)]),
    );
    return state.map((levelState, i) => {
        if (levelState !== 'blocked') return null;

        const z = PROG.levels[i].p[2];
        const layer = layers.find((candidate) => z >= candidate.z[0] && z < candidate.z[1]);
        if (layer && layer.key !== 'ground' && !layerReached.get(layer.key)) return layer.key;
        if (PROG.levels[i].drop !== undefined && !layerReached.get('sky')) return 'sky';
        return null;
    });
}

/** Whether closed gate `freezer` waits on the Sign `pid`: it lists it and no other option opens the gate. */
function gateNeedsSign(freezer: Freezer, pid: number): boolean {
    if (freezer.or && optionCount(freezer) > 1) return false;
    return !!freezer.signs?.some((rule) => rule.pid === pid);
}

/**
 * Per Sign the hero cannot face yet, its way-in gates: the closed Freezers whose opening lets the walk face it
 * (`signBehind`), less the gates that wait on the Sign itself. A gate that waits on a level only the Sign leads to is
 * not looked for; the plans leave a requirement that runs in a cycle without a plan.
 */
export function signWayInOf(
    reach: Pick<Reachability, 'signFaced' | 'signBehind'> | null,
    gateOpen: boolean[],
): number[][] {
    return (PROG.signs || []).map((sign, signIndex) => {
        if (!reach || reach.signFaced[signIndex]) return [];

        const closed = reach.signBehind[signIndex].filter((freezerIndex) => !gateOpen[freezerIndex]);
        return closed.filter((freezerIndex) => !gateNeedsSign(PROG.freezers[freezerIndex], sign.pid));
    });
}

/** Per Sign the hero cannot face yet on a layer where the walk reaches nothing (sky, underworld), that layer. */
export function signAccessOf(reach: Reachability | null): Array<string | null> {
    const layers = PROG.map?.layers || [];
    return (PROG.signs || []).map((sign, i) => {
        if (!reach || reach.signFaced[i]) return null;

        const z = sign.p[2];
        const layer = layers.find((candidate) => z >= candidate.z[0] && z < candidate.z[1]);
        if (!layer || layer.key === 'ground') return null;
        if (reach.cols[layer.key]?.some((value) => value)) return null;
        return layer.key;
    });
}
