// The results list: the goal's levels in groups or a search's matches, the chips that narrow it, its count, and showing a
// level in it (VIEWER.md "The page (viewer)")
import { $, escapeHtml } from '../util.ts';
import { clearNarrowing } from '../shared.ts';
import { areaEmblemHtml, roleDot, ROLES, towerEmblemHtml } from '../map/icons.ts';
import { areaName } from '../model/areas.ts';
import { stateLabel } from '../model/progress.ts';
import { towerName } from '../model/towers.ts';
import type { TowerProgress } from '../model/towers.ts';
import type { Area } from '../types.ts';
import { syncSide } from '../sidebar.ts';
import { refreshSideGoals } from '../sidebar/goals.ts';
import type { ListedLevel, PanelContext } from './context.ts';
import { drawFindList, rankCageGroupHtml } from './find-list.ts';
import { layerTagHtml, levelPadHtml, wrappable } from './plan-chips.ts';
import { approxTip, whyText } from './why.ts';

type ListGroup = ListedLevel['group'];

/** The levels of one group of the list in the order they are listed. */
interface RowBlock {
    group: ListGroup;
    shown: number[];
}

// the list's groups in order, as the model groups its levels; the solved ones show with the Solved toggle on
const GROUP_ORDER: ListGroup[] = ['playable', 'blocked', 'locked', 'solved'];

const GROUP_HEADS: Record<ListGroup, string> = {
    playable: 'Play now',
    blocked: 'Not reachable yet',
    locked: 'Locked',
    solved: 'Solved',
};

export const NEAR = '<span class="muted" title="Outside every area box; grouped with the nearest area">≈ </span>';

// a search row is the level alone; a goal row also tells the level's role and where it leads
function rowHtml(context: PanelContext, levelIndex: number, tab: boolean): string {
    const level = context.levels[levelIndex];
    const levelState = context.progress.state[levelIndex];
    let entry: ListedLevel | undefined;
    if (!context.searching()) entry = context.entries.get(levelIndex);

    const role = entry?.role ?? null;
    const leadsTo = entry?.leadsTo ?? '';
    const areaIndex = context.areaOf(levelIndex);
    let area = '';
    let emblem = '';
    if (areaIndex != null) {
        area = areaName(context.areas[areaIndex]);
        emblem = areaEmblemHtml(context.areas[areaIndex]);
    }

    let where = '';
    if (area) {
        if (level.areaNear) where = NEAR;
        where += emblem + escapeHtml(area);
    }

    let layerTag = '';
    if (context.mapLayer && !context.inView(levelIndex)) {
        layerTag = layerTagHtml(context.layerOf(levelIndex));
    }

    // the level's own area is left off when the text already ends with it
    let line = where;
    if (leadsTo) {
        line = escapeHtml(leadsTo);
        if (where && !leadsTo.endsWith(area)) line += ' · ' + where;
    }

    let why = '';
    if (entry?.group === 'blocked') why = whyText(context, levelIndex);

    let roleText = '';
    if (role) roleText = ROLES[role][0];

    let leadsText = '';
    if (leadsTo) leadsText = '→ ' + leadsTo;

    const stateText = stateLabel(context.progress, levelState);
    const tip = [stateText, roleText, leadsText, why, area].filter(Boolean).join(' · ');

    const classes = ['plain', 'rr'];
    if (!role) classes.push('nr');
    if (context.selected === levelIndex) classes.push('on');

    let tabIndex = -1;
    if (tab) tabIndex = 0;

    const title = escapeHtml(tip);
    const attributes = `id="pg-${levelIndex}" data-sel="${levelIndex}" tabindex="${tabIndex}" title="${title}"`;
    const dots = levelPadHtml(context.progress, levelIndex) + roleDot(role);
    const name = `<span class="nm">${wrappable(level.n)}</span>`;
    const areaLine = `<span class="ar">${layerTag}${line}</span>`;
    return `<button class="${classes.join(' ')}" ${attributes}>${dots}${name}${areaLine}</button>`;
}

// the listed levels per group: the ones on the goal's cheapest plans first, then the one-of levels that could stand in
// for them
function layoutRows(context: PanelContext): RowBlock[] {
    const isOffPlan = (levelIndex: number): boolean => context.isOffPlan(levelIndex);
    const blocks: RowBlock[] = [];

    for (const group of GROUP_ORDER) {
        const members = context.list.filter((levelIndex) => context.entryOf(levelIndex).group === group);
        if (!members.length) continue;

        const onPlan = members.filter((levelIndex) => !isOffPlan(levelIndex));
        const offPlan = members.filter(isOffPlan);
        blocks.push({ group, shown: [...onPlan, ...offPlan] });
    }

    return blocks;
}

