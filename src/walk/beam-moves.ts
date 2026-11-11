// Pushes that change the beams while a flood runs: a free Gem pushed onto a Gem_Slot of its room, a Promesst_Light
// pushed along a line, and a Rock that stops a beam pushed off the beam's line (movement.md "Pushing and pulling",
// "Promesst beams and powers", viewer.md "Beams moved by pushes")
import type { LightRow } from '../types.ts';
import {
    clearBits,
    DOUBLE,
    extendBeam,
    layCast,
    lightSide,
    newCast,
    OPEN,
    poweredWithGems,
    recastCells,
    roomOf,
    setBits,
    stopOf,
    THROUGH,
    verticalStep,
} from './beams.ts';
import type { CastBeam, Undo } from './beams.ts';
import {
    addTo,
    BEAM,
    BEAMSTOP,
    cellOnSide,
    MOVABLE,
    OPTION_MARK,
    POWER_MARK,
    PUSH,
    ROCK,
    SOLID,
    SUPPORT,
    Z_BIAS,
} from './cells.ts';
import type { FloodState } from './flood.ts';
import { bringObjectOnto, missChanged, pressInputs, rodHolderIn } from './gates.ts';
import type { PressMiss } from './gates.ts';
import { exists } from './groups.ts';
import { requeue, visitReached } from './queue.ts';
import { reachedEntries } from './room-answers.ts';
import { LAYER_COUNT, PUSH_LAYER_BITS, pushes } from './skills.ts';
import { blocked, holdsStone, standable } from './support.ts';
import { swappedTo, visitSwaps } from './swaps.ts';
import type { WalkGrid } from './walker.ts';
import { fenced, latestCell } from './walls.ts';

// the world.json movables kind of a Promesst_Light
const LIGHT_KIND = 1;

// a push line stays inside its screen room, at most a room's width
const MAX_LINE = 18;

// what a Rock pushed off a beam takes with it
const ROCK_BITS = ROCK | SUPPORT | BEAMSTOP;

// what a pushed Gem takes with it
const GEM_BITS = MOVABLE | BEAMSTOP;

// what a pushed Promesst_Light takes off its cell
const LIGHT_BITS = MOVABLE | BEAMSTOP;

// the pushes of beam-stopping Rocks one flood makes, at most
const MAX_ROCK_PUSHES = 256;

/**
 * A push of a Gem or Promesst_Light in a straight line: the hero in `pushCell` pushes the object in `objectCell` on
 * side `side`, and it moves on through `path`, the hero walking behind it.
 */
interface LinePush {
    objectCell: number;
    side: number;
    pushCell: number;
    path: number[];
}

/** A Gem pushed in a line onto the Gem_Slot in the path's last cell. */
interface GemPush extends LinePush {
    slotCell: number;
}

/** A Gem_Slot that a free Gem of its room may be brought onto by any pushes: its cell and the cells of those Gems. */
interface GemTurn {
    slotCell: number;
    gemCells: Set<number>;
}

/** A Promesst_Light pushed in a line: its index in `lights`. */
interface LightPush extends LinePush {
    light: number;
}

/** An existing Promesst_Light with a beam: its cell, facing (`side`, or `dz` for a vertical one) and color. */
interface BeamLight {
    cell: number;
    side: number;
    dz: number;
    color: number;
    castAtStart: boolean;
}

/**
 * The pushes a flood may make for the beams, laid out once per walker: the Gem pushes onto a Gem_Slot, the Gems that
 * turn onto one (`gemTurns`), the light pushes, the lights, and `pushCells`: the cells whose reach starts these moves
 * (the Gem and light push cells, the cells next to the turning Gems and the cells next to the Rocks that stop the
 * beams cast when the walker is built). `castsByStop`: per cell, the beams cast when the walker is built that it
 * stops; `rockStopped`: those a Rock stops. `swapObjects`: the cells of the objects a TELEPORT swap may move for the
 * beams (the Gems that turn onto a slot and the Rocks that stop a beam cast when the walker is built). `spareGems`:
 * the pids of the free Gems their rooms' lights do not need (spareGemsOf).
 */
export interface BeamMoves {
    gemPushes: GemPush[];
    gemTurns: GemTurn[];
    lightPushes: LightPush[];
    lights: BeamLight[];
    pushCells: Set<number>;
    castsByStop: Map<number, CastBeam[]>;
    rockStopped: CastBeam[];
    swapObjects: Set<number>;
    spareGems: Set<number>;
}

/**
 * A spot where a light may cast its beam: the light, the cell it stands in and the cell it left (-1: none), and how
 * many Gems the flood had pushed onto slots when the spot was last tried (-1: not tried yet).
 */
