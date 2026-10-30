// A Sign opens its Freezers once it is read (`rank_satisfied` in the history), not when its rule holds; a Sign whose rule
// holds and is not read is a step of its own in the plans of the Freezers it opens
import { beforeAll, describe, expect, test } from 'vitest';
import { freshCampaign, walkLoaded } from '../scripts/lib/walk-fingerprint.ts';
import { PROG } from '../src/data.ts';
import { computeProgress } from '../src/model/progress.ts';
import type { CampaignProgress } from '../src/model/progress.ts';
import { unlockPlan } from '../src/model/plans.ts';
import { signStateOf } from '../src/model/unlocking.ts';
import { campaign, RANK_ONE_SIGN_PID, TOWER_SIGN_PID } from './fixtures.ts';

const signIndexOf = (pid: number) => PROG.signs.findIndex((sign) => sign.pid === pid);
const planKeys = (progress: CampaignProgress, gateIndex: number) => [
    ...unlockPlan(progress, ['gate', gateIndex])!.nodes.keys(),
];

beforeAll(async () => {
    await walkLoaded();
});

describe('a rank Sign', () => {
    const signIndex = signIndexOf(RANK_ONE_SIGN_PID);
    const gates = PROG.signs[signIndex].gates;

    test('whose rule holds and which is not read leaves its Freezers closed, with reading it as the step', () => {
        const progress = campaign(1);
        expect(gates.length).toBe(2);
        expect(signStateOf(progress, PROG.signs[signIndex])).toBe('ready');
        expect(progress.signOk(PROG.signs[signIndex])).toBe(true);
        expect(progress.signRead(RANK_ONE_SIGN_PID)).toBe(false);

        for (const gateIndex of gates) {
            expect(progress.gateOpen[gateIndex]).toBe(false);
            // the Sign stands beyond a Freezer of its own, so the way to it comes first
            expect(planKeys(progress, gateIndex).slice(-2)).toEqual(['s' + signIndex, 'g' + gateIndex]);
        }
    });

    test('whose rule does not hold leaves its Freezers closed, not ready to read', () => {
        const progress = campaign(0);
        expect(progress.signOk(PROG.signs[signIndex])).toBe(false);
        expect(signStateOf(progress, PROG.signs[signIndex])).toBe('unmet');
        for (const gateIndex of gates) expect(progress.gateOpen[gateIndex]).toBe(false);
    });

    test('once read opens its Freezers, with nothing left to do', () => {
        const progress = campaign(1, [RANK_ONE_SIGN_PID]);

        for (const gateIndex of gates) {
            expect(progress.gateOpen[gateIndex]).toBe(true);
            expect(planKeys(progress, gateIndex)).toEqual([]);
        }
        expect(signStateOf(progress, PROG.signs[signIndex])).toBe('read');
    });

    test('once read opens its Freezers whatever the rank is', () => {
        const progress = campaign(0, [RANK_ONE_SIGN_PID]);
        for (const gateIndex of gates) expect(progress.gateOpen[gateIndex]).toBe(true);
    });

    test('another Sign read leaves its Freezers closed', () => {
        const otherPid = PROG.signs.find((sign) => sign.rank === 1 && sign.pid !== RANK_ONE_SIGN_PID)!.pid;
        const progress = campaign(1, [otherPid]);
        for (const gateIndex of gates) expect(progress.gateOpen[gateIndex]).toBe(false);
    });

    test('whose Freezers the status lists opened stays open unread', () => {
        const openedPids = gates.map((gateIndex) => PROG.freezers[gateIndex].pid);
        const progress = campaign(1, [], openedPids);
        for (const gateIndex of gates) expect(progress.gateOpen[gateIndex]).toBe(true);
    });
});

describe('a tower Sign', () => {
    const signIndex = signIndexOf(TOWER_SIGN_PID);
    const sign = PROG.signs[signIndex];
    const gateIndex = sign.gates[0];

    test('keeps its Freezer closed until read, and the plan is the tower and then the reading', () => {
        const progress = campaign(1);
        expect(progress.gateOpen[gateIndex]).toBe(false);

        const plan = unlockPlan(progress, ['gate', gateIndex])!;
        const keys = [...plan.nodes.keys()];
        expect(keys).toContain('t' + sign.tower);
        expect(plan.edges).toContainEqual(['t' + sign.tower, 's' + signIndex]);
        expect(plan.edges).toContainEqual(['s' + signIndex, 'g' + gateIndex]);
    });

    test('opens its Freezer when read', () => {
        const progress = campaign(1, [TOWER_SIGN_PID]);
        expect(progress.gateOpen[gateIndex]).toBe(true);
    });
});

describe('a save without a history', () => {
    test('has every Sign unread, so no Sign opens a Freezer', () => {
        const { status } = freshCampaign();
        const progress = computeProgress({ ...status, rank: 5 }, null);

        for (const sign of PROG.signs) {
            if (sign.status) continue;
            expect(progress.signRead(sign.pid)).toBe(false);
            for (const gateIndex of sign.gates) expect(progress.gateOpen[gateIndex]).toBe(false);
        }
    });
});

describe('a synthetic campaign at rank 1 with Signs read', () => {
    let progress: CampaignProgress;

    beforeAll(() => {
        progress = campaign(1, [RANK_ONE_SIGN_PID, TOWER_SIGN_PID]);
    });

    test('a Sign read in the history has its Freezers open', () => {
        let checked = 0;
        for (const sign of PROG.signs) {
            if (sign.status || !progress.signRead(sign.pid)) continue;
            for (const gateIndex of sign.gates) {
                const freezer = PROG.freezers[gateIndex];
                const signCount = (freezer.signs || []).length;
                if (freezer.req.length !== 0 || signCount !== 1) continue;

                checked++;
                expect(progress.gateOpen[gateIndex]).toBe(true);
            }
        }
        expect(checked).toBeGreaterThan(0);
    });

    test('a Sign whose rule holds and which is not read is a step of the plans of its Freezers, unless they are listed open', () => {
        let checked = 0;
        for (const [signIndex, sign] of PROG.signs.entries()) {
            if (sign.status || progress.signRead(sign.pid) || !progress.signOk(sign)) continue;
            for (const gateIndex of sign.gates) {
                if (progress.gateOpen[gateIndex]) continue;

                checked++;
                expect(planKeys(progress, gateIndex)).toContain('s' + signIndex);
            }
        }
        expect(checked).toBeGreaterThan(0);
    });
});
