// Rock and Gem bridges: a Rock or a spare Gem pushed into water sinks and holds the hero up (movement.md "Objects in
// water")
import { addTo } from './cells.ts';
import { GEM_KIND } from './beams.ts';
import type { FloodState } from './flood.ts';
import { requeue, visitReached } from './queue.ts';
import { respawnedRocksOf } from './rock-turns.ts';
import type { WalkGrid } from './walker.ts';
import { latestCell } from './walls.ts';

/** One way to push a Rock into water: the hero's push cell and the water cell the Rock sinks in. */
export type BridgeWay = [pushCell: number, waterCell: number];

/** Collects the ways to push each Rock (or Gem) of `unmovedRocks`, still at its level-data cell, into water. */
export function placeBridges(walkGrid: WalkGrid, unmovedRocks: Set<number>): void {
    for (const { pid, pushCell, waterCell } of walkGrid.geometry.bridges) {
        if (!unmovedRocks.has(pid)) continue;
        addTo(walkGrid.bridgesOf, pid, [pushCell, waterCell]);
        walkGrid.bridgeWater.add(waterCell);
    }
}

/**
 * Collects the ways to push each Rock a Spawner respawns at its level-data cell, which the save left elsewhere, into
 * water: they hold once the flood reaches one of the Rock's Activators (`respawnActivators`).
 */
export function placeRespawnBridges(walkGrid: WalkGrid): void {
    const { world, geometry, respawnActivators } = walkGrid;
    const levelCellOf = new Map<number, number>();
    world.rocks.forEach(([pid], index) => levelCellOf.set(pid, geometry.rockCells[index]));

    for (const { pid, cell, activators } of respawnedRocksOf(walkGrid)) {
        if (cell !== levelCellOf.get(pid) || !activators) continue;

        for (const bridge of geometry.bridges) {
            if (bridge.pid !== pid) continue;
            addTo(walkGrid.bridgesOf, pid, [bridge.pushCell, bridge.waterCell]);
            walkGrid.bridgeWater.add(bridge.waterCell);
            respawnActivators.set(pid, activators);
        }
    }
}

/** Whether the bridge `bridgeIndex` may sink: a respawned Rock's bridge waits for one of its Activators. */
function bridgeReleased(walkGrid: WalkGrid, bridgeIndex: number): boolean {
    const activators = walkGrid.triggers.bridgeAfter.get(bridgeIndex);
    if (!activators) return true;

    return activators.some((activatorCell) => walkGrid.visited[activatorCell] !== 0);
}

/**
 * Lets the spare Gems (BeamMoves.spareGems) sink like Rocks: they join the Rocks whose pushes may turn, and the ones
 * still at their level-data cell get their straight bridges. Needs the beam moves laid out.
 */
export function placeGemBridges(walkGrid: WalkGrid): void {
    const { world, geometry, rocks } = walkGrid;
    const { spareGems } = walkGrid.beamMoves;
    const unmovedGems = new Set<number>();

    (world.movables || []).forEach(([pid, column, row, z, kind], index) => {
        if (kind !== GEM_KIND || !spareGems.has(pid)) return;

        const cell = latestCell(walkGrid, pid, column, row, z);
        if (cell < 0) return;

        rocks.push({ pid, cell });
        if (cell === geometry.movableCells[index]) unmovedGems.add(pid);
    });

    placeBridges(walkGrid, unmovedGems);
}

/**
 * Sinks the Rocks whose push cell the walk has reached into their water cell, which then holds the hero; the Rocks
 * go in bridge order, each by its first way whose push cell is reached. A respawned Rock sinks once an Activator of
 * its is reached as well, whichever of the two the walk reaches last. Returns whether any Rock sank.
 */
export function sink(walkGrid: WalkGrid, floodState: FloodState): boolean {
    const { triggers, visited } = walkGrid;
    const { bridgeTaken, bridgesDue } = floodState;

    const takeIfDue = (bridgeIndex: number): void => {
        if (bridgeTaken[bridgeIndex] || !bridgeReleased(walkGrid, bridgeIndex)) return;

        const [, ways] = triggers.bridges[bridgeIndex];
        if (!ways.some(([pushCell]) => visited[pushCell])) return;

        bridgeTaken[bridgeIndex] = 1;
        bridgesDue.push(bridgeIndex);
    };

    visitReached(floodState, floodState.sinkCursor, (cell) => {
        for (const bridgeIndex of triggers.bridgesAt.get(cell) || []) takeIfDue(bridgeIndex);
        for (const bridgeIndex of triggers.bridgesAfterAt.get(cell) || []) takeIfDue(bridgeIndex);
    });

    if (!bridgesDue.length) return false;

    bridgesDue.sort((first, second) => first - second);

    for (const bridgeIndex of bridgesDue) {
        const [, ways] = triggers.bridges[bridgeIndex];
        const way = ways.find(([pushCell]) => visited[pushCell]);
        if (!way) throw new Error('a bridge came due without a reached push cell');
        const [, waterCell] = way;
        floodState.bridged.add(waterCell);
        requeue(walkGrid, floodState, waterCell);
    }

    bridgesDue.length = 0;
    return true;
}
