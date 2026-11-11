// Promesst lights, the Gem_Slots that power them, their beams and where an ENDPOINT move lands (movement.md
// "Promesst beams and powers", viewer.md "Beams")
import { latestF32, rawU32 } from '../save.ts';
import type { LightRow } from '../types.ts';
import { addTo, cellOnSide, BEAM, BEAM_STOP, mod, OPTION_MARK, POWER_MARK, SOLID, THRU, Z_BIAS } from './cells.ts';
import type { GridShape } from './cells.ts';
import { dormantGroup, exists, existsNow, put } from './groups.ts';
import { layerOf } from './ocean.ts';
import type { LayerSource } from './ocean.ts';
import type { WalkGrid } from './walker.ts';
import { latestCell } from './walls.ts';

// Promesst_Power (a Promesst_Light's color)
export const OPEN = 0;
export const THROUGH = 1;
export const DOUBLE = 3;
export const ENDPOINT = 5;
export const ALTER = 7;
export const SQUEEZE = 9;

/** The world.json movables kind of a Gem. */
export const GEM_KIND = 0;

/** Gem_Slot.flags BEAM_POWERED. */
export const BEAM_POWERED = 2;

/**
 * The side a Promesst_Light faces: its latest `theta_target` rounded to a quarter turn, else the level data's `side`.
 * A light that is off the grid axes in the level data (`side` -1) stays so.
 */
export function lightSide(walkGrid: WalkGrid, pid: number, dataSide: number): number {
    if (dataSide < 0) return dataSide;

    const theta = latestF32(walkGrid.latest, pid, 'base.theta_target');
    if (theta === undefined) return dataSide;

    return mod(Math.round(theta / 90), 4);
}

/** The cells of a beam, and whether it ends because its next cell would leave the level volume. */
export interface BeamCells {
    cells: number[];
    atInfinity: boolean;
}

/** An ENDPOINT beam at one of its cells: its side, its cells and the index of that cell in them. */
export interface EndpointBeam extends BeamCells {
    side: number;
    index: number;
}

/** The powers that change a move: per cell its ENDPOINT beams, its number of DOUBLE beams, and the ALTER cells. */
export interface MovePowers {
    endpointBeams: Map<number, EndpointBeam[]>;
    doubleBeams: Map<number, number>;
    alterCells: Set<number>;
}

/**
 * A beam as cast: its light's cell, its facing (`side`, or `dz` for a vertical one), its light's color and its cells.
 * `vacated`: the cell a pushed light left, which no longer stops the beam (-1 for a light where it stands).
 */
export interface CastBeam {
    lightCell: number;
    side: number;
    dz: number;
    color: number;
    vacated: number;
    beam: BeamCells;
}

/** The undo steps of a flood's writes to the walker's grid and lookups, run newest first when the flood ends. */
export type Undo = Array<() => void>;

/** Sets `bits` in `array[index]`; with `undo` (in a flood) the old value comes back when the flood ends. */
export function setBits(array: Uint8Array | Uint16Array, index: number, bits: number, undo: Undo | null): void {
    const old = array[index];
    if ((old & bits) === bits) return;
    array[index] = old | bits;
    undo?.push(() => {
        array[index] = old;
    });
}

/** Clears `bits` in `array[index]`; with `undo` (in a flood) the old value comes back when the flood ends. */
export function clearBits(array: Uint8Array | Uint16Array, index: number, bits: number, undo: Undo | null): void {
    const old = array[index];
    if ((old & bits) === 0) return;
    array[index] = old & ~bits;
    undo?.push(() => {
        array[index] = old;
    });
}

/** Adds `cell` to `cells`; with `undo` (in a flood) it is taken out again when the flood ends. */
function addCell(cells: Set<number>, cell: number, undo: Undo | null): void {
    if (cells.has(cell)) return;
    cells.add(cell);
    undo?.push(() => {
        cells.delete(cell);
    });
}

/** A Gem_Slot, in the cell `cell`. */
export interface GemSlot {
    pid: number;
    existence: number | undefined;
    cell: number;
    beamPowered: boolean;
}

/** A free Gem. */
export interface Gem {
    pid: number;
    existence: number | undefined;
}

/** Whether an entity counts as there, by its pid and level-data existence. */
type ExistenceTest = (pid: number, existence: number | undefined) => boolean;

/**
 * Where an ENDPOINT move from cell `index` of a beam's cells lands: along the beam its last cell, against it its
 * first; in an ALTER beam the midpoint of the way to that end. A move along a beam at infinity, with or without
 * ALTER, takes the hero off the map, where the hero is destroyed: -1, no landing.
 */
