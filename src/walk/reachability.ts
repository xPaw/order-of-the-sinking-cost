// Where the hero has been and can go: the reached cells, the levels behind closed Freezers and the floor heights
// (VIEWER.md "Seeds and the reached cells", "Pockets, leads and why")
import { PROG, WORLD } from '../data.ts';
import { heroesWithSkill, latestFlag, PROTECTION_FLAG, TELEPORT_FLAG, TRANSMUTE_FLAG } from '../save.ts';
import type { History, LatestValues } from '../save.ts';
import type { KnownRoute } from '../types.ts';
import { addTo, gridCol, STEP, Z_BIAS } from './cells.ts';
import type { FloodOptions, Seed } from './flood.ts';
import { ICE } from './freezers.ts';
import { PROTECTED, TRANSMUTING, WIZARD } from './skills.ts';
import type { TeleporterState } from './teleporters.ts';
import { walker } from './walker.ts';
import type { Walker } from './walker.ts';

/**
 * The Freezers a level's pads lead through that its own pockets' edges do not, the levels they reach, and the towers
 * whose activation enables a pad that leads in.
 */
export interface ViaPads {
    gates: number[];
    levels: number[];
    towers: number[];
}

/**
 * What reachability() finds. `level`: per level, whether the walk reaches it. `leads` and `pocket`: per closed
 * Freezer, the levels not entered that opening it reaches, for the Freezers on the edge of the reached cells and for
 * the others. `lightLeads`: per closed Freezer that holds a powered Promesst_Light, the levels not entered that opening
 * it reaches beyond those `leads` and `pocket` give it, through the light's beam. `from`: per level not reached that
 * such a Freezer needs, the levels behind it a walk from it reaches.
 * `mech`: per level, the unmodelled mechanics in or next to the pockets that hold it. `fromSky`: per level, 1 when a
 * hero stepping off a sky ledge falls into one of those pockets, or walks on from where he lands to the level.
 * `viaPads`: per level, what the pads revealed from those pockets lead through, and what the MINOR pads that land the
 * hero where he walks on to the level lead through. `dead`: the kept hero positions inside a wall. `reached`: the cells
 * the main flood reached. `cols`: the reached cells per map layer and column, less the Lily drift cells the hero only
 * rides through. `signFaced`: per Sign, 1 when a reached cell next to it has no Fence between and the Sign's own cell
 * holds no closed Freezer: a hero there can face the Sign and read it. `chains`: per level, the closed Freezers on the
 * edge of its pockets that open onto nothing but more closed Freezers, each with the ways through it: the Freezer and
 * one Freezer beyond it, both needed. `signBehind`: per Sign not faced, the closed Freezers whose opening lets a walk
 * face it: those whose lead, pocket or light lead reaches a cell beside it, and the Freezer in its own cell.
 */
export interface Reachability {
    reached: Set<number>;
    level: boolean[];
    leads: Map<number, number[]>;
    pocket: Map<number, number[]>;
    lightLeads: Map<number, number[]>;
    chains: Map<number, Map<number, number[][]>>;
    from: Map<number, Set<number>>;
    mech: Uint8Array;
    fromSky: Uint8Array;
    viaPads: Map<number, ViaPads>;
    dead: number;
    cols: Record<string, Uint8Array>;
    signFaced: Uint8Array;
    signBehind: number[][];
}

/**
 * The Signs the main flood does not face, as the pocket floods look at them: `spots`, the cells beside a Sign with no
 * Fence between; `own`: per Sign, the closed Freezer in its cell; `gates`: per Sign, the closed Freezers found so far
 * whose opening lets a walk stand on one of its spots.
 */
interface SignWays {
    spots: Array<{ signIndex: number; spotCell: number }>;
    own: Array<number | undefined>;
    gates: Array<Set<number>>;
}

/** The pocket a walk from a revealing pad's cell reaches: the closed Freezers it bumps into, and its levels. */
interface PadPocket {
    bumped: Set<number>;
    levels: number[];
}

/**
 * A level's pocket flood: the closed Freezers it bumps into, its levels, and the Freezers and levels its revealing pads
 * add (those of the revealing pads' pockets that it does not hold itself). `doorways`: per Freezer it bumps into that
 * opens onto nothing but more closed Freezers, those Freezers.
 */
interface PocketWays {
    bumped: Set<number>;
    members: Set<number>;
    viaPad: Set<number>;
    viaLevel: Set<number>;
    doorways: Map<number, number[]>;
}

/**
 * What the steps of reachability() share: the walker, each level's cell, the cells the main flood
 * reached and the closed Freezers on their edge (`front`), the Freezer each level is frozen in, and the levels not
 * entered and not reached (`rest`) with the cells they stand in (`restCells`; `restAt`: per cell, the positions in
 * `rest` of the levels there), and the Signs the main flood does not face (`signWays`).
 */
interface ReachContext {
    walk: Walker;
    teleporterStates: TeleporterState[];
    levelCells: number[];
    reached: Set<number>;
    front: Set<number>;
    frozenIn: Array<number | undefined>;
    rest: number[];
    restCells: number[];
    restAt: Map<number, number[]>;
    signWays: SignWays;
}

/**
 * The pad pockets and level pockets of one walk: per level, the pocket floods that hold it (`ofLevel`, indices into
 * `ways`) and the levels of the first pocket it is in (`first`); `fromSky`: per level, 1 when a hero stepping off a sky
 * ledge falls into a pocket that holds it, or walks on from where he lands to it; `landing`: per level, what the MINOR
 * pads that land the hero where he walks on to it lead through, less what its own pockets hold.
 */
interface Pockets {
    ways: PocketWays[];
    ofLevel: Map<number, number[]>;
    first: Map<number, Set<number>>;
    fromSky: Uint8Array;
    landing: Map<number, ViaPads>;
}

/**
 * Leads through the Freezers that hold a stone a hero with CHARM would launch (`stoneFront`, noted by the main flood):
 * the stone is not a cell the hero walks to, so the lead is the walk from the seeds with that Freezer open, which may
 * press a Switch. The Freezers join `front` as leads, with the levels not entered that the walk then reaches.
 */
