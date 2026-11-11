// Rocks that sink side by side: the second Rock is pushed over the water cell the first one bridged, so a gap of two or
// three water cells closes (movement.md "Objects in water", viewer.md "Moves")
import { addTo, BRIDGE_MARK, cellOnSide, SIDES, Z_BIAS } from './cells.ts';
import type { FloodState } from './flood.ts';
import { missChanged, PRESS_FALL, pressInputs } from './gates.ts';
import type { PressMiss } from './gates.ts';
import { levelWater } from './ocean.ts';
import { joinsNewGround, pushReach, rockFree, sinkOf, sinkRock } from './rock-turns.ts';
import { blocked, standable } from './support.ts';
import { swappedTo } from './swaps.ts';
import type { WalkGrid } from './walker.ts';

// the most Rocks one gap takes: a gap of three water cells in a row
const CHAIN_ROCKS = 3;

/** A Rock's last failed search for a gap, and how many Rocks were due then. */
export interface ChainMiss {
    due: number;
    miss: PressMiss;
}

/** The Rock `rockIndex` sinking in `waterCell` as one step of a gap. */
interface ChainStep {
    rockIndex: number;
    waterCell: number;
}

/** What a water cell was before a search took it for a bridge: marked as one, and the layers that reached it. */
interface Assumed {
    waterCell: number;
    marked: boolean;
    visited: number;
}

/**
 * Takes `waterCell` for a bridge the hero stands on, while a search looks for the Rocks that sink after the one that
 * sank there: it holds a pushed Rock, a hero in it counts as reached and it is standable.
 */
function assume(walkGrid: WalkGrid, floodState: FloodState, waterCell: number): Assumed {
    const { marks, visited } = walkGrid;
    const assumed: Assumed = {
        waterCell,
        marked: (marks[waterCell] & BRIDGE_MARK) !== 0,
        visited: visited[waterCell],
    };

    floodState.bridged.add(waterCell);
    marks[waterCell] |= BRIDGE_MARK;
    visited[waterCell] |= 1;
    return assumed;
}

/** Puts the water cell back as it was before assume(). */
function retract(walkGrid: WalkGrid, floodState: FloodState, assumed: Assumed): void {
    const { waterCell } = assumed;
    floodState.bridged.delete(waterCell);
    if (!assumed.marked) walkGrid.marks[waterCell] &= ~BRIDGE_MARK;
    walkGrid.visited[waterCell] = assumed.visited;
}

/** Whether a cell beside `waterCell` is reached, which is where the hero stands to step onto its bridge. */
function reachedBeside(walkGrid: WalkGrid, waterCell: number, miss: PressMiss): boolean {
    let reached = false;

    for (const side of SIDES) {
        const beside = cellOnSide(walkGrid, waterCell, side);
        miss.pushCells.push(beside);
        if (walkGrid.visited[beside] !== 0) reached = true;
    }

    return reached;
}

/** Whether a cell beside `waterCell` is a cell a hero stands in that the flood has not reached. */
function newGroundBeside(walkGrid: WalkGrid, floodState: FloodState, waterCell: number, miss: PressMiss): boolean {
    for (const side of SIDES) {
        const beside = cellOnSide(walkGrid, waterCell, side);
        miss.pushCells.push(beside);

        if (walkGrid.visited[beside] !== 0 || floodState.outside?.has(beside)) continue;
        if (standable(walkGrid, floodState, beside)) return true;
    }

    return false;
}

/**
 * Whether open water, at most `waterLeft` cells in a row from a cell beside `waterCell`, leads to ground the flood has
 * not reached. The cells looked at go to `miss`.
 */
function leadsToNewGround(
    walkGrid: WalkGrid,
    floodState: FloodState,
    waterCell: number,
    waterLeft: number,
    miss: PressMiss,
): boolean {
    const z = Math.floor(waterCell / walkGrid.layerCells) - Z_BIAS;

    for (const side of SIDES) {
        const next = cellOnSide(walkGrid, waterCell, side);
        if (floodState.bridged.has(next) || blocked(walkGrid, floodState, next)) continue;
        if (standable(walkGrid, floodState, next) || !levelWater(walkGrid, next, z)) continue;

        if (newGroundBeside(walkGrid, floodState, next, miss)) return true;
        if (waterLeft > 1 && leadsToNewGround(walkGrid, floodState, next, waterLeft - 1, miss)) return true;
    }

    return false;
}

