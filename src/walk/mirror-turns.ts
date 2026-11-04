// Magic Mirrors pushed with turns: a Mirror the walk pushes to another cell hops from there (MOVEMENT.md "Magic
// mirrors", VIEWER.md "Moves", "Magic-mirror hops")
import { roomOf } from './beams.ts';
import { cellOnSide, MOVABLE, SIDES, TRAVEL_MARK, Z_BIAS } from './cells.ts';
import type { FloodState } from './flood.ts';
import { missChanged, PRESS_CELLS, pressInputs } from './gates.ts';
import type { PressMiss } from './gates.ts';
import { armHops, magicMirrorsOf, rivalBlocks, rivalsByRoom } from './mirror-isles.ts';
import type { Rival } from './mirror-isles.ts';
import { settle, visitReached } from './queue.ts';
import { pushLandings, rockStands, sinkOf } from './rock-turns.ts';
import { sunkTracks } from './rovers.ts';
import { LAYER_COUNT, pushes } from './skills.ts';
import { hopBlocked } from './support.ts';
import type { WalkGrid } from './walker.ts';

/**
 * A flat magic Mirror the hero may push: its pid, the cell the save last left it in and the sides of its two open arms.
 * `rivals`: the magic Mirrors, vertical ones too, in each room.
 */
export interface MirrorTurn {
    pid: number;
    cell: number;
    arms: [first: number, second: number];
    rivals: Map<string, Rival[]>;
}

/**
 * The magic Mirrors whose pushes may turn: the flat ones below the map rooms that are pushable and do not ride a Lily,
 * in the order of the level data.
 */
export function mirrorTurnsOf(walkGrid: WalkGrid): MirrorTurn[] {
    const { grid, layerCells, boxZ, lilyCells } = walkGrid;
    const mirrors = magicMirrorsOf(walkGrid);
    const rivals = rivalsByRoom(walkGrid, mirrors);
    const turns: MirrorTurn[] = [];

    for (const { pid, mirrorCell, vertical, arms } of mirrors) {
        const [firstArm, secondArm] = arms;
        const mirrorZ = Math.floor(mirrorCell / layerCells) - Z_BIAS;
        if (vertical || firstArm < 0 || secondArm < 0 || mirrorZ >= boxZ) continue;
        if (!(grid[mirrorCell] & MOVABLE) || lilyCells.has(mirrorCell)) continue;

        turns.push({ pid, cell: mirrorCell, arms, rivals });
    }

    return turns;
}

/**
 * The cells a Mirror may stand in: the first is its own, then the cells it is pushed to, and last the cells it rides
 * (`riding`).
 */
interface MirrorPositions {
    cells: number[];
    riding: Set<number>;
}

/**
 * The cells a Mirror in `mirrorCell` is pushed to, as a Rock is in bridgeOf: nearest first over at most PRESS_CELLS
 * cells, by a hero who stands in a cell the flood reached in a pushing layer. A push that sinks the Mirror in water ends
 * it there, but for a push onto the track of a sunk Rover: the Mirror rides the Rover, so every cell of the track is a
 * place it stands in (the Rover may be under any of them). A Mirror that stands on a track already rides it. The push
 * cells turned down go to `miss`.
 */
function positionsOf(walkGrid: WalkGrid, floodState: FloodState, mirrorCell: number, miss: PressMiss): MirrorPositions {
    const positions = [mirrorCell];
    const seen = new Set(positions);
    const tracks = sunkTracks(walkGrid, floodState);
    const riding = new Set<number>();

    const ride = (cell: number): void => {
        for (const track of tracks) {
            if (!track.includes(cell)) continue;

            for (const trackCell of track) riding.add(trackCell);
        }
    };

    ride(mirrorCell);

    for (let index = 0; index < positions.length && index < PRESS_CELLS; index++) {
        pushLandings(walkGrid, floodState, positions[index], miss, (landing) => {
            if (landing.sinks) {
                ride(landing.cell);
                return;
            }

            if (seen.has(landing.cell)) return;

            seen.add(landing.cell);
            positions.push(landing.cell);
        });
    }

    for (const cell of riding) {
        if (!seen.has(cell)) positions.push(cell);
    }

    return { cells: positions, riding };
}

/** Whether `cell` ends the track made of `track`: at most one of the cells beside it belongs to the track. */
function endsTrack(walkGrid: WalkGrid, track: Set<number>, cell: number): boolean {
    let neighbours = 0;

    for (const side of SIDES) {
        if (track.has(cellOnSide(walkGrid, cell, side))) neighbours++;
    }

    return neighbours <= 1;
}

/**
 * The end cells of the Rover tracks in `riding` where a Rock that stands can be pushed to sink. The Rock then holds a
 * hero there and keeps the Rover off the cell, so a Mirror on the Rover and a hero on the Rock stand apart. A Rock
 * counts here, wherever else it bridges. The push cells turned down go to `miss`.
 */
