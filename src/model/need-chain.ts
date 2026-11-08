// The chain of table needs behind a level or Freezer, followed back to the middle of the map or to where the table stops
// (VIEWER.md "Level needs and pad routes")
import type { Freezer, GoldRoom, Position, ProgressLevel, RouteNeed, Sign, Tower } from '../types.ts';
import { needMet } from './route-needs.ts';
import type { NeedsView } from './route-needs.ts';

/** A level (by index) or a position. */
export type ChainEnd = number | Position;

/** What a chain is followed back from. */
export type ChainTarget = { level: number } | { freezer: number } | { sign: number };

/** What the chain is built over: the table's rows and the pad each map layer's lines start from. */
export interface ChainWorld {
    levels: ProgressLevel[];
    freezers: Freezer[];
    signs: Sign[];
    towers: Tower[];
    goldRooms: GoldRoom[];
    layerOf: (z: number) => string;
    hubs: Map<string, Position>;
    shown: (need: RouteNeed) => boolean;
    towerShown: (tower: number) => boolean;
    dropShown: (at: Position) => boolean;
    /** Follows every option of a group of alternatives, not the one the save meets. */
    allOptions?: boolean;
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
    | { reason: 'freezer'; freezer: number };

/** The chain behind its targets. */
export interface NeedChain {
    edges: ChainEdge[];
    stops: ChainStop[];
    levels: number[];
    freezers: number[];
    signs: number[];
    /** The holes the hero drops through. */
    drops: Position[];
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

// the shown option the save meets, else the first one shown
function optionOf(follow: Follow, options: RouteNeed[]): RouteNeed {
    const shown = options.filter((need) => follow.world.shown(need));
    return shown.find((need) => needMet(need, follow.view)) ?? shown[0] ?? options[0];
}

// the options of a group of alternatives to follow: all of them, or the one that holds
function optionsOf(follow: Follow, options: RouteNeed[]): RouteNeed[] {
    if (follow.world.allOptions) return options;
    return [optionOf(follow, options)];
}

function endLayer(world: ChainWorld, end: ChainEnd): string {
    if (typeof end === 'number') return world.layerOf(world.levels[end].p[2]);
    return world.layerOf(end[2]);
}

// A need of a level entered by a drop is met at the hole. The map draws a line on one layer only, so a need on another
// layer runs to its layer's hub and on from the hub of the layer it opens. High and Low are entered at their hubs, so a
// need of theirs on another layer ends at the hub: returns whether the line ended there.
function addLine(world: ChainWorld, chain: NeedChain, from: ChainEnd, to: ChainEnd, met: boolean): boolean {
    let end = to;
    if (typeof to === 'number') end = world.levels[to].drop ?? to;

    const fromLayer = endLayer(world, from);
    const toLayer = endLayer(world, end);
    const fromHub = world.hubs.get(fromLayer);
    const toHub = world.hubs.get(toLayer);

    if (fromLayer === toLayer || !fromHub || !toHub) {
        chain.edges.push({ from, to: end, met });
        return false;
    }

    if (toLayer !== 'ground') {
        chain.edges.push({ from: toHub, to: end, met });
        return true;
    }

    chain.edges.push({ from, to: fromHub, met });
    chain.edges.push({ from: toHub, to: end, met });
    return false;
}

// a need under fog ends the chain with no line; a met need gets its line and nothing behind it
function followNeed(follow: Follow, need: RouteNeed, to: ChainEnd): void {
    const { world, view, chain } = follow;
    if (!world.shown(need)) return;

    const met = needMet(need, view);

    if ('level' in need) {
        if (addLine(world, chain, need.level, to, met)) return;
        if (met) {
            if (!chain.levels.includes(need.level)) chain.levels.push(need.level);
        } else if (follow.path.has(need.level)) {
            chain.stops.push({ reason: 'cycle', level: need.level });
        } else {
            followLevel(follow, need.level);
        }
    } else {
        const atHub = addLine(world, chain, world.signs[need.sign].p, to, met);
        if (!atHub && !met) followSign(follow, need.sign);
    }
}

// all the needs, or the one that holds when any one is enough
function followAll(follow: Follow, needs: RouteNeed[], anyOne: boolean, to: ChainEnd): void {
    let followed = needs;
    if (anyOne && needs.length > 1) followed = optionsOf(follow, needs);
    for (const need of followed) followNeed(follow, need, to);
}

// the towers a Sign's rule counts: its own, or the ground towers of the gold rooms
function signTowers(world: ChainWorld, sign: Sign): number[] {
    if (sign.tower !== undefined) return [sign.tower];
    if (sign.gold) return world.goldRooms.map((room) => room.tower);
    return [];
}

// a Sign that counts towers follows them to the hub; any other Sign ends the chain
function followSign(follow: Follow, signIndex: number): void {
    const { world, chain } = follow;
    if (chain.signs.includes(signIndex)) return;
    chain.signs.push(signIndex);

    const sign = world.signs[signIndex];
    const towers = signTowers(world, sign);
    if (towers.length === 0) {
        chain.stops.push({ reason: 'sign', sign: signIndex });
        return;
    }

    for (const tower of towers) {
        if (!world.towerShown(tower)) continue;

        const towerAt = world.towers[tower].p;
        if (addLine(world, chain, towerAt, sign.p, false)) continue;

        const hub = world.hubs.get(endLayer(world, towerAt));
        if (hub) chain.edges.push({ from: hub, to: towerAt, met: true });
    }
}

function followLevel(follow: Follow, levelIndex: number): void {
    if (follow.levelsDone.has(levelIndex)) return;

    const { world, chain } = follow;
    follow.levelsDone.add(levelIndex);
    chain.levels.push(levelIndex);

    const level = world.levels[levelIndex];
    if (level.drop !== undefined) {
        if (!world.dropShown(level.drop)) return;
        chain.drops.push(level.drop);
    }

    follow.path.add(levelIndex);
    if (level.needs === undefined) {
        // the table leaves the reach to the walk: the levels that unlock the level are all that is known
        if (level.req.length === 0 || level.en) {
            chain.stops.push({ reason: 'unknown', level: levelIndex });
        } else {
            const unlockers = level.req.map((required): RouteNeed => ({ level: required }));
            followAll(follow, unlockers, Boolean(level.or), levelIndex);
        }
    } else if (level.needs.length === 0) {
        const hub = world.hubs.get(endLayer(world, levelIndex));
        if (hub) chain.edges.push({ from: hub, to: levelIndex, met: true });
    } else {
        for (const group of level.needs) {
            if (group.length === 0) {
                chain.stops.push({ reason: 'unknown', level: levelIndex });
                continue;
            }

            for (const need of optionsOf(follow, group)) followNeed(follow, need, levelIndex);
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

    followAll(follow, options, Boolean(freezer.or), freezer.p);
}

/**
 * Follows the needs of a level back, level by level and through a Freezer's openers, until an entry with no needs,
 * which a line joins to its layer's hub. A level the table leaves to the walk is followed through the levels that unlock
 * it, unless the level data enables it without them. In a group of alternatives it follows the shown one the save
 * meets, else the first one shown. It goes through a Sign that counts towers to
 * those towers, which a line joins to the hub. It stops at a level with no needs and no unlocks, any other Sign, a
 * Freezer nothing opens and a level already on the way back.
 */
export function needChain(world: ChainWorld, view: NeedsView, ...targets: ChainTarget[]): NeedChain {
    const chain: NeedChain = {
        edges: [],
        stops: [],
        levels: [],
        freezers: [],
        signs: [],
        drops: [],
    };

    const follow: Follow = {
        world,
        view,
        chain,
        path: new Set(),
        levelsDone: new Set(),
        freezersDone: new Set(),
    };

    for (const target of targets) {
        if ('level' in target) followLevel(follow, target.level);
        else if ('freezer' in target) followFreezer(follow, target.freezer);
        else followSign(follow, target.sign);
    }

    return chain;
}
