// The goals ladder as the page shows it, nothing under fog named or counted (VIEWER.md "Goals (viewer)")
import { PROG } from '../data.ts';
import type { ProgressLevel } from '../types.ts';
import { achievementName, hasAchievement } from './achievements.ts';
import type { AchievementRule } from './achievements.ts';
import { areaName } from './areas.ts';
import { freezerNoun } from './freezer-names.ts';
import { goalRoutes, roleFor } from './goal-roles.ts';
import type { GoalRoles } from './goal-roles.ts';
import type { AchievementGoal, AntipodeGoal, EndingGoal, GoalKind, StageGoal, TowerGoal } from './goals.ts';
import { roleOf } from './level-roles.ts';
import { downKeyOf, levelGroup, orderNextSteps } from './next-steps.ts';
import type { Plans } from './plans.ts';
import type { ShownProgress } from './progress.ts';
import type { Graph, PlanStep } from './requirements.ts';
import type { FoundOfTotal } from './totals.ts';
import { towerName, unnamedWayName } from './towers.ts';

/** An ending in rank order: whether it is earned and whether the page shows it. */
export interface EndingStatus {
    name: string;
    earned: boolean;
    shown: boolean;
}

/** A goal as the page shows it. */
export interface GoalView {
    key: string;
    kind: GoalKind;
    label: string;
    done: boolean;
    active: boolean;
    /** Found and total; null for an ending with no Antipode teleporter count. */
    progress: FoundOfTotal | null;
    /** What is still to do, in `unit`; null when the goal has no plan. */
    left: number | null;
    unit: string;
    /** Whether more of it is under fog. */
    fogged: boolean;
    targets: number[];
    roles?: GoalRoles | undefined;
    tower?: number | undefined;
    name?: string | undefined;
    ending?: number | undefined;
    /** The level a stage is named after. */
    level?: number | undefined;
    children?: GoalView[];
    /** The step onto an active ground tower's Antipode teleporter. */
    next?: string | null;
    /** Whether the first ending's child is on its cheapest plan: a ground tower's teleporter. */
    onPlan?: boolean;
}

/** An unsolved level that serves a goal. */
export interface GoalLevel {
    i: number;
    group: 'playable' | 'blocked' | 'locked';
    role: 'req' | 'one' | 'optional' | null;
    leadsTo: string;
    onPlan: boolean;
}

/** What the page's progress view tells the goals ladder about the fog. */
export interface GoalsViewInput {
    status: { achievements: bigint };
    progress: ShownProgress;
    levels: ProgressLevel[];
    endings: EndingStatus[];
    achievementHidden: (name: string) => boolean;
    achievementRule: (name: string) => AchievementRule | undefined;
    /** Whether the game names an area yet. */
    areaShown: (area: number) => boolean;
    gateShown: (freezer: number) => boolean;
    gatePlace: (freezer: number) => string;
    signShown: (sign: number) => boolean;
    stepShown: (step: PlanStep) => boolean;
    heroDist: (level: number) => number;
}

export interface GoalsView {
    goals: GoalView[];
    goalLevels: (goal: GoalView) => GoalLevel[];
    goalLevelsFogged: (goal: GoalView) => boolean;
    goalSolved: (goal: GoalView) => number[];
    goalByKey: (key: string) => GoalView | null;
    goalFor: (key: string) => GoalView | null;
}

/** What a ladder goal has in common with its children, as `baseGoal` reads it. */
interface LadderGoalFields {
    key: string;
    kind: GoalKind;
    done: boolean;
    active: boolean;
    targets: number[];
    roles?: GoalRoles | undefined;
    tower?: number | undefined;
    name?: string | undefined;
    ending?: number | undefined;
}

/** What the steps that build the view read: the input, and the plans and requirement graph under its progress. */
interface GoalsContext extends GoalsViewInput {
    plans: Plans;
    graph: Graph;
}

function towerShown(context: GoalsContext, tower: number): boolean {
    return !context.progress.towerHidden[tower];
}

function towerLeft(context: GoalsContext, tower: number): number {
    const { req, solvedNormal } = context.progress.towers[tower];
    return Math.max(0, req - solvedNormal);
}

function levelId(context: GoalsContext, level: number): number | undefined {
    return context.graph.index.get('l' + level);
}

