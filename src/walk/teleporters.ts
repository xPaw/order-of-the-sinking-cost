// Teleporter states, the pads of a walker's grid and where they send the hero, and the pads a discovery reveals
// (movement.md "Teleporter pads and fast travel", state.md "Teleporters in the save", viewer.md "Pads revealed through
// the map rooms")
import { PROG } from '../data.ts';
import { latestF32, latestFlag } from '../save.ts';
import type { LatestValues } from '../save.ts';
import type { Position, Teleporter } from '../types.ts';
import { addTo, cellOf, FIRE, FROZEN_MARK, Z_BIAS } from './cells.ts';
import type { FloodState } from './flood.ts';
import { exists } from './groups.ts';
import { deep, layerOf } from './ocean.ts';
import { push } from './queue.ts';
import { LAYER_COUNT, PROTECTED } from './skills.ts';
import { blockedFrom, land, standable } from './support.ts';
import type { WalkGrid } from './walker.ts';

// the ground layers of the fast-travel map rooms start here; below are the world layers
export const MAP_ROOM_LAYER = 3;

/** A teleporter's state: enabled, and discovered. */
export interface TeleporterState {
    en: boolean;
    disc: boolean;
}

/** Per teleporter, its latest state, else its level-data one. */
export function teleporterStatesOf(latest: LatestValues | null): TeleporterState[] {
    return (PROG.teleporters || []).map((teleporter) => {
        const enabledByDefault = teleporter.en ? 1 : 0;
        return {
            en: latestF32(latest, teleporter.pid, 'enabled_t_target', enabledByDefault) > 0,
            disc: latestFlag(latest, teleporter.pid, 'discovered', teleporter.disc),
        };
    });
}

/**
 * Per teleporter, the indices of the other world-layer (0-2) pads its discovery reveals, ascending. Discovering a pad
 * discovers its target_id, then its also_discover pad, each with its own chain (a pad discovered already ends it),
 * then its also_discover2 pad alone (no chain).
 */
export function reveals(teleporters: Teleporter[]): number[][] {
    const indexOfPid = new Map<number, number>();
    teleporters.forEach((teleporter, index) => {
        indexOfPid.set(teleporter.pid, index);
    });

    const indexOf = (pid: number | undefined): number | undefined => {
        if (pid === undefined) return undefined;
        return indexOfPid.get(pid);
    };

    return teleporters.map((_, origin) => {
        const discovered = new Set<number>();
        const discover = (index: number | undefined): void => {
            if (index === undefined || discovered.has(index)) return;
            discovered.add(index);

            const pad = teleporters[index];
            discover(indexOf(pad.target));
            discover(indexOf(pad.also));
            const alsoSecond = indexOf(pad.also2);
            if (alsoSecond !== undefined) discovered.add(alsoSecond);
        };
        discover(origin);

        const worldPads = [...discovered].filter((index) => index !== origin && teleporters[index].l < MAP_ROOM_LAYER);
        return worldPads.toSorted((first, second) => first - second);
    });
}

/** Per world pad, the map-room pads that target it (its twins), in pad order; a pad without a twin has no entry. */
export function levelTwins(teleporters: Teleporter[], teleporterIndexOf: Map<number, number>): Map<number, number[]> {
    const twinsOf = new Map<number, number[]>();

    teleporters.forEach((teleporter, padIndex) => {
        const targetIndex = teleporterIndexOf.get(teleporter.target);
        if (teleporter.l >= MAP_ROOM_LAYER && targetIndex !== undefined) addTo(twinsOf, targetIndex, padIndex);
    });

    return twinsOf;
}

/** Places the existing pads by cell, and lists the enabled, discovered MAJOR ones. */
export function placePads(walkGrid: WalkGrid): void {
    const { teleporters, teleporterStates, geometry } = walkGrid;

    teleporters.forEach((teleporter, padIndex) => {
        if (exists(walkGrid, teleporter.pid, teleporter.ex)) {
            addTo(walkGrid.padsAt, geometry.padCells[padIndex], padIndex);
        }
    });

    const majorPads: number[] = [];
    teleporters.forEach((teleporter, padIndex) => {
        const state = teleporterStates[padIndex];
        if (teleporter.major && state.en && state.disc && exists(walkGrid, teleporter.pid, teleporter.ex)) {
            majorPads.push(padIndex);
        }
    });

    walkGrid.majorPads = majorPads;
}

/**
 * The cell a hero arriving by teleporter `padIndex` stands in; -1 while a closed Freezer holds the pad's cell: the
 * pad's move check fails there and the hero stays where he was.
 */
export function padCell(walkGrid: WalkGrid, floodState: FloodState, padIndex: number): number {
    const padAt = walkGrid.geometry.padCells[padIndex];
    if (padAt >= 0 && walkGrid.marks[padAt] & FROZEN_MARK) return -1;
    return land(walkGrid, floodState, padAt);
}

/**
 * The cell a pad sends a hero (walk layer `layer`) to at world point `point` (a Marker) stands in: the first
 * supported cell at or below it inside its ground layer (falls have no limit); -1 inside a wall, in water deeper than
 * 0.1 or in an attacked cell the hero has no PROTECTION for. The hero leaves from `padAt`, the pad's cell, so he
 * lands in a THROUGH beam's wall cell only from the beam.
 */