function addStoneLeads(
    context: ReachContext,
    byGate: Map<number, Set<number>>,
    stoneFront: Set<number>,
    seeds: Seed[],
): void {
    const { walk, front, frozenIn } = context;

    for (const freezerIndex of stoneFront) {
        if (front.has(freezerIndex)) continue;

        const gateCell = walk.cellOf(...PROG.freezers[freezerIndex].p);
        walk.thaw(gateCell);
        const cells = walk.flood(seeds);
        walk.freeze(gateCell, freezerIndex);
        noteSignWays(context.signWays, cells, [freezerIndex]);

        const behind = restLevelsIn(context, cells).filter((levelIndex) => {
            const levelFrozenIn = frozenIn[levelIndex];
            return levelFrozenIn === undefined || levelFrozenIn === freezerIndex;
        });

        if (behind.length > 0) {
            byGate.set(freezerIndex, new Set(behind));
            front.add(freezerIndex);
        }
    }
}

/**
 * The pads that another pad reveals, as the pocket floods look at them: `revealers`, the cell of each revealing pad
 * outside the reached cells with the cells of the pads it reveals; `revealedAt`: per revealed pad cell, the positions
 * in `revealers`.
 */
interface PadRevealers {
    revealers: Array<[revealerCell: number, revealedCells: number[]]>;
    revealedAt: Map<number, number[]>;
}

/** latestOf() of a history with no changes: the level data. */
export const NO_HISTORY: LatestValues = {
    get: () => undefined,
    ocean: [],
    created: new Map(),
    skills: new Map(),
    firstHeadings: new Map(),
};

/**
 * The positions that a set of cells holds, per cell of `positionsAt` (cell -> positions), as a 0 / 1 flag per
 * position; looked up from the smaller side.
 */
function hitsIn(cells: Set<number>, positionsAt: Map<number, number[]>, length: number): Uint8Array {
    const hit = new Uint8Array(length);
    if (cells.size < positionsAt.size) {
        for (const cell of cells) {
            for (const position of positionsAt.get(cell) || []) hit[position] = 1;
        }
    } else {
        for (const [cell, positions] of positionsAt) {
            if (!cells.has(cell)) continue;
            for (const position of positions) hit[position] = 1;
        }
    }

    return hit;
}

/** The levels of `rest` that a set of cells holds. */
function restLevelsIn(context: ReachContext, cells: Set<number>): number[] {
    const hit = hitsIn(cells, context.restAt, context.rest.length);
    return context.rest.filter((_, position) => hit[position] === 1);
}

/**
 * Seeds the walk at the hero positions the history keeps, besides the current one: a position that the hero wore
 * PROTECTION at seeds the PROTECTION layer (a hero inside an attacked cell was held in it, over water or air too), and
 * one where he held TELEPORT seeds the TELEPORT layer as well, and one where he held TRANSMUTE the TRANSMUTE layer.
 * Returns how many lie inside a wall no beam runs through.
 */
function addKeptHeroSeeds(walk: Walker, history: History, seeds: Seed[]): number {
    const guy = PROG.world.guy || [0, 0];
    const protectionKeys = heroesWithSkill(history, guy, PROTECTION_FLAG);
    const wizards = heroesWithSkill(history, guy, TELEPORT_FLAG);
    const druids = heroesWithSkill(history, guy, TRANSMUTE_FLAG);
    let deadSeeds = 0;

    for (const position of history.heroes?.values() ?? []) {
        const cell = walk.cellOf(...position);
        const key = position.join(',');
        const wearsProtection = protectionKeys.has(key);
        const heldInFire = wearsProtection && walk.fire.has(cell);
        const seedCell = heldInFire ? cell : walk.land(cell, false);

        if (walk.insideWall(cell)) {
            deadSeeds++;
        } else if (seedCell >= 0 && !walk.deep(seedCell)) {
            if (wearsProtection) {
                seeds.push([seedCell, PROTECTED]);
            } else {
                seeds.push(seedCell);
                if (wizards.has(key)) seeds.push([seedCell, WIZARD]);
                if (druids.has(key)) seeds.push([seedCell, TRANSMUTING]);
            }
        }
    }

    return deadSeeds;
}

/** The cell where a known route lands the hero. */
function routeCell(walk: Walker, route: KnownRoute, levelCells: number[]): number {
    const target = route.to;
    if ('level' in target) return walk.land(levelCells[target.level]);
    if ('pad' in target) return walk.padCell(target.pad);
    return walk.land(walk.cellOf(...target.at), false);
}

/**
 * The seed of an entered level. A hero stood on its entrance, so one inside an attacked cell was held there by
 * PROTECTION (over air too): that cell seeds the PROTECTION layer. Any other entrance seeds its `land`.
 */
function enteredSeed(walk: Walker, levelCell: number): Seed {
    if (walk.fire.has(levelCell)) return [levelCell, PROTECTED];
    return walk.land(levelCell);
}

/**
 * The seeds of the main flood: the current hero, the kept hero positions, the entered levels, the activated Area_Pins,
 * the discovered teleporters and the targets of the known routes whose needs are met. `dead`: the kept positions inside
 * a wall, which seed nothing.
 */
function seedsOf(
    walk: Walker,
    history: History,
    latest: LatestValues,
    teleporterStates: TeleporterState[],
    entered: readonly boolean[],
    levelCells: number[],
    routes: readonly KnownRoute[],
): { seeds: Seed[]; dead: number } {
    const seeds: Seed[] = [history.hero ? walk.heroSeed(history.hero) : -1];
    const dead = addKeptHeroSeeds(walk, history, seeds);

    PROG.levels.forEach((_, levelIndex) => {
        if (entered[levelIndex]) seeds.push(enteredSeed(walk, levelCells[levelIndex]));
    });

    for (const [pid, x, y, z] of PROG.world.area_pins) {
        if (latestFlag(latest, pid, 'activated')) seeds.push(walk.land(walk.cellOf(x, y, z), false));
    }

    PROG.teleporters.forEach((_, padIndex) => {
        if (teleporterStates[padIndex].disc) seeds.push(walk.padCell(padIndex));
    });

    for (const route of routes) seeds.push(routeCell(walk, route, levelCells));

    return { seeds, dead };
}

