// A level's panel on the map: its state and role, area, the Freezer it is in, the path to unlock it, the gates in front
// of it and why it is not reachable, its tower, what it requires and unlocks (VIEWER.md "The page (viewer)")
import { escapeHtml } from '../util.ts';
import { areaEmblemHtml, towerEmblemHtml } from '../map/icons.ts';
import type { Role } from '../map/icons.ts';
import type { MapLink, MapSelection } from '../map/map-view.ts';
import type { SelectHow } from '../map/map-view.ts';
import { achievementName } from '../model/achievements.ts';
import { areaName } from '../model/areas.ts';
import { capitalized, freezerNoun, freezersNoun } from '../model/freezer-names.ts';
import { roleFor } from '../model/goal-roles.ts';
import { unlockPlan } from '../model/plans.ts';
import { stateLabel } from '../model/progress.ts';
import { towerLevelCount, towerName } from '../model/towers.ts';
import type { TowerProgress } from '../model/towers.ts';
import type { LevelUnlocks } from '../model/way-in.ts';
import type { Freezer, Position, ProgressLevel } from '../types.ts';
import { wikiTacticsUrl } from '../wikitactics.ts';
import type { PanelContext } from './context.ts';
import { markSelected, NEAR } from './list.ts';
import {
    chainOf,
    gateChip,
    gateMode,
    gatePlaceSuffix,
    layerNote,
    levelPadHtml,
    opensChips,
    panelHead,
    pathHtml,
    pick,
    pointsOf,
    roleChipHtml,
    stepsOf,
    uniqueLinks,
} from './plan-chips.ts';
import type { Chain } from './plan-chips.ts';
import { approxTip, wayIn, whyParts, whyText } from './why.ts';

/** The unlock plan section of a level's panel, and what the sections after it need from the plan. */
interface PlanSection {
    html: string;
    chain: Chain;
    /** The gates the plan's path names. */
    named: Set<number>;
}

/** The tower section of a level's panel: `tower` is null for a level in no tower, or one whose tower is under fog. */
interface TowerSection {
    html: string;
    towerIndex: number;
    tower: TowerProgress | null;
}

/** What the map's selection for a level is built from. */
interface LevelPanelParts {
    levelIndex: number;
    html: string;
    chain: Chain;
    /** The way-in gates the panel lists. */
    gates: Freezer[];
    /** The shown Freezers that this level helps open. */
    unlockedGates: number[];
    towerInfo: TowerSection;
}

function stateChipsHtml(context: PanelContext, levelIndex: number): string {
    const level = context.levels[levelIndex];
    const levelState = context.progress.state[levelIndex];
    let tip = '';
    if (levelState === 'blocked') tip = ` title="${approxTip(context)}"`;

    let role: Role | null = null;
    if (levelState !== 'solved') role = roleFor(context.goal, 'l', levelIndex);

    let achievement = '';
    if (level.a) achievement = `<span class="chip">${escapeHtml(achievementName(level.a))}</span>`;

    const stateText = stateLabel(context.progress, levelState);
    const stateChip = `<span class="chip"${tip}>${levelPadHtml(context.progress, levelIndex)}${stateText}</span>`;
    return `<div>${stateChip}${roleChipHtml(context, role)}${achievement}</div>`;
}

function whereHtml(context: PanelContext, levelIndex: number): string {
    const level = context.levels[levelIndex];
    const areaIndex = context.areaOf(levelIndex);
    if (areaIndex == null) return '';

    let near = '';
    if (level.areaNear) near = NEAR;
    const area = context.areas[areaIndex];
    return `<div class="muted">${near}${areaEmblemHtml(area)}${escapeHtml(areaName(area))}</div>`;
}

function freezerHtml(context: PanelContext, ice: number): string {
    const freezer = context.freezers[ice];
    const noun = freezerNoun(ice);
    const html = `<div class="h">In an ${noun}</div><div>${gateChip(context, ice)}</div>`;
    if (context.progress.gateOpen[ice]) return html + `<div class="muted">${capitalized(noun)} open</div>`;

    const mode = gateMode(freezer);
    let withMode = '';
    if (mode) withMode = ' ' + mode;
    return html + `<div class="hs">Opens with${withMode}</div><div>${opensChips(context, freezer)}</div>`;
}

// the unlock path, and the layer note under it; a gate the path names needs no second mention below
function planSection(context: PanelContext, levelIndex: number): PlanSection {
    const progress = context.progress;
    const level = context.levels[levelIndex];
    const blocked = progress.state[levelIndex] === 'blocked';

    let plan = null;
    if (progress.state[levelIndex] === 'locked' || blocked) plan = unlockPlan(progress, ['level', levelIndex]);

    const steps = plan && stepsOf(context, plan);
    const chain = chainOf(context, plan, steps);
    const html = pathHtml(context, plan, true, steps) + layerNote(context, chain, level.p[2]);
    context.chainPoints = chain.points;

    const named = new Set<number>();
    if (plan && steps) {
        plan.nodes.forEach((node, key) => {
            if (node.t === 'g' && steps.num.has(key)) named.add(node.id);
        });
    }

    return { html, chain, named };
}

