// The room answers against the walk's own searches, which run on a walker built without the answers. What those searches
// find from the start region of a room (the Rocks' bridges, the objects that reach the Switches and the Gem_Slots, the
// Monsters that die) is held by the answer of the room: the stored one (data/walk.json `rooms`) in a room the save leaves
// as the level data has it, else the one searched on the walker's own grid. The Rocks the room search does not push are
// left out: a crystal Rock and a Rock a Spawner puts back stand in no cell of the grid it searches, and a skipping stone
// it pushes into water makes no bridge. The live searches take every cell of the start region as a push cell for every
// push of a Rock, where the room search walks the hero over the cells as the earlier pushes left them, so a bridge the
// answer lacks passes when the Rock pushed alone, as the room search pushes it, never sinks there.
import { beforeAll, describe, expect, test } from 'vitest';
import { freshCampaign, walkLoaded } from '../scripts/lib/walk-fingerprint.ts';
import type { Campaign } from '../scripts/lib/walk-fingerprint.ts';
import { PROG } from '../src/data.ts';
import { DEMO_STATUS, demoHistory } from '../src/demo-save.ts';
import { computeProgress, setProgressCache } from '../src/model/progress.ts';
import type { ProgressStatus } from '../src/model/progress.ts';
import type { History, LatestValues } from '../src/save.ts';
import { attackedAt } from '../src/walk/attacks.ts';
import { cellOnSide, MONSTER, MOVABLE, ROCK, SUPPORT, Z_BIAS } from '../src/walk/cells.ts';
import { newFloodState } from '../src/walk/flood.ts';
import { bringObjectOnto, walled } from '../src/walk/gates.ts';
import type { PressMiss } from '../src/walk/gates.ts';
import { pushedToDeath } from '../src/walk/monster-pushes.ts';
import { NO_HISTORY } from '../src/walk/reachability.ts';
import { landingOf, sinkOf } from '../src/walk/rock-turns.ts';
import type { Landing } from '../src/walk/rock-turns.ts';
import { boundaryFreezers, roomAnswers, setRoomAnswers } from '../src/walk/room-answers.ts';
import type { RoomEntry, StoredRoom } from '../src/walk/room-answers.ts';
import { startRegion } from '../src/walk/room-search.ts';
import { holdsStone } from '../src/walk/support.ts';
import { teleporterStatesOf } from '../src/walk/teleporters.ts';
import type { TeleporterState } from '../src/walk/teleporters.ts';
import { buildWalkGrid } from '../src/walk/walker.ts';
import type { WalkGrid } from '../src/walk/walker.ts';
import { fenced } from '../src/walk/walls.ts';
import { RANK_ONE_SIGN_PID, syntheticCampaign, TOWER_SIGN_PID } from './fixtures.ts';

/** What a walker is built from: the save's latest values, the pads' states and the closed Freezers. */
interface WalkerState {
    latest: LatestValues;
    pads: TeleporterState[];
    closed: boolean[];
}

/** A room as the walker searched it on its own grid. */
interface SearchedRoom {
    cells: number[];
    entries: RoomEntry[];
}

/** What the live searches or the answers of a room hold, per kind. */
type RoomFinds<Values> = Pick<RoomEntry, 'dead'> & Record<'bridges' | 'holders' | 'filled', Map<number, Values>>;

const FIND_FIELDS = ['bridges', 'holders', 'filled'] as const;

function stateOf(status: ProgressStatus, history: History | null): WalkerState {
    setProgressCache(new WeakMap());
    const progress = computeProgress(status, history);
    return { latest: progress.lt ?? NO_HISTORY, pads: progress.tst, closed: progress.gateOpen.map((open) => !open) };
}

/** The entries of the rooms a walker may use. */
function usedEntries(walkGrid: WalkGrid): Set<RoomEntry> {
    const used = new Set<RoomEntry>();

    for (const entries of walkGrid.rooms.byCell.values()) {
        for (const entry of entries) used.add(entry);
    }

    return used;
}