interface LightSpot {
    light: number;
    cell: number;
    vacated: number;
    triedWithGems: number;
}

/**
 * What a flood's pushes for the beams have done: its undo steps, the Gem_Slots it pushed Gems onto, the cells the
 * Gems left, the light pushes made, the lights taken off their cells, the light spots not cast yet and whether a spot or
 * a Gem was added since they were last tried, the beams it cast and its Rock pushes. `turnMisses`: per Gem turn, its
 * last failed search. `lengthened`: the beams, cast by the walker or the flood, that a longer beam of the flood has
 * replaced.
 */
export interface BeamFlood {
    undo: Undo;
    pushedOnto: Set<number>;
    gemsMoved: Set<number>;
    turnMisses: Array<PressMiss | undefined>;
    lightsPushed: Uint8Array;
    lightsMoved: Uint8Array;
    uncast: LightSpot[];
    spotsToTry: boolean;
    casts: CastBeam[];
    lengthened: Set<CastBeam>;
    rockPushes: number;
}

/** No pushes for the beams: the walker's state before placeBeamMoves. */
export const NO_BEAM_MOVES: BeamMoves = {
    gemPushes: [],
    gemTurns: [],
    lightPushes: [],
    lights: [],
    pushCells: new Set(),
    castsByStop: new Map(),
    rockStopped: [],
    swapObjects: new Set(),
    spareGems: new Set(),
};

/**
 * The cells an object in `objectCell` is pushed through on side `side`, in its room, up to the first solid voxel,
 * pushable or Fence: Freezers and Gates are looked at when a flood makes the push.
 */
function linePath(walkGrid: WalkGrid, objectCell: number, side: number): number[] {
    const grid = walkGrid.grid;
    const room = roomOf(walkGrid, objectCell);
    const path: number[] = [];
    let previous = objectCell;

    for (let stepsAlong = 0; stepsAlong < MAX_LINE; stepsAlong++) {
        const next = cellOnSide(walkGrid, previous, side);
        if (grid[next] & (SOLID | PUSH) || fenced(walkGrid, previous, side, next)) break;
        if (roomOf(walkGrid, next) !== room) break;
        path.push(next);
        previous = next;
    }

    return path;
}

/** The hero's push cell for an object in `objectCell` pushed on side `side`, else -1 when a Fence is in the way. */
function pushCellOf(walkGrid: WalkGrid, objectCell: number, side: number): number {
    const pushCell = cellOnSide(walkGrid, objectCell, (side + 2) % 4);
    if (fenced(walkGrid, pushCell, side, objectCell)) return -1;
    return pushCell;
}

/** The cells of the existing Gem_Slots not filled yet. */
function openSlotsOf(walkGrid: WalkGrid): Set<number> {
    const openSlots = new Set<number>();

    for (const slots of walkGrid.slotsByRoom.values()) {
        for (const slot of slots) {
            const gems = walkGrid.gemsAt.get(slot.cell) || [];
            const filled = slot.beamPowered || gems.some((gem) => exists(walkGrid, gem.pid, gem.existence));
            if (!filled && exists(walkGrid, slot.pid, slot.existence)) openSlots.add(slot.cell);
        }
    }

    return openSlots;
}

/**
 * Lays out the pushes of the free Gems onto the Gem_Slots in `openSlots` that turn: per slot of a room with a
 * Promesst_Light (a filled slot changes nothing else) and as many free Gems as open slots (a room with fewer is never
 * powered), the cells of the free Gems of its room that are not on a slot, and the cells next to those Gems, whose
 * reach starts a push. Needs the lights laid out.
 */
function placeGemTurns(walkGrid: WalkGrid, moves: BeamMoves, openSlots: Set<number>): void {
    const slotCells = new Set<number>();
    for (const slots of walkGrid.slotsByRoom.values()) {
        for (const slot of slots) slotCells.add(slot.cell);
    }

    const lightRooms = new Set(moves.lights.map((light) => roomOf(walkGrid, light.cell)));
    const gemCellsByRoom = new Map<string, number[]>();

    for (const [gemCell, gems] of walkGrid.gemsAt) {
        if (slotCells.has(gemCell) || !gems.some((gem) => exists(walkGrid, gem.pid, gem.existence))) continue;
        addTo(gemCellsByRoom, roomOf(walkGrid, gemCell), gemCell);
    }

    const openSlotCounts = new Map<string, number>();
    for (const slotCell of openSlots) {
        const room = roomOf(walkGrid, slotCell);
        openSlotCounts.set(room, (openSlotCounts.get(room) ?? 0) + 1);
    }

    for (const slotCell of openSlots) {
        const room = roomOf(walkGrid, slotCell);
        const gemCells = gemCellsByRoom.get(room);
        if (!gemCells || !lightRooms.has(room)) continue;
        if (gemCells.length < (openSlotCounts.get(room) ?? 0)) continue;

        moves.gemTurns.push({ slotCell, gemCells: new Set(gemCells) });

        for (const gemCell of gemCells) {
            for (let side = 0; side < 4; side++) moves.pushCells.add(cellOnSide(walkGrid, gemCell, side));
        }
    }
}

