// The route section of a level, Freezer, Sign or tower panel: the chain of table needs that are left, as lines on the map,
// where it breaks and how to correct it (VIEWER.md "Level needs and pad routes")
import type { MapLink, MapStep } from '../map/map-view.ts';
import { capitalized, freezerNoun } from '../model/freezer-names.ts';
import { layerName, mapLayerOf } from '../model/layers.ts';
import { needChain } from '../model/need-chain.ts';
import type { ChainEnd, ChainStop, ChainTarget, ChainWorld, NeedChain } from '../model/need-chain.ts';
import type { Position, RouteNeed } from '../types.ts';
import { escapeHtml } from '../util.ts';
import type { PanelContext } from './context.ts';
import { signOn } from './plan-chips.ts';

const TABLE_FILE_URL = 'https://github.com/xPaw/order-of-the-sinking-cost/blob/main/scripts/lib/level-table.ts';

/** A panel's route text and what the map draws for it. */
export interface RouteSection {
    html: string;
    links: MapLink[];
    levels: number[];
    overlays: string[];
    steps: MapStep[];
}

// the Crossroads pad in the middle of each map layer
const LAYER_HUBS = new Map<string, Position>([
    ['ground', [80, 71, 0]],
    ['sky', [80, 72, 33]],
    ['underworld', [80, 68, -21]],
]);

// whether a need may show: what is under fog ends the chain without a word
function needShown(context: PanelContext, need: RouteNeed): boolean {
    if ('level' in need) return !context.progress.hidden[need.level];
    if ('freezer' in need) return context.gateShown(context.freezers[need.freezer]);
    if ('sign' in need) return signOn(context, need.sign);
    return true;
}

function chainWorld(context: PanelContext): ChainWorld {
    return {
        levels: context.levels,
        freezers: context.freezers,
        signs: context.signs,
        towers: context.towers,
        goldRooms: context.goldRooms,
        layerOf: mapLayerOf,
        hubs: LAYER_HUBS,
        shown: (need) => needShown(context, need),
        towerShown: (tower) => !context.progress.towerHidden[tower],
        dropShown: (at) => context.model.shownAt(mapLayerOf(at[2]), at),
    };
}

function levelLink(context: PanelContext, levelIndex: number): string {
    return `<button class="plain lnk" data-pick="${levelIndex}">${escapeHtml(context.levels[levelIndex].n)}</button>`;
}

// where a chain ends, in a short line that links what it stops at
function stopText(context: PanelContext, stop: ChainStop): string {
    if (stop.reason === 'unknown') return `Stops at ${levelLink(context, stop.level)}: unknown`;
    if (stop.reason === 'cycle') return `Stops at ${levelLink(context, stop.level)}: it needs itself`;
    if (stop.reason === 'drop') return `Stops at ${levelLink(context, stop.level)}: its hole is not known`;
    if (stop.reason === 'rock') return `Stops at Rock ${stop.rock}`;

    if (stop.reason === 'sign') {
        const pid = context.signs[stop.sign].pid;
        return `Stops at <button class="plain lnk" data-psign="${stop.sign}">Sign ${pid}</button>`;
    }

    const label = capitalized(freezerNoun(stop.freezer));
    const pid = context.freezers[stop.freezer].pid;
    return `Stops at <button class="plain lnk" data-pgate="${stop.freezer}">${label} ${pid}</button>: nothing opens it`;
}

const endPosition = (context: PanelContext, end: ChainEnd): Position =>
    typeof end === 'number' ? context.levels[end].p : end;

// the map shows one layer: a link for each other layer the route runs on, which frames `points` there
function otherLayersHtml(context: PanelContext, chain: NeedChain, points: Position[], z: number): string {
    let html = '';
    for (const layer of LAYER_HUBS.keys()) {
        const onLayer = points.some((point) => mapLayerOf(point[2]) === layer);
        const canShow = context.map?.layers.includes(layer);
        if (onLayer && canShow && layer !== mapLayerOf(z)) {
            const link = `<button class="plain lnk" data-clayer="${layer}">${escapeHtml(layerName(layer))}</button>`;
            let lead = 'Route continues on';
            if (chain.drops.some((at) => mapLayerOf(at[2]) === layer)) lead = 'Drop through a hole on';
            html += `<div class="muted">${lead} ${link}</div>`;
        }
    }

    return html;
}

/** The route section of what a panel at height `z` asks for. */
export function routeSection(context: PanelContext, z: number, ...targets: ChainTarget[]): RouteSection {
    const chain = needChain(chainWorld(context), context.progress.needsView, ...targets);

    let html = '';
    if (chain.stops.length > 0) {
        const stops = chain.stops.map((stop) => `<div>${stopText(context, stop)}</div>`).join('');
        html += `<div class="err">Broken route.${stops}</div>`;
    }

    const points = chain.edges.flatMap((edge) => [endPosition(context, edge.from), endPosition(context, edge.to)]);
    points.push(...chain.drops);
    context.chainPoints = [...context.chainPoints, ...points];
    html += otherLayersHtml(context, chain, points, z);

    const link = `<a href="${TABLE_FILE_URL}" target="_blank" rel="noopener">level table file</a>`;
    html += `<div class="muted">If this route is wrong, you can open a pull request against the ${link}.</div>`;

    const links = chain.edges.map((edge): MapLink => {
        let kind: MapLink[2] = 'req';
        if (edge.met) kind = 'met';
        return [edge.from, edge.to, kind];
    });

    const overlays = [...chain.freezers.map((freezer) => 'g' + freezer), ...chain.signs.map((sign) => 's' + sign)];
    const steps = chain.drops.map((at): MapStep => [at, '↓']);
    return { html, links, levels: chain.levels, overlays, steps };
}
