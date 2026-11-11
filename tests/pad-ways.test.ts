// A MINOR pad that lands the hero outside the reached cells is a way into the levels he walks on to from the landing,
// and so is the Tower that enables a disabled Tower pad
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { PROG } from '../src/data.ts';
import type { History } from '../src/history-file.ts';
import { NO_HISTORY, reachability } from '../src/walk/reachability.ts';
import type { TeleporterState } from '../src/walk/teleporters.ts';

// A row of 16 at z 0 on the implicit ground floor, which wraps around: the hero at 0..2, a closed Freezer 0 in column
// 3, the empty pocket 4..6, the pocket 8..10 with level L (column 10) and the pocket 12..14 with level Q (column 13),
// shut off from each other by walls at z 0 in columns 7, 11 and 15.
vi.mock('../src/world-data.ts', () => import('./world-data-mock.ts'));
vi.mock('../src/data.ts', async () => {
    const SCHEMA = (await import('../data/schema.json')).default;
    const WIDTH = 16,
        Z_OFFSET = 64,
        columns: number[] = [];
    for (let i = 0; i < WIDTH; i++) {
        let heights: number[] = [];
        if (i === 7 || i === 11 || i === 15) heights = [0];
        columns.push(heights.length, ...heights.map((z) => z + Z_OFFSET));
    }
    const WORLD = { solid: Uint8Array.from(columns), groups: new Uint8Array(0), water: new Uint8Array(WIDTH) };
    const LEVEL_DATA = {
        levels: [
            { n: 'L', p: [10, 0, 0], req: [] },
            { n: 'Q', p: [13, 0, 0], req: [] },
        ],
        teleporters: [],
        freezers: [{ pid: 1, p: [3, 0, 0], req: [] }],
        gold_rooms: [],
        map: { size: [WIDTH, 1], corner: [0, 0], layers: [{ key: 'ground', z: [-8, 8] }] },
        world: {
            grid: { corner: [0, 0], size: [WIDTH, 1], zoff: Z_OFFSET },
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
            lights: [],
            area_pins: [],
            guy: [0, 0],
        },
    };
    return { SCHEMA, PROG: LEVEL_DATA, WORLD, worldReady: Promise.resolve() };
});
vi.mock('../src/walk-data.ts', () => ({ STATIC_ROLES: null, FLOOR_HEIGHTS: null, walkReady: Promise.resolve() }));

const [L, Q] = [0, 1];
const ON = { en: true, disc: false },
    OFF = { en: false, disc: false };

// MINOR pad A at column `padColumn` and pad C at column 14 send the hero to pad B (column 9) in the pocket of level L;
// B sends him nowhere
function setPads(padColumn: number) {
    PROG.teleporters = [
        { pid: 11, p: [padColumn, 0, 0], l: 0, major: 0, en: 0, target: 12 },
        { pid: 12, p: [9, 0, 0], l: 0, major: 0, en: 0, target: 0 },
        { pid: 13, p: [14, 0, 0], l: 0, major: 0, en: 0, target: 12 },
    ];
}

function reach(states: TeleporterState[]) {
    const history: History = {
        version: 0,
        types: [],
        hero: [0, 0, 0],
        heroKey: -1,
        heroes: new Map(),
        heroAt: [],
        actions: [],
    };
    return reachability(history, NO_HISTORY, states, [true], [false, false]);
}

describe('pad ways into a pocket', () => {
    beforeEach(() => {
        PROG.gold_rooms = [];
    });

    test('an enabled MINOR pad in another pocket leads in through the gates of that pocket', () => {
        setPads(5);
        const { viaPads, level } = reach([ON, OFF, ON]);
        expect(level).toEqual([false, false]);
        // pad C, in the pocket of Q, lands in the pocket of L; Q's pocket takes no pad, so Q is a way in
        expect(viaPads.get(L)).toEqual({ gates: [0], levels: [Q], towers: [] });
    });

    test('a level the hero cannot walk on to from the landing gets no ways from it', () => {
        // pad C lands the hero in L's pocket, and nothing leads from there back to Q
        setPads(5);
        expect(reach([ON, OFF, ON]).viaPads.has(Q)).toBe(false);
    });

    test('a disabled pad leads nowhere', () => {
        setPads(5);
        expect(reach([OFF, OFF, OFF]).viaPads.has(L)).toBe(false);
    });

    test('a disabled Tower pad leads in through its Tower and the gates of its pocket', () => {
        setPads(5);
        PROG.gold_rooms = [{ tower: 0, pad: 0, endpoint: 1 }];
        expect(reach([OFF, OFF, OFF]).viaPads.get(L)).toEqual({ gates: [0], levels: [], towers: [0] });
    });

    test('a disabled Tower pad in the reached cells leads in through its Tower alone', () => {
        setPads(1);
        PROG.gold_rooms = [{ tower: 0, pad: 0, endpoint: 1 }];
        const { viaPads, level } = reach([OFF, OFF, OFF]);
        expect(level).toEqual([false, false]);
        expect(viaPads.get(L)).toEqual({ gates: [], levels: [], towers: [0] });
    });

    test('an enabled pad in the reached cells reaches the pocket', () => {
        setPads(1);
        const { viaPads, level } = reach([ON, OFF, OFF]);
        expect(level).toEqual([true, false]);
        expect(viaPads.has(L)).toBe(false);
    });
});
