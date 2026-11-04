// Monsters pushed to their death: into water, where they drown, into a dragon's fire or beside a goblin (MOVEMENT.md
// "Water", "Goblins, dragons and PROTECTION", VIEWER.md "Moves")
import { cellOnSide, FIRE_STOP, FLOOR, MONSTER } from './cells.ts';
import type { FloodState } from './flood.ts';
import { missChanged, PRESS_CELLS, pressInputs } from './gates.ts';
import type { PressMiss } from './gates.ts';
import { reachedEntries } from './room-answers.ts';
import { pushLandings } from './rock-turns.ts';
import { doorIn, doorOut } from './skills.ts';
import type { WalkGrid } from './walker.ts';
import { fenced } from './walls.ts';

/**
 * The cell of the first Monster that a dragon in `from` breathing fire on side `side` hits, else -1. `vacated`: the cell
 * the dragon was pushed from, which stops nothing. The fire runs as in dragonFire.
 */
export function fireTarget(walkGrid: WalkGrid, from: number, side: number, vacated: number): number {
    const { grid, frozen, width, height } = walkGrid;
    let cell = from;

    for (let stepsLeft = width + height; stepsLeft > 0; stepsLeft--) {
        const next = cellOnSide(walkGrid, cell, side);
        if (next === from) return -1;
        if (doorOut(walkGrid, cell, side) >= 0 || doorIn(walkGrid, next, side) >= 0) return -1;
        if (frozen.has(next)) return -1;

        if (next !== vacated && grid[next] & FIRE_STOP) {
            if (grid[next] & MONSTER) return next;
            return -1;
        }

        cell = next;
    }

    return -1;
}

/**
 * Whether the fire of a dragon other than the Monster `monsterIndex` runs through `cell`, a dragon that `monsterGone`
 * does not hold gone.
 */
export function burnsAt(walkGrid: WalkGrid, monsterGone: Uint8Array, cell: number, monsterIndex: number): boolean {
    const dragons = walkGrid.burningBy.get(cell);
    if (!dragons) return false;

    return dragons.some((dragonIndex) => dragonIndex !== monsterIndex && !monsterGone[dragonIndex]);
}

/**
 * Whether a living goblin other than the Monster `monsterIndex` attacks `cell`: it stands in one of the six cells beside
 * it (`goblinAt` gives the goblins by cell) with no Fence on the edge between them (a floor Fence in the upper cell,
 * for the cell above or below). A goblin in a SQUEEZE beam, which attacks across Fences, is not told apart.
 */
export function goblinBeside(
    walkGrid: WalkGrid,
    goblinAt: Map<number, number>,
    monsterGone: Uint8Array,
    cell: number,
    monsterIndex: number,
): boolean {
    const { grid, layerCells } = walkGrid;

    const isLivingGoblin = (goblinIndex: number | undefined): goblinIndex is number => {
        return goblinIndex !== undefined && goblinIndex !== monsterIndex && !monsterGone[goblinIndex];
    };

    for (let side = 0; side < 4; side++) {
        const beside = cellOnSide(walkGrid, cell, side);
        if (isLivingGoblin(goblinAt.get(beside)) && !fenced(walkGrid, cell, side, beside)) return true;
    }

    const above = cell + layerCells;
    if (isLivingGoblin(goblinAt.get(above)) && !(grid[above] & FLOOR)) return true;

    const below = cell - layerCells;
    return isLivingGoblin(goblinAt.get(below)) && !(grid[cell] & FLOOR);
}

/**
 * Searches the cells the Monster `monsterIndex` is pushed to, nearest first over at most PRESS_CELLS cells, by a hero who
 * stands in a cell the flood reached in a pushing layer, as a Rock is in bridgeOf. It dies where it sinks in water, stands in
 * the fire of another dragon or stands beside a living goblin. A dragon pushed to a cell breathes from there: the first Monster its fire meets (one the
 * save left in a gate's room) is gone as well, whether or not the dragon is. The push cells turned down go to `miss`.
 * Returns whether the Monster dies.
 */
function searchPushes(walkGrid: WalkGrid, floodState: FloodState, monsterIndex: number, miss: PressMiss): boolean {
    const monster = walkGrid.monsters[monsterIndex];
    const { monsterAt, goblinAt } = walkGrid.triggers.monsterGates;
    const positions = [monster.cell];
    const seen = new Set(positions);
    let dies = false;

    const reach = (cell: number): void => {
        if (burnsAt(walkGrid, floodState.monsterGone, cell, monsterIndex)) dies = true;
        if (monster.facing < 0) return;

        const hit = fireTarget(walkGrid, cell, monster.facing, monster.cell);
        const hitIndex = monsterAt.get(hit);
        if (hitIndex !== undefined && hitIndex !== monsterIndex) floodState.monsterGone[hitIndex] = 1;
    };

    for (let index = 0; index < positions.length && index < PRESS_CELLS; index++) {
        pushLandings(walkGrid, floodState, positions[index], miss, (landing) => {
            if (landing.sinks) {
                dies = true;
                return;
            }

            if (seen.has(landing.cell)) return;

            seen.add(landing.cell);
            reach(landing.cell);

            if (goblinBeside(walkGrid, goblinAt, floodState.monsterGone, landing.cell, monsterIndex)) {
                dies = true;
                return;
            }

            positions.push(landing.cell);
        });
    }

    return dies;
}

/**
 * Whether the stored answer of the Monster's room (room-answers.ts) has it die, from a start the walk has reached. The
 * start cells not reached go to `miss`.
 */
function diesInRoom(walkGrid: WalkGrid, floodState: FloodState, monsterIndex: number, miss: PressMiss): boolean {
    const cell = walkGrid.monsters[monsterIndex].cell;
    const entries = walkGrid.rooms.byCell.get(cell);
    if (!entries) return false;

    const reached = reachedEntries(walkGrid, floodState.outside, entries, miss.pushCells);
    return reached.some((entry) => entry.dead.has(cell));
}

/**
 * Whether the hero pushes the Monster `monsterIndex` to its death: the stored answer of its room has it die, or the
 * search over its pushes finds a way. A search that found no way is looked at again only once what it reads has
 * changed.
 */
export function pushedToDeath(walkGrid: WalkGrid, floodState: FloodState, monsterIndex: number): boolean {
    const miss = floodState.monsterMisses[monsterIndex];
    if (miss && !missChanged(walkGrid, floodState, miss)) return false;

    const newMiss: PressMiss = { inputs: pressInputs(floodState), pushCells: [], wallStops: [] };
    const dies =
        diesInRoom(walkGrid, floodState, monsterIndex, newMiss) ||
        searchPushes(walkGrid, floodState, monsterIndex, newMiss);

    if (!dies) floodState.monsterMisses[monsterIndex] = newMiss;
    return dies;
}
