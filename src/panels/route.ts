// The route section of a level, Freezer, Sign or tower panel: the chain of table needs that are left, as lines on the map,
// where it breaks and how to correct it (VIEWER.md "Level needs and pad routes")
import type { MapLink, MapStep } from '../map/map-view.ts';
import { capitalized, freezerNoun } from '../model/freezer-names.ts';
import { layerName, mapLayerOf } from '../model/layers.ts';
import { needChain } from '../model/need-chain.ts';
import type { ChainEnd, ChainStop, ChainTarget, ChainWorld, NeedChain } from '../model/need-chain.ts';
import type { NeedsView } from '../model/route-needs.ts';
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
    /** The levels where the chain ends without reaching the hub. */
    frontier: Set<number>;
    /** The points the chain's lines and holes run through. */
    points: Position[];
}

/** The links at the foot of a panel: the level's WikiTactics page when it has one, and where to correct the route. */
export function panelFootHtml(wikiUrl?: string): string {
    let html = '<div class="foot">';
    if (wikiUrl) html += `<a href="${escapeHtml(wikiUrl)}" target="_blank" rel="noopener">WikiTactics</a>`;
    const fixTitle = 'Open a pull request against the level table file';
    html += `<a class="fix" href="${TABLE_FILE_URL}" target="_blank" rel="noopener" title="${fixTitle}">Route wrong? Fix it</a>`;
    return html + '</div>';
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

// the full chain view: nothing is met, nothing is under fog and every option of a group is followed, so the chain
// runs all the way back
function fullChainWorld(context: PanelContext): ChainWorld {
    return {
        ...chainWorld(context),
        shown: () => true,
        towerShown: () => true,
        dropShown: () => true,
        allOptions: true,
    };
}

const NOTHING_MET: NeedsView = {
    levelSolved: () => false,
    signRead: () => false,
};

/** The route section of what a panel at height `z` asks for. */
export function routeSection(context: PanelContext, z: number, ...targets: ChainTarget[]): RouteSection {
    const chain = needChain(chainWorld(context), context.progress.needsView, ...targets);
    return sectionOf(context, z, chain);
}

/** The route section with the whole chain behind the targets, whatever the save has met or hides. */
export function fullChainSection(context: PanelContext, z: number, ...targets: ChainTarget[]): RouteSection {
    const chain = needChain(fullChainWorld(context), NOTHING_MET, ...targets);
    return sectionOf(context, z, chain);
}

function sectionOf(context: PanelContext, z: number, chain: NeedChain): RouteSection {
    let html = '';
    if (chain.stops.length > 0) {
        const stops = chain.stops.map((stop) => `<div>${stopText(context, stop)}</div>`).join('');
        html += `<div class="err">Broken route.${stops}</div>`;
    }

    const points = chain.edges.flatMap((edge) => [endPosition(context, edge.from), endPosition(context, edge.to)]);
    points.push(...chain.drops);
    context.chainPoints = [...context.chainPoints, ...points];
    html += otherLayersHtml(context, chain, points, z);

    const links = chain.edges.map((edge): MapLink => {
        let kind: MapLink[2] = 'req';
        if (edge.met) kind = 'met';
        return [edge.from, edge.to, kind];
    });

    const overlays = [...chain.freezers.map((freezer) => 'g' + freezer), ...chain.signs.map((sign) => 's' + sign)];
    const steps = chain.drops.map((at): MapStep => [at, '↓']);
    const frontier = new Set<number>();
    for (const stop of chain.stops) {
        if (stop.reason === 'unknown' || stop.reason === 'cycle') frontier.add(stop.level);
    }

    return { html, links, levels: chain.levels, overlays, steps, frontier, points };
}
