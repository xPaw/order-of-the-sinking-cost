// The flood: the cells a walk reaches from its seeds, and the pads it reveals through the map rooms (VIEWER.md
// "Moves", "Seeds and the reached cells", "Pads revealed through the map rooms")
import { pushForBeams, undoBeamMoves } from './beam-moves.ts';
import type { BeamFlood } from './beam-moves.ts';
import { endpointDistance, endpointTarget } from './beams.ts';
import type { EndpointBeam } from './beams.ts';
import { sink } from './bridges.ts';
import type { BridgeWay } from './bridges.ts';
import {
    addTo,
    cellOnSide,
    cellsOnSide,
    BEAM,
    BRIDGE_MARK,
    GATE,
    OPTION_MARK,
    POWER_MARK,
    PUSH,
    RIDE_MARK,
    SIDES,
    SOLID,
    THRU,
    TRAVEL_MARK,
    Z_BIAS,
} from './cells.ts';
import { openGateAhead, press, rodLandsOn } from './gates.ts';
import type { GateLift, PressMiss } from './gates.ts';
import { exists, withGroups } from './groups.ts';
import type { CellWrite } from './groups.ts';
import type { SwitchHop } from './mirror-isles.ts';
import { hopTurned, mirrorTurnsOf } from './mirror-turns.ts';
import type { MirrorTurn } from './mirror-turns.ts';
import { monsterGatesOf, NO_MONSTER_GATES, openMonsterGates } from './monster-gates.ts';
import type { MonsterGates } from './monster-gates.ts';
import { deep } from './ocean.ts';
import { push, settle } from './queue.ts';
import type { Cursor } from './queue.ts';
import { sinkChained } from './rock-chains.ts';
import type { ChainMiss } from './rock-chains.ts';
import { respawnedRocksOf, rockTurnsOf, sinkTurned, stoneTurnsOf } from './rock-turns.ts';
import type { RockTurn } from './rock-turns.ts';
import { ferry, roverTurnsOf } from './rovers.ts';
import type { RoverCell, SunkRover } from './rovers.ts';
import {
    LAYER_COUNT,
    layerAfterStep,
    leavesByCharmDoor,
    leavesByRodDoor,
    startsWithCharm,
    startsWithRod,
    swapCell,
    WIZARD,
} from './skills.ts';
import type { LayeredCell } from './skills.ts';
import { skipAndSwap, takeKicks } from './skipping-stones.ts';
import type { Kick } from './skipping-stones.ts';
import { blocked } from './support.ts';
import { noteSwap, swapIndex } from './swaps.ts';
import { padCell, padStep } from './teleporters.ts';
import { crystalTurnsOf, NO_TRANSMUTE_TARGETS, transmute, transmuteTargetsOf, undoTransmutes } from './transmute.ts';
import type { TransmuteTargets } from './transmute.ts';
import type { WalkGrid } from './walker.ts';
import { fenced } from './walls.ts';

/** A seed of a flood: a cell (walk layer 0) or a cell and its walk layer. */
export type Seed = number | LayeredCell;

/**
 * How a flood walks. reveal = false leaves out the pads that reaching a pad reveals (one-way edges, for pockets of
 * cells); travel = false leaves out pads and elevators (a walk on foot); pocket = true walks a pocket of cells both
 * ways along its one-way edges: every rock bridge's water cell holds the hero, and skip lanes are walked backwards;
 * it takes no pad, which sends the hero only out of the pocket;
 * frozenHolds = false walks no step onto a closed Freezer's top (for pockets of cells: a closed Freezer bounds the
 * pocket, not a floor the hero walks across); topDrops = true, with frozenHolds = false, lets a fall land on a top;
 * stopAt = a cell ends the flood as soon as it is reached, so the cells returned are only those reached up to then;
 * stoneFront = the Freezers holding a stone a hero with CHARM would launch in a search of the flood go to this set.
 */
export interface FloodOptions {
    reveal?: boolean;
    travel?: boolean;
    pocket?: boolean;
    frozenHolds?: boolean;
    topDrops?: boolean;
    stopAt?: number;
    stoneFront?: Set<number>;
}

/** A flavor in latch order: its shut switch gates to open and its open notted gates to shut. */
export interface FlavorLatch {
    flavor: number;
    open: number[];
    shut: number[];
}

/**
 * Per cell, the rock bridges, Switch flavors and skip lanes whose reach that cell can fire. `cells` is 1 on every cell
 * some trigger is indexed by. `lifts`: the lifts of the closing Gates, and `hops`: the magic-mirror hops off a Switch
 * the hero holds down; their Switch cells are among the flavors'. `rocks`: the Rocks and the spare Gems whose pushes
 * into water may turn, indexed by the cells beside them (`rocksAt`); `bridgeIndexOf`: per Rock or Gem pid, its straight
 * bridge; `bridgeAfter`: per bridge of a respawned Rock, the cells of the Activators it waits for, and `bridgesAfterAt`
 * the bridges per Activator cell. `mirrorTurns`: the magic Mirrors whose pushes may turn, indexed by the cells beside them
 * (`mirrorTurnsAt`). `monsterGates`: the shut monster Gates the walk can open, with their rooms' Monsters indexed by
 * the cells beside them. The TELEPORT swaps worth noting (noteSwap): `swapOnto` the cells a swapped object may matter
 * in (the unpressed Switches and the open Gem_Slots a Gem turns onto), `swapObjects` the cells of the objects whose
 * new position may matter; `rockAt` gives a turning Rock's index by its cell. `rodSwitches`: the Switch cells of
 * `switchesAt` that a Rod launch may land an object on with no hero there (a wall, Gate, Freezer or Fence beside the
 * Switch), and `rodSwitchCount` their number per flavor.
 */