/**
 * The rooms a walker searched on its own grid, as { cells, entries }: the entries in use that no stored answer holds,
 * with the cells of the room, ascending.
 */
function searchedRooms(walkGrid: WalkGrid, stored: StoredRoom[]): SearchedRoom[] {
    const storedEntries = new Set<RoomEntry>();

    for (const room of stored) {
        for (const entry of room.entries) storedEntries.add(entry);
    }

    const rooms = new Map<RoomEntry[], SearchedRoom>();

    for (const [cell, entries] of walkGrid.rooms.byCell) {
        if (storedEntries.has(entries[0])) continue;

        const room = rooms.get(entries);
        if (room) {
            room.cells.push(cell);
        } else {
            rooms.set(entries, { cells: [cell], entries });
        }
    }

    for (const room of rooms.values()) room.cells.sort((first, second) => first - second);

    return [...rooms.values()];
}

/** The fresh campaign with the Freezers of `freezerIndices` open, as the save's list of opened Freezers has them. */
function freshWithOpen(fresh: Campaign, freezerIndices: number[]): WalkerState {
    const openedFreezers = [...fresh.status.openedFreezers];
    for (const freezerIndex of freezerIndices) openedFreezers.push(PROG.freezers[freezerIndex].pid);

    return stateOf({ ...fresh.status, openedFreezers }, fresh.history);
}

/** How many bits of `mask` are set. */
function bitCount(mask: number): number {
    let count = 0;

    for (let rest = mask; rest > 0; rest >>= 1) count += rest & 1;

    return count;
}

interface OpenedCase {
    room: StoredRoom;
    state: WalkerState;
}

const openedCases = new Map<number, OpenedCase>();

/**
 * The fresh campaign with `count` of the Freezers around a stored room open, the room having an answer for exactly
 * that state and the campaign leaving it as the level data has it, so the answer is in use: { room, state }.
 */
function openedCase(stored: StoredRoom[], fresh: Campaign, count: number): OpenedCase {
    const known = openedCases.get(count);
    if (known) return known;

    const closed = stateOf(fresh.status, fresh.history);
    const geometry = buildWalkGrid(closed.latest, closed.pads, closed.closed).geometry;

    for (const room of stored) {
        if (room.entries.length === 0) continue;

        const around = boundaryFreezers(geometry, room.cells);

        for (const mask of room.opens) {
            if (bitCount(mask) !== count) continue;

            const freezers = around.filter((_, bit) => (mask >> bit) & 1);
            const state = freshWithOpen(fresh, freezers);
            const walkGrid = buildWalkGrid(state.latest, state.pads, state.closed);
            if (!usedEntries(walkGrid).has(room.entries[0])) continue;

            const found = { room, state };
            openedCases.set(count, found);
            return found;
        }
    }

    throw new Error(`no stored room has an answer in use with ${count} Freezers around it open`);
}

function inputs() {
    interface Input {
        name: string;
        state: () => WalkerState;
    }

    const everyPadOn = PROG.teleporters.map(() => ({ en: true, disc: true }));
    const allFreezersClosed = PROG.freezers.map(() => true);
    const fresh = freshCampaign();

    const list: Input[] = [
        { name: 'fresh campaign', state: () => stateOf(fresh.status, fresh.history) },
        ...[1, 2, 3].map((count) => ({
            name: `fresh campaign, ${count} of the Freezers around a room open`,
            state: () => openedCase(roomAnswers()!, fresh, count).state,
        })),
        { name: 'no history', state: () => ({ latest: NO_HISTORY, pads: everyPadOn, closed: [] }) },
        {
            name: 'static roles',
            state: () => ({ latest: NO_HISTORY, pads: teleporterStatesOf(null), closed: allFreezersClosed }),
        },
        { name: 'demo save', state: () => stateOf(DEMO_STATUS, demoHistory()) },
        {
            name: 'rank 1 campaign with two Signs read',
            state: () => {
                const readPids = [RANK_ONE_SIGN_PID, TOWER_SIGN_PID];
                const { status, history } = syntheticCampaign({ rank: 1, readPids });
                return stateOf(status, history);
            },
        },
    ];

    return list;
}

