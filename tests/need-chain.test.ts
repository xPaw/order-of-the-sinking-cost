// The chain of table needs behind a level: where it goes, where it stops and which needs the save meets
import { describe, expect, test, vi } from 'vitest';
import { needChain, stopEnd } from '../src/model/need-chain.ts';
import type { ChainWorld } from '../src/model/need-chain.ts';
import type { NeedsView } from '../src/model/route-needs.ts';
import type { Freezer, Position, ProgressLevel, RouteNeed } from '../src/types.ts';

vi.mock('../src/data.ts', () => ({ PROG: { signs: [{ pid: 700, p: [5, 5, 0] }] } }));

const START: Position = [1, 1, 0];

const level = (name: string, needs: RouteNeed[][] | undefined): ProgressLevel => {
    const row: ProgressLevel = { n: name, p: [0, 0, 0], glow: 'green', req: [] };
    if (needs !== undefined) row.needs = needs;
    return row;
};

const freezerAt = (pid: number, p: Position, req: number[]): Freezer => ({ pid, p, l: 0, req });

function worldOf(levels: ProgressLevel[], freezers: Freezer[] = []): ChainWorld {
    return { levels, freezers, signs: [{ pid: 700, p: [5, 5, 0], l: 0, gates: [] }], start: START };
}

function viewOf(solved: number[] = []): NeedsView {
    return {
        levelSolved: (index) => solved.includes(index),
        freezerOpen: () => false,
        signRead: () => false,
        rockSmashed: () => false,
    };
}

describe('needChain', () => {
    test('follows the needs back to an entry with none and joins it to the start', () => {
        const world = worldOf([level('a', []), level('b', [[{ level: 0 }]]), level('c', [[{ level: 1 }]])]);
        const chain = needChain(world, viewOf(), 2);

        expect(chain.reachesStart).toBe(true);
        expect(chain.stops).toEqual([]);
        expect(chain.edges.map((edge) => [edge.from, edge.to])).toEqual([
            [1, 2],
            [0, 1],
            [START, 0],
        ]);
    });

    test('stops at a level the table leaves to the walk', () => {
        const world = worldOf([level('a', undefined), level('b', [[{ level: 0 }]])]);
        const chain = needChain(world, viewOf(), 1);

        expect(chain.reachesStart).toBe(false);
        expect(chain.stops).toEqual([{ reason: 'unknown', level: 0 }]);
        expect(stopEnd(world, chain.stops[0])).toBe(0);
    });

    test('stops at a Sign and at a Rock', () => {
        const world = worldOf([level('a', [[{ sign: 0 }]]), level('b', [[{ rock: 9 }]])]);

        const bySign = needChain(world, viewOf(), 0);
        expect(bySign.stops).toEqual([{ reason: 'sign', sign: 0 }]);
        expect(stopEnd(world, bySign.stops[0])).toEqual([5, 5, 0]);

        const byRock = needChain(world, viewOf(), 1);
        expect(byRock.stops).toEqual([{ reason: 'rock', rock: 9, at: 1 }]);
    });

    test('goes through the levels that open a Freezer', () => {
        const world = worldOf([level('a', []), level('b', [[{ freezer: 0 }]])], [freezerAt(50, [3, 3, 0], [0])]);
        const chain = needChain(world, viewOf(), 1);

        expect(chain.reachesStart).toBe(true);
        expect(chain.freezers).toEqual([0]);
        expect(chain.edges.map((edge) => [edge.from, edge.to])).toEqual([
            [[3, 3, 0], 1],
            [0, [3, 3, 0]],
            [START, 0],
        ]);
    });

    test('stops at a Freezer nothing opens', () => {
        const world = worldOf([level('a', [[{ freezer: 0 }]])], [freezerAt(50, [3, 3, 0], [])]);

        expect(needChain(world, viewOf(), 0).stops).toEqual([{ reason: 'freezer', freezer: 0 }]);
    });

    test('follows the option the save meets in a group of alternatives, else the first', () => {
        const world = worldOf([level('a', []), level('b', undefined), level('c', [[{ level: 0 }, { level: 1 }]])]);

        expect(needChain(world, viewOf(), 2).reachesStart).toBe(true);
        expect(needChain(world, viewOf([1]), 2).stops).toEqual([{ reason: 'unknown', level: 1 }]);
    });

    test('ends a loop at the repeated level', () => {
        const world = worldOf([level('a', [[{ level: 1 }]]), level('b', [[{ level: 0 }]])]);
        const chain = needChain(world, viewOf(), 0);

        expect(chain.reachesStart).toBe(false);
        expect(chain.stops).toEqual([{ reason: 'cycle', level: 0 }]);
    });

    test('marks met needs', () => {
        const world = worldOf([level('a', []), level('b', [[{ level: 0 }]])]);

        expect(needChain(world, viewOf([0]), 1).edges[0].met).toBe(true);
        expect(needChain(world, viewOf(), 1).edges[0].met).toBe(false);
    });
});
