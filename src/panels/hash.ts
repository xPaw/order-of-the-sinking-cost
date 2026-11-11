// The panel kept open per campaign and the page address that names it (#level=<name>, #tower=<pid>, #gate=<pid> or
// #sign=<pid>) (viewer.md "The page (viewer)")
import { hooks } from '../shared.ts';
import type { PanelKey, PanelKind } from '../shared.ts';

/** The open panel per campaign, so a redraw (fog switch, a re-read save) opens it again. */
export const panelKeep: Record<string, PanelKey> = {};

/**
 * The address opens a panel on the first draw of a save only; later draws show the panel kept for the campaign, if any.
 */
export let hashDone = false;

/** Records that the address has been read, so later draws keep the panel kept for the campaign. */
export function markHashDone(): void {
    hashDone = true;
}

/** Puts the hash in the address without adding a history entry; an empty hash clears it. */
export function setHash(hash: string): void {
    try {
        if (location.hash.slice(1) !== hash) {
            history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search);
        }
    } catch {}
}

/** What the address names a level, a Freezer, a tower and a Sign by. */
export interface AddressNames {
    levels: Array<{ n: string }>;
    freezers: Array<{ pid: number }>;
    towers: Array<{ pid: number }>;
    signs: Array<{ pid: number }>;
}

/** The hash that names a panel: a level by its name, anything else by its pid. */
export function panelHash([kind, id]: PanelKey, names: AddressNames): string {
    if (kind === 'level') return kind + '=' + encodeURIComponent(names.levels[id].n);
    if (kind === 'gate') return kind + '=' + names.freezers[id].pid;
    if (kind === 'tower') return kind + '=' + names.towers[id].pid;
    return kind + '=' + names.signs[id].pid;
}

/** The index a decoded address value names for a kind of panel; -1 when it names nothing. */
export function addressedIndex(kind: PanelKind, value: string, names: AddressNames): number {
    if (kind === 'level') return names.levels.findIndex((level) => level.n === value);

    const pid = Number(value);
    if (kind === 'gate') return names.freezers.findIndex((freezer) => freezer.pid === pid);
    if (kind === 'tower') return names.towers.findIndex((tower) => tower.pid === pid);
    return names.signs.findIndex((sign) => sign.pid === pid);
}

addEventListener('hashchange', () => hooks.hash?.());
