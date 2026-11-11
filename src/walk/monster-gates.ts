// Monster Gates: a shut monster Gate opens once no living Monster stands in its room (movement.md "Gates, switches and
// buttons", viewer.md "Moves")
import { GOBLIN } from './attacks.ts';
import { roomOf } from './beams.ts';
import { addTo, cellOnSide, SIDES } from './cells.ts';
import type { FloodState } from './flood.ts';
import { pushedToDeath } from './monster-pushes.ts';
import { requeue, visitReached } from './queue.ts';
import type { WalkGrid } from './walker.ts';

/**
 * A living Monster that exists: its pid, the cell the save last left it in and its facing: the side a dragon breathes
 * fire to, -1 for a goblin, -2 for any other Monster.
 */
export interface RoomMonster {
    pid: number;
    cell: number;
    facing: number;
}

/** A shut monster Gate and the Monsters (indices into the walker's `monsters`) that hold it shut. */
export interface MonsterGate {
    gateCell: number;
    monsters: number[];
}

/**
 * The monster Gates the walk can open, with the Monsters of their rooms, and the Monsters indexed by the cells beside
 * them (`monstersAt`) and by their own cell (`monsterAt`). `goblinAt`: every goblin of the walker by its own cell, in
 * a gate's room or not. `monsterCount`: how many Monsters the walker has; `killers`: the ways the walker was built to
 * get rid of one.
 */
export interface MonsterGates {
    gates: MonsterGate[];
    monstersAt: Map<number, number[]>;
    monsterAt: Map<number, number>;
    goblinAt: Map<number, number>;
    monsterCount: number;
    killers: Killer[];
}

/**
 * Whether the walk gets rid of the Monster `monsterIndex` in the flood. A killer is asked again whenever a cell beside
 * the Monster is reached or the flood moves on, and keeps its own record of what it has ruled out.
 */
export type Killer = (walkGrid: WalkGrid, floodState: FloodState, monsterIndex: number) => boolean;

/** The ways the walk gets rid of a Monster. */
function killers(): Killer[] {
    return [pushedToDeath];
}

/** No monster Gates. */
export const NO_MONSTER_GATES: MonsterGates = {
    gates: [],
    monstersAt: new Map(),
    monsterAt: new Map(),
    goblinAt: new Map(),
    monsterCount: 0,
    killers: [],
};

/** The shut monster Gates whose room holds a living Monster. */
export function monsterGatesOf(walkGrid: WalkGrid): MonsterGates {
    const { monsters, monsterGateCells } = walkGrid;
    const roomsOfMonsters = monsters.map(({ cell }) => roomOf(walkGrid, cell));
    const gates: MonsterGate[] = [];
    const monstersAt = new Map<number, number[]>();
    const monsterAt = new Map<number, number>();
    const goblinAt = new Map<number, number>();

    monsters.forEach(({ cell, facing }, monsterIndex) => {
        if (facing === GOBLIN) goblinAt.set(cell, monsterIndex);
    });

    for (const gateCell of monsterGateCells) {
        const room = roomOf(walkGrid, gateCell);
        const inRoom: number[] = [];

        roomsOfMonsters.forEach((monsterRoom, monsterIndex) => {
            if (monsterRoom === room) inRoom.push(monsterIndex);
        });

        if (inRoom.length === 0) continue;
        gates.push({ gateCell, monsters: inRoom });

        for (const monsterIndex of inRoom) {
            const monsterCell = monsters[monsterIndex].cell;
            monsterAt.set(monsterCell, monsterIndex);
            for (const side of SIDES) addTo(monstersAt, cellOnSide(walkGrid, monsterCell, side), monsterIndex);
        }
    }

    return { gates, monstersAt, monsterAt, goblinAt, monsterCount: monsters.length, killers: killers() };
}

/**
 * Opens the monster Gates whose Monsters are all gone, once a hero reaches a cell beside one of them: each Monster a
 * reached cell is beside is asked of every killer, and a Gate opens for the rest of the flood when every Monster of its
 * room is gone. Returns whether any Gate opened.
 */
export function openMonsterGates(walkGrid: WalkGrid, floodState: FloodState): boolean {
    const { monsterGates } = walkGrid.triggers;
    const { monsterSeen, monstersDue, monsterGone } = floodState;

    visitReached(floodState, floodState.monsterCursor, (cell) => {
        for (const monsterIndex of monsterGates.monstersAt.get(cell) || []) {
            if (monsterSeen[monsterIndex]) continue;

            monsterSeen[monsterIndex] = 1;
            monstersDue.push(monsterIndex);
        }
    });

    for (const monsterIndex of monstersDue) {
        if (monsterGone[monsterIndex]) continue;

        for (const killer of monsterGates.killers) {
            if (killer(walkGrid, floodState, monsterIndex)) {
                monsterGone[monsterIndex] = 1;
                break;
            }
        }
    }

    let opened = false;

    for (const { gateCell, monsters } of monsterGates.gates) {
        if (floodState.unlatched.has(gateCell)) continue;
        if (!monsters.every((monsterIndex) => monsterGone[monsterIndex])) continue;

        floodState.unlatched.add(gateCell);
        requeue(walkGrid, floodState, gateCell);
        opened = true;
    }

    return opened;
}
