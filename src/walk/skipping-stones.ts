// Skipping stones: the skip lanes and the TELEPORT swap onto a stone (movement.md "Skipping stones", viewer.md "Skip
// lanes and the TELEPORT swap")
import { rawU16 } from '../save.ts';
import { cellOnSide, DIRS, KICK_MARK, neighbourOf, PUSH, SOLID, Z_BIAS } from './cells.ts';
import type { FloodState } from './flood.ts';
import { freeze, thaw } from './freezers.ts';
import { walled } from './gates.ts';
import { exists } from './groups.ts';
import { kickRide, lilyRide } from './lilies-and-rivers.ts';
import { deep, levelWater, waterAt } from './ocean.ts';
import { push, requeue, visitReached } from './queue.ts';
import { landingOf, pushableIn } from './rock-turns.ts';
import type { Landing } from './rock-turns.ts';
import { doorIn, doorOut, pushes, WIZARD } from './skills.ts';
import { blocked, heldFromBelow, holdsStone, standable } from './support.ts';
import type { WalkGrid } from './walker.ts';
import { fenced, latestCell } from './walls.ts';

// the parts of a skip lane a flood reaches before the swap: its launch push cell, a cell next to the stone, a line cell
const LANE_PUSH = 1;
const LANE_NEAR = 2;
const LANE_FROM = 4;
const LANE_READY = LANE_PUSH | LANE_NEAR | LANE_FROM;

// Rock.properties
const SKIPPABLE = 2;
const FLIPPING_TARGET = 8;

// how many cells a charmed stone lands on, at most, while its launches are looked for
const MAX_PUSH_POSITIONS = 200;

/**
 * A skip lane: the stone's cell, the launch push cell, the landing cell, the ride (the landing cell, then the cells a
 * Lily there drifts through), the line cells from the ride the hero can stand in and those of them past a gap in the
 * line, the cells next to the stone, and the Freezers on the ride's Lily cells that the lane was found with open.
 */
export interface SkipLane {
    stone: number;
    pushCell: number;
    landing: number;
    ride: number[];
    from: number[];
    cross: number[];
    near: number[];
    freezers: LaneFreezer[];
}

/** A Freezer in the cell of a Lily's home or the cell above it: its cell and its index. */
interface LaneFreezer {
    cell: number;
    freezerIndex: number;
}

/**
 * A Lily that starts drifting once the flood reaches a cell: the cell the launch comes from, the push cell that starts
 * it and the cells the Lily drifts through (its cell first). A stone launched from `stone` kicks the Lily; for a Lily a
 * Spawner respawns, the Activator's cell is both.
 */
export interface Kick {
    stone: number;
    pushCell: number;
    cells: number[];
}

/** A launch of a stone into water: the side it is pushed to, the push cell and the first water cell. */
type Launch = [side: number, pushCell: number, firstWater: number];

/** The cells of the TELEPORT lines from a landing cell the hero can stand in, and those of them past a gap. */
interface LineCells {
    from: number[];
    cross: number[];
}

/** Whether a stone's latest `properties` (if any) leave it a skipping stone: SKIPPABLE and not FLIPPING_TARGET. */
function skippableNow(properties: Uint8Array | undefined): boolean {
    if (!properties) return true;
    const bits = rawU16(properties);
    return (bits & SKIPPABLE) !== 0 && (bits & FLIPPING_TARGET) === 0;
}

/**
 * The launches of the stone in `stoneCell` at height z from the cells it is pushed to over dry land, nearest first. The
 * hero may push it from the cell it started in once it has left.
 */
