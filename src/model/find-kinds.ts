// The kinds of mark the sidebar's Find on the map names, in the order it lists them (viewer.md "The page (viewer)")
import type { OverlayKind } from '../map/map-html.ts';
import type { ProgressLevel } from '../types.ts';
import { ENDINGS } from './achievements.ts';
import { capitalized, modelNoun } from './freezer-names.ts';
import type { GoalView } from './goals-view.ts';
import { mapLayerOf } from './layers.ts';

/** A kind of mark with a Find on the map row: every overlay switch but Reachable. */
export type FindKind = Exclude<OverlayKind, 'reach'>;

/** The kinds in the sidebar's order, each with its plural label. */
export const FIND_KINDS: Array<[kind: FindKind, label: string]> = [
    ['pods', capitalized(modelNoun(false))],
    ['doorways', capitalized(modelNoun(true))],
    ['signs', 'Signs'],
    ['tps', 'Teleporters'],
    ['towerPads', 'Antipode pads'],
    ['minorPads', 'Warp pads'],
    ['logs', 'Voice logs'],
    ['maps', 'Map scrolls'],
    ['pins', 'Area pins'],
    ['treasures', 'Treasures'],
];

export function findLabel(kind: FindKind): string {
    const found = FIND_KINDS.find(([each]) => each === kind);
    if (!found) throw new Error(`No Find on the map row for ${kind}`);
    return found[1];
}

export const isFindKind = (kind: string): kind is FindKind => FIND_KINDS.some(([each]) => each === kind);

/**
 * The layer Find on the map counts for the goal shown: for an ending and its stages, the layer of the level that
 * carries the ending's achievement; null (every layer) for the other goals.
 */
export function findLayerOf(goals: GoalView[], levels: ProgressLevel[], goal: GoalView | null): string | null {
    if (!goal) return null;

    const ending = goals.find(
        (top) =>
            top.kind === 'ending' && (top.key === goal.key || top.children?.some((child) => child.key === goal.key)),
    );
    if (ending?.ending === undefined) return null;

    const achievement = ENDINGS[ending.ending][1];
    const carrier = levels.find((level) => level.a === achievement);
    if (!carrier) return null;
    return mapLayerOf(carrier.p[2]);
}

/** Whether a mark on a layer (undefined: off the map layers) is in Find on the map's layer (null: every layer). */
export function inFindLayer(scope: string | null, layer: string | undefined): boolean {
    if (scope === null) return true;
    return layer === scope;
}