/**
 * Per level, the Freezer whose closed cell holds its entrance, else undefined: a level whose entrance is the cell of a
 * closed Freezer is entered once it opens, whatever lies next to it.
 */
function frozenInOf(closedFreezers: readonly boolean[]): Array<number | undefined> {
    return ICE.map((freezerIndex) => {
        if (freezerIndex !== undefined && closedFreezers[freezerIndex]) return freezerIndex;
        return undefined;
    });
}

/**
 * The levels not entered and not reached, with the cells they stand in. A level frozen in a closed Freezer starts its
 * walk in the Freezer's own cell, where the hero stands once it opens.
 */
function restOf(
    walk: Walker,
    entered: readonly boolean[],
    level: boolean[],
    levelCells: number[],
    frozenIn: Array<number | undefined>,
): Pick<ReachContext, 'rest' | 'restCells' | 'restAt'> {
    const rest: number[] = [];

    for (let levelIndex = 0; levelIndex < level.length; levelIndex++) {
        if (!entered[levelIndex] && !level[levelIndex]) rest.push(levelIndex);
    }

    const restCells = rest.map((levelIndex) => {
        if (frozenIn[levelIndex] === undefined) return walk.land(levelCells[levelIndex]);
        return levelCells[levelIndex];
    });

    const restAt = new Map<number, number[]>();
    rest.forEach((levelIndex, position) => {
        for (const cell of new Set([levelCells[levelIndex], restCells[position]])) {
            if (cell >= 0) addTo(restAt, cell, position);
        }
    });

    return { rest, restCells, restAt };
}

/** The levels behind closed Freezer `freezerIndex` in `byGate`, made when it has none yet. */
function levelsBehind(byGate: Map<number, Set<number>>, freezerIndex: number): Set<number> {
    let behind = byGate.get(freezerIndex);
    if (!behind) {
        behind = new Set();
        byGate.set(freezerIndex, behind);
    }

    return behind;
}

/**
 * Leads: for each closed gate on the edge of the reached cells, the levels not entered yet that opening it alone would
 * reach, in `byGate`.
 */
function addLeads(context: ReachContext, byGate: Map<number, Set<number>>): void {
    const { walk, reached, front, frozenIn } = context;

    for (const freezerIndex of front) {
        const gateCell = walk.cellOf(...PROG.freezers[freezerIndex].p);
        walk.thaw(gateCell);
        const cells = walk.flood([walk.land(gateCell)], reached);
        walk.freeze(gateCell, freezerIndex);
        noteSignWays(context.signWays, cells, [freezerIndex]);

        const behind = restLevelsIn(context, cells).filter((levelIndex) => {
            const levelFrozenIn = frozenIn[levelIndex];
            return levelFrozenIn === undefined || levelFrozenIn === freezerIndex;
        });
        byGate.set(freezerIndex, new Set(behind));
    }
}

/**
 * Leads through the closed Freezers that hold a powered Promesst_Light: with the Freezer open and its light's beam laid,
 * the walk from the beam's reached cells (and from the Freezer's own cell when it is on the edge of the reached cells)
 * may go where it could not. Per Freezer, the levels not entered that this reaches beyond those it holds in `byGate`.
 */
function addLightLeads(context: ReachContext, byGate: Map<number, Set<number>>): Map<number, number[]> {
    const { walk, reached, front, frozenIn } = context;
    const lightLeads = new Map<number, number[]>();

    // thaw and freeze change `walk.frozen`, so the walk goes over a copy
    const closedCells = Array.from(walk.frozen);

    for (const [gateCell, freezerIndex] of closedCells) {
        const beamCells = walk.frozenBeamCells(gateCell);
        if (beamCells.length === 0) continue;

        const outside = new Set(reached);
        const seeds: number[] = [];

        for (const cell of beamCells) {
            if (outside.delete(cell)) seeds.push(cell);
        }

        if (front.has(freezerIndex)) seeds.push(walk.land(gateCell));
        if (seeds.length === 0) continue;

        walk.thaw(gateCell);
        const removeBeam = walk.layFrozenBeam(gateCell);
        const cells = walk.flood(seeds, outside);
        removeBeam();
        walk.freeze(gateCell, freezerIndex);
        noteSignWays(context.signWays, cells, [freezerIndex]);

        const held = byGate.get(freezerIndex);
        const added = restLevelsIn(context, cells).filter((levelIndex) => {
            if (held?.has(levelIndex)) return false;

            const levelFrozenIn = frozenIn[levelIndex];
            return levelFrozenIn === undefined || levelFrozenIn === freezerIndex;
        });
        if (added.length > 0) lightLeads.set(freezerIndex, added);
    }

    return lightLeads;
}

/**
 * The pads that another pad reveals. A pocket holding a pad that another pad reveals is also entered by reaching that
 * pad, so the closed gates on the edge of the revealing pad's own pocket lead into it too, and so does reaching a level
 * in that pocket.
 */
function padRevealersOf(context: ReachContext): PadRevealers {
    const { walk, reached } = context;
    const revealers: PadRevealers['revealers'] = [];

    PROG.teleporters.forEach((_, padIndex) => {
        const revealerCell = walk.padCell(padIndex);
        const revealedCells = walk.shown[padIndex].map((revealedPad) => walk.padCell(revealedPad));
        if (revealerCell >= 0 && revealedCells.length > 0 && !reached.has(revealerCell)) {
            revealers.push([revealerCell, revealedCells]);
        }
    });

    const revealedAt = new Map<number, number[]>();

    revealers.forEach(([, revealedCells], revealerIndex) => {
        for (const cell of new Set(revealedCells)) addTo(revealedAt, cell, revealerIndex);
    });

    return { revealers, revealedAt };
}

/** The pocket of the revealing pad at `revealerCell`, flooded the first time it is asked for. */
function padPocketOf(context: ReachContext, padPockets: Map<number, PadPocket>, revealerCell: number): PadPocket {
    let padPocket = padPockets.get(revealerCell);

    if (!padPocket) {
        const bumped = new Set<number>();
        const cells = context.walk.flood([revealerCell], context.reached, bumped, {
            reveal: false,
            frozenHolds: false,
            topDrops: true,
        });
        const pocketLevels = restLevelsIn(context, cells).filter(
            (levelIndex) => context.frozenIn[levelIndex] === undefined,
        );
        padPocket = { bumped, levels: pocketLevels };
        padPockets.set(revealerCell, padPocket);
    }

    return padPocket;
}