/**
 * The pids of the free Gems that sinking in water costs their room no light: the existing free Gems that are not on a
 * Gem_Slot, in a room without a Promesst_Light that casts a beam, or in a room with more of them than open slots (a
 * room with fewer is never powered). A room with no open slot has no use for them. Needs the lights laid out.
 */
function spareGemsOf(walkGrid: WalkGrid, moves: BeamMoves, openSlots: Set<number>): Set<number> {
    const slotCells = new Set<number>();
    for (const slots of walkGrid.slotsByRoom.values()) {
        for (const slot of slots) slotCells.add(slot.cell);
    }

    const lightRooms = new Set(moves.lights.map((light) => roomOf(walkGrid, light.cell)));
    const gemsByRoom = new Map<string, number[]>();

    for (const [gemCell, gems] of walkGrid.gemsAt) {
        if (slotCells.has(gemCell)) continue;

        for (const gem of gems) {
            if (exists(walkGrid, gem.pid, gem.existence)) addTo(gemsByRoom, roomOf(walkGrid, gemCell), gem.pid);
        }
    }

    const openSlotCounts = new Map<string, number>();
    for (const slotCell of openSlots) {
        const room = roomOf(walkGrid, slotCell);
        openSlotCounts.set(room, (openSlotCounts.get(room) ?? 0) + 1);
    }

    const spare = new Set<number>();

    for (const [room, pids] of gemsByRoom) {
        const needed = lightRooms.has(room) && pids.length <= (openSlotCounts.get(room) ?? 0);
        if (needed) continue;

        for (const pid of pids) spare.add(pid);
    }

    return spare;
}

/**
 * Lays out the line pushes of the free Gems onto an existing Gem_Slot of their room not filled yet. Returns the cells
 * of those slots.
 */
function placeGemPushes(walkGrid: WalkGrid, moves: BeamMoves): Set<number> {
    const openSlots = openSlotsOf(walkGrid);

    for (const [gemCell, gems] of walkGrid.gemsAt) {
        if (openSlots.has(gemCell) || !gems.some((gem) => exists(walkGrid, gem.pid, gem.existence))) continue;

        for (let side = 0; side < 4; side++) {
            const pushCell = pushCellOf(walkGrid, gemCell, side);
            if (pushCell < 0) continue;

            const path = linePath(walkGrid, gemCell, side);

            path.forEach((cell, index) => {
                if (!openSlots.has(cell)) return;

                moves.gemPushes.push({
                    objectCell: gemCell,
                    side,
                    pushCell,
                    path: path.slice(0, index + 1),
                    slotCell: cell,
                });
                moves.pushCells.add(pushCell);
            });
        }
    }

    return openSlots;
}

/** Lays out the existing Promesst_Lights with a beam, and their line pushes. */
function placeLightPushes(walkGrid: WalkGrid, moves: BeamMoves): void {
    const castCells = new Set(walkGrid.castBeams.map((cast) => cast.lightCell));
    const lightRows = new Map<number, LightRow>();

    for (const lightRow of walkGrid.world.lights || []) lightRows.set(lightRow[0], lightRow);

    for (const [pid, column, row, z, kind, existence] of walkGrid.world.movables || []) {
        if (kind !== LIGHT_KIND || !exists(walkGrid, pid, existence)) continue;

        const lightRow = lightRows.get(pid);
        const cell = latestCell(walkGrid, pid, column, row, z);
        if (!lightRow || cell < 0) continue;

        const [, , , , dataSide, up, down, , color] = lightRow;
        const side = lightSide(walkGrid, pid, dataSide);
        const dz = verticalStep(up, down, walkGrid.layerCells);
        if (!dz && side < 0) continue;

        const light = moves.lights.length;
        moves.lights.push({ cell, side, dz, color, castAtStart: castCells.has(cell) });

        for (let pushSide = 0; pushSide < 4; pushSide++) {
            const pushCell = pushCellOf(walkGrid, cell, pushSide);
            const path = linePath(walkGrid, cell, pushSide);
            if (pushCell < 0 || path.length === 0) continue;

            moves.lightPushes.push({ objectCell: cell, side: pushSide, pushCell, path, light });
            moves.pushCells.add(pushCell);
        }
    }
}