export function endpointTarget(beam: EndpointBeam, along: boolean, altered: boolean): number {
    const landing = endpointLanding(beam, along, altered);
    if (landing < 0) return -1;
    return beam.cells[landing];
}

/** How many cells an ENDPOINT move from its beam's cell jumps (endpointTarget); -1 when it has no landing. */
export function endpointDistance(beam: EndpointBeam, along: boolean, altered: boolean): number {
    const landing = endpointLanding(beam, along, altered);
    if (landing < 0) return -1;
    return Math.abs(landing - beam.index);
}

/** The index in a beam's cells of where an ENDPOINT move lands, -1 when it has no landing. */
function endpointLanding(beam: EndpointBeam, along: boolean, altered: boolean): number {
    const { cells, index, atInfinity } = beam;
    if (along && atInfinity) return -1;
    if (!altered) {
        if (along) return cells.length - 1;
        return 0;
    }

    if (!along) return Math.floor(index / 2);
    const cellsAhead = cells.length - 1 - index;
    return index + Math.ceil(cellsAhead / 2);
}

/** The room of a cell: a 19 x 13 screen of a ground, underworld or sky layer, or a whole map-room layer. */
export function roomOf(source: GridShape & LayerSource, cell: number): string {
    const layer = layerOf(source, Math.floor(cell / source.layerCells) - Z_BIAS);
    if (layer >= 3) return `${layer}`;
    const column = cell % source.width;
    const row = Math.floor(cell / source.width) % source.height;
    return `${Math.floor(column / 19)},${Math.floor(row / 13)},${layer}`;
}

/**
 * The cells of a beam from the light's cell `lightCell` along side `side`, or up / down (`dz`). Solid voxels never
 * stop a beam, so a vertical one leaves its layer: one that starts below the map rooms climbs no higher than half a
 * cell under them. A beam runs one full lap at most (beamSteps). atInfinity: the beam ends because its next cell
 * would leave the level volume (below or above the grid, or past that cap). The grid wraps in x and y, so only a
 * vertical beam ends at infinity. The cell a pushed light left (`vacated`) stops nothing.
 */
function beamCells(walkGrid: WalkGrid, lightCell: number, side: number, dz: number, vacated = -1): BeamCells {
    const { grid, frozen, layerCells, boxZ } = walkGrid;
    const beamSteps = walkGrid.width + walkGrid.height;
    const cells: number[] = [];
    const lightZ = Math.floor(lightCell / layerCells) - Z_BIAS;
    const top = lightZ < boxZ ? boxZ - 0.5 : Infinity;
    let cell = lightCell;

    for (let stepsLeft = beamSteps; stepsLeft > 0; stepsLeft--) {
        const next = nextBeamCell(walkGrid, cell, side, dz);
        const leavesVolume = next < layerCells || next >= grid.length || Math.floor(next / layerCells) - Z_BIAS >= top;
        if (leavesVolume) return { cells, atInfinity: true };

        const stops = (grid[next] & BEAM_STOP) !== 0 && next !== vacated;
        if (next === lightCell || stops || frozen.has(next)) break;

        cells.push(next);
        cell = next;
    }

    return { cells, atInfinity: false };
}

/** The cells a cast beam would run through if it were cast again from its light with the grid as it stands. */
export function recastCells(walkGrid: WalkGrid, cast: CastBeam): number[] {
    return beamCells(walkGrid, cast.lightCell, cast.side, cast.dz, cast.vacated).cells;
}

/** The cell after `cell` along a beam facing `side`, or up / down (`dz`). */
function nextBeamCell(walkGrid: WalkGrid, cell: number, side: number, dz: number): number {
    if (dz) return cell + dz;
    return cellOnSide(walkGrid, cell, side);
}

/** The cell where a cast beam stopped: the one after its last cell, or after its light when it has no cells. */
export function stopOf(walkGrid: WalkGrid, cast: CastBeam): number {
    const cells = cast.beam.cells;
    let last = cast.lightCell;
    if (cells.length > 0) last = cells[cells.length - 1];
    return nextBeamCell(walkGrid, last, cast.side, cast.dz);
}

/**
 * Collects the Gem_Slots per room and the free Gems per cell. A room's lights are powered when it has an existing
 * Gem_Slot and every existing one is filled: a free Gem stands in its cell (attached_to_entity_id 0) or its `flags`
 * hold BEAM_POWERED.
 */
