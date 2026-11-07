// The panel kept open per campaign and the page address that names it (#level=<name>, #tower=<i>, #gate=<pid> or
// #sign=<i>) (VIEWER.md "The page (viewer)")
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

/** What the address names a level and a Freezer by. */
export interface AddressNames {
    levels: Array<{ n: string }>;
    freezers: Array<{ pid: number }>;
}

/** The hash that names a panel: a level by its name, a Freezer by its pid, a tower or Sign by its index. */
export function panelHash([kind, id]: PanelKey, names: AddressNames): string {
    if (kind === 'level') return kind + '=' + encodeURIComponent(names.levels[id].n);
    if (kind === 'gate') return kind + '=' + names.freezers[id].pid;
    return kind + '=' + id;
}

/** The index a decoded address value names for a kind of panel; -1 when it names nothing. */
export function addressedIndex(kind: PanelKind, value: string, names: AddressNames): number {
    if (kind === 'level') return names.levels.findIndex((level) => level.n === value);
    if (kind === 'gate') {
        const pid = Number(value);
        return names.freezers.findIndex((freezer) => freezer.pid === pid);
    }
    if (/^\d+$/.test(value)) return Number(value);
    return -1;
}

addEventListener('hashchange', () => hooks.hash?.());