export interface Triggers {
    cells: Uint8Array;
    bridges: Array<[pid: number, ways: BridgeWay[]]>;
    bridgesAt: Map<number, number[]>;
    bridgeAfter: Map<number, number[]>;
    bridgesAfterAt: Map<number, number[]>;
    bridgeIndexOf: Map<number, number>;
    rocks: RockTurn[];
    rocksAt: Map<number, number[]>;
    rovers: RoverCell[];
    roversAt: Map<number, number[]>;
    mirrorTurns: MirrorTurn[];
    mirrorTurnsAt: Map<number, number[]>;
    monsterGates: MonsterGates;
    transmutes: TransmuteTargets;
    flavors: FlavorLatch[];
    switchesAt: Map<number, number[]>;
    switchCount: Int32Array;
    rodSwitches: Set<number>;
    rodSwitchCount: Int32Array;
    lifts: GateLift[];
    hops: SwitchHop[];
    lanePushAt: Map<number, number[]>;
    laneNearAt: Map<number, number[]>;
    laneFromAt: Map<number, number[]>;
    laneRideAt: Map<number, number[]>;
    kicks: Kick[];
    kicksAt: Map<number, number[]>;
    swapOnto: Set<number>;
    swapObjects: Set<number>;
    rockAt: Map<number, number>;
}

/**
 * A flood's own state: its options, the cells it reached and its queue, and what its moves changed: the water cells
 * its rock bridges fill (each Rock once), the shut switch gates it opened (`unlatched`) once it can bring an object
 * onto every Switch of the flavor not pressed, the open notted gates the same presses shut (`latchedShut`), and the
 * shut Gates it opened from an OPEN beam (`opened`), and the pads a MINOR pad's trip enabled (`enabledPads`).
 * triggerHits: the reached cell, layer pairs on trigger cells, in
 * the order they were reached. `queue` holds cell, layer pairs. `pressMisses`: per flavor index, its last failed
 * press. `liftsDone` / `liftMisses`: per lift, whether it lifted the hero, and its last failed search; `hopsDone` /
 * `hopMisses` the same per hop off a Switch. `beamFlood`: what its pushes for the beams changed, once it reaches a
 * cell that starts one (`beamOutsideSeen`: the cells `outside` it have been looked at for that). The Rocks that turn
 * into water: `rocksDue` the ones a reached cell is beside (`rockSeen` notes them), `rockSpent` the ones that sank,
 * `rockMisses` their last failed searches; `turnMarked`: the water cells it marked as bridges, which it unmarks at the
 * end. `ferried`: the Rovers it sank. The magic Mirrors that turn: `mirrorsDue` the ones a reached cell is beside
 * (`mirrorSeen` notes them), `mirrorMisses` their last searches, `hopsAt` per arm cell the landings of the hops it laid, and `hopMarked` the arm
 * cells it marked as travel cells, which it unmarks at the end. The Monsters of the monster Gates: `monstersDue` the
 * ones a reached cell is beside (`monsterSeen` notes them), `monsterGone` the ones the walk got rid of, `monsterMisses`
 * the last failed search that tried to. The targets a TRANSMUTE hero turned into crystals: `transmuted` their indices,
 * `transmuteLog` what that wrote to the grid and the cell flags, which the flood undoes at the end, and `attacksLost`
 * per cell how many of its attacks the turned dragons took away. `chainMisses`: per Rock, its last failed search for
 * Rocks that sink side by side. The TELEPORT swaps it noted:
 * `swapLog` the hero cell, target cell pairs in order, `swapsAt` the targets per hero cell and `swapsOf` the hero cells
 * per target (swaps.ts), `ontoSwaps` how many targets `swapsAt` holds, and a cursor per search that reads the log.
 * `pressing`: the cells of the objects that rest on the Switches of the flavors in `latched`, which no other press uses.
 * `charming` and `rodHeld`: the hero holds CHARM or the Rod, from the save or a Wardrobe door the flood left by.
 */
