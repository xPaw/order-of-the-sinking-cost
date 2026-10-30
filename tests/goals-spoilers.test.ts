// With spoilers hidden, no goal names or counts anything under fog: the demo ("Example: a new game") and a campaign
// at rank 1 with the ground shown and a few Signs read
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { PROG, worldReady } from '../src/data.ts';
import { setProgressCache } from '../src/model/progress.ts';
import { towerName } from '../src/model/towers.ts';
import { setSpoilersHidden } from '../src/shared.ts';
import { showDemo } from '../src/files.ts';
import { progressModel } from '../src/model/progress-model.ts';
import type { ProgressModel } from '../src/model/progress-model.ts';
import { freezerTowers } from '../src/model/goals.ts';
import type { GoalKind } from '../src/model/goals.ts';
import type { PlanStep } from '../src/model/requirements.ts';
import { achievementName } from '../src/model/achievements.ts';
import { RANK_ONE_SIGN_PID, registerCampaign, syntheticCampaign, TOWER_SIGN_PID } from './fixtures.ts';

// the page, without its DOM
vi.mock('../src/view.ts', () => ({ show() {}, async showSave() {} }));
// layer keys stand for their names
vi.mock('../src/model/layers.ts', async (importOriginal) => ({
    ...(await importOriginal()),
    layerName: (key: string) => key,
}));

const DEMO = 'No save loaded',
    SYNTHETIC = 'Synthetic campaign';
const READ_SIGN_PIDS = [RANK_ONE_SIGN_PID, TOWER_SIGN_PID];

beforeAll(async () => {
    await worldReady;
    setProgressCache(new WeakMap());
    await showDemo();
    registerCampaign(SYNTHETIC, syntheticCampaign({ rank: 1, readPids: READ_SIGN_PIDS, groundShown: true }));
});

// every goal text the page may show: labels, a ground tower's next step and what each listed level leads to
function goalTexts(model: ProgressModel) {
    const goals = model.goals.flatMap((goal) => [goal, ...(goal.children || [])]);
    return goals.flatMap((goal) => [
        goal.label,
        goal.next || '',
        ...model.goalLevels(goal).map((entry) => entry.leadsTo),
    ]);
}
const groundTowers = () => new Set((PROG.gold_rooms || []).map((room) => room.tower));
const freezerTowerSet = () => new Set(freezerTowers().keys());
function checkHidden(model: ProgressModel) {
    const { progress, levels } = model;
    const texts = goalTexts(model).join('\n');
    const words = new Set(texts.split(/[^\w]+/));
    for (const [i, level] of levels.entries()) if (progress.hidden[i]) expect(words.has(level.n), level.n).toBe(false);
    for (const [ti, tower] of progress.towers.entries())
        if (progress.towerHidden[ti]) expect(texts).not.toContain(towerName(tower.t));
    for (const ending of model.endings) if (!ending.shown) expect(texts).not.toContain(achievementName(ending.name));
    // the levels listed are not under fog
    for (const goal of model.goals)
        for (const entry of model.goalLevels(goal)) expect(progress.hidden[entry.i]).toBe(false);
    // the achievements count only the ones not under fog; the ground towers are the first ending's
    const achievements = goalOfKind(model, 'achievements');
    const ground = groundTowers();
    // the first ending lists only ground towers not under fog, and counts its Antipode teleporters only while the
    // Sign that counts them is not under fog
    const firstEnding = model.goals[0];
    for (const child of firstEnding.children || []) {
        expect(ground.has(child.tower!)).toBe(true);
        expect(progress.towerHidden[child.tower!]).toBe(false);
    }
    const shownGround = [...ground].filter((ti) => !progress.towerHidden[ti]);
    expect((firstEnding.children || []).length).toBe(shownGround.length);
    if (firstEnding.progress) {
        const sign = PROG.signs.findIndex((each) => each.gold && each.tower == null);
        expect(model.signSet.has(sign)).toBe(true);
        expect(firstEnding.progress[1]).toBe(PROG.signs[sign].gold);
    }
    expect(achievements!.progress![1]).toBe(achievements!.children!.length);
    for (const child of achievements!.children!) {
        expect(model.achievementHidden(child.name!)).toBe(false);
        if (child.tower != null) expect(progress.towerHidden[child.tower]).toBe(false);
    }
    // Completionist counts the levels not under fog
    expect(goalOfKind(model, 'completionist')!.progress![1]).toBe(
        levels.filter((level, i) => !progress.hidden[i]).length,
    );
}
const goalOfKind = (model: ProgressModel, kind: GoalKind) => model.goals.find((goal) => goal.kind === kind);
const endingLabels = (model: ProgressModel) =>
    model.goals.filter((goal) => goal.kind === 'ending').map((goal) => goal.label);