/**
 * Lays out the pushes a flood may make for the beams: Gems onto Gem_Slots, Promesst_Lights along lines, and the
 * Rocks that stop the beams cast when the walker is built (by the cells next to them).
 */
export function placeBeamMoves(walkGrid: WalkGrid): void {
    const moves: BeamMoves = {
        gemPushes: [],
        gemTurns: [],
        lightPushes: [],
        lights: [],
        pushCells: new Set(),
        castsByStop: new Map(),
        rockStopped: [],
        swapObjects: new Set(),
        spareGems: new Set(),
    };

    const openSlots = placeGemPushes(walkGrid, moves);
    placeLightPushes(walkGrid, moves);
    placeGemTurns(walkGrid, moves, openSlots);
    moves.spareGems = spareGemsOf(walkGrid, moves, openSlots);

    for (const cast of walkGrid.castBeams) {
        const stop = stopOf(walkGrid, cast);
        const stopped = moves.castsByStop.get(stop);

        if (stopped) {
            stopped.push(cast);
        } else {
            moves.castsByStop.set(stop, [cast]);
        }

        if (!stoppedByRock(walkGrid, stop)) continue;

        moves.rockStopped.push(cast);
        for (let side = 0; side < 4; side++) moves.pushCells.add(cellOnSide(walkGrid, stop, side));
        moves.swapObjects.add(stop);
    }

    for (const turn of moves.gemTurns) {
        for (const gemCell of turn.gemCells) moves.swapObjects.add(gemCell);
    }

    walkGrid.beamMoves = moves;
}

/** Whether `cell` holds a Rock that stops beams (one not MIRRORABLE). */
function stoppedByRock(walkGrid: WalkGrid, cell: number): boolean {
    if (cell < 0 || cell >= walkGrid.grid.length) return false;
    return (walkGrid.grid[cell] & (ROCK | BEAMSTOP)) === (ROCK | BEAMSTOP);
}

/**
 * The cells `outside` a flood that the hero pushes from: all of them while a closed Freezer is thawed, else none
 * (null). With the Freezers as they were for the walk that reached those cells, their pushes are that walk's own; an
 * opened Freezer lets beams and pushed objects through its cell, so the pushes are made again.
 */
function outsidePushCells(walkGrid: WalkGrid, floodState: FloodState): Set<number> | null {
    if (walkGrid.thawed.size === 0) return null;
    return floodState.outside;
}

/** Whether the hero pushes from `cell`: the flood reached it without a Wardrobe skill, or it is an outsidePushCell. */
function heroPushesFrom(walkGrid: WalkGrid, floodState: FloodState, cell: number): boolean {
    if ((walkGrid.visited[cell] & PUSH_LAYER_BITS) !== 0) return true;
    return outsidePushCells(walkGrid, floodState)?.has(cell) === true;
}

/**
 * How many cells of a line push's path the object gets through now: each cell it enters is not blocked, holds no
 * other pushable and holds it up, and the hero can stand in each cell he steps into behind it to push again.
 */
function cellsPushedThrough(walkGrid: WalkGrid, floodState: FloodState, linePush: LinePush): number {
    const { objectCell, path } = linePush;
    const z = Math.floor(objectCell / walkGrid.layerCells) - Z_BIAS;
    if (blocked(walkGrid, floodState, objectCell)) return 0;

    let heroCell = linePush.pushCell;
    let objectAt = objectCell;

    for (let pathIndex = 0; pathIndex < path.length; pathIndex++) {
        const into = path[pathIndex];
        if (pathIndex > 0 && !standable(walkGrid, floodState, heroCell)) return pathIndex;
        if (blocked(walkGrid, floodState, into) || walkGrid.grid[into] & PUSH) return pathIndex;
        if (!holdsStone(walkGrid, floodState, into, z)) return pathIndex;

        heroCell = objectAt;
        objectAt = into;
    }

    return path.length;
}

/** Moves `bits` of an object from cell `from` to cell `to` until the flood ends. */
function moveObject(walkGrid: WalkGrid, from: number, to: number, bits: number, undo: Undo): void {
    const moved = walkGrid.grid[from] & bits;
    clearBits(walkGrid.grid, from, moved, undo);
    setBits(walkGrid.grid, to, moved, undo);
}

/**
 * Walks on from the reached cells of a cast beam, whose moves its powers change. A DOUBLE beam over water holds the
 * hero up and a THROUGH beam opens walls, which changes the moves into its cells too, and a hero in an OPEN beam opens
 * Gates next to it: the reached cells next to the beam are walked again as well. So they are once the flood has opened
 * a Gate from an OPEN beam, which a cell walked before may step into now.
 */
