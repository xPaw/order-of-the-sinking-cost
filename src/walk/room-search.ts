// The exhaustive push search of the screen rooms: every position the objects of a room can be pushed to, with the hero
// pushing from the cells he stands in as the walk reads them. Run at build time on the level data alone for the stored
// answers, and on a walker's grid for the rooms a save has touched (viewer.md "Room answers")
import { attackedAt, GOBLIN, recastAttacks } from './attacks.ts';
import { GEM_KIND, roomOf } from './beams.ts';
import {
    BRIDGE_MARK,
    cellOnSide,
    DRIFT_MARK,
    FLOOR,
    FROZEN_MARK,
    GATE,
    KICK_MARK,
    MONSTER,
    MOVABLE,
    PUSH,
    ROCK,
    SOLID,
    SUPPORT,
    Z_BIAS,
} from './cells.ts';
import { freeze, thaw } from './freezers.ts';
import { walled } from './gates.ts';
import { burnsAt, fireTarget, goblinBeside } from './monster-pushes.ts';
import { deep, layerOf } from './ocean.ts';
import { landingOf } from './rock-turns.ts';
import { boundaryFreezers, MAX_BOUNDARY_FREEZERS, packRooms } from './room-answers.ts';
import type { RoomEntry, RoomIndex, StoredRoom } from './room-answers.ts';
import { heldFromBelow, holdsStone, standable } from './support.ts';
import type { WalkGrid } from './walker.ts';
import { fenced, latestCell } from './walls.ts';

// how many positions of a room's objects one search visits at most; a room that needs more has no stored answer
export const STATE_CAP = 200_000;

// the same for a room searched on a save's grid; a room that needs more keeps the walk's searches
export const LIVE_STATE_CAP = 20_000;

// how many start components of a room get an answer of their own
const MAX_STARTS = 6;

// a room with more Freezers around it than this has an answer for them all closed only; with fewer it gets one for every
// combination of open and closed
const MAX_VARIANT_FREEZERS = 3;

// what a pushable object does when pushed into water
const ROCK_PIECE = 0;
const STONE_PIECE = 1;
const SPARE_GEM_PIECE = 2;
const GEM_PIECE = 3;
const OTHER_PIECE = 4;
const MONSTER_PIECE = 5;

// where an object is when it stands in no cell: a Rock, Gem or skipping stone that sank, or a Monster that died
const GONE = -1;
const DEAD = -2;

/** An object a hero pushes: the cell the level data puts it in, what it does in water, the bits it carries. */
interface Piece {
    cell: number;
    kind: number;
    bits: number;
    monsterIndex: number;
}

/** A screen room: the cells of a 4-connected component of standable cells in one z, and its objects. */
interface Room {
    cells: number[];
    pieces: Piece[];
}

/** What a search found, per object by the cell the level data puts it in. */
interface Found {
    bridges: Map<number, Set<number>>;
    holders: Map<number, Set<number>>;
    filled: Map<number, Set<number>>;
    dead: Set<number>;
}

/**
 * What searchRooms() works out: the rooms with an answer, the first cell of each room that hit STATE_CAP, how many rooms
 * it searched with every Freezer closed, how many rooms it searched with some Freezers open, how many positions it
 * visited, and how many rooms have more than one start component.
 */
export interface RoomSearchResult {
    rooms: StoredRoom[];
    capped: number[];
    searched: number;
    variants: number;
    states: number;
    multiStart: number;
}

function newFound(): Found {
    return { bridges: new Map(), holders: new Map(), filled: new Map(), dead: new Set() };
}

function addValue(map: Map<number, Set<number>>, key: number, value: number): void {
    const values = map.get(key);
    if (values) {
        values.add(value);
    } else {
        map.set(key, new Set([value]));
    }
}

function ascending(first: number, second: number): number {
    return first - second;
}

/**
 * The cells of the Gates, shut or not so a room does not depend on a Gate's state, and of the closed Freezers: a room
 * ends at them.
 */
function cutCellsOf(walkGrid: WalkGrid): Set<number> {
    const cuts = new Set<number>();

    for (const cell of walkGrid.geometry.gateCells) cuts.add(cell);
    for (const cell of walkGrid.frozen.keys()) cuts.add(cell);

    return cuts;
}

/**
 * Whether the hero stands or an object rests in `cell` as plain ground: not on a Lily, a drifting Lily's way or a
 * bridge, not a Gate or a Freezer, and below the ground only where a floor or a solid voxel holds it up, not the
 * implicit floor. A cell level with the water that something holds up is ground too.
 */
function plainGround(walkGrid: WalkGrid, cuts: Set<number>, cell: number): boolean {
    const { grid, marks, layerCells, liliesAt, lilyCells, noFlood } = walkGrid;
    const z = Math.floor(cell / layerCells) - Z_BIAS;
    if (marks[cell] & (DRIFT_MARK | BRIDGE_MARK | KICK_MARK | FROZEN_MARK)) return false;
    if (grid[cell] & (GATE | SOLID) || liliesAt.has(cell) || lilyCells.has(cell) || cuts.has(cell)) return false;

    if (z < 0 && layerOf(walkGrid, z) === 0 && !(grid[cell] & FLOOR) && !heldFromBelow(walkGrid, noFlood, cell)) {
        return false;
    }

    return standable(walkGrid, noFlood, cell);
}

