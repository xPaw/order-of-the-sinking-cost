// Dragon fire and goblin attacks (movement.md "Goblins, dragons and PROTECTION", viewer.md "Attacks")
import { latestF32 } from '../save.ts';
import { addTo, cellOnSide, FIRE, FIRE_STOP, FLOOR, mod, MONSTER, SOLID } from './cells.ts';
import { exists, place, put } from './groups.ts';
import { doorIn, doorOut } from './skills.ts';
import type { WalkGrid } from './walker.ts';
import { fenced, latestCell, noteTarget } from './walls.ts';

// world.monsters kinds below the dragons' facing sides
export const GOBLIN = -1;

/** Marks `cell` attacked, and counts the attack. */
function attack(walkGrid: WalkGrid, cell: number): void {
    walkGrid.attacked.add(cell);
    walkGrid.cellFlags[cell] |= FIRE;
    walkGrid.attackCount.set(cell, (walkGrid.attackCount.get(cell) ?? 0) + 1);
}

/**
 * Whether a goblin or a dragon's fire attacks `cell`. A hero who steps into it dies in that turn's attack unless he is
 * protected, so a push that moves him into the cell the object leaves is no push for a hero without PROTECTION.
 */
export function attackedAt(walkGrid: WalkGrid, cell: number): boolean {
    return (walkGrid.cellFlags[cell] & FIRE) !== 0;
}

/** A goblin's facing: GOBLIN; a dragon's: its facing side, from its latest theta_target, else the level data's. */
function foeFacing(walkGrid: WalkGrid, pid: number, kind: number): number {
    if (kind < 0) return GOBLIN;
    const theta = latestF32(walkGrid.latest, pid, 'base.theta_target');
    if (theta !== undefined) return mod(Math.round(theta / 90), 4);
    return kind;
}

/**
 * A goblin attacks its own cell and the 6 cells next to it, above and below included. A Fence on the edge to a cell
 * spares it (a floor Fence, for the cells above and below), unless the goblin stands in a SQUEEZE beam; a cell inside a
 * wall is spared unless the goblin stands in a THROUGH beam. Walls, Gates and Monsters beside the goblin shield nothing.
 */
function goblinAttacks(walkGrid: WalkGrid, goblinCell: number): void {
    const { grid, layerCells, squeezeCells, throughBeam } = walkGrid;
    const squeezes = squeezeCells.has(goblinCell);
    const passesWalls = throughBeam.has(goblinCell);
    const targets: number[] = [goblinCell];

    for (let side = 0; side < 4; side++) {
        const target = cellOnSide(walkGrid, goblinCell, side);
        if (squeezes || !fenced(walkGrid, goblinCell, side, target)) targets.push(target);
    }

    const above = goblinCell + layerCells;
    if (squeezes || !(grid[above] & FLOOR)) targets.push(above);

    const below = goblinCell - layerCells;
    if (squeezes || !(grid[goblinCell] & FLOOR)) targets.push(below);

    for (const target of targets) {
        const insideGrid = target >= 0 && target < grid.length;
        if (!insideGrid) continue;
        const insideWall = (grid[target] & SOLID) !== 0;
        if (insideWall && !passesWalls) continue;

        attack(walkGrid, target);
    }
}

/**
 * A dragon's fire runs from its cell along its facing until a FIRE_STOP, a closed Freezer or a Wardrobe door. Returns
 * the cells it runs through.
 */
function dragonFire(walkGrid: WalkGrid, dragonCell: number, side: number): number[] {
    const { grid, frozen, width, height } = walkGrid;
    const cells: number[] = [];
    let cell = dragonCell;

    for (let stepsLeft = width + height; stepsLeft > 0; stepsLeft--) {
        const next = cellOnSide(walkGrid, cell, side);
        if (next === dragonCell) break;
        if (doorOut(walkGrid, cell, side) >= 0 || doorIn(walkGrid, next, side) >= 0) break;
        if (grid[next] & FIRE_STOP || frozen.has(next)) break;
        attack(walkGrid, next);
        walkGrid.burning.add(next);
        cells.push(next);
        cell = next;
    }

    return cells;
}

/**
 * Places the living Monsters, which stop fire and are pushed. Their attacks are cast by recastAttacks once the beams
 * are cast, since a goblin's SQUEEZE and THROUGH beams change what it attacks.
 */
export function placeAttacks(walkGrid: WalkGrid): void {
    const { world, grid, latest } = walkGrid;

    for (const [pid, i, j, z, kind, existence] of world.monsters || []) {
        const cell = latestCell(walkGrid, pid, i, j, z);
        if (cell < 0 || latestF32(latest, pid, 'dead_t', 0) > 0) continue;

        // a Monster that a Group makes exist blocks its cell; its attacks are left out
        if (!exists(walkGrid, pid, existence)) {
            place(walkGrid, pid, existence, () => put(walkGrid, grid, cell, MONSTER));
            continue;
        }

        grid[cell] |= MONSTER;
        noteTarget(walkGrid, cell);

        let facing = kind;
        if (kind >= GOBLIN) facing = foeFacing(walkGrid, pid, kind);

        walkGrid.monsters.push({ pid, cell, facing });
    }
}

/** Runs the attacks of the goblins and dragons `foes` (their cell, facing and index into `monsters`). */
function castAttacks(walkGrid: WalkGrid, foes: Array<[cell: number, facing: number, monsterIndex: number]>): void {
    for (const [foeCell, facing, monsterIndex] of foes) {
        if (facing === GOBLIN) {
            goblinAttacks(walkGrid, foeCell);
            continue;
        }

        const fireCells = dragonFire(walkGrid, foeCell, facing);
        walkGrid.fireOf.set(monsterIndex, fireCells);
        for (const fireCell of fireCells) addTo(walkGrid.burningBy, fireCell, monsterIndex);
    }
}

/**
 * Works out the attacks of the living goblins and dragons again, for the Freezers and objects as the grid has them now:
 * a dragon's fire runs through a Freezer that is open and stops at one that is closed.
 */
export function recastAttacks(walkGrid: WalkGrid): void {
    for (const cell of walkGrid.attacked) walkGrid.cellFlags[cell] &= ~FIRE;

    walkGrid.attacked.clear();
    walkGrid.burning.clear();
    walkGrid.burningBy.clear();
    walkGrid.fireOf.clear();
    walkGrid.attackCount.clear();

    const foes: Array<[cell: number, facing: number, monsterIndex: number]> = [];

    walkGrid.monsters.forEach(({ cell, facing }, monsterIndex) => {
        if (facing >= GOBLIN) foes.push([cell, facing, monsterIndex]);
    });

    castAttacks(walkGrid, foes);
}
