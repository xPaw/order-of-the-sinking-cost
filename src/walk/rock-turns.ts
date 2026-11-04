// Rocks and spare Gems pushed into water with turns: a Rock or Gem the walk can push to a cell where it sinks makes the
// water cell a bridge (MOVEMENT.md "Objects in water", VIEWER.md "Moves")
import { attackedAt } from './attacks.ts';
import { BRIDGE_MARK, cellOnSide, PUSH, Z_BIAS } from './cells.ts';
import type { FloodState } from './flood.ts';
import { missChanged, PRESS_CELLS, PRESS_FALL, pressInputs, walled } from './gates.ts';
import type { PressMiss } from './gates.ts';
import { exists } from './groups.ts';
import { levelWater, waterStopsFall } from './ocean.ts';
import { requeue, visitReached } from './queue.ts';
import { reachedEntries } from './room-answers.ts';
import { skippingStones, stoneLandingOf } from './skipping-stones.ts';
import { LAYER_COUNT, PUSH_LAYER_BITS, pushes } from './skills.ts';
import { holdsStone, standable } from './support.ts';
import { swappedTo, visitSwaps } from './swaps.ts';
import type { WalkGrid } from './walker.ts';
import { fenced } from './walls.ts';

/**
 * An existing Rock that is no skipping stone: its pid and the cell the save last left it in. A Tree a TRANSMUTE hero
 * turns into a crystal is one once its transmute target `target` is turned. A Rock a Spawner respawns stands in the
 * Spawner's cell once the flood has reached one of the Activators in `activators` (their cells). A skipping stone
 * (`skips`) skips on into level water instead of sinking where it enters it.
 */
export interface RockTurn {
    pid: number;
    cell: number;
    target?: number;
    activators?: number[];
    skips?: boolean;
}

/** Where a push ends: the cell the object lands in, and whether it sinks in water level with that cell. */
export interface Landing {
    cell: number;
    sinks: boolean;
}

/** The Rocks whose pushes may turn: the existing ones that are no skipping stone, in the order of the level data. */
export function rockTurnsOf(walkGrid: WalkGrid): RockTurn[] {
    const skippable = new Set(walkGrid.world.skippable || []);
    return walkGrid.rocks.filter(({ pid }) => !skippable.has(pid));
}

/** The skipping stones that exist and have not sunk, each at the cell the save last left it in. */
export function stoneTurnsOf(walkGrid: WalkGrid): RockTurn[] {
    return skippingStones(walkGrid).map(([cell, , pid]) => ({ pid, cell, skips: true }));
}

/**
 * The Rocks an Activator puts back at their Spawner's cell, for the Rocks that stand elsewhere (or nowhere) in the
 * save: the Spawner and one of its Activators exist. Skipping stones are left out.
 */
export function respawnedRocksOf(walkGrid: WalkGrid): RockTurn[] {
    const skippable = new Set(walkGrid.world.skippable || []);
    const standingAt = new Map<number, number>();
    for (const { pid, cell } of walkGrid.rocks) standingAt.set(pid, cell);

    const respawned: RockTurn[] = [];

    for (const spawn of walkGrid.geometry.rockSpawns) {
        const { spawnedPid, spawnerCell } = spawn;
        if (spawnerCell < 0 || skippable.has(spawnedPid) || standingAt.get(spawnedPid) === spawnerCell) continue;
        if (!exists(walkGrid, spawn.spawnerPid, spawn.spawnerExistence)) continue;

        const activators: number[] = [];
        for (const activator of spawn.activators) {
            if (activator.cell >= 0 && exists(walkGrid, activator.pid, activator.existence)) {
                activators.push(activator.cell);
            }
        }

        if (activators.length > 0) respawned.push({ pid: spawnedPid, cell: spawnerCell, activators });
    }

    return respawned;
}

/**
 * Whether `cell` holds a pushable for the pushes of the objects that turn: the cell of a Rock that has sunk, with turns
 * or in its straight bridge, is empty.
 */
export function pushableIn(walkGrid: WalkGrid, floodState: FloodState, cell: number): boolean {
    if (!(walkGrid.grid[cell] & PUSH)) return false;

    const rockIndex = walkGrid.triggers.rockAt.get(cell);
    return rockIndex === undefined || !rockSunk(walkGrid, floodState, rockIndex);
}