/** Whether `cell` can be part of a room: plain ground below the fast-travel map rooms. */
function roomCell(walkGrid: WalkGrid, cuts: Set<number>, cell: number): boolean {
    const z = Math.floor(cell / walkGrid.layerCells) - Z_BIAS;
    return z < walkGrid.boxZ && plainGround(walkGrid, cuts, cell);
}

/** The pushable objects of the grid, by their cells: Rocks, Gems, Promesst_Lights, Mirrors, Rovers and Monsters. */
function piecesOf(walkGrid: WalkGrid): Map<number, Piece> {
    const { grid, world } = walkGrid;
    const skippable = new Set(world.skippable);
    const { spareGems } = walkGrid.beamMoves;
    const pieces = new Map<number, Piece>();

    const bitsOf = (cell: number): number => {
        const bits = grid[cell] & (ROCK | MONSTER | MOVABLE);
        if (bits & ROCK) return bits | SUPPORT;
        return bits;
    };

    for (const { pid, cell } of walkGrid.rocks) {
        let kind = ROCK_PIECE;
        if (skippable.has(pid)) kind = STONE_PIECE;
        if (spareGems.has(pid)) kind = SPARE_GEM_PIECE;
        pieces.set(cell, { cell, kind, bits: bitsOf(cell), monsterIndex: -1 });
    }

    walkGrid.monsters.forEach(({ cell }, monsterIndex) => {
        pieces.set(cell, { cell, kind: MONSTER_PIECE, bits: bitsOf(cell), monsterIndex });
    });

    world.movables.forEach(([pid, column, row, z, kind]) => {
        const cell = latestCell(walkGrid, pid, column, row, z);
        if (cell < 0 || pieces.has(cell) || !(grid[cell] & MOVABLE)) return;

        let pieceKind = OTHER_PIECE;
        if (kind === GEM_KIND && walkGrid.gemsAt.has(cell)) pieceKind = GEM_PIECE;
        pieces.set(cell, { cell, kind: pieceKind, bits: bitsOf(cell), monsterIndex: -1 });
    });

    return pieces;
}

/**
 * The screen rooms that hold pushable objects and a cell of `seeds` (ascending): 4-connected components of room cells
 * in one z and one screen.
 */
function roomsOf(walkGrid: WalkGrid, cuts: Set<number>, pieces: Map<number, Piece>, seeds: number[]): Room[] {
    const rooms: Room[] = [];
    const assigned = new Set<number>();

    for (const seed of seeds) {
        if (assigned.has(seed) || !roomCell(walkGrid, cuts, seed)) continue;

        const screen = roomOf(walkGrid, seed);
        const cells = [seed];
        assigned.add(seed);

        for (let index = 0; index < cells.length; index++) {
            const cell = cells[index];

            for (let side = 0; side < 4; side++) {
                const next = cellOnSide(walkGrid, cell, side);
                if (assigned.has(next) || fenced(walkGrid, cell, side, next)) continue;
                if (roomOf(walkGrid, next) !== screen || !roomCell(walkGrid, cuts, next)) continue;

                assigned.add(next);
                cells.push(next);
            }
        }

        cells.sort(ascending);
        const roomPieces: Piece[] = [];

        for (const cell of cells) {
            const piece = pieces.get(cell);
            if (piece) roomPieces.push(piece);
        }

        if (roomPieces.length > 0) rooms.push({ cells, pieces: roomPieces });
    }

    return rooms;
}

/** `roomsOf()` with the objects out of the grid: what holds up a cell is the ground. */
function roomsWithoutObjects(
    walkGrid: WalkGrid,
    cuts: Set<number>,
    pieces: Map<number, Piece>,
    seeds: number[],
): Room[] {
    const grid = walkGrid.grid;
    for (const piece of pieces.values()) grid[piece.cell] &= ~piece.bits;
    const rooms = roomsOf(walkGrid, cuts, pieces, seeds);
    for (const piece of pieces.values()) grid[piece.cell] |= piece.bits;

    return rooms;
}

const NO_PIECE = -1;
const UNASSIGNED = -2;

/**
 * The pieces of ground the hero stands in with the objects in some positions: per local cell of a RoomGraph the piece
 * it lies in (NO_PIECE where the hero does not stand). `visited`: the hero's pieces (as a key) a search has been through
 * in these positions.
 */
interface Ground {
    pieceOf: Int16Array;
    visited: Set<number | string>;
}

/**
 * A room's cells and the cells beside it that the hero stands in (its halo: ground in the same z, joined to the room by
 * an edge no Fence is on), with the steps between them. `heroStatic`: the cells the hero stands in whatever the
 * objects do; `heroDynamic`: those he stands in only while an object holds up the cell.
 */
