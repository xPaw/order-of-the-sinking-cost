// State shared across modules; the ones other modules change have setters
import type { SaveEntry } from './files.ts';
import type { OverlayKind } from './map/map-html.ts';
import type { FindKind } from './model/find-kinds.ts';
import type { ProgressModel } from './model/progress-model.ts';

/** A remembered setting in localStorage (or the Storage named by `store`); null when storage is unavailable. */
export const readPreference = (
    key: string,
    store: 'localStorage' | 'sessionStorage' = 'localStorage',
): string | null => {
    try {
        return globalThis[store].getItem(key);
    } catch {
        return null;
    }
};

/** Remembers a setting in localStorage (or the Storage named by `store`); nothing happens when storage is unavailable. */
export const setPreference = (
    key: string,
    value: string,
    store: 'localStorage' | 'sessionStorage' = 'localStorage',
): void => {
    try {
        globalThis[store].setItem(key, value);
    } catch {}
};

/**
 * What the page shows and where it came from: the save files by path, the campaign shown (null for none), the key of the
 * last drawn view, why the last files given opened nothing (`loadError`, shown under the banner until a campaign status
 * loads), whether the campaign was picked by hand and whether the folder picker could not open (so the banner offers the
 * other ways in).
 */
export interface PageState {
    files: Map<string, SaveEntry>;
    camp: string | null;
    rendered: string | null;
    pickerHelp: boolean;
    loadError?: string | null;
    campPicked?: boolean;
}

/** The page's state. */
export const state: PageState = { files: new Map(), camp: null, rendered: null, pickerHelp: false };

/**
 * The narrowing of the list and the map of one campaign. goal: the key of the goal the list and the map show, '' for the
 * active one; q: the search text, which lists every level not under fog; solved: whether the list shows the solved levels
 * in place of the ones left to do; tower and area: the chips of a tower and an area; find: the kind of mark whose items
 * the list shows in place of the goal's levels ('' for the goal's); findDone: whether that list also shows the items
 * already done.
 */
export interface ProgressFilters {
    q: string;
    goal: string;
    solved: boolean;
    tower: string;
    area: string;
    find: FindKind | '';
    findDone: boolean;
}

/** The narrowing of each campaign, by campaign name. */
export const progressFilters: Record<string, ProgressFilters> = {};

/** The kinds of thing the map's panel opens for. */
export type PanelKind = 'level' | 'tower' | 'gate' | 'sign';

/** An open panel: its kind and the index of its level, tower, Freezer or sign. */
export type PanelKey = [kind: PanelKind, id: number];

/** The fogged levels the viewer clicked open, by campaign name. */
export const revealed: Record<string, Set<number>> = {};

/** The levels a campaign has revealed. */
export function revealedOf(camp: string): Set<number> {
    let levels = revealed[camp];
    if (!levels) {
        levels = new Set();
        revealed[camp] = levels;
    }

    return levels;
}

/** The narrowing of a campaign. */
export function filtersOf(camp: string): ProgressFilters {
    let filters = progressFilters[camp];
    if (!filters) {
        filters = { q: '', goal: '', solved: false, tower: '', area: '', find: '', findDone: false };
        progressFilters[camp] = filters;
    }

    return filters;
}

/** Drops the search text and the tower and area chips; the goal and the Solved toggle stay. */
export function clearNarrowing(filters: ProgressFilters): void {
    Object.assign(filters, { q: '', tower: '', area: '' });
}

/** Whether spoilers are hidden; the page hides them until the viewer turns them on. */
export let spoilersHidden = readPreference('hideSpoilers') !== '0';

export const setSpoilersHidden = (value: boolean): void => {
    spoilersHidden = value;
};

/**
 * Hooks into the last drawn progress view, which sets the ones it has: apply (the list filter changed), open(level),
 * tower(i) and area() frame them on the map, hero() frames the hero, overlay(kind) shows or hides a kind of mark,
 * find(kind) lists the items of a kind of mark, list() closes the open panel so that the list shows, panelOpen() tells
 * whether a panel covers the list, reveal() names a revealed level everywhere, side: the model the sidebar shows, hash() opens the panel the address names (#level=<name>, #tower=<pid>, #gate=<pid> or #sign=<pid>).
 */
export interface Hooks {
    apply: ((redraw?: boolean) => void) | null;
    open: ((level: number) => void) | null;
    tower: ((tower: number) => void) | null;
    area: (() => void) | null;
    hero: (() => void) | null;
    overlay: ((kind: OverlayKind) => void) | null;
    find: ((kind: FindKind) => void) | null;
    list: (() => void) | null;
    panelOpen: (() => boolean) | null;
    reveal: (() => void) | null;
    side: ProgressModel | null;
    hash: (() => void) | null;
}

function emptyHooks(): Hooks {
    return {
        apply: null,
        open: null,
        tower: null,
        area: null,
        hero: null,
        overlay: null,
        find: null,
        list: null,
        panelOpen: null,
        reveal: null,
        side: null,
        hash: null,
    };
}

/** The hooks into the last drawn progress view. */
export const hooks: Hooks = emptyHooks();

/** A redraw drops the hooks into the last drawn progress view. */
export function resetHooks(): void {
    Object.assign(hooks, emptyHooks());
}

/** Leaves Find mode: the list shows the goal's levels again, with no panel open. */
export function showGoalList(filters: ProgressFilters): void {
    filters.find = '';
    hooks.list?.();
}
