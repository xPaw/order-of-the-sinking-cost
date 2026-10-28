// The walk model of one overworld state: the walker's grid, built step by step, and what the walker gives its callers
// (VIEWER.md "The walk model (viewer)")
import type { WorldCells } from '../data.ts';
import { latestFlag } from '../save.ts';
import type { LatestValues } from '../save.ts';
import type { ExistenceGroup, Position, Teleporter, World } from '../types.ts';
import { placeAttacks, recastAttacks } from './attacks.ts';
import { NO_BEAM_MOVES, placeBeamMoves } from './beam-moves.ts';
import type { BeamMoves } from './beam-moves.ts';
import { frozenBeamCells, layFrozenBeam, placeGems, placeLights } from './beams.ts';
import type { CastBeam, EndpointBeam, Gem, GemSlot, MovePowers } from './beams.ts';
import { placeBridges, placeGemBridges, placeRespawnBridges } from './bridges.ts';
import type { BridgeWay } from './bridges.ts';
import { BRIDGE_MARK, cellOf, DRIFT_MARK, neighbourOf, TRAVEL_MARK, WARDROBE_MARK } from './cells.ts';
import type { GridShape } from './cells.ts';
import { placeElevators } from './elevator.ts';
import { flood, NO_TRIGGERS, noFloodState, placeTwins, revealedPadsOf, triggerIndex } from './flood.ts';
import type { FloodOptions, FloodState, Seed, Triggers } from './flood.ts';
import { freeze, freezeGates, thaw } from './freezers.ts';
import { placeGates, placeNotPressers } from './gates.ts';
import type { GateLift, Latch } from './gates.ts';
import { withGroups } from './groups.ts';
import type { CellWrite } from './groups.ts';
import { levelGeometry } from './geometry.ts';
import type { LevelGeometry } from './geometry.ts';
import { placeDrift, placeKickedRides, placeLilies, respawnKicks, transitCells } from './lilies-and-rivers.ts';
import { mechAt, placeMechanics } from './mechanics.ts';
import { hopSourcesOf, magicMirrorHops } from './mirror-isles.ts';
import type { PairHop, SwitchHop } from './mirror-isles.ts';
import type { RoomMonster } from './monster-gates.ts';
import { deep, placeWater } from './ocean.ts';
import { NO_ROOMS, roomIndexOf } from './room-answers.ts';
import type { RoomIndex } from './room-answers.ts';
import { searchTouchedRooms } from './room-search.ts';
import { placeRovers } from './rovers.ts';
import type { RoverCell } from './rovers.ts';
import {
    heroHoldsCharm,
    heroHoldsRod,
    heroLayerOf,
    heroSeed,
    placeCharmDoors,
    placeRodDoors,
    placeTeleportDoors,
    placeTransmuteDoors,
    placeWardrobes,
} from './skills.ts';
import type { LayeredCell } from './skills.ts';
import { placeCharmStones, placeKicks, skipLanes } from './skipping-stones.ts';
import type { Kick, SkipLane } from './skipping-stones.ts';
import { skyEntrances } from './sky.ts';
import type { SkyEntrances } from './sky.ts';
import { insideWall, land } from './support.ts';
import { minorLanding, padCell, placePads } from './teleporters.ts';
import type { TeleporterState } from './teleporters.ts';
import { fenced, placeEntities, placeFences, placeWallSets } from './walls.ts';

/**
 * A walker's grid: the cells of one overworld state and what stands in them, built once by walker() in place and
 * read by its floods. It stands on the level data's `geometry`, which it never changes: the grid's dimensions
 * (GridShape), the level data and what is derived from it are the geometry's own, and the walker copies the cells a
 * save changes. Between floods only `frozen` and its FROZEN_MARK in `marks` change (callers open and close
 * Freezers with thaw and freeze); withGroups writes `grid` and `cellFlags` while it runs (`writeLog` undoes them) and
 * names the Groups it makes exist in `groupsMade`; `visited` is the scratch of the flood that runs (`activeFlood`), and
 * `noFlood` the state the helpers read when none runs.
 */