class RoomGraph {
    cells: number[];
    roomCount: number;
    localOf = new Map<number, number>();
    private steps: Int32Array;
    private heroStatic: Uint8Array;
    private heroDynamic: Uint8Array;
    private walkGrid: WalkGrid;

    constructor(walkGrid: WalkGrid, cuts: Set<number>, roomCells: number[]) {
        const grid = walkGrid.grid;
        this.walkGrid = walkGrid;
        const cells = [...roomCells];
        const known = new Set(roomCells);
        this.roomCount = cells.length;

        for (const cell of roomCells) {
            for (let side = 0; side < 4; side++) {
                const next = cellOnSide(walkGrid, cell, side);
                if (known.has(next) || fenced(walkGrid, cell, side, next)) continue;
                if (!plainGround(walkGrid, cuts, next)) continue;

                known.add(next);
                cells.push(next);
            }
        }

        this.cells = cells;
        cells.forEach((cell, local) => this.localOf.set(cell, local));

        this.steps = new Int32Array(cells.length * 4).fill(-1);
        this.heroStatic = new Uint8Array(cells.length);
        this.heroDynamic = new Uint8Array(cells.length);

        cells.forEach((cell, local) => {
            for (let side = 0; side < 4; side++) {
                const next = cellOnSide(walkGrid, cell, side);
                const nextLocal = this.localOf.get(next);
                if (nextLocal !== undefined && !fenced(walkGrid, cell, side, next)) {
                    this.steps[local * 4 + side] = nextLocal;
                }
            }
        });

        const lifted = roomCells.map((cell): [cell: number, bits: number] => [
            cell,
            grid[cell] & (ROCK | MONSTER | MOVABLE | SUPPORT),
        ]);

        for (const [cell, bits] of lifted) grid[cell] &= ~bits;

        // a cell the hero does not stand in: attacked, solid, or under the water's surface
        const barred = (cell: number): boolean => {
            return attackedAt(walkGrid, cell) || (grid[cell] & SOLID) !== 0 || deep(walkGrid, cell);
        };

        cells.forEach((cell, local) => {
            if (!barred(cell) && standable(walkGrid, walkGrid.noFlood, cell)) this.heroStatic[local] = 1;
        });

        for (const [cell, bits] of lifted) grid[cell] |= bits;

        cells.forEach((cell, local) => {
            const open = !barred(cell);
            if (open && !this.heroStatic[local] && standable(walkGrid, walkGrid.noFlood, cell)) {
                this.heroDynamic[local] = 1;
            }
        });
    }

    /** Whether the hero can stand in local cell `local` with the objects as they are in the grid. */
    private stands(local: number): boolean {
        const cell = this.cells[local];
        if (this.walkGrid.grid[cell] & PUSH) return false;
        if (this.heroStatic[local]) return true;
        return this.heroDynamic[local] === 1 && standable(this.walkGrid, this.walkGrid.noFlood, cell);
    }

    /** Splits the cells the hero stands in, the objects as they are in the grid, into pieces of ground. */
    groundOf(): Ground {
        const { steps, cells } = this;
        const pieceOf = new Int16Array(cells.length);
        const queue: number[] = [];
        let pieceCount = 0;

        for (let local = 0; local < cells.length; local++) {
            pieceOf[local] = this.stands(local) ? UNASSIGNED : NO_PIECE;
        }

        for (let start = 0; start < cells.length; start++) {
            if (pieceOf[start] !== UNASSIGNED) continue;

            const piece = pieceCount;
            pieceCount++;
            pieceOf[start] = piece;
            queue.length = 0;
            queue.push(start);

            for (let index = 0; index < queue.length; index++) {
                const local = queue[index];

                for (let side = 0; side < 4; side++) {
                    const next = steps[local * 4 + side];
                    if (next < 0 || pieceOf[next] !== UNASSIGNED) continue;

                    pieceOf[next] = piece;
                    queue.push(next);
                }
            }
        }

        return { pieceOf, visited: new Set() };
    }

    /** The pieces of `ground` that the cells `seeds` and `extraSeed` stand in, each once. */
    piecesAt(ground: Ground, seeds: number[], extraSeed: number): number[] {
        const pieces: number[] = [];

        for (const seed of seeds) this.addPieceAt(ground, pieces, seed);
        this.addPieceAt(ground, pieces, extraSeed);

        return pieces;
    }

    private addPieceAt(ground: Ground, pieces: number[], seed: number): void {
        const local = this.localOf.get(seed);
        if (local === undefined) return;

        const piece = ground.pieceOf[local];
        if (piece !== NO_PIECE && !pieces.includes(piece)) pieces.push(piece);
    }

    /** Whether `cell` lies in one of the pieces `pieces` of `ground`. */
    standsIn(ground: Ground, pieces: number[], cell: number): boolean {
        const local = this.localOf.get(cell);
        if (local === undefined) return false;

        return pieces.includes(ground.pieceOf[local]);
    }