/** What a Rock can do as a link of a chain: the water cell where it joins new ground, else -1, and its steps. */
interface Links {
    finish: number;
    stepCells: number[];
}

/**
 * Where the Rock `rockIndex` sinks as a link of a chain with `rocksLeft` Rocks still to come, itself included: a water
 * cell where it joins new ground (`finish`), else the water cells beside reached ground that open water leads on from to
 * new ground, within the Rocks left (`stepCells`). The push cells turned down go to `miss`.
 */
function linksOf(
    walkGrid: WalkGrid,
    floodState: FloodState,
    rockIndex: number,
    rocksLeft: number,
    miss: PressMiss,
): Links {
    const stepCells: number[] = [];
    const rockCell = walkGrid.triggers.rocks[rockIndex].cell;
    const finish = sinkOf(walkGrid, floodState, rockCell, miss, (waterCell) =>
        linkAt(walkGrid, floodState, waterCell, rocksLeft, stepCells, miss),
    );

    return { finish, stepCells };
}

/**
 * Whether a Rock that sinks in `waterCell` as a link with `rocksLeft` Rocks still to come joins new ground there; else
 * `waterCell` goes to `stepCells` when it is a step (linksOf).
 */
function linkAt(
    walkGrid: WalkGrid,
    floodState: FloodState,
    waterCell: number,
    rocksLeft: number,
    stepCells: number[],
    miss: PressMiss,
): boolean {
    if (joinsNewGround(walkGrid, floodState, waterCell, miss)) return true;
    if (rocksLeft < 2 || stepCells.includes(waterCell)) return false;
    if (!reachedBeside(walkGrid, waterCell, miss)) return false;

    if (leadsToNewGround(walkGrid, floodState, waterCell, rocksLeft - 1, miss)) stepCells.push(waterCell);
    return false;
}

/**
 * What the push searches of the Rocks of a pass find and read before any water cell is taken for a bridge: per Rock, its
 * links as the second of a chain (`links`), and per cell the Rocks whose search reads it (`readersOf`). A Rock whose
 * search reads none of the water cells a chain takes for bridges finds with those bridges the links it finds without
 * them.
 */
interface ChainReach {
    links: Links[];
    readersOf: Map<number, number[]>;
}

/**
 * A pass of sinkChained: the Rocks that may be links, in the order they are tried (`available`), and what their searches
 * read (`reach`), once a search takes a water cell for a bridge.
 */
interface ChainPass {
    available: number[];
    reach: ChainReach | null;
}

/**
 * The cells a Rock's push search reads around a cell `position` it is pushed from: the cell itself, the cells beside
 * it, where the hero stands or the Rock goes, and the cell PRESS_FALL below each, the last a fall reads. A fall that
 * reaches a water cell above that one sinks in it, so that cell is read as a sink (sinkReads).
 */
function positionReads(walkGrid: WalkGrid, position: number, reads: Set<number>): void {
    const fallDrop = PRESS_FALL * walkGrid.layerCells;
    reads.add(position);

    for (const side of SIDES) {
        const beside = cellOnSide(walkGrid, position, side);
        reads.add(beside);
        if (beside >= fallDrop) reads.add(beside - fallDrop);
    }
}

/**
 * The cells a next link's search reads around a water cell it sinks in: the cell, the cells beside it and beside those,
 * and the arm cells of the hops that land on it.
 */
function sinkReads(walkGrid: WalkGrid, waterCell: number, reads: Set<number>): void {
    reads.add(waterCell);
    for (const armCell of walkGrid.hopSources.get(waterCell) ?? []) reads.add(armCell);

    for (const side of SIDES) {
        const beside = cellOnSide(walkGrid, waterCell, side);
        reads.add(beside);

        for (const besideSide of SIDES) reads.add(cellOnSide(walkGrid, beside, besideSide));
    }
}

