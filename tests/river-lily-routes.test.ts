// The needs of the levels onto the wrapping river: past wrap_music the Lily is ridden to the five levels along it
import { beforeAll, describe, expect, test } from 'vitest';
import { PROG } from '../src/data.ts';
import { worldReady } from '../src/world-data.ts';
import { computeProgress, setProgressCache } from '../src/model/progress.ts';
import { reachedByNeedsOf, syntheticCampaign } from './fixtures.ts';

// Each river level with the level that unlocks it, if any
const RIVER_LEVELS: Record<string, string | undefined> = {
    far_wings: 'before_wings',
    sick_270_small: 'layered_alt',
    infinite_looping_skipper_mirrored_ikaruga_alt: 'infinite_looping_skipper_far',
    swapwiz_harder: undefined,
    duality_2: 'duality_condensed',
};

const SOLVED = 1;

function indexOf(name: string): number {
    return PROG.levels.findIndex((level) => level.n === name);
}

function reachOf(solvedNames: string[]): boolean[] {
    const { status, history } = syntheticCampaign({ rank: 1 });
    const levels = solvedNames.map((name) => ({ name, flags: SOLVED }));
    const progress = computeProgress({ ...status, levels }, history);
    const reached = reachedByNeedsOf(progress);
    return Object.keys(RIVER_LEVELS).map((name) => reached[indexOf(name)]);
}

function gatesOf(...names: string[]): string[] {
    return names.flatMap((name) => RIVER_LEVELS[name] ?? []);
}

beforeAll(async () => {
    await worldReady;
    setProgressCache(new WeakMap());
});

describe('the Lily on the wrapping river', () => {
    test('every level along the river needs wrap_music solved', () => {
        for (const name of Object.keys(RIVER_LEVELS)) {
            const level = PROG.levels.find((candidate) => candidate.n === name);
            expect(level?.needs).toContainEqual([{ level: indexOf('wrap_music') }]);
        }
    });

    test('with wrap_music unsolved the table reaches none of the river levels', () => {
        expect(reachOf(gatesOf(...Object.keys(RIVER_LEVELS)))).toEqual([false, false, false, false, false]);
    });

    test('with wrap_music solved the table reaches the levels whose unlocks are solved', () => {
        expect(reachOf(['wrap_music'])).toEqual([false, false, false, true, false]);
        expect(reachOf(['wrap_music', ...gatesOf(...Object.keys(RIVER_LEVELS))])).toEqual([
            true,
            true,
            true,
            true,
            true,
        ]);
    });
});