function newMiss(): PressMiss {
    return { inputs: 0, pushCells: [], wallStops: [] };
}

/** What the live searches find from the start region of `entry`, in the shape of a room entry's maps. */
function liveFinds(live: WalkGrid, room: SearchedRoom, entry: RoomEntry): RoomFinds<Set<number>> {
    const roomCells = new Set(room.cells);
    const region = startRegion(live, room.cells, entry.reps);
    for (const cell of region) live.visited[cell] |= 1;

    const found: RoomFinds<Set<number>> = {
        bridges: new Map(),
        holders: new Map(),
        filled: new Map(),
        dead: new Set(),
    };

    try {
        const floodState = newFloodState(live.triggers, live.lanes.length, null, true, false, true, false);

        for (const { cell, target, activators, skips } of live.triggers.rocks) {
            if (target !== undefined || activators || skips || !roomCells.has(cell)) continue;

            const waterCells = new Set<number>();
            sinkOf(live, floodState, cell, newMiss(), (waterCell) => {
                waterCells.add(waterCell);
                return false;
            });

            if (waterCells.size > 0) found.bridges.set(cell, waterCells);
        }

        const switchCells = new Set<number>();
        for (const cells of live.unpressed.values()) {
            for (const cell of cells) if (roomCells.has(cell)) switchCells.add(cell);
        }

        for (const switchCell of switchCells) {
            const objects = new Set<number>();
            bringObjectOnto(live, floodState, switchCell, newMiss(), {
                heroPushes: (pushCell) => (live.visited[pushCell] & 1) !== 0,
                accepts: (from, skips) => {
                    if (!skips) objects.add(from);
                    return false;
                },
            });

            if (objects.size > 0) found.holders.set(switchCell, objects);
        }

        for (const { slotCell, gemCells } of live.beamMoves.gemTurns) {
            if (!roomCells.has(slotCell)) continue;

            const gems = new Set<number>();
            bringObjectOnto(live, floodState, slotCell, newMiss(), {
                heroPushes: (pushCell) => (live.visited[pushCell] & 1) !== 0,
                accepts: (from, skips) => {
                    if (!skips && gemCells.has(from)) gems.add(from);
                    return false;
                },
                stays: (from) => roomCells.has(from),
            });

            if (gems.size > 0) found.filled.set(slotCell, gems);
        }

        live.monsters.forEach(({ cell }, monsterIndex) => {
            if (roomCells.has(cell)) pushedToDeath(live, floodState, monsterIndex);
        });

        live.monsters.forEach(({ cell }, monsterIndex) => {
            if (roomCells.has(cell) && floodState.monsterGone[monsterIndex]) found.dead.add(cell);
        });
    } finally {
        for (const cell of region) live.visited[cell] = 0;
    }

    return found;
}

/** The pushes the hero makes of the Rock in `from` from the cells `heroCells`, as the room search has them. */
function rockLandings(live: WalkGrid, from: number, heroCells: Set<number>): Landing[] {
    const floodState = live.noFlood;
    const z = Math.floor(from / live.layerCells) - Z_BIAS;
    if (attackedAt(live, from) || walled(live, floodState, from) || !holdsStone(live, floodState, from, z)) return [];

    const landings: Landing[] = [];

    for (let side = 0; side < 4; side++) {
        const heroCell = cellOnSide(live, from, (side + 2) % 4);
        const into = cellOnSide(live, from, side);
        if (!heroCells.has(heroCell)) continue;
        if (fenced(live, from, side, into) || fenced(live, heroCell, side, from)) continue;

        const landing = landingOf(live, floodState, from, side);
        if (landing) landings.push(landing);
    }

    return landings;
}

/**
 * The water cells where the Rock in `rockCell` sinks when it alone is pushed, as the room search pushes it: from the
 * cells the hero stands in after each push, from the start cells of `entry` and the cell the push left.
 */