describe('goals with spoilers hidden', () => {
    test('the demo names and counts nothing under fog', () => {
        setSpoilersHidden(true);
        const model = progressModel(DEMO);
        expect(model.progress.hidden.filter(Boolean).length).toBeGreaterThan(0);
        // only the next ending, by its public name
        expect(endingLabels(model)).toEqual(['Endgame']);
        expect(model.achievementHidden('ENDGAME2')).toBe(true);
        // a new game has the ground towers and the Antipode teleporters' Sign under fog
        expect(model.goals[0].children).toEqual([]);
        expect(model.goals[0].progress).toBe(null);
        checkHidden(model);
    });
    test('a campaign with the ground shown names and counts nothing under fog', () => {
        setSpoilersHidden(true);
        const model = progressModel(SYNTHETIC);
        expect(model.progress.hidden.filter(Boolean).length).toBeGreaterThan(0);
        expect(model.progress.hidden.filter((hidden) => !hidden).length).toBeGreaterThan(0);
        expect(model.progress.towerHidden.some(Boolean)).toBe(true);
        expect(model.progress.towerHidden.some((hidden) => !hidden)).toBe(true);
        checkHidden(model);
        expect(model.goals.filter((goal) => goal.active).length).toBeLessThanOrEqual(1);
    });
    test('a sign step follows its sign on the map; a rule that is no Sign in the data is always shown', () => {
        const signIndex = PROG.signs.findIndex((sign) => !sign.status);
        const step: PlanStep = { t: 's', id: signIndex, g: PROG.signs[signIndex] };
        const unlisted: PlanStep = { t: 's', id: undefined, g: { pid: 0, rank: 1 } };

        setSpoilersHidden(true);
        const hidden = progressModel(DEMO);
        expect(hidden.signSet.has(signIndex)).toBe(false);
        expect(hidden.stepShown(step)).toBe(false);
        expect(hidden.stepShown(unlisted)).toBe(true);

        setSpoilersHidden(false);
        const shown = progressModel(DEMO);
        expect(shown.signSet.has(signIndex)).toBe(true);
        expect(shown.stepShown(step)).toBe(true);
        setSpoilersHidden(true);
    });
    test('a sky Way step follows its tower, not the tower Sign it leads to', () => {
        const routes = (PROG.known_routes || []).filter((route) => route.area !== undefined);
        expect(routes.length).toBeGreaterThan(0);

        for (const hide of [true, false]) {
            setSpoilersHidden(hide);
            const model = progressModel(DEMO);
            for (const route of routes) {
                const step: PlanStep = { t: 'w', id: route.area!, tower: route.tower! };
                expect(model.stepShown(step)).toBe(!model.progress.towerHidden[route.tower!]);
            }
        }
        setSpoilersHidden(true);
    });
    test('no ending counts a sign step whose sign is under fog', () => {
        setSpoilersHidden(true);
        const model = progressModel(SYNTHETIC);
        const { plans } = model.progress;
        let shownSteps = 0;
        let hiddenSteps = 0;
        for (const goal of model.goals) {
            for (const target of goal.targets) {
                for (const stepId of plans.steps[target] || []) {
                    const node = plans.G.node[stepId];
                    if (node?.t !== 's' || node.id === undefined) continue;

                    const inSet = model.signSet.has(node.id);
                    if (inSet) shownSteps++;
                    else hiddenSteps++;
                    expect(model.stepShown(node), plans.G.keys[stepId]).toBe(inSet);
                }
            }
        }
        expect(shownSteps).toBeGreaterThan(0);
        expect(hiddenSteps).toBeGreaterThan(0);
    });
    test('with spoilers shown every ending is listed, and its achievement goes by its Steam name', () => {
        setSpoilersHidden(false);
        const model = progressModel(DEMO);
        expect(endingLabels(model)).toEqual(['Endgame', 'Endgame High', 'Endgame Low']);
        const achievementLabels = goalOfKind(model, 'achievements')!.children!.map((child) => child.label);
        expect(achievementLabels).toContain('Endgame High');
        expect(achievementLabels).toContain('Endgame Low');
        expect(PROG.levels.length).toBe(goalOfKind(model, 'completionist')!.progress![1]);
        // every ground tower under the first ending, its Antipode teleporters counted against the Sign
        const firstEnding = model.goals[0];
        expect(firstEnding.children!.map((child) => child.tower).toSorted()).toEqual([...groundTowers()].toSorted());
        expect(firstEnding.progress).toEqual([0, 4]);
        // the second ending lists its stages: the towers whose Signs open Freezers, each followed by its Way, among the
        // places and levels, none under fog here
        const secondEnding = model.goals[1];
        const stageTowers = secondEnding.children!.filter((child) => child.kind === 'tower');
        expect(stageTowers.map((child) => child.tower).toSorted()).toEqual([...freezerTowerSet()].toSorted());
        expect(secondEnding.children!.map((child) => child.label)).toEqual([
            'Crossroads High',
            'High Heroes',
            'High Mirrors',
            'High Skipping Stones',
            'High Beamcasters',
            'The Heroic Way',
            'The Mirror Way',
            'The Skipping Way',
            'The Beam Way',
            'Antipode High',
        ]);
        setSpoilersHidden(true);
    });
});
