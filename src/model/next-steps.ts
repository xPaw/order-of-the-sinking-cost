// Next steps: the levels playable now that open what is still to do, and the order of a goal's list
// (viewer.md "Next steps")
import { PROG } from '../data.ts';
import { ENDINGS, hasAchievement } from './achievements.ts';
import { roleFor } from './goal-roles.ts';
import type { GoalRoles } from './goal-roles.ts';
import { roleOf } from './level-roles.ts';
import { planAll } from './plans.ts';
import type { PlanSource } from './plans.ts';
import type { CampaignProgress } from './progress.ts';

/**
 * What a level playable now brings closer: the towers (with the levels each has left), the level and gate keys that come
 * after it in the plans ("l3", "g12"), and the index in ENDINGS of the next ending when it leads there.
 */
export interface NextStep {
    towers: Array<[tower: number, left: number]>;
    down: Set<string>;
    ending?: number | null;
}

/** The kind and index a key of `NextStep.down` names. */
export function downKeyOf(key: string): [kind: 'l' | 'g', index: number] {
    const kind = key[0] === 'l' ? 'l' : 'g';
    return [kind, Number(key.slice(1))];
}

/**
 * Next steps: the levels playable now that open the unlock plan of anything still to do (a tower not activated, an
 * achievement level, a locked or unreachable level, a closed Freezer), and the levels the walk calls unreachable that
 * such a plan runs through. Per level: the towers its plans bring closer (with the levels each has left; a tower counts
 * every unsolved level of its own with a plan) and the level and gate keys after it in those plans. Plans do not depend
 * on the goal, so a key comes after a level in a goal's plan when the level is in the key's plan; the roles that pick
 * the keys a goal needs are applied where the list is ordered or labelled.
 */
export function nextSteps(progress: PlanSource, status: { achievements: bigint }): Array<NextStep | null> {
    const levels = PROG.levels;
    const needed = levels.map((): NextStep | null => null);
    const plans = progress.plans || planAll(progress);
    const { G: graph, steps, settled } = plans;

    // the requirement id of a key that has a plan still to do, else -1
    const planned = (key: string) => {
        const id = graph.index.get(key);
        if (id === undefined || settled[id] < 0 || graph.met[id]) return -1;
        return id;
    };

    // the steps of the goals' plans, and per tower goal the steps of its levels' plans
    const inGoals = new Set<number>();
    const towerSteps: Array<[tower: number, left: number, steps: Set<number>]> = [];
    const addPlan = (id: number, into: Set<number>) => {
        for (const step of steps[id]!) into.add(step);
    };

    progress.towers.forEach((tower, towerIndex) => {
        if (tower.active) return;

        const towerPlan = new Set<number>();
        for (const level of tower.normal) {
            const id = planned('l' + level);
            if (id >= 0) addPlan(id, towerPlan);
        }
        for (const step of towerPlan) inGoals.add(step);
        towerSteps.push([towerIndex, tower.req - tower.solvedNormal, towerPlan]);
    });

    levels.forEach((level, i) => {
        if (progress.state[i] === 'solved') return;

        const hasAchievementToEarn = level.a && !hasAchievement(status, level.a);
        const isGoal = hasAchievementToEarn || progress.state[i] === 'locked' || progress.state[i] === 'blocked';
        const id = isGoal ? planned('l' + i) : -1;
        if (id >= 0) addPlan(id, inGoals);
    });

    PROG.freezers.forEach((freezer, freezerIndex) => {
        if (progress.gateOpen[freezerIndex] || freezer.judge) return;

        const id = planned('g' + freezerIndex);
        if (id >= 0) addPlan(id, inGoals);
    });

    // the level a step stands for when it is listed: playable now, or unreachable
    const listedLevelOf = (id: number): number | null => {
        const node = graph.node[id];
        if (node?.t !== 'l') return null;
        if (node.front || progress.state[node.id] === 'blocked') return node.id;
        return null;
    };

    const entry = (level: number): NextStep => {
        let step = needed[level];
        if (!step) {
            step = { towers: [], down: new Set() };
            needed[level] = step;
        }
        return step;
    };

    for (const goalStep of inGoals) {
        const node = graph.node[goalStep]!;
        const goalLevel = listedLevelOf(goalStep);
        if (goalLevel !== null) entry(goalLevel);
        if (node.t !== 'l' && node.t !== 'g') continue;

        for (const step of steps[goalStep]!) {
            const stepLevel = listedLevelOf(step);
            if (step !== goalStep && stepLevel !== null) entry(stepLevel).down.add(graph.keys[goalStep]);
        }
    }

    for (const [towerIndex, left, towerPlan] of towerSteps) {
        for (const step of towerPlan) {
            const stepLevel = listedLevelOf(step);
            if (stepLevel !== null) entry(stepLevel).towers.push([towerIndex, left]);
        }
    }

    // the steps toward the next ending not earned yet (its index in ENDINGS)
    const next = ENDINGS.findIndex(([, name]) => !hasAchievement(status, name));
    const endingLevel = next >= 0 ? levels.findIndex((level) => level.a === ENDINGS[next][1]) : -1;
    const endingId = endingLevel >= 0 ? planned('l' + endingLevel) : -1;
    if (endingId >= 0) {
        for (const step of steps[endingId]!) {
            const stepLevel = listedLevelOf(step);
            if (stepLevel !== null) entry(stepLevel).ending = next;
        }
    }

    return needed;
}