export interface FloodState {
    outside: Set<number> | null;
    reveal: boolean;
    pocket: boolean;
    frozenHolds: boolean;
    topDrops: boolean;
    charming: boolean;
    rodHeld: boolean;
    stoneFront: Set<number> | null;
    front: Set<number> | null;
    reached: number[][];
    triggerHits: number[];
    queue: number[];
    bridged: Set<number>;
    kicked: Set<number>;
    unlatched: Set<number>;
    latchedShut: Set<number>;
    opened: Set<number>;
    majorDone: boolean[];
    enabledPads: Set<number>;
    latched: Set<number>;
    pressing: Set<number>;
    sinkCursor: Cursor;
    bridgeTaken: Uint8Array;
    bridgesDue: number[];
    rockCursor: Cursor;
    rockSeen: Uint8Array;
    rocksDue: number[];
    rockSpent: Uint8Array;
    rockMisses: Array<PressMiss | undefined>;
    chainMisses: Array<ChainMiss | undefined>;
    turnMarked: number[];
    roverCursor: Cursor;
    roverSeen: Uint8Array;
    roversDue: number[];
    roverSpent: Uint8Array;
    roverMisses: Array<PressMiss | undefined>;
    ferried: SunkRover[];
    rideMarked: number[];
    mirrorCursor: Cursor;
    mirrorSeen: Uint8Array;
    mirrorsDue: number[];
    mirrorMisses: Array<PressMiss | undefined>;
    hopsAt: Map<number, number[]>;
    hopMarked: number[];
    monsterCursor: Cursor;
    monsterSeen: Uint8Array;
    monstersDue: number[];
    monsterGone: Uint8Array;
    monsterMisses: Array<PressMiss | undefined>;
    transmuteCursor: Cursor;
    transmuted: Set<number>;
    transmuteLog: CellWrite[];
    attacksLost: Map<number, number>;
    kickCursor: Cursor;
    kickTaken: Uint8Array;
    swapLog: number[];
    swapsAt: Map<number, number[]>;
    swapsOf: Map<number, number[]>;
    ontoSwaps: number;
    rockSwapCursor: Cursor;
    beamSwapCursor: Cursor;
    pressCursor: Cursor;
    switchesLeft: Int32Array;
    switchesReached: Set<number>;
    pressMisses: Array<PressMiss | undefined>;
    liftsDone: Uint8Array;
    liftMisses: Array<PressMiss | undefined>;
    hopsDone: Uint8Array;
    hopMisses: Array<PressMiss | undefined>;
    laneCursor: Cursor;
    laneParts: Uint8Array;
    lanesDue: number[];
    beamCursor: Cursor;
    beamFlood: BeamFlood | null;
    beamOutsideSeen: boolean;
}

/** The triggers of no flood: no rock bridges, Switch flavors or skip lanes. */
export const NO_TRIGGERS: Triggers = {
    cells: new Uint8Array(0),
    bridges: [],
    bridgesAt: new Map(),
    bridgeAfter: new Map(),
    bridgesAfterAt: new Map(),
    bridgeIndexOf: new Map(),
    rocks: [],
    rocksAt: new Map(),
    rovers: [],
    roversAt: new Map(),
    mirrorTurns: [],
    mirrorTurnsAt: new Map(),
    monsterGates: NO_MONSTER_GATES,
    transmutes: NO_TRANSMUTE_TARGETS,
    flavors: [],
    switchesAt: new Map(),
    switchCount: new Int32Array(0),
    rodSwitches: new Set(),
    rodSwitchCount: new Int32Array(0),
    lifts: [],
    hops: [],
    lanePushAt: new Map(),
    laneNearAt: new Map(),
    laneFromAt: new Map(),
    laneRideAt: new Map(),
    kicks: [],
    kicksAt: new Map(),
    swapOnto: new Set(),
    swapObjects: new Set(),
    rockAt: new Map(),
};

/** A new flood's state. */
export function newFloodState(
    triggers: Triggers,
    laneCount: number,
    outside: Set<number> | null,
    reveal: boolean,
    pocket: boolean,
    frozenHolds: boolean,
    topDrops: boolean,
): FloodState {
    return {
        outside,
        reveal,
        pocket,
        frozenHolds,
        topDrops,
        charming: false,
        rodHeld: false,
        stoneFront: null,
        front: null,
        reached: Array.from({ length: LAYER_COUNT }, () => []),
        triggerHits: [],
        queue: [],
        bridged: new Set(),
        kicked: new Set(),
        unlatched: new Set(),
        latchedShut: new Set(),
        opened: new Set(),
        majorDone: Array.from({ length: LAYER_COUNT }, () => false),
        enabledPads: new Set(),
        latched: new Set(),
        pressing: new Set(),
        sinkCursor: { at: 0 },
        bridgeTaken: new Uint8Array(triggers.bridges.length),
        bridgesDue: [],
        rockCursor: { at: 0 },
        rockSeen: new Uint8Array(triggers.rocks.length),
        rocksDue: [],
        rockSpent: new Uint8Array(triggers.rocks.length),
        rockMisses: [],
        chainMisses: [],
        turnMarked: [],
        roverCursor: { at: 0 },
        roverSeen: new Uint8Array(triggers.rovers.length),
        roversDue: [],
        roverSpent: new Uint8Array(triggers.rovers.length),
        roverMisses: [],
        ferried: [],
        rideMarked: [],
        mirrorCursor: { at: 0 },
        mirrorSeen: new Uint8Array(triggers.mirrorTurns.length),
        mirrorsDue: [],
        mirrorMisses: [],
        hopsAt: new Map(),
        hopMarked: [],
        monsterCursor: { at: 0 },
        monsterSeen: new Uint8Array(triggers.monsterGates.monsterCount),
        monstersDue: [],
        monsterGone: new Uint8Array(triggers.monsterGates.monsterCount),
        monsterMisses: [],
        transmuteCursor: { at: 0 },
        transmuted: new Set(),
        transmuteLog: [],
        attacksLost: new Map(),
        kickCursor: { at: 0 },
        kickTaken: new Uint8Array(triggers.kicks.length),
        swapLog: [],
        swapsAt: new Map(),
        swapsOf: new Map(),
        ontoSwaps: 0,
        rockSwapCursor: { at: 0 },
        beamSwapCursor: { at: 0 },
        pressCursor: { at: 0 },
        switchesLeft: triggers.switchCount.slice(),
        switchesReached: new Set(),
        pressMisses: [],
        liftsDone: new Uint8Array(triggers.lifts.length),
        liftMisses: [],
        hopsDone: new Uint8Array(triggers.hops.length),
        hopMisses: [],
        laneCursor: { at: 0 },
        laneParts: new Uint8Array(laneCount),
        lanesDue: [],
        beamCursor: { at: 0 },
        beamFlood: null,
        beamOutsideSeen: false,
    };
}

