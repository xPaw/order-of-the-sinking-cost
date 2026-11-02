// A tower's panel on the map: activated or how many to go, the path to activate it, its unsolved, solved and dropdown
// levels (VIEWER.md "The page (viewer)")
import { escapeHtml } from '../util.ts';
import { progressBarHtml } from '../format.ts';
import type { MapLink, SelectHow } from '../map/map-view.ts';
import { unlockPlan } from '../model/plans.ts';
import { towerEmblemHtml } from '../map/icons.ts';
import { towerLevelCount, towerName } from '../model/towers.ts';
import type { TowerProgress } from '../model/towers.ts';
import type { PanelContext } from './context.ts';
import { markSelected } from './list.ts';
import { chainOf, layerNote, levelChip, panelHead, pathHtml, pointsOf, stepsOf, uniqueLinks } from './plan-chips.ts';

// a bar and count of a tower's levels solved; while some are under fog only the ones not under fog are counted, and
// the count says there are more. Activated and Gold follow as chips.
function towerStateHtml(tower: TowerProgress, shownLevels: number): string {
    let total = tower.req;
    if (shownLevels < tower.normal.length) total = shownLevels;

    const bar = progressBarHtml(tower.solvedNormal, total);
    const count = `<span class="tc">${towerLevelCount(tower, shownLevels)}</span>`;
    let html = `<div class="tprog">${bar}${count}</div>`;

    let chips = '';
    if (tower.active) chips += '<span class="chip good">Activated</span>';
    if (tower.gold) chips += '<span class="chip warn">Gold</span>';
    if (chips) html += `<div>${chips}</div>`;
    return html;
}

/**
 * A column of a tower's levels as the game draws it: the solved ones fill it from the bottom, the unsolved ones sit
 * above them. A line marks the `needed`-th row from the bottom, where the tower activates; none for 0 or when fewer
 * rows are shown.
 */
function columnHtml(context: PanelContext, levels: number[], needed: number): string {
    const progress = context.progress;
    const unsolved = levels.filter((level) => progress.state[level] !== 'solved');
    const solved = levels.filter((level) => progress.state[level] === 'solved');
    const rows = [...unsolved, ...solved];

    let lineAt = -1;
    if (needed > 0 && needed <= rows.length) lineAt = rows.length - needed;

    let html = '';
    rows.forEach((level, index) => {
        if (index === lineAt) html += '<div class="tline" title="The tower activates with the levels below"></div>';

        html += levelChip(progress, level, 'data-pick');
    });

    return `<div class="tcol">${html}</div>`;
}

export function showTowerPanel(context: PanelContext, towerIndex: number, how?: SelectHow): void {
    const progress = context.progress;
    context.remember(['tower', towerIndex]);
    markSelected(context, null);

    const tower = progress.towers[towerIndex];
    const shownNormal = tower.normal.filter((level) => !progress.hidden[level]);
    const todo = shownNormal.filter((level) => progress.state[level] !== 'solved');
    const dropdowns = tower.drop.filter((level) => !progress.hidden[level]);
    const unsolvedDropdowns = dropdowns.filter((level) => progress.state[level] !== 'solved');
    let html = panelHead(context, towerEmblemHtml(tower), escapeHtml(towerName(tower.t)));
    html += towerStateHtml(tower, shownNormal.length);

    let plan = null;
    if (!tower.active) plan = unlockPlan(progress, ['tower', towerIndex]);

    const steps = plan && stepsOf(context, plan);
    const chain = chainOf(context, plan, steps);
    html += pathHtml(context, plan, false, steps) + layerNote(context, chain, tower.p[2]);
    context.chainPoints = chain.points;

    // the levels as the tower shows them, then the dropdowns' column
    html += '<div class="h">Levels</div>' + columnHtml(context, shownNormal, tower.req);
    if (dropdowns.length) html += '<div class="h">Dropdowns</div>' + columnHtml(context, dropdowns, 0);

    // lines from the tower to its unsolved levels: solid for required ones, dashed for dropdowns
    const links = uniqueLinks([
        ...todo.map((level): MapLink => [tower.p, level, 'req']),
        ...unsolvedDropdowns.map((level): MapLink => [tower.p, level, 'unl']),
        ...chain.links.filter(([, to]) => !(Array.isArray(to) && to === tower.p)),
    ]);
    const unsolved = [...todo, ...unsolvedDropdowns];
    let framed = unsolved;
    if (!unsolved.length) framed = [...shownNormal, ...dropdowns];

    context.map?.select(
        {
            levels: new Set([...shownNormal, ...dropdowns, ...chain.levels]),
            frontier: chain.frontier,
            overlays: chain.overlays,
            tower: towerIndex,
            exact: true,
            html,
            z: tower.p[2],
            points: [tower.p, ...pointsOf(context, framed), ...chain.points],
            links,
            steps: chain.steps,
        },
        how,
    );
}
