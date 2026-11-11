// Pushes that change the beams while a flood runs, on a tiny synthetic overworld of one screen room
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PROG } from '../src/data.ts';
import { WORLD } from '../src/world-data.ts';
import type { LatestValues } from '../src/save.ts';
import type { MovableRow, World } from '../src/types.ts';
import type { Seed } from '../src/walk/flood.ts';
import { NO_HISTORY } from '../src/walk/reachability.ts';
import { walker } from '../src/walk/walker.ts';
import type { Walker } from '../src/walk/walker.ts';

vi.mock('../src/world-data.ts', () => import('./world-data-mock.ts'));
vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    return { SCHEMA, PROG: {}, WORLD: {}, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

const Z_OFFSET = 64,
    WIDTH = 12,
    HEIGHT = 6,
    LIGHT = 7,
    SLOT = 8,
    GEM = 11,
    ROCK = 12,
    THROUGH = 1,
    DOUBLE = 3,
    SQUEEZE = 9,
    PROTECTED = 1;
const LIGHT_KIND = 1,
    GEM_KIND = 0;

interface WorldOptions {
    walls?: Array<[i: number, j: number]>;
    gaps?: number[];
    beamRows?: number[];
    extra?: Partial<World>;
}
// A WIDTH x HEIGHT grid at z = 0 on the implicit ground floor: rows 0 and HEIGHT - 1 are wall, and so are `walls`.
// Column 0 is wall, and x 8 and 9 wall off the east end (x 10 and 11) of every row but those in `beamRows`, where
// `gaps` leave x 9 open.
function world({ walls = [], gaps = [], beamRows = [2], extra = {} }: WorldOptions = {}) {
    const solid = new Set<number>();
    const wall = (i: number, j: number) => solid.add(i + j * WIDTH);
    for (let i = 0; i < WIDTH; i++) {
        wall(i, 0);
        wall(i, HEIGHT - 1);
    }
    for (let j = 1; j < HEIGHT - 1; j++) {
        wall(0, j);
        wall(8, j);
        if (!(beamRows.includes(j) && gaps.includes(j))) wall(9, j);
        if (!beamRows.includes(j)) {
            wall(10, j);
            wall(11, j);
        }
    }
    for (const [i, j] of walls) wall(i, j);
    const columns: number[] = [];
    for (let column = 0; column < WIDTH * HEIGHT; column++) {
        if (solid.has(column)) {
            columns.push(1, Z_OFFSET);
        } else {
            columns.push(0);
        }
    }
    Object.assign(WORLD!, {
        solid: Uint8Array.from(columns),
        groups: new Uint8Array(0),
        water: new Uint8Array(WIDTH * HEIGHT),
    });
    Object.assign(PROG, {
        levels: [],
        teleporters: [],
        freezers: [],
        map: { size: [WIDTH, HEIGHT], corner: [0, 0], layers: [{ key: 'ground', z: [-8, 8] }] },
        world: {
            grid: { corner: [0, 0], size: [WIDTH, HEIGHT], zoff: Z_OFFSET },
            zlayer: Array.from({ length: 256 }, () => 0),
            groups: [],
            rocks: [],
            lilies: [],
            floors: [],
            switches: [],
            gates: [],
            fences: [],
            oceans: [],
            elevators: [],
            wardrobes: [],
            monsters: [],
            beam_stops: [],
            mechs: [],
            area_pins: [],
            guy: [0, 0],
            lights: [],
            gem_slots: [[SLOT, 2, 4, 0, 0]],
            movables: [],
            ...extra,
        },
    });
}

// latest values: the slot's `flags` hold BEAM_POWERED when `powered`, none otherwise
const latest = (powered: boolean): LatestValues => ({
    ...NO_HISTORY,
    get: (pid: number, field: string) => {
        if (pid !== SLOT || field !== 'flags' || !powered) return undefined;
        return Uint8Array.of(2);
    },
});
const walk = (powered: boolean) => walker(latest(powered), [], []);
const reaches = (walkGrid: Walker, seeds: Seed[], i: number, j: number) =>
    walkGrid.flood(seeds).has(walkGrid.cellOf(i, j, 0));
const heroAt = (walkGrid: Walker, i: number, j: number) => [walkGrid.cellOf(i, j, 0)];

// a light facing east at (1, 2); the room's slot (2, 4) is empty, and a Gem at (3, 1) can be pushed east onto (5, 1)
function gemWorld(color: number, { gaps = [], gem = true }: { gaps?: number[]; gem?: boolean } = {}) {
    const movables: MovableRow[] = [[LIGHT, 1, 2, 0, LIGHT_KIND]];
    if (gem) movables.push([GEM, 3, 1, 0, GEM_KIND]);
    world({
        gaps,
        extra: {
            lights: [[LIGHT, 1, 2, 0, 0, 0, 0, 0, color]],
            gem_slots: [[SLOT, 5, 1, 0, 0]],
            movables,
        },
    });
}

describe('a Gem pushed onto its slot', () => {
    test('powers the room, and the light casts its beam', () => {
        gemWorld(THROUGH);
        const walkGrid = walk(false);
        expect(walkGrid.beam.size).toBe(0);
        expect(reaches(walkGrid, heroAt(walkGrid, 2, 2), 10, 2)).toBe(true);
    });
    test('without the Gem the beam stays dark', () => {
        gemWorld(THROUGH, { gem: false });
        const walkGrid = walk(false);
        expect(reaches(walkGrid, heroAt(walkGrid, 2, 2), 10, 2)).toBe(false);
    });
    test('a hero with PROTECTION pushes nothing', () => {
        gemWorld(THROUGH);
        const walkGrid = walk(false);
        expect(reaches(walkGrid, [[walkGrid.cellOf(2, 2, 0), PROTECTED]], 10, 2)).toBe(false);
    });
    test("a flood's pushes are undone when it ends", () => {
        gemWorld(THROUGH);
        const walkGrid = walk(false);
        expect(reaches(walkGrid, heroAt(walkGrid, 2, 2), 10, 2)).toBe(true);
        expect(walkGrid.beam.size).toBe(0);
        expect(reaches(walkGrid, [[walkGrid.cellOf(2, 2, 0), PROTECTED]], 10, 2)).toBe(false);
        expect(reaches(walkGrid, heroAt(walkGrid, 2, 2), 10, 2)).toBe(true);
    });
    test('a DOUBLE beam it powers leaves the plain step', () => {
        // x 8 is wall in row 2 and x 9 open: from (7, 2) the doubled step lands on (9, 2), and (10, 2) takes a
        // plain step
        gemWorld(DOUBLE, { gaps: [2] });
        const walkGrid = walk(false);
        const reached = walkGrid.flood(heroAt(walkGrid, 2, 2));
        for (const i of [9, 10, 11]) expect(reached.has(walkGrid.cellOf(i, 2, 0))).toBe(true);
    });
});

describe('a Rock that stops a beam', () => {
    beforeEach(() => {
        // a powered THROUGH light at (1, 2) facing east, its beam stopped by the Rock at (5, 2)
        world({
            extra: {
                lights: [[LIGHT, 1, 2, 0, 0, 0, 0, 0, THROUGH]],
                rocks: [[ROCK, 5, 2, 0]],
            },
        });
    });
    test('pushed off the line, lets the beam run on', () => {
        const walkGrid = walk(true);
        expect(walkGrid.beam.size).toBe(3);
        expect(reaches(walkGrid, heroAt(walkGrid, 2, 2), 10, 2)).toBe(true);
    });
    test('stays when no cell next to it is reached', () => {
        world({
            walls: [
                [5, 1],
                [5, 3],
                [6, 2],
            ],
            extra: {
                lights: [[LIGHT, 1, 2, 0, 0, 0, 0, 0, THROUGH]],
                rocks: [[ROCK, 5, 2, 0]],
            },
        });
        const walkGrid = walk(true);
        expect(reaches(walkGrid, heroAt(walkGrid, 2, 2), 10, 2)).toBe(false);
    });
});

describe('a Rock pushed back into the old stop of a lengthened beam', () => {
    // SMASH lights (a color whose power the walk lays nowhere) at (1, 3) and (1, 4) face east, stopped by the Rocks at
    // (3, 3) and (3, 4); the hero stands in (2, 3) and (2, 4). The first Rock goes east to (4, 3) and its beam runs on
    // through (3, 3); the second goes north into (3, 3), pushed from (3, 5), and its beam runs on through (3, 4); then
    // the first beam's old stop holds it, pushed from (3, 2). Both push cells are walls outside the flood, which a
    // thawed Freezer lets push from. Once (3, 4) is free the hero walks on past the Rock in (4, 4) to (6, 3), and
    // only then pushes the Rock at (6, 2) off a THROUGH beam that runs east through the walls to (10, 2): a push the
    // flood makes only while it has Rock pushes left.
    const SMASH = 2;
    const SECOND_LIGHT = 15;
    const THROUGH_LIGHT = 19;
    const SECOND_ROCK = 16;
    const THROUGH_ROCK = 17;
    const CORRIDOR_ROCK = 18;
    const FREEZER = 13;
    const open = new Set([
        '1,1',
        '1,3',
        '1,4',
        '2,3',
        '2,4',
        '3,3',
        '3,4',
        '4,3',
        '4,4',
        '5,2',
        '5,4',
        '6,1',
        '6,2',
        '6,3',
        '6,4',
        '7,1',
    ]);

    test('is not pushed off again, which would use up the Rock pushes', () => {
        const walls: Array<[number, number]> = [];
        for (let i = 1; i <= 7; i++) {
            for (let j = 1; j <= 4; j++) {
                if (!open.has(`${i},${j}`)) walls.push([i, j]);
            }
        }

        world({
            walls,
            extra: {
                lights: [
                    [LIGHT, 1, 3, 0, 0, 0, 0, 0, SMASH],
                    [SECOND_LIGHT, 1, 4, 0, 0, 0, 0, 0, SMASH],
                    [THROUGH_LIGHT, 5, 2, 0, 0, 0, 0, 0, THROUGH],
                ],
                rocks: [
                    [ROCK, 3, 3, 0],
                    [SECOND_ROCK, 3, 4, 0],
                    [THROUGH_ROCK, 6, 2, 0],
                    [CORRIDOR_ROCK, 4, 4, 0],
                ],
                gem_slots: [[SLOT, 7, 1, 0, 0]],
            },
        });
        PROG.freezers = [{ pid: FREEZER, p: [1, 1, 0], l: 0, req: [] }];

        const walkGrid = walker(latest(true), [], [true]);
        const freezerCell = walkGrid.cellOf(1, 1, 0);
        walkGrid.thaw(freezerCell);
        const outside = new Set([walkGrid.cellOf(3, 2, 0), walkGrid.cellOf(3, 5, 0)]);
        const reached = walkGrid.flood([walkGrid.cellOf(2, 3, 0), walkGrid.cellOf(2, 4, 0)], outside);
        walkGrid.freeze(freezerCell, 0);

        expect(reached.has(walkGrid.cellOf(10, 2, 0))).toBe(true);
    });
});

describe('a push from the cells a flood stays out of', () => {
    // the Gem's push cell (2, 1) is left out of a flood from (7, 2); a Freezer stands in (6, 4)
    const FREEZER = 13;
    const pushCellOutside = (thawFreezer: boolean) => {
        gemWorld(THROUGH);
        PROG.freezers = [{ pid: FREEZER, p: [6, 4, 0], l: 0, req: [] }];
        const walkGrid = walker(latest(false), [], [true]);
        const freezerCell = walkGrid.cellOf(6, 4, 0);
        if (thawFreezer) walkGrid.thaw(freezerCell);
        const outside = new Set([walkGrid.cellOf(2, 1, 0)]);
        const reached = walkGrid.flood(heroAt(walkGrid, 7, 2), outside);
        if (thawFreezer) walkGrid.freeze(freezerCell, 0);
        return reached.has(walkGrid.cellOf(10, 2, 0));
    };
    test('is made while a closed Freezer is opened for the flood', () => {
        expect(pushCellOutside(true)).toBe(true);
    });
    test('is not made with the Freezers as they were', () => {
        expect(pushCellOutside(false)).toBe(false);
    });
});

describe('a pushed light', () => {
    test('casts its beam from each cell it is pushed to', () => {
        // the light at (3, 3) faces east into the beam stop (4, 3); pushed north from (3, 4) it stands in (3, 2), and
        // its beam runs along row 2
        world({
            extra: {
                lights: [[LIGHT, 3, 3, 0, 0, 0, 0, 0, THROUGH]],
                beam_stops: [[4, 3, 0]],
                movables: [[LIGHT, 3, 3, 0, LIGHT_KIND]],
            },
        });
        const walkGrid = walk(true);
        expect(walkGrid.beam.size).toBe(0);
        expect(reaches(walkGrid, heroAt(walkGrid, 2, 4), 10, 2)).toBe(true);
    });
    test('stops no other beam in the cell it left', () => {
        // the THROUGH light at (1, 2) faces east into a SQUEEZE light at (5, 2), which faces west; pushed north from
        // (5, 3) it stands in (5, 1), and the THROUGH beam runs on along row 2
        const squeezeLight = 14;
        world({
            extra: {
                lights: [
                    [LIGHT, 1, 2, 0, 0, 0, 0, 0, THROUGH],
                    [squeezeLight, 5, 2, 0, 2, 0, 0, 0, SQUEEZE],
                ],
                movables: [[squeezeLight, 5, 2, 0, LIGHT_KIND]],
            },
        });
        const walkGrid = walk(true);
        expect(reaches(walkGrid, heroAt(walkGrid, 2, 3), 10, 2)).toBe(true);
    });
});
