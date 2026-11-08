// The flood's queue: how a flood records the cells it reaches, the fall onto a supported cell, and how it walks on
// from the cells it reached (VIEWER.md "Moves", MOVEMENT.md "Falling")
import { DIRS, FIRE, FROZEN_MARK, neighbourOf } from './cells.ts';
import type { FloodState } from './flood.ts';
import { layerOf, waterAt } from './ocean.ts';
import { LAYER_COUNT, PROTECTED } from './skills.ts';
import { blocked, standable } from './support.ts';
import type { WalkGrid } from './walker.ts';

/** A position in a flood's `triggerHits` up to which they have been visited. */
export interface Cursor {
    at: number;
}

/**
 * The flood reaches `cell` in walk layer `layer`: once per layer, never `outside`; it is queued and, on a trigger
 * cell, noted in triggerHits.
 */
export function push(walkGrid: WalkGrid, floodState: FloodState, cell: number, layer: number): void {
    const bit = 1 << layer;
    const visited = walkGrid.visited;
    const isNew = cell >= 0 && !(visited[cell] & bit) && !floodState.outside?.has(cell);
    if (!isNew) return;
    visited[cell] |= bit;
    floodState.reached[layer].push(cell);
    if (walkGrid.triggers.cells[cell]) floodState.triggerHits.push(cell, layer);
    floodState.queue.push(cell, layer);
}

/**
 * Whether a fall from height z down to fallZ stays where the flood may go: a fall that starts in a map room lands
 * inside that room or nowhere, and a pocket flood keeps every fall inside the layer it starts in.
 */
function fallStaysIn(
    walkGrid: WalkGrid,
    floodState: FloodState,
    startLayer: number,
    z: number,
    fallZ: number,
): boolean {
    if (z < walkGrid.boxZ && !floodState.pocket) return true;
    return layerOf(walkGrid, fallZ) === startLayer;
}

/** Whether a closed Freezer below `cell` holds up a hero falling into it, in a flood that lets a fall land on a top. */
function heldByTop(walkGrid: WalkGrid, floodState: FloodState, cell: number): boolean {
    if (!floodState.topDrops || floodState.frozenHolds || cell < walkGrid.layerCells) return false;
    if (!(walkGrid.marks[cell - walkGrid.layerCells] & FROZEN_MARK)) return false;
    return !blocked(walkGrid, floodState, cell);
}

/**
 * The hero (layer `layer`) arriving at `cell` from height z lands on the first supported cell at or below it, however
 * far down; a move into water needs that support within 0.1 below the surface (a jump into water lands at the surface
 * - 1 and drowns); a floor holds the hero, and an attacked cell a hero with PROTECTION. A fall that starts in a map
 * room lands inside that room or nowhere (the room's implicit floor holds the hero; its height is not modelled). A
 * pocket flood keeps every fall inside the layer it starts in: a fall into a lower layer is not walked back, so what
 * lies below is no part of the pocket. A flood without frozenHolds but with topDrops lets a fall, not
 * a step from the side, land on a closed Freezer's top (heldByTop).
 */
export function settle(walkGrid: WalkGrid, floodState: FloodState, cell: number, z: number, layer: number): void {
    const { cellFlags, layerCells } = walkGrid;
    const startLayer = layerOf(walkGrid, z);
    let fallCell = cell;

    for (let drop = 0; fallCell >= 0; drop++) {
        const fallZ = z - drop;
        if (!fallStaysIn(walkGrid, floodState, startLayer, z, fallZ)) return;
        if (drop > 0 && blocked(walkGrid, floodState, fallCell)) return;

        // PROTECTION does not stop drowning
        const waterZ = waterAt(walkGrid, fallCell % layerCells, fallZ);
        if (waterZ != null && fallZ < waterZ - 0.1) return;

        // fire and goblin attacks kill a hero without PROTECTION
        if (cellFlags[fallCell] & FIRE) {
            if (layer === PROTECTED) push(walkGrid, floodState, fallCell, layer);
            return;
        }

        if (standable(walkGrid, floodState, fallCell) || (drop > 0 && heldByTop(walkGrid, floodState, fallCell))) {
            push(walkGrid, floodState, fallCell, layer);
            return;
        }
        fallCell -= layerCells;
    }
}

/**
 * Walks on from the reached cells next to the column of `columnCell`, at its height and above, up to the first cell
 * over it that a hero stepping in from the side would stop in or bump into.
 */
export function requeue(walkGrid: WalkGrid, floodState: FloodState, columnCell: number): void {
    const { grid, layerCells, visited } = walkGrid;
    const queue = floodState.queue;

    for (const [dx, dy] of DIRS) {
        let besideCell = neighbourOf(walkGrid, columnCell, dx, dy);
        let overCell = columnCell;
        while (besideCell < grid.length) {
            if (overCell !== columnCell) {
                const stopsHero = blocked(walkGrid, floodState, overCell) || standable(walkGrid, floodState, overCell);
                if (stopsHero) break;
            }

            for (let layer = 0; layer < LAYER_COUNT; layer++) {
                if (visited[besideCell] & (1 << layer)) queue.push(besideCell, layer);
            }
            besideCell += layerCells;
            overCell += layerCells;
        }
    }
}

/**
 * Calls visit(cell, layer) for each trigger cell reached in a walk layer since `cursor.at` (the triggerHits already
 * visited), and moves the cursor on.
 */
export function visitReached(
    floodState: FloodState,
    cursor: Cursor,
    visit: (cell: number, layer: number) => void,
): void {
    const triggerHits = floodState.triggerHits;

    while (cursor.at < triggerHits.length) {
        visit(triggerHits[cursor.at], triggerHits[cursor.at + 1]);
        cursor.at += 2;
    }
}