/**
 * Where a Rock in `from` ends when pushed on side `side`, as movesOnto reads it from the other end: it enters the next
 * cell and lands there if the cell holds it, else falls through open air at most PRESS_FALL cells onto the first cell
 * that holds it, or sinks in the first cell of water level with its height, where it becomes a bridge. A fall stops
 * short of a cell the water cancels the step into (waterStopsFall). null where the push fails or the Rock never lands.
 */
export function landingOf(walkGrid: WalkGrid, floodState: FloodState, from: number, side: number): Landing | null {
    const { layerCells } = walkGrid;
    const fromZ = Math.floor(from / layerCells) - Z_BIAS;
    let cell = cellOnSide(walkGrid, from, side);
    const column = cell % layerCells;

    for (let fallen = 0; fallen <= PRESS_FALL && cell >= layerCells; fallen++) {
        const z = fromZ - fallen;
        if (walled(walkGrid, floodState, cell) || pushableIn(walkGrid, floodState, cell)) return null;
        if (fallen > 0 && waterStopsFall(walkGrid, column, z)) return null;
        if (holdsStone(walkGrid, floodState, cell, z)) return { cell, sinks: false };
        if (levelWater(walkGrid, cell, z) && fallen < PRESS_FALL) return { cell, sinks: true };

        cell -= layerCells;
    }

    return null;
}

/**
 * Calls visit(landing) for each push of the object in `from` that the hero can make from a cell the flood reached in
 * a pushing layer, as a Rock lands in landingOf. None when the object cannot stand in `from` or `from` is attacked (the
 * hero steps into it and dies); a skipping stone (`skips`) lands as stoneLandingOf has it. The push cells turned down because
 * the flood has not reached them go to `miss`.
 */
export function pushLandings(
    walkGrid: WalkGrid,
    floodState: FloodState,
    from: number,
    miss: PressMiss,
    visit: (landing: Landing) => void,
    skips = false,
): void {
    const { layerCells, visited } = walkGrid;
    const z = Math.floor(from / layerCells) - Z_BIAS;
    if (walled(walkGrid, floodState, from) || !holdsStone(walkGrid, floodState, from, z)) return;
    if (attackedAt(walkGrid, from)) return;

    for (let side = 0; side < 4; side++) {
        const pushCell = cellOnSide(walkGrid, from, (side + 2) % 4);
        const into = cellOnSide(walkGrid, from, side);
        if (fenced(walkGrid, from, side, into) || fenced(walkGrid, pushCell, side, from)) continue;

        const landing = skips
            ? stoneLandingOf(walkGrid, floodState, from, side, z)
            : landingOf(walkGrid, floodState, from, side);
        if (!landing) continue;

        if ((visited[pushCell] & PUSH_LAYER_BITS) === 0) {
            miss.pushCells.push(pushCell);
            continue;
        }

        visit(landing);
    }
}

/**
 * Whether a bridge in `waterCell` joins ground the flood reached to ground it has not: it holds no hero yet, it is
 * reached (a cell beside it is, or the arm cell of a magic-mirror hop that lands on it) and another cell beside it is
 * a cell a hero stands in that is not. The cells beside it and the arm cells go to `miss`, since reaching one may make
 * it join them.
 */
export function joinsNewGround(
    walkGrid: WalkGrid,
    floodState: FloodState,
    waterCell: number,
    miss: PressMiss,
): boolean {
    if (standable(walkGrid, floodState, waterCell)) return false;

    const { visited } = walkGrid;
    let joinsReached = false;
    let joinsNew = false;

    for (let side = 0; side < 4; side++) {
        const beside = cellOnSide(walkGrid, waterCell, side);
        miss.pushCells.push(beside);

        if (visited[beside] !== 0) {
            joinsReached = true;
        } else if (standable(walkGrid, floodState, beside) && !floodState.outside?.has(beside)) {
            joinsNew = true;
        }
    }

    for (const armCell of walkGrid.hopSources.get(waterCell) ?? []) {
        miss.pushCells.push(armCell);
        if ((visited[armCell] & PUSH_LAYER_BITS) !== 0) joinsReached = true;
    }

    return joinsReached && joinsNew;
}

