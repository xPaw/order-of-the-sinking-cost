// The Signs row of the sidebar's Find on the map: the signs that open Freezers, found when read, over the ones not
// under fog, and the ones ready to read (their rule holds); and, when SOKO_SAVES names a folder of snapshots, its default save, read-only
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { savesDir } from '../scripts/saves.ts';
import { PROG, worldReady } from '../src/data.ts';
import type { Sign } from '../src/types.ts';
import { parseHistory, parseStatus } from '../src/save.ts';
import { setProgressCache } from '../src/model/progress.ts';
import type { BaseProgress } from '../src/model/progress.ts';
import { signRuleMet } from '../src/model/unlocking.ts';
import type { SignRule } from '../src/model/unlocking.ts';
import { totalsOf } from '../src/model/totals.ts';
import type { ShownAt } from '../src/model/totals.ts';
import { setSpoilersHidden, state } from '../src/shared.ts';
import { showDemo } from '../src/files.ts';
import { progressModel } from '../src/model/progress-model.ts';

// the page, without its DOM
vi.mock('../src/view.ts', () => ({ show() {}, async showSave() {} }));

const LIVE = 'default';
const hasSave = (camp: string) =>
    Boolean(process.env.SOKO_SAVES) &&
    existsSync(join(savesDir(), camp, 'Status.sokoban_status')) &&
    existsSync(join(savesDir(), camp, 'overworld.history'));

beforeAll(async () => {
    await worldReady;
    setProgressCache(new WeakMap());
    await showDemo();
    if (!hasSave(LIVE)) return;
    const read = (name: string) => new Uint8Array(readFileSync(join(savesDir(), LIVE, name)));
    state.files.set(`${LIVE}/Status.sokoban_status`, {
        path: `${LIVE}/Status.sokoban_status`,
        parsed: parseStatus(read('Status.sokoban_status')),
        file: null,
        buf: null,
        error: null,
    });
    state.files.set(`${LIVE}/overworld.history`, {
        path: `${LIVE}/overworld.history`,
        parsed: parseHistory(read('overworld.history')),
        file: null,
        buf: null,
        error: null,
    });
});

// the totals of a save that has only a rank: no tower active, no gold room found, no Freezer open, nothing found
function totalsAtRank(rank: number, shownAt: ShownAt, known: string[] | null, readPids: number[] = []) {
    const progress: BaseProgress = {
        state: [],
        unlocks: [],
        towers: [],
        gateOpen: PROG.freezers.map(() => false),
        tst: PROG.teleporters.map(() => ({ en: false, disc: false })),
        goldFound: 0,
        signOk: (rule: SignRule) => signRuleMet(rule, { rank }, [], 0),
        signRead: (pid: number) => readPids.includes(pid),
        rockSmashed: () => false,
        signAccess: [],
        signWayIn: [],
        reach: null,
        behind: [],
        why: [],
        wayIn: [],
        wayInChains: [],
        wayInFixed: new Set(),
        access: [],
        ice: [],
        lt: null,
        solved: 0,
    };
    return totalsOf({ status: { treasureFlags: 0 }, progress, hide: known !== null, shownAt, known });
}

const openingSigns = () => PROG.signs.filter((sign) => !sign.status);

describe('the Signs row', () => {
    test('counts the Signs that open Freezers, none of the tower status Signs', () => {
        const everywhere = () => true;
        const totals = totalsAtRank(0, everywhere, null);
        expect(openingSigns().length).toBeLessThan(PROG.signs.length);
        expect(totals.stats.signs).toEqual([0, 17]);
        expect(totals.stats.by.signs).toBe('Overworld 0 / 8 · High 0 / 8 · Low 0 / 1');
    });

    test('at rank 1 the rank 1 Signs are ready to read, not found', () => {
        const rankOneSigns = openingSigns().filter((sign) => sign.rank === 1);
        const totals = totalsAtRank(1, () => true, null);
        expect(rankOneSigns.length).toBe(5);
        expect(totals.stats.signs).toEqual([0, 17]);
        expect(totals.stats.signsReady).toBe(5);
        expect(totals.stats.by.signs).toBe('Overworld 0 / 8 · High 0 / 8 · Low 0 / 1');
    });

    test('a read Sign is found whatever its rule says', () => {
        const rankOneSigns = openingSigns().filter((sign) => sign.rank === 1);
        const readPids = rankOneSigns.map((sign) => sign.pid);
        const totals = totalsAtRank(1, () => true, null, readPids);
        expect(totals.stats.signs).toEqual([5, 17]);
        expect(totals.stats.signsReady).toBe(0);
    });

    test('a read Sign with its rule not holding counts as found', () => {
        const rankFive = openingSigns().find((sign) => sign.rank === 5);
        const totals = totalsAtRank(0, () => true, null, [rankFive!.pid]);
        expect(totals.stats.signs).toEqual([1, 17]);
        expect(totals.stats.signsReady).toBe(0);
    });

    test('a Sign under fog is left out of the count and the split', () => {
        const notSky = (layer: string | undefined) => layer !== 'sky';
        const totals = totalsAtRank(1, notSky, ['ground', 'underworld']);
        expect(totals.stats.signs).toEqual([0, 9]);
        expect(totals.stats.signsReady).toBe(5);
        expect(totals.stats.by.signs).toBe('Overworld 0 / 8 · Low 0 / 1');
    });

    test('nothing is listed while every Sign is under fog', () => {
        const nowhere = () => false;
        const totals = totalsAtRank(1, nowhere, []);
        expect(totals.stats.signs).toEqual([0, 0]);
        expect(totals.stats.by.signs).toBe('');
    });

    test('the demo with spoilers hidden has no fog data, so every Sign is under fog', () => {
        setSpoilersHidden(true);
        const model = progressModel('No save loaded');
        expect(model.stats.signs).toEqual([0, 0]);
    });

    test.skipIf(!hasSave(LIVE))('the snapshot save counts the Signs not under fog by their reading', () => {
        setSpoilersHidden(true);
        const model = progressModel(LIVE);
        const shownSigns: Sign[] = [];
        PROG.signs.forEach((sign, i) => {
            if (!sign.status && model.signSet.has(i)) shownSigns.push(sign);
        });

        const read = shownSigns.filter((sign) => model.progress.signRead(sign.pid));
        const ready = shownSigns.filter((sign) => !model.progress.signRead(sign.pid) && model.progress.signOk(sign));
        expect(model.stats.signs).toEqual([read.length, shownSigns.length]);
        expect(model.stats.signsReady).toBe(ready.length);
    });
});