    /** The cells the hero stands in from `seeds`, the objects as they are in the grid. */
    regionOf(seeds: number[]): number[] {
        const ground = this.groundOf();
        const pieces = this.piecesAt(ground, seeds, -1);
        return this.cells.filter((_, local) => pieces.includes(ground.pieceOf[local]));
    }

    /**
     * The start components of the room with the objects where the level data has them: the pieces of ground the hero
     * stands in that reach into the halo (all of them for a room the halo does not touch), the largest MAX_STARTS, each
     * as its lowest room cell, else its lowest cell.
     */
    starts(): number[] {
        const seen = new Set<number>();
        const components: Array<{ rep: number; size: number; halo: boolean }> = [];

        this.cells.forEach((cell, local) => {
            if (seen.has(cell) || !this.stands(local)) return;

            const region = this.regionOf([cell]);
            let rep = -1;
            let halo = false;

            for (const regionCell of region) {
                seen.add(regionCell);

                if ((this.localOf.get(regionCell) ?? 0) >= this.roomCount) {
                    halo = true;
                } else if (rep < 0 || regionCell < rep) {
                    rep = regionCell;
                }
            }

            if (rep < 0) rep = Math.min(...region);
            components.push({ rep, size: region.length, halo });
        });

        const entering = components.filter((component) => component.halo);
        const chosen = entering.length > 0 ? entering : components;
        chosen.sort((first, second) => second.size - first.size || first.rep - second.rep);

        return chosen.slice(0, MAX_STARTS).map((component) => component.rep);
    }
}

/** The objects' positions in a search: the cell of each piece of the room, or GONE or DEAD. */
type Positions = Int32Array;

/** What a search reads and writes besides the grid. */
interface Searcher {
    walkGrid: WalkGrid;
    room: Room;
    graph: RoomGraph;
    switchCells: Set<number>;
    slotCells: Set<number>;
    // the goblins of the walker by their cell
    goblinAt: Map<number, number>;
    // the positions the grid holds now
    loaded: Positions;
    found: Found;
}

/** Puts the objects in the grid where `next` has them. */
function loadPositions(searcher: Searcher, next: Positions): void {
    const { walkGrid, room, loaded } = searcher;
    const grid = walkGrid.grid;

    room.pieces.forEach((piece, index) => {
        if (loaded[index] === next[index]) return;
        if (loaded[index] >= 0) grid[loaded[index]] &= ~piece.bits;
    });

    room.pieces.forEach((piece, index) => {
        if (loaded[index] === next[index]) return;
        if (next[index] >= 0) grid[next[index]] |= piece.bits;
        loaded[index] = next[index];
    });
}

/** The walker's goblins by their cell, as indices into its `monsters`. */
function goblinCellsOf(walkGrid: WalkGrid): Map<number, number> {
    const goblins = new Map<number, number>();

    walkGrid.monsters.forEach(({ cell, facing }, monsterIndex) => {
        if (facing === GOBLIN) goblins.set(cell, monsterIndex);
    });

    return goblins;
}

/** The goblins that stand in a cell with the objects in `positions`, by cell: the walker's, the room's moved. */
function goblinsAt(searcher: Searcher, positions: Positions): Map<number, number> {
    const { walkGrid, room } = searcher;
    const goblins = new Map(searcher.goblinAt);

    room.pieces.forEach((piece, index) => {
        if (piece.kind !== MONSTER_PIECE || walkGrid.monsters[piece.monsterIndex].facing !== GOBLIN) return;

        goblins.delete(piece.cell);
        if (positions[index] >= 0) goblins.set(positions[index], piece.monsterIndex);
    });

    return goblins;
}

/**
 * Notes what the Monster `index` pushed to `cell` meets there, as monster-pushes.ts reads it, with the objects in
 * `positions` (the Monster in `cell`; the grid holds them): it dies in the fire of another dragon (one standing off
 * the cell the level data puts it in burns nothing there) or beside a living goblin, and a dragon's fire from `cell`
 * kills the first Monster it hits. The dead go to `found` and are DEAD in `positions`.
 */
function meetMonsters(searcher: Searcher, positions: Positions, index: number, cell: number): void {
    const { walkGrid, room, found } = searcher;
    const piece = room.pieces[index];
    const monster = walkGrid.monsters[piece.monsterIndex];
    const burnedOut = new Uint8Array(walkGrid.monsters.length);
    const dead = new Uint8Array(walkGrid.monsters.length);

    room.pieces.forEach((other, otherIndex) => {
        if (other.kind !== MONSTER_PIECE) return;
        if (positions[otherIndex] !== other.cell) burnedOut[other.monsterIndex] = 1;
        if (positions[otherIndex] === DEAD) dead[other.monsterIndex] = 1;
    });

    if (monster.facing >= 0) {
        const hit = fireTarget(walkGrid, cell, monster.facing, -1);

        room.pieces.forEach((other, otherIndex) => {
            if (otherIndex === index || other.kind !== MONSTER_PIECE) return;
            if (hit < 0 || positions[otherIndex] !== hit) return;

            found.dead.add(other.cell);
            positions[otherIndex] = DEAD;
        });
    }

    const burns = burnsAt(walkGrid, burnedOut, cell, piece.monsterIndex);
    const goblins = goblinsAt(searcher, positions);
    const beside = goblinBeside(walkGrid, goblins, dead, cell, piece.monsterIndex);

    if (burns || beside) {
        found.dead.add(piece.cell);
        positions[index] = DEAD;
    }
}