/**
 * What floodPockets carries from level to level: the pockets found so far with their cells (`pocketCells`, by index
 * in `pockets.ways`) and the pads' pockets flooded so far.
 */
interface PocketFloods {
    context: ReachContext;
    byGate: Map<number, Set<number>>;
    mech: Uint8Array;
    pockets: Pockets;
    pocketCells: Array<Set<number>>;
    done: Uint8Array;
    enteredFromSky: (cells: Iterable<number>) => boolean;
    pads: PadRevealers;
    padPockets: Map<number, PadPocket>;
    roverFreezers: Set<number>;
    roverFlooded: Set<number>;
}

const POCKET_OPTIONS: FloodOptions = { reveal: false, pocket: true, frozenHolds: false, topDrops: true };

/**
 * What the pads revealed from a pocket's cells add to it: the Freezers on the edge of the revealing pads' pockets that
 * the pocket does not bump into itself, and the levels of those pockets that it does not hold.
 */
function padWaysOf(
    state: PocketFloods,
    cells: Set<number>,
    bumped: Set<number>,
    members: Set<number>,
): Pick<PocketWays, 'viaPad' | 'viaLevel'> {
    const { revealers, revealedAt } = state.pads;
    const viaPad = new Set<number>();
    const viaLevel = new Set<number>();
    const hit = hitsIn(cells, revealedAt, revealers.length);

    revealers.forEach(([revealerCell], revealerIndex) => {
        if (!hit[revealerIndex] || cells.has(revealerCell)) return;

        const revealerPocket = padPocketOf(state.context, state.padPockets, revealerCell);

        for (const freezerIndex of revealerPocket.bumped) {
            if (!bumped.has(freezerIndex)) viaPad.add(freezerIndex);
        }

        for (const other of revealerPocket.levels) {
            if (!members.has(other)) viaLevel.add(other);
        }
    });

    return { viaPad, viaLevel };
}

/**
 * Floods the pocket of the level at position `position` of `rest`, the walkable cells around it, and records what it
 * holds: its levels take its mechanics and sky entrance, and the closed gates on its edge (and those its pads lead
 * through) have the pocket's levels behind them. A level whose cell is no cell the hero stands in has no pocket.
 */
function floodPocketOfLevel(state: PocketFloods, position: number): void {
    const { context, byGate, mech, pockets, done, enteredFromSky } = state;
    const { walk, reached, levelCells, frozenIn, restCells } = context;
    const levelIndex = context.rest[position];
    if (done[levelIndex]) return;

    if (restCells[position] < 0) {
        done[levelIndex] = 1;
        if (levelCells[levelIndex] >= 0) mech[levelIndex] = walk.mechAt([levelCells[levelIndex]]);
        return;
    }

    const bumped = new Set<number>();
    const cells = walk.flood([restCells[position]], reached, bumped, POCKET_OPTIONS);
    const pocketLevels = restLevelsIn(context, cells);
    const mechanicsBits = walk.mechAt(cells);
    const members = new Set(pocketLevels);
    const skyAbove = enteredFromSky(cells);
    const { viaPad, viaLevel } = padWaysOf(state, cells, bumped, members);
    noteSignWays(context.signWays, cells, [...bumped, ...viaPad]);

    const pocketIndex = pockets.ways.length;
    pockets.ways.push({ bumped, members, viaPad, viaLevel, doorways: new Map() });
    state.pocketCells.push(cells);

    // a way into any pocket that holds a level leads on to it, so a level in several pockets takes the
    // mechanics and the sky entrance of each
    for (const pocketLevel of pocketLevels) {
        done[pocketLevel] = 1;
        mech[pocketLevel] |= mechanicsBits;
        if (skyAbove) pockets.fromSky[pocketLevel] = 1;
        if (!pockets.first.has(pocketLevel)) pockets.first.set(pocketLevel, members);
        addTo(pockets.ofLevel, pocketLevel, pocketIndex);
    }

    for (const freezerIndex of [...bumped, ...viaPad]) {
        const behind = levelsBehind(byGate, freezerIndex);

        for (const pocketLevel of pocketLevels) {
            if (frozenIn[pocketLevel] === undefined) behind.add(pocketLevel);
        }
    }

    addRoverGateLevels(state, bumped);
}

/**
 * The Freezers a pocket bumps into that may be doorways: those not on the edge of the reached cells that no pocket
 * holding a level outside it bumps into (such a pocket lies beyond the Freezer).
 */
function doorwayCandidates(state: PocketFloods, pocketIndex: number, bumpedBy: Map<number, number[]>): number[] {
    const { ways } = state.pockets;
    const { bumped, members } = ways[pocketIndex];

    return [...bumped].filter((freezerIndex) => {
        if (state.context.front.has(freezerIndex)) return false;

        for (const other of bumpedBy.get(freezerIndex) ?? []) {
            const holdsOtherLevel = [...ways[other].members].some((levelIndex) => !members.has(levelIndex));
            if (holdsOtherLevel) return false;
        }

        return true;
    });
}

/**
 * The far side of closed Freezers: the walk from their cells with them open, which never enters the reached cells, and
 * the closed Freezers it bumps into besides them.
 */
function farSideOf(context: ReachContext, freezerIndices: number[]): { cells: Set<number>; bumped: Set<number> } {
    const { walk, reached } = context;
    const gateCells = freezerIndices.map((freezerIndex) => walk.cellOf(...PROG.freezers[freezerIndex].p));
    const bumped = new Set<number>();

    for (const gateCell of gateCells) walk.thaw(gateCell);
    const cells = walk.flood(gateCells, reached, bumped, POCKET_OPTIONS);
    freezerIndices.forEach((freezerIndex, position) => walk.freeze(gateCells[position], freezerIndex));

    for (const freezerIndex of freezerIndices) bumped.delete(freezerIndex);
    return { cells, bumped };
}