/**
 * The state of no flood, which the helpers read while the walker is built and between floods: nothing opened or
 * shut.
 */
export function noFloodState(): FloodState {
    return newFloodState(NO_TRIGGERS, 0, null, true, false, true, false);
}

/**
 * Indexes the triggers by cell, so a flood that drains its queue checks only what the cells reached since its last
 * look touched. Bridges: by push cell. Flavors (in latch order, the order the flood presses them in): by Switch cell
 * not pressed, with the number of such cells. Lanes: by launch push cell and the cells next to the stone (layer 0),
 * line cells (TELEPORT layer) and ride cells (any layer, for a pocket flood).
 */
export function triggerIndex(walkGrid: WalkGrid): Triggers {
    const bridges = [...walkGrid.bridgesOf];
    const bridgesAt = new Map<number, number[]>();

    const bridgeIndexOf = new Map<number, number>();
    const bridgeAfter = new Map<number, number[]>();
    const bridgesAfterAt = new Map<number, number[]>();

    bridges.forEach(([pid, ways], bridgeIndex) => {
        bridgeIndexOf.set(pid, bridgeIndex);
        for (const [pushCell] of ways) addTo(bridgesAt, pushCell, bridgeIndex);

        const activators = walkGrid.respawnActivators.get(pid);
        if (!activators) return;

        bridgeAfter.set(bridgeIndex, activators);
        for (const activatorCell of activators) addTo(bridgesAfterAt, activatorCell, bridgeIndex);
    });

    const transmutes = transmuteTargetsOf(walkGrid);
    const standingRocks = [...rockTurnsOf(walkGrid), ...crystalTurnsOf(walkGrid, transmutes)];
    const rocks = [...standingRocks, ...respawnedRocksOf(walkGrid), ...stoneTurnsOf(walkGrid)];
    const rocksAt = new Map<number, number[]>();

    // a Rock whose room has a stored answer is due once the walk reaches a start of that answer
    rocks.forEach(({ cell }, rockIndex) => {
        for (const side of SIDES) addTo(rocksAt, cellOnSide(walkGrid, cell, side), rockIndex);
        for (const entry of walkGrid.rooms.byCell.get(cell) ?? []) {
            for (const rep of entry.reps) addTo(rocksAt, rep, rockIndex);
        }
    });

    const rovers = roverTurnsOf(walkGrid);
    const roversAt = new Map<number, number[]>();

    rovers.forEach(({ cell }, roverIndex) => {
        for (const side of SIDES) addTo(roversAt, cellOnSide(walkGrid, cell, side), roverIndex);
    });

    const mirrorTurns = mirrorTurnsOf(walkGrid);
    const mirrorTurnsAt = new Map<number, number[]>();

    mirrorTurns.forEach(({ cell }, mirrorIndex) => {
        for (const side of SIDES) addTo(mirrorTurnsAt, cellOnSide(walkGrid, cell, side), mirrorIndex);
    });

    const monsterGates = monsterGatesOf(walkGrid);

    // a Monster whose room has a stored answer is due once the walk reaches a start of that answer
    for (const [monsterCell, monsterIndex] of monsterGates.monsterAt) {
        for (const entry of walkGrid.rooms.byCell.get(monsterCell) ?? []) {
            for (const rep of entry.reps) addTo(monsterGates.monstersAt, rep, monsterIndex);
        }
    }

    // the pushes for the beams of a Gem_Slot whose room has a stored answer start from a start of that answer
    for (const { slotCell } of walkGrid.beamMoves.gemTurns) {
        for (const entry of walkGrid.rooms.byCell.get(slotCell) ?? []) {
            for (const rep of entry.reps) walkGrid.beamMoves.pushCells.add(rep);
        }
    }

    const flavors: FlavorLatch[] = [];
    for (const [flavor, { open, shut }] of walkGrid.latch) flavors.push({ flavor, open, shut });

    const switchesAt = new Map<number, number[]>();
    const switchCount = new Int32Array(flavors.length);
    const rodSwitches = new Set<number>();
    const rodSwitchCount = new Int32Array(flavors.length);

    flavors.forEach(({ flavor }, flavorIndex) => {
        for (const cell of new Set(walkGrid.unpressed.get(flavor))) {
            // no hero reaches a Switch under water, nor one on an islet a charmed stone lands on: only the search
            // for an object onto it decides
            if (deep(walkGrid, cell) || walkGrid.charmIslets.has(cell)) continue;
            switchCount[flavorIndex]++;
            addTo(switchesAt, cell, flavorIndex);

            if (rodLandsOn(walkGrid, cell)) {
                rodSwitches.add(cell);
                rodSwitchCount[flavorIndex]++;
            }
        }
    });

    const lanePushAt = new Map<number, number[]>();
    const laneNearAt = new Map<number, number[]>();
    const laneFromAt = new Map<number, number[]>();
    const laneRideAt = new Map<number, number[]>();

    walkGrid.lanes.forEach((lane, laneIndex) => {
        addTo(lanePushAt, lane.pushCell, laneIndex);
        for (const cell of new Set(lane.near)) addTo(laneNearAt, cell, laneIndex);
        for (const cell of new Set(lane.from)) addTo(laneFromAt, cell, laneIndex);
        for (const cell of new Set(lane.ride)) addTo(laneRideAt, cell, laneIndex);
    });

    const kicksAt = new Map<number, number[]>();
    walkGrid.kicks.forEach((kick, kickIndex) => addTo(kicksAt, kick.pushCell, kickIndex));

    const { swapOnto, swapObjects, rockAt } = swapIndex(walkGrid, standingRocks, switchesAt.keys());

    const cells = new Uint8Array(walkGrid.grid.length);

    const indexes = [
        bridgesAt,
        bridgesAfterAt,
        rocksAt,
        roversAt,
        mirrorTurnsAt,
        monsterGates.monstersAt,
        transmutes.bumpsFrom,
        switchesAt,
        lanePushAt,
        laneNearAt,
        laneFromAt,
        laneRideAt,
        kicksAt,
    ];

    for (const byCell of indexes) {
        for (const cell of byCell.keys()) {
            if (cell >= 0) cells[cell] = 1;
        }
    }

    for (const cell of walkGrid.beamMoves.pushCells) {
        if (cell >= 0) cells[cell] = 1;
    }

    return {
        cells,
        bridges,
        bridgesAt,
        bridgeAfter,
        bridgesAfterAt,
        bridgeIndexOf,
        rocks,
        rocksAt,
        rovers,
        roversAt,
        mirrorTurns,
        mirrorTurnsAt,
        monsterGates,
        transmutes,
        flavors,
        switchesAt,
        switchCount,
        rodSwitches,
        rodSwitchCount,
        lifts: walkGrid.gateLifts,
        hops: walkGrid.switchHops,
        lanePushAt,
        laneNearAt,
        laneFromAt,
        laneRideAt,
        kicks: walkGrid.kicks,
        kicksAt,
        swapOnto,
        swapObjects,
        rockAt,
    };
}