/** A push the hero can make now: object `index`, on side `side`, to where `landingOf` puts it. */
interface Move {
    index: number;
    from: number;
    landing: { cell: number; sinks: boolean };
}

/**
 * The pushes the hero can make from the pieces `heroPieces` of `ground`: the objects still in a cell, each on every side
 * where he stands in the cell behind it, no Fence parts the cells, the object stands on a floor and landingOf lets it
 * end somewhere. An object that ends where the hero has no cell behind it is not pushed again.
 */
function movesOf(searcher: Searcher, positions: Positions, ground: Ground, heroPieces: number[]): Move[] {
    const { walkGrid, room, graph } = searcher;
    const layerCells = walkGrid.layerCells;
    const moves: Move[] = [];

    for (let index = 0; index < room.pieces.length; index++) {
        const from = positions[index];
        if (from < 0 || attackedAt(walkGrid, from)) continue;

        const z = Math.floor(from / layerCells) - Z_BIAS;
        if (walled(walkGrid, walkGrid.noFlood, from) || !holdsStone(walkGrid, walkGrid.noFlood, from, z)) continue;

        for (let side = 0; side < 4; side++) {
            const heroCell = cellOnSide(walkGrid, from, (side + 2) % 4);
            const into = cellOnSide(walkGrid, from, side);
            if (!graph.standsIn(ground, heroPieces, heroCell)) continue;
            if (fenced(walkGrid, from, side, into) || fenced(walkGrid, heroCell, side, from)) continue;

            const landing = landingOf(walkGrid, walkGrid.noFlood, from, side);
            if (landing) moves.push({ index, from, landing });
        }
    }

    return moves;
}

/**
 * The positions after a push: the object sinks (a Rock or spare Gem bridges there, a Monster drowns, a skipping stone
 * is gone; anything else is not pushed into water), or it ends in the cell it lands in. What it did is noted in `found`.
 * null when the push does not happen.
 */
function afterMove(searcher: Searcher, positions: Positions, move: Move): Positions | null {
    const { room, switchCells, slotCells, found } = searcher;
    const { index, landing } = move;
    const piece = room.pieces[index];
    const next = positions.slice();

    if (landing.sinks) {
        if (piece.kind === ROCK_PIECE || piece.kind === SPARE_GEM_PIECE) {
            addValue(found.bridges, piece.cell, landing.cell);
            next[index] = GONE;
        } else if (piece.kind === MONSTER_PIECE) {
            found.dead.add(piece.cell);
            next[index] = DEAD;
        } else if (piece.kind === STONE_PIECE) {
            next[index] = GONE;
        } else {
            return null;
        }

        return next;
    }

    next[index] = landing.cell;

    if (switchCells.has(landing.cell)) addValue(found.holders, landing.cell, piece.cell);
    if (slotCells.has(landing.cell) && piece.kind === GEM_PIECE) addValue(found.filled, landing.cell, piece.cell);

    if (piece.kind === MONSTER_PIECE) {
        loadPositions(searcher, next);
        meetMonsters(searcher, next, index, landing.cell);
    }

    return next;
}

/** The result of one search of a room from some start cells. */
interface SearchResult {
    found: Found;
    states: number;
    capped: boolean;
}

/** A position of the objects waiting to be pushed on, its ground and the pieces of it the hero walks on. */
interface State {
    positions: Positions;
    ground: Ground;
    heroPieces: number[];
}

/** Notes the hero's pieces of a ground as visited; false when an earlier state had them. */
function noteHeroPieces(ground: Ground, heroPieces: number[]): boolean {
    let key: number | string = '';

    if (heroPieces.length === 1) {
        key = heroPieces[0];
    } else if (heroPieces.length > 1) {
        key = heroPieces.toSorted(ascending).join(',');
    }

    if (ground.visited.has(key)) return false;

    ground.visited.add(key);
    return true;
}

/**
 * Visits every position of the room's objects that the hero reaches from the start cells `reps` by pushes, one push at
 * a time: the hero stands in the cells he walks to from the start cells and from the cell his last push left. A
 * position is told apart by where each object is and by the pieces of ground the hero's region is made of.
 */