/**
 * Doorways: a closed Freezer a pocket bumps into whose far side, walked with the pocket's cells counted as reached,
 * holds no level and bumps into closed Freezers the pocket does not. Per doorway, those Freezers are recorded in the
 * pocket's `doorways`: a way in through the doorway needs one of them open too. The far side of all the candidates at
 * once comes first: when it bumps into no new Freezer, neither does any one of them.
 */
function addDoorways(state: PocketFloods): void {
    const { context } = state;
    const { ways } = state.pockets;
    const bumpedBy = new Map<number, number[]>();

    ways.forEach(({ bumped }, pocketIndex) => {
        for (const freezerIndex of bumped) addTo(bumpedBy, freezerIndex, pocketIndex);
    });

    ways.forEach(({ bumped, members, doorways }, pocketIndex) => {
        const candidates = doorwayCandidates(state, pocketIndex, bumpedBy);
        if (candidates.length === 0) return;

        // the pocket's cells join the reached cells while its Freezers' far sides are walked, and leave them after
        const pocketCells = state.pocketCells[pocketIndex];
        for (const cell of pocketCells) context.reached.add(cell);

        const allFarSides = farSideOf(context, candidates);
        const newFreezers = [...allFarSides.bumped].some((other) => !bumped.has(other));

        if (newFreezers) {
            for (const freezerIndex of candidates) {
                const farSide = candidates.length === 1 ? allFarSides : farSideOf(context, [freezerIndex]);
                const farLevels = restLevelsIn(context, farSide.cells);
                if (farLevels.some((levelIndex) => !members.has(levelIndex))) continue;

                const beyond = [...farSide.bumped].filter((other) => !bumped.has(other));
                if (beyond.length > 0) doorways.set(freezerIndex, beyond);
            }
        }

        for (const cell of pocketCells) context.reached.delete(cell);
    });
}

// the world.json movables kind of a Rover
const ROVER_KIND = 3;

/** The Freezers of `PROG.freezers` that hold a Rover: those whose cell is the position of a Rover. */
function roverFreezersOf(): Set<number> {
    const [cornerX, cornerY] = PROG.world.grid.corner;
    const roverKeys = new Set<string>();

    for (const [, column, row, z, kind] of PROG.world.movables || []) {
        if (kind === ROVER_KIND) roverKeys.add(`${column + cornerX},${row + cornerY},${z}`);
    }

    const roverFreezers = new Set<number>();

    PROG.freezers.forEach((freezer, freezerIndex) => {
        if (roverKeys.has(freezer.p.join(','))) roverFreezers.add(freezerIndex);
    });

    return roverFreezers;
}

/**
 * A pocket that bumps into a closed Freezer holding a Rover may get past it: the Rover rides where the pocket's walk
 * does not go. The first pocket to bump such a Freezer floods from the Freezer's cell with it open, and the levels of
 * that flood that are not frozen in (`frozenIn`) sit behind the Freezer, whichever pocket bumps it.
 */
function addRoverGateLevels(state: PocketFloods, bumped: Set<number>): void {
    const { context, byGate, roverFreezers, roverFlooded } = state;
    const { walk, reached, frozenIn } = context;

    for (const freezerIndex of bumped) {
        if (!roverFreezers.has(freezerIndex) || roverFlooded.has(freezerIndex)) continue;

        roverFlooded.add(freezerIndex);

        const gateCell = walk.cellOf(...PROG.freezers[freezerIndex].p);
        walk.thaw(gateCell);
        const thawedCells = walk.flood([gateCell], reached, new Set(), POCKET_OPTIONS);
        walk.freeze(gateCell, freezerIndex);

        const behind = levelsBehind(byGate, freezerIndex);

        for (const levelIndex of restLevelsIn(context, thawedCells)) {
            if (frozenIn[levelIndex] === undefined) behind.add(levelIndex);
        }
    }
}

/** Per ground Tower's pad (a teleporter index), the index of the Tower whose activation enables it. */
function towerOfPadsOf(): Map<number, number> {
    const towerOfPad = new Map<number, number>();

    for (const room of PROG.gold_rooms || []) {
        if (room.tower >= 0) towerOfPad.set(room.pad, room.tower);
    }

    return towerOfPad;
}

/**
 * The pocket that reaches the pad at `padAt` on foot: the closed Freezers it bumps into and its levels, flooded the
 * first time it is asked for.
 */
function padEntryOf(context: ReachContext, entries: Map<number, PadPocket>, padAt: number): PadPocket {
    let entry = entries.get(padAt);

    if (!entry) {
        const bumped = new Set<number>();
        const options = { reveal: false, travel: false, pocket: true, frozenHolds: false };
        const cells = context.walk.flood([padAt], context.reached, bumped, options);
        const entryLevels = restLevelsIn(context, cells).filter(
            (levelIndex) => context.frozenIn[levelIndex] === undefined,
        );
        entry = { bumped, levels: entryLevels };
        entries.set(padAt, entry);
    }

    return entry;
}

/**
 * A MINOR pad that lands the hero outside the reached cells is a way into every level he walks on to from the landing:
 * the closed gates on the edge of the pocket that reaches the pad on foot lead in, and so do its levels. A pad the save
 * leaves disabled counts only for a ground Tower's pad, whose Tower enables it; the Tower is the way in, and the
 * pad's pocket too while the pad lies outside the reached cells. What a level's own pockets hold is left out. Records
 * it in `pockets.landing` and the gates in `byGate`.
 */