export interface WalkGrid extends GridShape {
    geometry: LevelGeometry;
    latest: LatestValues;
    teleporterStates: TeleporterState[];
    closedFreezers: readonly boolean[];
    world: World;
    worldCells: WorldCells;
    teleporters: Teleporter[];
    // existence Groups: whether each exists (its latest `exists`, else exists_by_default), the member pids' Group and
    // per Group the cell writes of its members that do not exist while it does not (`dormantWrites`, run by
    // withGroups) and the THROUGH lights its existence may power (`dormantLights`, run after the cell writes)
    existenceGroups: ExistenceGroup[];
    groupExists: boolean[];
    groupOfMember: Map<number, number>;
    dormantWrites: Array<Array<() => void>>;
    dormantLights: Array<Array<() => void>>;
    writeLog: CellWrite[] | null;
    groupsMade: Set<number> | null;
    grid: Uint8Array;
    cellFlags: Uint8Array;
    // per cell, the lookups that hold it (POWER_MARK, WARDROBE_MARK, TRAVEL_MARK, DRIFT_MARK)
    marks: Uint8Array;
    // the TELEPORT line's targets: the cells of the existing Rocks, living Monsters and movables other than Mirrors
    // (a Gem, Promesst_Light, Rover or Friendly_Dragon); `mirrorSides`: per cell of an existing Mirror, a bit per
    // side (1 << side) it is open on, where the line turns instead of swapping. Both are filled only by noteTarget and
    // noteMirror while the grid is built, which mark their cells LINE_STOP in `cellFlags`
    swapTargets: Set<number>;
    mirrorSides: Map<number, number>;
    // the cells of the existing flat Mirrors, which hold up nothing (every other movable does)
    flatMirrors: Set<number>;
    // rock bridges, per Rock: [push cell, water cell] of each way to push it into water, where it sinks and holds the
    // hero up; `bridgeWater`: every bridge's water cell, which a pocket flood counts as floor whichever side the push
    // cell is on (flood option `pocket`)
    bridgesOf: Map<number, BridgeWay[]>;
    bridgeWater: Set<number>;
    // per Rock a Spawner respawns at its level-data cell, whose bridges hold once the flood reaches one of the Activators
    // that run the Spawner, those Activators' cells
    respawnActivators: Map<number, number[]>;
    // the existing Rocks and spare Gems (pid and the cell the save last left it in), whose pushes into water may turn
    rocks: Array<{ pid: number; cell: number }>;
    // an existing lily at its level-data place and where the save last left it; liliesAt: per cell, the Lilies that
    // hold the hero there (at these cells and along their drift); lilyHomes: per existing Lily, where the save last
    // left it, whose Monster, Rock or movable rides the Lily
    lilyCells: Set<number>;
    liliesAt: Map<number, Set<number>>;
    lilyHomes: Map<number, number>;
    // per flavor, the cells of its existing Switches not pressed; latch: per flavor not all pressed, the cells its
    // presses change: `open`, its shut switch gates, and `shut`, its open notted gates; the lifts of the shut switch
    // gates that close upward beside such a Switch
    unpressed: Map<number, number[]>;
    latch: Map<number, Latch>;
    gateLifts: GateLift[];
    // the living Monsters that exist, and the cells of the shut monster Gates that open once none is left in their room
    // (`burningBy`: per cell a dragon's fire runs through, the dragons, as indices into `monsters`; `fireOf`: per
    // dragon the cells its fire runs through; `attackCount`: per attacked cell how many goblins and dragons attack it)
    monsters: RoomMonster[];
    monsterGateCells: number[];
    burningBy: Map<number, number[]>;
    fireOf: Map<number, number[]>;
    attackCount: Map<number, number>;
    // the closed Freezers: cell key -> freezer index; `thawed`: the cells of the closed Freezers that thaw has opened
    // and freeze has not closed again
    frozen: Map<number, number>;
    thawed: Set<number>;
    // water: per column the indices of the Ocean_Maps with water there (the geometry's columns, copied where the save
    // changes the water), and per Ocean_Map whether it exists
    waterColumns: Array<number[] | undefined>;
    liveOceans: Uint8Array;
    // the cells of THROUGH beams, and their solid cells, which a hero standing in the beam walks into
    throughBeam: Set<number>;
    throughWalls: Set<number>;
    // per cell of a powered beam, by its light's color: the ENDPOINT beams, the number of DOUBLE beams, and whether
    // an ALTER, a SQUEEZE or an OPEN beam runs there; `litCells`: the cells of every beam and the lights themselves
    // (the 'beam' hint)
    endpointBeams: Map<number, EndpointBeam[]>;
    doubleBeams: Map<number, number>;
    alterCells: Set<number>;
    squeezeCells: Set<number>;
    openBeamCells: Set<number>;
    litCells: number[];
    // the beams cast when the walker is built, the pushes a flood may make to change the beams, and the powers that
    // change a move which the beams of those pushes lay down (OPTION_MARK): the hero may move with them or without;
    // `frozenBeams`: per cell of a closed Freezer, the beam of the powered Promesst_Light in it, cast once it opens
    castBeams: CastBeam[];
    frozenBeams: Map<number, CastBeam>;
    beamMoves: BeamMoves;
    optionalPowers: MovePowers;
    // per cell, the existing pads there and the elevator frames a step onto it rides to; per pad pid its index; the
    // enabled, discovered MAJOR pads; per pad, the existing world pads that reaching it reveals
    padsAt: Map<number, number[]>;
    elevatorsAt: Map<number, number[]>;
    teleporterIndexOf: Map<number, number>;
    majorPads: number[];
    revealedPads: number[][];
    // per Wardrobe cell its [door side, skill]; the attacked cells, and those of them a dragon's fire runs through
    wardrobes: Map<number, [side: number, skill: number]>;
    attacked: Set<number>;
    burning: Set<number>;
    // per room its Gem_Slots, and per cell its free Gems
    slotsByRoom: Map<string, GemSlot[]>;
    gemsAt: Map<number, Gem[]>;
    // the magic-mirror hops: per arm cell the landing cells, the arm cells of a Mirror riding a lily, and the hops off
    // a Switch the hero holds down; per arm cell between two facing magic Mirrors its pairs of landings, and per
    // landing the arm cells it leaves; per landing of any hop the arm cells it leaves
    mirrorHops: Map<number, number[]>;
    driftHops: Set<number>;
    switchHops: SwitchHop[];
    pairHops: Map<number, PairHop[]>;
    pairArms: Map<number, number[]>;
    hopSources: Map<number, number[]>;
    // per river cell, the side its current flows to (the geometry's); the cells the drifting Lilies pass
    flowSide: Map<number, number>;
    driftCells: Set<number>;
    // the existing Rovers, and the cells over the tracks of those the save left sunk in water, which hold the hero
    rovers: RoverCell[];
    rideCells: Set<number>;
    // the cells over the tracks of the Rovers a flood pushed into water
    ferryCells: Set<number>;
    // the cells of the skipping stones skipLanes() launches, and its lanes
    stoneCells: Set<number>;
    // the cells of the skip lane rides of more than one cell
    laneRides: Set<number>;
    lanes: SkipLane[];
    // the Lilies a launched stone may kick
    kicks: Kick[];
    teleportDoors: Set<number>;
    // the CHARM Wardrobes' cells and whether the current hero holds CHARM; the cells of the MIRRORABLE
    // skipping stones a hero with CHARM launches, the cells such a stone can be launched from (its own and its
    // landings), and those of them no hero steps onto
    charmDoors: Set<number>;
    charmHero: boolean;
    charmStones: Set<number>;
    charmPlaces: Set<number>;
    charmIslets: Set<number>;
    transmuteDoors: Set<number>;
    // the cells of the Wardrobes that give the Rod, and whether the current hero holds it
    rodDoors: Set<number>;
    rodHero: boolean;
    // the cells of the objects that press no Switch
    notPressers: Set<number>;
    heroLayer: number;
    // the stored room answers this walker may use (the rooms the save leaves as the level data has them)
    rooms: RoomIndex;
    triggers: Triggers;
    // per world pad, the map-room pads that target it (the geometry's); their cells; per cell, the pocket a flood from
    // a pad cell found
    twinsOf: Map<number, number[]>;
    twinCells: number[];
    padComponents: Map<number, number>;
    // per cell the unmodelled mechanics there (bit 1 << kind), and in it or next to it (null when some lie in the
    // fast-travel rooms)
    mechanics: Map<number, number>;
    mechanicsNear: Map<number, number> | null;
    // the cells a flood has reached: bit p in layer p
    visited: Uint8Array;
    activeFlood: FloodState | null;
    noFlood: FloodState;
}