function launchesOf(walkGrid: WalkGrid, stoneCell: number, z: number): Launch[] {
    const { grid, noFlood } = walkGrid;
    const positions = new Set([stoneCell]);
    const todo = [stoneCell];
    const launches: Launch[] = [];

    for (let index = 0; index < todo.length; index++) {
        const position = todo[index];

        for (let side = 0; side < 4; side++) {
            const pushCell = cellOnSide(walkGrid, position, (side + 2) % 4);
            const into = cellOnSide(walkGrid, position, side);
            if (blocked(walkGrid, noFlood, pushCell) || !standable(walkGrid, noFlood, pushCell)) continue;
            if (fenced(walkGrid, pushCell, side, position) || fenced(walkGrid, position, side, into)) continue;
            if (into !== stoneCell && (blocked(walkGrid, noFlood, into) || grid[into] & PUSH)) continue;

            if (holdsStone(walkGrid, noFlood, into, z)) {
                if (positions.has(into)) continue;
                positions.add(into);
                todo.push(into);
            } else if (levelWater(walkGrid, into, z)) {
                launches.push([side, pushCell, into]);
            }
        }
    }

    return launches;
}

/**
 * The TELEPORT line cells from `landing` at height z: each line runs until a wall, a shut Gate, a frozen cell, a
 * target or a Wardrobe door edge.
 */
function lineCells(walkGrid: WalkGrid, landing: number, z: number): LineCells {
    const { grid, width, height, layerCells, noFlood } = walkGrid;
    const from: number[] = [];
    const cross: number[] = [];

    for (let side = 0; side < 4; side++) {
        const back = (side + 2) % 4;
        let gap = false;
        let previous = landing;
        let cell = cellOnSide(walkGrid, landing, side);

        for (let stepsOut = 0; stepsOut < width + height && cell !== landing; stepsOut++) {
            if (blocked(walkGrid, noFlood, cell) || grid[cell] & PUSH) break;
            if (doorOut(walkGrid, cell, back) >= 0 || doorIn(walkGrid, previous, back) >= 0) break;

            const waterZ = waterAt(walkGrid, cell % layerCells, z);
            const underWater = waterZ != null && z < waterZ - 0.1;
            if (standable(walkGrid, noFlood, cell) && !underWater) {
                from.push(cell);
                if (gap) cross.push(cell);
                gap = false;
            } else {
                gap = true;
            }

            previous = cell;
            cell = cellOnSide(walkGrid, cell, side);
        }
    }

    return { from, cross };
}

/**
 * Adds the lanes of a stone launched `side` from `pushCell` that lands on `landing`: one lane per ride cell the hero
 * swaps into and the end of the ride from there, the whole rest of the ride, or up to the line cell the hero swapped
 * from when it lies ahead on the ride (the stone, swapped into that cell, stops the Lily there).
 */
function addLanes(
    walkGrid: WalkGrid,
    lanes: SkipLane[],
    stoneCell: number,
    side: number,
    pushCell: number,
    landing: number,
    z: number,
    lilyFreezers: LaneFreezer[],
): void {
    const { lilyCells, driftCells, liliesAt, noFlood } = walkGrid;
    let ride = [landing];
    if (lilyCells.has(landing) || driftCells.has(landing)) ride = lilyRide(walkGrid, landing, side, z);

    const freezers = freezersOnRide(walkGrid, lilyFreezers, landing, ride);

    // the Lily the stone rides carries no hero, so a cell that only it holds up is no line cell
    const riding = liliesAt.get(landing);

    const onlyRidingLily = (cell: number): boolean => {
        if (riding?.size !== 1 || heldFromBelow(walkGrid, noFlood, cell)) return false;

        const there = liliesAt.get(cell);
        if (there?.size !== 1) return false;

        const [lilyThere] = there;
        return riding.has(lilyThere);
    };

    const near = DIRS.map(([dx, dy]) => neighbourOf(walkGrid, stoneCell, dx, dy));

    ride.forEach((cell, rideIndex) => {
        const lines = lineCells(walkGrid, cell, z);
        const pastGap = new Set(lines.cross);
        const byEnd = new Map<number, LineCells>();

        for (const fromCell of lines.from) {
            if (onlyRidingLily(fromCell)) continue;

            const ahead = ride.indexOf(fromCell, rideIndex + 1);
            const end = ahead < 0 ? ride.length : ahead;

            let lineOfEnd = byEnd.get(end);
            if (!lineOfEnd) {
                lineOfEnd = { from: [], cross: [] };
                byEnd.set(end, lineOfEnd);
            }

            lineOfEnd.from.push(fromCell);
            if (pastGap.has(fromCell)) lineOfEnd.cross.push(fromCell);
        }

        for (const [end, { from, cross }] of byEnd) {
            lanes.push({
                stone: stoneCell,
                pushCell,
                landing,
                ride: ride.slice(rideIndex, end),
                from,
                cross,
                near,
                freezers,
            });
        }
    });
}