function addLandingWays(context: ReachContext, pockets: Pockets, byGate: Map<number, Set<number>>): void {
    const { walk, reached, teleporterStates, frozenIn } = context;
    const towerOfPad = towerOfPadsOf();
    const entries = new Map<number, PadPocket>();
    const walkedFrom = new Map<number, number[]>();
    const waysOf = new Map<number, { gates: Set<number>; levels: Set<number>; towers: Set<number> }>();

    PROG.teleporters.forEach((pad, padIndex) => {
        if (pad.major) return;

        const enabled = teleporterStates[padIndex].en;
        const tower = enabled ? -1 : (towerOfPad.get(padIndex) ?? -1);
        if (!enabled && tower < 0) return;

        const landing = walk.minorLanding(padIndex);
        if (landing < 0 || reached.has(landing)) return;

        let landingLevels = walkedFrom.get(landing);
        if (!landingLevels) {
            const cells = walk.flood([landing], reached, null, { reveal: false });
            landingLevels = restLevelsIn(context, cells).filter((levelIndex) => frozenIn[levelIndex] === undefined);
            walkedFrom.set(landing, landingLevels);
        }

        if (landingLevels.length === 0) return;

        const padAt = walk.padCell(padIndex);
        const hasEntry = padAt >= 0 && !reached.has(padAt);
        const entry = hasEntry ? padEntryOf(context, entries, padAt) : { bumped: new Set<number>(), levels: [] };

        for (const levelIndex of landingLevels) {
            let ways = waysOf.get(levelIndex);
            if (!ways) {
                ways = { gates: new Set(), levels: new Set(), towers: new Set() };
                waysOf.set(levelIndex, ways);
            }

            for (const freezerIndex of entry.bumped) ways.gates.add(freezerIndex);
            for (const other of entry.levels) ways.levels.add(other);
            if (tower >= 0) ways.towers.add(tower);
        }
    });

    for (const [levelIndex, ways] of waysOf) {
        for (const pocketIndex of pockets.ofLevel.get(levelIndex) ?? []) {
            const { bumped, members } = pockets.ways[pocketIndex];
            for (const freezerIndex of bumped) ways.gates.delete(freezerIndex);
            for (const other of members) ways.levels.delete(other);
        }

        const hasWays = ways.gates.size > 0 || ways.levels.size > 0 || ways.towers.size > 0;
        if (!hasWays) continue;

        pockets.landing.set(levelIndex, {
            gates: [...ways.gates],
            levels: [...ways.levels],
            towers: [...ways.towers],
        });

        for (const freezerIndex of ways.gates) levelsBehind(byGate, freezerIndex).add(levelIndex);
    }
}

/**
 * Marks the levels of `rest` that the hero reaches by walking on from the cells he lands in off a sky ledge
 * (`landings`), not only those in a pocket he falls into.
 */
function addSkyWalk(context: ReachContext, landings: number[], pockets: Pockets): void {
    const { walk, reached, rest, restCells } = context;
    const seeds = landings.filter((landing) => !reached.has(landing));
    if (seeds.length === 0) return;

    const skyWalk = walk.flood(seeds, reached, null, { reveal: false });

    rest.forEach((levelIndex, position) => {
        if (skyWalk.has(restCells[position])) pockets.fromSky[levelIndex] = 1;
    });
}

/**
 * A level not reached sits behind the closed gates on the edge of the pockets of walkable cells that hold it, and may
 * need the unmodelled mechanics in or next to them: floods the pocket of each level of `rest` not in a pocket yet, and
 * adds their gates to `byGate` and their mechanics to `mech`.
 */
function floodPockets(context: ReachContext, byGate: Map<number, Set<number>>, mech: Uint8Array): Pockets {
    const levelCount = context.levelCells.length;
    const pockets: Pockets = {
        ways: [],
        ofLevel: new Map(),
        first: new Map(),
        fromSky: new Uint8Array(levelCount),
        landing: new Map(),
    };

    const sky = context.walk.skyEntrances();

    const state: PocketFloods = {
        context,
        byGate,
        mech,
        pockets,
        pocketCells: [],
        done: new Uint8Array(levelCount),
        enteredFromSky: sky.into,
        pads: padRevealersOf(context),
        padPockets: new Map(),
        roverFreezers: roverFreezersOf(),
        roverFlooded: new Set(),
    };

    context.rest.forEach((_, position) => floodPocketOfLevel(state, position));
    addDoorways(state);
    addSkyWalk(context, sky.landings, pockets);
    addLandingWays(context, pockets, byGate);

    return pockets;
}

/**
 * viaPads: per level, the gates and levels the pads revealed from the pockets that hold it lead through, less the gates
 * any of those pockets bumps into and the levels any of them holds, with what the MINOR pads that land the hero where
 * he walks on to the level lead through.
 */
function viaPadsOf(pockets: Pockets): Map<number, ViaPads> {
    const viaPads = new Map<number, ViaPads>();

    for (const [levelIndex, pocketIndices] of pockets.ofLevel) {
        const padGates = new Set<number>();
        const padLevels = new Set<number>();
        const padTowers = new Set<number>();

        for (const pocketIndex of pocketIndices) {
            const { viaPad, viaLevel } = pockets.ways[pocketIndex];
            for (const freezerIndex of viaPad) padGates.add(freezerIndex);
            for (const other of viaLevel) padLevels.add(other);
        }

        if (padGates.size > 0 || padLevels.size > 0) {
            for (const pocketIndex of pocketIndices) {
                const { bumped, members } = pockets.ways[pocketIndex];
                for (const freezerIndex of bumped) padGates.delete(freezerIndex);
                for (const other of members) padLevels.delete(other);
            }
        }

        const landing = pockets.landing.get(levelIndex);
        if (landing) {
            for (const freezerIndex of landing.gates) padGates.add(freezerIndex);
            for (const other of landing.levels) padLevels.add(other);
            for (const tower of landing.towers) padTowers.add(tower);
        }

        const hasPadWays = padGates.size > 0 || padLevels.size > 0 || padTowers.size > 0;
        if (hasPadWays) {
            viaPads.set(levelIndex, { gates: [...padGates], levels: [...padLevels], towers: [...padTowers] });
        }
    }

    return viaPads;
}

/**
 * chains: per level not frozen in a closed Freezer, the doorways of the pockets that hold it, each with its ways
 * through: [doorway, a Freezer beyond it]. A doorway that another of those pockets bumps into without being one there
 * leads in alone, so it has no chains.
 */