/**
 * What a walker gives its callers: floods over its grid, and the cells and lookups they need. The functions are bound
 * to the walker, so callers may destructure them.
 */
export interface Walker {
    flood: (
        seeds: Iterable<Seed>,
        outside?: Set<number> | null,
        front?: Set<number> | null,
        options?: FloodOptions,
    ) => Set<number>;
    skyEntrances: () => SkyEntrances;
    transitCells: (reached: Set<number>) => Set<number>;
    land: (cell: number, up?: boolean) => number;
    padCell: (padIndex: number) => number;
    minorLanding: (padIndex: number) => number;
    withGroups: <Result>(groupIndices: Iterable<number | undefined>, callback: (changed: boolean) => Result) => Result;
    deep: (cell: number) => boolean;
    shown: number[][];
    mechAt: (cells: Set<number> | number[]) => number;
    heroSeed: (position: Position) => LayeredCell;
    insideWall: (cell: number) => boolean;
    fire: Set<number>;
    beam: Set<number>;
    thru: Set<number>;
    openBeam: Set<number>;
    lanes: SkipLane[];
    kicks: Kick[];
    hops: Map<number, number[]>;
    driftHops: Set<number>;
    cellOf: (x: number, y: number, z: number) => number;
    neighbourOf: (cell: number, dx: number, dy: number) => number;
    fenced: (cell: number, side: number, neighbour: number) => boolean;
    frozen: ReadonlyMap<number, number>;
    thaw: (cell: number) => void;
    freeze: (cell: number, freezerIndex: number) => void;
    frozenBeamCells: (cell: number) => number[];
    layFrozenBeam: (cell: number) => () => void;
    width: number;
    layerCells: number;
}

