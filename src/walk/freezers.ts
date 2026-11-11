// The Freezers: those that hold level entrances, and the closed ones in a walker's grid (state.md "Freezers in the
// save")
import { PROG } from '../data.ts';
import type { Position } from '../types.ts';
import { FROZEN_MARK } from './cells.ts';
import type { WalkGrid } from './walker.ts';

/** A position rounded to whole units, as a key. */
function roundedKey(position: Position): string {
    return position.map(Math.round).join();
}

/** Per level, the Freezer whose cell holds its entrance (the level is frozen in it until the Freezer opens). */
function freezersOfLevels(): Array<number | undefined> {
    const freezerAt = new Map<string, number>();
    (PROG.freezers || []).forEach((freezer, freezerIndex) => {
        freezerAt.set(roundedKey(freezer.p), freezerIndex);
    });

    return (PROG.levels || []).map((level) => freezerAt.get(roundedKey(level.p)));
}

/** Per level, the index of the Freezer whose cell holds its entrance, else undefined. */
export const ICE: Array<number | undefined> = freezersOfLevels();

/** Closes Freezer `freezerIndex` in `cell` for the floods that follow. */
export function freeze(walkGrid: WalkGrid, cell: number, freezerIndex: number): void {
    walkGrid.frozen.set(cell, freezerIndex);
    walkGrid.marks[cell] |= FROZEN_MARK;
    walkGrid.thawed.delete(cell);
}

/** Opens the closed Freezer in `cell` for the floods that follow. */
export function thaw(walkGrid: WalkGrid, cell: number): void {
    if (walkGrid.frozen.delete(cell)) walkGrid.thawed.add(cell);
    walkGrid.marks[cell] &= ~FROZEN_MARK;
}

/** Puts the closed Freezers in the grid's `frozen` cells. */
export function freezeGates(walkGrid: WalkGrid): void {
    walkGrid.geometry.freezerCells.forEach((cell, freezerIndex) => {
        if (walkGrid.closedFreezers[freezerIndex] && cell >= 0) freeze(walkGrid, cell, freezerIndex);
    });
}
