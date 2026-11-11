// A sign's panel on the map: satisfied or not, what it needs, its tower, the path to satisfy it and the gates it opens
// (viewer.md "The page (viewer)")
import { escapeHtml } from '../util.ts';
import type { MapLink, SelectHow } from '../map/map-view.ts';
import { unlockPlan } from '../model/plans.ts';
import { iconHtml, towerEmblemHtml } from '../map/icons.ts';
import { towerName } from '../model/towers.ts';
import { signStateOf } from '../model/unlocking.ts';
import type { Sign } from '../types.ts';
import type { PanelContext } from './context.ts';
import { markSelected } from './list.ts';
import {
    areaPlaceHtml,
    chainOf,
    gateChip,
    layerNote,
    panelHead,
    pathHtml,
    signNeed,
    stepsOf,
    uniqueLinks,
} from './plan-chips.ts';
import { panelFootHtml, routeSection } from './route.ts';

function opensHtml(context: PanelContext, sign: Sign, gateIds: number[]): string {
    if (!gateIds.length) return '';

    const chips = gateIds.map((freezerIndex) => gateChip(context, freezerIndex)).join('');
    let html = `<div class="h">Opens</div><div>${chips}</div>`;
    if (gateIds.length < sign.gates.length) html += '<div class="muted">and more under fog</div>';
    return html;
}

export function showSignPanel(context: PanelContext, signIndex: number, how?: SelectHow): void {
    const progress = context.progress;
    context.remember(['sign', signIndex]);
    markSelected(context, null);

    const sign = context.signs[signIndex];
    const signState = signStateOf(progress, sign);
    const gateIds = sign.gates.filter((freezerIndex) => context.gateShown(context.freezers[freezerIndex]));

    let towerIndex: number | undefined;
    if (sign.tower != null && progress.towers[sign.tower] && !progress.towerHidden[sign.tower]) {
        towerIndex = sign.tower;
    }

    const place = areaPlaceHtml(context, context.model.areaIndexAt(sign.p));
    let html = panelHead(context, iconHtml('sign'), 'Sign', place);
    let status = 'Not yet';
    let statusTone = '';
    if (signState === 'read') {
        status = 'Read';
        statusTone = ' good';
    }
    if (signState === 'ready') {
        status = 'Ready to read';
        statusTone = ' warn';
    }

    html += `<div><span class="chip${statusTone}">${status}</span></div>`;
    if (signState === 'ready') html += '<div class="muted">Stand next to it, facing it, to read it.</div>';
    html += `<div class="h">Needs</div><div>${signNeed(context, sign)}</div>`;
    if (towerIndex !== undefined) {
        const tower = progress.towers[towerIndex];
        const name = towerEmblemHtml(tower) + escapeHtml(towerName(tower.t));
        html += `<div><span class="chip" data-ptower="${towerIndex}" tabindex="0" role="button">${name}</span></div>`;
    }

    let plan = null;
    if (signState === 'unmet') plan = unlockPlan(progress, ['sign', signIndex]);

    const steps = plan && stepsOf(context, plan);
    const chain = chainOf(context, plan, steps);
    html += pathHtml(context, plan, false, steps) + layerNote(context, chain, sign.p[2]);
    context.chainPoints = chain.points;

    html += opensHtml(context, sign, gateIds);

    const route = routeSection(context, sign.p[2], { sign: signIndex });
    html += route.html;
    html += panelFootHtml();

    const gateLinks = gateIds.map((freezerIndex): MapLink => [sign.p, context.freezers[freezerIndex].p, 'req']);
    const gateOverlays = gateIds.map((freezerIndex) => 'g' + freezerIndex);
    context.map?.select(
        {
            levels: new Set([...chain.levels, ...route.levels]),
            frontier: chain.frontier,
            overlays: new Set(['s' + signIndex, ...gateOverlays, ...chain.overlays, ...route.overlays]),
            html,
            z: sign.p[2],
            points: [sign.p, ...gateIds.map((freezerIndex) => context.freezers[freezerIndex].p), ...chain.points],
            links: uniqueLinks([...route.links, ...gateLinks, ...chain.links]),
            steps: [...chain.steps, ...route.steps],
        },
        how,
    );
}