function chainsOf(context: ReachContext, pockets: Pockets): Map<number, Map<number, number[][]>> {
    const chains = new Map<number, Map<number, number[][]>>();

    for (const [levelIndex, pocketIndices] of pockets.ofLevel) {
        if (context.frozenIn[levelIndex] !== undefined) continue;

        const plain = new Set<number>();
        const beyondOf = new Map<number, Set<number>>();

        for (const pocketIndex of pocketIndices) {
            const { bumped, doorways } = pockets.ways[pocketIndex];

            for (const freezerIndex of bumped) {
                const beyond = doorways.get(freezerIndex);
                if (!beyond) {
                    plain.add(freezerIndex);
                    continue;
                }

                let known = beyondOf.get(freezerIndex);
                if (!known) {
                    known = new Set();
                    beyondOf.set(freezerIndex, known);
                }
                for (const other of beyond) known.add(other);
            }
        }

        const levelChains = new Map<number, number[][]>();

        for (const [freezerIndex, beyond] of beyondOf) {
            if (plain.has(freezerIndex)) continue;
            levelChains.set(
                freezerIndex,
                [...beyond].map((other) => [freezerIndex, other]),
            );
        }

        if (levelChains.size > 0) chains.set(levelIndex, levelChains);
    }

    return chains;
}

/** A level in a closed gate's cell belongs to that gate alone, not to the pocket next to it. */
function addFrozenLevels(context: ReachContext, byGate: Map<number, Set<number>>, mech: Uint8Array): void {
    for (const levelIndex of context.rest) {
        const freezerIndex = context.frozenIn[levelIndex];
        if (freezerIndex === undefined) continue;
        mech[levelIndex] = context.walk.mechAt([context.levelCells[levelIndex]]);
        levelsBehind(byGate, freezerIndex).add(levelIndex);
    }
}

/**
 * `from`: for a level not reached that a closed gate on `byGate` needs, the levels behind that gate a walk from the
 * level reaches (levels frozen in a gate left out on both sides). A walk from it stays inside the first pocket it is
 * in, so only a level behind the gate in that pocket needs the walk.
 */
function floodFrom(
    context: ReachContext,
    byGate: Map<number, Set<number>>,
    first: Map<number, Set<number>>,
): Map<number, Set<number>> {
    const { walk, reached, frozenIn, restCells } = context;
    const from = new Map<number, Set<number>>();
    const restPosition = new Map<number, number>();

    context.rest.forEach((levelIndex, position) => {
        restPosition.set(levelIndex, position);
    });

    for (const [freezerIndex, behind] of byGate) {
        for (const required of PROG.freezers[freezerIndex].req) {
            const position = restPosition.get(required);
            const firstPocket = first.get(required);
            if (from.has(required) || position === undefined || !firstPocket) continue;
            if (frozenIn[required] !== undefined) continue;

            const othersInPocket = [...behind].some((other) => other !== required && firstPocket.has(other));
            if (!othersInPocket) continue;

            const cells = walk.flood([restCells[position]], reached, null);
            const reachable = restLevelsIn(context, cells).filter((other) => frozenIn[other] === undefined);
            from.set(required, new Set(reachable));
        }
    }

    return from;
}

/** The gates on the edge of the reached cells (`onEdge`), or the others, with their levels. */
function gateLists(byGate: Map<number, Set<number>>, front: Set<number>, onEdge: boolean): Map<number, number[]> {
    const lists = new Map<number, number[]>();

    for (const [freezerIndex, behind] of byGate) {
        if (front.has(freezerIndex) === onEdge) lists.set(freezerIndex, [...behind]);
    }

    return lists;
}

/**
 * Flood fill over walkable cells from everywhere the save shows the hero has been: every hero position the history
 * keeps (vertical Beamcaster beams, mirrors and dragon swaps take the hero where the walk can't follow), entered
 * levels, activated Area_Pins and discovered teleporters, and from the targets of `routes`, the known routes whose
 * needs the save meets. `dead` counts the kept hero positions (the current one among them) inside a wall no beam runs
 * through; they seed nothing.
 */
export function reachability(
    history: History,
    latest: LatestValues,
    teleporterStates: TeleporterState[],
    closedFreezers: readonly boolean[],
    entered: readonly boolean[],
    routes: readonly KnownRoute[] = [],
): Reachability {
    const walk = walker(latest, teleporterStates, closedFreezers);
    const levels = PROG.levels;
    const levelCells = levels.map((level) => walk.cellOf(...level.p));

    const { seeds, dead } = seedsOf(walk, history, latest, teleporterStates, entered, levelCells, routes);
    const front = new Set<number>();
    const stoneFront = new Set<number>();
    const reached = walk.flood(seeds, null, front, { stoneFront });
    const isReached = (cell: number): boolean => reached.has(cell) || reached.has(walk.land(cell));

    const frozenIn = frozenInOf(closedFreezers);
    const level = levels.map(
        (_, levelIndex) => frozenIn[levelIndex] === undefined && isReached(levelCells[levelIndex]),
    );
    const rest = restOf(walk, entered, level, levelCells, frozenIn);
    const signFaced = signsFaced(walk, reached);
    const signWays = signWaysOf(walk, signFaced);
    noteSignWays(signWays, reached, []);
    const context: ReachContext = { walk, teleporterStates, levelCells, reached, front, frozenIn, signWays, ...rest };

    // byGate holds the leads and the pockets' gates, the gates on the edge first
    const byGate = new Map<number, Set<number>>();
    const mech = new Uint8Array(levels.length);

    addLeads(context, byGate);
    addStoneLeads(context, byGate, stoneFront, seeds);
    const pockets = floodPockets(context, byGate, mech);
    const viaPads = viaPadsOf(pockets);
    addFrozenLevels(context, byGate, mech);
    const lightLeads = addLightLeads(context, byGate);
    const from = floodFrom(context, byGate, pockets.first);

    return {
        reached,
        level,
        leads: gateLists(byGate, front, true),
        pocket: gateLists(byGate, front, false),
        lightLeads,
        chains: chainsOf(context, pockets),
        from,
        mech,
        fromSky: pockets.fromSky,
        viaPads,
        dead,
        cols: reachColumns(reached, transitNotShown(walk, reached, levelCells)),
        signFaced,
        signBehind: signWays.gates.map((gates) => [...gates].toSorted((first, second) => first - second)),
    };
}

