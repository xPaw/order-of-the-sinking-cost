// The progress view's events: clicks in the list, the chips and the panels, the sidebar's hooks into the view (open a
// level, frame a tower, an area or a totals row, name a revealed level), the list's arrow keys and the panel the
// address names (VIEWER.md "The page (viewer)")
import { PROG } from '../data.ts';
import { $ } from '../util.ts';
import { hooks } from '../shared.ts';
import type { PanelKey, PanelKind } from '../shared.ts';
import { overlayOn } from '../map/map-html.ts';
import type { SelectHow } from '../map/map-view.ts';
import { mapLayerOf } from '../model/layers.ts';
import { syncSide } from '../sidebar.ts';
import { findListShown } from '../sidebar/find.ts';
import type { PanelContext } from './context.ts';
import { cageItemOf, findItemOf } from './find-list.ts';
import type { FindItem } from './find-list.ts';
import { addressedIndex, hashDone, markHashDone, panelKeep, setHash } from './hash.ts';
import { applyFilters, markSelected, showLevelRow } from './list.ts';

// the chips in a panel that open another panel: data attribute, node kind
const PANEL_CHIPS: Array<[attribute: string, kind: PanelKind]> = [
    ['ptower', 'tower'],
    ['pgate', 'gate'],
    ['psign', 'sign'],
    ['pick', 'level'],
];

const isPanelKind = (value: string): value is PanelKind =>
    value === 'level' || value === 'tower' || value === 'gate' || value === 'sign';

/**
 * Clicks in the details panel: a layer note frames its steps on the map, a chip opens its node's panel, which Previous
 * leaves again.
 */
export function wireMapPanels(context: PanelContext): void {
    const map = context.map;
    if (!map) return;

    $('#pgSel').addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const layerNote = target.closest<HTMLElement>('[data-clayer]');
        if (layerNote) {
            const layerPoints = context.chainPoints.filter(
                (point) => mapLayerOf(point[2]) === layerNote.dataset.clayer,
            );
            map.fitPoints(layerPoints);
            return;
        }

        const areaChip = target.closest<HTMLElement>('[data-parea]');
        if (areaChip) {
            map.fitPoints([PROG.areas[Number(areaChip.dataset.parea)].p]);
            return;
        }

        for (const [attribute, kind] of PANEL_CHIPS) {
            const chip = target.closest<HTMLElement>(`[data-${attribute}]`);
            if (chip) {
                if (context.current) context.back.push(context.current);
                context.selectors[kind](Number(chip.dataset[attribute]));
                return;
            }
        }

        if (target.closest('[data-back]')) {
            const previous = context.back.pop();
            if (previous) context.open(previous);
        }
    });

    // a panel opened from the map starts a new panel history
    const openFresh = (kind: PanelKind) => (id: number) => {
        context.back.length = 0;
        context.selectors[kind](id);
        scrollToDetail();
    };

    map.onPick = openFresh('level');
    map.onTower = openFresh('tower');
    map.onGate = openFresh('gate');
    map.onSign = openFresh('sign');
}