function searchFrom(
    walkGrid: WalkGrid,
    room: Room,
    graph: RoomGraph,
    reps: number[],
    switchCells: Set<number>,
    slotCells: Set<number>,
    stateCap: number,
): SearchResult {
    const start = Int32Array.from(room.pieces, (piece) => piece.cell);
    const searcher: Searcher = {
        walkGrid,
        room,
        graph,
        switchCells,
        slotCells,
        goblinAt: goblinCellsOf(walkGrid),
        loaded: Int32Array.from(start),
        found: newFound(),
    };

    // the ground of each position of the objects, found once however the hero got there
    const grounds = new Map<string, Ground>();
    const groundAt = (positions: Positions, positionsKey: string): Ground => {
        const known = grounds.get(positionsKey);
        if (known) return known;

        loadPositions(searcher, positions);
        const ground = graph.groundOf();
        grounds.set(positionsKey, ground);
        return ground;
    };

    const startGround = groundAt(start, start.join(','));
    const startPieces = graph.piecesAt(startGround, reps, -1);
    const queue: State[] = [{ positions: start, ground: startGround, heroPieces: startPieces }];
    noteHeroPieces(startGround, startPieces);
    let stateCount = 1;
    let capped = false;

    for (let index = 0; index < queue.length; index++) {
        if (stateCount > stateCap) {
            capped = true;
            break;
        }

        const { positions, ground, heroPieces } = queue[index];
        loadPositions(searcher, positions);
        const moves = movesOf(searcher, positions, ground, heroPieces);

        for (const move of moves) {
            const after = afterMove(searcher, positions, move);
            if (!after) continue;

            const afterGround = groundAt(after, after.join(','));
            const afterPieces = graph.piecesAt(afterGround, reps, move.from);
            if (!noteHeroPieces(afterGround, afterPieces)) continue;

            stateCount++;
            queue.push({ positions: after, ground: afterGround, heroPieces: afterPieces });
        }
    }

    loadPositions(searcher, start);
    return { found: searcher.found, states: stateCount, capped };
}

/**
 * The entry of a search from the start cells `reps`: its findings, less those in `known` (the findings of searches
 * from some of the same starts).
 */
function entryOf(reps: number[], found: Found, known: Found | null): RoomEntry {
    const entry: RoomEntry = {
        reps: reps.toSorted(ascending),
        bridges: new Map(),
        holders: new Map(),
        filled: new Map(),
        dead: new Set(),
    };

    const copy = (
        from: Map<number, Set<number>>,
        to: Map<number, number[]>,
        knownFrom: Map<number, Set<number>> | undefined,
    ): void => {
        for (const key of [...from.keys()].toSorted(ascending)) {
            const values = [...(from.get(key) ?? [])].toSorted(ascending);
            const knownValues = knownFrom?.get(key);
            const fresh: number[] = [];

            for (const value of values) {
                if (!knownValues?.has(value)) fresh.push(value);
            }

            if (fresh.length > 0) to.set(key, fresh);
        }
    };

    copy(found.bridges, entry.bridges, known?.bridges);
    copy(found.holders, entry.holders, known?.holders);
    copy(found.filled, entry.filled, known?.filled);

    for (const cell of [...found.dead].toSorted(ascending)) {
        if (!known?.dead.has(cell)) entry.dead.add(cell);
    }

    return entry;
}

function isEmpty(entry: RoomEntry): boolean {
    return entry.bridges.size === 0 && entry.holders.size === 0 && entry.filled.size === 0 && entry.dead.size === 0;
}

/** The findings of several searches together. */
function together(parts: Found[]): Found {
    const all = newFound();

    const addAll = (from: Map<number, Set<number>>, to: Map<number, Set<number>>): void => {
        for (const [key, values] of from) {
            for (const value of values) addValue(to, key, value);
        }
    };

    for (const part of parts) {
        addAll(part.bridges, all.bridges);
        addAll(part.holders, all.holders);
        addAll(part.filled, all.filled);
        for (const cell of part.dead) all.dead.add(cell);
    }

    return all;
}

/**
 * The cells the hero stands in at the start of a room from the start cells `reps`, the objects in the cells the level
 * data puts them in, in the room of `cells`.
 */
export function startRegion(walkGrid: WalkGrid, cells: number[], reps: number[]): number[] {
    const graph = new RoomGraph(walkGrid, cutCellsOf(walkGrid), cells);
    return graph.regionOf(reps);
}

/** The Monsters (their pids) whose attacks cross each cell: a goblin's six cells beside it and a dragon's fire. */
function attackersOf(walkGrid: WalkGrid): Map<number, number[]> {
    const attackerAt = new Map<number, number[]>();
    const { layerCells } = walkGrid;

    const note = (cell: number, pid: number): void => {
        const pids = attackerAt.get(cell);
        if (!pids) {
            attackerAt.set(cell, [pid]);
        } else if (!pids.includes(pid)) {
            pids.push(pid);
        }
    };

    walkGrid.monsters.forEach(({ pid, cell, facing }, monsterIndex) => {
        if (facing === GOBLIN) {
            for (let side = 0; side < 4; side++) note(cellOnSide(walkGrid, cell, side), pid);
            note(cell + layerCells, pid);
            note(cell - layerCells, pid);
        }

        for (const fireCell of walkGrid.fireOf.get(monsterIndex) ?? []) note(fireCell, pid);
    });

    return attackerAt;
}

