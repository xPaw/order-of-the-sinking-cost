// The known route to 4wcn_all_fast through the orange light above simultaneous_x, and what opens after it
import { beforeAll, describe, expect, test } from 'vitest';
import { PROG, worldReady } from '../src/data.ts';
import { computeProgress, setProgressCache } from '../src/model/progress.ts';
import { syntheticCampaign } from './fixtures.ts';

const SOLVED = 1;

function reachOf(solvedNames: string[], reachedNames: string[]): boolean[] {
    const { status, history } = syntheticCampaign({ rank: 1 });
    const levels = solvedNames.map((name) => ({ name, flags: SOLVED }));
    const progress = computeProgress({ ...status, levels }, history);
    return reachedNames.map((name) => progress.reach!.level[PROG.levels.findIndex((level) => level.n === name)]);
}

beforeAll(async () => {
    await worldReady;
    setProgressCache(new WeakMap());
});

describe('the row 77 walk to simultaneous_x and its Surprise', () => {
    const LEVELS = ['simultaneous_x', 'simultaneous_x_surprise'];

    test('each level has a route that needs torus_mirrors solved', () => {
        const torusMirrors = PROG.levels.findIndex((level) => level.n === 'torus_mirrors');

        for (const name of LEVELS) {
            const target = PROG.levels.findIndex((level) => level.n === name);
            const route = PROG.known_routes.find((row) => 'level' in row.to && row.to.level === target);
            expect(route?.needs).toEqual([[{ level: torusMirrors }]]);
        }
    });

    test('with torus_mirrors unsolved the walk reaches neither level', () => {
        expect(reachOf([], LEVELS)).toEqual([false, false]);
    });

    test('with torus_mirrors solved the walk reaches both, and nothing beyond them', () => {
        expect(reachOf(['torus_mirrors'], [...LEVELS, 'three_artifacts_v3'])).toEqual([true, true, false]);
    });
});

describe('the orange light above simultaneous_x', () => {
    const ARRIVALS = ['4wcn_all_fast', '4wc_dragon_cyan_s_v2'];

    test('4wcn_all_fast has a route that needs three_artifacts_v3 and magnitudes_v3 solved', () => {
        const names = ['three_artifacts_v3', 'magnitudes_v3'];
        const needs = names.map((name) => [{ level: PROG.levels.findIndex((level) => level.n === name) }]);
        const target = PROG.levels.findIndex((level) => level.n === '4wcn_all_fast');
        const route = PROG.known_routes.find((row) => 'level' in row.to && row.to.level === target);
        expect(route?.needs).toEqual(needs);
    });

    test('with one of the two levels solved the walk reaches neither level beyond the light', () => {
        expect(reachOf(['three_artifacts_v3'], ARRIVALS)).toEqual([false, false]);
        expect(reachOf(['magnitudes_v3'], ARRIVALS)).toEqual([false, false]);
    });

    test('with both solved the walk reaches 4wcn_all_fast and the level it leads to', () => {
        expect(reachOf(['three_artifacts_v3', 'magnitudes_v3'], ARRIVALS)).toEqual([true, true]);
    });
});