/** The Signs of `signFaced` that are 0, with the cells a hero would face each from. */
function signWaysOf(walk: Walker, signFaced: Uint8Array): SignWays {
    const signs = PROG.signs || [];
    const ways: SignWays = {
        spots: [],
        own: signs.map(() => undefined),
        gates: signs.map(() => new Set<number>()),
    };

    signs.forEach((sign, signIndex) => {
        const signCell = walk.cellOf(...sign.p);
        if (signFaced[signIndex] || signCell < 0) return;

        ways.own[signIndex] = walk.frozen.get(signCell);

        for (let side = 0; side < STEP.length; side++) {
            const [dx, dy] = STEP[side];
            const spotCell = walk.neighbourOf(signCell, dx, dy);
            if (spotCell < 0 || walk.fenced(signCell, side, spotCell)) continue;

            ways.spots.push({ signIndex, spotCell });
        }
    });

    return ways;
}

/**
 * Notes that opening `gates` lets a walk over `cells` stand beside the Signs it reaches: the gates, and the Freezer in
 * the Sign's own cell, are ways to face it.
 */
function noteSignWays(ways: SignWays, cells: Set<number>, gates: number[]): void {
    for (const { signIndex, spotCell } of ways.spots) {
        if (!cells.has(spotCell)) continue;

        const found = ways.gates[signIndex];
        for (const freezerIndex of gates) found.add(freezerIndex);

        const own = ways.own[signIndex];
        if (own !== undefined) found.add(own);
    }
}

/** Per Sign, 1 when a hero on a reached cell can face it (see Reachability). */
function signsFaced(walk: Walker, reached: Set<number>): Uint8Array {
    const signs = PROG.signs || [];
    const faced = new Uint8Array(signs.length);

    signs.forEach((sign, signIndex) => {
        const signCell = walk.cellOf(...sign.p);
        if (signCell < 0 || walk.frozen.has(signCell)) return;

        for (let side = 0; side < STEP.length; side++) {
            const [dx, dy] = STEP[side];
            const heroCell = walk.neighbourOf(signCell, dx, dy);
            if (!reached.has(heroCell) || walk.fenced(signCell, side, heroCell)) continue;

            faced[signIndex] = 1;
            return;
        }
    });

    return faced;
}

/**
 * The reached cells of the Lilies' drifts that the map does not paint: those the hero only rides through, less the
 * ones a level entrance, a pad or an Area_Pin lands him on.
 */
function transitNotShown(walk: Walker, reached: Set<number>, levelCells: number[]): Set<number> {
    const transit = walk.transitCells(reached);
    if (transit.size === 0) return transit;

    for (const levelCell of levelCells) {
        transit.delete(levelCell);
        transit.delete(walk.land(levelCell));
    }

    PROG.teleporters.forEach((_, padIndex) => transit.delete(walk.padCell(padIndex)));

    for (const [, x, y, z] of PROG.world.area_pins) {
        const pinCell = walk.cellOf(x, y, z);
        transit.delete(pinCell);
        transit.delete(walk.land(pinCell, false));
    }

    return transit;
}

const NO_CELLS: ReadonlySet<number> = new Set();

/**
 * The reached cells projected onto the map, less `skipped`: per map layer key a Uint8Array over the map's columns (row
 * 0 = north, as in the layer images), 1 where a reached cell lies in the layer's z range; with heights, a Float32Array
 * of the highest reached z per column instead, NaN where none.
 */
function reachColumns(reached: Set<number>, skipped?: ReadonlySet<number>): Record<string, Uint8Array>;
function reachColumns(reached: Set<number>, skipped: ReadonlySet<number>, heights: true): Record<string, Float32Array>;
function reachColumns(
    reached: Set<number>,
    skipped: ReadonlySet<number> = NO_CELLS,
    heights = false,
): Record<string, Uint8Array | Float32Array> {
    const map = PROG.map;
    const [mapWidth, mapHeight] = map.size;
    const [width, height] = PROG.world.grid.size;
    const layerCells = width * height;
    const columnsByLayer: Record<string, Uint8Array | Float32Array> = {};

    for (const mapLayer of map.layers) {
        if (heights) {
            columnsByLayer[mapLayer.key] = new Float32Array(mapWidth * mapHeight).fill(NaN);
        } else {
            columnsByLayer[mapLayer.key] = new Uint8Array(mapWidth * mapHeight);
        }
    }

    const columnsAtZ = new Map<number, Uint8Array | Float32Array | undefined>();

    const columnsOf = (z: number): Uint8Array | Float32Array | undefined => {
        if (!columnsAtZ.has(z)) {
            const mapLayer = map.layers.find((candidate) => z >= candidate.z[0] && z < candidate.z[1]);
            columnsAtZ.set(z, mapLayer ? columnsByLayer[mapLayer.key] : undefined);
        }

        return columnsAtZ.get(z);
    };

    for (const cell of reached) {
        if (skipped.has(cell)) continue;

        const column = cell % layerCells;
        const z = Math.floor(cell / layerCells) - Z_BIAS;
        const columns = columnsOf(z);
        if (!columns) continue;

        const mapColumn = gridCol(column % width, Math.floor(column / width));

        if (!heights) {
            columns[mapColumn] = 1;
        } else if (!(columns[mapColumn] >= z)) {
            // also true for NaN, a column without a height yet
            columns[mapColumn] = z;
        }
    }

    return columnsByLayer;
}

/**
 * Where the hero can stand in the level data (gates as stored, no Freezer closed, every teleporter on): a flood from
 * every level entrance, teleporter and Area_Pin, as reachColumns heights. null until the world cells are loaded.
 * scripts/build-walk.ts stores them in data/walk.json for the page.
 */
export function floorHeights(): Record<string, Float32Array> | null {
    if (!WORLD) return null;
    const teleporters = PROG.teleporters;
    const everyPadOn = teleporters.map(() => ({ en: true, disc: true }));
    const { flood, land, padCell, cellOf } = walker(NO_HISTORY, everyPadOn, []);
    const seeds = [
        ...PROG.levels.map((level) => land(cellOf(...level.p))),
        ...teleporters.map((_, padIndex) => padCell(padIndex)),
        ...PROG.world.area_pins.map(([, x, y, z]) => land(cellOf(x, y, z), false)),
    ];
    return reachColumns(flood(seeds), NO_CELLS, true);
}
