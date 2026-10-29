// Opening saves (SAVES.md "Files and versions"): the file picker, the live folder with its polling, and drag and drop
import { $, escapeHtml } from './util.ts';
import { readPreference, progressFilters, revealed, setPreference, state } from './shared.ts';
import { addFiles, newFile, realFiles, relPath, SAVE_PATH, SAVE_RE, showDemo } from './files.ts';
import type { SaveFile } from './files.ts';
import { mapViews } from './map/map-html.ts';
import { activeMap, onGestureEnd } from './map/map-view.ts';
import { hashDone, panelKeep, setHash } from './panels/hash.ts';
import { show } from './view.ts';

// files picked or dropped by hand; a failure to read them shows under the banner
function loadFailed(error: unknown): void {
    console.error(error);

    let reason = error;
    if (error instanceof Error && error.message) reason = error.message;
    state.loadError = `Could not read the files: ${String(reason)}`;
    show();
}

const openFiles = (list: SaveFile[]): Promise<void> => addFiles(list).catch(loadFailed);

// a one-time read of the files as they are now; one with a campaign status replaces the live folder
function openSnapshot(list: SaveFile[]): Promise<void> {
    state.pickerHelp = false;
    if (list.some((file) => /\.sokoban_status$/i.test(relPath(file)))) {
        folderGeneration++;
        dirHandle = null;
    }

    return openFiles(list);
}

$('#dirInput').addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.files) void openSnapshot([...input.files]);
});

/**
 * Live folder: with the File System Access API the folder handle is kept (and remembered in IndexedDB), so changed
 * saves are re-read every 5 s while the page is visible, when the tab becomes visible or the window gets focus, and on
 * ↻. Other browsers fall back to a one-time file input.
 * lastHandle: the folder opened last, kept after it is closed so reopening it keeps the per-campaign state.
 */
export let dirHandle: FileSystemDirectoryHandle | null = null;

let lastHandle: FileSystemDirectoryHandle | null = null;
let refreshing: Promise<void> | null = null;
let folderGeneration = 0;

function withObjectStore<Result>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result | undefined> {
    return new Promise((resolve, reject) => {
        const opening = indexedDB.open('sinking-star-viewer', 1);
        opening.onupgradeneeded = () => opening.result.createObjectStore('kv');
        opening.addEventListener('error', () => reject(opening.error));
        opening.onsuccess = () => {
            try {
                const transaction = opening.result.transaction('kv', mode);
                const request = run(transaction.objectStore('kv'));
                transaction.oncomplete = () => resolve(request.result);
                transaction.addEventListener('error', () => reject(transaction.error));
            } catch (error) {
                // a value that cannot be stored
                reject(error);
            }
        };
    });
}

async function readDirectory(directory: FileSystemDirectoryHandle, prefix: string, out: SaveFile[]): Promise<void> {
    for await (const [name, handle] of directory.entries()) {
        if (handle.kind === 'directory') {
            await readDirectory(handle, prefix + name + '/', out);
        } else if (SAVE_RE.test(name)) {
            const file: SaveFile = await handle.getFile();
            file.fsPath = prefix + name;
            out.push(file);
        }
    }
}

// Replaces entries whose size or modification time changed and drops deleted ones; returns whether anything changed.
// A folder switched while this runs makes it stop before it touches the files.
async function syncFolder(): Promise<boolean> {
    const generation = folderGeneration;
    const handle = dirHandle;
    if (!handle) return false;

    const out: SaveFile[] = [];
    const prefix = handle.name + '/';
    await readDirectory(handle, prefix, out);
    if (generation !== folderGeneration) return false;

    let changed = false;
    const seen = new Set<string>();

    for (const file of out) {
        const path = relPath(file);
        const old = state.files.get(path);
        seen.add(path);
        if (old?.file && old.file.size === file.size && old.file.lastModified === file.lastModified) continue;

        state.files.set(path, newFile(path, file, old));
        changed = true;
    }

    for (const path of Array.from(state.files.keys())) {
        if (path.startsWith(prefix) && !seen.has(path)) {
            state.files.delete(path);
            changed = true;
        }
    }

    if (changed) await addFiles([]);
    return changed;
}

// one read at a time; a call during a read waits for it. A redraw during a drag, pinch or eased zoom of the map would
// move it under the pointer, so the read waits for the gesture to end.
let refreshWaiting = false;