function rockFilledEnds(walkGrid: WalkGrid, floodState: FloodState, riding: Set<number>, miss: PressMiss): Set<number> {
    const filled = new Set<number>();
    if (riding.size === 0) return filled;

    const { rocks } = walkGrid.triggers;

    rocks.forEach((rock, rockIndex) => {
        if (!rockStands(walkGrid, floodState, rockIndex)) {
            miss.pushCells.push(...(rock.activators ?? []));
            return;
        }

        sinkOf(walkGrid, floodState, rock.cell, miss, (waterCell) => {
            if (riding.has(waterCell) && endsTrack(walkGrid, riding, waterCell)) filled.add(waterCell);
            return false;
        });
    });

    return filled;
}

/**
 * Notes the hop from `armCell` to `landing` for the rest of the flood, and walks on from `landing` in each walk layer
 * the flood reached `armCell` in. Returns whether the hop is new.
 */
function noteHop(walkGrid: WalkGrid, floodState: FloodState, armCell: number, landing: number): boolean {
    const { hopsAt, hopMarked } = floodState;
    const known = hopsAt.get(armCell);
    if (known?.includes(landing)) return false;

    if (known) {
        known.push(landing);
    } else {
        hopsAt.set(armCell, [landing]);
    }

    if (!(walkGrid.marks[armCell] & TRAVEL_MARK)) {
        walkGrid.marks[armCell] |= TRAVEL_MARK;
        hopMarked.push(armCell);
    }

    if (hopBlocked(walkGrid, floodState, landing)) return true;

    const armZ = Math.floor(armCell / walkGrid.layerCells) - Z_BIAS;

    for (let layer = 0; layer < LAYER_COUNT; layer++) {
        if (walkGrid.visited[armCell] & (1 << layer)) settle(walkGrid, floodState, landing, armZ, layer);
    }

    return true;
}

/**
 * Notes the hops of the Mirror of `turn` standing in `position`, a cell other than its own, off the arm cells that no
 * other magic Mirror of the room of `position` spoils. A hero hops only from an arm cell in that room, since the game
 * handles a mirage only while the Mirror's room holds a Guy. A Mirror on a Rover (`riding`) takes no hop off a cell of
 * the track, where the hero would ride the Rover too, but for a cell a Rock fills (`filled`). Returns whether any hop
 * is new.
 */
function noteHopsFrom(
    walkGrid: WalkGrid,
    floodState: FloodState,
    turn: MirrorTurn,
    position: number,
    riding: Set<number>,
    filled: Set<number>,
): boolean {
    const room = roomOf(walkGrid, position);
    const roomRivals = turn.rivals.get(room);
    const onRover = riding.has(position);
    let added = false;

    const noteArmHop = (armCell: number, landing: number): void => {
        if (roomOf(walkGrid, armCell) !== room || rivalBlocks(roomRivals, [turn.pid], armCell)) return;
        if (onRover && riding.has(armCell) && !filled.has(armCell)) return;
        if (noteHop(walkGrid, floodState, armCell, landing)) added = true;
    };

    const [firstArm, secondArm] = turn.arms;
    armHops(walkGrid, position, firstArm, secondArm, null, turn.cell, noteArmHop);
    armHops(walkGrid, position, secondArm, firstArm, null, turn.cell, noteArmHop);

    return added;
}

/**
 * Hops off the magic Mirrors the walk pushes with turns, once a hero reaches a cell beside one: every cell the Mirror
 * can be pushed to is a place it hops from, the hops of each laid as for a Mirror standing there (the cell it left
 * ends no ray). The hops hold for the rest of the flood, wherever the hero is when he reaches an arm. A Mirror whose
 * search is done is looked at again only once what it reads has changed, the Rovers the flood sank included. Returns
 * whether any hop is new.
 */
export function hopTurned(walkGrid: WalkGrid, floodState: FloodState): boolean {
    const { triggers } = walkGrid;
    const { mirrorSeen, mirrorsDue, mirrorMisses } = floodState;

    visitReached(floodState, floodState.mirrorCursor, (cell, layer) => {
        if (!pushes(layer)) return;

        for (const mirrorIndex of triggers.mirrorTurnsAt.get(cell) || []) {
            if (mirrorSeen[mirrorIndex]) continue;

            mirrorSeen[mirrorIndex] = 1;
            mirrorsDue.push(mirrorIndex);
        }
    });

    let hopped = false;

    for (const mirrorIndex of mirrorsDue) {
        const miss = mirrorMisses[mirrorIndex];
        const sunk = floodState.ferried.length;
        if (miss && !missChanged(walkGrid, floodState, miss, sunk)) continue;

        const turn = triggers.mirrorTurns[mirrorIndex];
        const newMiss: PressMiss = { inputs: pressInputs(floodState) + sunk, pushCells: [], wallStops: [] };
        const { cells, riding } = positionsOf(walkGrid, floodState, turn.cell, newMiss);
        const filled = rockFilledEnds(walkGrid, floodState, riding, newMiss);
        mirrorMisses[mirrorIndex] = newMiss;

        // a Mirror on a Rover takes its own cell's hops here too: the plain hops of a Mirror on a track leave out the
        // track cells
        const firstIndex = riding.has(cells[0]) ? 0 : 1;

        for (let index = firstIndex; index < cells.length; index++) {
            if (filled.has(cells[index])) continue;
            if (noteHopsFrom(walkGrid, floodState, turn, cells[index], riding, filled)) hopped = true;
        }
    }

    return hopped;
}