// the levels in a requirement's plan (just itself for a level with none)
function planLevels(context: GoalsContext, id: number | undefined, into: Set<number>): void {
    if (id === undefined) return;

    const { plans, graph } = context;
    if (plans.settled[id] < 0) {
        const node = graph.node[id];
        if (node?.t === 'l') into.add(node.id);
        return;
    }

    for (const step of plans.steps[id]!) {
        const node = graph.node[step];
        if (node?.t === 'l') into.add(node.id);
    }
}

// a tower's unsolved normal levels and their plans
function towerLevels(context: GoalsContext, tower: number, into: Set<number>): void {
    for (const level of context.progress.towers[tower].normal) {
        if (context.progress.state[level] === 'solved') continue;
        into.add(level);
        planLevels(context, levelId(context, level), into);
    }
}

// the levels that serve a goal: an ending's are on its routes (its roles), a tower's and an achievement's are its
// levels and their plans, Completionist's every level; the achievements gather their children's
function levelsOf(context: GoalsContext, goal: GoalView): Set<number> {
    const { levels, graph } = context;
    const into = new Set<number>();

    if (goal.kind === 'ending') {
        levels.forEach((level, i) => {
            if (goal.roles!.l[i]) into.add(i);
        });
    } else if (goal.kind === 'tower' || goal.kind === 'antipode') {
        towerLevels(context, goal.tower!, into);
        if (goal.kind === 'tower') {
            for (const id of goal.targets) planLevels(context, id, into);
        }
    } else if (goal.kind === 'achievement') {
        for (const id of goal.targets) {
            const node = graph.node[id];
            if (node?.t === 't') {
                towerLevels(context, node.id, into);
            } else {
                planLevels(context, id, into);
            }
        }
    } else if (goal.kind === 'completionist') {
        for (let level = 0; level < levels.length; level++) into.add(level);
    } else if (goal.kind === 'stage') {
        for (const id of goal.targets) planLevels(context, id, into);
    } else {
        for (const child of goal.children!) {
            if (child.done) continue;
            for (const levelIndex of levelsOf(context, child)) into.add(levelIndex);
        }
    }

    return into;
}

// what a requirement on a goal's chain says a level leads to, null when it says nothing or is under fog
function describe(context: GoalsContext, id: number, below: number): string | null {
    const { progress, levels, graph } = context;
    const node = graph.node[id];
    if (!node) return null;

    if (node.t === 't') {
        if (!towerShown(context, node.id)) return null;
        return `${towerName(progress.towers[node.id].t)} · ${towerLeft(context, node.id)} to go`;
    }

    if (node.t === 'g') {
        if (!context.gateShown(node.id)) return null;
        const place = context.gatePlace(node.id);
        if (!place) return `opens ${freezerNoun(node.id)}`;
        return `opens ${freezerNoun(node.id)} ${place}`;
    }

    if (node.t === 'l') {
        if (progress.hidden[node.id]) return null;

        const belowNode = graph.node[below];
        const unlocked = belowNode?.t === 'l' && levels[node.id].req.includes(belowNode.id);
        if (unlocked) return `unlocks ${levels[node.id].n}`;
        return `opens the way to ${levels[node.id].n}`;
    }

    if (node.t === 'e') {
        if (context.achievementHidden(node.id)) return null;
        return achievementName(node.id);
    }

    return null;
}

// " · one of 3 routes" for a level on some routes only, counting the routes not under fog
function routesText(context: GoalsContext, goal: GoalView, id: number): string {
    const { plans, graph } = context;
    const junction = goal.roles!.weakAt[id];
    if (junction < 0 || graph.kind[junction] !== 'or') return '';

    const routes = goalRoutes(plans, junction);
    const shownRoutes = routes.filter((route) => {
        const node = graph.node[route];
        return !node || context.stepShown(node);
    });
    if (shownRoutes.length >= 2) return ` · one of ${shownRoutes.length} routes`;
    if (routes.length >= 2) return ' · one of several routes';
    return '';
}

// a level leads to the nearest thing not under fog on its chain toward the goal: a tower and the levels it has left,
// a Freezer, a level it unlocks or opens the way to, a rank marker; else to the goal itself
function leadsTo(context: GoalsContext, goal: GoalView, level: number): string {
    if (goal.kind === 'completionist') return goalOf(context, level);

    const id = levelId(context, level)!;
    const { from, need } = goal.roles!;
    if (!need[id]) return '';

    let below = id;
    for (let chain = from[id]; chain >= 0; chain = from[chain]) {
        const text = describe(context, chain, below);
        if (text) return text + routesText(context, goal, id);
        if (context.graph.node[chain]) below = chain;
    }

    return goal.label + routesText(context, goal, id);
}

