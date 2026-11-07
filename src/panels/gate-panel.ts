// A Freezer's panel on the map: open or closed and its role, what opens it, the levels it leads to and the path to
// open it (VIEWER.md "The page (viewer)")
import { escapeHtml } from '../util.ts';
import type { MapLink, SelectHow } from '../map/map-view.ts';
import { capitalized, freezerNoun } from '../model/freezer-names.ts';
import { roleFor } from '../model/goal-roles.ts';
import { unlockPlan } from '../model/plans.ts';
import { SIGN_INDEX } from '../model/requirements.ts';
import type { PanelContext } from './context.ts';
import { markSelected } from './list.ts';
import {
    areaPlaceHtml,
    chainOf,
    freezerIconHtml,
    gateMode,
    layerNote,
    opensChips,
    panelHead,
    pathHtml,
    pick,
    pointsOf,
    roleChipHtml,
    signOn,
    stepsOf,
    uniqueLinks,
} from './plan-chips.ts';

function leadsToHtml(context: PanelContext, leadsAll: number[], leads: number[]): string {
    if (!leadsAll.length) return '';

    let html = '<div class="h">Leads to</div>';
    if (leads.length) html += `<div>${pick(context, leads)}</div>`;
    if (leads.length < leadsAll.length) html += '<div class="muted">and more under fog</div>';
    return html;
}

export function showGatePanel(context: PanelContext, freezerIndex: number, how?: SelectHow): void {
    const progress = context.progress;
    context.remember(['gate', freezerIndex]);
    markSelected(context, null);

    const freezer = context.freezers[freezerIndex];
    const isOpen = progress.gateOpen[freezerIndex];
    const mode = gateMode(freezer);
    const signs = freezer.signs || [];
    const label = capitalized(freezerNoun(freezerIndex));
    // the area with its emblem, else the place's words ("near" a level)
    let place = areaPlaceHtml(context, context.model.areaIndexAt(freezer.p));
    if (!place) place = escapeHtml(context.model.gatePlace(freezerIndex));
    let html = panelHead(context, freezerIconHtml(freezerIndex), label, place);

    let status = 'Closed';
    let statusTone = '';
    if (isOpen) {
        status = 'Open';
        statusTone = ' good';
    }

    const role = roleFor(context.goal, 'g', freezerIndex);
    const statusChip = `<span class="chip${statusTone}">${status}</span>`;
    html += `<div>${statusChip}${roleChipHtml(context, role)}</div>`;
    html += `<div class="muted">ID ${freezer.pid}</div>`;

    let withMode = '';
    if (mode) withMode = ' ' + mode;
    html += `<div class="h">Opens with${withMode}</div><div>${opensChips(context, freezer)}</div>`;

    let leadsAll: number[] = [];
    if (!isOpen) leadsAll = progress.reach?.leads.get(freezerIndex) || [];
    const leads = leadsAll.filter((level) => !progress.hidden[level]);

    let plan = null;
    if (!isOpen) plan = unlockPlan(progress, ['gate', freezerIndex]);

    const steps = plan && stepsOf(context, plan);
    const chain = chainOf(context, plan, steps);
    html += pathHtml(context, plan, false, steps) + layerNote(context, chain, freezer.p[2]);
    context.chainPoints = chain.points;
    html += leadsToHtml(context, leadsAll, leads);

    const signsShown: number[] = [];

    for (const sign of signs) {
        const signIndex = SIGN_INDEX.get(sign.pid);
        if (signIndex !== undefined && signOn(context, signIndex)) signsShown.push(signIndex);
    }

    const links = uniqueLinks([
        ...freezer.req.map((requirement): MapLink => [requirement, freezer.p, 'req']),
        ...signsShown.map((signIndex): MapLink => [context.signs[signIndex].p, freezer.p, 'req']),
        ...leads.map((lead): MapLink => [freezer.p, lead, 'unl']),
        ...chain.links,
    ]);

    const signOverlays = signsShown.map((signIndex) => 's' + signIndex);
    context.map?.select(
        {
            levels: new Set([...freezer.req, ...leads, ...chain.levels]),
            frontier: chain.frontier,
            overlays: new Set(['g' + freezerIndex, ...signOverlays, ...chain.overlays]),
            html,
            z: freezer.p[2],
            points: [
                freezer.p,
                ...pointsOf(context, [...freezer.req, ...leads]),
                ...signsShown.map((signIndex) => context.signs[signIndex].p),
                ...chain.points,
            ],
            links,
            steps: chain.steps,
        },
        how,
    );
}
