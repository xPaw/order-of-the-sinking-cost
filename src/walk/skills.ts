// Wardrobes, the hero's walk layer and the TELEPORT swap (SKILLS.md "Wardrobes", "TELEPORT and PULL")
import { CHARM_FLAG, PROTECTION_FLAG, rawU32, TELEPORT_FLAG, TRANSMUTE_FLAG, WAND_FLAG } from '../save.ts';
import type { Position, World } from '../types.ts';
import { BEAM, BEAMSTOP, cellOf, cellsOnSide, FROZEN_MARK, keyOf, LINE_STOP, SOLID, WARDROBE_MARK } from './cells.ts';
import type { GridShape } from './cells.ts';
import type { FloodState } from './flood.ts';
import { exists } from './groups.ts';
import { blocked, insideWall, land } from './support.ts';
import type { WalkGrid } from './walker.ts';

// walk layers: any skill (0), PROTECTION, TELEPORT, TRANSMUTE (a hero who left a TRANSMUTE Wardrobe by its door: he
// pushes nothing and turns what he bumps into a crystal), no push skill (a hero who left the door of a Wardrobe that
// gives no push skill, such as PULL), and MULTIPUSH (a hero who pushes like layer 0 and keeps his push through the
// door of a Wardrobe that gives no push skill)
export const PROTECTED = 1;
export const WIZARD = 2;
export const TRANSMUTING = 3;
export const NO_PUSH = 4;
export const MULTI_PUSH = 5;

// the number of walk layers
export const LAYER_COUNT = 6;

// a Wardrobe's skill: PROTECTION, or another one
const PROTECTION_SKILL = 1;

// Skill_Flags MULTIPUSH, and MULTIPUSH with SINGLE_PUSH
const MULTIPUSH_FLAG = 1;
const PUSH_FLAGS = 3;

// the bits of the walk layers whose hero pushes, in a cell's visited layers
export const PUSH_LAYER_BITS = 1 | (1 << MULTI_PUSH);

/** Whether a hero in walk layer `layer` pushes. */
export function pushes(layer: number): boolean {
    return layer === 0 || layer === MULTI_PUSH;
}

/** A seed of a flood: a cell (walk layer 0) or a cell and its walk layer. */
export type LayeredCell = [cell: number, layer: number];

// A Wardrobe door is the cell edge its +x axis points to: fire does not cross it; a hero leaving through it adds its
// skill (1 PROTECTION, 2 another) to the ones it has, in place of SINGLE_PUSH, and one entering through it gets the
// default skill back; the cell's other edges and vertical moves change nothing.

/** The skill of the Wardrobe door a hero leaving `cell` on side `side` passes; -1 when no door is there. */
export function doorOut(walkGrid: WalkGrid, cell: number, side: number): number {
    const wardrobe = walkGrid.wardrobes.get(cell);
    if (wardrobe?.[0] === side) return wardrobe[1];
    return -1;
}

/** The skill of the Wardrobe door a hero entering `cell` from side `side` passes; -1 when no door is there. */
export function doorIn(walkGrid: WalkGrid, cell: number, side: number): number {
    const wardrobe = walkGrid.wardrobes.get(cell);
    if (wardrobe?.[0] === (side + 2) % 4) return wardrobe[1];
    return -1;
}

/** A Wardrobe of the level data inside the grid: its cell, door side and skill, level-data existence and kind. */
export interface WardrobeCell {
    pid: number;
    cell: number;
    side: number;
    skill: number;
    existence: number | undefined;
    teleport: boolean;
    charm: boolean;
    transmute: boolean;
    push: boolean;
    multipush: boolean;
    rod: boolean;
}

/** The Wardrobes of the level data whose cell lies inside the grid, in list order. */
export function levelWardrobes(shape: GridShape, world: World): WardrobeCell[] {
    const teleportPids = new Set(world.teleport || []);
    const charmPids = new Set(world.charm || []);
    const transmutePids = new Set(world.transmute || []);
    const pushPids = new Set(world.push || []);
    const multipushPids = new Set(world.multipush || []);
    const rodPids = new Set(world.rod || []);
    const wardrobes: WardrobeCell[] = [];

    for (const [pid, i, j, z, side, skill, existence] of world.wardrobes || []) {
        const cell = keyOf(shape, i, j, z);
        if (cell < 0) continue;

        const teleport = teleportPids.has(pid);
        const charm = charmPids.has(pid);
        const transmute = transmutePids.has(pid);
        const push = pushPids.has(pid);
        const multipush = multipushPids.has(pid);
        const rod = rodPids.has(pid);
        wardrobes.push({ pid, cell, side, skill, existence, teleport, charm, transmute, push, multipush, rod });
    }

    return wardrobes;
}