// the levels on the goal's cheapest plans: every level for Completionist, which asks for them all
function onPlanLevels(context: GoalsContext, goal: GoalView): Set<number> | null {
    if (goal.kind === 'completionist') return null;

    const into = new Set<number>();
    for (const id of goal.targets) planLevels(context, id, into);
    return into;
}

function goalLevelsOf(context: GoalsContext, goal: GoalView): GoalLevel[] {
    const { progress, heroDist } = context;
    const shownForOrder = {
        level: (level: number) => !progress.hidden[level],
        gate: context.gateShown,
        tower: (tower: number) => towerShown(context, tower),
        dist: heroDist,
    };
    const ids = [...levelsOf(context, goal)].filter(
        (level) => progress.state[level] !== 'solved' && !progress.hidden[level],
    );
    const onPlan = onPlanLevels(context, goal);

    return orderNextSteps(progress, ids, shownForOrder, goal).map((level) => ({
        i: level,
        group: levelGroup(progress.state[level]),
        role: roleFor(goal, 'l', level),
        leadsTo: leadsTo(context, goal, level),
        onPlan: !onPlan || onPlan.has(level),
    }));
}

// whether fog hides an unsolved level that serves the goal
function goalLevelsFoggedOf(context: GoalsContext, goal: GoalView): boolean {
    const { progress } = context;
    for (const level of levelsOf(context, goal)) {
        if (progress.state[level] !== 'solved' && progress.hidden[level]) return true;
    }
    return false;
}

// the solved levels not under fog in a goal's scope: a tower's or an achievement's own levels, every one for the rest
function solvedLevelsOf(context: GoalsContext, goal: GoalView, into: Set<number>): void {
    if (goal.kind === 'tower' || goal.kind === 'antipode') {
        for (const level of context.progress.towers[goal.tower!].normal) into.add(level);
    } else if (goal.kind === 'achievement') {
        const rule = context.achievementRule(goal.name!);
        for (const level of rule?.tower?.normal || rule?.levels || []) into.add(level);
    } else if (goal.kind === 'achievements') {
        for (const child of goal.children!) solvedLevelsOf(context, child, into);
    } else if (goal.kind === 'stage') {
        if (goal.level !== undefined) into.add(goal.level);
    } else {
        for (let level = 0; level < context.levels.length; level++) into.add(level);
    }
}

function goalSolvedOf(context: GoalsContext, goal: GoalView): number[] {
    const { progress } = context;
    const into = new Set<number>();
    solvedLevelsOf(context, goal, into);

    return [...into]
        .filter((level) => progress.state[level] === 'solved' && !progress.hidden[level])
        .toSorted((first, second) => first - second);
}

// why a Next steps level is next, as the goals it leads to (none under fog): the next ending with the tower it brings
// closest to done, else that tower, else an achievement, else the first Required level or Freezer after it
function requiredShown(context: GoalsContext, kind: 'l' | 'g', id: number): boolean {
    const shown = kind === 'l' ? !context.progress.hidden[id] : context.gateShown(id);
    return shown && roleOf(kind, id) === 'req';
}

function goalOf(context: GoalsContext, level: number): string {
    const { status, progress, levels, endings } = context;
    const step = progress.needed[level];
    if (!step) return '';

    let ending = '';
    if (step.ending != null && endings[step.ending].shown) {
        ending = `Toward ${achievementName(endings[step.ending].name)}`;
    }

    const shownTowers = step.towers.filter(([tower]) => towerShown(context, tower));
    const closestTower = shownTowers.toSorted((first, second) => first[1] - second[1])[0];
    let towerText = '';
    if (closestTower) {
        towerText = `${towerName(progress.towers[closestTower[0]].t)} · ${closestTower[1]} to go`;
    }

    if (ending && towerText) return `${ending} · ${towerText}`;
    if (ending) return ending;
    if (towerText) return towerText;

    const down = [...step.down].map(downKeyOf);
    const downLevels = down.filter(([kind]) => kind === 'l').map(([, downLevel]) => downLevel);
    const achievementLevel = [level, ...downLevels].find((candidate) => {
        const achievement = levels[candidate].a;
        return !!achievement && !progress.hidden[candidate] && !hasAchievement(status, achievement);
    });
    if (achievementLevel != null) return achievementName(levels[achievementLevel].a!);

    const required = down.filter(([kind, id]) => requiredShown(context, kind, id));
    if (required.length) {
        const [kind, id] = required[0];
        let more = '';
        if (required.length > 1) more = ` +${required.length - 1}`;
        if (kind === 'l') return `Required ${levels[id].n}${more}`;

        const place = context.gatePlace(id);
        let placeNote = '';
        if (place) placeNote = ' · ' + place;
        return `Required ${freezerNoun(id)}${placeNote}${more}`;
    }

    if (roleOf('l', level) === 'req') return 'Required level';
    return '';
}