function replayedBridges(live: WalkGrid, room: SearchedRoom, entry: RoomEntry, rockCell: number): Set<number> {
    interface ReplayState {
        rockCell: number;
        heroCells: Set<number>;
    }

    const { grid } = live;
    let rockBits = grid[rockCell] & (ROCK | MONSTER | MOVABLE);
    if (rockBits & ROCK) rockBits |= SUPPORT;

    let rockAt = rockCell;
    const moveRock = (cell: number): void => {
        grid[rockAt] &= ~rockBits;
        grid[cell] |= rockBits;
        rockAt = cell;
    };

    const keyOf = (cell: number, heroCells: number[]): string => {
        const ascending = heroCells.toSorted((first, second) => first - second);
        return `${cell}:${ascending.join(',')}`;
    };

    const startCells = startRegion(live, room.cells, entry.reps);
    const queue: ReplayState[] = [{ rockCell, heroCells: new Set(startCells) }];
    const seen = new Set([keyOf(rockCell, startCells)]);
    const waterCells = new Set<number>();

    try {
        for (let index = 0; index < queue.length; index++) {
            const { rockCell: from, heroCells } = queue[index];
            moveRock(from);

            for (const landing of rockLandings(live, from, heroCells)) {
                if (landing.sinks) {
                    waterCells.add(landing.cell);
                    continue;
                }

                moveRock(landing.cell);
                const nextHeroCells = startRegion(live, room.cells, [...entry.reps, from]);
                moveRock(from);

                const key = keyOf(landing.cell, nextHeroCells);
                if (seen.has(key)) continue;

                seen.add(key);
                queue.push({ rockCell: landing.cell, heroCells: new Set(nextHeroCells) });
            }
        }
    } finally {
        moveRock(rockCell);
    }

    return waterCells;
}

/**
 * The names of the items the live searches find from the start region of `entry` that the answers of `room` lack, but
 * for the bridges the Rock pushed alone as the room search pushes it never makes, and how many items they find.
 */
function lacking(live: WalkGrid, room: SearchedRoom, entry: RoomEntry) {
    const found = liveFinds(live, room, entry);
    const held = heldWith(room, entry);
    const replayed = new Map<number, Set<number>>();
    const names: string[] = [];
    let total = 0;

    const replayReaches = (rockCell: number, waterCell: number): boolean => {
        let waterCells = replayed.get(rockCell);
        if (!waterCells) {
            waterCells = replayedBridges(live, room, entry, rockCell);
            replayed.set(rockCell, waterCells);
        }

        return waterCells.has(waterCell);
    };

    for (const field of FIND_FIELDS) {
        for (const [key, values] of found[field]) {
            const heldValues = held[field].get(key) ?? [];

            for (const value of values) {
                total++;
                if (heldValues.includes(value)) continue;
                if (field === 'bridges' && !replayReaches(key, value)) continue;

                names.push(`${field} ${key} ${value}`);
            }
        }
    }

    for (const cell of found.dead) {
        total++;
        if (!held.dead.has(cell)) names.push(`dead ${cell}`);
    }

    return { names, total };
}

/** Everything the entry and the single starts it covers hold, as one entry. */
function heldWith(room: SearchedRoom, entry: RoomEntry): RoomFinds<number[]> {
    const held: RoomFinds<number[]> = { bridges: new Map(), holders: new Map(), filled: new Map(), dead: new Set() };

    for (const other of room.entries) {
        if (!other.reps.every((rep) => entry.reps.includes(rep))) continue;

        for (const field of FIND_FIELDS) {
            for (const [key, values] of other[field])
                held[field].set(key, [...(held[field].get(key) ?? []), ...values]);
        }

        for (const cell of other.dead) held.dead.add(cell);
    }

    return held;
}

