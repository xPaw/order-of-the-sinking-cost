// Lilies and the rivers they drift on (movement.md "Lilies", "Rivers")
import { cellOf, cellOnSide, BEAMSTOP, FLOOR, KICK_MARK, PUSH, SIDES, Z_BIAS } from './cells.ts';
import type { FloodState } from './flood.ts';
import { exists, place, put } from './groups.ts';
import { waterAt } from './ocean.ts';
import type { Kick } from './skipping-stones.ts';
import { blocked, land } from './support.ts';
import type { WalkGrid } from './walker.ts';
import { fenced, latestCell } from './walls.ts';

/** Notes that Lily `pid` holds the hero at `cell`. */
function addLily(walkGrid: WalkGrid, cell: number, pid: number): void {
    const lilies = walkGrid.liliesAt.get(cell);
    if (lilies) {
        lilies.add(pid);
    } else {
        walkGrid.liliesAt.set(cell, new Set([pid]));
    }
}

/** Places the Lilies, each where the save last left it (its home). */
export function placeLilies(walkGrid: WalkGrid): void {
    for (const [pid, i, j, z, existence] of walkGrid.world.lilies) {
        const home = latestCell(walkGrid, pid, i, j, z);
        if (home < 0) continue;

        place(walkGrid, pid, existence, () => {
            put(walkGrid, walkGrid.grid, home, FLOOR);
            if (walkGrid.writeLog) return;

            walkGrid.lilyCells.add(home);
            addLily(walkGrid, home, pid);
            walkGrid.lilyHomes.set(pid, home);
        });
    }
}

/** The homes of the Lilies that hold the hero at `cell`: what stands in them rides those Lilies. */
function homesOfLiliesAt(walkGrid: WalkGrid, cell: number): Set<number> {
    const homes = new Set<number>();
    for (const pid of walkGrid.liliesAt.get(cell) ?? []) {
        const home = walkGrid.lilyHomes.get(pid);
        if (home !== undefined) homes.add(home);
    }

    return homes;
}

/**
 * The cells a Lily drifts through from `start`, a cell on a river, that cell first, until a step is blocked or the
 * drift repeats. None off a river.
 */
function driftOf(walkGrid: WalkGrid, start: number): number[] {
    const { flowSide, width, height, layerCells } = walkGrid;
    const startSide = flowSide.get(start);
    if (start < 0 || startSide === undefined) return [];

    const stepLimit = 4 * (width + height);
    const lilyZ = Math.floor(start / layerCells) - Z_BIAS;
    const riderCells = new Set([start]);
    const states = new Set<number>();
    const cells = [start];
    let current = start;
    let side = startSide;

    for (let step = 0; step < stepLimit; step++) {
        const flow = flowSide.get(current);
        if (flow !== undefined) side = flow;

        const state = current * 4 + side;
        if (states.has(state)) break;
        states.add(state);

        const next = cellOnSide(walkGrid, current, side);
        if (!lilyEnters(walkGrid, walkGrid.noFlood, next, lilyZ, riderCells)) break;

        current = next;
        cells.push(next);
    }

    return cells;
}

/**
 * Lilies drift in real time with the river under them, so a Lily on a river is at every cell of its drift from
 * where the save last left it (until a step is blocked or the drift repeats), not at that cell alone. A Lily that
 * does not exist drifts nowhere.
 */
export function placeDrift(walkGrid: WalkGrid): void {
    const { world, driftCells } = walkGrid;

    for (const [pid, i, j, z, existence] of world.lilies) {
        if (!exists(walkGrid, pid, existence)) continue;

        for (const cell of driftOf(walkGrid, latestCell(walkGrid, pid, i, j, z))) {
            driftCells.add(cell);
            addLily(walkGrid, cell, pid);
        }
    }
}

/**
 * A Lily the save left adrift on a river that its level data places on still water was kicked off its start, and the
 * history says which way: the way of its first recorded move. Its ride from the start (lilyRide) holds the hero when it
 * comes to the Lily's latest cell, since the hero may have boarded it on the way. A Lily that rests off the river
 * stays where it is.
 */
export function placeKickedRides(walkGrid: WalkGrid): void {
    const { world, driftCells, flowSide, latest, cornerX, cornerY, layerCells } = walkGrid;

    for (const [pid, i, j, z, existence] of world.lilies) {
        if (!exists(walkGrid, pid, existence)) continue;

        const side = latest.firstHeadings.get(pid);
        if (side === undefined) continue;

        const start = cellOf(walkGrid, i + cornerX, j + cornerY, z);
        const resting = latestCell(walkGrid, pid, i, j, z);
        if (start < 0 || resting < 0 || flowSide.has(start) || !flowSide.has(resting)) continue;

        const lilyZ = Math.floor(start / layerCells) - Z_BIAS;
        const ride = lilyRide(walkGrid, start, side, lilyZ);
        if (!ride.includes(resting)) continue;

        for (const cell of ride) {
            driftCells.add(cell);
            addLily(walkGrid, cell, pid);
        }
    }
}