// an ending: its plan steps left that fog does not hide (its own level included)
function stepsLeft(context: GoalsContext, goal: EndingGoal): { left: number | null; fogged: boolean } {
    if (goal.done) return { left: 0, fogged: false };

    const { plans, graph } = context;
    const id = goal.targets[0];
    if (id === undefined || plans.settled[id] < 0) return { left: null, fogged: false };

    let left = 0;
    let fogged = false;
    for (const step of plans.steps[id]!) {
        if (context.stepShown(graph.node[step]!)) {
            left++;
        } else {
            fogged = true;
        }
    }

    return { left, fogged };
}

function baseGoal(
    raw: LadderGoalFields,
    label: string,
    goalProgress: FoundOfTotal | null,
    unit: string,
    fogged = false,
): GoalView {
    return {
        key: raw.key,
        kind: raw.kind,
        label,
        done: raw.done,
        active: raw.active,
        progress: goalProgress,
        left: goalProgress ? goalProgress[1] - goalProgress[0] : null,
        unit,
        fogged,
        targets: raw.targets,
        roles: raw.roles,
        tower: raw.tower,
        name: raw.name,
        ending: raw.ending,
    };
}

// a ground tower under the first ending: its levels until it is activated, then the step onto its Antipode
// teleporter (`next`), done once the teleporter's endpoint is discovered. `onPlan`: its teleporter is on the
// ending's cheapest plan, or visited, or the ending has no plan.
function antipodeGoal(context: GoalsContext, raw: AntipodeGoal, endingPlan: Set<number> | null): GoalView {
    const tower = context.progress.towers[raw.tower];
    const name = towerName(tower.t);
    const goal = baseGoal(raw, name, [Math.min(tower.solvedNormal, tower.req), tower.req], 'levels');
    goal.next = null;
    if (tower.active && !raw.done) goal.next = `Antipode teleporter · ${name}`;
    goal.onPlan = raw.done || !endingPlan || endingPlan.has(raw.targets[0]);
    return goal;
}

// the first ending's Sign, which counts the Antipode teleporters visited: its index among the signs and how many
// teleporters it needs
function teleporterSignOf(): { index: number; needed: number } {
    const signs = PROG.signs || [];
    const index = signs.findIndex((sign) => sign.gold && sign.tower == null);
    if (index < 0) return { index, needed: 0 };
    return { index, needed: signs[index].gold ?? 0 };
}

// the first ending's ground towers not under fog, the ones on its cheapest plan first. Until the Sign has enough,
// the ending counts the Antipode teleporters visited of the ones it needs, as the Sign's bar does, while that Sign
// is not under fog; a visited one's tower is activated, so never under fog.
function addAntipodes(context: GoalsContext, goal: GoalView, raw: EndingGoal, rawChildren: AntipodeGoal[]): void {
    const { plans } = context;
    const teleporterSign = teleporterSignOf();
    const id = raw.targets[0];
    const visited = rawChildren.filter((child) => child.done).length;
    const signMet = visited >= teleporterSign.needed;
    let endingPlan: Set<number> | null = null;
    if (id !== undefined && plans.settled[id] >= 0) endingPlan = plans.steps[id];

    // a plan that runs through no Antipode teleporter while the Sign still needs some says nothing about them
    const teleportersOnPlan = rawChildren.some((child) => endingPlan?.has(child.targets[0]));
    if (!signMet && !teleportersOnPlan) endingPlan = null;

    const shown = rawChildren.filter((child) => towerShown(context, child.tower));
    const children = shown.map((child) => antipodeGoal(context, child, endingPlan));
    const onPlan = children.filter((child) => child.onPlan);
    const offPlan = children.filter((child) => !child.onPlan);
    goal.children = [...onPlan, ...offPlan];

    const firstOpen = goal.children.find((child) => !child.done);
    for (const child of goal.children) {
        child.active = child === firstOpen;
    }

    if (raw.done || signMet || !context.signShown(teleporterSign.index)) return;

    goal.progress = [visited, teleporterSign.needed];
    if (shown.length < rawChildren.length) goal.fogged = true;
}

