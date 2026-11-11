// The Freezers a level sits behind, read from the level table's needs (viewer.md "Ways in and leads")
import { PROG } from '../data.ts';
import type { Freezer, Position, ProgressLevel } from '../types.ts';
import { wrapDelta } from './layers.ts';

/** What the Freezers a level sits behind are worked out from. */
export interface FreezerWorld {
    levels: ReadonlyArray<Pick<ProgressLevel, 'p' | 'needs'>>;
    freezers: ReadonlyArray<Pick<Freezer, 'p' | 'req'>>;
    /** The wrap widths for x and y; without them positions do not wrap. */
    gridSize?: readonly number[];
}

/** Per level, per group of its needs, per need of the group, the Freezer the need stands for; undefined for none. */
export type NeedFreezers = Array<Array<Array<number | undefined>>>;

/** What a save says about the levels and Freezers. */
export interface BehindState {
    levelReached: readonly boolean[];
    levelSolved: (level: number) => boolean;
    gateOpen: readonly boolean[];
}

// the squared distance in x and y between two positions on the wrapping map
function squaredDistance(world: FreezerWorld, from: Position, to: Position): number {
    let dx = to[0] - from[0];
    let dy = to[1] - from[1];
    if (world.gridSize) {
        dx = wrapDelta(dx, world.gridSize[0]);
        dy = wrapDelta(dy, world.gridSize[1]);
    }
    return dx * dx + dy * dy;
}

/** The Freezers each level opens: per level, the Freezers that list it among their openers. */
function openedBy(world: FreezerWorld): number[][] {
    const opened = world.levels.map((): number[] => []);
    world.freezers.forEach((freezer, freezerIndex) => {
        for (const level of freezer.req) opened[level].push(freezerIndex);
    });
    return opened;
}

/**
 * Per level and need, the Freezer the need stands for: of the Freezers the need's level opens, the one nearest to the
 * level (wrapped distance in x and y; the lowest index on a tie). A Sign need, or a level that opens none, stands for none.
 */
export function needFreezersOf(world: FreezerWorld): NeedFreezers {
    const opened = openedBy(world);

    return world.levels.map((level) => {
        const groups = level.needs ?? [];
        return groups.map((group) =>
            group.map((need): number | undefined => {
                if (!('level' in need)) return undefined;

                let nearest: number | undefined;
                let nearestSquared = Infinity;
                for (const freezerIndex of opened[need.level]) {
                    const squared = squaredDistance(world, level.p, world.freezers[freezerIndex].p);
                    if (squared < nearestSquared) {
                        nearest = freezerIndex;
                        nearestSquared = squared;
                    }
                }
                return nearest;
            }),
        );
    });
}

/** A closed Freezer that an unmet need stands for, and the level that need asks for. */
interface ClosedGate {
    freezer: number;
    opener: number;
}

/** The unmet needs of one level: the closed Freezers they stand for and the unreached levels they ask for. */
interface UnmetNeeds {
    gates: ClosedGate[];
    levels: number[];
}

// per state, the unmet needs worked out so far, by level; a state does not change while it is read
const unmetCaches = new WeakMap<BehindState, Array<UnmetNeeds | undefined>>();

// the unmet needs of one level, worked out once per state
function unmetNeedsOf(world: FreezerWorld, choice: NeedFreezers, state: BehindState, level: number): UnmetNeeds {
    let cache = unmetCaches.get(state);
    if (!cache) {
        cache = Array.from({ length: world.levels.length }, (): UnmetNeeds | undefined => undefined);
        unmetCaches.set(state, cache);
    }

    let unmet = cache[level];
    if (!unmet) {
        unmet = computeUnmetNeeds(world, choice, state, level);
        cache[level] = unmet;
    }
    return unmet;
}

// the closed Freezers the unmet needs of one level stand for, and the unreached levels those needs ask for; a group with
// a solved need is met and adds nothing
function computeUnmetNeeds(world: FreezerWorld, choice: NeedFreezers, state: BehindState, level: number): UnmetNeeds {
    const gates: ClosedGate[] = [];
    const levels: number[] = [];
    const groups = world.levels[level].needs ?? [];

    groups.forEach((group, groupIndex) => {
        const met = group.some((need) => 'level' in need && state.levelSolved(need.level));
        if (met) return;

        group.forEach((need, needIndex) => {
            if (!('level' in need)) return;

            const freezerIndex = choice[level][groupIndex][needIndex];
            if (freezerIndex !== undefined && !state.gateOpen[freezerIndex]) {
                gates.push({ freezer: freezerIndex, opener: need.level });
            }
            if (!state.levelReached[need.level]) levels.push(need.level);
        });
    });
    return { gates, levels };
}

const ascending = (first: number, second: number): number => first - second;

/**
 * Per level not reached, the closed Freezers its own unmet needs stand for, ascending: what opening a Freezer leads the
 * hero into next.
 */
export function directGatesOf(world: FreezerWorld, choice: NeedFreezers, state: BehindState): number[][] {
    return world.levels.map((_, level) => {
        if (state.levelReached[level]) return [];

        const unmet = unmetNeedsOf(world, choice, state, level);
        const gates = new Set(unmet.gates.map((gate) => gate.freezer));
        return [...gates].toSorted(ascending);
    });
}

/**
 * Per level not reached, the closed Freezers the hero can act on next, ascending: the walk back along its unmet needs
 * through unreached levels keeps the closed Freezers whose opener level (the need's level) is reached. When there are
 * none, the closed Freezers the walk meets first.
 */
export function gatesBehindOf(world: FreezerWorld, choice: NeedFreezers, state: BehindState): number[][] {
    return world.levels.map((_, start) => {
        if (state.levelReached[start]) return [];

        const frontier = new Set<number>();
        let nearest: Set<number> | undefined;
        const seen = new Set<number>([start]);
        let layer = [start];

        while (layer.length > 0) {
            const layerGates = new Set<number>();
            const next: number[] = [];
            for (const level of layer) {
                const unmet = unmetNeedsOf(world, choice, state, level);
                for (const gate of unmet.gates) {
                    layerGates.add(gate.freezer);
                    if (state.levelReached[gate.opener]) frontier.add(gate.freezer);
                }
                for (const needed of unmet.levels) {
                    if (seen.has(needed)) continue;

                    seen.add(needed);
                    next.push(needed);
                }
            }
            if (nearest === undefined && layerGates.size > 0) nearest = layerGates;
            layer = next;
        }

        const kept = frontier.size > 0 ? frontier : (nearest ?? new Set<number>());
        return [...kept].toSorted(ascending);
    });
}

let needFreezers: NeedFreezers | undefined;

/** The Freezers the level table's needs stand for (needFreezersOf over the level data), worked out on first use. */
export function tableNeedFreezers(): NeedFreezers {
    needFreezers ??= needFreezersOf(tableWorld());
    return needFreezers;
}

/** The level data as a FreezerWorld. */
export function tableWorld(): FreezerWorld {
    return { levels: PROG.levels, freezers: PROG.freezers, gridSize: (PROG.world?.grid || PROG.map)?.size };
}
