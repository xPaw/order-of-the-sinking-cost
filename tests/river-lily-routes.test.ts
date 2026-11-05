// The known routes onto the wrapping river: past wrap_music the Lily is ridden to the five levels along it
import { beforeAll, describe, expect, test } from 'vitest';
import { PROG, worldReady } from '../src/data.ts';
import { computeProgress, setProgressCache } from '../src/model/progress.ts';
import { syntheticCampaign } from './fixtures.ts';

const RIVER_LEVELS = [
    'far_wings',
    'sick_270_small',
    'infinite_looping_skipper_mirrored_ikaruga_alt',
    'swapwiz_harder',
    'duality_2',
];

const SOLVED = 1;

function reachOf(solvedNames: string[]): boolean[] {
    const { status, history } = syntheticCampaign({ rank: 1 });
    const levels = solvedNames.map((name) => ({ name, flags: SOLVED }));
    const progress = computeProgress({ ...status, levels }, history);
    return RIVER_LEVELS.map((name) => progress.reach!.level[PROG.levels.findIndex((level) => level.n === name)]);
}

beforeAll(async () => {
    await worldReady;
    setProgressCache(new WeakMap());
});

describe('the Lily on the wrapping river', () => {
    test('every level along the river has a route that needs wrap_music solved', () => {
        const wrapMusic = PROG.levels.findIndex((level) => level.n === 'wrap_music');

        for (const name of RIVER_LEVELS) {
            const target = PROG.levels.findIndex((level) => level.n === name);
            const route = PROG.known_routes.find((row) => 'level' in row.to && row.to.level === target);
            expect(route?.needs).toEqual([[{ level: wrapMusic }]]);
        }
    });

    test('with wrap_music unsolved the walk reaches none of the river levels', () => {
        expect(reachOf([])).toEqual([false, false, false, false, false]);
    });

    test('with wrap_music solved the walk reaches all of them', () => {
        expect(reachOf(['wrap_music'])).toEqual([true, true, true, true, true]);
    });
});
