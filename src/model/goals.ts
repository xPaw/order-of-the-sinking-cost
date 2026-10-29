// The goals ladder (VIEWER.md "Goals (viewer)")
import { PROG } from '../data.ts';
import type { EndingStageDone } from '../types.ts';
import { achievementNames, achievementRules, ENDINGS, hasAchievement } from './achievements.ts';
import { goalRoles, routeGraph } from './goal-roles.ts';
import type { GoalRoles } from './goal-roles.ts';
import type { BaseProgress } from './progress.ts';
import type { Plans } from './plans.ts';

interface GoalCore {
    key: string;
    done: boolean;
    /** The requirement ids it asks for; none once done. */
    targets: number[];
    /** The first goal of its list that is not done. */
    active: boolean;
    roles?: GoalRoles;
}

/**
 * One of the three endings, in rank order; the first has the ground towers' Antipode teleporters as children, the
 * others their stages in order (progress.json `ending_stages`).
 */
export interface EndingGoal extends GoalCore {
    kind: 'ending';
    ending: number;
    name: string;
    children?: Array<AntipodeGoal | TowerGoal | StageGoal>;
}

/**
 * A stage of an ending that is no tower, named by an area (`area`), a level (`level`) or a sky Way (`route`, an index
 * into `known_routes`); `seen` lists the pads (indices into `teleporters`) whose discovery shows the stage by itself.
 */
export interface StageGoal extends GoalCore {
    kind: 'stage';
    area?: number;
    level?: number;
    route?: number;
    seen: number[];
}

export interface TowerGoal extends GoalCore {
    kind: 'tower';
    tower: number;
}

/** A ground tower's Antipode teleporter. */
export interface AntipodeGoal extends GoalCore {
    kind: 'antipode';
    tower: number;
    room: number;
}

export interface AchievementGoal extends GoalCore {
    kind: 'achievement';
    name: string;
}

export interface AchievementsGoal extends GoalCore {
    kind: 'achievements';
    children: AchievementGoal[];
}

export interface CompletionistGoal extends GoalCore {
    kind: 'completionist';
}

export type LadderGoal = EndingGoal | AchievementsGoal | CompletionistGoal;

export type GoalKind =
    | LadderGoal['kind']
    | TowerGoal['kind']
    | AntipodeGoal['kind']
    | AchievementGoal['kind']
    | StageGoal['kind'];

function allOpen(progress: BaseProgress, freezers: number[]): boolean {
    return freezers.every((freezer) => progress.gateOpen[freezer]);
}

function closedKeys(progress: BaseProgress, freezers: number[]): string[] {
    const closed = freezers.filter((freezer) => !progress.gateOpen[freezer]);
    return closed.map((freezer) => 'g' + freezer);
}

function stageDone(progress: BaseProgress, status: { achievements: bigint }, done: EndingStageDone): boolean {
    if (done.rule === 'achievement') return hasAchievement(status, done.name);
    if (done.rule === 'tower') return progress.towers[done.tower].active;
    if (done.rule === 'freezers') return allOpen(progress, done.freezers);
    if (done.rule === 'solved') return progress.state[done.level] === 'solved';
    return done.pads.some((pad) => progress.tst[pad].disc);
}

// the requirements a stage asks for: the tower, the Freezers still closed, the level, the rank marker
function stageTargetKeys(progress: BaseProgress, done: EndingStageDone): string[] {
    if (done.rule === 'achievement') return ['e:' + done.name];
    if (done.rule === 'tower') return ['t' + done.tower];
    if (done.rule === 'freezers') return closedKeys(progress, done.freezers);
    if (done.rule === 'solved') return ['l' + done.level];
    return [];
}

// marks the first goal of a list not done as the active one
function markActive(goals: Array<{ done: boolean; active: boolean }>): void {
    const first = goals.find((goal) => !goal.done);
    if (first) first.active = true;
}

/** The towers whose Signs open Freezers, each with the Freezers its Signs open. */
export function freezerTowers(): Map<number, number[]> {
    const gatesOf = new Map<number, number[]>();

    for (const sign of PROG.signs || []) {
        if (sign.tower == null || !sign.gates.length) continue;

        const gates = gatesOf.get(sign.tower) ?? [];
        gates.push(...sign.gates);
        gatesOf.set(sign.tower, gates);
    }

    return gatesOf;
}

/**
 * The goals ladder (VIEWER.md "Goals (viewer)"), without fog: the three endings in rank order, the achievements,
 * Completionist. Per goal: key, kind, done, active (the first goal not done), targets (the requirement ids it asks for),
 * roles (goalRoles over the targets) and, for the achievements, children of the same shape: one per achievement but
 * Completionist, which is a goal of its own. The first ending has one child per ground tower (the towers with an
 * Antipode teleporter, which its Sign counts), the second and the third their stages in order.
 */