/**
 * Whether the hero steps off the drift or track cell `cell` onto a reached cell that is neither, within a layer of it.
 */
function stepsOffDrift(walkGrid: WalkGrid, reached: Set<number>, cell: number): boolean {
    const { grid, driftCells, rideCells, ferryCells, layerCells, noFlood } = walkGrid;

    for (const side of SIDES) {
        const target = cellOnSide(walkGrid, cell, side);
        if (target < 0 || target === cell) continue;
        if (fenced(walkGrid, cell, side, target) || grid[target] & PUSH) continue;

        const landing = land(walkGrid, noFlood, target);
        if (landing < 0 || !reached.has(landing)) continue;
        if (driftCells.has(landing) || rideCells.has(landing) || ferryCells.has(landing)) continue;
        if (Math.abs(Math.floor(landing / layerCells) - Math.floor(cell / layerCells)) <= 1) return true;
    }

    return false;
}

/**
 * The reached cells of the Lilies' drifts and of the tracks of the sunk Rovers that the hero rides through without a
 * way off: no step off them lands on a reached cell outside the drifts and tracks.
 */
export function transitCells(walkGrid: WalkGrid, reached: Set<number>): Set<number> {
    const transit = new Set<number>();

    for (const rides of [walkGrid.driftCells, walkGrid.rideCells, walkGrid.ferryCells]) {
        for (const cell of rides) {
            if (reached.has(cell) && !stepsOffDrift(walkGrid, reached, cell)) transit.add(cell);
        }
    }

    return transit;
}

/**
 * The drifts of the Lilies that a Spawner respawns in a river cell, as kicks: the cells hold the hero once the flood
 * reaches an Activator that runs the Spawner (the Activator's cell, where the hero uses it). The Lily itself stays
 * where the save left it.
 */
export function respawnKicks(walkGrid: WalkGrid): Kick[] {
    const kicks: Kick[] = [];

    for (const spawn of walkGrid.geometry.lilySpawns) {
        if (!exists(walkGrid, spawn.spawnerPid, spawn.spawnerExistence)) continue;

        const cells = driftOf(walkGrid, spawn.spawnerCell);
        if (cells.length === 0) continue;

        for (const cell of cells) walkGrid.marks[cell] |= KICK_MARK;

        for (const activator of spawn.activators) {
            if (!exists(walkGrid, activator.pid, activator.existence) || activator.cell < 0) continue;
            kicks.push({ stone: activator.cell, pushCell: activator.cell, cells });
        }
    }

    return kicks;
}

/**
 * The cells a Lily rides through from `start`, the landing cell, on. A stone that comes to rest on a Lily kicks it
 * along its own heading; the Lily then drifts with the river under it (coasting on in its last direction over still
 * water) until a step is blocked or the drift repeats.
 */
export function lilyRide(walkGrid: WalkGrid, start: number, kickSide: number, z: number): number[] {
    const { flowSide, width, height } = walkGrid;
    const stepLimit = 4 * (width + height);
    const cells = [start];
    const riderCells = homesOfLiliesAt(walkGrid, start);
    const states = new Set<number>();
    let current = start;
    let side = kickSide;

    for (let step = 0; step < stepLimit; step++) {
        const flow = flowSide.get(current);
        if (step > 0 && flow !== undefined) side = flow;

        const state = current * 4 + side;
        if (states.has(state)) break;
        states.add(state);

        const next = cellOnSide(walkGrid, current, side);

        // a blocked kick still leaves the Lily to the river's current
        if (!lilyEnters(walkGrid, walkGrid.noFlood, next, z, riderCells)) continue;

        current = next;
        if (!cells.includes(next)) cells.push(next);
    }

    return cells;
}

/**
 * The cells Lily `pid` drifts through when it is kicked toward `side` where the save left it, that cell first: the
 * drift of a Lily that rides a stone (lilyRide). None for a Lily that drifts on a river already.
 */
export function kickRide(walkGrid: WalkGrid, pid: number, side: number): number[] {
    const home = walkGrid.lilyHomes.get(pid);
    if (home === undefined || walkGrid.flowSide.has(home)) return [];

    const lilyZ = Math.floor(home / walkGrid.layerCells) - Z_BIAS;
    return lilyRide(walkGrid, home, side, lilyZ);
}

/**
 * Whether a drifting Lily at height z can enter `cell`. What stands in `riderCells`, the Lily's home cells, rides the
 * Lily and moves with it, so it never blocks the Lily.
 */
function lilyEnters(
    walkGrid: WalkGrid,
    floodState: FloodState,
    cell: number,
    z: number,
    riderCells: Set<number>,
): boolean {
    const waterZ = waterAt(walkGrid, cell % walkGrid.layerCells, z);
    if (waterZ == null || Math.abs(z - waterZ) > 0.5) return false;
    if (blocked(walkGrid, floodState, cell)) return false;
    if (riderCells.has(cell)) return true;
    return !(walkGrid.grid[cell] & (PUSH | BEAMSTOP));
}