function walkBeamAgain(walkGrid: WalkGrid, floodState: FloodState, cast: CastBeam): void {
    const { visited } = walkGrid;
    const queue = floodState.queue;
    const cells = cast.beam.cells;
    const color = cast.color;
    let lastSide = -1;
    if (color === DOUBLE || color === THROUGH || color === OPEN || floodState.opened.size > 0) lastSide = 3;

    for (const cell of cells) {
        for (let side = -1; side <= lastSide; side++) {
            let near = cell;
            if (side >= 0) near = cellOnSide(walkGrid, cell, side);

            const layers = visited[near];
            if (!layers) continue;

            for (let layer = 0; layer < LAYER_COUNT; layer++) {
                if (layers & (1 << layer)) queue.push(near, layer);
            }
        }
    }
}

/**
 * Runs on each beam that a pushed object stopped in `cell`, now that it has left: the longer beam replaces it among
 * the beams whose Rocks are pushed (`lengthened`).
 */
function freeCell(walkGrid: WalkGrid, floodState: FloodState, beamFlood: BeamFlood, cell: number): void {
    const stopped = [...(walkGrid.beamMoves.castsByStop.get(cell) ?? [])];

    for (const cast of beamFlood.casts) {
        if (stopOf(walkGrid, cast) === cell) stopped.push(cast);
    }

    for (const cast of stopped) {
        const longer = extendBeam(walkGrid, cast, beamFlood.undo);
        beamFlood.casts.push(longer);
        beamFlood.lengthened.add(cast);
        walkBeamAgain(walkGrid, floodState, longer);
    }

    requeue(walkGrid, floodState, cell);
}

/** Pushes the free Gems the hero reaches onto their Gem_Slots. Returns whether any Gem moved. */
function pushGems(walkGrid: WalkGrid, floodState: FloodState, beamFlood: BeamFlood): boolean {
    const { pushedOnto, gemsMoved } = beamFlood;
    let moved = false;

    for (const gemPush of walkGrid.beamMoves.gemPushes) {
        const { objectCell, slotCell, path } = gemPush;
        if (gemsMoved.has(objectCell) || pushedOnto.has(slotCell)) continue;
        if (!heroPushesFrom(walkGrid, floodState, gemPush.pushCell)) continue;
        if (cellsPushedThrough(walkGrid, floodState, gemPush) < path.length) continue;

        gemsMoved.add(objectCell);
        pushedOnto.add(slotCell);
        beamFlood.spotsToTry = true;

        moveObject(walkGrid, objectCell, slotCell, GEM_BITS, beamFlood.undo);
        freeCell(walkGrid, floodState, beamFlood, objectCell);
        moved = true;
    }

    return moved;
}

/** Whether the hero pushes from a cell next to a Gem of `turn` that is still in its cell, which starts any push of it. */
function gemPushable(walkGrid: WalkGrid, floodState: FloodState, beamFlood: BeamFlood, turn: GemTurn): boolean {
    for (const gemCell of turn.gemCells) {
        if (beamFlood.gemsMoved.has(gemCell)) continue;

        for (let side = 0; side < 4; side++) {
            if (heroPushesFrom(walkGrid, floodState, cellOnSide(walkGrid, gemCell, side))) return true;
        }
    }

    return false;
}

/**
 * The cell of a free Gem of the turn's room that the walk can bring onto its slot by any pushes and Rod launches (the
 * walk back from the slot, within the slot's screen room) or that a hero with TELEPORT swaps onto it, else -1. The hero
 * pushes from the cells the flood reached in a layer that pushes.
 */
function gemToSlot(
    walkGrid: WalkGrid,
    floodState: FloodState,
    beamFlood: BeamFlood,
    turn: GemTurn,
    miss: PressMiss,
): number {
    const { slotCell, gemCells } = turn;
    const room = roomOf(walkGrid, slotCell);

    return bringObjectOnto(walkGrid, floodState, slotCell, miss, {
        heroPushes: (pushCell) => heroPushesFrom(walkGrid, floodState, pushCell),
        accepts: (from, skips) => {
            if (skips || !gemCells.has(from) || beamFlood.gemsMoved.has(from)) return false;
            return !blocked(walkGrid, floodState, from);
        },
        stays: (from) => roomOf(walkGrid, from) === room,
        heroLaunches: rodHolderIn(walkGrid, floodState),
    });
}

/**
 * The cell of a free Gem of the turn's room that the stored answer of the slot's room (room-answers.ts) has stand on
 * the slot, from a start the walk has reached, else -1. The start cells not reached go to `miss`.
 */
