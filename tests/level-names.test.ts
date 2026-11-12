// With spoilers hidden, a level's name shows only for a solved or revealed level; elsewhere a plain word stands in
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { worldReady } from '../src/world-data.ts';
import { setProgressCache } from '../src/model/progress.ts';
import { levelNameText } from '../src/model/level-names.ts';
import { progressModel } from '../src/model/progress-model.ts';
import { levelChip, levelNameHtml } from '../src/panels/plan-chips.ts';
import { revealedOf, setSpoilersHidden } from '../src/shared.ts';
import { registerCampaign, syntheticCampaign } from './fixtures.ts';

// the page, without its DOM
vi.mock('../src/view.ts', () => ({ show() {}, async showSave() {} }));

const CAMPAIGN = 'Level names campaign';

beforeAll(async () => {
    await worldReady;
    setProgressCache(new WeakMap());
    registerCampaign(CAMPAIGN, syntheticCampaign({ rank: 1, groundShown: true }));
});

afterEach(() => {
    revealedOf(CAMPAIGN).clear();
    setSpoilersHidden(true);
});

describe('level names with spoilers hidden', () => {
    test('every level that is not solved has its name hidden', () => {
        setSpoilersHidden(true);
        const { progress } = progressModel(CAMPAIGN);
        expect(progress.nameHidden.length).toBe(progress.state.length);
        expect(progress.nameHidden.some(Boolean)).toBe(true);
        progress.state.forEach((levelState, levelIndex) => {
            expect(progress.nameHidden[levelIndex]).toBe(levelState !== 'solved');
        });
    });

    test('with spoilers shown no name is hidden', () => {
        setSpoilersHidden(false);
        const { progress } = progressModel(CAMPAIGN);
        expect(progress.nameHidden.some(Boolean)).toBe(false);
    });

    test('a hidden name is left out of its chip, heading and text, and a click reveals it', () => {
        setSpoilersHidden(true);
        const model = progressModel(CAMPAIGN);
        const levelIndex = model.progress.nameHidden.findIndex((nameHidden, index) => {
            return nameHidden && !model.progress.hidden[index];
        });
        expect(levelIndex).toBeGreaterThanOrEqual(0);

        const name = model.levels[levelIndex].n;
        const chip = levelChip(model.progress, levelIndex);
        expect(chip).toContain('spoiler');
        expect(chip).toContain(`data-goto="${levelIndex}"`);
        expect(chip).not.toContain(name);

        const heading = levelNameHtml(model.progress, levelIndex);
        expect(heading).toContain('spoiler');
        expect(heading).not.toContain(name);
        expect(levelNameText(model.progress.nameHidden, model.levels, levelIndex)).not.toContain(name);

        revealedOf(CAMPAIGN).add(levelIndex);
        const revealed = progressModel(CAMPAIGN);
        expect(revealed.progress.nameHidden[levelIndex]).toBe(false);
        const wrapped = name.replace(/_/g, '_<wbr>');
        expect(levelChip(revealed.progress, levelIndex)).toContain(wrapped);
        expect(levelChip(revealed.progress, levelIndex)).not.toContain('spoiler');
        expect(levelNameHtml(revealed.progress, levelIndex)).toContain(wrapped);
    });
});