// in narrow windows the results column sits above the map and the page scrolls: a framed tower brings the map into
// view, an opened panel brings its column into view
const scrollToMap = (): void => $('#pgMap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

function scrollToDetail(): void {
    $('#pgDetail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showOnMap(context: PanelContext, kind: PanelKind, id: number, how?: SelectHow): void {
    if (!context.map) return;

    context.selectors[kind](id, how);
    scrollToDetail();
}

// a revealed level gets its name everywhere: list, tooltips and the open panel
function revealed(context: PanelContext): void {
    if (context.mapOptions) context.mapOptions.overlays = context.overlays();
    applyFilters(context);
    if (!context.current || !context.map?.open) return;

    const inPanel = $('#pgSel').contains(document.activeElement);
    context.open(context.current, { still: true });
    if (inPanel || document.activeElement === document.body) $('#pgSel .hd b')?.focus({ preventScroll: true });
}

function wireHooks(context: PanelContext): void {
    const filters = context.filters;
    // a tower goal frames its tower, leaving the list of its levels in the column
    hooks.tower = (towerIndex) => {
        context.map?.fitPoints([context.progress.towers[towerIndex].p]);
        scrollToMap();
    };
    hooks.open = (levelIndex) => {
        showLevelRow(context, levelIndex);
        showOnMap(context, 'level', levelIndex);
    };

    // an area picked in the sidebar is framed by all of its levels not under fog, whatever the list filter keeps
    hooks.area = () => {
        const points = context.levels
            .filter(
                (_level, levelIndex) =>
                    !context.progress.hidden[levelIndex] &&
                    String(context.model.levelArea[levelIndex] ?? '') === filters.area,
            )
            .map((level) => level.p);
        if (context.map && points.length) context.map.fitPoints(points);
    };

    hooks.hero = () => context.map?.showHero();
    hooks.overlay = (kind) => {
        context.map?.setOverlay(kind, !overlayOn[kind]);
        syncSide(filters);
    };

    hooks.list = () => context.map?.select(null);

    // naming the listed kind again goes back to the goal's levels; while a panel covers the list, it only closes the panel
    hooks.find = (kind) => {
        const covered = filters.find === kind && !findListShown(filters, kind);
        context.map?.select(null);
        if (covered) return;

        if (filters.find === kind) filters.find = '';
        else filters.find = kind;
        applyFilters(context, false);
    };

    hooks.reveal = () => revealed(context);
}

// the row an arrow, Home or End key moves the focus to
function rowIndexFor(key: string, at: number, count: number): number {
    let index = at - 1;
    if (key === 'Home') index = 0;
    else if (key === 'End') index = count - 1;
    else if (key === 'ArrowDown') index = at + 1;
    return Math.max(0, Math.min(count - 1, index));
}

// the list is one tab stop: the focused row takes it, the arrow keys move between rows
function wireRowKeys(): void {
    const rows = $('#pgRows');
    rows.addEventListener('focusin', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const row = target.closest<HTMLElement>('.rr');
        if (!row) return;

        rows.querySelectorAll<HTMLElement>('.rr[tabindex="0"]').forEach((each) => {
            each.tabIndex = -1;
        });
        row.tabIndex = 0;
    });

    rows.addEventListener('keydown', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const focused = target.closest<HTMLElement>('.rr');
        if (!focused || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

        const all = [...rows.querySelectorAll<HTMLElement>('.rr')];
        const at = all.indexOf(focused);
        event.preventDefault();
        all[rowIndexFor(event.key, at, all.length)].focus();
    });
}

// centres the map on a listed item and opens its panel; a kind without a panel only highlights the mark, whose tooltip
// shows on hover
function openFindItem(context: PanelContext, item: FindItem): void {
    const map = context.map;
    if (!map) return;

    // a mark on the fast-travel screen has no layer and nothing to centre on
    if (item.layer) map.frameAt(item.layer, item.x, item.y);
    context.back.length = 0;
    if (item.panel) {
        const [kind, id] = item.panel;
        context.selectors[kind](id, { still: true });
        return;
    }

    markSelected(context, null);
    context.forget();
    map.select({ levels: new Set(), overlays: new Set([item.id]) }, { still: true });
}

const CLICK_TARGET_ATTRIBUTES = [
    'data-goto',
    'data-find-item',
    'data-find-back',
    'data-find-done',
    'data-sel',
    'data-clear-area',
    'data-clear-tower',
    'data-solved',
];
const CLICK_TARGETS = CLICK_TARGET_ATTRIBUTES.map((attribute) => `[${attribute}]`).join(',');

function onPageClick(context: PanelContext, event: Event): void {
    const eventTarget = event.target;
    if (!(eventTarget instanceof Element)) return;

    const target = eventTarget.closest<HTMLElement>(CLICK_TARGETS);
    if (!target) return;

    const filters = context.filters;
    const data = target.dataset;
    if (data.goto != null) {
        context.map?.select(null);
        showLevelRow(context, data.goto, true);
    } else if (data.findItem != null) {
        // the goal's list holds cages among its levels
        const kind = filters.find;
        let item: FindItem | undefined;
        if (kind === '') {
            item = cageItemOf(context, data.findItem);
        } else {
            item = findItemOf(context, kind, data.findItem);
        }

        if (item) openFindItem(context, item);
    } else if (data.findBack != null) {
        filters.find = '';
        applyFilters(context, false);
    } else if (data.findDone != null) {
        filters.findDone = !filters.findDone;
        applyFilters(context, false);
    } else if (data.sel != null) {
        showOnMap(context, 'level', Number(data.sel), { keepFocus: true });
    } else if (data.solved != null) {
        filters.solved = data.solved === 'true';
        applyFilters(context);
    } else if (data.clearArea != null) {
        filters.area = '';
        applyFilters(context);
        $('#pgRows .rr[tabindex="0"]')?.focus({ preventScroll: true });
    } else if (data.clearTower != null) {
        filters.tower = '';
        applyFilters(context);
        $('#pgRows .rr[tabindex="0"]')?.focus({ preventScroll: true });
    }
}

// the search box applies its text once typing pauses, to the page drawn by then: a redraw meanwhile replaces the
// context the box was wired with
let searchTimer = 0;

function wireSearch(context: PanelContext): void {
    $('#fQ').addEventListener('input', (event) => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement)) return;

        const query = input.value.toLowerCase().trim();
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            context.filters.q = query;
            if (hooks.apply) hooks.apply();
        }, 120);
    });
}