/**
 * Skip lanes, for the TELEPORT swap onto a skipping stone. A SKIPPABLE Rock (where the save last left it, unless it
 * sank) is pushed over dry cells and launched into water level with its z (surface within 0.5); it skips straight
 * on to the first cell that holds it or a cell a Lily drifts through (landingsOf), and is lost at a wall, a Rock or
 * a Fence. A hero with TELEPORT standing on a line from that landing cell (it runs in each direction until a wall, a
 * shut Gate, a frozen cell, a target or a Wardrobe door edge) swaps onto the stone. A stone that lands on a Lily rides
 * it, and so does a hero who swaps onto it, who can step off anywhere along the ride.
 *
 * The lanes are found with the Freezers in a Lily's cell open, since a closed one would hide the Lily; a lane whose ride
 * passes such a Freezer lists it, and a flood takes the lane only once it is open (takeLane). A pocket flood, which
 * cannot stand on water, holds the hero on the cells of the rides that have more than the landing cell.
 */
export function skipLanes(walkGrid: WalkGrid): SkipLane[] {
    const lanes: SkipLane[] = [];

    const lilyFreezers: LaneFreezer[] = [];
    for (const [cell, freezerIndex] of walkGrid.frozen) {
        const lilyHere = walkGrid.lilyCells.has(cell);
        const lilyAbove = walkGrid.lilyCells.has(cell + walkGrid.layerCells);
        if (lilyHere || lilyAbove) lilyFreezers.push({ cell, freezerIndex });
    }

    for (const { cell } of lilyFreezers) thaw(walkGrid, cell);

    for (const [stoneCell, z] of skippingStones(walkGrid)) {
        walkGrid.stoneCells.add(stoneCell);

        for (const [side, pushCell, firstWater] of launchesOf(walkGrid, stoneCell, z)) {
            for (const landing of landingsOf(walkGrid, walkGrid.noFlood, side, firstWater, z)) {
                addLanes(walkGrid, lanes, stoneCell, side, pushCell, landing, z, lilyFreezers);
            }
        }
    }

    for (const { cell, freezerIndex } of lilyFreezers) freeze(walkGrid, cell, freezerIndex);

    for (const lane of lanes) {
        if (lane.ride.length < 2) continue;

        for (const cell of lane.ride) {
            walkGrid.laneRides.add(cell);
            walkGrid.marks[cell] |= KICK_MARK;
        }
    }

    return lanes;
}

/**
 * The Freezers among `candidates` that stand in a column the ride passes through or in the column of the home of a
 * Lily the stone rides on, wherever along its drift the stone landed.
 */
function freezersOnRide(walkGrid: WalkGrid, candidates: LaneFreezer[], landing: number, ride: number[]): LaneFreezer[] {
    const layerCells = walkGrid.layerCells;
    const columns = new Set(ride.map((cell) => cell % layerCells));

    for (const pid of walkGrid.liliesAt.get(landing) ?? []) {
        const home = walkGrid.lilyHomes.get(pid);
        if (home !== undefined) columns.add(home % layerCells);
    }

    return candidates.filter(({ cell }) => columns.has(cell % layerCells));
}