onGestureEnd(() => {
    if (refreshWaiting) {
        refreshWaiting = false;
        void refresh();
    }
});

async function readFolder(): Promise<void> {
    try {
        await syncFolder();
    } catch (error) {
        // a save being written mid-read; the next tick retries
        console.warn('refresh failed', error);
    } finally {
        refreshing = null;
        liveStatus();
    }
}

/** Now: read even during a gesture (a folder just opened, the ↻ button). */
export function refresh(now?: boolean): Promise<void> {
    if (!dirHandle) return Promise.resolve();
    if (!now && activeMap?.busy) {
        refreshWaiting = true;
        return Promise.resolve();
    }

    if (!refreshing) refreshing = readFolder();
    return refreshing;
}

const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto', style: 'short' });

const TIME_UNITS: Array<[limit: number, unit: Intl.RelativeTimeFormatUnit]> = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [2629800, 'day'],
    [31557600, 'month'],
    [Infinity, 'year'],
];

function timeAgo(time: number): string {
    const seconds = (time - Date.now()) / 1000;
    let divisor = 1;

    for (const [limit, unit] of TIME_UNITS) {
        if (Math.abs(seconds) < limit) return relativeTime.format(Math.round(seconds / divisor), unit);

        divisor = limit;
    }

    return '';
}

/** When the save was written, as the save line's tooltip tells it. */
export const savedTitle = (time: number): string => `Saved ${timeAgo(time)} · ${new Date(time).toLocaleString()}`;

// only the tooltip changes, so the ↻ button keeps the focus
function liveStatus(): void {
    const element = $('#saveMeta');
    if (element) element.title = savedTitle(Number(element.dataset.t));
}

async function useHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    folderGeneration++;
    await refreshing;

    // another folder may hold campaigns of the same names: what was revealed, filtered or viewed there does not carry
    // over
    const sameFolder = !!lastHandle && (await lastHandle.isSameEntry(handle).catch(() => false));
    if (!sameFolder) {
        for (const kept of [revealed, progressFilters, mapViews]) {
            for (const key of Object.keys(kept)) delete kept[key];
        }
    }

    lastHandle = handle;
    dirHandle = handle;
    pendingHandle = null;
    state.pickerHelp = false;
    syncFolderUi();

    state.camp = null;
    state.campPicked = false;
    state.rendered = null;
    if (hashDone) {
        for (const key of Object.keys(panelKeep)) delete panelKeep[key];
        setHash('');
    }

    for (const path of Array.from(state.files.keys())) state.files.delete(path);
    await refresh(true);
    if (!realFiles().length) void showDemo();

    try {
        await withObjectStore('readwrite', (store) => store.put(handle, 'dir'));
    } catch {}
}

// A page in a cross-origin frame may not open the folder picker or ask for a folder's permission again; a dropped
// folder still comes with a live handle. Without a picker the page says so and offers the folder input.
const PICKER_KEY = 'folderPickerBlocked';

let pickerBlocked = readPreference(PICKER_KEY, 'sessionStorage') === '1';

function inCrossFrame(): boolean {
    try {
        const top = window.top;
        return top !== window && !top?.location.href;
    } catch {
        return true;
    }
}

const crossFrame = inCrossFrame();
export const dropsLive = 'getAsFileSystemHandle' in (window.DataTransferItem?.prototype || {});

function needPicker(): void {
    state.pickerHelp = true;
    show();
}

// why there is no folder picker, and the other ways in
function pickerHelpText(): string {
    if (!window.showDirectoryPicker && !dropsLive) {
        return (
            'This browser can’t keep a folder open. ' +
            'Pick the save folder as a one-time snapshot, or drag it onto the page.'
        );
    }

    const noPicker = 'This page can’t open a folder picker here.';
    if (dropsLive) {
        const dragHint =
            'Drag the save folder onto the page to keep it updating live, or pick it as a one-time snapshot.';
        return `${noPicker} ${dragHint}`;
    }

    return `${noPicker} Pick the save folder as a one-time snapshot.`;
}

/**
 * A button of the save folder's path as muted text followed by a copy icon; a click copies the path. A path too long
 * for its line shortens in the middle and keeps its last two folders ("Saved Games/Order of the Sinking Star").
 */