function dropCell(walkGrid: WalkGrid, floodState: FloodState, padAt: number, point: Position, layer: number): number {
    const markerCell = cellOf(walkGrid, ...point);
    if (markerCell < 0) return -1;

    const layerCells = walkGrid.layerCells;
    const groundLayer = layerOf(walkGrid, Math.floor(markerCell / layerCells) - Z_BIAS);
    let from = padAt;

    for (let cell = markerCell; cell >= layerCells; cell -= layerCells) {
        if (layerOf(walkGrid, Math.floor(cell / layerCells) - Z_BIAS) !== groundLayer) break;
        if (blockedFrom(walkGrid, floodState, from, cell)) return -1;
        from = cell;

        if (walkGrid.cellFlags[cell] & FIRE) {
            if (layer === PROTECTED) return cell;
            return -1;
        }

        if (deep(walkGrid, cell)) return -1;
        if (standable(walkGrid, floodState, cell)) return cell;
    }

    return -1;
}

/**
 * Whether pad `padIndex` is enabled in the flood: in the walk's teleporter states, or enabled by a MINOR pad's trip
 * to it earlier in the flood.
 */
function padEnabled(walkGrid: WalkGrid, floodState: FloodState, padIndex: number): boolean {
    return walkGrid.teleporterStates[padIndex].en || floodState.enabledPads.has(padIndex);
}

/**
 * Enables pad `padIndex` for the rest of the flood, as a trip to it does in the game. A hero already standing on it
 * from earlier in the flood walks on again, so that he takes the pad now.
 */
function enablePad(walkGrid: WalkGrid, floodState: FloodState, padIndex: number): void {
    if (padEnabled(walkGrid, floodState, padIndex)) return;

    floodState.enabledPads.add(padIndex);

    const padAt = walkGrid.geometry.padCells[padIndex];
    if (padAt < 0) return;

    // padStep takes the pads in the hero's cell and in the cell below it
    const visited = walkGrid.visited;
    for (const standingCell of [padAt, padAt + walkGrid.layerCells]) {
        for (let layer = 0; layer < LAYER_COUNT; layer++) {
            if (visited[standingCell] & (1 << layer)) floodState.queue.push(standingCell, layer);
        }
    }
}

/**
 * The cell a hero (walk layer `layer`) lands in when MINOR pad `padIndex` sends him: the cell of its target pad, else
 * the cell below its target point; -1 when he lands nowhere.
 */
export function minorLanding(walkGrid: WalkGrid, floodState: FloodState, padIndex: number, layer: number): number {
    const pad = walkGrid.teleporters[padIndex];

    const targetPad = walkGrid.teleporterIndexOf.get(pad.target);
    if (targetPad !== undefined) return padCell(walkGrid, floodState, targetPad);

    if (pad.to) return dropCell(walkGrid, floodState, walkGrid.geometry.padCells[padIndex], pad.to, layer);

    return -1;
}

/**
 * A hero (walk layer `layer`) on pad `padIndex`: an enabled pad reaches the pads its discovery reveals, and sends the
 * hero on: a discovered MAJOR pad to every enabled, discovered MAJOR pad, a MINOR pad to its target pad or point. A
 * MINOR pad's trip enables its target pad, which was disabled until then. A pad's trip keeps the hero's walk layer.
 * A hero holding a skill (a layer but 0) takes a MAJOR pad only to the world pads of its `skillTrips`.
 */
function usePad(walkGrid: WalkGrid, floodState: FloodState, padIndex: number, layer: number): void {
    const { teleporters, teleporterStates, teleporterIndexOf } = walkGrid;
    if (!padEnabled(walkGrid, floodState, padIndex)) return;

    const skillTrips = layer === 0 ? undefined : walkGrid.skillTrips[padIndex];

    if (floodState.reveal) {
        for (const revealed of walkGrid.revealedPads[padIndex]) {
            if (skillTrips && !skillTrips.has(revealed)) continue;
            push(walkGrid, floodState, padCell(walkGrid, floodState, revealed), layer);
        }
    }

    const pad = teleporters[padIndex];

    if (pad.major) {
        if (!teleporterStates[padIndex].disc) return;

        if (skillTrips) {
            for (const majorPad of walkGrid.majorPads) {
                if (skillTrips.has(majorPad))
                    push(walkGrid, floodState, padCell(walkGrid, floodState, majorPad), layer);
            }

            return;
        }

        if (!floodState.majorDone[layer]) {
            floodState.majorDone[layer] = true;

            for (const majorPad of walkGrid.majorPads) {
                push(walkGrid, floodState, padCell(walkGrid, floodState, majorPad), layer);
            }
        }

        return;
    }

    const landing = minorLanding(walkGrid, floodState, padIndex, layer);
    const targetPad = teleporterIndexOf.get(pad.target);
    if (targetPad !== undefined && landing >= 0) enablePad(walkGrid, floodState, targetPad);

    push(walkGrid, floodState, landing, layer);
}

/**
 * Takes the pads in `cell` and in the cell below it, but not one frozen in a closed Freezer.
 */
export function padStep(walkGrid: WalkGrid, floodState: FloodState, cell: number, layer: number): void {
    let padCellKey = cell;

    for (let rowsDown = 0; rowsDown < 2; rowsDown++) {
        const pads = walkGrid.padsAt.get(padCellKey);
        if (pads && !(walkGrid.marks[padCellKey] & FROZEN_MARK)) {
            for (const padIndex of pads) usePad(walkGrid, floodState, padIndex, layer);
        }
        padCellKey -= walkGrid.layerCells;
    }
}