/**
 * The existing SKIPPABLE Rocks that have not sunk and are not under water: each one's cell (where the save last left
 * it), z and pid.
 */
export function skippingStones(walkGrid: WalkGrid): Array<[stoneCell: number, z: number, pid: number]> {
    const { world, latest, layerCells } = walkGrid;
    const stones: Array<[number, number, number]> = [];
    const skippable = new Set(world.skippable || []);

    for (const [pid, i, j, levelZ, existence] of world.rocks) {
        if (!skippable.has(pid) || !exists(walkGrid, pid, existence)) continue;
        if (!skippableNow(latest.get(pid, 'properties'))) continue;

        const stoneCell = latestCell(walkGrid, pid, i, j, levelZ);
        if (stoneCell < 0 || deep(walkGrid, stoneCell)) continue;

        const z = Math.floor(stoneCell / layerCells) - Z_BIAS;
        stones.push([stoneCell, z, pid]);
    }

    return stones;
}

/**
 * The cells a stone at `place` skips onto when launched `side` into water: none unless the cell ahead is open, holds
 * no pushable and no stone, and has water level with z.
 */
function charmLandingsFrom(walkGrid: WalkGrid, place: number, side: number, z: number): number[] {
    const noFlood = walkGrid.noFlood;
    const firstWater = cellOnSide(walkGrid, place, side);
    if (fenced(walkGrid, place, side, firstWater)) return [];
    if (blocked(walkGrid, noFlood, firstWater) || walkGrid.grid[firstWater] & PUSH) return [];
    if (!levelWater(walkGrid, firstWater, z) || holdsStone(walkGrid, noFlood, firstWater, z)) return [];

    return landingsOf(walkGrid, noFlood, side, firstWater, z);
}

/** Whether no hero steps onto `cell` from a cell beside it: none of the four is a cell he can stand in. */
function isIslet(walkGrid: WalkGrid, cell: number): boolean {
    for (let side = 0; side < 4; side++) {
        if (standable(walkGrid, walkGrid.noFlood, cellOnSide(walkGrid, cell, side))) return false;
    }

    return true;
}

/**
 * The stones a hero with CHARM launches (the MIRRORABLE ones, movement.md "Skipping stones", skills.md "CHARM"): a
 * stone is launched from the cell the save left it in, and from each cell it lands on, which it is then launched from
 * again (at most MAX_PUSH_POSITIONS cells). `charmStones`: the cells the stones stand in; `charmPlaces`: those and the
 * landings; `charmIslets`: the places no hero steps onto, whose Switch the object search alone decides.
 */
export function placeCharmStones(walkGrid: WalkGrid): void {
    const { charmStones, charmPlaces, charmIslets } = walkGrid;
    const mirrorable = new Set(walkGrid.world.mirrorable || []);

    for (const [stoneCell, z, pid] of skippingStones(walkGrid)) {
        if (!mirrorable.has(pid)) continue;

        charmStones.add(stoneCell);
        charmPlaces.add(stoneCell);
        const todo = [stoneCell];

        while (todo.length > 0 && charmPlaces.size < MAX_PUSH_POSITIONS) {
            const place = todo.pop();
            if (place === undefined) break;

            for (let side = 0; side < 4; side++) {
                for (const landing of charmLandingsFrom(walkGrid, place, side, z)) {
                    if (charmPlaces.has(landing)) continue;

                    charmPlaces.add(landing);
                    todo.push(landing);
                }
            }
        }
    }

    for (const place of charmPlaces) {
        if (!charmStones.has(place) && isIslet(walkGrid, place)) charmIslets.add(place);
    }
}

/**
 * The cells a stone skipping `side` from water cell `firstWater` hops out of, as landingsOf walks them: each cell it
 * reaches up to the last, where it stops on a cell that holds it, sinks in place against a fence, a blocked cell or a
 * pushable, or hops into a cell without level water. Every one of those hops kicks.
 */
