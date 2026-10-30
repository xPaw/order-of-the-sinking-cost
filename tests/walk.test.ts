// The walk model on a synthetic campaign: reachability, level roles and next steps
import { beforeAll, describe, expect, test } from 'vitest';
import { PROG, worldReady } from '../src/data.ts';
import { latestOf, protectedHeroes } from '../src/save.ts';
import type { ParsedHistory } from '../src/history-file.ts';
import type { DemoStatus } from '../src/status-file.ts';
import type { Seed } from '../src/walk/flood.ts';
import { walker } from '../src/walk/walker.ts';
import { ROLE } from '../src/model/level-roles.ts';
import { nextSteps } from '../src/model/next-steps.ts';
import { computeProgress, setProgressCache } from '../src/model/progress.ts';
import type { CampaignProgress } from '../src/model/progress.ts';
import { RANK_ONE_SIGN_PID, syntheticCampaign, TOWER_SIGN_PID } from './fixtures.ts';

beforeAll(async () => {
    await worldReady;
    setProgressCache(new WeakMap());
});

test('static roles', () => {
    expect(ROLE).toBeTruthy();
    const levelRoles = [...ROLE!.need.l];
    expect(levelRoles.length).toBe(PROG.levels.length);
    expect(levelRoles.filter(Boolean).length).toBe(769);
    expect(levelRoles.filter((role) => role === 1).length).toBe(166);
    expect(levelRoles.filter((role) => !role).length).toBe(151);
    expect(ROLE!.need.g.length).toBe(PROG.freezers.length);
    expect(ROLE!.bg.l.length).toBe(PROG.levels.length);
});

// kept hero positions outside the cells reachability() fills (seeded as it seeds them: a position that lands nowhere
// or in deep water seeds nothing), not counting the dead ones inside a wall no beam runs through nor the ones that land
// nowhere (a hero riding a Lily over deep water)
function heroesOutside(status: DemoStatus, history: ParsedHistory, progress: CampaignProgress) {
    const latest = latestOf(history),
        levels = PROG.levels;
    const { flood, land, deep, insideWall, cellOf, heroSeed } = walker(
        latest,
        progress.tst,
        progress.gateOpen.map((open) => !open),
    );
    const flags = new Map(status.levels.map((level) => [level.name, level.flags])),
        protectedKeys = protectedHeroes(history, PROG.world.guy || [0, 0]);
    const seeds: Seed[] = [history.hero ? heroSeed(history.hero) : -1];
    for (const position of history.heroes.values()) {
        const cell = land(cellOf(...position), false);
        if (!insideWall(cellOf(...position)) && cell >= 0 && !deep(cell))
            seeds.push(protectedKeys.has(position.join(',')) ? [cell, 1] : cell);
    }
    levels.forEach((level) => {
        if (flags.get(level.n) !== undefined) seeds.push(land(cellOf(...level.p)));
    });
    for (const [pid, x, y, z] of PROG.world.area_pins)
        if (latest.get(pid, 'activated')?.[0] === 1) seeds.push(land(cellOf(x, y, z), false));
    PROG.teleporters.forEach((teleporter, ti) => {
        if (progress.tst[ti].disc) seeds.push(land(cellOf(...teleporter.p)));
    });
    const reached = flood(seeds, null, new Set()),
        isReached = (cell: number) => reached.has(cell) || reached.has(land(cell));
    return [...history.heroes.values()].filter((position) => {
        const cell = cellOf(...position);
        const landing = land(cell, false);
        return !insideWall(cell) && landing >= 0 && !deep(landing) && !isReached(cell);
    });
}

describe('a campaign at rank 1 with two Signs read', () => {
    test('walks and lists next steps', () => {
        const readPids = [RANK_ONE_SIGN_PID, TOWER_SIGN_PID];
        const { status, history: campaignHistory } = syntheticCampaign({ rank: 1, readPids });
        const startHero = campaignHistory.hero!;
        const history: ParsedHistory = {
            ...campaignHistory,
            heroes: new Map([[startHero.join(','), startHero]]),
            heroAt: [[0, startHero, true]],
            records: 0,
            error: null,
        };
        expect(history.hero).toBeTruthy();
        const progress = computeProgress(status, history),
            levels = PROG.levels;
        expect(progress.reach).toBeTruthy();
        expect(progress.reach!.level.length).toBe(levels.length);
        expect(progress.reach!.level.some(Boolean)).toBe(true);
        expect(progress.state.length).toBe(levels.length);
        // a level the walk calls unreachable says why, a reachable one does not
        progress.state.forEach((levelState, i) => expect(!!progress.why[i]).toBe(levelState === 'blocked'));
        expect(progress.needed.length).toBe(levels.length);
        expect(nextSteps(progress, status)).toEqual(progress.needed);
        // next steps are levels not solved yet
        expect(progress.needed.some(Boolean)).toBe(true);
        progress.needed.forEach((needed, i) => {
            if (needed) expect(progress.state[i]).not.toBe('solved');
        });
        expect(heroesOutside(status, history, progress).length).toBe(0);
    });
});
