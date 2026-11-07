// A level panel's Debug route button: the chain of the level's table needs back to the start, drawn on the map
// (VIEWER.md "Level needs and pad routes")
import { PROG } from '../data.ts';
import type { MapLink, MapStep } from '../map/map-view.ts';
import { capitalized, freezerNoun } from '../model/freezer-names.ts';
import { needChain, stopEnd } from '../model/need-chain.ts';
import type { ChainStop, ChainWorld } from '../model/need-chain.ts';
import type { Position } from '../types.ts';
import { escapeHtml } from '../util.ts';
import type { PanelContext } from './context.ts';

const TABLE_FILE_URL = 'https://github.com/xPaw/order-of-the-sinking-cost/blob/main/scripts/lib/level-table.ts';

/** What the map draws for a shown route. */
export interface RouteLines {
    links: MapLink[];
    levels: number[];
    overlays: string[];
    points: Position[];
    steps: MapStep[];
}

/** A level's route button and, while the route is shown, where it ends; the lines for the map. */
export interface RouteSection {
    html: string;
    lines: RouteLines | null;
}

function chainWorld(context: PanelContext): ChainWorld {
    return {
        levels: context.levels,
        freezers: context.freezers,
        signs: context.signs,
        start: PROG.fog?.start.hero,
    };
}

function levelLink(context: PanelContext, levelIndex: number): string {
    return `<button class="plain lnk" data-pick="${levelIndex}">${escapeHtml(context.levels[levelIndex].n)}</button>`;
}

// where a chain ends, in a short line that links what it stops at
function stopText(context: PanelContext, stop: ChainStop): string {
    if (stop.reason === 'unknown') return `Stops at ${levelLink(context, stop.level)}: unknown`;
    if (stop.reason === 'cycle') return `Stops at ${levelLink(context, stop.level)}: it needs itself`;
    if (stop.reason === 'rock') return `Stops at Rock ${stop.rock}`;

    if (stop.reason === 'sign') {
        const pid = context.signs[stop.sign].pid;
        return `Stops at <button class="plain lnk" data-psign="${stop.sign}">Sign ${pid}</button>`;
    }

    const label = capitalized(freezerNoun(stop.freezer));
    const pid = context.freezers[stop.freezer].pid;
    return `Stops at <button class="plain lnk" data-pgate="${stop.freezer}">${label} ${pid}</button>: nothing opens it`;
}

/** The route section of a level, whatever the No spoilers switch says. */
export function routeSection(context: PanelContext, levelIndex: number): RouteSection {
    const shown = context.routeLevel === levelIndex;
    if (!shown) return { html: '<button class="routebtn" data-route>Debug route</button>', lines: null };

    let html = '<button class="routebtn on" data-route>Hide debug route</button>';

    const world = chainWorld(context);
    const chain = needChain(world, context.progress.needsView, levelIndex);
    for (const stop of chain.stops) html += `<div class="err">Broken route. ${stopText(context, stop)}</div>`;

    const link = `<a href="${TABLE_FILE_URL}" target="_blank" rel="noopener">level table file</a>`;
    html += `<div class="muted">If this route is wrong, you can open a pull request against the ${link}.</div>`;

    const points: Position[] = chain.levels.map((level) => context.levels[level].p);
    const links = chain.edges.map((edge): MapLink => {
        let kind: MapLink[2] = 'req';
        if (edge.met) kind = 'unl';
        return [edge.from, edge.to, kind];
    });

    for (const edge of chain.edges) {
        for (const end of [edge.from, edge.to]) {
            if (typeof end !== 'number') points.push(end);
        }
    }

    const steps = chain.stops.map((stop, stopIndex): MapStep => [stopEnd(world, stop), stopIndex + 1]);
    const overlays = [...chain.freezers.map((freezer) => 'g' + freezer), ...chain.signs.map((sign) => 's' + sign)];
    return { html, lines: { links, levels: chain.levels, overlays, points, steps } };
}
