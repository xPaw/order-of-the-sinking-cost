// The sidebar's save summary: how much is solved, where the hero is and the save's stats
// (viewer.md "The page (viewer)", "The spoiler model (viewer)")
import { PROG } from '../data.ts';
import { escapeHtml } from '../util.ts';
import { percent, progressBarHtml } from '../format.ts';
import { readPreference } from '../shared.ts';
import { areaName } from '../model/areas.ts';
import type { ProgressModel } from '../model/progress-model.ts';
import { CHEVRON, areaEmblemHtml, heroIcon } from '../map/icons.ts';
import type { DemoStatus, Status } from '../status-file.ts';
import { levelNameHtml } from '../panels/plan-chips.ts';

/** The solved levels out of the levels not under fog, as a percentage and a bar with the partially solved ones in it. */
export function solvedHtml(model: ProgressModel): string {
    const progress = model.progress;
    const notHidden = model.levels.length - progress.hidden.filter(Boolean).length;
    const partial = progress.state.filter(
        (levelState, levelIndex) => levelState === 'partial' && !progress.hidden[levelIndex],
    ).length;

    const solvedPercent = percent(progress.solved, notHidden);
    const bar = progressBarHtml(progress.solved, notHidden, partial);
    const label = `${solvedPercent} <span class="lb">solved</span>`;
    return `<div class="solved"><span class="pc" title="of levels not under fog">${label}</span>${bar}</div>`;
}

// Status gameplay counters by index (status +244..+280; index 3, +256, is never incremented)
const COUNTERS: Array<[index: number, label: string]> = [
    [0, 'Gems picked up'],
    [1, 'Gems placed'],
    [2, 'Artifacts picked up'],
    [4, 'Dragon follow toggles'],
    [5, 'Wand uses'],
    [6, 'Beam turns'],
    [7, 'Prism uses'],
    [8, 'Levels entered'],
    [9, 'Activate presses'],
];

export function statsHtml(model: ProgressModel): string {
    const open = readPreference('statsOpen') === '1';
    const counters = model.status.counters;

    // with spoilers hidden a zero counter is left out: its row would name a mechanic the player has not met
    const rowsHtml = COUNTERS.map(([index, label]) => {
        const value = counters?.[index];
        if (value == null || (model.hide && value <= 0)) return '';

        const count = value.toLocaleString('en-US');
        return `<div class="kr"><span>${escapeHtml(label)}</span><span class="v">${count}</span></div>`;
    }).join('');

    let openClass = '';
    let hidden = ' hidden';
    if (open) {
        openClass = ' open';
        hidden = '';
    }

    const rows = `<div class="srows" id="statsRows"${hidden}>${rowsHtml}</div>`;
    const title = 'Counters kept in the save';
    const attributes = `id="statsTog" aria-expanded="${open}" aria-controls="statsRows" title="${title}"`;
    const toggle = `<button class="plain stog" ${attributes}><span>Stats</span>${CHEVRON}</button>`;
    return `<div class="np sstats${openClass}" id="sideStats">${toggle}${rows}</div>`;
}

/** Always one line, so the sidebar keeps its geometry whatever the save is doing. */
/** The level whose pad the hero stands on on the overworld; -1 for none or one under fog. */
function heroPadLevel(model: ProgressModel): number {
    const hero = model.hero;
    if (!hero) return -1;

    return model.levels.findIndex((level, levelIndex) => {
        if (model.progress.hidden[levelIndex]) return false;
        const [x, y, z] = level.p;
        return x === Math.round(hero.x) && y === Math.round(hero.y) && z === Math.round(hero.z);
    });
}

export function inLevelHtml(status?: Status | DemoStatus | null, model?: ProgressModel | null): string {
    if (model?.inLevel != null) {
        const name = levelNameHtml(model.progress, model.inLevel);
        const attributes = 'id="inLevel" title="Show it on the map"';
        return `<button class="plain inlv" ${attributes}>${heroIcon}<span class="n">${name}</span></button>`;
    }

    if (model?.onOverworld) {
        let place = 'Overworld';
        let emblem = '';
        if (model.heroArea != null) {
            const heroArea = PROG.areas[model.heroArea];
            place = escapeHtml(areaName(heroArea));
            emblem = areaEmblemHtml(heroArea);
        }

        const padLevel = heroPadLevel(model);
        if (padLevel >= 0) place = levelNameHtml(model.progress, padLevel);

        const line = `${heroIcon}${emblem}<span class="n">${place}</span>`;
        if (!model.hero) return `<div class="inlv">${line}</div>`;

        const attributes = 'id="heroLine" title="Centre the map on the hero"';
        return `<button class="plain inlv" ${attributes}>${line}</button>`;
    }

    let levelName = '';
    if (model && !model.demo) levelName = status?.currentLevel || '';
    return `<div class="inlv muted">${escapeHtml(levelName)}</div>`;
}