/**
 * Pairs each world pad with the map-room pads that target it (`twinsOf`, from the level data) and notes the twins'
 * cells. Reaching an enabled MAJOR world pad discovers the pads its chain reveals. The pad sends the hero to its twin
 * in a map room (its target); from there the hero walks to a revealed pad's twin (a map-room pad targeting it), so a
 * revealed pad counts only when a walk on foot (no pads, no elevators) joins the two twins. Discovery enables the
 * world pads and their twins, which makes each one's own Group and also_exist_this_group_id Group exist, so the
 * twins' own existence is not asked and the walk runs with those Groups (withGroups).
 */
export function placeTwins(walkGrid: WalkGrid): void {
    const twinsOf = walkGrid.twinsOf;
    const twinCells: number[] = [];

    for (const twins of twinsOf.values()) {
        for (const twin of twins) twinCells.push(padCell(walkGrid, walkGrid.noFlood, twin));
    }

    walkGrid.twinCells = twinCells;
}

/** The pocket a walk on foot from the cell of pad `padIndex` reaches: an id per pocket, -1 without a cell. */
function padComponentOf(walkGrid: WalkGrid, padIndex: number): number {
    const components = walkGrid.padComponents;
    const cell = padCell(walkGrid, walkGrid.noFlood, padIndex);
    if (cell < 0) return -1;

    if (!components.has(cell)) {
        const reached = flood(walkGrid, [cell], null, null, { reveal: false, travel: false });
        const id = components.size;

        for (const twinCell of [cell, ...walkGrid.twinCells]) {
            if (reached.has(twinCell) && !components.has(twinCell)) components.set(twinCell, id);
        }
    }

    return components.get(cell) ?? -1;
}

/**
 * Whether a walk on foot joins the twin of pad `pad` to the twin of the pad it reveals, with their Groups existing.
 * Twins in different ground layers are never joined: a walk on foot climbs into no layer above it, and a fall from a
 * map room lands inside that room. The walk stops at the revealed twin.
 */
function linked(walkGrid: WalkGrid, pad: number, padTwin: number, revealed: number, revealedTwin: number): boolean {
    const teleporters = walkGrid.teleporters;
    if (teleporters[padTwin].l !== teleporters[revealedTwin].l) return false;

    const groups: Array<number | undefined> = [];

    for (const padIndex of [pad, padTwin, revealed, revealedTwin]) {
        groups.push(teleporters[padIndex].g, teleporters[padIndex].ag);
    }

    return withGroups(walkGrid, groups, (changed) => {
        if (!changed) {
            const padTwinComponent = padComponentOf(walkGrid, padTwin);
            return padTwinComponent >= 0 && padTwinComponent === padComponentOf(walkGrid, revealedTwin);
        }

        const padTwinCell = padCell(walkGrid, walkGrid.noFlood, padTwin);
        const revealedTwinCell = padCell(walkGrid, walkGrid.noFlood, revealedTwin);
        if (padTwinCell < 0 || revealedTwinCell < 0) return false;

        const options = { reveal: false, travel: false, stopAt: revealedTwinCell };
        const reached = flood(walkGrid, [padTwinCell], null, null, options);
        return reached.has(revealedTwinCell);
    });
}