export function savePathHtml(attributes: string): string {
    const icon =
        '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/>' +
        '<path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5"/></svg>';
    const tail = /[\\/][^\\/]+[\\/][^\\/]+$/.exec(SAVE_PATH)?.[0] ?? '';
    const head = SAVE_PATH.slice(0, SAVE_PATH.length - tail.length);
    const headHtml = `<span class="bphead">${escapeHtml(head)}</span>`;
    const tailHtml = `<span class="bptail">${escapeHtml(tail)}</span>`;
    const text = `<span class="bptext">${headHtml}${tailHtml}</span>`;
    const title = escapeHtml(`Copy the folder path: ${SAVE_PATH}`);
    const copyIcon = `<span class="copyicon">${icon}</span>`;
    return `<button class="plain bpath" ${attributes} title="${title}">${text}${copyIcon}</button>`;
}

export function pickerHelpHtml(): string {
    const message = pickerHelpText();
    const snapshotButton = '<button class="primary" data-snapshot>Pick a snapshot…</button>';

    // the example view's banner above already shows the path
    let path = savePathHtml('data-copy-path');
    if ($('#bnCopy')) path = '';
    return `<div class="banner" id="pickHelp"><span class="bt">${message}</span>${path}${snapshotButton}</div>`;
}

document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('#pickHelp [data-snapshot]')) {
        $('#dirInput').click();
    } else if (target.closest('#pickHelp [data-copy-path]')) {
        void copyPath({ currentTarget: target.closest('[data-copy-path]') });
    }
});

export async function pickFolder(): Promise<void> {
    if (!window.showDirectoryPicker || pickerBlocked) {
        needPicker();
        return;
    }

    let handle: FileSystemDirectoryHandle;

    try {
        handle = await window.showDirectoryPicker({ id: 'saves', mode: 'read' });
    } catch (error) {
        let name = '';
        let message = '';
        if (error instanceof Error) {
            name = error.name;
            message = error.message;
        }

        if (name === 'AbortError') return;

        console.warn(error);

        // a lost click (after a refused reconnect) is a SecurityError too, but only for this try
        if (name === 'SecurityError' && (crossFrame || /cross.origin/i.test(message))) {
            pickerBlocked = true;
            setPreference(PICKER_KEY, '1', 'sessionStorage');
        }
        needPicker();
        return;
    }

    await useHandle(handle);
}

// a remembered folder that needs a click to grant permission again
let pendingHandle: FileSystemDirectoryHandle | null = null;

/** The label of the buttons that open the save folder. */
export const folderLabel = (): string => (pendingHandle ? 'Reconnect save folder' : 'Open save folder');

/** The banner's message; its first word matches the button that opens the save folder. */
export function bannerMessage(): string {
    const verb = pendingHandle ? 'Reconnect' : 'Open';
    return `${verb} your save folder to see what to play next. Your save is read here in the browser and never uploaded.`;
}

function syncFolderUi(): void {
    const bannerText = $('#bnText');
    if (bannerText) bannerText.textContent = bannerMessage();

    $('#openDir').textContent = folderLabel();
    $('#openDir').title = pendingHandle ? `Reconnect “${pendingHandle.name}”` : '';

    const bannerButton = $('#bnOpen');
    if (bannerButton) bannerButton.textContent = folderLabel();
}

export async function folderAction(): Promise<void> {
    if (!pendingHandle) {
        void pickFolder();
        return;
    }

    const handle = pendingHandle;
    let granted = false;
    if (!pickerBlocked && !crossFrame) {
        try {
            granted = (await handle.requestPermission({ mode: 'read' })) === 'granted';
        } catch (error) {
            console.warn(error);
        }
    }

    if (granted) {
        await useHandle(handle);
        return;
    }

    // refused, or a frame that may not ask again: the folder is forgotten and the picker opens instead (a click on
    // "Open save folder" when the browser wants a fresh one), or the page says it has none
    await forgetFolder();
    void pickFolder();
}

// drops the remembered folder of the last visit
async function forgetFolder(): Promise<void> {
    pendingHandle = null;
    syncFolderUi();
    try {
        await withObjectStore('readwrite', (store) => store.delete('dir'));
    } catch {}
}