export function placeGems(walkGrid: WalkGrid): void {
    const { world, geometry, latest, slotsByRoom, gemsAt } = walkGrid;
    const heldGems = new Set(world.held_gems || []);

    (world.gem_slots || []).forEach(([pid, , , , beamPowered, existence], slotIndex) => {
        const slotCell = geometry.gemSlotCells[slotIndex];
        if (slotCell < 0) return;

        const flags = latest.get(pid, 'flags');
        let powered = !!beamPowered;
        if (flags) powered = (flags[0] & BEAM_POWERED) !== 0;

        addTo(slotsByRoom, geometry.gemSlotRooms[slotIndex], { pid, existence, cell: slotCell, beamPowered: powered });
    });

    for (const [pid, i, j, z, kind, existence] of world.movables || []) {
        if (kind !== GEM_KIND) continue;

        const holder = latest.get(pid, 'attached_to_entity_id');
        let free = !heldGems.has(pid);
        if (holder) free = rawU32(holder) === 0;

        const cell = latestCell(walkGrid, pid, i, j, z);
        if (free && cell >= 0) addTo(gemsAt, cell, { pid, existence });
    }
}

/**
 * Whether a Gem_Slot is filled: BEAM_POWERED, a free Gem that `isThere` counts stands in its cell, or a flood has
 * pushed a Gem onto it (its cell is in `pushedOnto`).
 */
function slotFilled(
    walkGrid: WalkGrid,
    slot: GemSlot,
    isThere: ExistenceTest,
    pushedOnto: ReadonlySet<number> | null,
): boolean {
    if (slot.beamPowered || pushedOnto?.has(slot.cell)) return true;
    const gems = walkGrid.gemsAt.get(slot.cell) || [];
    return gems.some((gem) => isThere(gem.pid, gem.existence));
}

/**
 * Whether a room's lights are powered: it has a Gem_Slot that `isThere` counts, and each such slot is filled (with
 * the Gems a flood has pushed onto the slots in `pushedOnto`).
 */
function roomPowered(
    walkGrid: WalkGrid,
    room: string,
    isThere: ExistenceTest,
    pushedOnto: ReadonlySet<number> | null = null,
): boolean {
    const slots = walkGrid.slotsByRoom.get(room) || [];
    const counted = slots.filter((slot) => isThere(slot.pid, slot.existence));
    return counted.length > 0 && counted.every((slot) => slotFilled(walkGrid, slot, isThere, pushedOnto));
}

/** Whether the lights in the room of `cell` are powered once a flood has pushed Gems onto the slots in `pushedOnto`. */
export function poweredWithGems(walkGrid: WalkGrid, cell: number, pushedOnto: ReadonlySet<number>): boolean {
    const existsThere: ExistenceTest = (entityPid, entityExistence) => exists(walkGrid, entityPid, entityExistence);
    return roomPowered(walkGrid, roomOf(walkGrid, cell), existsThere, pushedOnto);
}

/** The Groups that keep a Gem_Slot of the room, or a Gem on one, from existing (undefined for the others). */
function roomGroups(walkGrid: WalkGrid, room: string): Array<number | undefined> {
    const groups: Array<number | undefined> = [];

    for (const slot of walkGrid.slotsByRoom.get(room) || []) {
        groups.push(dormantGroup(walkGrid, slot.pid, slot.existence));
        for (const gem of walkGrid.gemsAt.get(slot.cell) || []) {
            groups.push(dormantGroup(walkGrid, gem.pid, gem.existence));
        }
    }

    return groups;
}

/**
 * A horizontal THROUGH light that only the Groups withGroups makes exist power (the light, or a Gem_Slot or Gem in
 * its room, is a member) lets the hero through the walls in its beam while they exist.
 */
function castDormantThrough(walkGrid: WalkGrid, light: LightRow): void {
    const [pid, column, row, z, dataSide, , , , , existence] = light;
    const side = lightSide(walkGrid, pid, dataSide);
    const lightCell = latestCell(walkGrid, pid, column, row, z);
    const existsWithGroups: ExistenceTest = (entityPid, entityExistence) =>
        existsNow(walkGrid, entityPid, entityExistence);

    if (lightCell < 0 || walkGrid.frozen.has(lightCell) || !existsNow(walkGrid, pid, existence)) return;
    if (!roomPowered(walkGrid, roomOf(walkGrid, lightCell), existsWithGroups)) return;

    for (const cell of beamCells(walkGrid, lightCell, side, 0, -1).cells) {
        put(walkGrid, walkGrid.cellFlags, cell, BEAM);
        if (walkGrid.grid[cell] & SOLID) put(walkGrid, walkGrid.cellFlags, cell, THRU);
    }
}