/** A new walker's grid, before anything is placed in it. */
function newWalkGrid(
    geometry: LevelGeometry,
    latest: LatestValues,
    teleporterStates: TeleporterState[],
    closedFreezers: readonly boolean[],
): WalkGrid {
    const { world, existenceGroups, volume, layerCells } = geometry;
    const groupExists = existenceGroups.map(([pid, existsByDefault]) =>
        latestFlag(latest, pid, 'exists', existsByDefault),
    );

    return {
        geometry,
        latest,
        teleporterStates,
        closedFreezers,
        world,
        worldCells: geometry.worldCells,
        teleporters: geometry.teleporters,
        cornerX: geometry.cornerX,
        cornerY: geometry.cornerY,
        width: geometry.width,
        height: geometry.height,
        layerCells,
        zOffset: geometry.zOffset,
        layerCount: geometry.layerCount,
        boxZ: geometry.boxZ,
        boxWidth: geometry.boxWidth,
        boxHeight: geometry.boxHeight,
        boxColumn: geometry.boxColumn,
        boxRow: geometry.boxRow,
        sideColumns: geometry.sideColumns,
        existenceGroups,
        groupExists,
        groupOfMember: geometry.groupOfMember,
        dormantWrites: existenceGroups.map(() => []),
        dormantLights: existenceGroups.map(() => []),
        writeLog: null,
        groupsMade: null,
        grid: geometry.solidGrid.slice(),
        cellFlags: new Uint8Array(volume),
        marks: new Uint8Array(volume),
        swapTargets: new Set(),
        mirrorSides: new Map(),
        flatMirrors: new Set(),
        bridgesOf: new Map(),
        bridgeWater: new Set(),
        respawnActivators: new Map(),
        rocks: [],
        lilyCells: new Set(),
        liliesAt: new Map(),
        lilyHomes: new Map(),
        unpressed: new Map(),
        latch: new Map(),
        gateLifts: [],
        monsters: [],
        monsterGateCells: [],
        burningBy: new Map(),
        fireOf: new Map(),
        attackCount: new Map(),
        frozen: new Map(),
        thawed: new Set(),
        waterColumns: geometry.waterColumns,
        liveOceans: new Uint8Array(world.oceans.length),
        throughBeam: new Set(),
        throughWalls: new Set(),
        endpointBeams: new Map(),
        doubleBeams: new Map(),
        alterCells: new Set(),
        squeezeCells: new Set(),
        openBeamCells: new Set(),
        litCells: [],
        castBeams: [],
        frozenBeams: new Map(),
        beamMoves: NO_BEAM_MOVES,
        optionalPowers: { endpointBeams: new Map(), doubleBeams: new Map(), alterCells: new Set() },
        padsAt: new Map(),
        elevatorsAt: new Map(),
        teleporterIndexOf: geometry.teleporterIndexOf,
        majorPads: [],
        revealedPads: [],
        wardrobes: new Map(),
        attacked: new Set(),
        burning: new Set(),
        slotsByRoom: new Map(),
        gemsAt: new Map(),
        mirrorHops: new Map(),
        driftHops: new Set(),
        switchHops: [],
        pairHops: new Map(),
        pairArms: new Map(),
        hopSources: new Map(),
        flowSide: geometry.flowSide,
        driftCells: new Set(),
        rovers: [],
        rideCells: new Set(),
        ferryCells: new Set(),
        stoneCells: new Set(),
        laneRides: new Set(),
        lanes: [],
        kicks: [],
        teleportDoors: new Set(),
        charmDoors: new Set(),
        charmHero: false,
        charmStones: new Set(),
        charmPlaces: new Set(),
        charmIslets: new Set(),
        transmuteDoors: new Set(),
        rodDoors: new Set(),
        rodHero: false,
        notPressers: new Set(),
        heroLayer: 0,
        rooms: NO_ROOMS,
        triggers: NO_TRIGGERS,
        twinsOf: geometry.twinsOf,
        twinCells: [],
        padComponents: new Map(),
        mechanics: new Map(),
        mechanicsNear: null,
        visited: new Uint8Array(volume),
        activeFlood: null,
        noFlood: noFloodState(),
    };
}