/** Without clipboard access the path is selected for copying by hand. */
export async function copyPath(event: { currentTarget: EventTarget | null }): Promise<void> {
    const button = event.currentTarget;
    if (!(button instanceof HTMLElement) || button.classList.contains('done')) return;

    const icon = button.querySelector('.copyicon');
    const pathText = button.querySelector('.bptext');
    if (!icon || !pathText) return;

    const iconMarkup = icon.innerHTML;
    const showResult = (text: string): void => {
        icon.textContent = text;
        button.classList.add('done');
        setTimeout(() => {
            icon.innerHTML = iconMarkup;
            button.classList.remove('done');
        }, 1500);
    };

    try {
        await navigator.clipboard.writeText(SAVE_PATH);
        showResult('Copied');
    } catch {
        const range = document.createRange();
        range.selectNodeContents(pathText);

        const selection = getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);

        let copied = false;
        try {
            copied = document.execCommand('copy');
        } catch {}
        showResult(copied ? 'Copied' : 'Press Ctrl+C');
    }
}

$('#openDir').addEventListener('click', () => void folderAction());

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refresh();
});

addEventListener('focus', () => void refresh());

setInterval(() => {
    if (!document.hidden) liveStatus();
}, 10000);

// polls the connected folder; an unchanged folder re-renders nothing
setInterval(() => {
    if (dirHandle && !document.hidden) void refresh();
}, 5000);

// offer the folder from the last visit; reading it again needs a click to grant permission
async function offerLastFolder(): Promise<void> {
    if (!window.showDirectoryPicker) return;

    let stored: unknown;

    try {
        stored = await withObjectStore('readonly', (store) => store.get('dir'));
    } catch {
        return;
    }

    if (!(stored instanceof FileSystemDirectoryHandle) || realFiles().length) return;

    if ((await stored.queryPermission({ mode: 'read' })) === 'granted') {
        void useHandle(stored);
        return;
    }

    pendingHandle = stored;
    syncFolderUi();
}

void offerLastFolder();
void showDemo();

const isFileEntry = (entry: FileSystemEntry): entry is FileSystemFileEntry => entry.isFile;
const isDirectoryEntry = (entry: FileSystemEntry): entry is FileSystemDirectoryEntry => entry.isDirectory;

async function walkEntry(entry: FileSystemEntry, prefix: string, out: SaveFile[]): Promise<void> {
    if (isFileEntry(entry)) {
        if (!SAVE_RE.test(prefix + entry.name)) return;

        const file: SaveFile = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
        file.fsPath = prefix + entry.name;
        out.push(file);
    } else if (isDirectoryEntry(entry)) {
        const reader = entry.createReader();
        let batch: FileSystemEntry[];
        do {
            batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
            for (const child of batch) await walkEntry(child, prefix + entry.name + '/', out);
        } while (batch.length);
    }
}

// enter/leave fire for every element crossed, so the overlay follows a counter
let dragDepth = 0;

const setDragging = (active: boolean): void => {
    document.body.classList.toggle('dragging', active);
};

document.addEventListener('dragenter', (event) => {
    const types = event.dataTransfer?.types ?? [];
    if (!types.includes('Files')) return;

    dragDepth++;
    setDragging(true);
});

document.addEventListener('dragleave', () => {
    if (!dragDepth) return;

    dragDepth--;
    if (!dragDepth) setDragging(false);
});

document.addEventListener('dragover', (event) => event.preventDefault());

document.addEventListener('drop', async (event) => {
    event.preventDefault();
    dragDepth = 0;
    setDragging(false);

    const transfer = event.dataTransfer;
    if (!transfer) return;

    // the drag data is only readable synchronously, so take everything before the first await
    const items = [...transfer.items].filter((item) => item.kind === 'file');
    const files: SaveFile[] = [...transfer.files];
    const entries: FileSystemEntry[] = [];

    for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) entries.push(entry);
    }

    const handles: Array<Promise<FileSystemHandle | null>> = [];

    for (const item of items) {
        const handle = item.getAsFileSystemHandle?.();
        if (handle) handles.push(handle);
    }

    // a dropped folder with a handle becomes a live folder, like a picked one; without one it is read once
    const settled = await Promise.all(handles.map((handle) => handle.catch(() => null)));
    const directory = settled.find((handle) => handle?.kind === 'directory');
    if (directory instanceof FileSystemDirectoryHandle) {
        void useHandle(directory);
        return;
    }

    const out: SaveFile[] = [];

    try {
        for (const entry of entries) await walkEntry(entry, '', out);
    } catch (error) {
        loadFailed(error);
        return;
    }

    void openSnapshot(out.length ? out : files);
});