/**
 * What the push searches of the Rocks of `available` find as the second of a chain, as linksOf has it, and what they
 * read over every cell they are pushed to and every water cell they sink in, past the first that joins new ground.
 */
function reachOf(walkGrid: WalkGrid, floodState: FloodState, available: number[]): ChainReach {
    const links: Links[] = [];
    const readersOf = new Map<number, number[]>();
    const turnedDown: PressMiss = { inputs: 0, pushCells: [], wallStops: [] };
    const rocksLeft = CHAIN_ROCKS - 1;

    for (const rockIndex of available) {
        const rockReads = new Set<number>();
        const rockLinks: Links = { finish: -1, stepCells: [] };
        const rockCell = walkGrid.triggers.rocks[rockIndex].cell;

        const { positions } = pushReach(walkGrid, floodState, rockCell, turnedDown, (waterCell) => {
            sinkReads(walkGrid, waterCell, rockReads);
            if (rockLinks.finish >= 0) return false;

            if (linkAt(walkGrid, floodState, waterCell, rocksLeft, rockLinks.stepCells, turnedDown)) {
                rockLinks.finish = waterCell;
            }

            return false;
        });

        for (const position of positions) positionReads(walkGrid, position, rockReads);

        for (const cell of rockReads) addTo(readersOf, cell, rockIndex);
        links[rockIndex] = rockLinks;
    }

    return { links, readersOf };
}

/** The Rocks whose push searches read a water cell that the steps of `chain` take for bridges. */
function readersOfSteps(reach: ChainReach, chain: ChainStep[]): Set<number> {
    const readers = new Set<number>();

    for (const { waterCell } of chain) {
        for (const rockIndex of reach.readersOf.get(waterCell) ?? []) readers.add(rockIndex);
    }

    return readers;
}

/**
 * The Rocks, in order, that close a gap with the Rock `rockIndex` as the next link after the steps of `chain`: it sinks
 * where it joins new ground, or in a water cell that the next Rock of the pass (none twice) goes on from with that water
 * cell bridged and the hero standing in it. The chain has at most CHAIN_ROCKS Rocks. The push cells turned down go to
 * `miss`.
 */
function closeGap(
    walkGrid: WalkGrid,
    floodState: FloodState,
    rockIndex: number,
    pass: ChainPass,
    chain: ChainStep[],
    miss: PressMiss,
): ChainStep[] | null {
    const links = linksOf(walkGrid, floodState, rockIndex, CHAIN_ROCKS - chain.length, miss);
    return closeFrom(walkGrid, floodState, rockIndex, links, pass, chain, miss);
}

/** closeGap() for the Rock `rockIndex` with its links found. */
function closeFrom(
    walkGrid: WalkGrid,
    floodState: FloodState,
    rockIndex: number,
    links: Links,
    pass: ChainPass,
    chain: ChainStep[],
    miss: PressMiss,
): ChainStep[] | null {
    const { finish, stepCells } = links;
    if (finish >= 0) return [...chain, { rockIndex, waterCell: finish }];
    if (stepCells.length === 0) return null;

    // read with no water cell taken for a bridge, at the first link
    if (!pass.reach) pass.reach = reachOf(walkGrid, floodState, pass.available);
    const reach = pass.reach;

    // the links of the other Rocks found before any water cell was taken for a bridge change only once the flood
    // reaches a cell their searches read
    if (chain.length === 0) {
        for (const cell of reach.readersOf.keys()) miss.pushCells.push(cell);
    }

    for (const waterCell of stepCells) {
        const assumed = assume(walkGrid, floodState, waterCell);
        const found = closeWith(walkGrid, floodState, pass, reach, [...chain, { rockIndex, waterCell }], miss);
        retract(walkGrid, floodState, assumed);

        if (found) return found;
    }

    return null;
}

/**
 * The chain that closes the gap after the steps of `chain`, with the first of the Rocks of the pass that does. A Rock
 * whose push search reads no water cell of the steps is not searched again: it has the links its search found before
 * any water cell was taken for a bridge.
 */