/** Per pad, the existing world pads that reaching it reveals. */
export function revealedPadsOf(walkGrid: WalkGrid): number[][] {
    const { teleporters, teleporterStates, teleporterIndexOf, twinsOf } = walkGrid;

    return walkGrid.geometry.reveals.map((revealed, padIndex) => {
        const pad = teleporters[padIndex];
        const padTwin = teleporterIndexOf.get(pad.target);
        if (!pad.major || !teleporterStates[padIndex].en || padTwin === undefined) return [];

        return revealed.filter((revealedIndex) => {
            const revealedPad = teleporters[revealedIndex];
            if (!exists(walkGrid, revealedPad.pid, revealedPad.ex)) return false;

            const revealedTwins = twinsOf.get(revealedIndex) || [];
            return revealedTwins.some((revealedTwin) =>
                linked(walkGrid, padIndex, padTwin, revealedIndex, revealedTwin),
            );
        });
    });
}

/**
 * Whether the flood has cells to walk on from: its queue, else what a crystal a TRANSMUTE hero makes, a sunk rock
 * bridge, a Lily kicked by a stone, a switch press, a push for the beams, a skip lane, a Rock sunk after turns, Rocks
 * sunk side by side, a hop of a Mirror pushed with turns or a monster Gate that opens adds to it, tried in that order
 * and only while the queue stays empty. The crystals come first, since the others read the objects they make.
 */
function moreToWalk(walkGrid: WalkGrid, floodState: FloodState): boolean {
    const queue = floodState.queue;
    if (queue.length) return true;
    if (walkGrid.triggers.transmutes.targets.length && transmute(walkGrid, floodState) && queue.length) return true;
    if (walkGrid.bridgesOf.size && sink(walkGrid, floodState) && queue.length) return true;
    if (walkGrid.kicks.length && takeKicks(walkGrid, floodState) && queue.length) return true;
    if (walkGrid.latch.size && press(walkGrid, floodState) && queue.length) return true;
    const { pushCells, swapObjects } = walkGrid.beamMoves;
    if ((pushCells.size || swapObjects.size) && pushForBeams(walkGrid, floodState) && queue.length) return true;
    if (walkGrid.lanes.length && skipAndSwap(walkGrid, floodState) && queue.length) return true;
    if (walkGrid.triggers.rocks.length && sinkTurned(walkGrid, floodState) && queue.length) return true;
    if (walkGrid.triggers.rocks.length && sinkChained(walkGrid, floodState) && queue.length) return true;
    if (walkGrid.triggers.rovers.length && ferry(walkGrid, floodState) && queue.length) return true;
    if (walkGrid.triggers.mirrorTurns.length && hopTurned(walkGrid, floodState) && queue.length) return true;
    if (walkGrid.triggers.monsterGates.gates.length && openMonsterGates(walkGrid, floodState) && queue.length) {
        return true;
    }
    return false;
}

/**
 * Where a move from `cell` on side `side` ends: along or against an ENDPOINT beam, its landing (endpointTarget),
 * else the cell `steps` cells on. Such a move checks its destination only.
 */
function moveTarget(
    walkGrid: WalkGrid,
    cell: number,
    side: number,
    endpointBeam: EndpointBeam | undefined,
    altered: boolean,
    steps: number,
): number {
    if (endpointBeam) return endpointTarget(endpointBeam, endpointBeam.side === side, altered);
    return cellsOnSide(walkGrid, cell, side, steps);
}

/**
 * Whether a step from `cell` into `target`, which holds what the hero pushes, moves it one cell on: not when that
 * cell is blocked (one push: no chains, MULTIPUSH or PULL). A Wardrobe skill replaces SINGLE_PUSH, so a hero with
 * PROTECTION or TELEPORT pushes nothing.
 */
function canPush(
    walkGrid: WalkGrid,
    floodState: FloodState,
    cell: number,
    side: number,
    target: number,
    layer: number,
): boolean {
    if (layer !== 0) return false;

    const pushedTo = cellOnSide(walkGrid, target, side);
    if (pushedTo === cell || blocked(walkGrid, floodState, pushedTo)) return false;
    if (walkGrid.grid[pushedTo] & PUSH || fenced(walkGrid, target, side, pushedTo)) return false;

    return true;
}

/**
 * What a move from a cell takes from the beams there: whether any power is there, ALTER, SQUEEZE, the ENDPOINT beams
 * and the cells each move goes.
 */
interface StepPowers {
    powered: boolean;
    altered: boolean;
    squeezed: boolean;
    endpointBeams: EndpointBeam[] | undefined;
    steps: number;
}

const NO_POWERS: StepPowers = { powered: false, altered: false, squeezed: false, endpointBeams: undefined, steps: 1 };

/**
 * The powers of the beams at `cell`: those of the walker's own lookups, and with `withOptional` the optional powers a
 * flood's pushes laid down as well (their ENDPOINT beams first).
 */