/**
 * The group of an unsolved level in the lists: playable now, not reachable (the walk calls it unreachable) or locked.
 */
export function levelGroup(state: string): 'playable' | 'blocked' | 'locked' {
    if (state === 'locked') return 'locked';
    if (state === 'blocked') return 'blocked';
    return 'playable';
}

const GROUP_ORDER = { playable: 0, blocked: 1, locked: 2 };
const NO_NEXT_STEP: NextStep = { towers: [], down: new Set(), ending: null };

// A level's ('l') or Freezer's ('g') role in a goal's list: the goal's role, else (no goal, or one without roles yet)
// the static one
function listRole(goal: { roles?: GoalRoles } | null, kind: 'l' | 'g', id: number) {
    const role = roleFor(goal, kind, id);
    if (role) return role;
    return roleOf(kind, id);
}

/** What orderNextSteps() leaves out: whether a level, Freezer or tower is shown, and a level's distance. */
export interface ShownForOrder {
    level: (level: number) => boolean;
    gate: (freezer: number) => boolean;
    tower: (tower: number) => boolean;
    dist: (level: number) => number;
}

/**
 * The order of a goal's list (ids: unsolved levels, most with progress.needed set): the playable ones, then the ones the walk
 * calls unreachable, then the locked ones; within each, the steps toward the next ending first, then by the tower a
 * level brings closest to done, then by the levels and gates after it in the plans that the goal needs (on every route
 * or on some), then by `dist`. Towers, levels and gates the `shown` tests leave out do not count.
 */
export function orderNextSteps(
    progress: Pick<CampaignProgress, 'needed' | 'state'>,
    ids: number[],
    shown: ShownForOrder,
    goal: { roles?: GoalRoles } | null = null,
): number[] {
    const required = (kind: 'l' | 'g', id: number) => {
        const visible = kind === 'l' ? shown.level(id) : shown.gate(id);
        if (!visible) return false;
        const role = listRole(goal, kind, id);
        return role === 'req' || role === 'one';
    };

    const sortKeys = new Map(
        ids.map((level): [number, number[]] => {
            const step = progress.needed[level] || NO_NEXT_STEP;

            let closest = Infinity;
            for (const [tower, left] of step.towers) {
                if (shown.tower(tower) && left < closest) closest = left;
            }

            let after = 0;
            for (const downKey of step.down) {
                const [kind, id] = downKeyOf(downKey);
                if (required(kind, id)) after++;
            }

            const group = GROUP_ORDER[levelGroup(progress.state[level])];
            const towardEnding = step.ending == null ? 1 : 0;
            return [level, [group, towardEnding, closest, -after, shown.dist(level)]];
        }),
    );

    return ids.toSorted((first, second) => {
        const firstKey = sortKeys.get(first)!;
        const secondKey = sortKeys.get(second)!;
        for (let part = 0; part < firstKey.length; part++) {
            if (firstKey[part] !== secondKey[part]) return firstKey[part] - secondKey[part];
        }
        return 0;
    });
}