export function wirePage(context: PanelContext): void {
    wireHooks(context);
    wireRowKeys();
    wireSearch(context);

    const onClick = (event: Event): void => onPageClick(context, event);

    for (const shell of [$('#main'), $('#results')]) {
        // oxlint-disable-next-line unicorn/prefer-add-event-listener -- the shell elements outlive a render and the handler replaces the last one
        shell.onclick = onClick;
    }
}

// whether a kept or addressed panel's thing exists for the save and is not under fog
function panelValid(context: PanelContext, [kind, id]: PanelKey): boolean {
    if (kind === 'level') return !context.progress.hidden[id];
    if (kind === 'tower') return !context.progress.towerHidden[id];
    if (kind === 'gate') return context.gateShown(context.freezers[id]);
    return context.model.signSet.has(id);
}

// the target of the address, when it names something that exists and is not under fog
function addressTarget(context: PanelContext): PanelKey | null {
    let found: RegExpExecArray | null = null;

    try {
        found = /^(level|tower|gate|sign)=(.+)$/.exec(decodeURIComponent(location.hash.slice(1)));
    } catch {}
    if (!found) return null;

    const [, kind, value] = found;
    if (!isPanelKind(kind)) return null;

    const id = addressedIndex(kind, value, context);
    const counts: Record<PanelKind, number> = {
        level: context.levels.length,
        tower: context.progress.towers.length,
        gate: context.freezers.length,
        sign: context.signs.length,
    };

    if (id >= 0 && id < counts[kind] && panelValid(context, [kind, id])) return [kind, id];
    return null;
}

// opens the panel the address names; an address naming nothing closes the open one
function fromAddress(context: PanelContext): void {
    const map = context.map;
    if (!map || context.model.demo) return;

    const target = addressTarget(context);
    if (!target) {
        if (!location.hash.slice(1) && map.open) map.select(null);
        return;
    }

    const current = context.current;
    if (current?.[0] === target[0] && current[1] === target[1]) return;

    const [kind, id] = target;
    if (kind === 'level') showLevelRow(context, id);

    const openers = { level: map.onPick, tower: map.onTower, gate: map.onGate, sign: map.onSign };
    openers[kind]?.(id);
    scrollToDetail();
}

/** The panel kept for the campaign opens again; on the first draw of a save, the one the address names. */
export function openKeptPanel(context: PanelContext): void {
    const map = context.map;
    const camp = context.camp;
    const kept = panelKeep[camp];
    const onAddress = (): void => fromAddress(context);
    hooks.hash = onAddress;
    if (map && kept && panelValid(context, kept)) {
        context.open(kept, { still: true });
        return;
    }

    if (kept) {
        delete panelKeep[camp];
        setHash('');
        return;
    }

    if (!map || context.model.demo) return;

    if (hashDone) {
        setHash('');
        return;
    }

    // the panel is fitted once the map has its final size
    map.ready(() => {
        if (hooks.hash !== onAddress) return;

        markHashDone();
        fromAddress(context);
        if (!context.current) setHash('');
    });
}
