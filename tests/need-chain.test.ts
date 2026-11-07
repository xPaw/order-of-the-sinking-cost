// The chain of table needs behind a level: where it goes, where it stops and which needs the save meets
import { describe, expect, test, vi } from 'vitest';
import { needChain } from '../src/model/need-chain.ts';
import type { ChainWorld } from '../src/model/need-chain.ts';
import type { NeedsView } from '../src/model/route-needs.ts';
import type { Freezer, Position, ProgressLevel, RouteNeed } from '../src/types.ts';

vi.mock('../src/data.ts', () => ({ PROG: { signs: [{ pid: 700 }, { pid: 701 }, { pid: 702 }] } }));

const START: Position = [1, 1, 0];
const SKY_HUB: Position = [2, 2, 33];
const HOLE: Position = [3, 3, 33];

const level = (name: string, needs: RouteNeed[][] | undefined): ProgressLevel => {
    const row: ProgressLevel = { n: name, p: [0, 0, 0], glow: 'green', req: [] };
    if (needs !== undefined) row.needs = needs;
    return row;
};

const freezerAt = (pid: number, p: Position, req: number[]): Freezer => ({ pid, p, l: 0, req });

function worldOf(levels: ProgressLevel[], freezers: Freezer[] = []): ChainWorld {
    return {
        levels,
        freezers,
        signs: [
            { pid: 700, p: [5, 5, 0], l: 0, gates: [] },
            { pid: 701, p: [6, 6, 0], l: 0, gold: 4, gates: [] },
            { pid: 702, p: [7, 7, 0], l: 0, tower: 1, gates: [] },
        ],
        towers: [
            { pid: 800, t: 0, req: 1, p: [8, 8, 0] },
            { pid: 801, t: 0, req: 1, p: [9, 9, 0] },
        ],
        goldRooms: [
            { tower: 0, pad: 0, endpoint: 0 },
            { tower: 1, pad: 0, endpoint: 0 },
        ],
        layerOf: (z) => (z > 10 ? 'sky' : 'ground'),
        hubs: new Map([
            ['ground', START],
            ['sky', SKY_HUB],
        ]),
        shown: () => true,
        towerShown: () => true,
        dropShown: () => true,
    };
}

function viewOf(solved: number[] = []): NeedsView {
    return {
        levelSolved: (index) => solved.includes(index),
        signRead: () => false,
    };
}

