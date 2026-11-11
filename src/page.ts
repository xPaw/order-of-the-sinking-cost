// Draws the page for the current campaign: the sidebar, the progress view and the banner (viewer.md "The page
// (viewer)")
import { PROG } from './data.ts';
import { $, escapeHtml, hexDump } from './util.ts';
import { resetHooks, state } from './shared.ts';
import { baseName, statusEntry } from './files.ts';
import { progressModel, progressReady } from './model/progress-model.ts';
import type { ProgressModel } from './model/progress-model.ts';
import { renderSide } from './sidebar.ts';
import { renderProgress } from './panels.ts';
import { pickerHelpHtml } from './folder.ts';
import { setPageDrawing } from './view.ts';

/** An element named by the id of its nearest ancestor with one, and the child indices down from that ancestor. */
type FocusPath = [id: string, path: number[]];

// a redraw of the same campaign keeps these scroll positions and the focused element (by id, else by its child-index
// path from the nearest element with an id)
const KEEP_SCROLL = ['#sidebar', '#sideGoals', '#pgRows', '#pgSel'];

function focusPath(start: Element | null): FocusPath | null {
    if (!start || start === document.body) return null;

    const path: number[] = [];
    let element: Element | null = start;

    while (element && !element.id) {
        const parent: HTMLElement | null = element.parentElement;
        if (!parent) return null;

        path.unshift([...parent.children].indexOf(element));
        element = parent;
    }

    if (!element) return null;
    return [element.id, path];
}

function fromPath([id, path]: FocusPath): Element | null | undefined {
    let element: Element | null | undefined = document.getElementById(id);
    for (const index of path) element = element?.children[index];
    return element;
}

// the redraw replaces the elements; keep the focus (and typing in a search box) where it was
function restoreFocus(activePath: FocusPath | null, caret: [number, number] | null, fresh: boolean): void {
    const restored = activePath && fromPath(activePath);
    if (!restored || restored === document.activeElement) return;
    if (fresh && !restored.closest('#sidebar')) return;
    if (!restored.matches('input, select, button, [tabindex], a[href]')) return;
    if (!(restored instanceof HTMLElement || restored instanceof SVGElement)) return;

    restored.focus({ preventScroll: true });

    const isTextField = restored instanceof HTMLInputElement || restored instanceof HTMLTextAreaElement;
    if (!caret || !isTextField || restored.value.length < caret[1]) return;

    try {
        restored.setSelectionRange(...caret);
    } catch {}
}

function drawPage(): void {
    const main = $('#main');
    const key = state.camp;
    const fresh = state.rendered !== key;
    const top = main.scrollTop;
    const windowTop = scrollY;

    const active = document.activeElement;
    const activePath = focusPath(active);
    let caret: [number, number] | null = null;
    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        if (active.selectionStart != null && active.selectionEnd != null) {
            caret = [active.selectionStart, active.selectionEnd];
        }
    }

    const scrolls = KEEP_SCROLL.map((selector) => $(selector)?.scrollTop);
    state.rendered = key;

    // hooks into the last drawn progress view; the draw below sets the ones it has
    resetHooks();
    const entry = key === null ? undefined : statusEntry(key);
    let model: ProgressModel | null = null;
    if (key !== null && entry?.parsed && PROG.levels) model = progressModel(key);
    renderSide(model);
    $('#results').innerHTML = '';
    $('#banner').innerHTML = '';
    if (!entry) {
        main.innerHTML = '';
    } else if (entry.error) {
        const name = escapeHtml(baseName(entry.path));
        const failure = `<div class="err">Failed to parse: ${escapeHtml(entry.error)}</div>`;
        const firstBytes = hexDump(entry.buf ?? new Uint8Array(), 256);
        const details = `<details><summary>First bytes</summary><pre class="mono">${firstBytes}</pre></details>`;
        main.innerHTML = `<h2>${name}</h2>${failure}${details}`;
    } else if (!model) {
        main.innerHTML = '<div class="err">This build has no level data.</div>';
    } else {
        renderProgress(model);
    }

    if (state.pickerHelp) $('#banner').insertAdjacentHTML('beforeend', pickerHelpHtml());
    if (state.loadError) {
        $('#banner').insertAdjacentHTML('beforeend', `<div class="err">${escapeHtml(state.loadError)}</div>`);
    }

    if (fresh) {
        main.scrollTop = 0;
        scrollTo(0, 0);
    } else {
        main.scrollTop = top;
        scrollTo(0, windowTop);
        KEEP_SCROLL.forEach((selector, index) => {
            const element = $(selector);
            const scrolled = scrolls[index];
            if (element && scrolled != null) element.scrollTop = scrolled;
        });
    }

    restoreFocus(activePath, caret, fresh);
}

// a redraw that only reuses worked-out progress needs no note
function drawIsQuick(): boolean {
    const key = state.camp;
    if (key === null || !PROG.levels) return true;
    return progressReady(key);
}

// the note over the map while a save is worked out; the header's live dot shows it too
function setWorkingNote(text: string | null): void {
    const note = $('#working');
    note.textContent = text ?? '';
    note.hidden = text === null;
    document.body.classList.toggle('working', text !== null);
}

setPageDrawing({ draw: drawPage, quick: drawIsQuick, note: setWorkingNote });
