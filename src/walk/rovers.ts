// Rovers that sank in water and drive on under it: the hero boards one where it runs and steps off where its track
// borders ground (movement.md "Rovers", "Objects in water", viewer.md "Moves")
import { latestF32 } from '../save.ts';
import { cellOnSide, mod, PUSH, RIDE_MARK, SOLID, Z_BIAS } from './cells.ts';
import type { FloodState } from './flood.ts';
import { missChanged, pressInputs } from './gates.ts';
import type { PressMiss } from './gates.ts';
import { exists } from './groups.ts';
import { levelWater } from './ocean.ts';
import { requeue, visitReached } from './queue.ts';
import { sinkOf } from './rock-turns.ts';
import { pushes } from './skills.ts';
import { blocked, standable } from './support.ts';
import type { WalkGrid } from './walker.ts';
import { fenced, latestCell } from './walls.ts';

// the world.json movables kind of a Rover
const ROVER_KIND = 3;

/** An existing Rover: its pid, the cell the save last left it in and the side it runs along (0 east-west, 1 north-south). */
export interface RoverCell {
    pid: number;
    cell: number;
    side: number;
}

/** A Rover the flood sank: the cell over where it rests and the side it runs along. */
export interface SunkRover {
    start: number;
    side: number;
}

/** The side a Rover runs along: its latest `theta_target`, else the level data's, as an even or odd quarter turn. */
function runSideOf(walkGrid: WalkGrid, pid: number): number {
    let quarterTurns = walkGrid.geometry.roverFacings.get(pid) ?? 0;
    const theta = latestF32(walkGrid.latest, pid, 'base.theta_target');
    if (theta !== undefined) quarterTurns = Math.round(theta / 90);

    return mod(quarterTurns, 2);
}

/**
 * Whether the Rover drives from the cell above `cell` into `next` (cells at the hero's height, the Rover under them): the
 * water there is level with the hero's height, no Fence lies between and nothing solid, no Rock or movable and no
 * sunk Rock the flood made fills the cell under it.
 */
function roverEnters(walkGrid: WalkGrid, floodState: FloodState, cell: number, side: number, next: number): boolean {
    const z = Math.floor(next / walkGrid.layerCells) - Z_BIAS;
    if (fenced(walkGrid, cell, side, next) || !levelWater(walkGrid, next, z)) return false;
    if (blocked(walkGrid, floodState, next) || floodState.bridged.has(next)) return false;

    return !(walkGrid.grid[next - walkGrid.layerCells] & (SOLID | PUSH));
}

/**
 * The cells, at the hero's height, a sunk Rover runs through from `start` (the cell over where it rests) along `side`
 * and back: it drives to the end of its track in each direction and turns round there, so the hero finds it in any of
 * them.
 */
export function roverTrack(walkGrid: WalkGrid, floodState: FloodState, start: number, side: number): number[] {
    const stepLimit = walkGrid.width + walkGrid.height;
    const cells = [start];

    for (const direction of [side, (side + 2) % 4]) {
        let current = start;

        for (let step = 0; step < stepLimit; step++) {
            const next = cellOnSide(walkGrid, current, direction);
            if (cells.includes(next) || !roverEnters(walkGrid, floodState, current, direction, next)) break;

            cells.push(next);
            current = next;
        }
    }

    return cells;
}

/**
 * Lists the existing Rovers, and the tracks of those the save left sunk in water: the cells over them hold the hero from
 * the start (`rideCells`).
 */
export function placeRovers(walkGrid: WalkGrid): void {
    const { world, rovers, rideCells, layerCells, noFlood } = walkGrid;

    for (const [pid, column, row, z, kind, existence] of world.movables || []) {
        if (kind !== ROVER_KIND || !exists(walkGrid, pid, existence)) continue;

        const cell = latestCell(walkGrid, pid, column, row, z);
        if (cell < 0) continue;

        const rover: RoverCell = { pid, cell, side: runSideOf(walkGrid, pid) };
        rovers.push(rover);

        const over = cell + layerCells;
        const overZ = Math.floor(over / layerCells) - Z_BIAS;
        if (!levelWater(walkGrid, over, overZ)) continue;

        for (const trackCell of roverTrack(walkGrid, noFlood, over, rover.side)) rideCells.add(trackCell);
    }
}