/** Sets `mark` on each cell of `cells` inside the grid. */
function markCells(walkGrid: WalkGrid, cells: Iterable<number>, mark: number): void {
    const marks = walkGrid.marks;

    for (const cell of cells) {
        if (cell >= 0 && cell < marks.length) marks[cell] |= mark;
    }
}

/** Marks the cells the per-cell lookups hold, once they are all placed (the beams mark their power as they are cast). */
function markLookups(walkGrid: WalkGrid): void {
    markCells(walkGrid, walkGrid.wardrobes.keys(), WARDROBE_MARK);
    markCells(walkGrid, walkGrid.mirrorHops.keys(), TRAVEL_MARK);
    markCells(walkGrid, walkGrid.pairHops.keys(), TRAVEL_MARK);
    markCells(walkGrid, walkGrid.pairArms.keys(), TRAVEL_MARK);
    markCells(walkGrid, walkGrid.elevatorsAt.keys(), TRAVEL_MARK);

    for (const padCellKey of walkGrid.padsAt.keys()) {
        markCells(walkGrid, [padCellKey, padCellKey + walkGrid.layerCells], TRAVEL_MARK);
    }

    markCells(walkGrid, walkGrid.driftCells, DRIFT_MARK);
    markCells(walkGrid, walkGrid.rideCells, DRIFT_MARK);
    markCells(walkGrid, walkGrid.bridgeWater, BRIDGE_MARK);
}

/**
 * The walk model for one overworld state: its latest values, teleporter states and the closed Freezers
 * (`closedFreezers[freezerIndex]`). A model fitted to the saves, not the game's walk code: mirror reflections, magic Mirrors
 * that share a room and vertical Beamcaster beams are not modelled; pushes are one cell (no chains, MULTIPUSH or
 * PULL). Skipping stones carry the hero only by the TELEPORT swap onto their landing cell; a sunk one is a Rock that
 * holds up the cell above it.
 *
 * flood(seeds, outside, front) never enters `outside` and adds each closed Freezer it bumps into to `front`;
 * Freezers are opened and closed again by thaw(cell) and freeze(cell, freezerIndex); `frozen` reads them (cell key ->
 * freezer index). Floods run one at a time: they share the walker's visited cells.
 *
 * The walker stands on `geometry`, the level data's part (levelGeometry(), the page's own, unless another is given).
 */
export function walker(
    latest: LatestValues,
    teleporterStates: TeleporterState[],
    closedFreezers: readonly boolean[],
    geometry: LevelGeometry = levelGeometry(),
): Walker {
    return walkerOf(buildWalkGrid(latest, teleporterStates, closedFreezers, geometry));
}

/**
 * The grid of the walk model for one overworld state, built as walker() does, for callers that read the grid itself:
 * the room search (room-search.ts) and the tests of the walk.
 */
