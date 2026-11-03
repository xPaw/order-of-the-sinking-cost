// The cages that rank Signs open: the closed ones whose rank is reached, the ones holding a Promesst_Light or a Mirror
// first
import { beforeAll, describe, expect, test } from 'vitest';
import { PROG, worldReady } from '../src/data.ts';
import { rankCages } from '../src/model/rank-cages.ts';
import type { RankCageInput } from '../src/model/rank-cages.ts';

beforeAll(async () => {
    await worldReady;
});

function inputAtRank(rank: number, open: number[] = []): RankCageInput {
    return {
        rank,
        gateOpen: PROG.freezers.map((_freezer, gate) => open.includes(gate)),
        gateShown: () => true,
        signShown: () => true,
    };
}

// the gates of the Signs that ask for exactly this rank
function gatesOfRank(rank: number): number[] {
    return PROG.signs.filter((sign) => sign.rank === rank).flatMap((sign) => sign.gates);
}

describe('the cages a rank opens', () => {
    test('rank 2 lists none of the rank 3 cages', () => {
        const rankThree = gatesOfRank(3);
        expect(rankThree.length).toBeGreaterThan(0);

        const listed = rankCages(inputAtRank(2)).map((cage) => cage.gate);
        for (const gate of rankThree) expect(listed).not.toContain(gate);
    });

    test('rank 3 lists the rank 3 cages that are closed', () => {
        const rankThree = gatesOfRank(3);
        const listed = rankCages(inputAtRank(3)).map((cage) => cage.gate);
        for (const gate of rankThree) expect(listed).toContain(gate);
    });

    test('an open cage is dropped', () => {
        const rankThree = gatesOfRank(3);
        const listed = rankCages(inputAtRank(3, [rankThree[0]])).map((cage) => cage.gate);
        expect(listed).not.toContain(rankThree[0]);
        expect(listed).toContain(rankThree[1]);
    });

    test('a cage or Sign under fog is left out', () => {
        const rankOne = PROG.signs.findIndex((sign) => sign.rank === 1);
        const gate = PROG.signs[rankOne].gates[0];
        const gateFogged = { ...inputAtRank(1), gateShown: (each: number) => each !== gate };
        const signFogged = { ...inputAtRank(1), signShown: (each: number) => each !== rankOne };
        expect(rankCages(gateFogged).map((cage) => cage.gate)).not.toContain(gate);
        expect(rankCages(signFogged).map((cage) => cage.gate)).not.toContain(gate);
    });

    test('the cages holding a Promesst_Light or a Mirror come first', () => {
        const cages = rankCages(inputAtRank(5));
        const lifts = cages.filter((cage) => cage.liftPiece);
        expect(lifts.length).toBeGreaterThan(0);
        expect(lifts.length).toBeLessThan(cages.length);

        const firstOther = cages.findIndex((cage) => !cage.liftPiece);
        expect(firstOther).toBe(lifts.length);
    });

    test('a Sign for any rank lists nothing', () => {
        const anyRank = PROG.signs.filter((sign) => sign.rank === 255);
        const listed = rankCages(inputAtRank(5)).map((cage) => cage.sign);
        for (const sign of anyRank) expect(listed).not.toContain(PROG.signs.indexOf(sign));
    });
});