/**
 * The tracks of the Rovers sunk in water, as the flood has the water cells: those the save left sunk and those the
 * flood sank. A cell a Rock sank in ends a track.
 */
export function sunkTracks(walkGrid: WalkGrid, floodState: FloodState): number[][] {
    const { rovers, rideCells, layerCells } = walkGrid;
    const tracks: number[][] = [];

    for (const { cell, side } of rovers) {
        const over = cell + layerCells;
        if (rideCells.has(over)) tracks.push(roverTrack(walkGrid, floodState, over, side));
    }

    for (const { start, side } of floodState.ferried) {
        tracks.push(roverTrack(walkGrid, floodState, start, side));
    }

    return tracks;
}

/** The Rovers a flood may push into water: those that rest on dry cells (not over the sunk ones, which ride). */
export function roverTurnsOf(walkGrid: WalkGrid): RoverCell[] {
    const { rovers, layerCells } = walkGrid;
    return rovers.filter(({ cell }) => !walkGrid.rideCells.has(cell + layerCells));
}

/**
 * Whether a Rover that sank under a track joins ground the flood reached to ground it has not: a cell of the track
 * borders a reached cell, where the hero boards, and another borders a cell a hero stands in that is not reached, where he
 * steps off. The cells beside the track go to `miss`.
 */
function joinsNewGround(walkGrid: WalkGrid, floodState: FloodState, track: number[], miss: PressMiss): boolean {
    let boards = false;
    let leaves = false;

    for (const cell of track) {
        for (let side = 0; side < 4; side++) {
            const beside = cellOnSide(walkGrid, cell, side);
            if (track.includes(beside)) continue;

            miss.pushCells.push(beside);

            if (walkGrid.visited[beside] !== 0) {
                boards = true;
            } else if (standable(walkGrid, floodState, beside) && !floodState.outside?.has(beside)) {
                leaves = true;
            }
        }
    }

    return boards && leaves;
}

/**
 * Pushes the Rovers the walk has reached a cell beside into water: a Rover pushed from its cell (or on over dry cells)
 * to a cell where it sinks drives on under the water along its axis, so the cells of its track hold the hero from then
 * on. Each Rover sinks once, where its track joins new ground. A Rover whose search found no such place is looked at
 * again only once what it reads has changed. Returns whether any Rover sank.
 */
export function ferry(walkGrid: WalkGrid, floodState: FloodState): boolean {
    const { triggers, marks } = walkGrid;
    const { roversDue, roverSeen, roverSpent, roverMisses, rideMarked } = floodState;

    visitReached(floodState, floodState.roverCursor, (cell, layer) => {
        if (!pushes(layer)) return;

        for (const roverIndex of triggers.roversAt.get(cell) || []) {
            if (roverSeen[roverIndex]) continue;
            roverSeen[roverIndex] = 1;
            roversDue.push(roverIndex);
        }
    });

    let sank = false;

    for (const roverIndex of roversDue) {
        if (roverSpent[roverIndex]) continue;

        const { cell, side } = triggers.rovers[roverIndex];
        const miss = roverMisses[roverIndex];
        if (miss && !missChanged(walkGrid, floodState, miss)) continue;

        const newMiss: PressMiss = { inputs: pressInputs(floodState), pushCells: [], wallStops: [] };
        let track: number[] = [];

        const waterCell = sinkOf(walkGrid, floodState, cell, newMiss, (sinkCell) => {
            track = roverTrack(walkGrid, floodState, sinkCell, side);
            return joinsNewGround(walkGrid, floodState, track, newMiss);
        });

        if (waterCell < 0) {
            roverMisses[roverIndex] = newMiss;
            continue;
        }

        roverSpent[roverIndex] = 1;
        floodState.ferried.push({ start: waterCell, side });

        for (const trackCell of track) {
            walkGrid.ferryCells.add(trackCell);
            if (marks[trackCell] & RIDE_MARK) continue;
            marks[trackCell] |= RIDE_MARK;
            rideMarked.push(trackCell);
        }

        for (const trackCell of track) requeue(walkGrid, floodState, trackCell);
        sank = true;
    }

    return sank;
}
