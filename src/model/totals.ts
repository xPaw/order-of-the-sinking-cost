// The totals the page shows: treasures, Freezers, signs, fast-travel pads, voice logs, map scrolls and Area_Pins, each
// over the things not under fog or already found; and the gold rooms the map rings, with spoilers hidden only once
// visited
// (PROGRESSION.md "Treasures and gold rooms", "In-game progress displays")
import { PROG } from '../data.ts';
import { latestFlag } from '../save.ts';
import type { AreaPinRow, GoldRoom, Position, Teleporter, TreasureDisplay, ViewGiver, VoiceLog } from '../types.ts';
import { isDoorway } from './freezer-names.ts';
import { AREA_LAYERS, FOG_LAYER_KEYS, layerName, mapLayerOf } from './layers.ts';
import type { BaseProgress } from './progress.ts';
import { signStateOf } from './unlocking.ts';
import type { SignState } from './unlocking.ts';
import { indicesWhere } from '../util.ts';

/** Whether a thing at a position on a layer (the layer key, undefined for none) is not under fog. */
export type ShownAt = (layer: string | undefined, position: Position) => boolean;

/** Found and total. */
export type FoundOfTotal = [found: number, total: number];

/** A thing a total counts: its layer key (undefined off the map layers) and whether it is found. */
export type LayerMark = [layer: string | undefined, found: boolean];

/** Per total, the things it counts. */
export type TotalsMarks = Record<keyof TotalsByLayer, LayerMark[]>;

/** The per layer counts of each total, as the page shows them ("Ground 70 / 90 · Sky 17 / 35"). */
export interface TotalsByLayer {
    treasures: string;
    pods: string;
    doorways: string;
    signs: string;
    tps: string;
    towerPads: string;
    minorPads: string;
    logs: string;
    maps: string;
    pins: string;
}

export interface TotalsStats {
    treasures: FoundOfTotal;
    pods: FoundOfTotal;
    doorways: FoundOfTotal;
    /** The signs read over the signs shown. */
    signs: FoundOfTotal;
    /** The shown signs whose rule holds and are not read yet. */
    signsReady: number;
    tps: FoundOfTotal;
    /** The discovered pads of the towers that have one, over those not under fog, with the gold rooms' endpoints. */
    towerPads: FoundOfTotal;
    /** The discovered MINOR pads that are neither a tower's nor a gold room's, over those shown. */
    minorPads: FoundOfTotal;
    by: TotalsByLayer;
    logs: FoundOfTotal;
    /** The map scrolls taken over the map scrolls shown. */
    maps: FoundOfTotal;
    /** The Area_Pins activated over the Area_Pins shown. */
    pins: FoundOfTotal;
}

export interface TreasureTotals {
    plinths: TreasureDisplay[];
    total: number;
    got: number;
}

export interface Totals {
    teleporters: Teleporter[];
    padDisc: (teleporter: number) => boolean;
    gates: number[];
    pads: number[];
    /** The MINOR world pads that are neither a tower's nor a gold room's, not under fog or discovered. */
    minorPads: number[];
    rooms: GoldRoom[];
    treasures: TreasureTotals;
    stats: TotalsStats;
    marks: TotalsMarks;
    /** The layers of the shown signs whose rule holds and are not read yet. */
    readySignLayers: Array<string | undefined>;
    logs: number[];
    maps: number[];
    pins: AreaPinRow[];
    heard: (log: VoiceLog) => boolean;
    taken: (giver: ViewGiver) => boolean;
}

function popcount(value: number): number {
    let remaining = value >>> 0;
    let count = 0;
    while (remaining) {
        remaining &= remaining - 1;
        count++;
    }

    return count;
}

const layerKey = (thing: { l: number }): string | undefined => FOG_LAYER_KEYS[thing.l];

/**
 * "Ground 70 / 90 · Sky 17 / 35" per total, over the layers the fog has uncovered (`known`, null when nothing is
 * hidden), the things off the map layers as Elsewhere.
 */
export function layerSplit(list: LayerMark[], known: string[] | null): string {
    const parts: string[] = [];
    for (const layer of [...AREA_LAYERS, 'other']) {
        const things = list.filter(([thingLayer]) => (thingLayer || 'other') === layer);
        if (things.length === 0) continue;
        if (known && layer !== 'other' && !known.includes(layer)) continue;

        const found = things.filter(([, thingFound]) => thingFound).length;
        const name = layer === 'other' ? 'Elsewhere' : layerName(layer);
        parts.push(`${name} ${found} / ${things.length}`);
    }

    return parts.join(' · ');
}

