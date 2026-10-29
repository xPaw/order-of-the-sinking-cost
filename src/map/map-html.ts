// The map's markup before it is drawn (VIEWER.md "The page (viewer)"): the holder of the layer images under the svg, the
// fog and hatch groups, the repeated copies, the buttons over the map; the overlay switches and the view kept per campaign
import { PROG } from '../data.ts';
import type { Fog } from '../fog.ts';
import { AREA_LAYERS, layerName, mapLayerOf } from '../model/layers.ts';
import { ZOOM_STEP } from '../panzoom.ts';
import type { PanZoomKeep } from '../panzoom.ts';
import { readPreference, state } from '../shared.ts';
import type { MapLayer } from '../types.ts';
import { escapeHtml } from '../util.ts';
import { OVERLAY_ICONS } from './icons.ts';
import type { MapOverlay, MapPoint } from './map-view.ts';
import { wrapCopies } from './torus.ts';

/**
 * The kinds of mark the viewer can switch off: each has a row in the sidebar's Find on the map, and Reachable is the
 * toolbar's. The Tower pads switch also shows the gold rooms' Antipode endpoints.
 */
export type OverlayKind = 'pods' | 'doorways' | 'signs' | 'tps' | 'towerPads' | 'logs' | 'maps' | 'treasures' | 'reach';

/** What survives a redraw of one map: its view, the layer shown and the campaign it was for. */
export interface MapKeep extends PanZoomKeep {
    camp?: string | null;
    layer?: string;
}

const WATER_RGB = [51, 104, 139];

const REACH_TITLE = 'Where the walk model says you can go from where you have been (approximate)';

// whether each kind of mark the viewer can switch off is shown, remembered per browser
export const overlayOn: Record<OverlayKind, boolean> = {
    pods: true,
    doorways: true,
    signs: true,
    tps: true,
    towerPads: true,
    logs: true,
    maps: true,
    treasures: true,
    reach: true,
};

export const isOverlayKind = (kind: string): kind is OverlayKind => kind in overlayOn;

/** The switch that shows or hides a mark: the one of its Find kind, else of its own kind. */
export function switchOf(overlay: Pick<MapOverlay, 'kind' | 'findKind'>): OverlayKind | null {
    if (overlay.findKind !== null) return overlay.findKind;
    if (isOverlayKind(overlay.kind)) return overlay.kind;
    return null;
}

try {
    const saved: Partial<Record<OverlayKind, unknown>> = JSON.parse(readPreference('mapOverlays') || '{}');
    for (const kind of Object.keys(overlayOn)) {
        if (!isOverlayKind(kind)) continue;

        const value = saved[kind];
        if (typeof value === 'boolean') overlayOn[kind] = value;
    }
} catch {}

// the terrain group: the changed water, the Reachable images and the fog, clipped to the map
function terrainHtml(id: string, layers: MapLayer[], reach: boolean): string {
    const [width, height] = PROG.map.size;
    const size = `width="${width}" height="${height}"`;

    let reachImages = '';
    let hatch = '';
    if (reach) {
        reachImages = layers
            .map((layer) => `<image class="reach" data-layer="${layer.key}" x="0" y="0" ${size} style="display:none"/>`)
            .join('');
        const hatchAttributes = [
            'class="hatch"',
            'patternUnits="userSpaceOnUse"',
            'width="1" height="1"',
            'patternTransform="rotate(45)"',
        ].join(' ');
        hatch = `<pattern id="${id}-hatch" ${hatchAttributes}><rect width="0.2" height="1"/></pattern>`;
    }

    const cloudBox = `x="${-2 * width}" y="${-2 * height}" width="${5 * width}" height="${5 * height}"`;
    const blur = '<feGaussianBlur stdDeviation="2.2"/>';
    const cloud = `<filter id="${id}-cloud" filterUnits="userSpaceOnUse" ${cloudBox}>${blur}</filter>`;
    const clip = `<clipPath id="${id}-clip"><rect x="0" y="0" ${size}/></clipPath>`;
    const cloudGroup = `<g class="fog" filter="url(#${id}-cloud)" style="stroke: var(--fog)"></g>`;
    const fogGroups = `${cloudGroup}<g class="fogc"></g><g class="rfog" fill="url(#${id}-hatch)"></g>`;
    const fog = `${clip}<g clip-path="url(#${id}-clip)">${fogGroups}</g>`;
    const waterGroup = `<g class="wtr" fill="rgb(${WATER_RGB.join(',')})" shape-rendering="crispEdges"></g>`;
    return `<g id="${id}-w" class="mw">${waterGroup}${reachImages}<defs>${cloud}${hatch}</defs>${fog}</g>`;
}

