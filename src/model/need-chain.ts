// The chain of table needs behind a level, followed back to the hero's start or to where the table stops
// (VIEWER.md "Level needs and pad routes")
import type { Freezer, Position, ProgressLevel, RouteNeed, Sign } from '../types.ts';
import { needMet } from './route-needs.ts';
import type { NeedsView } from './route-needs.ts';

/** A level (by index) or a position. */
export type ChainEnd = number | Position;

/** What the chain is built over: the table's rows and where the hero starts. */
export interface ChainWorld {
    levels: ProgressLevel[];
    freezers: Freezer[];
    signs: Sign[];
    start: Position | undefined;
}

/** One need of the chain: a line from where it stands to what it opens. */
export interface ChainEdge {
    from: ChainEnd;
    to: ChainEnd;
    met: boolean;
}

/** Where the chain ends without reaching the start. */
export type ChainStop =
    | { reason: 'unknown'; level: number }
    | { reason: 'cycle'; level: number }
    | { reason: 'sign'; sign: number }
    | { reason: 'rock'; rock: number; at: ChainEnd }
    | { reason: 'freezer'; freezer: number };

/** The chain behind one level. `reachesStart` is true when a line runs from the start and no branch stops short. */
export interface NeedChain {
    edges: ChainEdge[];
    stops: ChainStop[];
    levels: number[];
    freezers: number[];
    signs: number[];
    reachesStart: boolean;
}

/** Where a stop stands. */
export function stopEnd(world: ChainWorld, stop: ChainStop): ChainEnd {
    if (stop.reason === 'unknown' || stop.reason === 'cycle') return stop.level;
    if (stop.reason === 'sign') return world.signs[stop.sign].p;
    if (stop.reason === 'rock') return stop.at;
    return world.freezers[stop.freezer].p;
}

interface Follow {
    world: ChainWorld;
    view: NeedsView;
    chain: NeedChain;
    /** The levels on the way from the first level to the one being followed. */
    path: Set<number>;
    levelsDone: Set<number>;
    freezersDone: Set<number>;
}

// the option the save meets, else the first
function optionOf(options: RouteNeed[], view: NeedsView): RouteNeed {
    return options.find((need) => needMet(need, view)) ?? options[0];
}

function followNeed(follow: Follow, need: RouteNeed, to: ChainEnd): void {
    const { world, view, chain } = follow;
    const met = needMet(need, view);

    if ('level' in need) {
        chain.edges.push({ from: need.level, to, met });
        if (follow.path.has(need.level)) {
            chain.stops.push({ reason: 'cycle', level: need.level });
        } else {
            followLevel(follow, need.level);
        }
    } else if ('freezer' in need) {
        chain.edges.push({ from: world.freezers[need.freezer].p, to, met });
        followFreezer(follow, need.freezer);
    } else if ('sign' in need) {
        chain.edges.push({ from: world.signs[need.sign].p, to, met });
        if (!chain.signs.includes(need.sign)) chain.signs.push(need.sign);
        chain.stops.push({ reason: 'sign', sign: need.sign });
    } else {
        chain.stops.push({ reason: 'rock', rock: need.rock, at: to });
    }
}

function followLevel(follow: Follow, levelIndex: number): void {
    if (follow.levelsDone.has(levelIndex)) return;

    const { world, chain } = follow;
    follow.levelsDone.add(levelIndex);
    follow.path.add(levelIndex);
    chain.levels.push(levelIndex);

    const level = world.levels[levelIndex];
    if (level.needs === undefined) {
        chain.stops.push({ reason: 'unknown', level: levelIndex });
    } else if (level.needs.length === 0) {
        if (world.start) {
            chain.edges.push({ from: world.start, to: levelIndex, met: true });
            chain.reachesStart = true;
        }
    } else {
        for (const group of level.needs) {
            if (group.length === 0) {
                chain.stops.push({ reason: 'unknown', level: levelIndex });
                continue;
            }

            followNeed(follow, optionOf(group, follow.view), levelIndex);
        }
    }

    follow.path.delete(levelIndex);
}

// the levels and Signs that open a Freezer: all of them, or the one that holds when any one opens it
function followFreezer(follow: Follow, freezerIndex: number): void {
    if (follow.freezersDone.has(freezerIndex)) return;

    const { world, chain } = follow;
    follow.freezersDone.add(freezerIndex);
    chain.freezers.push(freezerIndex);

    const freezer = world.freezers[freezerIndex];
    const options: RouteNeed[] = freezer.req.map((level): RouteNeed => ({ level }));

    for (const freezerSign of freezer.signs ?? []) {
        const sign = world.signs.findIndex((candidate) => candidate.pid === freezerSign.pid);
        if (sign >= 0) options.push({ sign });
    }

    if (options.length === 0) {
        chain.stops.push({ reason: 'freezer', freezer: freezerIndex });
        return;
    }

    let followed = options;
    if (freezer.or && options.length > 1) followed = [optionOf(options, follow.view)];
    for (const need of followed) followNeed(follow, need, freezer.p);
}

/**
 * Follows the needs of a level back, level by level and through a Freezer's openers, until an entry with no needs,
 * which a line joins to the start. In a group of alternatives it follows the one the save meets, else the first. It
 * stops at a level with no entry, a Sign, a Rock, a Freezer nothing opens and a level already on the way back.
 */
export function needChain(world: ChainWorld, view: NeedsView, levelIndex: number): NeedChain {
    const chain: NeedChain = {
        edges: [],
        stops: [],
        levels: [],
        freezers: [],
        signs: [],
        reachesStart: false,
    };

    const follow: Follow = {
        world,
        view,
        chain,
        path: new Set(),
        levelsDone: new Set(),
        freezersDone: new Set(),
    };

    followLevel(follow, levelIndex);
    if (chain.stops.length > 0) chain.reachesStart = false;
    return chain;
}