function hopStartsOf(
    walkGrid: WalkGrid,
    floodState: FloodState,
    side: number,
    firstWater: number,
    z: number,
): number[] {
    const { grid, driftCells } = walkGrid;
    const starts: number[] = [];
    let current = firstWater;

    for (let stepsOut = 0; stepsOut < walkGrid.width + walkGrid.height; stepsOut++) {
        const next = cellOnSide(walkGrid, current, side);
        starts.push(current);

        if (fenced(walkGrid, current, side, next)) break;
        if (blocked(walkGrid, floodState, next) || grid[next] & PUSH) break;

        const drifting = driftCells.has(next) && levelWater(walkGrid, next, z);
        const stopsThere = !drifting && holdsStone(walkGrid, floodState, next, z);
        if (!drifting && !stopsThere && !levelWater(walkGrid, next, z)) break;

        if (stopsThere) break;
        current = next;
    }

    return starts;
}

/**
 * The Lilies a launched skipping stone kicks. Each hop pushes the Lily next to the stone's cell, on either side of its
 * heading, one step outward; that Lily drifts on from where the save left it (kickRide). A kick is found per launch of
 * a stone over dry cells, as skipLanes finds them, and holds once a flood reaches the launch's push cell
 * (takeKicks). A Lily that drifts on a river already is not kicked.
 */
export function placeKicks(walkGrid: WalkGrid): Kick[] {
    const { noFlood, liliesAt, lilyHomes, marks } = walkGrid;
    const kicks: Kick[] = [];
    const found = new Set<string>();

    for (const [stoneCell, z] of skippingStones(walkGrid)) {
        for (const [side, pushCell, firstWater] of launchesOf(walkGrid, stoneCell, z)) {
            for (const hopStart of hopStartsOf(walkGrid, noFlood, side, firstWater, z)) {
                for (const kickSide of [(side + 1) % 4, (side + 3) % 4]) {
                    const lilyCell = cellOnSide(walkGrid, hopStart, kickSide);

                    for (const pid of liliesAt.get(lilyCell) ?? []) {
                        const key = `${pushCell},${pid},${kickSide}`;
                        if (lilyHomes.get(pid) !== lilyCell || found.has(key)) continue;

                        found.add(key);

                        const cells = kickRide(walkGrid, pid, kickSide);
                        for (const cell of cells) marks[cell] |= KICK_MARK;
                        if (cells.length > 0) kicks.push({ stone: stoneCell, pushCell, cells });
                    }
                }
            }
        }
    }

    return kicks;
}

/**
 * Takes the kicks whose launch push cell the flood has reached in a layer where the hero pushes: the cells of the
 * kicked Lily's drift hold the hero from then on. Returns whether any kick was taken.
 */
export function takeKicks(walkGrid: WalkGrid, floodState: FloodState): boolean {
    const { triggers, frozen } = walkGrid;
    const { kicked, kickTaken } = floodState;
    let taken = false;

    visitReached(floodState, floodState.kickCursor, (cell, layer) => {
        if (!pushes(layer)) return;

        for (const kickIndex of triggers.kicksAt.get(cell) || []) {
            const kick = triggers.kicks[kickIndex];
            if (kickTaken[kickIndex] || frozen.has(kick.stone)) continue;

            kickTaken[kickIndex] = 1;
            taken = true;

            for (const driftCell of kick.cells) {
                kicked.add(driftCell);
                requeue(walkGrid, floodState, driftCell);
            }
        }
    });

    return taken;
}

/**
 * Whether a stone skipping at height z goes on over `cell`: water level with z that holds no stone or that a Lily
 * drifts through (the stone can also stop there).
 */
export function skipsOver(walkGrid: WalkGrid, floodState: FloodState, cell: number, z: number): boolean {
    if (!levelWater(walkGrid, cell, z)) return false;
    return walkGrid.driftCells.has(cell) || !holdsStone(walkGrid, floodState, cell, z);
}

