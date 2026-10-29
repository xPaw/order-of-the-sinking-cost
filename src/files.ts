// The save files given to the page, by path, and the campaigns they make up (SAVES.md "Files and versions")
import { DEMO_STATUS, demoHistory } from './demo-save.ts';
import { walkReady } from './walk-data.ts';
import { apolloDate } from './util.ts';
import { parseHistory, parseStatus } from './save.ts';
import type { History } from './save.ts';
import { state } from './shared.ts';
import { show, showSave } from './view.ts';
import type { DemoStatus, Status } from './status-file.ts';

/**
 * A file given to the page: from the folder picker (`webkitRelativePath`), a dropped folder or the dev server
 * (`fsPath`).
 */
export type SaveFile = File & { fsPath?: string };

/**
 * One save file of the page: read once (`buf`), then parsed; `last` is the last good parse a file the game is still
 * writing falls back to.
 */
export interface SaveEntry {
    path: string;
    file: SaveFile | null;
    buf: Uint8Array | null;
    parsed: Status | DemoStatus | History | null;
    error: string | null;
    warning?: string | null;
    last?: Status | DemoStatus | History | null;
    demo?: boolean;
}

/** A Status.sokoban_status. */
export interface StatusEntry extends SaveEntry {
    parsed: Status | DemoStatus | null;
}

/** An overworld.history. */
export interface HistoryEntry extends SaveEntry {
    parsed: History | null;
}

/** Only the campaign status and the overworld history (for fog) are read. */
export const SAVE_RE = /(\.sokoban_status|(^|\/)overworld\.history)$/i;

/** The path of a file given to the page, with forward slashes. */
export function relPath(file: SaveFile): string {
    return (file.webkitRelativePath || file.fsPath || file.name).replace(/\\/g, '/');
}

/** A save entry for a file not read yet; it keeps the last good parse of the entry it replaces. */
export const newFile = (path: string, file: SaveFile, old?: SaveEntry): SaveEntry => ({
    path,
    file,
    buf: null,
    parsed: null,
    error: null,
    warning: null,
    last: old?.parsed || old?.last || null,
});

const isStatus = (entry: SaveEntry): entry is StatusEntry => entry.path.endsWith('.sokoban_status');
const isHistory = (entry: SaveEntry): entry is HistoryEntry => entry.path.endsWith('.history');

// where a parse stopped, for a file that stopped partway; a campaign status never does
const stoppedAt = (parsed: Status | DemoStatus | History): string | null => {
    if (!('error' in parsed)) return null;
    return parsed.error ?? null;
};

// reads one file: a history that stops partway keeps a last whole parse, else the records read before the bad one are
// used; a file the game is still writing keeps its last good parse until the next read
function parseEntry(entry: SaveEntry): void {
    try {
        const parsed = isHistory(entry) ? parseHistory(entry.buf!) : parseStatus(entry.buf!);
        const stopped = stoppedAt(parsed);
        if (stopped) console.warn(entry.path, stopped);
        if (stopped && entry.last && !stoppedAt(entry.last)) {
            entry.parsed = entry.last;
            return;
        }
        entry.parsed = parsed;
        entry.warning = null;
        if (stopped && 'records' in parsed) entry.warning = `read up to record ${parsed.records}; ${stopped}`;
        entry.last = null;
    } catch (error) {
        if (entry.last) {
            entry.parsed = entry.last;
            console.warn(entry.path, error);
        } else {
            entry.error = error instanceof Error ? error.message : String(error);
            console.error(entry.path, error);
        }
    }
}

/**
 * Adds the save files given, reads them and shows the campaign. Files without a campaign status open nothing:
 * state.loadError says why, shown under the banner until a campaign status loads.
 */