/** Found and total of the things. */
export function countOf(list: LayerMark[]): FoundOfTotal {
    const found = list.filter(([, thingFound]) => thingFound).length;
    return [found, list.length];
}

/** The totals the page shows; shownAt(key, p): whether a thing at p on layer key is not under fog. */
export function totalsOf({
    status,
    progress,
    hide,
    shownAt,
    known,
    towerHidden = [],
    pinsOn = new Set(),
}: {
    status: { treasureFlags: number };
    progress: BaseProgress;
    hide: boolean;
    shownAt: ShownAt;
    known: string[] | null;
    towerHidden?: boolean[];
    /** The activated Area_Pins. */
    pinsOn?: Set<number>;
}): Totals {
    const teleporters = PROG.teleporters || [];
    const teleporterIndex = new Map(teleporters.map((teleporter, i): [number, number] => [teleporter.pid, i]));
    const padDisc = (padIndex: number): boolean => {
        if (progress.tst[padIndex].disc) return true;
        const targetIndex = teleporterIndex.get(teleporters[padIndex].target);
        return targetIndex !== undefined && progress.tst[targetIndex].disc;
    };

    const gates = indicesWhere(PROG.freezers, (freezer) => !freezer.judge && shownAt(layerKey(freezer), freezer.p));

    const pads = indicesWhere(teleporters, (teleporter, i) => {
        if (!teleporter.major || !layerKey(teleporter)) return false;
        return padDisc(i) || shownAt(layerKey(teleporter), teleporter.p);
    });

    // the MINOR pads that hop across the map: a MINOR pad is discovered on its own, whatever its target
    const towerPadSet = new Set(progress.towers.map((tower) => tower.pad));
    const minorPadFound = (padIndex: number): boolean => progress.tst[padIndex].disc;
    const minorPads = indicesWhere(teleporters, (teleporter, i) => {
        const layer = layerKey(teleporter);
        if (teleporter.major || teleporter.gold || towerPadSet.has(i) || !layer) return false;
        return minorPadFound(i) || shownAt(layer, teleporter.p);
    });

    // with spoilers hidden a gold room is known only once visited: before that its endpoint is a pad like any other
    const rooms = (PROG.gold_rooms || []).filter((room) => {
        const endpoint = teleporters[room.endpoint];
        return endpoint && layerKey(endpoint) && (progress.tst[room.endpoint].disc || !hide);
    });

    // plinth i shows a treasure while more than i treasures are collected
    const gotCount = popcount(status.treasureFlags);
    const treasureDisplays = PROG.treasure_displays;
    const plinths =
        treasureDisplays && PROG.map
            ? treasureDisplays.filter((display) => display.i < gotCount || shownAt(mapLayerOf(display.p[2]), display.p))
            : [];
    const treasures = {
        plinths,
        total: treasureDisplays ? plinths.length : PROG.treasures || 0,
        got: treasureDisplays
            ? plinths.filter((display) => display.i < gotCount).length
            : Math.min(gotCount, PROG.treasures || 0),
    };

    // the Freezers by model, each its own row: the pods (ice cages) and the doorways (ice gates)
    const pods = gates.filter((freezerIndex) => !isDoorway(freezerIndex));
    const doorways = gates.filter((freezerIndex) => isDoorway(freezerIndex));

    // the signs that open Freezers, under the same fog rule as the Freezers; the tower status signs open none
    const allSigns = PROG.signs || [];
    const openers = indicesWhere(allSigns, (sign) => !sign.status);
    const signs = openers.filter((i) => shownAt(layerKey(allSigns[i]), allSigns[i].p));

    // voice logs and map scrolls: shown when not under fog or already found
    const voiceLogs = PROG.voice_logs || [];
    const viewGivers = PROG.view_givers || [];
    const heard = (log: VoiceLog) => latestFlag(progress.lt, log.pid, 'played', log.d);
    const taken = (giver: ViewGiver) => {
        const order = progress.lt?.get(giver.pid, 'activation_order');
        return !!order && order.some((value) => value);
    };

    // two logs sit on the fast-travel screen, off the world map: they count once found, or when nothing is hidden
    const logs = indicesWhere(voiceLogs, (log) => {
        if (heard(log)) return true;

        const logLayer = FOG_LAYER_KEYS[log.l];
        return logLayer ? shownAt(logLayer, log.p) : !hide;
    });

    const maps = indicesWhere(viewGivers, (giver) => taken(giver) || shownAt(FOG_LAYER_KEYS[giver.l], giver.p));

    // Area_Pins: shown when not under fog or already activated
    const pinOn = ([pid]: AreaPinRow): boolean => pinsOn.has(pid);
    const pinLayer = ([, , , z]: AreaPinRow): string => mapLayerOf(z);
    const pins = (PROG.world?.area_pins || []).filter((pin) => {
        const [, x, y, z] = pin;
        return pinOn(pin) || shownAt(pinLayer(pin), [x, y, z]);
    });

    // the towers with a pad of their own that are not under fog
    const padTowers = indicesWhere(
        progress.towers,
        (tower, towerIndex) => tower.pad !== undefined && !towerHidden[towerIndex],
    );
    const towerPadFound = (towerIndex: number): boolean => {
        const pad = progress.towers[towerIndex].pad;
        return pad !== undefined && padDisc(pad);
    };
    const towerPadLayer = (towerIndex: number): string | undefined => {
        const pad = progress.towers[towerIndex].pad;
        if (pad === undefined) return undefined;
        return layerKey(teleporters[pad]);
    };
    const roomVisited = (room: GoldRoom): boolean => progress.tst[room.endpoint].disc;

    const freezerMarks = (indices: number[]) =>
        indices.map((freezerIndex): LayerMark => [
            layerKey(PROG.freezers[freezerIndex]),
            progress.gateOpen[freezerIndex],
        ]);
    const signState = (signIndex: number): SignState => signStateOf(progress, allSigns[signIndex]);
    const signMet = (signIndex: number): boolean => signState(signIndex) === 'read';
    const signReady = (signIndex: number): boolean => signState(signIndex) === 'ready';
    const marks: TotalsMarks = {
        treasures: plinths.map((display): LayerMark => [mapLayerOf(display.p[2]), display.i < gotCount]),
        pods: freezerMarks(pods),
        doorways: freezerMarks(doorways),
        signs: signs.map((i): LayerMark => [layerKey(allSigns[i]), signMet(i)]),
        tps: pads.map((i): LayerMark => [layerKey(teleporters[i]), padDisc(i)]),
        towerPads: [
            ...padTowers.map((i): LayerMark => [towerPadLayer(i), towerPadFound(i)]),
            ...rooms.map((room): LayerMark => [layerKey(teleporters[room.endpoint]), roomVisited(room)]),
        ],
        minorPads: minorPads.map((i): LayerMark => [layerKey(teleporters[i]), minorPadFound(i)]),
        logs: logs.map((i): LayerMark => [FOG_LAYER_KEYS[voiceLogs[i].l], heard(voiceLogs[i])]),
        maps: maps.map((i): LayerMark => [FOG_LAYER_KEYS[viewGivers[i].l], taken(viewGivers[i])]),
        pins: pins.map((pin): LayerMark => [pinLayer(pin), pinOn(pin)]),
    };
    const readySignLayers = signs.filter(signReady).map((i) => layerKey(allSigns[i]));

    const split = (list: LayerMark[]) => layerSplit(list, known);
    const stats: TotalsStats = {
        treasures: [treasures.got, treasures.total],
        pods: countOf(marks.pods),
        doorways: countOf(marks.doorways),
        signs: countOf(marks.signs),
        signsReady: readySignLayers.length,
        tps: countOf(marks.tps),
        towerPads: countOf(marks.towerPads),
        minorPads: countOf(marks.minorPads),
        maps: countOf(marks.maps),
        pins: countOf(marks.pins),
        by: {
            treasures: split(marks.treasures),
            pods: split(marks.pods),
            doorways: split(marks.doorways),
            signs: split(marks.signs),
            tps: split(marks.tps),
            towerPads: split(marks.towerPads),
            minorPads: split(marks.minorPads),
            logs: split(marks.logs),
            maps: split(marks.maps),
            pins: split(marks.pins),
        },
        logs: countOf(marks.logs),
    };

    return {
        teleporters,
        padDisc,
        gates,
        pads,
        minorPads,
        rooms,
        treasures,
        stats,
        marks,
        readySignLayers,
        logs,
        maps,
        pins,
        heard,
        taken,
    };
}