/** Collects the existing Wardrobes: per cell, its [door side, skill]. */
export function placeWardrobes(walkGrid: WalkGrid): void {
    for (const { pid, cell, side, skill, existence } of walkGrid.geometry.wardrobes) {
        if (exists(walkGrid, pid, existence)) walkGrid.wardrobes.set(cell, [side, skill]);
    }
}

/** Collects the cells of the existing TELEPORT Wardrobes. */
export function placeTeleportDoors(walkGrid: WalkGrid): void {
    for (const { cell, teleport } of walkGrid.geometry.wardrobes) {
        if (teleport && walkGrid.wardrobes.has(cell)) walkGrid.teleportDoors.add(cell);
    }
}

/** Collects the cells of the existing CHARM Wardrobes. */
export function placeCharmDoors(walkGrid: WalkGrid): void {
    for (const { cell, charm } of walkGrid.geometry.wardrobes) {
        if (charm && walkGrid.wardrobes.has(cell)) walkGrid.charmDoors.add(cell);
    }
}

/** Whether the current hero holds CHARM in the latest skill_flags. */
export function heroHoldsCharm(walkGrid: WalkGrid): boolean {
    const guy = walkGrid.world.guy;
    const skills = walkGrid.latest.get(guy?.[0], 'skill_flags');
    return skills !== undefined && (rawU32(skills) & CHARM_FLAG) !== 0;
}

/** Whether a hero leaving `cell` on side `side` passes the door of a CHARM Wardrobe. */
export function leavesByCharmDoor(walkGrid: WalkGrid, cell: number, side: number): boolean {
    if (!walkGrid.charmDoors.has(cell)) return false;
    return walkGrid.wardrobes.get(cell)?.[0] === side;
}

/**
 * Whether a flood starts with a hero who holds CHARM: the current hero does, or the cells the flood stays `outside` of
 * hold a CHARM Wardrobe, whose door the hero left on the way to the cells he stands in.
 */
export function startsWithCharm(walkGrid: WalkGrid, outside: Set<number> | null): boolean {
    if (walkGrid.charmHero) return true;
    if (!outside) return false;

    for (const cell of walkGrid.charmDoors) {
        if (outside.has(cell)) return true;
    }

    return false;
}

/** Collects the cells of the existing Wardrobes that give the Rod. */
export function placeRodDoors(walkGrid: WalkGrid): void {
    for (const { cell, rod } of walkGrid.geometry.wardrobes) {
        if (rod && walkGrid.wardrobes.has(cell)) walkGrid.rodDoors.add(cell);
    }
}

/** Whether the current hero holds the Rod in the latest inventory_flags. */
export function heroHoldsRod(walkGrid: WalkGrid): boolean {
    const guy = walkGrid.world.guy;
    const inventory = walkGrid.latest.get(guy?.[0], 'inventory_flags');
    return inventory !== undefined && (rawU32(inventory) & WAND_FLAG) !== 0;
}

/** Whether a hero leaving `cell` on side `side` passes the door of a Wardrobe that gives the Rod. */
export function leavesByRodDoor(walkGrid: WalkGrid, cell: number, side: number): boolean {
    if (!walkGrid.rodDoors.has(cell)) return false;
    return walkGrid.wardrobes.get(cell)?.[0] === side;
}

/**
 * Whether a flood starts with a hero who holds the Rod: the current hero does, or the cells the flood stays `outside`
 * of hold a Wardrobe that gives it, whose door the hero left on the way to the cells he stands in.
 */
export function startsWithRod(walkGrid: WalkGrid, outside: Set<number> | null): boolean {
    if (walkGrid.rodHero) return true;
    if (!outside) return false;

    for (const cell of walkGrid.rodDoors) {
        if (outside.has(cell)) return true;
    }

    return false;
}

/** Collects the cells of the existing TRANSMUTE Wardrobes. */
export function placeTransmuteDoors(walkGrid: WalkGrid): void {
    for (const { cell, transmute } of walkGrid.geometry.wardrobes) {
        if (transmute && walkGrid.wardrobes.has(cell)) walkGrid.transmuteDoors.add(cell);
    }
}

/** Collects the cells of the existing Wardrobes that give SINGLE_PUSH, and of those that give MULTIPUSH. */
export function placePushDoors(walkGrid: WalkGrid): void {
    for (const { cell, push, multipush } of walkGrid.geometry.wardrobes) {
        if (!walkGrid.wardrobes.has(cell)) continue;
        if (push) walkGrid.pushDoors.add(cell);
        if (multipush) walkGrid.multipushDoors.add(cell);
    }
}

