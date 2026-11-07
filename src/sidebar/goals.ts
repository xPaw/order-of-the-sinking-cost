// The sidebar's goals ladder: a row per goal with its mark and count, the first two endings' towers, the achievements and
// the areas listed inline, and the picking of a goal or an area for the list and the map (VIEWER.md "The page (viewer)",
// "Goals (viewer)")
import { $, escapeHtml } from '../util.ts';
import { hooks, showGoalList } from '../shared.ts';
import { progressBarHtml } from '../format.ts';
import { CHEVRON, checkIcon, emblemSlotHtml, goldBadgeHtml, towerEmblemHtml } from '../map/icons.ts';
import type { GoalView } from '../model/goals-view.ts';
import type { ProgressModel } from '../model/progress-model.ts';
import { show } from '../view.ts';
import { areaRowsHtml, hasListedAreas } from './areas.ts';
import { isGoalOpen } from './sections.ts';

// "23 left" for an ending (plan steps left), "1 / 4" for the first ending's Antipode teleporters visited, "teleporter"
// for a ground tower activated whose teleporter is not visited, "3 / 16" for the rest; a trailing + says more is under
// fog, except on the teleporters, whose total is the Sign's need
function goalCountText(goal: GoalView): string {
    let more = '';
    if (goal.fogged) more = '+';
    if (goal.kind === 'ending') {
        if (goal.done) return '';
        if (goal.progress) return `${goal.progress[0]} / ${goal.progress[1]}`;
        if (goal.left == null) return '—';
        if (goal.left === 0 && goal.fogged) return 'under fog';
        return `${goal.left}${more} left`;
    }

    if (goal.next) return 'teleporter';
    if (!goal.progress) return '';

    const [got, total] = goal.progress;
    return `${got} / ${total}${more}`;
}

function goalTip(goal: GoalView): string {
    let more = '';
    if (goal.fogged) more = '+';
    const parts = [goal.label];
    if (goal.kind === 'ending') {
        if (goal.done) parts.push('Earned');
        else if (goal.progress) parts.push(`${goal.progress[0]} of ${goal.progress[1]} Antipode teleporters visited`);
        else if (goal.left != null) parts.push(`${goal.left}${more} plan steps left`);
    } else if (goal.next) {
        parts.push('Activated', `Next: ${goal.next}`);
    } else if (goal.progress) {
        const [got, total] = goal.progress;
        parts.push(`${got} of ${total}${more} ${goal.unit}`);
    }

    if (goal.onPlan === false) parts.push('Not on the cheapest plan');
    if (goal.fogged) parts.push('more is under fog');
    return parts.join(' · ');
}

const TODO_MARK = '<span class="mk todo" title="To do">○</span>';
const NO_MARK = '<span class="mk"></span>';

// a goal's mark, in a column of its own: a check when done, a filled diamond for the current one, else the given one: a
// top-level goal gets a circle to do; a child goal has a mark only when it is done or current, its name standing under
// its parent's, after the mark column
function goalMark(goal: GoalView, otherwise: string): string {
    if (goal.done) return `<span class="mk" title="Done">${checkIcon}</span>`;
    if (goal.active) return '<span class="mk now" title="Your current goal">◆</span>';
    return otherwise;
}

/** Whether a goal's row folds open, and whether its children are listed. */
interface GoalFold {
    foldable: boolean;
    open: boolean;
}

// the badge of a goal that is a tower, or a pair's gold achievement; null for any other goal
function goalEmblemHtml(model: ProgressModel, goal: GoalView): string | null {
    if (goal.tower != null) return towerEmblemHtml(model.progress.towers[goal.tower]);
    if (goal.name) return goldBadgeHtml(goal.name);
    return null;
}

// whether any of the goals has a badge, so that the others get an empty slot of the same width
const anyEmblem = (model: ProgressModel, goals: GoalView[]): boolean =>
    goals.some((goal) => goalEmblemHtml(model, goal) !== null);

