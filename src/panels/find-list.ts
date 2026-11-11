// The list of one kind of mark in the results column, in place of the goal's levels: what is left to do first, then the
// done ones when asked for (viewer.md "The page (viewer)")
import { $, compareText, escapeHtml, setHtml } from '../util.ts';
import type { PanelKey } from '../shared.ts';
import { iconHtml } from '../map/icons.ts';
import type { IconName } from '../map/icons.ts';
import type { MapOptions, MapOverlay, MapTower } from '../map/map-view.ts';
import { findLabel, findLayerOf, inFindLayer } from '../model/find-kinds.ts';
import type { FindKind } from '../model/find-kinds.ts';
import { areaName } from '../model/areas.ts';
import { isDoorway } from '../model/freezer-names.ts';
import { AREA_LAYERS, mapLayerOf } from '../model/layers.ts';
import { rankCages } from '../model/rank-cages.ts';
import { towerName } from '../model/towers.ts';
import type { PanelContext } from './context.ts';
import { layerTagHtml, NEAR } from './plan-chips.ts';

/** A mark of the kind as the list shows it. */
export interface FindItem {
    id: string;
    icon: IconName;
    /** The area it is in, else the nearest level's area; for a tower's pad, the tower. */
    place: string;
    /** Whether `place` is the nearest level's area, the mark being outside every area. */
    areaNear: boolean;
    /** The nearest level not under fog, which tells the marks of one place apart; -1 for none. */
    nearLevel: number;
    state: string;
    done: boolean;
    layer: string;
    x: number;
    y: number;
    /** The panel the item opens; null where the kind has none. */
    panel: PanelKey | null;
}

// where a mark is: the area it is in while that area is shown, else nothing; a mark on the fast-travel screen (two
// voice logs) is on no map layer
function placeOf(context: PanelContext, overlay: MapOverlay): string {
    if (overlay.place !== undefined) return overlay.place;

    const area = context.model.areaAt(overlay.position);
    if (area !== null) return area;
    if (overlay.layer === undefined) return 'Fast-travel screen';
    return '';
}

// a tower's mark is named by its tower, and a mark on the fast-travel screen is on no layer, so no level is near it
function overlayItem(context: PanelContext, overlay: MapOverlay): FindItem {
    let nearLevel = -1;
    if (overlay.panel?.[0] !== 'tower' && overlay.layer !== undefined) {
        nearLevel = context.model.nearestShownLevel(overlay.x, overlay.y, overlay.layer);
    }

    // outside every area, a mark is grouped with its nearest level's area, as that level is
    let place = placeOf(context, overlay);
    let areaNear = false;
    if (!place && nearLevel >= 0) {
        const area = context.areaOf(nearLevel);
        if (area !== null) {
            place = areaName(context.areas[area]);
            areaNear = true;
        }
    }

    return {
        id: overlay.id,
        icon: overlay.icon,
        place,
        areaNear,
        nearLevel,
        state: overlay.state,
        done: overlay.done,
        layer: overlay.layer,
        x: overlay.x,
        y: overlay.y,
        panel: overlay.panel ?? null,
    };
}

function towerPadItem(context: PanelContext, tower: MapTower): FindItem {
    let state = 'Not discovered';
    if (tower.padFound) state = 'Discovered';

    return {
        id: 'w' + tower.towerIndex,
        icon: 'gold-room',
        place: towerName(context.progress.towers[tower.towerIndex].t),
        areaNear: false,
        nearLevel: -1,
        state,
        done: tower.padFound,
        layer: mapLayerOf(tower.z),
        x: tower.x,
        y: tower.y,
        panel: ['tower', tower.towerIndex],
    };
}

// the layer the map shows first, then the others in their order, each by place
function sortItems(context: PanelContext, items: FindItem[]): FindItem[] {
    const layerRank = (layer: string): number => {
        if (layer === context.mapLayer) return -1;
        return AREA_LAYERS.indexOf(layer);
    };

    return items.toSorted((first, second) => {
        const byLayer = layerRank(first.layer) - layerRank(second.layer);
        if (byLayer !== 0) return byLayer;
        return compareText(first.place, second.place);
    });
}

// the towers whose pads the Antipode pads list holds, beside the gold rooms' Antipode endpoints, which are overlays
function listedTowers(options: MapOptions, kind: FindKind): MapTower[] {
    if (kind !== 'towerPads') return [];
    return options.towers.filter((tower) => tower.onPad);
}

/** The marks of a kind that are not under fog. */
export function findItemsOf(context: PanelContext, kind: FindKind): FindItem[] {
    const options = context.mapOptions;
    if (!options) return [];

    // a goal of one layer lists that layer's marks only
    const scope = findLayerOf(context.model.goals, context.levels, context.goal);
    const overlays = options.overlays.filter(
        (overlay) => overlay.findKind === kind && inFindLayer(scope, overlay.layer),
    );
    const towers = listedTowers(options, kind).filter((tower) => inFindLayer(scope, mapLayerOf(tower.z)));
    const items = [
        ...overlays.map((overlay) => overlayItem(context, overlay)),
        ...towers.map((tower) => towerPadItem(context, tower)),
    ];

    return sortItems(context, items);
}

/** The listed mark of a kind with an id, without building the others; undefined for none. */
export function findItemOf(context: PanelContext, kind: FindKind, id: string): FindItem | undefined {
    const options = context.mapOptions;
    if (!options) return undefined;

    const overlay = options.overlays.find((each) => each.findKind === kind && each.id === id);
    if (overlay) return overlayItem(context, overlay);

    const tower = listedTowers(options, kind).find((each) => 'w' + each.towerIndex === id);
    if (tower) return towerPadItem(context, tower);
    return undefined;
}