function groupHead(context: PanelContext, group: ListGroup): string {
    if (group === 'blocked') return `<span title="${approxTip(context)}">${GROUP_HEADS[group]}</span>`;
    return GROUP_HEADS[group];
}

function rowsHtml(context: PanelContext, blocks: RowBlock[], tab: number | undefined): string {
    return blocks
        .map((block) => {
            const title = groupHead(context, block.group);
            const head = `<div class="rg">${title} <span class="c muted">· ${block.shown.length}</span></div>`;
            const rows = block.shown.map((levelIndex) => rowHtml(context, levelIndex, levelIndex === tab));
            return head + rows.join('');
        })
        .join('');
}

function emptyHtml(context: PanelContext): string {
    const goal = context.goal;
    if (!goal) return '<div class="none muted">Working out the goals…</div>';

    if (context.searching() || context.narrowed()) return '<div class="none muted">No levels match</div>';
    if (context.filters.solved) return '<div class="none muted">No solved levels yet.</div>';
    if (goal.done) return `<div class="none muted">${escapeHtml(goal.label)} is done.</div>`;
    if (goal.fogged) return '<div class="none muted">Nothing to show yet; more is under fog.</div>';
    return `<div class="none muted">No levels left for ${escapeHtml(goal.label)}.</div>`;
}

// the chips above the list: the tower and area chips, removable; a search ignores them and hides them
function chipsHtml(context: PanelContext): string {
    if (!context.goal || context.searching()) return '';

    const filters = context.filters;
    let area: Area | undefined;
    if (filters.area !== '') area = context.areas[Number(filters.area)];

    let tower: TowerProgress | undefined;
    if (filters.tower !== '') tower = context.progress.towers[Number(filters.tower)];

    const closeMark = '<span aria-hidden="true">×</span>';
    let html = '';
    if (tower) {
        const name = towerEmblemHtml(tower) + escapeHtml(towerName(tower.t));
        const attributes = 'data-clear-tower title="Show every tower"';
        html += `<button class="plain chip rm" ${attributes}>${name} ${closeMark}</button>`;
    }

    if (area) {
        const name = areaEmblemHtml(area) + escapeHtml(areaName(area));
        const attributes = 'data-clear-area title="Show every area"';
        html += `<button class="plain chip rm" ${attributes}>${name} ${closeMark}</button>`;
    }

    return html;
}

// the heading above the list: the search's count, or the goal with what is left of it or solved, and the To do | Solved
// toggle (a search lists every level, so it has no toggle)
function countHtml(context: PanelContext): string {
    const goal = context.goal;
    if (!goal) return '';

    const count = context.list.length;
    if (context.searching()) {
        let noun = 'levels';
        if (count === 1) noun = 'level';
        return `<span>${count} ${noun}</span>`;
    }

    const solvedShown = context.filters.solved;
    let quantity = `${count} left`;
    if (solvedShown) quantity = `${count} solved`;

    const toggle = (id: string, solved: boolean, label: string): string => {
        let onClass = '';
        if (solved === solvedShown) onClass = ' class="on"';
        const attributes = `id="${id}" data-solved="${solved}" aria-pressed="${solved === solvedShown}"`;
        return `<button${onClass} ${attributes}>${label}</button>`;
    };

    const todoButton = toggle('pgTodo', false, 'To do');
    const solvedButton = toggle('pgSolved', true, 'Solved');
    const keys = `<span class="keys">${todoButton}${solvedButton}</span>`;
    return `<span><b>${escapeHtml(goal.label)}</b> · ${quantity}</span>${keys}`;
}