function storedGemToSlot(
    walkGrid: WalkGrid,
    floodState: FloodState,
    beamFlood: BeamFlood,
    turn: GemTurn,
    miss: PressMiss,
): number {
    const { slotCell, gemCells } = turn;
    const entries = walkGrid.rooms.byCell.get(slotCell);
    if (!entries) return -1;

    for (const entry of reachedEntries(walkGrid, floodState.outside, entries, miss.pushCells)) {
        for (const gemCell of entry.filled.get(slotCell) ?? []) {
            if (!gemCells.has(gemCell) || beamFlood.gemsMoved.has(gemCell)) continue;
            if (!blocked(walkGrid, floodState, gemCell)) return gemCell;
        }
    }

    return -1;
}

/**
 * Pushes the free Gems the hero reaches onto the Gem_Slots they turn to: the Gems the stored answer of the slot's room
 * has stand on it, else any pushes the walk back from the slot finds.
 * A slot's search that found no Gem is looked at again only once what it reads has changed. Returns whether any Gem
 * moved.
 */
function pushTurnedGems(walkGrid: WalkGrid, floodState: FloodState, beamFlood: BeamFlood): boolean {
    const { pushedOnto, gemsMoved, turnMisses } = beamFlood;
    const turns = walkGrid.beamMoves.gemTurns;
    let moved = false;

    for (let turnIndex = 0; turnIndex < turns.length; turnIndex++) {
        const turn = turns[turnIndex];
        const slotCell = turn.slotCell;
        if (pushedOnto.has(slotCell)) continue;

        const stored = walkGrid.rooms.byCell.has(slotCell);
        const startable =
            gemPushable(walkGrid, floodState, beamFlood, turn) || floodState.swapsAt.has(slotCell) || stored;
        if (!startable) continue;

        const slotZ = Math.floor(slotCell / walkGrid.layerCells) - Z_BIAS;
        if (blocked(walkGrid, floodState, slotCell) || walkGrid.grid[slotCell] & PUSH) continue;
        if (!holdsStone(walkGrid, floodState, slotCell, slotZ)) continue;

        const miss = turnMisses[turnIndex];
        if (miss && !missChanged(walkGrid, floodState, miss)) continue;

        const newMiss: PressMiss = { inputs: pressInputs(floodState), pushCells: [], wallStops: [] };
        let gemCell = storedGemToSlot(walkGrid, floodState, beamFlood, turn, newMiss);
        if (gemCell < 0) gemCell = gemToSlot(walkGrid, floodState, beamFlood, turn, newMiss);

        if (gemCell < 0) {
            turnMisses[turnIndex] = newMiss;
            continue;
        }

        gemsMoved.add(gemCell);
        pushedOnto.add(slotCell);
        beamFlood.spotsToTry = true;

        moveObject(walkGrid, gemCell, slotCell, GEM_BITS, beamFlood.undo);
        freeCell(walkGrid, floodState, beamFlood, gemCell);
        moved = true;
    }

    return moved;
}

/**
 * Pushes the Promesst_Lights the hero reaches along their lines: each cell a light gets to is a spot for its beam. A
 * light's first push takes it off its cell, which then stops no beam; it is not placed in the cells it gets to.
 */
function pushLights(walkGrid: WalkGrid, floodState: FloodState, beamFlood: BeamFlood): boolean {
    const { lightPushes } = walkGrid.beamMoves;
    let moved = false;

    lightPushes.forEach((lightPush, index) => {
        if (beamFlood.lightsPushed[index] || !heroPushesFrom(walkGrid, floodState, lightPush.pushCell)) return;

        const pushedThrough = cellsPushedThrough(walkGrid, floodState, lightPush);
        if (pushedThrough === 0) return;

        beamFlood.lightsPushed[index] = 1;
        beamFlood.spotsToTry = true;

        const { light, objectCell } = lightPush;
        if (!beamFlood.lightsMoved[light]) {
            beamFlood.lightsMoved[light] = 1;
            clearBits(walkGrid.grid, objectCell, walkGrid.grid[objectCell] & LIGHT_BITS, beamFlood.undo);
            freeCell(walkGrid, floodState, beamFlood, objectCell);
        }

        for (const cell of lightPush.path.slice(0, pushedThrough)) {
            beamFlood.uncast.push({ light, cell, vacated: objectCell, triedWithGems: -1 });
            moved = true;
        }
    });

    return moved;
}

/**
 * Casts the beams of the light spots whose room the flood's Gems have powered. Spots are looked at once another spot
 * or Gem comes, and a spot left uncast is tried again only once more Gems are on slots: within a flood its room's
 * power changes with the Gems alone, and the closed Freezers stay as they are. A beam that lies wholly `outside` the
 * flood gives it no move, as the hero never stands in it, and is not laid into the grid; it stays among the flood's
 * beams for the Rocks that stop it. Returns whether a beam was laid.
 */
