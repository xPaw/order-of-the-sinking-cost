// TRANSMUTE: a hero who left a TRANSMUTE Wardrobe by its door turns the Tree or dragon he bumps into a crystal Rock
// (skills.md "TRANSMUTE and the other skills", viewer.md "Moves")
import { addTo, BEAMSTOP, cellOnSide, FIRE, MONSTER, ROCK, SIDES, SOLID, SUPPORT } from './cells.ts';
import type { FloodState } from './flood.ts';
import { exists } from './groups.ts';
import type { CellWrite } from './groups.ts';
import { requeue, visitReached } from './queue.ts';
import type { RockTurn } from './rock-turns.ts';
import { TRANSMUTING } from './skills.ts';
import type { WalkGrid } from './walker.ts';
import { fenced } from './walls.ts';

/** What a TRANSMUTE hero turns into a crystal: the pid and cell of an existing Tree, or of a dragon (`monsterIndex`, else -1). */
export interface TransmuteTarget {
    pid: number;
    cell: number;
    monsterIndex: number;
}

/** The targets, and per cell a hero bumps from the [target index, side he moves] pairs that bump it. */
export interface TransmuteTargets {
    targets: TransmuteTarget[];
    bumpsFrom: Map<number, Array<[targetIndex: number, side: number]>>;
}

/** No targets. */
export const NO_TRANSMUTE_TARGETS: TransmuteTargets = { targets: [], bumpsFrom: new Map() };

/** The existing Trees and the dragons of the walker. None when the walk takes no TRANSMUTE Wardrobe. */
export function transmuteTargetsOf(walkGrid: WalkGrid): TransmuteTargets {
    if (walkGrid.transmuteDoors.size === 0) return NO_TRANSMUTE_TARGETS;

    const { world, geometry, monsters } = walkGrid;
    const targets: TransmuteTarget[] = [];

    (world.trees || []).forEach(([pid, , , , existence], treeIndex) => {
        const cell = geometry.treeCells[treeIndex];
        if (cell >= 0 && exists(walkGrid, pid, existence)) targets.push({ pid, cell, monsterIndex: -1 });
    });

    monsters.forEach(({ pid, cell, facing }, monsterIndex) => {
        if (facing >= 0) targets.push({ pid, cell, monsterIndex });
    });

    const bumpsFrom = new Map<number, Array<[number, number]>>();

    targets.forEach(({ cell }, targetIndex) => {
        for (const side of SIDES) {
            const heroCell = cellOnSide(walkGrid, cell, (side + 2) % 4);
            addTo(bumpsFrom, heroCell, [targetIndex, side]);
        }
    });

    return { targets, bumpsFrom };
}

/**
 * The crystals of the Trees as Rocks whose pushes may turn, each with the index of its target (it is a Rock once its
 * target is turned).
 */
export function crystalTurnsOf(walkGrid: WalkGrid, transmutes: TransmuteTargets): RockTurn[] {
    const turns: RockTurn[] = [];

    transmutes.targets.forEach(({ pid, cell, monsterIndex }, target) => {
        if (monsterIndex < 0) turns.push({ pid, cell, target });
    });

    return turns;
}

/** Sets `array[index]` to `value` for the rest of the flood. */
function write(floodState: FloodState, array: Uint8Array, index: number, value: number): void {
    floodState.transmuteLog.push({ array, index, value: array[index] });
    array[index] = value;
}

/**
 * Frees the cells only the fire of the dragon `monsterIndex` attacked, and walks on from next to them: the cells
 * another dragon or a goblin attacks stay attacked.
 */
function putOutFire(walkGrid: WalkGrid, floodState: FloodState, monsterIndex: number): void {
    const { cellFlags, attackCount, fireOf } = walkGrid;
    const lost = floodState.attacksLost;

    for (const cell of fireOf.get(monsterIndex) ?? []) {
        const attacksLeft = (attackCount.get(cell) ?? 0) - (lost.get(cell) ?? 0) - 1;
        lost.set(cell, (lost.get(cell) ?? 0) + 1);
        if (attacksLeft > 0) continue;

        write(floodState, cellFlags, cell, cellFlags[cell] & ~FIRE);
        requeue(walkGrid, floodState, cell);
    }
}

/**
 * Turns the target into a crystal Rock in place: a Rock holds up what stands on it and is pushed, a Tree's cell is no
 * longer solid, and a dragon breathes no fire and is no longer a Monster of its room.
 */
function crystallize(walkGrid: WalkGrid, floodState: FloodState, targetIndex: number): void {
    const { cell, monsterIndex } = walkGrid.triggers.transmutes.targets[targetIndex];
    const grid = walkGrid.grid;
    const wallBits = walkGrid.geometry.solidGrid[cell] & SOLID;

    floodState.transmuted.add(targetIndex);

    if (monsterIndex < 0) {
        write(floodState, grid, cell, (grid[cell] & ~(SOLID | BEAMSTOP)) | wallBits | SUPPORT | ROCK);
    } else {
        write(floodState, grid, cell, (grid[cell] & ~MONSTER) | SUPPORT | ROCK);
        floodState.monsterGone[monsterIndex] = 1;
        putOutFire(walkGrid, floodState, monsterIndex);
    }

    requeue(walkGrid, floodState, cell);
}

/**
 * Turns the Trees and dragons a TRANSMUTE hero reaches a cell beside into crystals, for the rest of the flood. The
 * hero bumps from a cell no Fence parts from the target. Returns whether any target was turned.
 */
export function transmute(walkGrid: WalkGrid, floodState: FloodState): boolean {
    const { targets, bumpsFrom } = walkGrid.triggers.transmutes;
    let turned = false;

    visitReached(floodState, floodState.transmuteCursor, (cell, layer) => {
        if (layer !== TRANSMUTING) return;

        for (const [targetIndex, side] of bumpsFrom.get(cell) ?? []) {
            if (floodState.transmuted.has(targetIndex)) continue;
            if (fenced(walkGrid, cell, side, targets[targetIndex].cell)) continue;

            crystallize(walkGrid, floodState, targetIndex);
            turned = true;
        }
    });

    return turned;
}

/** Puts back what the flood's crystals changed, newest first. */
export function undoTransmutes(floodState: FloodState): void {
    const log: CellWrite[] = floodState.transmuteLog;

    for (let logIndex = log.length - 1; logIndex >= 0; logIndex--) {
        const entry = log[logIndex];
        entry.array[entry.index] = entry.value;
    }
}