// closed gates on the edge of the reached area that lead here; opening any one of them is enough
function behindGatesHtml(context: PanelContext, behind: number[], gateIds: number[]): string {
    if (!gateIds.length) return '';

    let noun = freezerNoun(gateIds[0]);
    if (gateIds.length > 1) noun = `${freezersNoun(gateIds)} (any one)`;

    let lead = 'Behind';
    if (behind.length > gateIds.length) lead = 'Or behind';
    const heading = `<div class="h">${lead} ${noun}</div>`;
    const gates = gateIds.map((freezerIndex) => {
        const freezer = context.freezers[freezerIndex];
        const mode = gateMode(freezer);
        let modeNote = '';
        if (mode) modeNote = ' <span class="muted">· ' + mode + '</span>';

        const label = capitalized(freezerNoun(freezerIndex));
        const place = gatePlaceSuffix(context, freezerIndex);
        const button = `<button class="plain lnk" data-pgate="${freezerIndex}">${label}${place}</button>`;
        return `<div>${button}${modeNote}</div><div>${opensChips(context, freezer)}</div>`;
    });

    return heading + gates.join('');
}

// why the walk calls the level unreachable; with a gate in front of it (or the Freezer it is frozen in holding it
// back) only the mechanics are named
function whyHtml(context: PanelContext, levelIndex: number, behind: number[], ice: number | undefined): string {
    const heldByGate = ice !== undefined && context.progress.behind[levelIndex].includes(ice);
    let text = whyText(context, levelIndex);
    if (behind.length || heldByGate) text = whyParts(context, levelIndex).mech;

    if (!text) return '';
    return `<div class="muted">${escapeHtml(text[0].toUpperCase() + text.slice(1))}</div>`;
}

// a tower level names its tower and how far along it is; the tower's own panel lists its levels
function towerHtml(context: PanelContext, levelIndex: number, towerIndex: number, tower: TowerProgress): string {
    const level = context.levels[levelIndex];
    const shownLevels = tower.normal.filter((towerLevel) => !context.progress.hidden[towerLevel]).length;
    let count = towerLevelCount(tower, shownLevels);
    if (tower.active) count = 'activated';

    let dropdownNote = '';
    if (level.d) dropdownNote = ' · dropdown';

    const name = towerEmblemHtml(tower) + escapeHtml(towerName(tower.t));
    const towerButton = `<button class="plain lnk" data-ptower="${towerIndex}">${name}</button>`;
    return `<div class="h">${towerButton}${dropdownNote} · ${count}</div>`;
}

// the other towers this level brings closer to done
function countsTowardHtml(context: PanelContext, levelIndex: number, towerIndex: number): string {
    const progress = context.progress;
    const counts = (progress.needed[levelIndex]?.towers || [])
        .filter(([tower]) => tower !== towerIndex && !progress.towerHidden[tower])
        .toSorted((first, second) => first[1] - second[1]);
    if (!counts.length) return '';

    const chips = counts.map(([tower, left]) => {
        const countedTower = progress.towers[tower];
        const name = towerEmblemHtml(countedTower) + escapeHtml(towerName(countedTower.t));
        const toGo = `<span class="muted"> · ${left} to go</span>`;
        return `<span class="chip" data-ptower="${tower}" tabindex="0" role="button">${name}${toGo}</span>`;
    });

    return `<div class="h">Counts toward</div><div>${chips.join('')}</div>`;
}

// the level's tower, then the other towers the level counts toward
function towerSection(context: PanelContext, levelIndex: number): TowerSection {
    const progress = context.progress;
    const towerIndex = context.towerOf(levelIndex);
    let tower: TowerProgress | null = null;
    if (towerIndex >= 0 && !progress.towerHidden[towerIndex]) tower = progress.towers[towerIndex];

    let html = '';
    if (tower) html += towerHtml(context, levelIndex, towerIndex, tower);

    html += countsTowardHtml(context, levelIndex, towerIndex);
    return { html, towerIndex, tower };
}

function requiresHtml(context: PanelContext, level: ProgressLevel): string {
    if (!level.req.length) return '';

    let anyOf = '';
    if (level.or && level.req.length > 1) anyOf = ' any of';
    return `<div class="h">Requires${anyOf}</div><div>${pick(context, level.req)}</div>`;
}

// the shown Freezers that list the level among their requirements
function gatesUnlockedBy(context: PanelContext, levelIndex: number): number[] {
    const unlockedGates: number[] = [];
    context.freezers.forEach((freezer, freezerIndex) => {
        if (freezer.req.includes(levelIndex) && context.gateShown(freezer)) unlockedGates.push(freezerIndex);
    });
    return unlockedGates;
}

function unlocksHtml(context: PanelContext, unlocks: LevelUnlocks, unlockedGates: number[]): string {
    if (!unlocks.levels.length && !unlockedGates.length) return '';

    const gateChips = unlockedGates.map((freezerIndex) => gateChip(context, freezerIndex)).join('');
    return `<div class="h">Unlocks</div><div>${pick(context, unlocks.levels)}${gateChips}</div>`;
}

