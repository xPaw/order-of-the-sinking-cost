// The table's needs over the real data: no level's route loops back on itself
import { beforeAll, describe, expect, test } from 'vitest';
import { PROG } from '../src/data.ts';
import { worldReady } from '../src/world-data.ts';
import { mapLayerOf } from '../src/model/layers.ts';
import { needChain } from '../src/model/need-chain.ts';
import type { ChainWorld } from '../src/model/need-chain.ts';
import type { NeedsView } from '../src/model/route-needs.ts';
import type { Position } from '../src/types.ts';

const HUBS = new Map<string, Position>([
    ['ground', [80, 71, 0]],
    ['sky', [80, 72, 33]],
    ['underworld', [80, 68, -21]],
]);

const NOTHING_SOLVED: NeedsView = {
    levelSolved: () => false,
    signRead: () => false,
};

function worldOfData(): ChainWorld {
    return {
        levels: PROG.levels,
        freezers: PROG.freezers,
        signs: PROG.signs,
        towers: PROG.towers,
        goldRooms: PROG.gold_rooms,
        layerOf: mapLayerOf,
        hubs: HUBS,
        shown: () => true,
        towerShown: () => true,
        dropShown: () => true,
    };
}

beforeAll(async () => {
    await worldReady;
});

describe('the route of every level', () => {
    test('has no cycle with nothing solved and everything shown', () => {
        const world = worldOfData();
        const looping: string[] = [];

        PROG.levels.forEach((row, level) => {
            const chain = needChain(world, NOTHING_SOLVED, { level });
            if (chain.stops.some((stop) => stop.reason === 'cycle')) looping.push(row.n);
        });

        expect(looping).toEqual([]);
    });
});