// the buttons floating over the map: the layers as one segmented pill in area order, the Reachable switch and the zoom
// pill
function controlsHtml(layers: MapLayer[]): string {
    const layerButtons = layers
        .toSorted((first, second) => AREA_LAYERS.indexOf(first.key) - AREA_LAYERS.indexOf(second.key))
        .map((layer) => `<button data-layer="${layer.key}">${escapeHtml(layerName(layer.key))}</button>`)
        .join('');
    const reachAttributes = `data-ov="reach" title="${REACH_TITLE}"`;
    const reachButton = `<button ${reachAttributes}>${OVERLAY_ICONS.reach}Reachable</button>`;
    const zoomIn = `<button data-z="${1 / ZOOM_STEP}" title="Zoom in">+</button>`;
    const zoomOut = `<button data-z="${ZOOM_STEP}" title="Zoom out">−</button>`;
    const layersHidden = layers.length < 2 ? ' hidden' : '';

    const layerGroup = `<span class="keys" data-role="layers"${layersHidden}>${layerButtons}</span>`;
    const reachGroup = `<span class="seg ovl" data-role="ovl" hidden>${reachButton}</span>`;
    const zoomGroup = `<span class="keys zoom">${zoomIn}${zoomOut}</span>`;
    return `<div class="ctl">${layerGroup}${reachGroup}${zoomGroup}</div>`;
}

/**
 * The markup of the map `id`. `fog`: the fog to hide; layers it has not uncovered get no image and no button. `reach`:
 * whether to include the Reachable overlay images (hidden until mapInit gets the bitmaps in opts.reach).
 */
export function mapHtml(id: string, fog: Fog | null | undefined, reach: boolean): string {
    const [width, height] = PROG.map.size;
    const known = knownLayers(fog);
    const layers = PROG.map.layers.filter((layer) => !known || known.includes(layer.key));

    const terrain = `${terrainHtml(id, layers, reach)}${wrapCopies(id, 'w', width, height)}`;
    const overlay = `<g id="${id}-o" class="mw"><g class="ov"></g></g>${wrapCopies(id, 'o', width, height)}`;
    const svgOpen = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">`;
    const svg = `${svgOpen}${terrain}${overlay}<g class="mw lbl"></g></svg>`;

    const terrainImages = '<div class="terrain"></div>';
    return `<div class="mapbox" id="${id}">${controlsHtml(layers)}\n    ${terrainImages}${svg}\n    <div class="tip"></div></div>`;
}

/** The view and layer of each map, by map id. */
export const mapViews: Record<string, MapKeep> = {};

/** The view and layer survive redraws of one campaign's map; another campaign starts fresh. */
export function mapKeep(id: string): MapKeep {
    let keep = mapViews[id];
    if (!keep) {
        keep = {};
        mapViews[id] = keep;
    }

    if (keep.camp !== state.camp) {
        delete keep.vb;
        delete keep.moved;
        delete keep.layer;
        keep.camp = state.camp;
    }

    return keep;
}

/** With fog shown, the map layers the player has uncovered (ground before any); null without fog. */
export function knownLayers(fog: Fog | null | undefined): string[] | null {
    if (!fog) return null;

    const known = fog.knownLayers();
    if (known.length) return known;
    return ['ground'];
}

/**
 * The layer a map opens on: the remembered one, else the hero's, else ground, and with fog shown one the player has
 * uncovered.
 */
export function startLayer(keep: MapKeep, fog: Fog | null | undefined, hero: MapPoint | null | undefined): string {
    const known = knownLayers(fog);
    let layer = 'ground';
    if (keep.layer) layer = keep.layer;
    else if (hero) layer = mapLayerOf(hero.z);
    if (known && !known.includes(layer)) return known[0];
    return layer;
}

/** The layer the progress map shows for the current campaign, null before it is drawn. */
export function viewLayer(): string | null {
    if (mapViews.pgMap?.camp !== state.camp) return null;
    return mapViews.pgMap.layer || null;
}
