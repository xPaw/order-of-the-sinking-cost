// The Credits entry of Find on the map: the intro level's voice logs, heard by the intro history, and its levels as
// chains, found by the status's level table; with spoilers hidden a find is listed once found or once the ending that
// gates it is earned
import { describe, expect, test } from 'vitest';
import { PROG, SCHEMA } from '../src/data.ts';
import { creditsOf, HIDDEN_CREDITS_LEVEL } from '../src/model/credits.ts';
import type { LatestValues } from '../src/save.ts';
import { NONE } from './fixtures.ts';

const PLAYED = Uint8Array.of(1);

const logs = PROG.credits.logs;
const chains = PROG.credits.chains;
const counted = chains.flat().filter((level) => !level.o);
const uncountedNames = chains
    .flat()
    .filter((level) => level.o)
    .map((level) => level.n);

const lowChain = chains.find(
    (chain) => chain.filter((level) => !level.o).length > 1 && chain.some((level) => level.o),
)!;
const [solvedLevel, enteredLevel] = lowChain.filter((level) => !level.o).map((level) => level.n);
const alwaysLog = logs.find((log) => log.e === undefined)!;
const lowLog = logs.find((log) => log.e === 'ENDGAME3')!;
const heardPids = [alwaysLog.pid, lowLog.pid];

function achievementsOf(names: string[]): bigint {
    let bits = 0n;
    for (const name of names) {
        const bit = SCHEMA.enums.Achievement?.values.find(([valueName]) => valueName === name)?.[1] ?? 0;
        bits |= 1n << BigInt(bit);
    }
    return bits;
}

const levels = [
    { name: solvedLevel, flags: 1 },
    { name: lowChain.find((level) => level.o)!.n, flags: 1 },
    { name: enteredLevel, flags: 0 },
];

const intro: LatestValues = {
    ...NONE,
    get: (pid, field) => {
        if (field === 'played' && heardPids.includes(pid)) return PLAYED;
        return undefined;
    },
};

const allEndings = achievementsOf(['ENDGAME1', 'ENDGAME2', 'ENDGAME3']);

function labelsOf(view: ReturnType<typeof creditsOf>): string[] {
    return view.chains.flatMap((chain) => chain.steps.map((step) => step.label));
}

describe('the Credits list', () => {
    test('counts only levels that no overworld Level_Entry has', () => {
        const overworld = new Set(PROG.levels.map((level) => level.n));
        expect(counted.some((level) => overworld.has(level.n))).toBe(false);
        expect(uncountedNames.every((name) => overworld.has(name))).toBe(true);
    });

    test('with spoilers shown lists everything with done / total', () => {
        const credits = creditsOf({ levels, achievements: 0n }, intro, false);
        expect(credits.heard.length).toBe(logs.length);
        expect(credits.chains.length).toBe(chains.length);
        expect(credits.total).toBe(logs.length + counted.length);

        const solved = levels.filter((level) => level.flags === 1 && !uncountedNames.includes(level.name));
        expect(credits.done).toBe(heardPids.length + solved.length);
        expect(credits.heard.filter(Boolean).length).toBe(heardPids.length);
    });

    test('a chain lists its steps in unlock order with their states', () => {
        const credits = creditsOf({ levels, achievements: 0n }, intro, false);
        const index = chains.indexOf(lowChain);
        const steps = credits.chains[index].steps;
        expect(steps.map((step) => step.label)).toEqual(lowChain.map((level) => level.n));
        expect(steps[0].status).toBe('solved');
        expect(steps.at(-1)?.status).toBe('solved');
        expect(steps[1].status).toBe('entered');
        expect(credits.chains[index].done).toBe(false);
    });

    test('a save without an intro history has no voice log heard', () => {
        const credits = creditsOf({ levels, achievements: 0n }, null, false);
        expect(credits.heard.filter(Boolean).length).toBe(0);
    });

    test('with spoilers hidden a find opens with the ending that gates it', () => {
        const noEnding = creditsOf({ levels: [], achievements: 0n }, null, true);
        const open = logs.filter((log) => log.e === undefined).length;
        expect(noEnding.heard.length).toBe(open);
        expect(noEnding.chains).toEqual([]);
        expect(noEnding.total).toBe(open);

        const high = creditsOf({ levels: [], achievements: achievementsOf(['ENDGAME2']) }, null, true);
        const highLevels = counted.filter((level) => level.e === 'ENDGAME2').length;
        const highLogs = logs.filter((log) => log.e === undefined || log.e === 'ENDGAME2').length;
        expect(high.heard.length).toBe(highLogs);
        expect(high.total).toBe(highLogs + highLevels);

        const low = creditsOf({ levels: [], achievements: allEndings }, null, true);
        expect(low.heard.length).toBe(logs.length);
        expect(low.chains.length).toBe(chains.length);
        expect(low.total).toBe(logs.length + counted.length);
    });

    test('with spoilers hidden an unfound level of the low ending is listed only once that ending is earned', () => {
        const before = creditsOf({ levels: [], achievements: achievementsOf(['ENDGAME2']) }, null, true);
        const after = creditsOf({ levels: [], achievements: allEndings }, null, true);
        const highChains = chains.filter((chain) => chain.some((level) => level.e === 'ENDGAME2'));
        expect(before.chains.length).toBe(highChains.length);
        expect(after.chains.length).toBe(chains.length);
    });

    test('with spoilers hidden a found find is listed without its ending and an unsolved level goes unnamed', () => {
        const credits = creditsOf({ levels, achievements: 0n }, intro, true);
        expect(credits.heard.filter(Boolean).length).toBe(heardPids.length);
        expect(credits.done).toBe(heardPids.length + 1);

        const labels = labelsOf(credits);
        expect(labels).toContain(solvedLevel);
        expect(labels).not.toContain(enteredLevel);
        expect(labels).toContain(HIDDEN_CREDITS_LEVEL);
    });
});
