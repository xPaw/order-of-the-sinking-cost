// The why text of a level the walk cannot reach, on a stub context
import { expect, test, vi } from 'vitest';
import { PROG } from '../src/data.ts';
import type { PlanStep } from '../src/model/requirements.ts';
import { whyText } from '../src/panels/why.ts';
import type { WhyContext } from '../src/panels/why.ts';
import type { Freezer } from '../src/types.ts';
import { level } from './fixtures.ts';

// one cage that level 0 unlocks
const FREEZERS = vi.hoisted((): Freezer[] => [{ pid: 1, p: [0, 0, 0], l: 0, req: [0] }]);

vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    return { SCHEMA, PROG: { levels: [], freezers: FREEZERS }, WORLD: {}, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

interface Stub {
    fromSky: boolean;
    skyShown: boolean;
    // the closed gates the level's pocket bumps into, none of them a way in
    bumped?: number[];
    gateShown?: boolean;
}

// one blocked level with no way-in gate, no mechanic and no access mark
function context({ fromSky, skyShown, bumped = [], gateShown = true }: Stub): WhyContext {
    // the level data enters level 0 from the sky, or not
    const entry = level('stub');
    if (fromSky) entry.drop = [0, 0, 0];
    PROG.levels = [entry];
    return {
        progress: {
            wayIn: [[]],
            why: [{ gates: [], pad: [], via: [], viaTowers: [], mech: [] }],
            access: [null],
            behind: [bumped],
        },
        model: { stepShown: (node: PlanStep) => node.t !== 'a' || node.id !== 'sky' || skyShown },
        status: { achievements: 0n },
        hide: true,
        iceOf: [],
        freezers: FREEZERS,
        gateShown: () => gateShown,
        gateArea: () => null,
    };
}

test('a level the data enters from the sky is "from High" once the sky shows', () => {
    expect(whyText(context({ fromSky: true, skyShown: true }), 0)).toBe('from High');
});
test('under fog the sky is not named, and the level is not reachable from where the hero has been', () => {
    expect(whyText(context({ fromSky: true, skyShown: false }), 0)).toBe('not reachable from where you have been');
});
test('a pocket with no way in at all has "no known route"', () => {
    expect(whyText(context({ fromSky: false, skyShown: true }), 0)).toBe('no known route');
});
test('a pocket whose only gate is one the level unlocks says so', () => {
    const text = whyText(context({ fromSky: false, skyShown: true, bumped: [0] }), 0);
    expect(text).toBe('only behind a cage it unlocks');
});
test('a gate the level unlocks gives way to the sky entry', () => {
    expect(whyText(context({ fromSky: true, skyShown: true, bumped: [0] }), 0)).toBe('from High');
    const hiddenSky = whyText(context({ fromSky: true, skyShown: false, bumped: [0] }), 0);
    expect(hiddenSky).toBe('not reachable from where you have been');
});
test('a gate under fog is not named', () => {
    const text = whyText(context({ fromSky: false, skyShown: true, bumped: [0], gateShown: false }), 0);
    expect(text).toBe('no known route');
});