function castSpots(walkGrid: WalkGrid, floodState: FloodState, beamFlood: BeamFlood): boolean {
    if (!beamFlood.spotsToTry) return false;
    beamFlood.spotsToTry = false;

    const { lights } = walkGrid.beamMoves;
    const outside = floodState.outside;
    const gems = beamFlood.pushedOnto.size;
    const stillUncast: LightSpot[] = [];
    let laid = false;

    for (const spot of beamFlood.uncast) {
        const { light, cell, vacated } = spot;
        const unchanged = spot.triedWithGems === gems;
        if (unchanged || walkGrid.frozen.has(cell) || !poweredWithGems(walkGrid, cell, beamFlood.pushedOnto)) {
            spot.triedWithGems = gems;
            stillUncast.push(spot);
            continue;
        }

        const { side, dz, color } = lights[light];
        const cast = newCast(walkGrid, cell, side, dz, color, vacated);
        beamFlood.casts.push(cast);

        const cells = cast.beam.cells;
        if (outside && cells.every((beamCell) => outside.has(beamCell))) continue;

        layCast(walkGrid, cast, beamFlood.undo);
        walkBeamAgain(walkGrid, floodState, cast);
        laid = true;
    }

    beamFlood.uncast = stillUncast;

    return laid;
}

/**
 * Pushes the Rock that stops a beam by one cell from a cell the hero reaches: off the beam's line when it can, else
 * along a horizontal beam away from its light, which runs the beam on by a cell. The Rock goes onto a cell that holds
 * it and that no beam runs through. Returns whether it moved.
 */
function pushRockOff(
    walkGrid: WalkGrid,
    floodState: FloodState,
    beamFlood: BeamFlood,
    cast: CastBeam,
    rockCell: number,
): boolean {
    const { grid, cellFlags, marks } = walkGrid;
    const z = Math.floor(rockCell / walkGrid.layerCells) - Z_BIAS;
    let sides = [0, 1, 2, 3];
    if (!cast.dz) sides = [(cast.side + 1) % 4, (cast.side + 3) % 4, cast.side];

    for (const side of sides) {
        const pushCell = cellOnSide(walkGrid, rockCell, (side + 2) % 4);
        const into = cellOnSide(walkGrid, rockCell, side);

        if (!heroPushesFrom(walkGrid, floodState, pushCell)) continue;
        if (fenced(walkGrid, pushCell, side, rockCell) || fenced(walkGrid, rockCell, side, into)) continue;
        if (blocked(walkGrid, floodState, into) || grid[into] & PUSH) continue;
        if (!holdsStone(walkGrid, floodState, into, z)) continue;
        if (cellFlags[into] & BEAM || marks[into] & (POWER_MARK | OPTION_MARK)) continue;

        moveObject(walkGrid, rockCell, into, ROCK_BITS, beamFlood.undo);
        freeCell(walkGrid, floodState, beamFlood, rockCell);
        return true;
    }

    return false;
}

/**
 * Whether the Rock in `rockCell` that stops `cast`, once swapped into `into`, would stop the longer beam there: the
 * beam recast without the Rock runs through `into`, or `into` is a cell some beam of the walker runs through already.
 */
function swappedRockStopsBeam(walkGrid: WalkGrid, cast: CastBeam, rockCell: number, into: number): boolean {
    const { grid, cellFlags, marks } = walkGrid;
    if (cellFlags[into] & BEAM || marks[into] & (POWER_MARK | OPTION_MARK)) return true;

    const rockBits = grid[rockCell] & ROCK_BITS;
    clearBits(grid, rockCell, rockBits, null);
    const runsThrough = recastCells(walkGrid, cast).includes(into);
    setBits(grid, rockCell, rockBits, null);

    return runsThrough;
}

/**
 * Swaps the Rock that stops a beam off its cell, into a cell the hero swapped it into that holds it and that the
 * longer beam does not run through. The Rock is not placed in that cell. The beam then runs on. Returns whether it
 * moved.
 */
function swapRockOff(
    walkGrid: WalkGrid,
    floodState: FloodState,
    beamFlood: BeamFlood,
    cast: CastBeam,
    rockCell: number,
): boolean {
    const z = Math.floor(rockCell / walkGrid.layerCells) - Z_BIAS;

    for (const into of swappedTo(floodState, rockCell)) {
        if (walkGrid.grid[into] & PUSH || !holdsStone(walkGrid, floodState, into, z)) continue;
        if (swappedRockStopsBeam(walkGrid, cast, rockCell, into)) continue;

        clearBits(walkGrid.grid, rockCell, walkGrid.grid[rockCell] & ROCK_BITS, beamFlood.undo);
        freeCell(walkGrid, floodState, beamFlood, rockCell);
        return true;
    }

    return false;
}