// a row of the list; the note, when there is one, ends its text
function rowHtml(context: PanelContext, item: FindItem, tab: boolean, note = ''): string {
    let tabIndex = -1;
    if (tab) tabIndex = 0;

    // the layer is named as a tag when it is not the map's
    let layerTag = '';
    if (context.mapLayer && item.layer && item.layer !== context.mapLayer) layerTag = layerTagHtml(item.layer);

    let place = escapeHtml(item.place);
    if (item.areaNear) place = NEAR + place;

    // the marks of one place are told apart by the nearest level
    let near = '';
    if (item.nearLevel >= 0) {
        let separator = ' · ';
        if (!item.place) separator = '';
        near = `<span class="muted">${separator}near ${escapeHtml(context.levels[item.nearLevel].n)}</span>`;
    }

    let iconClass = '';
    if (item.done) iconClass = 'dn';

    const id = escapeHtml(item.id);
    const attributes = `id="pgf-${id}" data-find-item="${id}" tabindex="${tabIndex}"`;
    let noteText = '';
    if (note) noteText = ` <span class="muted">· ${escapeHtml(note)}</span>`;

    const state = `<span class="muted">· ${escapeHtml(item.state.toLowerCase())}</span>`;
    const name = `<span class="nm">${layerTag}${place}${near} ${state}${noteText}</span>`;
    return `<button class="plain rr fi" ${attributes}>${iconHtml(item.icon, iconClass)}${name}</button>`;
}

function groupHtml(context: PanelContext, title: string, items: FindItem[], first: boolean): string {
    const head = `<div class="rg">${title} <span class="c muted">· ${items.length}</span></div>`;
    const rows = items.map((item, index) => rowHtml(context, item, first && index === 0));
    return head + rows.join('');
}

// where a Sign is: its area while that area is shown, else the nearest level not under fog; empty for none
function signPlace(context: PanelContext, signIndex: number): string {
    const position = context.signs[signIndex].p;
    const area = context.model.areaAt(position);
    if (area !== null) return area;

    const nearest = context.model.nearestShownLevel(position[0], position[1], mapLayerOf(position[2]));
    if (nearest < 0) return '';
    return `near ${context.levels[nearest].n}`;
}

// the kind of mark a cage is listed under
function cageKindOf(gate: number): FindKind {
    if (isDoorway(gate)) return 'doorways';
    return 'pods';
}

/** The listed cage with an id ("g" and its index), whichever kind of cage it is; undefined for none. */
export function cageItemOf(context: PanelContext, id: string): FindItem | undefined {
    return findItemOf(context, 'pods', id) ?? findItemOf(context, 'doorways', id);
}

/**
 * The group of the closed cages that the rank Signs opened by the rank reached list, for the ending being worked
 * toward: the cages that hold a Promesst_Light or a Mirror first, then the others, each by place. A cage whose Sign is
 * not read yet says so with the Sign's place. Empty where there is none.
 */
export function rankCageGroupHtml(context: PanelContext, first: boolean): string {
    const goal = context.goal;
    if (!goal || goal.kind !== 'ending' || !goal.active || goal.done) return '';

    const cages = rankCages({
        rank: context.status.rank,
        gateOpen: context.progress.gateOpen,
        gateShown: (gate) => context.gateShown(context.freezers[gate]),
        signShown: (signIndex) => context.model.signSet.has(signIndex),
    });

    const notes = new Map<string, string>();
    const liftPieces: FindItem[] = [];
    const others: FindItem[] = [];
    for (const cage of cages) {
        const item = findItemOf(context, cageKindOf(cage.gate), 'g' + cage.gate);
        if (!item) continue;

        if (!context.progress.signRead(context.signs[cage.sign].pid)) {
            const place = signPlace(context, cage.sign);
            let note = 'read its Sign';
            if (place && place !== item.place) note += ` · ${place}`;
            notes.set(item.id, note);
        }

        if (cage.liftPiece) {
            liftPieces.push(item);
        } else {
            others.push(item);
        }
    }

    const items = [...sortItems(context, liftPieces), ...sortItems(context, others)];
    if (!items.length) return '';

    const head = `<div class="rg">Cages your rank opens <span class="c muted">· ${items.length}</span></div>`;
    const rows = items.map((item, index) => rowHtml(context, item, first && index === 0, notes.get(item.id)));
    return head + rows.join('');
}

/** Draws the list of a kind into the results column's heading, chips and rows. */
export function drawFindList(context: PanelContext, kind: FindKind): void {
    const filters = context.filters;
    const items = findItemsOf(context, kind);
    const todo = items.filter((item) => !item.done);
    const done = items.filter((item) => item.done);

    const back = '<button class="plain lnk" data-find-back title="Back to the goal\'s levels">‹ Back</button>';
    const left = `<b>${escapeHtml(findLabel(kind))}</b> · ${todo.length} left`;
    setHtml($('#pgCount'), `<span class="fh">${back}<span>${left}</span></span>`);

    let pressedClass = '';
    if (filters.findDone) pressedClass = ' on';

    let disabled = '';
    if (!filters.findDone && !done.length) disabled = ' disabled';

    const chipAttributes = `data-find-done aria-pressed="${filters.findDone}"${disabled}`;
    const count = `<span class="n">${done.length}</span>`;
    setHtml($('#pgChips'), `<button class="plain chip st${pressedClass}" ${chipAttributes}>Done ${count}</button>`);

    let html = '';
    if (todo.length) html += groupHtml(context, 'Still to do', todo, true);
    if (filters.findDone && done.length) html += groupHtml(context, 'Done', done, !todo.length);
    if (!html) html = `<div class="none muted">Nothing left to find here.</div>`;
    setHtml($('#pgRows'), html);
}