// whether a stage shows: a tower once it is not under fog, a sky Way with its tower, a place once its area is named
// (also once one of its `seen` pads is found, as the game can leave an area's name off after a visit), a level once it
// is not under fog
function stageShown(context: GoalsContext, child: TowerGoal | StageGoal): boolean {
    if (child.kind === 'tower') return towerShown(context, child.tower);
    if (child.route !== undefined) return towerShown(context, wayRoute(child.route).tower);

    const { tst } = context.progress;
    if (child.seen.some((pad) => tst[pad].disc)) return true;
    if (child.area !== undefined) return context.areaShown(child.area);
    return !context.progress.hidden[child.level!];
}

// the known route of a sky Way stage, which has an area and a tower
function wayRoute(route: number): { area: number; tower: number } {
    const { area, tower } = PROG.known_routes[route];
    return { area: area!, tower: tower! };
}

// a sky Way: named by its area while the area is named, else by the tower Sign it leads to
function wayStageGoal(context: GoalsContext, raw: StageGoal): GoalView {
    const { area, tower } = wayRoute(raw.route!);
    if (context.areaShown(area)) return baseGoal(raw, areaName(PROG.areas[area]), null, 'levels');
    return baseGoal(raw, unnamedWayName(context.progress.towers[tower].t), null, 'levels');
}

// a stage that is no tower: named by its area, its level or its sky Way
function stageGoal(context: GoalsContext, raw: StageGoal): GoalView {
    if (raw.route !== undefined) return wayStageGoal(context, raw);
    if (raw.area !== undefined) return baseGoal(raw, areaName(PROG.areas[raw.area]), null, 'levels');
    const goal = baseGoal(raw, context.levels[raw.level!].n, null, 'levels');
    goal.level = raw.level;
    return goal;
}

// an ending's stages in their order, the ones under fog left out; done ones stay listed
function addStages(context: GoalsContext, goal: GoalView, rawChildren: Array<TowerGoal | StageGoal>): void {
    const shown = rawChildren.filter((child) => stageShown(context, child));
    goal.children = shown.map((child) => {
        if (child.kind === 'tower') return towerGoal(context, child);
        return stageGoal(context, child);
    });

    const firstOpen = goal.children.find((child) => !child.done);
    for (const child of goal.children) {
        child.active = child === firstOpen;
    }

    if (shown.length < rawChildren.length) goal.fogged = true;
}

function endingGoal(context: GoalsContext, raw: EndingGoal): GoalView {
    const goal = baseGoal(raw, achievementName(raw.name), null, 'steps');
    const { left, fogged } = stepsLeft(context, raw);
    goal.left = left;
    goal.fogged = fogged;
    if (!raw.children) return goal;

    const antipodes = raw.children.filter((child) => child.kind === 'antipode');
    const stages = raw.children.filter((child) => child.kind === 'tower' || child.kind === 'stage');
    if (antipodes.length) addAntipodes(context, goal, raw, antipodes);
    if (stages.length) addStages(context, goal, stages);
    return goal;
}

function towerGoal(context: GoalsContext, raw: TowerGoal): GoalView {
    const tower = context.progress.towers[raw.tower];
    return baseGoal(raw, towerName(tower.t), [Math.min(tower.solvedNormal, tower.req), tower.req], 'levels');
}