/** The current hero's walk layer, from the latest skill_flags (else the level data's PROTECTION). */
export function heroLayerOf(walkGrid: WalkGrid): number {
    const guy = walkGrid.world.guy;
    const skills = walkGrid.latest.get(guy?.[0], 'skill_flags');
    if (!skills) {
        if (guy?.[1]) return PROTECTED;
        return 0;
    }

    const skillBits = rawU32(skills);
    if (skillBits & PROTECTION_FLAG) return PROTECTED;
    if (skillBits & TELEPORT_FLAG) return WIZARD;

    const transmutes = (skillBits & TRANSMUTE_FLAG) !== 0;
    const pushSkill = (skillBits & PUSH_FLAGS) !== 0;
    if (transmutes && !pushSkill) return TRANSMUTING;
    if (skillBits & MULTIPUSH_FLAG) return MULTI_PUSH;

    const charms = (skillBits & CHARM_FLAG) !== 0;
    if (!pushSkill && !charms) return NO_PUSH;

    return 0;
}

/**
 * The cell a hero with TELEPORT swaps into from `cell` along side `side`: the TELEPORT line runs at the cell's z,
 * crosses water and air, wraps with the grid (inside the fast-travel box at map-room z) and ends at the first target.
 * The line steps `stride` cells at a time, the hero's powered move: it tests only the cells at multiples of the stride.
 * -1 when it ends at a solid voxel (none for a hero who stands in a THROUGH beam), a Tree, Sign, Treasure_Display or
 * Judge (a solid beam stop, which ends it in a THROUGH beam too), a shut Gate, a frozen cell, a Mirror met on an open side (the line turns there; the turn is not modelled), a
 * Wardrobe door edge, or back at the cell. A Mirror met on its back or a closed side is a target like any other.
 */
export function swapCell(
    walkGrid: WalkGrid,
    floodState: FloodState,
    cell: number,
    side: number,
    stride: number,
): number {
    const { width, height, grid, marks, cellFlags, mirrorSides, swapTargets } = walkGrid;
    const enteredSide = (side + 2) % 4;
    const throughWalls = (cellFlags[cell] & BEAM) !== 0;
    let previous = cell;
    let next = cellsOnSide(walkGrid, cell, side, stride);

    for (let stepsTaken = 0; stepsTaken < width + height && next !== cell; stepsTaken++) {
        if (marks[next] & FROZEN_MARK) return -1;

        if (grid[next] & SOLID) {
            const standingBlocker = (grid[next] & BEAMSTOP) !== 0;
            if (!throughWalls || standingBlocker) return -1;
        } else if (blocked(walkGrid, floodState, next)) {
            return -1;
        }

        if ((marks[previous] | marks[next]) & WARDROBE_MARK) {
            if (doorOut(walkGrid, previous, side) >= 0 || doorIn(walkGrid, next, side) >= 0) return -1;
        }

        if (cellFlags[next] & LINE_STOP) {
            if (swapTargets.has(next)) return next;

            const openSides = mirrorSides.get(next);
            if (openSides !== undefined) {
                if (openSides & (1 << enteredSide)) return -1;
                return next;
            }
        }

        previous = next;
        next = cellsOnSide(walkGrid, next, side, stride);
    }

    return -1;
}

/** The current hero's seed: the cell the hero stands in at `position` (-1 inside a wall), and the walk layer. */
export function heroSeed(walkGrid: WalkGrid, position: Position): LayeredCell {
    const cell = cellOf(walkGrid, ...position);
    const heroLayer = walkGrid.heroLayer;
    if (heroLayer === PROTECTED && walkGrid.attacked.has(cell)) return [cell, PROTECTED];
    if (insideWall(walkGrid, cell)) return [-1, heroLayer];
    return [land(walkGrid, walkGrid.noFlood, cell, false), heroLayer];
}

/**
 * The walk layer after a step from `cell` on side `side` into `next`: a hero leaving a Wardrobe by its door takes its
 * skill (PROTECTION, TELEPORT, or another one on top of its own) in place of SINGLE_PUSH, so he keeps a push only from
 * MULTIPUSH or the door's own push skill; one entering a Wardrobe by its door gets the default skill (SINGLE_PUSH)
 * back.
 */
export function layerAfterStep(walkGrid: WalkGrid, cell: number, side: number, next: number, layer: number): number {
    const marks = walkGrid.marks;
    if (!((marks[cell] | marks[next]) & WARDROBE_MARK)) return layer;

    const skillOut = doorOut(walkGrid, cell, side);
    if (skillOut === PROTECTION_SKILL) return PROTECTED;
    if (skillOut > PROTECTION_SKILL) {
        if (walkGrid.teleportDoors.has(cell)) return WIZARD;

        const plainHero = layer === 0 || layer === NO_PUSH;
        if (plainHero && walkGrid.transmuteDoors.has(cell)) return TRANSMUTING;
        if (walkGrid.multipushDoors.has(cell)) {
            if (plainHero) return MULTI_PUSH;
            return layer;
        }
        if (walkGrid.pushDoors.has(cell)) {
            if (layer === NO_PUSH) return 0;
            return layer;
        }
        if (layer === 0 && !walkGrid.charmDoors.has(cell)) return NO_PUSH;
        return layer;
    }

    if (doorIn(walkGrid, next, side) > 0) return 0;
    return layer;
}
