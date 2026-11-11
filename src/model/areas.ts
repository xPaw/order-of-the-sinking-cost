// The areas: which Area_Pins are activated and the area a point or a level is in
// (state.md "Areas", viewer.md "Level areas (viewer)")
import { PROG } from '../data.ts';
import { latestFlag, latestOf } from '../save.ts';
import type { History } from '../save.ts';
import type { Area, AreaBox, ProgressLevel } from '../types.ts';

/**
 * An area's name as the game shows it: its `area_*` localization text, which the data build stores as `display`, with
 * the Mirror Isles named like the world.
 */
export const areaName = (area: Area): string => area.display.replace(/^The Mirror Isles\b/, 'Mirror Isles');

/**
 * Area_Pins the hero has activated: the newest `activated` per pin in the history, plus the ones a new game starts with.
 */
export function activePins(history?: History | null): Set<number> {
    const pinsOn = new Set(history?.pinsOn || []);
    const latest = history ? latestOf(history) : null;

    for (const area of PROG.areas || []) {
        if (latestFlag(latest, area.pin, 'activated', pinsOn.has(area.pin))) {
            pinsOn.add(area.pin);
        } else {
            pinsOn.delete(area.pin);
        }
    }

    return pinsOn;
}

/** A vector turned by a unit quaternion (x, y, z, w). */
function rotate(vector: number[], quaternion: AreaBox['q']): number[] {
    const [qx, qy, qz, qw] = quaternion;
    const [vx, vy, vz] = vector;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    return [vx + qw * tx + (qy * tz - qz * ty), vy + qw * ty + (qz * tx - qx * tz), vz + qw * tz + (qx * ty - qy * tx)];
}

/**
 * The area the hero stands in: of the local_area boxes containing the point, those whose pin is activated, the lowest
 * float_parameter first; a box wraps with the world in x and y (`w`) and is rotated by its quaternion.
 */
export function heroAreaAt(position: number[] | null | undefined, pinsOn: Set<number>): number | null {
    if (!position) return null;
    let best: { areaIndex: number; floatParameter: number } | null = null;

    for (const [areaIndex, area] of (PROG.areas || []).entries()) {
        if (!pinsOn.has(area.pin)) continue;
        for (const box of area.boxes || []) {
            if (best && box.f >= best.floatParameter) continue;

            const offset = position.map((value, axis) => value - box.p[axis]);
            for (let axis = 0; axis < 2; axis++) {
                if (!box.w[axis]) continue;
                if (offset[axis] > box.w[axis] / 2) {
                    offset[axis] -= box.w[axis];
                } else if (offset[axis] < -box.w[axis] / 2) {
                    offset[axis] += box.w[axis];
                }
            }

            const inverse: AreaBox['q'] = [-box.q[0], -box.q[1], -box.q[2], box.q[3]];
            const local = rotate(offset, inverse);
            const inside = local.every((value, axis) => {
                const scaled = box.s[axis] ? value / box.s[axis] : value;
                return Math.abs(scaled) - box.e[axis] <= 0;
            });
            if (inside) best = { areaIndex, floatParameter: box.f };
        }
    }

    if (best === null) return null;
    return best.areaIndex;
}

/**
 * The area a level's entry is named by: in boxes of several areas (`overlap`: [area index, float_parameter] in record
 * order) the lowest float_parameter among the activated pins' boxes, the first on a tie; with none of them activated,
 * or outside overlaps, its area from the level data (all pins activated).
 */
export function levelAreaOf(level: ProgressLevel, pinsOn: Set<number>): number | null {
    if (!level.overlap) return level.area ?? null;
    let best: { area: number; priority: number } | null = null;

    for (const [area, priority] of level.overlap) {
        if (!pinsOn.has(PROG.areas[area].pin)) continue;
        if (best === null || priority < best.priority) best = { area, priority };
    }

    if (best === null) return level.area ?? null;
    return best.area;
}
