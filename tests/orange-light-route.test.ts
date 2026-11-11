// The needs of the levels past the orange light and the way to 4wcn_all_fast through the orange light above simultaneous_x, and what opens after it
import { beforeAll, describe, expect, test } from 'vitest';
import { PROG } from '../src/data.ts';
import { worldReady } from '../src/world-data.ts';
import { computeProgress, setProgressCache } from '../src/model/progress.ts';
import { reachedByNeedsOf, syntheticCampaign } from './fixtures.ts';

const SOLVED = 1;

function reachOf(solvedNames: string[], reachedNames: string[]): boolean[] {
    const { status, history } = syntheticCampaign({ rank: 1 });
    const levels = solvedNames.map((name) => ({ name, flags: SOLVED }));
    const progress = computeProgress({ ...status, levels }, history);
    const reached = reachedByNeedsOf(progress);
    return reachedNames.map((name) => reached[PROG.levels.findIndex((level) => level.n === name)]);
}

beforeAll(async () => {
    await worldReady;
    setProgressCache(new WeakMap());
});

function doorsOf(solvedNames: string[], names: string[]): boolean[] {
    const { status, history } = syntheticCampaign({ rank: 1 });
    const levels = solvedNames.map((name) => ({ name, flags: SOLVED }));
    const progress = computeProgress({ ...status, levels }, history);
    return names.map((name) => progress.doorReached[PROG.levels.findIndex((level) => level.n === name)]);
}

describe('the doors of endpoint_holder3 and endpoint_holder4', () => {
    const HOLDERS = ['endpoint_holder3', 'endpoint_holder4'];

    test('with skip_purple_drop_alt solved both doors are reached, though endpoint_holder4 is not', () => {
        expect(doorsOf(['skip_purple_drop_alt'], HOLDERS)).toEqual([true, true]);
        expect(reachOf(['skip_purple_drop_alt'], HOLDERS)).toEqual([true, false]);
    });

    test('with skip_purple_drop_alt unsolved neither door is reached', () => {
        expect(doorsOf([], HOLDERS)).toEqual([false, false]);
    });

    test('a level whose door is reached is not blocked, behind a Freezer or a lead', () => {
        const { status, history } = syntheticCampaign({ rank: 1 });
        const levels = [{ name: 'skip_purple_drop_alt', flags: SOLVED }];
        const progress = computeProgress({ ...status, levels }, history);
        const holder4 = PROG.levels.findIndex((level) => level.n === 'endpoint_holder4');

        expect(progress.doorReached[holder4]).toBe(true);
        expect(progress.state[holder4]).not.toBe('blocked');
        expect(progress.behind[holder4]).toEqual([]);
        expect(progress.leads.some((levelIndices) => levelIndices.includes(holder4))).toBe(false);
    });
});

describe('the row 77 walk to simultaneous_x and its Surprise', () => {
    const LEVELS = ['simultaneous_x', 'simultaneous_x_surprise'];

    test('each level needs torus_mirrors solved', () => {
        const torusMirrors = PROG.levels.findIndex((level) => level.n === 'torus_mirrors');

        for (const name of LEVELS) {
            const level = PROG.levels.find((candidate) => candidate.n === name);
            expect(level?.needs).toContainEqual([{ level: torusMirrors }]);
        }
    });

    test('with torus_mirrors unsolved the table reaches neither level', () => {
        expect(reachOf([], LEVELS)).toEqual([false, false]);
    });

    test('with torus_mirrors and simultaneous_x solved the table reaches both, and nothing beyond them', () => {
        expect(reachOf(['torus_mirrors'], [...LEVELS, 'three_artifacts_v3'])).toEqual([true, false, false]);
        expect(reachOf(['torus_mirrors', 'simultaneous_x'], [...LEVELS, 'three_artifacts_v3'])).toEqual([
            true,
            true,
            false,
        ]);
    });
});

describe('the orange light above simultaneous_x', () => {
    const ARRIVALS = ['4wcn_all_fast', '4wc_dragon_cyan_s_v2'];

    test('4wcn_all_fast needs three_artifacts_v3 and magnitudes_v3 solved', () => {
        const names = ['three_artifacts_v3', 'magnitudes_v3'];
        const needs = names.map((name) => [{ level: PROG.levels.findIndex((level) => level.n === name) }]);
        const level = PROG.levels.find((candidate) => candidate.n === '4wcn_all_fast');
        expect(level?.needs).toEqual(needs);
    });

    test('with one of the two levels solved the table reaches neither level beyond the light', () => {
        expect(reachOf(['three_artifacts_v3'], ARRIVALS)).toEqual([false, false]);
        expect(reachOf(['magnitudes_v3'], ARRIVALS)).toEqual([false, false]);
    });

    test('with both solved the table reaches 4wcn_all_fast, and the level it unlocks once it is solved', () => {
        expect(reachOf(['three_artifacts_v3', 'magnitudes_v3'], ARRIVALS)).toEqual([true, false]);
        expect(reachOf(['three_artifacts_v3', 'magnitudes_v3', '4wcn_all_fast'], ARRIVALS)).toEqual([true, true]);
    });
});