// a goal's row: its mark, badge, name, a chevron after the name on a goal with children, and the count at the right; the
// current goal has a thin progress bar under it. A child of a single item has no count. `emblemSlot`: a row of the
// same list has a badge, so this one without gets an empty slot.
function goalRowHtml(
    model: ProgressModel,
    goal: GoalView,
    selectedKey: string,
    isChild: boolean,
    fold: GoalFold,
    emblemSlot: boolean,
): string {
    const classes = ['plain', 'gl'];
    if (goal.done) classes.push('done');
    if (goal.onPlan === false) classes.push('off');

    const selected = goal.key === selectedKey;
    if (selected) classes.push('on');

    const childSelected = !!goal.children?.some((child) => child.key === selectedKey);
    if (childSelected) classes.push('sub');

    let countText = goalCountText(goal);
    if (isChild && goal.progress?.[1] === 1 && !goal.next) countText = '';

    let chevron = '';
    let expanded = '';
    if (fold.foldable) {
        chevron = CHEVRON;
        expanded = ` aria-expanded="${fold.open}"`;
    }

    const key = escapeHtml(goal.key);
    const tip = escapeHtml(goalTip(goal));
    const attributes = `data-goal="${key}" aria-pressed="${selected}"${expanded} title="${tip}"`;
    const name = escapeHtml(goal.label);
    let emblem = goalEmblemHtml(model, goal) ?? '';
    if (!emblem && emblemSlot) emblem = emblemSlotHtml();

    let content = '';
    if (isChild) {
        content = `${goalMark(goal, NO_MARK)}${emblem}<span class="n">${name}</span>`;
    } else {
        content = `${goalMark(goal, TODO_MARK)}${emblem}<span class="n">${name}</span>${chevron}`;
    }

    content += `<span class="cnt">${countText}</span>`;
    const row = `<button class="${classes.join(' ')}" ${attributes}>${content}</button>`;

    let progressBar = '';
    if (!isChild && goal.active && goal.progress && goal.progress[1] > 0) {
        progressBar = progressBarHtml(goal.progress[0], goal.progress[1]);
    }

    let rowClass = 'gr';
    if (isChild) rowClass += ' kid';
    return `<div class="${rowClass}">${row}${progressBar}</div>`;
}

/**
 * Whether a goal folds open: one with children does, and Completionist does while an area is listed, the areas being
 * its children.
 */
export function goalFolds(model: ProgressModel, goal: GoalView): boolean {
    if (goal.children?.length) return true;
    return goal.kind === 'completionist' && hasListedAreas(model);
}

// the children of an open goal: its goals, or Completionist's areas
function goalKidsHtml(model: ProgressModel, goal: GoalView, selectedKey: string): string {
    if (goal.kind === 'completionist') return areaRowsHtml(model);

    const noFold: GoalFold = { foldable: false, open: false };
    const children = goal.children ?? [];
    const emblemSlot = anyEmblem(model, children);
    return children.map((child) => goalRowHtml(model, child, selectedKey, true, noFold, emblemSlot)).join('');
}

export function sideGoalsHtml(model: ProgressModel): string {
    const head = '<div class="sh">Goals</div>';
    if (!model.goals.length) return `${head}<div class="muted">Working out the goals…</div>`;

    const selected = model.goalFor(model.F.goal);
    if (!selected) return head;

    const emblemSlot = anyEmblem(model, model.goals);
    const rows = model.goals.map((goal) => {
        const foldable = goalFolds(model, goal);
        const open = foldable && isGoalOpen(goal.key);
        let html = goalRowHtml(model, goal, selected.key, false, { foldable, open }, emblemSlot);
        if (open) html += `<div class="kids">${goalKidsHtml(model, goal, selected.key)}</div>`;
        return html;
    });

    return head + rows.join('');
}

export function refreshSideGoals(): void {
    const element = $('#sideGoals');
    if (!element || !hooks.side) return;

    element.innerHTML = sideGoalsHtml(hooks.side);
}

// makes a goal the one the list shows, with its tower chip if it has one; the active goal is stored as none, so the
// default follows progress
function selectGoal(model: ProgressModel, goal: GoalView): void {
    const filters = model.F;
    const isActiveTopLevel = model.goals.some((each) => each === goal && each.active);
    if (isActiveTopLevel) filters.goal = '';
    else filters.goal = goal.key;

    const towerIndex = goal.tower;
    if (towerIndex != null) filters.tower = String(towerIndex);
    else filters.tower = '';
}

/**
 * Picks an area, or drops it when it is the picked one; the list shows the area's levels under Completionist, whose
 * children the areas are, and the map frames the area.
 */
export function pickArea(model: ProgressModel, area: string): void {
    const filters = model.F;
    if (filters.area === area) filters.area = '';
    else filters.area = area;

    if (filters.area !== '') {
        const completionist = model.goals.find((goal) => goal.kind === 'completionist');
        if (completionist) selectGoal(model, completionist);
    }

    showGoalList(filters);
    if (hooks.apply) hooks.apply();
    else show();

    refreshSideGoals();
    $(`#sideGoals [data-area="${area}"]`)?.focus({ preventScroll: true });
    if (filters.area !== '') hooks.area?.();
}

/**
 * Picks a goal for the list and the map; the list of the goal shows in place of a kind of mark's or of every level. A
 * tower (one under an ending too, or a tower's achievement) also adds its chip and is framed on the map.
 */
export function pickGoal(model: ProgressModel, key: string): void {
    const goal = model.goalByKey(key);
    if (!goal) return;

    const filters = model.F;
    selectGoal(model, goal);
    if (filters.show === 'all') filters.show = 'todo';

    const towerIndex = goal.tower;
    showGoalList(filters);
    if (hooks.apply) hooks.apply();
    else show();

    refreshSideGoals();
    $(`#sideGoals [data-goal="${key}"]`)?.focus({ preventScroll: true });
    if (towerIndex != null) hooks.tower?.(towerIndex);
}
