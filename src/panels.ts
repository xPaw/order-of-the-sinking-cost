// The progress view: the results list, the map and its panels (VIEWER.md "The page (viewer)")
import { PROG } from './data.ts';
import { $ } from './util.ts';
import { hooks } from './shared.ts';
import type { Fog } from './fog.ts';
import { mapHtml, mapKeep, startLayer } from './map/map-html.ts';
import { mapInit } from './map/map-view.ts';
import type { MapOptions } from './map/map-view.ts';
import { oceanWater } from './map/ocean-water.ts';
import type { ProgressModel } from './model/progress-model.ts';
import { syncSide } from './sidebar.ts';
import { refreshSideGoals } from './sidebar/goals.ts';
import { bannerMessage, copyPath, folderAction, folderLabel, savePathHtml } from './folder.ts';
import { PanelContext } from './panels/context.ts';
import { applyFilters, layerChanged, markSelected } from './panels/list.ts';
import { areaLabels, levelMarkers, markerShown, markerStyle, overlaysOf, towerMarkers } from './panels/markers.ts';
import { showLevelPanel } from './panels/level-panel.ts';
import { showTowerPanel } from './panels/tower-panel.ts';
import { showGatePanel } from './panels/gate-panel.ts';
import { showSignPanel } from './panels/sign-panel.ts';
import { openKeptPanel, wireMapPanels, wirePage } from './panels/wiring.ts';

// the list and the details panel share one cell of the column: a panel covers the list, which keeps its scroll position
const RESULTS_HTML =
    '<div class="rlist" id="pgList">' +
    '<div class="rs"><input type="search" id="fQ" placeholder="Search levels…" aria-label="Search levels"></div>' +
    '<div class="rh" id="pgCount"></div>' +
    '<div class="fc" id="pgChips"></div>' +
    '<div class="rows" id="pgRows"></div>' +
    '</div>' +
    '<div class="rlist detail" id="pgDetail"><div class="sel" id="pgSel" hidden></div></div>';

// the example's banner: what the page is for, where the saves are and the open button
function bannerHtml(model: ProgressModel): string {
    if (!model.demo) return '';

    const text = `<span class="bt" id="bnText">${bannerMessage()}</span>`;
    const path = savePathHtml('id="bnCopy"');
    const openButton = `<button class="primary" id="bnOpen">${folderLabel()}</button>`;
    return `<div class="banner">${text}${path}${openButton}</div>`;
}

// the results column shows the open panel in place of the list, which the stylesheet keys on the attribute
function markPanelOpen(context: PanelContext): void {
    $('#results').toggleAttribute('data-panel', context.current !== null);
}

// the map with the goal's markers and overlays, and the panel of each node kind
function startMap(context: PanelContext): void {
    const progress = context.progress;
    context.overlays = () => overlaysOf(context);

    let fog: Fog | null = null;
    if (context.hide) fog = context.fog;
    const options: MapOptions = {
        panel: $('#pgSel'),
        markers: levelMarkers(context),
        towers: towerMarkers(context),
        labels: areaLabels(context),
        hero: context.model.hero,
        style: (marker) => markerStyle(context, marker),
        fog,
        reach: progress.reach?.cols,
        overlays: context.overlays(),
        keep: (overlay) => markerShown(overlay, context.filters.solved, context.goal?.kind === 'completionist'),
        water: oceanWater(progress.lt),
        onLayer: (layerKey) => layerChanged(context, layerKey),
        onOpen: () => {
            markPanelOpen(context);
            syncSide(context.filters);
        },
        onClose: () => {
            markSelected(context, null);
            context.forget();
            markPanelOpen(context);
            syncSide(context.filters);
        },
    };

    context.mapOptions = options;
    context.map = mapInit('pgMap', options);
    context.selectors.level = (levelIndex, how) => showLevelPanel(context, levelIndex, how);
    context.selectors.tower = (towerIndex, how) => showTowerPanel(context, towerIndex, how);
    context.selectors.gate = (freezerIndex, how) => showGatePanel(context, freezerIndex, how);
    context.selectors.sign = (signIndex, how) => showSignPanel(context, signIndex, how);
    wireMapPanels(context);
}

export function renderProgress(model: ProgressModel): void {
    const context = new PanelContext(model);
    const { progress, filters } = context;

    // a tower or area under fog is no filter
    if (filters.tower !== '' && progress.towerHidden[Number(filters.tower)]) filters.tower = '';
    if (filters.area !== '' && !model.areaShown(Number(filters.area))) filters.area = '';

    let mapFog: Fog | null = null;
    if (context.hide) mapFog = context.fog;
    $('#banner').innerHTML = bannerHtml(model);
    $('#main').innerHTML = PROG.map ? mapHtml('pgMap', mapFog, !!progress.reach) : '';
    $('#results').innerHTML = RESULTS_HTML;
    markPanelOpen(context);
    $('#bnOpen')?.addEventListener('click', () => void folderAction());
    $('#bnCopy')?.addEventListener('click', (event) => void copyPath(event));
    context.loadGoal();
    context.computeMatches();
    if (PROG.map) context.mapLayer = startLayer(mapKeep('pgMap'), mapFog, model.hero);
    hooks.apply = (redraw) => applyFilters(context, redraw);
    hooks.panelOpen = () => context.current !== null;
    if (PROG.map) startMap(context);
    wirePage(context);
    if (context.map) context.mapLayer = context.map.layer;
    applyFilters(context);
    refreshSideGoals();
    openKeptPanel(context);
}