export async function addFiles(list: SaveFile[]): Promise<void> {
    const added: string[] = [];

    for (const file of list) {
        const path = relPath(file);
        if (!SAVE_RE.test(path)) continue;
        state.files.set(path, newFile(path, file, state.files.get(path)));
        added.push(path);
    }

    // files without a campaign status open nothing: the page keeps what it shows
    if (list.length && !realFiles().some(isStatus)) {
        for (const path of added) state.files.delete(path);
        state.loadError = 'No Status.sokoban_status in the dropped folder';
        if (state.camp != null) show();
        else void showDemo();
        return;
    }

    if (added.some((path) => path.endsWith('.sokoban_status'))) state.loadError = null;
    if (realFiles().some(isStatus)) {
        for (const [path, entry] of state.files) {
            if (entry.demo) state.files.delete(path);
        }
    }

    await Promise.all(
        [...state.files.values()]
            .filter((entry) => !entry.buf)
            .map(async (entry) => {
                entry.buf = new Uint8Array(await entry.file!.arrayBuffer());
            }),
    );
    await walkReady;

    for (const entry of state.files.values()) {
        if (!entry.parsed && !entry.error) parseEntry(entry);
    }

    const camps = campaigns();

    // follows the campaign the game saved last until one is picked by hand
    if (!state.campPicked || state.camp === null || !camps.includes(state.camp)) state.camp = newestCampaign(camps);
    if (state.camp === null) {
        void showDemo();
        return;
    }

    const note = state.rendered === state.camp ? 'Updating…' : 'Working out your save…';
    await showSave(note);
}

/** Where the game keeps its saves: on Linux, in the Proton prefix of the default Steam library. */
export const SAVE_PATH =
    /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent)
        ? '~/.local/share/Steam/steamapps/compatdata/499170/pfx/drive_c/users/steamuser/Saved Games/Order of the Sinking Star'
        : '%USERPROFILE%\\Saved Games\\Order of the Sinking Star';

const DEMO_DIR = 'No save loaded';

/** The files read from the save folder, not the empty demo save. */
export const realFiles = (): SaveEntry[] => [...state.files.values()].filter((entry) => !entry.demo);

/** Shows the empty demo save, unless a campaign status is loaded or a campaign already shown. */
export async function showDemo(): Promise<void> {
    if (realFiles().some(isStatus)) return;

    await walkReady;
    if (realFiles().some(isStatus) || state.camp != null) return;

    const demoFiles: Array<[string, Status | DemoStatus | History]> = [
        ['Status.sokoban_status', DEMO_STATUS],
        ['overworld.history', demoHistory()],
    ];

    for (const [name, parsed] of demoFiles) {
        const path = `${DEMO_DIR}/${name}`;
        state.files.set(path, { path, file: null, buf: new Uint8Array(0), parsed, error: null, demo: true });
    }

    state.camp = DEMO_DIR;
    show();
}

/** The campaign a save path belongs to: the name of its folder, empty for a bare file. */
export function campaignOf(path: string): string {
    const parts = path.split('/');
    if (parts.length < 2) return '';
    return parts[parts.length - 2];
}

/** The file name of a save path. */
export function baseName(path: string): string | undefined {
    return path.split('/').pop();
}

/** The campaigns with a status among the files, by name. */
export function campaigns(): string[] {
    const statusFiles = [...state.files.values()].filter(isStatus);
    return [...new Set(statusFiles.map((entry) => campaignOf(entry.path)))].toSorted();
}

/** The status file of a campaign. */
export const statusEntry = (camp: string): StatusEntry | undefined =>
    [...state.files.values()].filter(isStatus).find((entry) => campaignOf(entry.path) === camp);

// a campaign's save times for picking the newest: the status's saved time, then the file's
function savedAt(camp: string): [number, number] {
    const entry = statusEntry(camp);
    const status = entry?.parsed;
    const savedLo = status?.savedLo;
    const savedHi = status?.savedHi;

    let savedTime = -Infinity;
    if (savedLo != null && savedHi != null) savedTime = apolloDate(savedLo, savedHi).getTime();
    return [savedTime, entry?.file?.lastModified || 0];
}

// whether a campaign's save times are later than another's
function savedLater(candidate: [number, number], current: [number, number]): boolean {
    if (candidate[0] !== current[0]) return candidate[0] > current[0];
    return candidate[1] > current[1];
}

// the game opens the campaign saved last (by the status's saved time, then by the file's)
function newestCampaign(camps: string[]): string | null {
    let newest: string | null = null;
    for (const camp of camps) {
        if (newest === null || savedLater(savedAt(camp), savedAt(newest))) newest = camp;
    }

    return newest;
}

/** The name a campaign shows under; saves in no folder read "Saves". */
export const campaignLabel = (camp: string): string => camp || 'Saves';

/** The overworld history of a campaign. */
export const historyEntry = (camp: string): HistoryEntry | undefined =>
    [...state.files.values()]
        .filter(isHistory)
        .find(
            (entry) => entry.parsed && campaignOf(entry.path) === camp && baseName(entry.path) === 'overworld.history',
        );