/**
 * Pushes or swaps away the Rocks that stop the flood's beams, MAX_ROCK_PUSHES moves at most. A beam a longer one has
 * replaced is left out: a Rock that comes back into its old stop stands inside the longer beam, which stays laid, so
 * moving it again opens nothing. Returns whether any moved.
 */
function pushRocks(walkGrid: WalkGrid, floodState: FloodState, beamFlood: BeamFlood): boolean {
    let moved = false;

    for (const cast of [...walkGrid.beamMoves.rockStopped, ...beamFlood.casts]) {
        if (beamFlood.rockPushes >= MAX_ROCK_PUSHES) break;

        if (beamFlood.lengthened.has(cast)) continue;

        const stop = stopOf(walkGrid, cast);
        if (!stoppedByRock(walkGrid, stop)) continue;

        const pushed = pushRockOff(walkGrid, floodState, beamFlood, cast, stop);
        if (!pushed && !swapRockOff(walkGrid, floodState, beamFlood, cast, stop)) continue;

        beamFlood.rockPushes++;
        moved = true;
    }

    return moved;
}

/** A flood's state for the pushes for the beams, once it reaches a cell that starts one. */
function startBeamFlood(walkGrid: WalkGrid): BeamFlood {
    const { lights, lightPushes } = walkGrid.beamMoves;
    const uncast: LightSpot[] = [];

    lights.forEach((light, index) => {
        if (!light.castAtStart) uncast.push({ light: index, cell: light.cell, vacated: -1, triedWithGems: -1 });
    });

    return {
        undo: [],
        pushedOnto: new Set(),
        gemsMoved: new Set(),
        turnMisses: [],
        lightsPushed: new Uint8Array(lightPushes.length),
        lightsMoved: new Uint8Array(lights.length),
        uncast,
        spotsToTry: uncast.length > 0,
        casts: [],
        lengthened: new Set(),
        rockPushes: 0,
    };
}

/** Whether the flood has reached a cell that starts a push for the beams, or one is an outsidePushCell. */
function reachesBeamMoves(walkGrid: WalkGrid, floodState: FloodState): boolean {
    const pushCells = walkGrid.beamMoves.pushCells;
    let reaches = false;

    visitReached(floodState, floodState.beamCursor, (cell, layer) => {
        if (pushes(layer) && pushCells.has(cell)) reaches = true;
    });

    const swapObjects = walkGrid.beamMoves.swapObjects;

    visitSwaps(floodState, floodState.beamSwapCursor, (_heroCell, targetCell) => {
        if (swapObjects.has(targetCell)) reaches = true;
    });

    const outside = outsidePushCells(walkGrid, floodState);
    if (!reaches && outside && !floodState.beamOutsideSeen) {
        floodState.beamOutsideSeen = true;
        for (const cell of pushCells) {
            if (outside.has(cell)) reaches = true;
        }
    }

    return reaches;
}

/**
 * Makes the pushes for the beams the walk can make now: Gems onto their Gem_Slots, Promesst_Lights along their lines,
 * the beams of the lights the Gems power, and the Rocks that stop beams off their lines. What they change in the grid
 * and its lookups lasts until the flood ends. Returns whether anything changed.
 */
export function pushForBeams(walkGrid: WalkGrid, floodState: FloodState): boolean {
    if (reachesBeamMoves(walkGrid, floodState) && !floodState.beamFlood) {
        floodState.beamFlood = startBeamFlood(walkGrid);
    }

    const beamFlood = floodState.beamFlood;
    if (!beamFlood) return false;

    let changed = false;
    let more = true;

    while (more) {
        more = pushGems(walkGrid, floodState, beamFlood);
        if (pushTurnedGems(walkGrid, floodState, beamFlood)) more = true;
        if (pushLights(walkGrid, floodState, beamFlood)) more = true;
        if (castSpots(walkGrid, floodState, beamFlood)) more = true;
        if (pushRocks(walkGrid, floodState, beamFlood)) more = true;
        if (more) changed = true;
    }

    return changed;
}

/** Undoes what a flood's pushes for the beams changed, newest first. */
export function undoBeamMoves(beamFlood: BeamFlood): void {
    const undo = beamFlood.undo;

    for (let index = undo.length - 1; index >= 0; index--) undo[index]();
    undo.length = 0;
}