/** Keeps the cast of a THROUGH light's beam for each Group that keeps the light or its room's power from existing. */
function addDormantThrough(walkGrid: WalkGrid, light: LightRow, lightCell: number): void {
    const [pid, , , , , , , , , existence] = light;
    const room = roomOf(walkGrid, lightCell);
    const groups = new Set([dormantGroup(walkGrid, pid, existence), ...roomGroups(walkGrid, room)]);

    for (const groupIndex of groups) {
        if (groupIndex === undefined) continue;
        walkGrid.dormantLights[groupIndex].push(() => castDormantThrough(walkGrid, light));
    }
}

/** The step of a vertical_up / vertical_down beam from cell to cell, else 0. */
export function verticalStep(up: number, down: number, layerCells: number): number {
    if (up) return layerCells;
    if (down) return -layerCells;
    return 0;
}

/** Notes one more ENDPOINT beam at `cell`. */
function addEndpointBeam(powers: MovePowers, cell: number, endpointBeam: EndpointBeam, undo: Undo | null): void {
    const endpointBeams = powers.endpointBeams;
    const list = endpointBeams.get(cell);

    if (!list) {
        endpointBeams.set(cell, [endpointBeam]);
        undo?.push(() => {
            endpointBeams.delete(cell);
        });
        return;
    }

    list.push(endpointBeam);
    undo?.push(() => {
        list.pop();
    });
}

/** Counts one more DOUBLE beam at `cell`. */
function addDoubleBeam(powers: MovePowers, cell: number, undo: Undo | null): void {
    const doubleBeams = powers.doubleBeams;
    const old = doubleBeams.get(cell);
    doubleBeams.set(cell, (old ?? 0) + 1);
    undo?.push(() => {
        if (old === undefined) {
            doubleBeams.delete(cell);
        } else {
            doubleBeams.set(cell, old);
        }
    });
}

/**
 * Marks the power of a cast beam's color on its cell at `index`. ENDPOINT, DOUBLE and ALTER change the hero's move:
 * with `optional` they go to the walker's optional powers (OPTION_MARK), which the hero may use or not; SQUEEZE and
 * OPEN only add moves, and go to the walker's own lookups either way (POWER_MARK).
 */
function markPower(walkGrid: WalkGrid, cast: CastBeam, index: number, undo: Undo | null, optional: boolean): void {
    const { color, side, beam } = cast;
    const cell = beam.cells[index];
    let powers: MovePowers = walkGrid;
    let mark = POWER_MARK;

    if (optional) {
        powers = walkGrid.optionalPowers;
        mark = OPTION_MARK;
    }

    if (color === ENDPOINT && !cast.dz) {
        addEndpointBeam(powers, cell, { side, cells: beam.cells, index, atInfinity: beam.atInfinity }, undo);
    } else if (color === DOUBLE) {
        addDoubleBeam(powers, cell, undo);
    } else if (color === ALTER) {
        addCell(powers.alterCells, cell, undo);
    } else if (color === SQUEEZE) {
        addCell(walkGrid.squeezeCells, cell, undo);
        mark = POWER_MARK;
    } else if (color === OPEN) {
        addCell(walkGrid.openBeamCells, cell, undo);
        mark = POWER_MARK;
    } else {
        return;
    }

    setBits(walkGrid.marks, cell, mark, undo);
}

/**
 * Lays a cast beam's cells from `fromIndex` on into the grid: a horizontal THROUGH beam's cells and the walls among
 * them, and the power of the other colors (`optional`: as for markPower).
 */
function layBeam(walkGrid: WalkGrid, cast: CastBeam, fromIndex: number, undo: Undo | null, optional: boolean): void {
    const { grid, cellFlags } = walkGrid;
    const cells = cast.beam.cells;
    const through = cast.color === THROUGH && !cast.dz;

    for (let index = fromIndex; index < cells.length; index++) {
        const cell = cells[index];

        if (!through) {
            markPower(walkGrid, cast, index, undo, optional);
            continue;
        }

        addCell(walkGrid.throughBeam, cell, undo);
        setBits(cellFlags, cell, BEAM, undo);

        if (grid[cell] & SOLID) {
            addCell(walkGrid.throughWalls, cell, undo);
            setBits(cellFlags, cell, THRU, undo);
        }
    }
}

/**
 * The beam of a light of color `color` in `lightCell` facing `side` (or up / down, `dz`), not laid into the grid yet.
 * `vacated`: the cell a pushed light left.
 */