/** What searching the rooms reads besides the walker's grid. */
interface RoomSearch {
    walkGrid: WalkGrid;
    pieces: Map<number, Piece>;
    attackerAt: Map<number, number[]>;
    switchCells: Set<number>;
    slotCells: Set<number>;
    result: RoomSearchResult;
}

/** What searching a room from its starts found: its entries, how many starts it has, the positions visited. */
interface RoomEntries {
    entries: RoomEntry[];
    starts: number;
    states: number;
    capped: boolean;
}

/**
 * Searches a room from each of its start components and from all of them together, with the grid as it is, each search
 * visiting `stateCap` positions at most. null when the room has no start. The entries are those with something to tell,
 * and none when a search hit the cap.
 */
function entriesOfRoom(
    walkGrid: WalkGrid,
    graph: RoomGraph,
    room: Room,
    switchCells: Set<number>,
    slotCells: Set<number>,
    stateCap: number,
): RoomEntries | null {
    const starts = graph.starts();
    if (starts.length === 0) return null;

    const runs: number[][] = starts.map((start) => [start]);
    if (starts.length > 1) runs.push(starts);

    const searches: SearchResult[] = [];
    let states = 0;
    let capped = false;

    for (const reps of runs) {
        const found = searchFrom(walkGrid, room, graph, reps, switchCells, slotCells, stateCap);
        states += found.states;
        searches.push(found);
        if (found.capped) capped = true;
    }

    if (capped) return { entries: [], starts: starts.length, states, capped };

    const entries: RoomEntry[] = [];

    if (starts.length === 1) {
        entries.push(entryOf(starts, searches[0].found, null));
    } else {
        for (let index = 0; index < starts.length; index++) {
            entries.push(entryOf([starts[index]], searches[index].found, null));
        }

        const single = together(searches.slice(0, starts.length).map((one) => one.found));
        entries.push(entryOf(starts, searches[starts.length].found, single));
    }

    const answered = entries.filter((entry) => !isEmpty(entry));
    return { entries: answered, starts: starts.length, states, capped };
}

/**
 * Searches one room with the grid as it is (its Freezers closed or open as the grid has them), counted as a search of
 * a `variant` (some Freezer open) or of a room. The room's answer. It has no entries when the room has no start, hit
 * STATE_CAP or has nothing to tell, so that a walker which finds the room as the level data has it does not search it
 * again. Its `opens` are left empty.
 */
function answerRoom(search: RoomSearch, cuts: Set<number>, room: Room, variant: boolean): StoredRoom {
    const { walkGrid, attackerAt, switchCells, slotCells, result } = search;
    const graph = new RoomGraph(walkGrid, cuts, room.cells);
    const found = entriesOfRoom(walkGrid, graph, room, switchCells, slotCells, STATE_CAP);

    const attackers = new Set<number>();
    for (const cell of graph.cells) {
        for (const pid of attackerAt.get(cell) ?? []) attackers.add(pid);
    }

    if (found) {
        if (variant) {
            result.variants++;
        } else {
            result.searched++;
        }

        result.states += found.states;

        if (found.capped) {
            if (!result.capped.includes(room.cells[0])) result.capped.push(room.cells[0]);
        } else if (found.starts > 1) {
            result.multiStart++;
        }
    }

    const entries = found ? found.entries : [];
    return { cells: room.cells, attackers: [...attackers].toSorted(ascending), entries, opens: [] };
}

/** An answer as the file holds it but for the states it holds in: what two rooms with the same answer share. */
function answerText(answer: StoredRoom): string {
    return JSON.stringify(packRooms([{ ...answer, opens: [] }]));
}

/** The bit set (over `freezers`) of the Freezers of `open`. */
function openSet(freezers: number[], open: Set<number>): number {
    let bits = 0;

    for (let bit = 0; bit < freezers.length; bit++) {
        if (open.has(freezers[bit])) bits |= 1 << bit;
    }

    return bits;
}

/**
 * Searches the rooms the Freezers `opened` make of `base`, the cells of a room with every Freezer closed: with those
 * Freezers open the cells of their squares are ground, and the rooms on their far sides join `base` and each other.
 * Each room the Freezers leave of the cells (up to MAX_BOUNDARY_FREEZERS Freezers around it) is searched with them open,
 * unless `seen` holds it with the same Freezers open, and its answer is noted in `answers`.
 */