export function goalLadder(progress: BaseProgress & { plans: Plans }, status: { achievements: bigint }): LadderGoal[] {
    const levels = PROG.levels;
    const plans = progress.plans;
    const rules = achievementRules(progress);

    const idsOf = (keys: string[]) => {
        const ids = keys.map((key) => plans.G.index.get(key));
        return ids.filter((id) => id !== undefined);
    };

    const unsolved = (levelIds: number[]) => levelIds.filter((i) => progress.state[i] !== 'solved');
    const goal = <Fields extends { key: string; kind: GoalKind; done: boolean }>(
        fields: Fields,
        targetKeys: string[],
    ): Fields & { targets: number[]; active: boolean } => {
        const targets = fields.done ? [] : idsOf(targetKeys);
        return { ...fields, targets, active: false };
    };

    const endings = ENDINGS.map(([, name], ending): EndingGoal => {
        const level = levels.findIndex((candidate) => candidate.a === name);
        const targetKeys = level >= 0 ? ['l' + level] : [];
        return goal(
            { key: 'ending:' + name, kind: 'ending', ending, name, done: hasAchievement(status, name) },
            targetKeys,
        );
    });

    const towerGoals = progress.towers.map((tower, towerIndex): TowerGoal =>
        goal({ key: 'tower:' + towerIndex, kind: 'tower', tower: towerIndex, done: tower.active }, ['t' + towerIndex]),
    );

    // a ground tower's goal asks for its Antipode teleporter: its levels while it is not activated, then the step onto
    // its pad, done once the teleporter's endpoint is discovered
    const rooms = PROG.gold_rooms || [];
    const antipodeGoals: AntipodeGoal[] = [];

    for (const [room, goldRoom] of rooms.entries()) {
        const tower = goldRoom.tower;
        if (!progress.towers[tower]) continue;

        const visited = progress.tst[goldRoom.endpoint].disc;
        antipodeGoals.push(goal({ key: 'tower:' + tower, kind: 'antipode', tower, room, done: visited }, ['p' + room]));
    }

    antipodeGoals.sort((first, second) => first.tower - second.tower);

    // the stages of the other endings in order (progress.json `ending_stages`): per ending the list, none when the data
    // has no row for it
    const stageLists = endings.map((ending): Array<StageGoal | TowerGoal> => {
        const row = (PROG.ending_stages || []).find((candidate) => candidate.ending === ending.name);
        if (!row) return [];

        return row.stages.map((stage, position): StageGoal | TowerGoal => {
            const done = stageDone(progress, status, stage.done);
            const targetKeys = stageTargetKeys(progress, stage.done);
            if ('tower' in stage.name) {
                return goal(
                    { key: 'tower:' + stage.name.tower, kind: 'tower', tower: stage.name.tower, done },
                    targetKeys,
                );
            }

            const key = `stage:${ending.name}:${position}`;
            if ('area' in stage.name) {
                return goal({ key, kind: 'stage', area: stage.name.area, seen: stage.seen, done }, targetKeys);
            }
            if ('route' in stage.name) {
                return goal({ key, kind: 'stage', route: stage.name.route, seen: stage.seen, done }, targetKeys);
            }
            return goal({ key, kind: 'stage', level: stage.name.level, seen: stage.seen, done }, targetKeys);
        });
    });
    const stages = stageLists.flat();

    // an achievement asks for its tower, its levels, or its rank marker (ASCEND, DESCEND)
    const achievementKeys = (name: string) => {
        const rule = rules.get(name);
        if (!rule) return [];
        if (rule.tower) return ['t' + progress.towers.indexOf(rule.tower)];
        if (rule.levels) return unsolved(rule.levels).map((i) => 'l' + i);
        return ['e:' + name];
    };

    const achievementGoals = achievementNames()
        .filter((name) => name !== 'COMPLETIONIST')
        .map((name): AchievementGoal =>
            goal(
                { key: 'achievement:' + name, kind: 'achievement', name, done: hasAchievement(status, name) },
                achievementKeys(name),
            ),
        );

    const parent = <Fields extends { key: string; kind: GoalKind }, Child extends GoalCore>(
        fields: Fields,
        children: Child[],
    ): Fields & { done: boolean; targets: number[]; active: boolean; children: Child[] } => ({
        ...fields,
        done: children.every((child) => child.done),
        targets: children.flatMap((child) => child.targets),
        active: false,
        children,
    });

    const achievements: AchievementsGoal = parent({ key: 'achievements', kind: 'achievements' }, achievementGoals);
    if (endings.length && antipodeGoals.length) endings[0].children = antipodeGoals;

    // an ending not earned asks for its stages not done besides its own level (still targets[0]), so its roles reach
    // the levels that lead into them
    endings.forEach((ending, position) => {
        const stageList = stageLists[position];
        if (!stageList.length) return;

        ending.children = stageList;
        if (ending.done) return;
        for (const stage of stageList) {
            for (const id of stage.targets) {
                if (!ending.targets.includes(id)) ending.targets.push(id);
            }
        }
    });

    const levelsLeft = unsolved([...levels.keys()]);
    const completionist: CompletionistGoal = goal(
        {
            key: 'completionist',
            kind: 'completionist',
            done: hasAchievement(status, 'COMPLETIONIST') || !levelsLeft.length,
        },
        levelsLeft.map((i) => 'l' + i),
    );

    const goals: LadderGoal[] = [...endings, achievements, completionist];
    const graph = routeGraph(plans);
    for (const ladderGoal of [...goals, ...towerGoals, ...antipodeGoals, ...stages]) {
        ladderGoal.roles = goalRoles(plans, graph, ladderGoal.targets);
    }

    // a tower's or an ending's achievement asks for the same as that goal
    for (const achievementGoal of achievementGoals) {
        const rule = rules.get(achievementGoal.name);
        const ending = endings.find((goalOfEnding) => goalOfEnding.name === achievementGoal.name);
        if (rule?.tower) {
            achievementGoal.roles = towerGoals[progress.towers.indexOf(rule.tower)].roles;
        } else if (ending) {
            achievementGoal.roles = ending.roles;
        } else {
            achievementGoal.roles = goalRoles(plans, graph, achievementGoal.targets);
        }
    }

    markActive(goals);
    markActive(antipodeGoals);
    for (const stageList of stageLists) markActive(stageList);
    markActive(achievementGoals);
    return goals;
}

/** The goal the ladder starts at: the first one not done, else null. */
export const activeGoal = <Goal extends { active: boolean }>(goals: Goal[] | null | undefined): Goal | null =>
    goals?.find((goal) => goal.active) || null;