/**
 * The cells a stone skipping `side` from water cell `firstWater` can stop on: each cell of a Lily's drift it crosses
 * (the launch is timed for the Lily to be there), then the first cell that holds it; none past a cell where it is
 * lost. A solid cell that stops the stone goes to `wallStops`: a THROUGH beam laid there later lets it on.
 */
export function landingsOf(
    walkGrid: WalkGrid,
    floodState: FloodState,
    side: number,
    firstWater: number,
    z: number,
    wallStops: number[] | null = null,
): number[] {
    const { grid, driftCells } = walkGrid;
    const landings: number[] = [];
    let current = firstWater;

    for (let stepsOut = 0; stepsOut < walkGrid.width + walkGrid.height; stepsOut++) {
        const next = cellOnSide(walkGrid, current, side);
        if (fenced(walkGrid, current, side, next)) break;

        if (blocked(walkGrid, floodState, next)) {
            if (wallStops && grid[next] & SOLID) wallStops.push(next);
            break;
        }

        if (grid[next] & PUSH) break;

        if (driftCells.has(next) && levelWater(walkGrid, next, z)) {
            landings.push(next);
            current = next;
            continue;
        }

        if (holdsStone(walkGrid, floodState, next, z)) {
            landings.push(next);
            break;
        }

        if (!levelWater(walkGrid, next, z)) break;

        current = next;
    }

    return landings;
}

/**
 * Where a skipping stone ends when pushed from `from` on side `side`, for a flood that has reached the push cell: into
 * a cell that holds it, it rests there; into level water it skips on over water level with its height and rests on the
 * first cell that holds it, or sinks in place, in the last water cell, against a fence, a blocked cell or a pushable.
 * Cells of a Lily's drift it crosses are passed over (the lanes cover a stone that stops on a Lily). A stone that sinks
 * in a river cell is left out, since the sunk stone would stop the current. Elsewhere it moves as any pushed object
 * (landingOf). null where it never rests or sinks.
 */
export function stoneLandingOf(
    walkGrid: WalkGrid,
    floodState: FloodState,
    from: number,
    side: number,
    z: number,
): Landing | null {
    const { driftCells, flowSide } = walkGrid;
    const firstWater = cellOnSide(walkGrid, from, side);
    const pushableInto = pushableIn(walkGrid, floodState, firstWater);
    const entersWater =
        !walled(walkGrid, floodState, firstWater) &&
        !pushableInto &&
        !holdsStone(walkGrid, floodState, firstWater, z) &&
        levelWater(walkGrid, firstWater, z);
    if (!entersWater) return landingOf(walkGrid, floodState, from, side);

    let current = firstWater;

    for (let stepsOut = 0; stepsOut < walkGrid.width + walkGrid.height; stepsOut++) {
        const next = cellOnSide(walkGrid, current, side);

        const pushableAhead = pushableIn(walkGrid, floodState, next);
        if (fenced(walkGrid, current, side, next) || blocked(walkGrid, floodState, next) || pushableAhead) {
            if (flowSide.has(current)) return null;
            return { cell: current, sinks: true };
        }

        const drifting = driftCells.has(next) && levelWater(walkGrid, next, z);
        if (!drifting && holdsStone(walkGrid, floodState, next, z)) return { cell: next, sinks: false };
        if (!drifting && !levelWater(walkGrid, next, z)) return null;

        current = next;
    }

    return null;
}

// The TELEPORT swap onto a skipping stone, in the order the skills allow: the stone is pushed and launched (a pushing
// layer; a cell next to it reached), then a hero with TELEPORT (layer 2) stands on a line cell and swaps onto the
// landing cell. A pocket flood looks for the ways into its pocket, so it walks a lane backwards only: from the
// landing cell to the launch push cell and to the line cells past a gap. Per lane, a flood keeps which of its parts
// the walk has reached (LANE_* bits; a pocket flood needs a ride cell only), and the lanes with every part reached
// that have not swapped yet.