/** What a push search of a Rock found: the cells it was pushed to, and the water cell it sank in, else -1. */
export interface PushReach {
    positions: number[];
    waterCell: number;
}

/**
 * The first water cell `accepts` where the Rock in `rockCell` sinks, else -1: the cells the Rock is pushed to from its
 * own cell or a cell a swap put it in, nearest first over at most PRESS_CELLS cells, by a hero who stands in a cell the
 * flood reached; a skipping stone (`skips`) rests on cells and sinks where stoneLandingOf has it. The push cells turned
 * down go to `miss`.
 */
export function sinkOf(
    walkGrid: WalkGrid,
    floodState: FloodState,
    rockCell: number,
    miss: PressMiss,
    accepts: (waterCell: number) => boolean,
    skips = false,
): number {
    return pushReach(walkGrid, floodState, rockCell, miss, accepts, skips).waterCell;
}

/** The search of sinkOf, with the cells the Rock was pushed to. */
export function pushReach(
    walkGrid: WalkGrid,
    floodState: FloodState,
    rockCell: number,
    miss: PressMiss,
    accepts: (waterCell: number) => boolean,
    skips = false,
): PushReach {
    const positions = [rockCell];
    for (const swapped of swappedTo(floodState, rockCell)) {
        if (!pushableIn(walkGrid, floodState, swapped)) positions.push(swapped);
    }

    const seen = new Set(positions);
    let waterCell = -1;

    for (let index = 0; index < positions.length && index < PRESS_CELLS; index++) {
        pushLandings(
            walkGrid,
            floodState,
            positions[index],
            miss,
            (landing) => {
                if (waterCell >= 0) return;

                if (!landing.sinks) {
                    if (!seen.has(landing.cell)) {
                        seen.add(landing.cell);
                        positions.push(landing.cell);
                    }
                } else if (accepts(landing.cell)) {
                    waterCell = landing.cell;
                }
            },
            skips,
        );

        if (waterCell >= 0) break;
    }

    return { positions, waterCell };
}

/**
 * The water cell where the Rock in `rockCell` sinks into a bridge that joins new ground, else -1. The cells beside a
 * water cell that joined nothing go to `miss` as well.
 */
function bridgeOf(
    walkGrid: WalkGrid,
    floodState: FloodState,
    rockCell: number,
    miss: PressMiss,
    skips: boolean,
): number {
    return sinkOf(
        walkGrid,
        floodState,
        rockCell,
        miss,
        (waterCell) => !floodState.bridged.has(waterCell) && joinsNewGround(walkGrid, floodState, waterCell, miss),
        skips,
    );
}

/**
 * The first water cell where the stored answer of the Rock's room (room-answers.ts) has the Rock in `rockCell` sink
 * into a bridge that joins new ground, from a start the walk has reached, else -1. The start cells not reached, and the
 * cells beside a water cell that joined nothing, go to `miss`.
 */
function storedBridgeOf(walkGrid: WalkGrid, floodState: FloodState, rockCell: number, miss: PressMiss): number {
    const entries = walkGrid.rooms.byCell.get(rockCell);
    if (!entries) return -1;

    for (const entry of reachedEntries(walkGrid, floodState.outside, entries, miss.pushCells)) {
        for (const waterCell of entry.bridges.get(rockCell) ?? []) {
            if (floodState.bridged.has(waterCell)) continue;
            if (joinsNewGround(walkGrid, floodState, waterCell, miss)) return waterCell;
        }
    }

    return -1;
}

/** Whether the Rock stands: a crystal Rock needs its target turned, a respawned Rock one of its Activators reached. */
export function rockStands(walkGrid: WalkGrid, floodState: FloodState, rockIndex: number): boolean {
    const { target, activators } = walkGrid.triggers.rocks[rockIndex];
    if (target !== undefined && !floodState.transmuted.has(target)) return false;

    return !activators || activators.some((activatorCell) => walkGrid.visited[activatorCell] !== 0);
}

/** Whether the Rock has sunk: with turns, or in its straight bridge (`bridgeTaken`). */
function rockSunk(walkGrid: WalkGrid, floodState: FloodState, rockIndex: number): boolean {
    if (floodState.rockSpent[rockIndex]) return true;

    const { triggers } = walkGrid;
    const bridgeIndex = triggers.bridgeIndexOf.get(triggers.rocks[rockIndex].pid);
    return bridgeIndex !== undefined && floodState.bridgeTaken[bridgeIndex] === 1;
}