function stepPowers(walkGrid: WalkGrid, cell: number, withOptional: boolean): StepPowers {
    const powered = (walkGrid.marks[cell] & POWER_MARK) !== 0;
    if (!powered && !withOptional) return NO_POWERS;

    let altered = false;
    let squeezed = false;
    let endpointBeams: EndpointBeam[] | undefined;
    let doubleBeams = 0;

    if (powered) {
        altered = walkGrid.alterCells.has(cell);
        squeezed = walkGrid.squeezeCells.has(cell);
        endpointBeams = walkGrid.endpointBeams.get(cell);
        doubleBeams = walkGrid.doubleBeams.get(cell) ?? 0;
    }

    if (withOptional) {
        const optional = walkGrid.optionalPowers;
        if (optional.alterCells.has(cell)) altered = true;

        const optionalEndpoints = optional.endpointBeams.get(cell);
        if (optionalEndpoints) endpointBeams = [...optionalEndpoints, ...(endpointBeams ?? [])];

        doubleBeams += optional.doubleBeams.get(cell) ?? 0;
    }

    const stepFactor = altered ? 3 : 2;
    return { powered: true, altered, squeezed, endpointBeams, steps: stepFactor ** doubleBeams };
}

/**
 * The hero (walk layer `layer`) at `cell` moves one way on each side, by the powers there: an ENDPOINT move along
 * its beam, a DOUBLE move (fences: on the start and destination cells), a squeeze past Fences. Where a flood's pushes
 * laid down optional powers, he also moves with them. A closed Freezer the move bumps into goes to `front`.
 */
function stepSides(
    walkGrid: WalkGrid,
    floodState: FloodState,
    cell: number,
    layer: number,
    front: Set<number> | null,
): void {
    stepWith(walkGrid, floodState, cell, layer, front, stepPowers(walkGrid, cell, false));
    if (walkGrid.marks[cell] & OPTION_MARK) {
        stepWith(walkGrid, floodState, cell, layer, front, stepPowers(walkGrid, cell, true));
    }
}

/** The hero at `cell` moves one way on each side with the powers `powers`. */
function stepWith(
    walkGrid: WalkGrid,
    floodState: FloodState,
    cell: number,
    layer: number,
    front: Set<number> | null,
    powers: StepPowers,
): void {
    const { grid, cellFlags, frozen } = walkGrid;
    const z = Math.floor(cell / walkGrid.layerCells) - Z_BIAS;
    const { powered, altered, squeezed, endpointBeams, steps } = powers;

    for (const side of SIDES) {
        const endpointBeam = endpointBeams?.find((beam) => beam.side % 2 === side % 2);
        if (powered) openGateAhead(walkGrid, floodState, cell, side, altered);

        const target = moveTarget(walkGrid, cell, side, endpointBeam, altered, steps);

        // a jump along a beam at infinity leaves the map
        if (target < 0 || target === cell) continue;
        if (!squeezed && fenced(walkGrid, cell, side, target)) continue;
        if (grid[target] & PUSH && !canPush(walkGrid, floodState, cell, side, target, layer)) continue;

        if (blocked(walkGrid, floodState, target)) {
            const iceGate = frozen.get(target);
            if (front && iceGate !== undefined && !(grid[target] & (SOLID | GATE))) front.add(iceGate);
            continue;
        }

        // a beam's wall cell is entered only from the beam
        if (cellFlags[target] & THRU && !(cellFlags[cell] & BEAM)) continue;
        if (layer === 0 && leavesByCharmDoor(walkGrid, cell, side)) floodState.charming = true;
        if (!floodState.pocket && leavesByRodDoor(walkGrid, cell, side)) floodState.rodHeld = true;
        settle(walkGrid, floodState, target, z, layerAfterStep(walkGrid, cell, side, target, layer));
    }
}

/**
 * The cells the TELEPORT line of a hero at `cell` steps on side `side` with the powers `powers`, the length of his move
 * there: the jump to the endpoint in a parallel ENDPOINT beam, else the cells of a DOUBLE move. -1 when the move has
 * no landing.
 */
function swapStride(side: number, powers: StepPowers): number {
    const endpointBeam = powers.endpointBeams?.find((beam) => beam.side % 2 === side % 2);
    if (!endpointBeam) return powers.steps;

    return endpointDistance(endpointBeam, endpointBeam.side === side, powers.altered);
}

/** The hero in walk layer 2 at `cell` swaps with the first target of his TELEPORT line on each side, by `powers`. */
function swapSides(walkGrid: WalkGrid, floodState: FloodState, cell: number, z: number, powers: StepPowers): void {
    for (const side of SIDES) {
        const stride = swapStride(side, powers);
        if (stride <= 0) continue;

        const swapped = swapCell(walkGrid, floodState, cell, side, stride);
        if (swapped < 0) continue;

        settle(walkGrid, floodState, swapped, z, WIZARD);
        if (!floodState.pocket) noteSwap(walkGrid, floodState, cell, swapped);
    }
}

