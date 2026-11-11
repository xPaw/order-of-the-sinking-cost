// The sidebar's Find on the map: a row per kind of mark, its icon showing or hiding the kind on the map and its name
// listing the items in the results column (viewer.md "The page (viewer)")
import { escapeHtml } from '../util.ts';
import { hooks } from '../shared.ts';
import type { ProgressFilters } from '../shared.ts';
import { findSectionOpen } from './sections.ts';
import { CHEVRON, checkIcon, fogIcon, OVERLAY_ICONS } from '../map/icons.ts';
import { overlayOn } from '../map/map-html.ts';
import { findLabel, findLayerOf, FIND_KINDS, inFindLayer } from '../model/find-kinds.ts';
import type { FindKind } from '../model/find-kinds.ts';
import { layerName } from '../model/layers.ts';
import type { ProgressModel } from '../model/progress-model.ts';
import { countOf, layerSplit } from '../model/totals.ts';
import type { FoundOfTotal } from '../model/totals.ts';
import { uncoveredOf } from '../model/uncovered.ts';
import { percent } from '../format.ts';

/** Whether the results column shows a kind's list: an open panel covers it. */
export function findListShown(filters: ProgressFilters, kind: string): boolean {
    if (filters.find !== kind) return false;
    if (hooks.panelOpen) return !hooks.panelOpen();
    return true;
}

/** What a kind's icon button does: it names the kind, as "Hide signs on the map". */
export function overlayActionText(kind: FindKind, shown: boolean): string {
    const name = findLabel(kind).toLowerCase();
    if (shown) return `Hide ${name} on the map`;
    return `Show ${name} on the map`;
}

// a row: the icon button shows or hides the kind on the map, the name button lists its items beside found / total
function findRowHtml(
    kind: FindKind,
    label: string,
    [found, total]: FoundOfTotal,
    byLayer: string,
    listed: boolean,
    note = '',
): string {
    const done = total > 0 && found >= total;
    let className = 'sr';
    if (done) className += ' done';

    const shown = overlayOn[kind];
    if (shown) className += ' on';

    let iconClass = 'plain si';
    if (shown) iconClass += ' on';

    const action = overlayActionText(kind, shown);
    const iconAttributes = `data-overlay="${kind}" aria-pressed="${shown}" aria-label="${action}" title="${action}"`;
    const iconButton = `<button class="${iconClass}" ${iconAttributes}>${OVERLAY_ICONS[kind]}</button>`;

    let check = '';
    if (done) check = checkIcon;
    const count = `<span class="cnt">${check}${found} / ${total}${note}</span>`;
    const title = escapeHtml([byLayer, 'List them'].filter(Boolean).join(' · '));
    const nameAttributes = `data-find="${kind}" aria-pressed="${listed}" title="${title}"`;
    const nameButton = `<button class="plain sn" ${nameAttributes}><span class="n">${label}</span>${count}</button>`;
    return `<div class="${className}">${iconButton}${nameButton}</div>`;
}

// the share of the map uncovered, with the cleared screens per layer in its tooltip; a count, not a kind of mark
function uncoveredRowHtml(model: ProgressModel, scope: string | null): string {
    const { screens, byLayer } = uncoveredOf(model.fog, model.known, scope);
    const [cleared, total] = screens;
    if (total <= 0) return '';

    const done = cleared >= total;
    let className = 'sr on fogr';
    let check = '';
    if (done) {
        className += ' done';
        check = checkIcon;
    }

    const title = escapeHtml(`Screens cleared of fog · ${byLayer}`);
    const count = `<span class="cnt">${check}${percent(cleared, total)}</span>`;
    const name = `<span class="sn" title="${title}"><span class="n">Map uncovered</span>${count}</span>`;
    return `<div class="${className}"><span class="si">${fogIcon}</span>${name}</div>`;
}

// a kind's found / total and per-layer split: every layer's, or, for a goal of one layer, that layer's
function scopedCount(model: ProgressModel, kind: FindKind, scope: string | null): [FoundOfTotal, string] {
    if (scope === null) return [model.stats[kind], model.stats.by[kind]];

    const marks = model.marks[kind].filter(([layer]) => inFindLayer(scope, layer));
    return [countOf(marks), layerSplit(marks, model.known)];
}

export function sideFindHtml(model: ProgressModel): string {
    const scope = findLayerOf(model.goals, model.levels, model.goalFor(model.F.goal));
    const rows: string[] = [];

    for (const [kind, label] of FIND_KINDS) {
        const [count, byLayer] = scopedCount(model, kind, scope);
        if (count[1] <= 0) continue;

        let note = '';
        if (kind === 'signs') {
            const ready = model.readySignLayers.filter((layer) => inFindLayer(scope, layer)).length;
            if (ready > 0) note = ` · ${ready} to read`;
        }
        rows.push(findRowHtml(kind, label, count, byLayer, findListShown(model.F, kind), note));
    }

    rows.push(uncoveredRowHtml(model, scope));

    if (!rows.length) return '';

    // a goal of one layer names the heading after that layer
    let title = 'Find on the map';
    if (scope !== null) title = `${layerName(scope)} finds`;

    const headContent = `<span class="sh">${escapeHtml(title)}</span>${CHEVRON}`;
    const open = findSectionOpen();
    const head = `<button class="plain fold" data-fold="find" aria-expanded="${open}">${headContent}</button>`;
    if (!open) return head;
    return head + rows.join('');
}