export function newCast(
    walkGrid: WalkGrid,
    lightCell: number,
    side: number,
    dz: number,
    color: number,
    vacated: number,
): CastBeam {
    const beam = beamCells(walkGrid, lightCell, side, dz, vacated);
    return { lightCell, side, dz, color, vacated, beam };
}

/**
 * Lays a cast beam into the grid. With `undo` (in a flood) it is taken out again when the flood ends, and its powers
 * that change a move are optional (markPower).
 */
export function layCast(walkGrid: WalkGrid, cast: CastBeam, undo: Undo | null): void {
    layBeam(walkGrid, cast, 0, undo, undo !== null);
}

/**
 * The longer beam of a cast beam, once the stop that ended it has left its way, laid into the grid until the flood
 * ends. The cast beam stays as it was; the new cells' powers that change a move are optional, and so are ENDPOINT
 * jumps from its old cells to the new end (markPower).
 */
export function extendBeam(walkGrid: WalkGrid, cast: CastBeam, undo: Undo): CastBeam {
    const beam = beamCells(walkGrid, cast.lightCell, cast.side, cast.dz, cast.vacated);
    const longer: CastBeam = { ...cast, beam };
    const oldLength = cast.beam.cells.length;

    if (cast.color === ENDPOINT && !cast.dz) {
        for (let index = 0; index < oldLength; index++) markPower(walkGrid, longer, index, undo, true);
    }

    layBeam(walkGrid, longer, oldLength, undo, true);

    return longer;
}

/** The cells of the beam the powered Promesst_Light in the closed Freezer in `cell` would cast once it opens. */
export function frozenBeamCells(walkGrid: WalkGrid, cell: number): number[] {
    return walkGrid.frozenBeams.get(cell)?.beam.cells ?? [];
}

/**
 * Lays the beam of the Light in the closed Freezer in `cell` into the grid, its powers that change a move optional as
 * in a flood's pushes. Returns the function that takes it out again.
 */
export function layFrozenBeam(walkGrid: WalkGrid, cell: number): () => void {
    const cast = walkGrid.frozenBeams.get(cell);
    const undo: Undo = [];
    if (cast) layCast(walkGrid, cast, undo);

    return () => {
        for (const step of undo.toReversed()) step();
    };
}

/**
 * Casts the beams of the powered Promesst_Lights. A beam runs from the light (where the save last left it) along its
 * facing (up or down for vertical_up / vertical_down, out of its layer) through walls, Guys and Monsters until a
 * BEAM_STOP or a closed Freezer: until a stop, one full lap at most (beamSteps), ending at its own light. Mirror
 * reflections are not followed. A horizontal THROUGH beam lets the hero walk through the walls in it. A hero standing
 * in a beam takes its power: ENDPOINT (horizontal) moves along it jump to its last cell, against it to its first;
 * DOUBLE doubles each move per beam; SQUEEZE passes Fences. In an ALTER beam too, each DOUBLE beam triples the move
 * and ENDPOINT jumps to the midpoint (endpointTarget). A light is powered by its room (roomPowered), whatever
 * `powered` the save stored. A light in a closed Freezer casts no beam; the one it would cast is kept in `frozenBeams`.
 */
export function placeLights(walkGrid: WalkGrid): void {
    const { world, layerCells, frozen, litCells } = walkGrid;
    const existsThere: ExistenceTest = (entityPid, entityExistence) => exists(walkGrid, entityPid, entityExistence);

    for (const light of world.lights || []) {
        const [pid, column, row, z, dataSide, up, down, , color, existence] = light;
        const side = lightSide(walkGrid, pid, dataSide);
        const through = color === THROUGH;
        const lightCell = latestCell(walkGrid, pid, column, row, z);
        const dz = verticalStep(up, down, layerCells);
        const powered =
            lightCell >= 0 &&
            exists(walkGrid, pid, existence) &&
            roomPowered(walkGrid, roomOf(walkGrid, lightCell), existsThere);

        const castsDormantThrough = through && !dz && side >= 0 && lightCell >= 0 && !powered;
        if (castsDormantThrough) addDormantThrough(walkGrid, light, lightCell);

        if (lightCell < 0 || !exists(walkGrid, pid, existence)) continue;

        const inFreezer = frozen.has(lightCell);
        if (!inFreezer) litCells.push(lightCell);
        if ((!dz && side < 0) || !powered) continue;

        const cast = newCast(walkGrid, lightCell, side, dz, color, -1);
        if (inFreezer) {
            walkGrid.frozenBeams.set(lightCell, cast);
            continue;
        }

        layCast(walkGrid, cast, null);
        walkGrid.castBeams.push(cast);

        for (const cell of cast.beam.cells) litCells.push(cell);
    }
}