/** Walks on from `cell` in walk layer `layer`: steps, TELEPORT swaps, magic-mirror hops, and with `travel` the rides. */
function walkFrom(
    walkGrid: WalkGrid,
    floodState: FloodState,
    cell: number,
    layer: number,
    front: Set<number> | null,
    travel: boolean,
): void {
    const z = Math.floor(cell / walkGrid.layerCells) - Z_BIAS;

    stepSides(walkGrid, floodState, cell, layer, front);

    // a hero with TELEPORT swaps with the first target along each side
    if (layer === WIZARD) {
        swapSides(walkGrid, floodState, cell, z, stepPowers(walkGrid, cell, false));
        if (walkGrid.marks[cell] & OPTION_MARK) {
            swapSides(walkGrid, floodState, cell, z, stepPowers(walkGrid, cell, true));
        }
    }

    if (!(walkGrid.marks[cell] & TRAVEL_MARK)) return;

    // ACTIVATE on a magic Mirror's arm
    const landings = walkGrid.mirrorHops.get(cell);
    if (landings) {
        for (const landing of landings) {
            if (!blocked(walkGrid, floodState, landing)) settle(walkGrid, floodState, landing, z, layer);
        }
    }

    // ACTIVATE between two facing magic Mirrors: both landings or none
    const pairs = walkGrid.pairHops.get(cell);
    if (pairs) {
        for (const [firstLanding, secondLanding] of pairs) {
            if (blocked(walkGrid, floodState, firstLanding) || blocked(walkGrid, floodState, secondLanding)) continue;

            settle(walkGrid, floodState, firstLanding, z, layer);
            settle(walkGrid, floodState, secondLanding, z, layer);
        }
    }

    // a pocket flood walks a pair's landing back to the arm cell it came from
    if (floodState.pocket) {
        for (const armCell of walkGrid.pairArms.get(cell) ?? []) {
            if (!blocked(walkGrid, floodState, armCell)) settle(walkGrid, floodState, armCell, z, layer);
        }
    }

    // ACTIVATE on the arm of a magic Mirror the flood pushed to another cell
    const turnedLandings = floodState.hopsAt.get(cell);
    if (turnedLandings) {
        for (const landing of turnedLandings) {
            if (!blocked(walkGrid, floodState, landing)) settle(walkGrid, floodState, landing, z, layer);
        }
    }

    if (!travel) return;

    const frames = walkGrid.elevatorsAt.get(cell);
    if (frames) {
        for (const frame of frames) {
            if (!blocked(walkGrid, floodState, frame)) push(walkGrid, floodState, frame, layer);
        }
    }

    // a pad sends the hero one way, so it leads out of a pocket, not in; addLandingWays joins its landing to the pad
    if (!floodState.pocket) padStep(walkGrid, floodState, cell, layer);
}

/**
 * The cells a walk reaches from `seeds`, in the order they were reached in each layer. Four walk layers: 0 any
 * skill, 1 PROTECTION, 2 TELEPORT (a hero who left a TELEPORT Wardrobe by its door, who pushes nothing and swaps), 3
 * TRANSMUTE (who pushes nothing and turns what he bumps into a crystal). The flood never enters `outside` and adds each closed Freezer it bumps into to `front`. Floods run one at a time: they
 * share the walker's visited cells.
 */
export function flood(
    walkGrid: WalkGrid,
    seeds: Iterable<Seed>,
    outside: Set<number> | null = null,
    front: Set<number> | null = null,
    options: FloodOptions = {},
): Set<number> {
    const {
        reveal = true,
        travel = true,
        pocket = false,
        frozenHolds = true,
        topDrops = false,
        stopAt = -1,
        stoneFront,
    } = options;
    if (walkGrid.activeFlood) throw new Error('flood() called inside a flood of the same walker');

    const laneCount = walkGrid.lanes.length;
    const floodState = newFloodState(walkGrid.triggers, laneCount, outside, reveal, pocket, frozenHolds, topDrops);
    floodState.charming = startsWithCharm(walkGrid, outside);
    floodState.rodHeld = !pocket && startsWithRod(walkGrid, outside);
    floodState.stoneFront = stoneFront ?? null;
    floodState.front = front;
    walkGrid.activeFlood = floodState;

    const queue = floodState.queue;

    try {
        for (const seed of seeds) {
            if (Array.isArray(seed)) {
                const [cell, layer] = seed;
                push(walkGrid, floodState, cell, layer);
            } else {
                push(walkGrid, floodState, seed, 0);
            }
        }

        while (moreToWalk(walkGrid, floodState)) {
            // take the last cell, layer pair
            const layer = queue[queue.length - 1];
            const cell = queue[queue.length - 2];
            queue.length -= 2;
            walkFrom(walkGrid, floodState, cell, layer, front, travel);
            if (stopAt >= 0 && walkGrid.visited[stopAt] !== 0) break;
        }
    } finally {
        for (const cells of floodState.reached) {
            for (const cell of cells) walkGrid.visited[cell] = 0;
        }

        if (floodState.beamFlood) undoBeamMoves(floodState.beamFlood);
        undoTransmutes(floodState);
        for (const cell of floodState.turnMarked) walkGrid.marks[cell] &= ~BRIDGE_MARK;
        for (const cell of floodState.rideMarked) walkGrid.marks[cell] &= ~RIDE_MARK;
        for (const cell of floodState.hopMarked) walkGrid.marks[cell] &= ~TRAVEL_MARK;
        walkGrid.activeFlood = null;
    }

    const reachedCells = new Set<number>();

    for (const cells of floodState.reached) {
        for (const cell of cells) reachedCells.add(cell);
    }

    return reachedCells;
}