export function buildWalkGrid(
    latest: LatestValues,
    teleporterStates: TeleporterState[],
    closedFreezers: readonly boolean[],
    geometry: LevelGeometry = levelGeometry(),
): WalkGrid {
    const walkGrid = newWalkGrid(geometry, latest, teleporterStates, closedFreezers);
    placeWallSets(walkGrid);
    const unmovedRocks = placeEntities(walkGrid);
    placeBridges(walkGrid, unmovedRocks);
    placeRespawnBridges(walkGrid);
    placeLilies(walkGrid);
    placeGates(walkGrid);
    placeFences(walkGrid);
    freezeGates(walkGrid);
    placeWater(walkGrid);

    placePads(walkGrid);
    placeElevators(walkGrid);
    placeWardrobes(walkGrid);
    placeAttacks(walkGrid);

    placeGems(walkGrid);
    placeLights(walkGrid);
    recastAttacks(walkGrid);
    placeBeamMoves(walkGrid);
    placeGemBridges(walkGrid);

    placeRovers(walkGrid);

    const { hops, driftHops, switchHops, pairHops, pairArms } = magicMirrorHops(walkGrid);
    walkGrid.mirrorHops = hops;
    walkGrid.driftHops = driftHops;
    walkGrid.switchHops = switchHops;
    walkGrid.pairHops = pairHops;
    walkGrid.pairArms = pairArms;
    walkGrid.hopSources = hopSourcesOf(hops, pairArms);
    placeDrift(walkGrid);
    placeKickedRides(walkGrid);
    markLookups(walkGrid);

    walkGrid.lanes = skipLanes(walkGrid);
    walkGrid.kicks = [...placeKicks(walkGrid), ...respawnKicks(walkGrid)];
    placeTeleportDoors(walkGrid);
    placeCharmDoors(walkGrid);
    walkGrid.charmHero = heroHoldsCharm(walkGrid);
    placeCharmStones(walkGrid);
    placeTransmuteDoors(walkGrid);
    placeRodDoors(walkGrid);
    walkGrid.rodHero = heroHoldsRod(walkGrid);
    placeNotPressers(walkGrid);
    walkGrid.heroLayer = heroLayerOf(walkGrid);
    walkGrid.rooms = roomIndexOf(walkGrid);
    placeTouchedRooms(walkGrid);
    walkGrid.triggers = triggerIndex(walkGrid);
    placeTwins(walkGrid);
    walkGrid.revealedPads = revealedPadsOf(walkGrid);
    placeMechanics(walkGrid);

    return walkGrid;
}

/**
 * Adds the answers of the rooms the stored answers do not cover, searched on this grid. None where no answers are set,
 * as the search then runs live (room-answers.ts).
 */
function placeTouchedRooms(walkGrid: WalkGrid): void {
    if (walkGrid.rooms !== NO_ROOMS) searchTouchedRooms(walkGrid, walkGrid.rooms);
}

/** What a walker gives its callers, over a built grid. */
function walkerOf(walkGrid: WalkGrid): Walker {
    return {
        flood: (seeds, outside, front, options) => flood(walkGrid, seeds, outside, front, options),
        skyEntrances: () => skyEntrances(walkGrid),
        transitCells: (reached) => transitCells(walkGrid, reached),
        land: (cell, up) => land(walkGrid, walkGrid.noFlood, cell, up),
        padCell: (padIndex) => padCell(walkGrid, walkGrid.noFlood, padIndex),
        minorLanding: (padIndex) => minorLanding(walkGrid, walkGrid.noFlood, padIndex, 0),
        withGroups: (groupIndices, callback) => withGroups(walkGrid, groupIndices, callback),
        deep: (cell) => deep(walkGrid, cell),
        shown: walkGrid.revealedPads,
        mechAt: (cells) => mechAt(walkGrid, cells),
        heroSeed: (position) => heroSeed(walkGrid, position),
        insideWall: (cell) => insideWall(walkGrid, cell),
        fire: walkGrid.attacked,
        beam: walkGrid.throughBeam,
        thru: walkGrid.throughWalls,
        openBeam: walkGrid.openBeamCells,
        lanes: walkGrid.lanes,
        kicks: walkGrid.kicks,
        hops: walkGrid.mirrorHops,
        driftHops: walkGrid.driftHops,
        cellOf: (x, y, z) => cellOf(walkGrid, x, y, z),
        neighbourOf: (cell, dx, dy) => neighbourOf(walkGrid, cell, dx, dy),
        fenced: (cell, side, neighbour) => fenced(walkGrid, cell, side, neighbour),
        frozen: walkGrid.frozen,
        thaw: (cell) => thaw(walkGrid, cell),
        freeze: (cell, freezerIndex) => freeze(walkGrid, cell, freezerIndex),
        frozenBeamCells: (cell) => frozenBeamCells(walkGrid, cell),
        layFrozenBeam: (cell) => layFrozenBeam(walkGrid, cell),
        width: walkGrid.width,
        layerCells: walkGrid.layerCells,
    };
}