function searchOpened(
    search: RoomSearch,
    base: number[],
    opened: number[],
    seen: Set<string>,
    answers: Map<string, StoredRoom>,
): void {
    const { walkGrid, pieces } = search;
    const { geometry } = walkGrid;
    const openCells = opened.map((freezerIndex) => geometry.freezerCells[freezerIndex]);
    const open = new Set<number>(opened);

    for (const cell of openCells) thaw(walkGrid, cell);

    // a dragon's fire runs through an open Freezer
    recastAttacks(walkGrid);
    const closedAttackerAt = search.attackerAt;
    search.attackerAt = attackersOf(walkGrid);

    const cuts = cutCellsOf(walkGrid);
    const seeds = [...base, ...openCells].toSorted(ascending);
    const rooms = roomsWithoutObjects(walkGrid, cuts, pieces, seeds);

    for (const room of rooms) {
        const freezers = boundaryFreezers(geometry, room.cells);
        if (freezers.length > MAX_BOUNDARY_FREEZERS) continue;

        const opens = openSet(freezers, open);
        const key = `${room.cells.join(',')}|${opens}`;
        if (seen.has(key)) continue;

        seen.add(key);
        noteAnswer(answers, answerRoom(search, cuts, room, true), opens);
    }

    opened.forEach((freezerIndex, index) => freeze(walkGrid, openCells[index], freezerIndex));
    recastAttacks(walkGrid);
    search.attackerAt = closedAttackerAt;
}

/** Notes `answer` in `answers` as holding for the Freezers `opens`, joining an answer that is the same room's. */
function noteAnswer(answers: Map<string, StoredRoom>, answer: StoredRoom, opens: number): void {
    const key = answerText(answer);
    const same = answers.get(key);
    if (same) {
        if (!same.opens.includes(opens)) same.opens.push(opens);
    } else {
        answer.opens.push(opens);
        answers.set(key, answer);
    }
}

/**
 * Searches every screen room that holds pushable objects, on a walker's grid built from the level data alone (nothing
 * in the save, every Freezer closed), and returns the answers of the rooms: those that finish within STATE_CAP positions
 * have entries, a room with several start components getting one for each and one for all of them together; a room
 * with no start, nothing to tell or too many positions is stored with no entries, so a walker can tell it was searched.
 *
 * A room with up to MAX_VARIANT_FREEZERS Freezers around it is searched for every other combination of those Freezers
 * open too. With some open, the rooms they join are one room, and the answer holds for that state of the Freezers around
 * it. Rooms with the same cells and the same answer are stored once, for every state they hold in.
 */
export function searchRooms(walkGrid: WalkGrid): RoomSearchResult {
    const result: RoomSearchResult = { rooms: [], capped: [], searched: 0, variants: 0, states: 0, multiStart: 0 };
    const search: RoomSearch = {
        walkGrid,
        pieces: piecesOf(walkGrid),
        attackerAt: attackersOf(walkGrid),
        switchCells: new Set<number>(walkGrid.geometry.switchCells),
        slotCells: new Set<number>(walkGrid.geometry.gemSlotCells),
        result,
    };

    const cuts = cutCellsOf(walkGrid);
    const seeds = [...search.pieces.keys()].toSorted(ascending);
    const rooms = roomsWithoutObjects(walkGrid, cuts, search.pieces, seeds);

    const answers = new Map<string, StoredRoom>();
    const seen = new Set<string>();

    for (const room of rooms) {
        seen.add(`${room.cells.join(',')}|0`);
        noteAnswer(answers, answerRoom(search, cuts, room, false), 0);
    }

    for (const room of rooms) {
        const freezers = boundaryFreezers(walkGrid.geometry, room.cells);
        if (freezers.length === 0 || freezers.length > MAX_VARIANT_FREEZERS) continue;

        for (let combination = 1; combination < 1 << freezers.length; combination++) {
            const opened: number[] = [];

            for (let bit = 0; bit < freezers.length; bit++) {
                if (combination & (1 << bit)) opened.push(freezers[bit]);
            }

            searchOpened(search, room.cells, opened, seen, answers);
        }
    }

    for (const answer of answers.values()) answer.opens.sort(ascending);
    result.rooms = [...answers.values()];

    return result;
}

/**
 * Searches the rooms of the walker's grid, as a save left it, that hold a pushable object in a cell the stored answers
 * in `rooms` do not cover (the rooms the save changed), and adds their answers to `rooms`. The room search is the one
 * that stores the answers; only its inputs differ: the objects stand where the grid has them, with its Freezers, Gates,
 * water and attacks. A room that needs more than LIVE_STATE_CAP positions is left out.
 */
export function searchTouchedRooms(walkGrid: WalkGrid, rooms: RoomIndex): void {
    const pieces = piecesOf(walkGrid);
    const seeds: number[] = [];

    for (const cell of pieces.keys()) {
        if (!rooms.covered.has(cell)) seeds.push(cell);
    }

    if (seeds.length === 0) return;

    seeds.sort(ascending);
    const cuts = cutCellsOf(walkGrid);
    const touched = roomsWithoutObjects(walkGrid, cuts, pieces, seeds);
    const switchCells = new Set<number>(walkGrid.geometry.switchCells);
    const slotCells = new Set<number>(walkGrid.geometry.gemSlotCells);

    for (const room of touched) {
        const graph = new RoomGraph(walkGrid, cuts, room.cells);
        const found = entriesOfRoom(walkGrid, graph, room, switchCells, slotCells, LIVE_STATE_CAP);
        if (!found || found.capped) continue;

        for (const cell of room.cells) {
            rooms.covered.add(cell);
            if (found.entries.length > 0) rooms.byCell.set(cell, found.entries);
        }
    }
}
