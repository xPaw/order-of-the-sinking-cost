// What the page calls a Freezer: a cage (model A) or a gate (model B, `doorway`), one or many
import { describe, expect, test, vi } from 'vitest';
import { capitalized, freezerNoun, freezersNoun, isDoorway, modelNoun } from '../src/model/freezer-names.ts';

// Freezers 0 and 1 are pods, 2 and 3 doorways
vi.mock('../src/world-data.ts', () => import('./world-data-mock.ts'));
vi.mock('../src/data.ts', () => {
    const data = { freezers: [{ req: [] }, { req: [] }, { req: [], doorway: 1 }, { req: [], doorway: 1 }] };
    return { SCHEMA: {}, PROG: data, WORLD: {}, worldReady: Promise.resolve() };
});

describe('Freezer names', () => {
    test('one Freezer by its model', () => {
        expect(isDoorway(0)).toBe(false);
        expect(isDoorway(2)).toBe(true);
        expect(freezerNoun(0)).toBe('cage');
        expect(freezerNoun(2)).toBe('gate');
    });

    test('a set of Freezers of one model', () => {
        expect(freezersNoun([0, 1])).toBe('cages');
        expect(freezersNoun([2, 3])).toBe('gates');
        expect(modelNoun(false)).toBe('cages');
        expect(modelNoun(true)).toBe('gates');
    });

    test('a set of Freezers of both models', () => {
        expect(freezersNoun([0, 2])).toBe('cages and gates');
        expect(freezersNoun([3, 1, 0])).toBe('cages and gates');
    });

    test('labels', () => {
        expect(capitalized(freezerNoun(0))).toBe('Cage');
        expect(capitalized(freezerNoun(3))).toBe('Gate');
        expect(capitalized(freezersNoun([1, 2]))).toBe('Cages and gates');
    });
});
