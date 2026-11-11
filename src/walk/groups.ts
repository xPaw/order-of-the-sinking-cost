// Existence Groups: whether an entity exists, and the cell writes of the members of a Group that does not (viewer.md
// "Existence")
import { rawU32 } from '../save.ts';
import type { WalkGrid } from './walker.ts';

const EXISTS = 1 << 26;
const IN_GROUP = 1 << 25;

// EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY, NOT_SNAPPED_TO_GRID, PLAYABLE_IN_PRELUDE
const SKIPPED = (1 << 29) | (1 << 9) | (1 << 24);

// how deep the game makes existence subgroups exist
const MAX_GROUP_DEPTH = 21;

/** A cell write that withGroups undoes: `array[index]` held `value` before it. */
export interface CellWrite {
    array: Uint8Array;
    index: number;
    value: number;
}

/** Whether an entity's entity_flags make the game's cell lookup skip it. */
function skippedByFlags(flags: Uint8Array | undefined): boolean {
    return flags !== undefined && (rawU32(flags) & SKIPPED) !== 0;
}

/**
 * Whether an entity exists for the game's cell lookup. The lookup skips an entity whose latest CREATION_OR_DESTRUCTION
 * record destroyed it, and by its latest entity_flags (else the level-data `existence`; undefined: never skipped) one
 * IN_EXISTENCE_GROUP without CURRENTLY_EXISTS, one EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY, a NOT_SNAPPED_TO_GRID
 * one (no Door is in these lists) and a PLAYABLE_IN_PRELUDE one (the overworld has no prelude). A Group whose latest
 * `exists` differs from its exists_by_default takes its direct members with it.
 */
export function exists(walkGrid: WalkGrid, pid: number, existence: number | undefined): boolean {
    const latest = walkGrid.latest;
    if (latest.created.get(pid)?.destroyed) return false;
    const flags = latest.get(pid, 'base.entity_flags');
    const groupIndex = walkGrid.groupOfMember.get(pid);
    if (skippedByFlags(flags)) return false;

    if (groupIndex !== undefined) {
        const groupExists = walkGrid.groupExists[groupIndex];
        const existsByDefault = !!walkGrid.existenceGroups[groupIndex][1];
        if (groupExists !== existsByDefault) return groupExists;
    }

    if (!flags) return existence === undefined || !!existence;
    const entityFlags = rawU32(flags);
    return !(entityFlags & IN_GROUP) || (entityFlags & EXISTS) !== 0;
}

/** Sets `bits` in `array[index]`; while withGroups runs the dormant writes, the old value goes to its write log. */
export function put(walkGrid: WalkGrid, array: Uint8Array, index: number, bits: number): void {
    if (walkGrid.writeLog) walkGrid.writeLog.push({ array, index, value: array[index] });
    array[index] |= bits;
}

/**
 * Runs `write` now when the entity exists, else keeps it for its Group when only the Group keeps it from existing.
 */
export function place(walkGrid: WalkGrid, pid: number, existence: number | undefined, write: () => void): void {
    if (exists(walkGrid, pid, existence)) {
        write();
        return;
    }

    const groupIndex = dormantGroup(walkGrid, pid, existence);
    if (groupIndex !== undefined) walkGrid.dormantWrites[groupIndex].push(write);
}

/** The Group that keeps an entity from existing while it does not exist itself, else undefined. */
export function dormantGroup(walkGrid: WalkGrid, pid: number, existence: number | undefined): number | undefined {
    if (exists(walkGrid, pid, existence)) return undefined;
    const groupIndex = walkGrid.groupOfMember.get(pid);
    if (groupIndex === undefined || walkGrid.groupExists[groupIndex]) return undefined;
    if (walkGrid.latest.created.get(pid)?.destroyed) return undefined;
    if (skippedByFlags(walkGrid.latest.get(pid, 'base.entity_flags'))) return undefined;
    return groupIndex;
}

/** Whether an entity exists, counting the Groups withGroups is making exist. */
export function existsNow(walkGrid: WalkGrid, pid: number, existence: number | undefined): boolean {
    if (exists(walkGrid, pid, existence)) return true;
    if (!walkGrid.groupsMade) return false;
    const groupIndex = dormantGroup(walkGrid, pid, existence);
    return groupIndex !== undefined && walkGrid.groupsMade.has(groupIndex);
}

/**
 * Runs callback(changed) with the existence Groups `groupIndices` made to exist the way the game does it: each
 * existence subgroup too (MAX_GROUP_DEPTH deep at most), except one that an existing Group unexists
 * (unexist_this_id(2, 3)); a Group that exists already ends the recursion. The members' cell writes are undone
 * afterwards. A THROUGH light the Groups power (the light, a Gem_Slot or a Gem of its room is a member) casts its beam
 * after the cell writes; other beams, fire, pads, Wardrobes, elevators and switch latches stay as they were.
 * `changed`: whether any cell changed.
 */
export function withGroups<Result>(
    walkGrid: WalkGrid,
    groupIndices: Iterable<number | undefined>,
    callback: (changed: boolean) => Result,
): Result {
    const { groupExists, existenceGroups, dormantWrites, dormantLights } = walkGrid;
    const made = new Set<number>();

    const isOn = (groupIndex: number): boolean => groupExists[groupIndex] || made.has(groupIndex);

    const make = (groupIndex: number, depth: number): void => {
        if (depth >= MAX_GROUP_DEPTH || isOn(groupIndex)) return;
        made.add(groupIndex);
        const [, , subgroups] = existenceGroups[groupIndex];
        for (const subgroup of subgroups) {
            const [, , , unexistedBy] = existenceGroups[subgroup];
            if (!unexistedBy.some(isOn)) make(subgroup, depth + 1);
        }
    };

    for (const groupIndex of groupIndices) {
        if (groupIndex !== undefined) make(groupIndex, 0);
    }

    const anyDormant = [...made].some(
        (groupIndex) => dormantWrites[groupIndex].length > 0 || dormantLights[groupIndex].length > 0,
    );
    if (!anyDormant) return callback(false);

    const writeLog: CellWrite[] = [];
    walkGrid.writeLog = writeLog;

    for (const groupIndex of made) {
        for (const write of dormantWrites[groupIndex]) write();
    }

    const lights = new Set<() => void>();

    for (const groupIndex of made) {
        for (const light of dormantLights[groupIndex]) lights.add(light);
    }

    walkGrid.groupsMade = made;

    for (const light of lights) light();

    walkGrid.groupsMade = null;
    walkGrid.writeLog = null;

    try {
        return callback(true);
    } finally {
        // undone newest first, so a cell written twice gets its first old value back
        for (let logIndex = writeLog.length - 1; logIndex >= 0; logIndex--) {
            const write = writeLog[logIndex];
            write.array[write.index] = write.value;
        }
    }
}
