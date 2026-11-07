// Level roles from the walk on the level data (VIEWER.md "Level roles (viewer)"). Imported by scripts/build-walk.ts, so
// it must not import src/walk-data.ts, which reads the file that script writes.
import { PROG, WORLD } from '../data.ts';
import type { Position } from '../types.ts';
import { addTo, DIRS } from '../walk/cells.ts';
import { ICE } from '../walk/freezers.ts';
import { NO_HISTORY } from '../walk/reachability.ts';
import { teleporterStatesOf } from '../walk/teleporters.ts';
import { walker } from '../walk/walker.ts';
import type { StoredRoles } from '../walk-data.ts';
import { optionCount } from './unlocking.ts';

/**
 * Level roles (VIEWER.md "Level roles (viewer)"): the walk on the level data from a new game's start, opening the closed
 * Freezers on the edge of the reached cells in rounds. need: 2 Required, 1 Required as one of several, 0 Optional, per
 * level ('l') and Freezer ('g'); bg: the Freezers each sits behind.
 */
export function staticRoles(): StoredRoles | null {
    const levels = PROG.levels;
    const freezers = PROG.freezers;
    const start = PROG.fog?.start;
    if (!start?.hero || !PROG.world || !WORLD) return null;

    const { flood, land, cellOf, neighbourOf, frozen, thaw, freeze, layerCells } = walker(
        NO_HISTORY,
        teleporterStatesOf(null),
        freezers.map(() => true),
    );
    const gateCells = new Map([...frozen].map(([cell, freezerIndex]): [number, number] => [freezerIndex, cell]));
    const pins = new Map(PROG.world.area_pins.map(([pid, ...position]): [number, Position] => [pid, position]));
    const startPins = (start.pins || []).filter((pid) => pins.has(pid));
    const seeds = [land(cellOf(...start.hero)), ...startPins.map((pid) => land(cellOf(...pins.get(pid)!), false))];
    const inside = (cells: Set<number>, cell: number) => cells.has(cell) || cells.has(land(cell));
    const levelCells = levels.map((level) => cellOf(...level.p));

    let front = new Set<number>();
    const reached = flood(seeds, null, front);
    const levelGates = new Map<number, number[]>();
    const gatesBehindGate = new Map([...front].map((gate): [number, number[]] => [gate, []]));

    // a level frozen in a Freezer sits behind that Freezer alone, whatever the walk reaches next to it
    levels.forEach((level, i) => {
        const frozenIn = ICE[i];
        if (frozenIn !== undefined) {
            levelGates.set(i, [frozenIn]);
        } else if (inside(reached, levelCells[i])) {
            levelGates.set(i, []);
        }
    });

    const opens = new Map<number, number>();
    const bumpedInRound = new Map([...front].map((gate): [number, number] => [gate, 0]));
    const snapshots = [new Set(reached)];

    while (front.size) {
        const roundGates = [...front].toSorted((first, second) => freezers[first].pid - freezers[second].pid);
        const alone = new Map<number, { cells: Set<number>; bumped: Set<number> }>();
        for (const gate of roundGates) {
            const gateCell = gateCells.get(gate)!;
            thaw(gateCell);
            const bumped = new Set<number>();
            alone.set(gate, { cells: flood([land(gateCell)], reached, bumped), bumped });
            freeze(gateCell, gate);
        }
        for (const gate of roundGates) thaw(gateCells.get(gate)!);

        front = new Set();
        const roundCells = flood(
            roundGates.map((gate) => land(gateCells.get(gate)!)),
            reached,
            front,
        );

        // what no gate reaches alone is behind every gate of the round
        const orRound = (gates: number[]) => (gates.length ? gates : roundGates);
        levels.forEach((level, i) => {
            if (levelGates.has(i) || !inside(roundCells, levelCells[i])) return;
            const reachingGates = roundGates.filter((gate) => inside(alone.get(gate)!.cells, levelCells[i]));
            levelGates.set(i, orRound(reachingGates));
        });
        for (const frontGate of front) {
            if (gatesBehindGate.has(frontGate)) continue;
            const bumpingGates = roundGates.filter((gate) => alone.get(gate)!.bumped.has(frontGate));
            gatesBehindGate.set(frontGate, orRound(bumpingGates));
        }

        const gateColumns = new Set(roundGates.map((gate) => gateCells.get(gate)! % layerCells));
        for (const cell of roundCells) {
            if (gateColumns.has(cell % layerCells)) continue;
            const reachingGates = orRound(roundGates.filter((gate) => alone.get(gate)!.cells.has(cell)));
            const strength = reachingGates.length === 1 ? 2 : 1;
            for (const gate of reachingGates) opens.set(gate, Math.max(opens.get(gate) || 0, strength));
        }

        for (const cell of roundCells) reached.add(cell);
        for (const frontGate of front) {
            if (!bumpedInRound.has(frontGate)) bumpedInRound.set(frontGate, snapshots.length);
        }
        snapshots.push(new Set(reached));
    }

    const cellsByColumn = new Map<number, number[]>();
    for (const cell of reached) addTo(cellsByColumn, cell % layerCells, cell);

    // one move from one cell to another without passing other reached cells
    const step = (fromCell: number, toCell: number) => {
        const removedFrom = reached.delete(fromCell);
        const removedTo = reached.delete(toCell);
        const hit = flood([fromCell], reached).has(toCell);
        if (removedFrom) reached.add(fromCell);
        if (removedTo) reached.add(toCell);
        return hit;
    };

    // whether the walk reached cells on both sides of the gate's cell, in a round that had it, and can cross it
    const crossable = (gateCell: number, round: number): boolean => {
        if (gateCell < 0) return false;

        const cellsBeside = (dx: number, dy: number) =>
            cellsByColumn.get(neighbourOf(gateCell, dx, dy) % layerCells) || [];
        for (const [dx, dy] of DIRS) {
            for (const before of cellsBeside(dx, dy)) {
                if (!snapshots[round].has(before) || !step(before, gateCell)) continue;
                if (cellsBeside(-dx, -dy).some((after) => step(gateCell, after))) return true;
            }
        }
        return false;
    };

    for (const [gate, round] of bumpedInRound) {
        if (opens.has(gate)) continue;

        const gateCell = land(gateCells.get(gate)!);
        if (!crossable(gateCell, round)) opens.set(gate, 2);
    }

    const sorted = (indices: number[] | undefined) => (indices || []).toSorted((first, second) => first - second);
    const behind = {
        l: levels.map((level, i) => sorted(levelGates.get(i))),
        g: freezers.map((freezer, freezerIndex) => sorted(gatesBehindGate.get(freezerIndex))),
    };

    const need = { l: new Uint8Array(levels.length), g: new Uint8Array(freezers.length) };
    const todo: Array<['l' | 'g', number]> = [];
    const mark = (kind: 'l' | 'g', index: number, strong: boolean) => {
        const value = strong ? 2 : 1;
        if (need[kind][index] < value) {
            need[kind][index] = value;
            todo.push([kind, index]);
        }
    };

    // a tower needs N of its M normal levels, so each is one of several unless it needs them all
    const towerNeedsAll = new Map(
        PROG.towers.map((tower): [number, boolean] => {
            const normalLevels = levels.filter((level) => level.t === tower.t && !level.d);
            return [tower.t, tower.req >= normalLevels.length];
        }),
    );
    levels.forEach((level, i) => {
        if (level.a) {
            mark('l', i, true);
        } else if (level.t && !level.d) {
            mark('l', i, !!towerNeedsAll.get(level.t));
        }
    });

    // a gate the walk never reaches may guard anything
    freezers.forEach((freezer, freezerIndex) => {
        const value = gatesBehindGate.has(freezerIndex) ? opens.get(freezerIndex) || 0 : 2;
        if (value) mark('g', freezerIndex, value === 2);
    });

    while (todo.length) {
        const [kind, index] = todo.pop()!;
        const strong = need[kind][index] === 2;
        const node = kind === 'l' ? levels[index] : freezers[index];
        const sittingBehind = behind[kind][index];
        const many = node.or && optionCount(node) > 1;

        // the table's needs of a level replace its requirements; a level enabled in the level data is otherwise open
        // whatever its requirements
        const tableNeeds = kind === 'l' ? levels[index].needs : undefined;
        const enabledLevel = kind === 'l' && !!levels[index].en;
        if (tableNeeds) {
            for (const group of tableNeeds) {
                for (const option of group) {
                    if ('level' in option) mark('l', option.level, strong && group.length === 1);
                }
            }
        } else if (!enabledLevel) {
            for (const required of node.req) mark('l', required, strong && !many);
        }
        for (const gate of sittingBehind) mark('g', gate, strong && sittingBehind.length === 1);
    }

    return { need, bg: behind };
}