/** Notes `part` reached for the lanes `lanesThere`, and puts each lane it completes on the due list. */
function reachLanePart(floodState: FloodState, lanesThere: number[] | undefined, part: number): void {
    const laneParts = floodState.laneParts;

    for (const laneIndex of lanesThere || []) {
        if (laneParts[laneIndex] & part) continue;

        laneParts[laneIndex] |= part;
        if (laneParts[laneIndex] === LANE_READY) floodState.lanesDue.push(laneIndex);
    }
}

/** Notes the lane parts at a reached trigger cell. */
function countLanes(walkGrid: WalkGrid, floodState: FloodState, cell: number, layer: number): void {
    const triggers = walkGrid.triggers;

    if (floodState.pocket) {
        reachLanePart(floodState, triggers.laneRideAt.get(cell), LANE_READY);
        return;
    }

    if (pushes(layer)) {
        reachLanePart(floodState, triggers.lanePushAt.get(cell), LANE_PUSH);
        reachLanePart(floodState, triggers.laneNearAt.get(cell), LANE_NEAR);
    }

    if (layer === WIZARD) reachLanePart(floodState, triggers.laneFromAt.get(cell), LANE_FROM);
}

/**
 * The first lane due after lane `after`, taken off the list; -1 when none. A lane that comes due in this pass at or
 * before `after` waits for the next pass.
 */
function nextLaneDue(floodState: FloodState, after: number): number {
    const lanesDue = floodState.lanesDue;
    let best = -1;

    for (let dueIndex = 0; dueIndex < lanesDue.length; dueIndex++) {
        if (lanesDue[dueIndex] > after && (best < 0 || lanesDue[dueIndex] < lanesDue[best])) best = dueIndex;
    }

    if (best < 0) return -1;

    const laneIndex = lanesDue[best];
    lanesDue[best] = lanesDue[lanesDue.length - 1];
    lanesDue.pop();
    return laneIndex;
}

/**
 * Takes a lane that came due; false when its stone is frozen in a Freezer or a Freezer on its ride is closed. The
 * flood's front lists each of those Freezers, in a pocket flood (which takes the lane anyway unless a ride Freezer is
 * closed) as well.
 */
function takeLane(walkGrid: WalkGrid, floodState: FloodState, lane: SkipLane): boolean {
    let shut = false;
    for (const { cell, freezerIndex } of lane.freezers) {
        if (!walkGrid.frozen.has(cell)) continue;

        shut = true;
        floodState.front?.add(freezerIndex);
    }

    const stoneFreezer = walkGrid.frozen.get(lane.stone);
    if (stoneFreezer !== undefined && lane.freezers.length > 0) floodState.front?.add(stoneFreezer);

    if (shut) return false;

    if (floodState.pocket) {
        for (const cell of [lane.pushCell, ...lane.cross]) {
            if (!blocked(walkGrid, floodState, cell) && standable(walkGrid, floodState, cell)) {
                push(walkGrid, floodState, cell, 0);
            }
        }

        return true;
    }

    if (stoneFreezer !== undefined) return false;

    for (const cell of lane.ride) push(walkGrid, floodState, cell, WIZARD);
    return true;
}

/**
 * Takes the lanes that came due, in one pass in lane order: the cells a swap reaches can bring later lanes due within
 * the pass. Returns whether any lane was taken.
 */
export function skipAndSwap(walkGrid: WalkGrid, floodState: FloodState): boolean {
    const countLanesAt = (cell: number, layer: number): void => countLanes(walkGrid, floodState, cell, layer);
    let more = false;
    let laneIndex = -1;

    do {
        visitReached(floodState, floodState.laneCursor, countLanesAt);
        laneIndex = nextLaneDue(floodState, laneIndex);
        if (laneIndex >= 0 && takeLane(walkGrid, floodState, walkGrid.lanes[laneIndex])) more = true;
    } while (laneIndex >= 0);

    return more;
}