// the levels in the rows, with the count and the chips that narrow them: a search lists the matches by name, the goal
// lists its levels by group
function drawGoalList(context: PanelContext): void {
    let blocks: RowBlock[] = [];
    let visible = context.list;
    if (!context.searching()) {
        blocks = layoutRows(context);
        visible = blocks.flatMap((block) => block.shown);
    }

    let tab: number | undefined = visible[0];
    if (context.selected !== null && visible.includes(context.selected)) tab = context.selected;

    let rows = '';
    if (context.searching()) {
        const matchRows = visible.map((levelIndex) => rowHtml(context, levelIndex, levelIndex === tab));
        rows = matchRows.join('');
    } else {
        rows = rowsHtml(context, blocks, tab);
    }

    // the ice cages the rank opens follow the goal's levels in the list of what is to do
    let cages = '';
    if (!context.searching() && !context.narrowed() && !context.filters.solved) {
        cages = rankCageGroupHtml(context, !rows);
    }

    // a search lists every level, so any level under fog is more; the goal's list counts its own levels only
    let moreFogged = false;
    if (context.searching()) {
        moreFogged = context.model.hiddenLevelCount > 0;
    } else if (context.goal && !context.filters.solved) {
        moreFogged = context.model.goalLevelsFogged(context.goal);
    }

    let foot = '';
    if (moreFogged) foot = `<div class="foot muted">More levels under fog</div>`;

    $('#pgRows').innerHTML = (rows || emptyHtml(context)) + cages + foot;
    $('#pgCount').innerHTML = countHtml(context);
    $('#pgChips').innerHTML = chipsHtml(context);
}

// the list shows the goal's levels, or the items of the kind of mark the sidebar named
function drawList(context: PanelContext): void {
    const active = document.activeElement;
    let refocus: string | null = null;
    if (active?.id && (active.closest('#pgRows') || active.closest('#pgChips') || active.closest('#pgCount'))) {
        refocus = active.id;
    }

    const kind = context.filters.find;
    if (kind === '') {
        $('#pgList').dataset.mode = 'goal';
        drawGoalList(context);
    } else {
        $('#pgList').dataset.mode = 'find';
        drawFindList(context, kind);
    }

    if (refocus) document.getElementById(refocus)?.focus({ preventScroll: true });
}

/** Marks the map's selected level in the list and scrolls it into view there. */
export function markSelected(context: PanelContext, levelIndex: number | null): void {
    context.selected = levelIndex;
    const rows = $('#pgRows');
    rows.querySelectorAll('.rr.on').forEach((row) => row.classList.remove('on'));
    if (levelIndex === null) return;

    const row = $('#pg-' + levelIndex);
    if (!row) return;

    row.classList.add('on');

    // only the list scrolls, centering the row; scrolling the page would push the map's panel out of view
    if (row.offsetTop < rows.scrollTop || row.offsetTop + row.offsetHeight > rows.scrollTop + rows.clientHeight) {
        rows.scrollTop = row.offsetTop - (rows.clientHeight - row.offsetHeight) / 2;
    }
}

/** The filter changed: the goal, the list and the map's markers follow. */
export function applyFilters(context: PanelContext, redraw = true): void {
    const before = context.goal?.key;
    context.loadGoal();
    const goalChanged = context.goal?.key !== before;

    context.computeMatches();
    context.list = context.listedLevels();

    syncSide(context.filters);
    drawList(context);

    const map = context.map;
    if (map) {
        if (goalChanged && context.mapOptions) context.mapOptions.overlays = context.overlays();
        if (redraw) map.redraw();
    }

    // the open panel names its level's role for the goal
    if (goalChanged && context.current && map?.open) context.open(context.current, { still: true });
}

/** The map changed layer: the lists follow it. */
export function layerChanged(context: PanelContext, layerKey: string): void {
    context.mapLayer = layerKey;
    applyFilters(context, false);

    refreshSideGoals();
    if (context.selected !== null) markSelected(context, context.selected);
}

// shows a level the list does not keep: the search and the chips go, the toggle follows the level's being solved, and a
// level the goal has no use for brings in Completionist, which lists every level
function showInList(context: PanelContext, levelIndex: number): void {
    clearNarrowing(context.filters);
    context.filters.solved = context.progress.state[levelIndex] === 'solved';
    applyFilters(context);
    if (context.match(levelIndex)) return;

    context.filters.goal = 'completionist';
    applyFilters(context);
    refreshSideGoals();
}

/**
 * Shows a level in the list: marks and flashes its row; toList (the list was asked for) first clears the search and the
 * chips that hide it and also brings the list into the page view (it sits above the map in narrow windows) and
 * focuses the row.
 */
export function showLevelRow(context: PanelContext, id: number | string, toList?: boolean): void {
    const levelIndex = Number(id);
    if (!context.match(levelIndex)) {
        if (!toList) {
            markSelected(context, null);
            return;
        }

        showInList(context, levelIndex);
    }

    markSelected(context, levelIndex);

    const row = $('#pg-' + levelIndex);
    if (!row) return;

    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 1200);
    if (toList) {
        $('.rlist').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        row.focus({ preventScroll: true });
    }
}