function closeWith(
    walkGrid: WalkGrid,
    floodState: FloodState,
    pass: ChainPass,
    reach: ChainReach,
    chain: ChainStep[],
    miss: PressMiss,
): ChainStep[] | null {
    const readers = readersOfSteps(reach, chain);
    const rocksLeft = CHAIN_ROCKS - chain.length;

    for (const rockIndex of pass.available) {
        if (chain.some((step) => step.rockIndex === rockIndex)) continue;

        let found: ChainStep[] | null;
        if (readers.has(rockIndex)) {
            found = closeGap(walkGrid, floodState, rockIndex, pass, chain, miss);
        } else {
            const links = linksBefore(reach, rockIndex, rocksLeft);
            found = closeFrom(walkGrid, floodState, rockIndex, links, pass, chain, miss);
        }

        if (found) return found;
    }

    return null;
}

/**
 * The links of the Rock `rockIndex` with `rocksLeft` Rocks still to come, from what its search found as the second of a
 * chain before any water cell was taken for a bridge: as the last it has no steps.
 */
function linksBefore(reach: ChainReach, rockIndex: number, rocksLeft: number): Links {
    const links = reach.links[rockIndex];
    if (rocksLeft > 1) return links;

    return { finish: links.finish, stepCells: [] };
}

/** Whether the Rock can sink as a link of a chain: it can still sink, and it is no skipping stone, which skips on. */
function chainable(walkGrid: WalkGrid, floodState: FloodState, rockIndex: number): boolean {
    if (walkGrid.triggers.rocks[rockIndex].skips) return false;
    return rockFree(walkGrid, floodState, rockIndex);
}

/** The Rocks of `rockIndices` that can sink as links of a chain, in order. */
function chainableOf(walkGrid: WalkGrid, floodState: FloodState, rockIndices: number[]): number[] {
    return rockIndices.filter((rockIndex) => chainable(walkGrid, floodState, rockIndex));
}

/** How many TELEPORT swaps have put an object in the cell of one of the Rocks `rockIndices`. */
function swapsOfRocks(walkGrid: WalkGrid, floodState: FloodState, rockIndices: number[]): number {
    let count = 0;

    for (const rockIndex of rockIndices) {
        count += swappedTo(floodState, walkGrid.triggers.rocks[rockIndex].cell).length;
    }

    return count;
}

/**
 * Sinks Rocks side by side in a gap of up to three water cells, once the Rocks that turn have bridged what they can alone:
 * each Rock a hero has reached a cell beside is searched as the first of a chain (closeGap), and the Rocks of a chain
 * that closes a gap all sink, each once. Nothing sinks for a chain that does not close, since the Rocks sunk in its first
 * water cells would join no new ground. A Rock whose search found no chain is looked at again only once what it reads
 * has changed or another Rock is due. Returns whether any Rock sank.
 */
export function sinkChained(walkGrid: WalkGrid, floodState: FloodState): boolean {
    const { rocksDue, chainMisses } = floodState;
    const swaps = swapsOfRocks(walkGrid, floodState, rocksDue);
    const pass: ChainPass = { available: chainableOf(walkGrid, floodState, rocksDue), reach: null };
    let sank = false;

    for (const rockIndex of rocksDue) {
        if (!chainable(walkGrid, floodState, rockIndex)) continue;

        const known = chainMisses[rockIndex];
        if (known && known.due === rocksDue.length && !missChanged(walkGrid, floodState, known.miss, swaps)) continue;

        const miss: PressMiss = { inputs: pressInputs(floodState) + swaps, pushCells: [], wallStops: [] };
        const chain = closeGap(walkGrid, floodState, rockIndex, pass, [], miss);

        if (!chain) {
            chainMisses[rockIndex] = { due: rocksDue.length, miss };
            continue;
        }

        for (const { rockIndex: sunkIndex, waterCell } of chain) {
            sinkRock(walkGrid, floodState, sunkIndex, waterCell);
        }

        // the sunk Rocks are links no more, and their bridges change what the others read
        pass.available = chainableOf(walkGrid, floodState, rocksDue);
        pass.reach = null;
        sank = true;
    }

    return sank;
}