function wikiTacticsHtml(level: ProgressLevel): string {
    const url = wikiTacticsUrl(level.n);
    if (!url) return '';
    return `<div class="extlink"><a href="${escapeHtml(url)}" target="_blank" rel="noopener">WikiTactics</a></div>`;
}

// the lines the map draws for the level: what it requires and unlocks, its tower, the gates around it and its chain
function levelLinks(context: PanelContext, parts: LevelPanelParts): MapLink[] {
    const { levelIndex, chain, gates, unlockedGates, towerInfo } = parts;
    const level = context.levels[levelIndex];
    const unlocks = context.progress.unlocks[levelIndex];

    const requirementLinks = level.req.map((requirement): MapLink => [requirement, levelIndex, 'req']);
    const unlockLinks = unlocks.levels.map((unlocked): MapLink => [levelIndex, unlocked, 'unl']);
    const towerLinks: MapLink[] = [];
    if (towerInfo.tower) towerLinks.push([levelIndex, towerInfo.tower.p, 'unl']);

    const gateUnlockLinks = unlockedGates.map((freezerIndex): MapLink => [
        levelIndex,
        context.freezers[freezerIndex].p,
        'unl',
    ]);

    const gateRequirementLinks = gates.flatMap((freezer): MapLink[] => [
        [freezer.p, levelIndex, 'req'],
        ...freezer.req.map((requirement): MapLink => [requirement, freezer.p, 'req']),
    ]);

    return uniqueLinks([
        ...requirementLinks,
        ...unlockLinks,
        ...towerLinks,
        ...gateUnlockLinks,
        ...gateRequirementLinks,
        ...chain.links,
    ]);
}

// what the map highlights for the level: its requirements, unlocks, tower, gates and chain
function levelSelection(context: PanelContext, parts: LevelPanelParts): MapSelection {
    const { levelIndex, html, chain, gates, unlockedGates, towerInfo } = parts;
    const level = context.levels[levelIndex];
    const unlocks = context.progress.unlocks[levelIndex];
    const { tower, towerIndex } = towerInfo;

    const gateLevels = gates.flatMap((freezer) => freezer.req);
    let selectedTower: number | undefined;
    if (tower) selectedTower = towerIndex;

    const towerPoints: Position[] = [];
    if (tower) towerPoints.push(tower.p);

    return {
        levels: new Set([
            levelIndex,
            ...level.req,
            ...unlocks.levels,
            ...gateLevels,
            ...chain.levels,
        ]),
        focus: levelIndex,
        frontier: chain.frontier,
        overlays: new Set([...chain.overlays, ...unlockedGates.map((freezerIndex) => 'g' + freezerIndex)]),
        tower: selectedTower,
        html,
        z: level.p[2],
        points: [
            level.p,
            ...pointsOf(context, [...level.req, ...unlocks.levels]),
            ...towerPoints,
            ...gates.map((freezer) => freezer.p),
            ...unlockedGates.map((freezerIndex) => context.freezers[freezerIndex].p),
            ...chain.points,
        ],
        links: levelLinks(context, parts),
        steps: chain.steps,
    };
}

/** Opens a level's panel and selects the level, what it requires and unlocks and its unlock chain on the map. */
export function showLevelPanel(context: PanelContext, levelIndex: number, how?: SelectHow): void {
    const progress = context.progress;
    context.remember(['level', levelIndex]);
    markSelected(context, levelIndex);

    const level = context.levels[levelIndex];
    const blocked = progress.state[levelIndex] === 'blocked';
    let html = panelHead(context, escapeHtml(level.n));
    html += stateChipsHtml(context, levelIndex);
    html += whereHtml(context, levelIndex);

    const ice = context.iceOf[levelIndex];
    if (ice !== undefined) html += freezerHtml(context, ice);

    const plan = planSection(context, levelIndex);
    html += plan.html;

    // a gate that opens only from inside the level's pocket is no way in, and one the Path above names needs no second
    // mention
    let behind: number[] = [];
    if (blocked) behind = wayIn(context, levelIndex).filter((freezerIndex) => freezerIndex !== ice);

    const gateIds = behind.filter((freezerIndex) => !plan.named.has(freezerIndex));
    const gates = gateIds.map((freezerIndex) => context.freezers[freezerIndex]);
    html += behindGatesHtml(context, behind, gateIds);
    if (blocked) html += whyHtml(context, levelIndex, behind, ice);

    const tower = towerSection(context, levelIndex);
    html += tower.html;
    html += requiresHtml(context, level);

    const unlockedGates = gatesUnlockedBy(context, levelIndex);
    html += unlocksHtml(context, progress.unlocks[levelIndex], unlockedGates);
    html += wikiTacticsHtml(level);

    const parts: LevelPanelParts = {
        levelIndex,
        html,
        chain: plan.chain,
        gates,
        unlockedGates,
        towerInfo: tower,
    };
    context.map?.select(levelSelection(context, parts), how);
}