describe('room answers', () => {
    let stored: StoredRoom[] = [];

    beforeAll(async () => {
        await walkLoaded();
        stored = roomAnswers()!;
    });

    test('the stored answers are loaded', () => {
        expect(stored.length).toBeGreaterThan(0);
    });

    test('a Freezer beside a room selects the answer for that state', () => {
        const fresh = freshCampaign();
        const closed = stateOf(fresh.status, fresh.history);
        const closedUsed = usedEntries(buildWalkGrid(closed.latest, closed.pads, closed.closed));

        const { room, state } = openedCase(stored, fresh, 1);
        const openUsed = usedEntries(buildWalkGrid(state.latest, state.pads, state.closed));
        expect(openUsed.has(room.entries[0])).toBe(true);
        expect(closedUsed.has(room.entries[0])).toBe(room.opens.includes(0));
    });

    for (const { name, state } of inputs()) {
        test(`the live searches find nothing the room answers lack: ${name}`, () => {
            const { latest, pads, closed } = state();
            const answered = buildWalkGrid(latest, pads, closed);
            const used = usedEntries(answered);

            setRoomAnswers(null);
            const live = buildWalkGrid(latest, pads, closed);
            setRoomAnswers(stored);

            const outside: string[] = [];
            const counts = { entries: 0, live: 0 };
            const searched = searchedRooms(answered, stored);

            for (const room of [...stored, ...searched]) {
                for (const entry of room.entries) {
                    if (!used.has(entry)) continue;

                    counts.entries++;
                    const missing = lacking(live, room, entry);

                    counts.live += missing.total;
                    outside.push(...missing.names);
                }
            }

            expect(outside).toEqual([]);
            expect(counts.entries).toBeGreaterThan(0);
            expect(counts.live).toBeGreaterThan(0);
            if (name === 'no history' || name === 'snapshot') expect(searched.length).toBeGreaterThan(0);
        });
    }

    test('an answer that lacks a bridge the Rock makes alone fails the check', () => {
        const fresh = freshCampaign();
        const { latest, pads, closed } = stateOf(fresh.status, fresh.history);
        const used = usedEntries(buildWalkGrid(latest, pads, closed));

        setRoomAnswers(null);
        const live = buildWalkGrid(latest, pads, closed);
        setRoomAnswers(stored);

        const withoutBridge = (entry: RoomEntry, rockCell: number, waterCell: number): RoomEntry => {
            const bridges = new Map(entry.bridges);
            const waterCells = bridges.get(rockCell) ?? [];
            const kept = waterCells.filter((cell) => cell !== waterCell);
            if (kept.length < waterCells.length) bridges.set(rockCell, kept);

            return { ...entry, bridges };
        };

        for (const room of stored) {
            for (const entry of room.entries) {
                if (!used.has(entry)) continue;

                for (const [rockCell, waterCells] of liveFinds(live, room, entry).bridges) {
                    const reached = replayedBridges(live, room, entry, rockCell);
                    const waterCell = [...waterCells].find((cell) => reached.has(cell));
                    if (waterCell === undefined) continue;

                    expect(lacking(live, room, entry).names).toEqual([]);

                    const entries = room.entries.map((other) => withoutBridge(other, rockCell, waterCell));
                    const mutated = { cells: room.cells, entries };
                    const mutatedEntry = entries[room.entries.indexOf(entry)];

                    expect(lacking(live, mutated, mutatedEntry).names).toEqual([`bridges ${rockCell} ${waterCell}`]);
                    return;
                }
            }
        }

        throw new Error('no answer in use holds a bridge the Rock makes alone');
    });

    test('a room the save changed gets an answer searched on its grid', () => {
        const fresh = freshCampaign();
        const closed = stateOf(fresh.status, fresh.history);
        const unchanged = buildWalkGrid(closed.latest, closed.pads, closed.closed);
        expect(searchedRooms(unchanged, stored)).toEqual([]);

        // every Freezer open: the rooms with more than three Freezers around them have no answer for that state
        const everyPadOn = PROG.teleporters.map(() => ({ en: true, disc: true }));
        const changed = buildWalkGrid(NO_HISTORY, everyPadOn, []);
        const searched = searchedRooms(changed, stored);
        expect(searched.length).toBeGreaterThan(0);

        for (const room of searched) {
            for (const cell of room.cells) expect(changed.rooms.covered.has(cell)).toBe(true);
        }
    });
});