describe('needChain', () => {
    test('follows the needs back to an entry with none and joins it to the start', () => {
        const world = worldOf([level('a', []), level('b', [[{ level: 0 }]]), level('c', [[{ level: 1 }]])]);
        const chain = needChain(world, viewOf(), { level: 2 });

        expect(chain.stops).toEqual([]);
        expect(chain.edges.map((edge) => [edge.from, edge.to])).toEqual([
            [1, 2],
            [0, 1],
            [START, 0],
        ]);
    });

    test('ends a need of a High level on another layer at the hub', () => {
        const high = { ...level('b', [[{ level: 0 }]]), p: [9, 9, 33] as Position };
        const chain = needChain(worldOf([level('a', []), high]), viewOf(), { level: 1 });

        expect(chain.edges.map((edge) => [edge.from, edge.to])).toEqual([[SKY_HUB, 1]]);
    });

    test('runs a need of a ground level on High through the hubs of both layers', () => {
        const high = { ...level('a', []), p: [9, 9, 33] as Position };
        const chain = needChain(worldOf([high, level('b', [[{ level: 0 }]])]), viewOf(), { level: 1 });

        expect(chain.edges.map((edge) => [edge.from, edge.to])).toEqual([
            [0, SKY_HUB],
            [START, 1],
            [SKY_HUB, 0],
        ]);
    });

    test('ends the need of a dropped level at its hole', () => {
        const high = { ...level('a', []), p: [9, 9, 33] as Position };
        const dropped = { ...level('b', [[{ level: 0 }]]), drop: HOLE };
        const chain = needChain(worldOf([high, dropped]), viewOf(), { level: 1 });

        expect(chain.drops).toEqual([HOLE]);
        expect(chain.edges.map((edge) => [edge.from, edge.to])).toEqual([
            [0, HOLE],
            [SKY_HUB, 0],
        ]);
    });

    test('ends a ground need of a dropped level at the hub of the hole', () => {
        const dropped = { ...level('b', [[{ level: 0 }]]), drop: HOLE };
        const chain = needChain(worldOf([level('a', []), dropped]), viewOf(), { level: 1 });

        expect(chain.edges.map((edge) => [edge.from, edge.to])).toEqual([[SKY_HUB, HOLE]]);
    });

    test('ends the chain at a hole under fog', () => {
        const dropped = { ...level('a', [[{ sign: 0 }]]), drop: HOLE };
        const world = { ...worldOf([dropped]), dropShown: () => false };
        const chain = needChain(world, viewOf(), { level: 0 });

        expect(chain.drops).toEqual([]);
        expect(chain.stops).toEqual([]);
    });

    test('draws the unlocks a level holds in its needs once', () => {
        const unlocked = { ...level('b', [[{ level: 0 }]]), req: [0] };
        const chain = needChain(worldOf([level('a', []), unlocked]), viewOf(), { level: 1 });

        expect(chain.edges.map((edge) => [edge.from, edge.to])).toEqual([
            [0, 1],
            [START, 0],
        ]);
    });

    test('follows one of the levels that unlock a level when any one does', () => {
        const unlocked = { ...level('c', undefined), req: [0, 1], or: 1 };
        const chain = needChain(worldOf([level('a', []), level('b', []), unlocked]), viewOf([1]), { level: 2 });

        expect(chain.edges).toEqual([{ from: 1, to: 2, met: true }]);
    });

    test('joins a level with no needs and no unlocks to the hub', () => {
        const chain = needChain(worldOf([level('a', [])]), viewOf(), { level: 0 });

        expect(chain.stops).toEqual([]);
        expect(chain.edges).toEqual([{ from: START, to: 0, met: true }]);
    });

    test('stops at a level the table leaves to the walk with nothing unlocking it', () => {
        const world = worldOf([level('a', undefined), level('b', [[{ level: 0 }]])]);
        const chain = needChain(world, viewOf(), { level: 1 });

        expect(chain.stops).toEqual([{ reason: 'unknown', level: 0 }]);
    });

    test('follows the unlocks of a level the table leaves to the walk', () => {
        const unlocked = { ...level('b', undefined), req: [0] };
        const world = worldOf([level('a', []), unlocked]);
        const chain = needChain(world, viewOf(), { level: 1 });

        expect(chain.stops).toEqual([]);
        expect(chain.edges.map((edge) => [edge.from, edge.to])).toEqual([
            [0, 1],
            [START, 0],
        ]);
    });

    test('draws a met need and stops following there', () => {
        const world = worldOf([level('a', undefined), level('b', [[{ level: 0 }]])]);
        const chain = needChain(world, viewOf([0]), { level: 1 });

        expect(chain.stops).toEqual([]);
        expect(chain.levels).toEqual([1, 0]);
        expect(chain.edges).toEqual([{ from: 0, to: 1, met: true }]);
    });

    test('ends at a need under fog with no line and no stop', () => {
        const world = { ...worldOf([level('a', undefined), level('b', [[{ level: 0 }]])]), shown: () => false };
        const chain = needChain(world, viewOf(), { level: 1 });

        expect(chain.stops).toEqual([]);
        expect(chain.edges).toEqual([]);
    });

    test('shares what several targets need', () => {
        const world = worldOf([level('a', []), level('b', [[{ level: 0 }]]), level('c', [[{ level: 0 }]])]);
        const chain = needChain(world, viewOf(), { level: 1 }, { level: 2 });

        expect(chain.levels).toEqual([1, 0, 2]);
        expect(chain.edges.filter((edge) => edge.from === START)).toHaveLength(1);
    });

    test('stops at a Sign', () => {
        const world = worldOf([level('a', [[{ sign: 0 }]])]);

        const chain = needChain(world, viewOf(), { level: 0 });
        expect(chain.stops).toEqual([{ reason: 'sign', sign: 0 }]);
    });

    test('goes through a tower Sign to its tower and the gold-room Sign to every tower', () => {
        const world = worldOf([level('a', [[{ sign: 2 }]]), level('b', [[{ sign: 1 }]])]);

        const byTower = needChain(world, viewOf(), { level: 0 });
        expect(byTower.edges.map((edge) => edge.from)).toEqual([[7, 7, 0], [9, 9, 0], START]);

        const byGold = needChain(world, viewOf(), { level: 1 });
        expect(byGold.stops).toEqual([]);
        expect(byGold.edges.filter((edge) => edge.from === START).map((edge) => edge.to)).toEqual([
            [8, 8, 0],
            [9, 9, 0],
        ]);
    });

    test('follows a Freezer back through what opens it', () => {
        const world = worldOf([level('a', [])], [freezerAt(50, [3, 3, 0], [0])]);
        const chain = needChain(world, viewOf(), { freezer: 0 });

        expect(chain.freezers).toEqual([0]);
        expect(chain.edges.map((edge) => [edge.from, edge.to])).toEqual([
            [0, [3, 3, 0]],
            [START, 0],
        ]);
    });

    test('stops at a Freezer nothing opens', () => {
        const world = worldOf([level('a', [])], [freezerAt(50, [3, 3, 0], [])]);

        expect(needChain(world, viewOf(), { freezer: 0 }).stops).toEqual([{ reason: 'freezer', freezer: 0 }]);
    });

    test('follows the option the save meets in a group of alternatives, else the first', () => {
        const world = worldOf([level('a', []), level('b', undefined), level('c', [[{ level: 0 }, { level: 1 }]])]);

        expect(needChain(world, viewOf(), { level: 2 }).edges[0].from).toBe(0);
        expect(needChain(world, viewOf([1]), { level: 2 }).edges[0].from).toBe(1);
    });

    test('passes over an alternative under fog', () => {
        const levels = [level('a', []), level('b', []), level('c', [[{ level: 0 }, { level: 1 }]])];
        const world = { ...worldOf(levels), shown: (need: RouteNeed) => !('level' in need && need.level === 0) };

        expect(needChain(world, viewOf(), { level: 2 }).edges[0].from).toBe(1);
    });

    test('leaves out a tower under fog', () => {
        const world = { ...worldOf([level('a', [[{ sign: 1 }]])]), towerShown: (tower: number) => tower === 1 };
        const chain = needChain(world, viewOf(), { level: 0 });

        expect(chain.edges.filter((edge) => edge.from === START).map((edge) => edge.to)).toEqual([[9, 9, 0]]);
    });

    test('follows a Sign back to its towers', () => {
        const chain = needChain(worldOf([]), viewOf(), { sign: 2 });

        expect(chain.signs).toEqual([2]);
        expect(chain.edges.map((edge) => edge.from)).toEqual([[9, 9, 0], START]);
    });

    test('ends a loop at the repeated level', () => {
        const world = worldOf([level('a', [[{ level: 1 }]]), level('b', [[{ level: 0 }]])]);
        const chain = needChain(world, viewOf(), { level: 0 });

        expect(chain.stops).toEqual([{ reason: 'cycle', level: 0 }]);
    });

    test('treats a level the level data enables as having no unlocks', () => {
        const enabled = { ...level('b', undefined), req: [2], en: 1 };
        const unlocker = { ...level('c', undefined), req: [1] };
        const world = worldOf([level('a', [[{ level: 1 }]]), enabled, unlocker]);
        const chain = needChain(world, viewOf(), { level: 0 });

        expect(chain.stops).toEqual([{ reason: 'unknown', level: 1 }]);
        expect(chain.levels).toEqual([0, 1]);
    });

    test('marks met needs', () => {
        const world = worldOf([level('a', []), level('b', [[{ level: 0 }]])]);

        expect(needChain(world, viewOf([0]), { level: 1 }).edges[0].met).toBe(true);
        expect(needChain(world, viewOf(), { level: 1 }).edges[0].met).toBe(false);
    });
});
