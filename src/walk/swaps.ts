// What a TELEPORT swap leaves behind: the target lands in the cell the hero left (skills.md "TELEPORT and PULL",
// viewer.md "Moves", "Skip lanes and the TELEPORT swap")
import type { FloodState } from './flood.ts';
import type { Cursor } from './queue.ts';
import type { RockTurn } from './rock-turns.ts';
import type { WalkGrid } from './walker.ts';

/** The cells swaps are noted for (Triggers.swapOnto, swapObjects) and a turning Rock's index by its cell. */
export interface SwapIndex {
    swapOnto: Set<number>;
    swapObjects: Set<number>;
    rockAt: Map<number, number>;
}

/**
 * Indexes the swaps worth noting. A swap matters where the hero stands in a Switch
 * cell or in the cell of a Gem_Slot a Gem turns onto, and for a target that is a Rock that may turn, a Gem that turns
 * onto a slot or a Rock that stops a beam cast when the walker is built.
 */
export function swapIndex(walkGrid: WalkGrid, rocks: readonly RockTurn[], switchCells: Iterable<number>): SwapIndex {
    const index: SwapIndex = { swapOnto: new Set(), swapObjects: new Set(), rockAt: new Map() };
    const { gemTurns, swapObjects } = walkGrid.beamMoves;

    for (const cell of switchCells) index.swapOnto.add(cell);
    for (const { slotCell } of gemTurns) index.swapOnto.add(slotCell);
    for (const cell of swapObjects) index.swapObjects.add(cell);

    rocks.forEach(({ cell }, rockIndex) => {
        index.swapObjects.add(cell);
        index.rockAt.set(cell, rockIndex);
    });

    return index;
}

/** Adds `value` to the list under `key`; false when it is there already. */
function addOnce(lists: Map<number, number[]>, key: number, value: number): boolean {
    const list = lists.get(key);

    if (!list) {
        lists.set(key, [value]);
        return true;
    }

    if (list.includes(value)) return false;

    list.push(value);
    return true;
}

/**
 * Notes that a hero in walk layer 2 who stands in `heroCell` swaps with the target in `targetCell`, which then stands
 * in `heroCell`, when that can matter (swapIndex). `swapsAt` keeps the targets per hero cell, `swapsOf` the hero cells
 * per target, and `swapLog` the pairs in order.
 */
export function noteSwap(walkGrid: WalkGrid, floodState: FloodState, heroCell: number, targetCell: number): void {
    const { swapOnto, swapObjects } = walkGrid.triggers;
    let isNew = false;

    if (swapOnto.has(heroCell) && addOnce(floodState.swapsAt, heroCell, targetCell)) {
        floodState.ontoSwaps++;
        isNew = true;
    }

    if (swapObjects.has(targetCell) && addOnce(floodState.swapsOf, targetCell, heroCell)) isNew = true;

    if (isNew) floodState.swapLog.push(heroCell, targetCell);
}

/**
 * Calls visit(heroCell, targetCell) for each swap noted since `cursor.at` (the entries of `swapLog` already visited),
 * and moves the cursor on.
 */
export function visitSwaps(
    floodState: FloodState,
    cursor: Cursor,
    visit: (heroCell: number, targetCell: number) => void,
): void {
    const swapLog = floodState.swapLog;

    while (cursor.at < swapLog.length) {
        visit(swapLog[cursor.at], swapLog[cursor.at + 1]);
        cursor.at += 2;
    }
}

/** The cells the target in `targetCell` was swapped into: the hero cells noted for it. */
export function swappedTo(floodState: FloodState, targetCell: number): readonly number[] {
    return floodState.swapsOf.get(targetCell) ?? [];
}