function achievementGoal(context: GoalsContext, raw: AchievementGoal): GoalView {
    const rule = context.achievementRule(raw.name);
    let goalProgress: FoundOfTotal = [raw.done ? 1 : 0, 1];
    let unit = 'achievements';
    let tower: number | undefined;
    if (rule?.tower) {
        goalProgress = [Math.min(rule.tower.solvedNormal, rule.tower.req), rule.tower.req];
        unit = 'levels';
        tower = context.progress.towers.indexOf(rule.tower);
    } else if (rule?.levels) {
        const solvedLevels = rule.levels.filter((level) => context.progress.state[level] === 'solved');
        goalProgress = [solvedLevels.length, rule.levels.length];
        unit = 'levels';
    }

    if (raw.done) goalProgress = [goalProgress[1], goalProgress[1]];
    const goal = baseGoal(raw, achievementName(raw.name), goalProgress, unit);
    goal.tower = tower;
    return goal;
}

// the achievements count the children not under fog, as the totals do
function parentGoal<Child extends { done: boolean }>(
    raw: LadderGoalFields & { children: Child[] },
    label: string,
    unit: string,
    childShown: (child: Child) => boolean,
    childGoal: (child: Child) => GoalView,
): GoalView {
    const shown = raw.children.filter(childShown);
    const children = shown.map(childGoal);
    const firstOpen = children.find((child) => !child.done);
    for (const child of children) {
        child.active = child === firstOpen;
    }

    const done = children.filter((child) => child.done).length;
    const goal = baseGoal(raw, label, [done, children.length], unit, shown.length < raw.children.length);
    goal.children = children;
    return goal;
}

function completionistGoal(context: GoalsContext, raw: LadderGoalFields): GoalView {
    const { progress, levels } = context;
    const shown = levels.filter((level, i) => !progress.hidden[i]).length;
    const fogged = shown < levels.length;
    return baseGoal(raw, achievementName('COMPLETIONIST'), [progress.solved, shown], 'levels', fogged);
}

// the listed goals as the page shows them
function ladderOf(context: GoalsContext): GoalView[] {
    const { progress, endings } = context;
    const listed = (progress.goals || []).filter((raw) => raw.kind !== 'ending' || endings[raw.ending].shown);
    return listed.map((raw) => {
        if (raw.kind === 'ending') return endingGoal(context, raw);
        if (raw.kind === 'achievements') {
            return parentGoal(
                raw,
                'Achievements',
                'achievements',
                (child) => !context.achievementHidden(child.name),
                (child) => achievementGoal(context, child),
            );
        }
        return completionistGoal(context, raw);
    });
}

/**
 * The goals ladder as the page shows it (VIEWER.md "Goals (viewer)"), from progress.goals:
 * - goals: per goal key, kind, label, done, active, progress ([got, total]; for an ending null, or the first ending's
 *   Antipode teleporters visited of the ones its Sign needs), left (what is still to do, in `unit`: an ending's plan
 *   steps, else achievements or levels), fogged (more of it is under fog) and, for the first two endings and the
 *   achievements, the children not under fog;
 * - goalLevels(goal): the unsolved levels not under fog that serve the goal, in list order, each with its group
 *   (levelGroup), its role for the goal, what it leads to and whether it is on the goal's cheapest plans;
 * - goalLevelsFogged(goal): whether fog hides more of those levels;
 * - goalSolved(goal): the solved levels not under fog in the goal's scope;
 * - goalByKey(key) and goalFor(key): a goal by key, and the one the page shows (that one, else the active one).
 * Nothing under fog is named or counted: the endings are listed by their achievements' names, each once the one before
 * it is earned; counts leave out what fog hides, as the totals do.
 */
export function goalsView(view: GoalsViewInput): GoalsView {
    const plans = view.progress.plans;
    const context: GoalsContext = { ...view, plans, graph: plans.G };
    const goals = ladderOf(context);

    // a goal by its key, a child of an ending or the achievements too; null when none has it (a tower now under fog)
    const goalByKey = (key: string) => {
        for (const goal of goals) {
            if (goal.key === key) return goal;

            const child = goal.children?.find((goalChild) => goalChild.key === key);
            if (child) return child;
        }
        return null;
    };

    // the goal the list and the map show: the one picked by key, else the active one, else the last (every goal done)
    const goalFor = (key: string) => goalByKey(key) || goals.find((goal) => goal.active) || goals.at(-1) || null;

    return {
        goals,
        goalLevels: (goal) => goalLevelsOf(context, goal),
        goalLevelsFogged: (goal) => goalLevelsFoggedOf(context, goal),
        goalSolved: (goal) => goalSolvedOf(context, goal),
        goalByKey,
        goalFor,
    };
}
