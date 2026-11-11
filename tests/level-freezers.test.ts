// The Freezers a level sits behind come from the Freezers its need levels open: the nearest one to the level
import { expect, test } from 'vitest';
import { directGatesOf, gatesBehindOf, needFreezersOf } from '../src/model/level-freezers.ts';
import type { BehindState, FreezerWorld } from '../src/model/level-freezers.ts';
import type { Position, RouteNeed } from '../src/types.ts';

const GRID = [190, 156];

function level(p: Position, needs?: RouteNeed[][]) {
    return { p, needs };
}

function freezer(p: Position, req: number[]) {
    return { p, req };
}

// a level with no needs counts as reached, as does a solved one
function stateOf(world: FreezerWorld, solved: number[], open: number[], entered: number[] = []): BehindState {
    const reached = world.levels.map(
        (row, i) => solved.includes(i) || entered.includes(i) || (row.needs ?? []).length === 0,
    );
    return {
        doorReached: reached,
        levelSolved: (i) => solved.includes(i),
        gateOpen: world.freezers.map((_, i) => open.includes(i)),
    };
}

test('an opener with one Freezer stands for that Freezer, wherever it is', () => {
    const world: FreezerWorld = {
        levels: [level([0, 0, 0]), level([100, 100, 0], [[{ level: 0 }]])],
        freezers: [freezer([10, 10, 0], [0])],
        gridSize: GRID,
    };

    expect(needFreezersOf(world)[1]).toEqual([[0]]);
    expect(gatesBehindOf(world, needFreezersOf(world), stateOf(world, [], []))).toEqual([[], [0]]);
});

test('an opener with two Freezers stands for the one nearest to the level', () => {
    const world: FreezerWorld = {
        levels: [level([0, 0, 0]), level([60, 60, 0], [[{ level: 0 }]]), level([20, 20, 0], [[{ level: 0 }]])],
        freezers: [freezer([20, 20, 0], [0]), freezer([60, 60, 0], [0])],
        gridSize: GRID,
    };

    const choice = needFreezersOf(world);
    expect(choice[1]).toEqual([[1]]);
    expect(choice[2]).toEqual([[0]]);
    expect(gatesBehindOf(world, choice, stateOf(world, [], []))).toEqual([[], [1], [0]]);
});

test('the nearest Freezer is found across the wrap of the map', () => {
    const world: FreezerWorld = {
        levels: [level([0, 0, 0]), level([5, 5, 0], [[{ level: 0 }]])],
        // 100 away without the wrap in x, 15 away with it; the other is 50 away
        freezers: [freezer([55, 5, 0], [0]), freezer([180, 5, 0], [0])],
        gridSize: GRID,
    };

    expect(needFreezersOf(world)[1]).toEqual([[1]]);

    const flat: FreezerWorld = { ...world, gridSize: undefined };
    expect(needFreezersOf(flat)[1]).toEqual([[0]]);
});

test('a Sign need and a level that opens nothing stand for no Freezer', () => {
    const world: FreezerWorld = {
        levels: [level([0, 0, 0]), level([5, 5, 0], [[{ sign: 0 }, { level: 0 }]])],
        freezers: [],
        gridSize: GRID,
    };

    expect(needFreezersOf(world)[1]).toEqual([[undefined, undefined]]);
    expect(gatesBehindOf(world, needFreezersOf(world), stateOf(world, [], []))[1]).toEqual([]);
});

// level 0 opens Freezer 0 and level 1 opens Freezer 1; level 1 needs level 0, level 2 level 1, level 3 level 2
const CHAIN: FreezerWorld = {
    levels: [
        level([0, 0, 0]),
        level([10, 10, 0], [[{ level: 0 }]]),
        level([30, 30, 0], [[{ level: 1 }]]),
        level([40, 40, 0], [[{ level: 2 }]]),
    ],
    freezers: [freezer([10, 10, 0], [0]), freezer([35, 35, 0], [1])],
    gridSize: GRID,
};

test('a Freezer leads to the levels with a need that stands for it, not to the levels further on', () => {
    const choice = needFreezersOf(CHAIN);

    expect(choice[3]).toEqual([[undefined]]);
    expect(directGatesOf(CHAIN, choice, stateOf(CHAIN, [], []))).toEqual([[], [0], [1], []]);
    expect(directGatesOf(CHAIN, choice, stateOf(CHAIN, [], [0]))).toEqual([[], [], [1], []]);
});

test('a closed Freezer two steps back is behind only once its opener is reached', () => {
    const choice = needFreezersOf(CHAIN);

    // Freezer 1 waits on level 1, which is not reached: the levels behind it are held by Freezer 0
    expect(gatesBehindOf(CHAIN, choice, stateOf(CHAIN, [], []))).toEqual([[], [0], [0], [0]]);
    // level 1 reached: Freezer 1 is the one to act on, and Freezer 0 is not on the way
    expect(gatesBehindOf(CHAIN, choice, stateOf(CHAIN, [], [], [1]))).toEqual([[], [], [1], [1]]);
});

test('with no Freezer whose opener is reached, the closed Freezers met first are kept', () => {
    const choice = needFreezersOf(CHAIN);

    // Freezer 0 open, level 1 not reached: only Freezer 1 is left, and its opener is not reached
    expect(gatesBehindOf(CHAIN, choice, stateOf(CHAIN, [], [0]))).toEqual([[], [], [1], [1]]);
});

test('an opened Freezer no longer appears', () => {
    const choice = needFreezersOf(CHAIN);

    expect(gatesBehindOf(CHAIN, choice, stateOf(CHAIN, [], [0, 1]))).toEqual([[], [], [], []]);
});

test('a group with a solved need adds no Freezer', () => {
    const world: FreezerWorld = {
        levels: [level([0, 0, 0]), level([10, 10, 0]), level([30, 30, 0], [[{ level: 0 }, { level: 1 }]])],
        freezers: [freezer([10, 10, 0], [0]), freezer([20, 20, 0], [1])],
        gridSize: GRID,
    };
    const choice = needFreezersOf(world);

    expect(gatesBehindOf(world, choice, stateOf(world, [], []))[2]).toEqual([0, 1]);
    expect(gatesBehindOf(world, choice, stateOf(world, [1], []))[2]).toEqual([]);
});