/** Whether the Rock can still sink: it stands and has not sunk. */
export function rockFree(walkGrid: WalkGrid, floodState: FloodState, rockIndex: number): boolean {
    return !rockSunk(walkGrid, floodState, rockIndex) && rockStands(walkGrid, floodState, rockIndex);
}

/**
 * Sinks the Rock `rockIndex` in `waterCell`: the cell holds the hero, and the walk resumes from the reached cells beside
 * it and from the reached arm cells of the magic-mirror hops that land on it. The Rock bridges once, and its straight
 * bridge is spent with it.
 */
export function sinkRock(walkGrid: WalkGrid, floodState: FloodState, rockIndex: number, waterCell: number): void {
    const { triggers, marks, visited, hopSources } = walkGrid;
    floodState.rockSpent[rockIndex] = 1;

    const bridgeIndex = triggers.bridgeIndexOf.get(triggers.rocks[rockIndex].pid);
    if (bridgeIndex !== undefined) floodState.bridgeTaken[bridgeIndex] = 1;

    floodState.bridged.add(waterCell);

    if (!(marks[waterCell] & BRIDGE_MARK)) {
        marks[waterCell] |= BRIDGE_MARK;
        floodState.turnMarked.push(waterCell);
    }

    requeue(walkGrid, floodState, waterCell);

    for (const armCell of hopSources.get(waterCell) ?? []) {
        for (let layer = 0; layer < LAYER_COUNT; layer++) {
            if (visited[armCell] & (1 << layer)) floodState.queue.push(armCell, layer);
        }
    }
}

/**
 * Sinks the Rocks that can be pushed into water with turns, once a hero reaches a cell beside one: each Rock bridges
 * once, at the nearest water cell it sinks in that joins new ground, and not when its straight bridge sank it already
 * (its `bridgeTaken`). A skipping stone is one of them: it sinks once, in the nearest cell where it ends a skip against
 * a fence, a blocked cell or a pushable that joins new ground. A Rock whose search found nothing is looked at again only
 * once what it reads has changed. Returns whether any Rock sank.
 */
export function sinkTurned(walkGrid: WalkGrid, floodState: FloodState): boolean {
    const { triggers } = walkGrid;
    const { rocksDue, rockSeen, rockMisses } = floodState;
    let added = false;

    visitReached(floodState, floodState.rockCursor, (cell, layer) => {
        if (!pushes(layer)) return;

        for (const rockIndex of triggers.rocksAt.get(cell) || []) {
            if (rockSeen[rockIndex]) continue;
            rockSeen[rockIndex] = 1;
            rocksDue.push(rockIndex);
            added = true;
        }
    });

    visitSwaps(floodState, floodState.rockSwapCursor, (_heroCell, targetCell) => {
        const rockIndex = triggers.rockAt.get(targetCell);
        if (rockIndex === undefined || rockSeen[rockIndex]) return;

        rockSeen[rockIndex] = 1;
        rocksDue.push(rockIndex);
        added = true;
    });

    if (added) rocksDue.sort((first, second) => first - second);

    let sank = false;

    for (const rockIndex of rocksDue) {
        if (!rockFree(walkGrid, floodState, rockIndex)) continue;

        const { cell, skips = false } = triggers.rocks[rockIndex];
        const swaps = swappedTo(floodState, cell).length;
        const miss = rockMisses[rockIndex];
        if (miss && !missChanged(walkGrid, floodState, miss, swaps)) continue;

        const newMiss: PressMiss = { inputs: pressInputs(floodState) + swaps, pushCells: [], wallStops: [] };
        let waterCell = -1;
        if (!skips) waterCell = storedBridgeOf(walkGrid, floodState, cell, newMiss);
        if (waterCell < 0) waterCell = bridgeOf(walkGrid, floodState, cell, newMiss, skips);

        if (waterCell < 0) {
            rockMisses[rockIndex] = newMiss;
            continue;
        }

        sinkRock(walkGrid, floodState, rockIndex, waterCell);
        sank = true;
    }

    return sank;
}
