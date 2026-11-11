// The chips of the panels and the list (levels, Freezers, signs, towers, plan steps) and an unlock plan as panel text
// and as a chain on the map (viewer.md "The page (viewer)", "Unlock plans and next steps (viewer)",
// "The spoiler model (viewer)")
import { PROG } from '../data.ts';
import { countBy, escapeHtml } from '../util.ts';
import { areaEmblemHtml, iconHtml, roleDot, ROLES, towerEmblemHtml } from '../map/icons.ts';
import type { Role } from '../map/icons.ts';
import { levelIconName } from '../map/level-icons.ts';
import type { LevelIconName } from '../map/level-icons.ts';
import type { LinkEnd, MapLink, MapStep } from '../map/map-view.ts';
import { achievementName, rankAchievement } from '../model/achievements.ts';
import { areaName } from '../model/areas.ts';
import { capitalized, freezerNoun, isDoorway } from '../model/freezer-names.ts';
import { layerName, mapLayerOf, wayTo } from '../model/layers.ts';
import type { UnlockPlan } from '../model/plans.ts';
import { RANKS, stateLabel } from '../model/progress.ts';
import type { ShownProgress } from '../model/progress.ts';
import { SIGN_INDEX } from '../model/requirements.ts';
import type { PlanStep } from '../model/requirements.ts';
import { towerName, unnamedWayName } from '../model/towers.ts';
import { optionCount, signStateOf } from '../model/unlocking.ts';
import type { SignRule } from '../model/unlocking.ts';
import type { Freezer, FreezerSign, Position } from '../types.ts';
import type { PanelContext } from './context.ts';

/** What a plan shows as numbered steps: each step's number by key. */
export interface PlanSteps {
    num: Map<string, number>;
}

/**
 * A plan as the map draws it: the levels, the ones to solve first, the overlay ids, the points to frame, the lines,
 * the numbered steps and the steps per layer.
 */
export interface Chain {
    levels: Set<number>;
    frontier: Set<number>;
    overlays: Set<string>;
    points: Position[];
    links: MapLink[];
    steps: MapStep[];
    layers: Map<string, number>;
}

/** Level names may wrap after underscores. */
export const wrappable = (name: string): string => escapeHtml(name).replace(/_/g, '_<wbr>');

/** The entry pad icon of a level and whether it is dimmed. */
export interface LevelPad {
    icon: LevelIconName;
    /** Open but not reachable yet: dimmed. */
    blocked: boolean;
}

/**
 * The entry pad of a level by its state: locked, available (also a level that is open but not reachable yet, dimmed),
 * solved (the solved pad is dim by itself). A level entered but not solved has the available pad.
 */
export function levelPadOf(progress: Pick<ShownProgress, 'state'>, levelIndex: number): LevelPad {
    const level = PROG.levels[levelIndex];
    const levelState = progress.state[levelIndex];
    if (levelState === 'solved') return { icon: levelIconName(level, 'solved'), blocked: false };
    if (levelState === 'locked') return { icon: levelIconName(level, 'locked'), blocked: false };
    if (levelState === 'blocked') return { icon: levelIconName(level, 'available'), blocked: true };
    return { icon: levelIconName(level, 'available'), blocked: false };
}

/** A level's entry pad as an image in a chip, a row or a tooltip. */
export function levelPadHtml(progress: Pick<ShownProgress, 'state'>, levelIndex: number): string {
    const pad = levelPadOf(progress, levelIndex);
    let extraClass = '';
    if (pad.blocked) extraClass = 'dim';
    return iconHtml(pad.icon, extraClass);
}

// a fogged level's chip carries only its index; revealing it draws the chip again with the name
const FOG_CHIP = 'Level under fog';

export const FOG_TEXT = '<span class="muted">A level under fog</span>';

export function levelChip(
    progress: Pick<ShownProgress, 'hidden' | 'state' | 'reachKnown'>,
    levelIndex: number,
    attr = 'data-goto',
): string {
    const target = `${attr}="${levelIndex}" tabindex="0" role="button"`;
    if (progress.hidden[levelIndex]) {
        return `<span class="chip spoiler" ${target} title="Click to reveal">${FOG_CHIP}</span>`;
    }

    const levelState = progress.state[levelIndex];
    const title = escapeHtml(stateLabel(progress, levelState));
    const name = wrappable(PROG.levels[levelIndex].n);
    let className = 'chip';
    if (levelState === 'solved') className += ' done';
    if (levelState === 'unlocked' || levelState === 'visited' || levelState === 'partial') className += ' open';
    return `<span class="${className}" ${target} title="${title}">${levelPadHtml(progress, levelIndex)}${name}</span>`;
}

export function towerNameHtml(context: PanelContext, towerIndex: number): string {
    if (context.progress.towerHidden[towerIndex]) return '<span class="muted">A tower under fog</span>';
    const tower = context.progress.towers[towerIndex];
    return towerEmblemHtml(tower) + escapeHtml(towerName(tower.t));
}

/**
 * What a sign asks for: a rank, a tower activated or a count of gold rooms visited. A rank is named only while the
 * achievement that gives it is not hidden, since the name tells what that achievement gives.
 */
export function signNeed(context: PanelContext, sign: SignRule): string {
    if (sign.rank) {
        if (sign.rank === 255) return 'Any rank';

        const achievement = rankAchievement(sign.rank);
        if (achievement && context.model.achievementHidden(achievement)) return 'A higher rank';
        return `Rank ${escapeHtml(RANKS[sign.rank] ?? sign.rank)} or higher`;
    }

    if (sign.tower != null && context.progress.towers[sign.tower]) {
        return towerNameHtml(context, sign.tower) + ' activated';
    }

    if (sign.gold) return `${context.progress.goldFound} / ${sign.gold} Antipode teleporters visited`;
    return 'Sign';
}

/** What a sign asks for, marked when it is read and led by "Read the sign" when its rule holds but it is not read. */
export function signText(context: PanelContext, sign: FreezerSign): string {
    const need = signNeed(context, sign);
    const state = signStateOf(context.progress, sign);
    if (state === 'read') return '✓ ' + need;
    if (state === 'ready') return 'Read the sign · ' + need;
    return need;
}

/** How a Freezer with several options opens: with any of them or all of them. */
export function gateMode(freezer: Freezer): string {
    if (optionCount(freezer) <= 1) return '';
    if (freezer.or) return 'any of';
    return 'all of';
}

/** A panel's role chip: the role of the thing for the goal, named with the goal. */
export function roleChipHtml(context: PanelContext, role: Role | null): string {
    if (!role || !context.goal) return '';
    const roleName = escapeHtml(ROLES[role][0]);
    const goalLabel = escapeHtml(context.goal.label);
    return `<span class="chip">${roleDot(role)}${roleName} for ${goalLabel}</span>`;
}

export const pick = (context: PanelContext, levels: number[]): string =>
    levels.map((level) => levelChip(context.progress, level, 'data-pick')).join('');

/** A sign that opens gates while it is shown. */
export const signOn = (context: PanelContext, signIndex: number | null | undefined): boolean =>
    signIndex != null && context.model.signSet.has(signIndex);

/** Chips that open a panel: sign rules (when the sign is shown) and Freezers. */
export function signChip(context: PanelContext, sign: FreezerSign): string {
    const signIndex = SIGN_INDEX.get(sign.pid);
    let opens = false;
    if (signIndex !== undefined && signOn(context, signIndex)) opens = !context.signs[signIndex].status;

    let attributes = '';
    if (opens) attributes = ` data-psign="${signIndex}" tabindex="0" role="button"`;

    let tone = '';
    let text = signText(context, sign);
    const state = signStateOf(context.progress, sign);
    if (state === 'read') {
        // the good tone draws the check
        tone = ' good';
        text = signNeed(context, sign);
    }
    if (state === 'ready') tone = ' warn';
    if (state === 'unmet') tone = ' locked';
    return `<span class="chip${tone}"${attributes}>${text}</span>`;
}

/** What opens a Freezer: its levels and sign rules. */
export function opensChips(context: PanelContext, freezer: Freezer): string {
    const signChips = (freezer.signs || []).map((sign) => signChip(context, sign)).join('');
    return pick(context, freezer.req) + signChips;
}

/** In front of an area's name where the thing is outside every area box and named by the nearest area. */
export const NEAR = '<span class="muted" title="Outside every area box; grouped with the nearest area">≈ </span>';

/** The small tag that names a layer in front of a row's text. */
export const layerTagHtml = (layerKey: string): string => `<span class="lt">${escapeHtml(layerName(layerKey))}</span>`;

/** ` · place` after a Freezer's name where it has a place; empty for none. */
export function gatePlaceSuffix(context: PanelContext, freezerIndex: number): string {
    const placeName = context.model.gatePlace(freezerIndex);
    if (!placeName) return '';
    return ` · ${escapeHtml(placeName)}`;
}

/** A Freezer's icon: the gate for a doorway, else the cage. */
export function freezerIconHtml(freezerIndex: number): string {
    if (isDoorway(freezerIndex)) return iconHtml('ice-gate');
    return iconHtml('ice-cage');
}

/**
 * What tells a Freezer's chip apart from others in its area: the level it holds, else the closest level, while not under
 * fog; else its place.
 */
function gateChipPlace(context: PanelContext, freezerIndex: number): string {
    const heldLevel = context.iceLevel.get(freezerIndex);
    if (heldLevel !== undefined && !context.progress.hidden[heldLevel]) {
        return ` · ${wrappable(context.levels[heldLevel].n)}`;
    }

    const position = context.freezers[freezerIndex].p;
    const nearest = context.model.nearestShownLevel(position[0], position[1], mapLayerOf(position[2]));
    if (nearest >= 0) return ` · near ${wrappable(context.levels[nearest].n)}`;

    return gatePlaceSuffix(context, freezerIndex);
}

/** A Freezer's chip, named by the level it holds or is near; `byPlace` names it by its place (the level's own panel). */
export function gateChip(context: PanelContext, freezerIndex: number, byPlace = false): string {
    const open = context.progress.gateOpen[freezerIndex];
    const label = capitalized(freezerNoun(freezerIndex));
    let tone = '';
    let openNote = '';
    if (open) {
        tone = ' good';
        openNote = ' (open)';
    }

    const icon = freezerIconHtml(freezerIndex);
    let place = gatePlaceSuffix(context, freezerIndex);
    if (!byPlace) place = gateChipPlace(context, freezerIndex);

    const attributes = `data-pgate="${freezerIndex}" tabindex="0" role="button"`;
    return `<span class="chip${tone}" ${attributes}>${icon}${label}${openNote}${place}</span>`;
}

// a gold room (plan step 'p') shows where the totals show it: once visited, or with spoilers shown
const roomPad = (context: PanelContext, roomIndex: number) => context.teleporters[PROG.gold_rooms[roomIndex].endpoint];

const roomShown = (context: PanelContext, roomIndex: number): boolean =>
    context.model.rooms.includes(PROG.gold_rooms[roomIndex]);

// the plan steps with no chip of their own: a gold room, the way onto a layer, a rank marker
function otherStepText(context: PanelContext, node: PlanStep): string {
    if (node.t === 'p') {
        return `Antipode teleporter · ${towerName(context.progress.towers[PROG.gold_rooms[node.id].tower].t)}`;
    }

    if (node.t === 'a') return capitalized(wayTo(node.id));
    if (node.t === 'e') return achievementName(node.id);
    return '';
}

// a sky Way is named by its area while the area is shown, and links to the area on the map; else by its tower's Sign
function wayChip(context: PanelContext, areaIndex: number, towerIndex: number): string {
    if (!context.model.areaShown(areaIndex)) {
        const name = escapeHtml(unnamedWayName(context.progress.towers[towerIndex].t));
        return `<span class="chip">${name}</span>`;
    }

    const name = escapeHtml(areaName(PROG.areas[areaIndex]));
    return `<span class="chip" data-parea="${areaIndex}" tabindex="0" role="button">${name}</span>`;
}

function nodeChip(context: PanelContext, node: PlanStep): string {
    if (node.t === 'w') return wayChip(context, node.id, node.tower);
    if (node.t === 'l') return levelChip(context.progress, node.id, 'data-pick');
    if (node.t === 'g') return gateChip(context, node.id);
    if (node.t === 't') {
        const tower = context.progress.towers[node.id];
        const name = towerEmblemHtml(tower) + escapeHtml(towerName(tower.t));
        return `<span class="chip" data-ptower="${node.id}" tabindex="0" role="button">${name}</span>`;
    }

    if (node.t === 's') return signChip(context, node.g);
    return `<span class="chip">${escapeHtml(otherStepText(context, node))}</span>`;
}

/**
 * A panel's header: the Back button that returns to the list, a link to the previous panel while the panel history has
 * one, then the icon and title, and under the title the place it is in, if any.
 */
export function panelHead(context: PanelContext, icon: string, title: string, place = ''): string {
    let previous = '';
    if (context.back.length) {
        previous = '<button class="plain" data-back title="Previous panel">↶ Previous</button>';
    }

    const back = '<button class="plain" data-close title="Back to the list (Esc)">‹ Back</button>';
    let placeLine = '';
    if (place) placeLine = `<div class="pl">${place}</div>`;
    const heading = `<div class="hd">${icon}<div class="ht"><b tabindex="-1">${title}</b>${placeLine}</div></div>`;
    return `<div class="dtop">${back}${previous}</div>${heading}`;
}

/** An area's emblem and name, the place line of a panel; empty for none. */
export function areaPlaceHtml(context: PanelContext, areaIndex: number | null, near = ''): string {
    if (areaIndex == null) return '';
    const area = context.areas[areaIndex];
    return `${near}${areaEmblemHtml(area)}${escapeHtml(areaName(area))}`;
}

/** The positions of the levels not under fog. */
export const pointsOf = (context: PanelContext, levels: number[]): Position[] =>
    levels.filter((level) => !context.progress.hidden[level]).map((level) => context.levels[level].p);

const linkEndKey = (end: LinkEnd): string => {
    if (Array.isArray(end)) return end.join(',');
    return String(end);
};

/** The map's lines without repeats, the first of the same two ends kept: an end is a level index or a position. */
export function uniqueLinks(links: MapLink[]): MapLink[] {
    const seen = new Set<string>();
    return links.filter(([from, to]) => {
        const key = linkEndKey(from) + '>' + linkEndKey(to);
        if (seen.has(key)) return false;

        seen.add(key);
        return true;
    });
}

/**
 * A plan's steps as the player sees them: levels, gates and towers under fog are left out and the numbers close up;
 * a step's number is 1 + the highest number before it.
 */
export function stepsOf(context: PanelContext, plan: UnlockPlan): PlanSteps {
    const stepShown = context.model.stepShown;
    const before = new Map<string, string[]>();
    for (const key of plan.nodes.keys()) before.set(key, []);
    for (const [from, to] of plan.edges) before.get(to)?.push(from);

    const numbered = new Map<string, number>();
    const numberOf = (key: string, stack = new Set<string>()): number => {
        const known = numbered.get(key);
        if (known !== undefined) return known;
        if (stack.has(key)) return 0;

        stack.add(key);
        const earlierNumbers = (before.get(key) ?? []).map((earlier) => numberOf(earlier, stack));
        const highest = Math.max(0, ...earlierNumbers);
        stack.delete(key);

        let number = highest;
        const node = plan.nodes.get(key);
        if (key !== plan.rootKey && node && stepShown(node)) number = highest + 1;
        numbered.set(key, number);
        return number;
    };

    const numbers = new Map<string, number>();
    plan.nodes.forEach((node, key) => {
        if (key === plan.rootKey) return;

        if (stepShown(node)) numbers.set(key, numberOf(key));
    });

    return { num: numbers };
}

/** The unlock chain as panel text: what to solve first, then the steps in order. */
export function pathHtml(
    context: PanelContext,
    plan: UnlockPlan | null,
    always: boolean,
    steps: PlanSteps | null,
): string {
    if (!plan || !steps || plan.steps < 1) return '';

    const numbers = steps.num;
    const rows: PlanStep[][] = [];
    plan.nodes.forEach((node, key) => {
        const stepNumber = numbers.get(key);
        if (stepNumber === undefined) return;

        let row = rows[stepNumber - 1];
        if (!row) {
            row = [];
            rows[stepNumber - 1] = row;
        }
        row.push(node);
    });

    if (!rows.length || (!always && rows.length < 2)) return '';

    // a step's number, then its chips under an optional caption
    const line = (nodes: PlanStep[], stepNumber: number, label = ''): string => {
        if (!nodes.length) return '';

        let caption = '';
        if (label) caption = `<div class="pcap">${label}</div>`;
        const chips = nodes.map((node) => nodeChip(context, node)).join('');
        return `<li class="pth"><b class="stp">${stepNumber}</b><div>${caption}${chips}</div></li>`;
    };

    // a level or gate that opens with any one of several options shows the cheapest only
    const alternatives = [...plan.nodes]
        .filter(([key, node]) => numbers.has(key) && node.alt !== undefined && node.alt > 1)
        .map(([, node]) => {
            const note = `<span class="muted">1 of ${node.alt} options for</span>`;
            return `<div class="palt">${note} ${nodeChip(context, node)}</div>`;
        })
        .join('');

    const first = rows[0];
    const solveFirst = first.filter((node) => node.front);
    const notReachable = first.filter((node) => node.t === 'l' && !node.front);
    const needs = first.filter((node) => node.t !== 'l');

    let html = '<div class="h">Path</div><ol class="steps">';
    html += line(solveFirst, 1);
    html += line(notReachable, 1, 'Not reachable yet');
    html += line(needs, 1);
    html += rows
        .slice(1)
        .map((row, index) => line(row, index + 2))
        .join('');
    html += '</ol>' + alternatives;
    return html;
}

/** Steps on a layer other than the selection's get no marker: a row switches to them. */
export function layerNote(context: PanelContext, chain: Chain, z: number): string {
    const map = context.map;
    if (!map) return '';

    return [...chain.layers]
        .filter(([key]) => key !== mapLayerOf(z) && map.layers.includes(key))
        .map(([key, count]) => {
            let plural = '';
            if (count > 1) plural = 's';

            const name = escapeHtml(layerName(key));
            const label = `${count} step${plural} on ${name}`;
            return `<div class="muted"><button class="plain lnk" data-clayer="${key}">${label}</button></div>`;
        })
        .join('');
}

// where a plan step that is not a level sits on the map; null when it is not shown
function stepPosition(context: PanelContext, node: PlanStep): Position | null {
    if (node.t === 'g') {
        const freezer = context.freezers[node.id];
        if (!context.gateShown(freezer)) return null;
        return freezer.p;
    }

    if (node.t === 's') {
        const signIndex = node.id;
        if (signIndex === undefined || !signOn(context, signIndex)) return null;
        return context.signs[signIndex].p;
    }

    if (node.t === 'p') {
        if (!roomShown(context, node.id)) return null;
        return roomPad(context, node.id).p;
    }

    if (node.t === 'w') {
        if (!context.model.areaShown(node.id)) return null;
        return PROG.areas[node.id].p;
    }

    if (node.t !== 't') return null;
    if (context.progress.towerHidden[node.id]) return null;
    return context.progress.towers[node.id].p;
}

// where a plan step sits on the map: a level by its index, the rest by position; null when it is not shown
function stepEnd(context: PanelContext, node: PlanStep): LinkEnd | null {
    if (node.t === 'l') return node.id;
    return stepPosition(context, node);
}

// the height of a plan step, for the layer it is on
function stepZ(context: PanelContext, node: PlanStep): number | null {
    if (node.t === 'l') return context.levels[node.id].p[2];
    if (node.t === 'g') return context.freezers[node.id].p[2];
    if (node.t === 't') return context.progress.towers[node.id].p[2];
    if (node.t === 'p') return roomPad(context, node.id).p[2];
    if (node.t === 'w') return PROG.areas[node.id].p[2];
    if (node.t === 's' && node.id != null) return context.signs[node.id].p[2];
    return null;
}

/**
 * The chain on the map: its levels, the ones to solve first, its gates and signs, lines along its edges, points to
 * frame.
 */
export function chainOf(context: PanelContext, plan: UnlockPlan | null, steps: PlanSteps | null): Chain {
    const chain: Chain = {
        levels: new Set(),
        frontier: new Set(),
        overlays: new Set(),
        points: [],
        links: [],
        steps: [],
        layers: new Map(),
    };

    if (!plan || !steps) return chain;

    const endOf = (key: string): LinkEnd | null => {
        const node = plan.nodes.get(key);
        if (!node) return null;
        return stepEnd(context, node);
    };

    plan.nodes.forEach((node) => {
        if (node.t === 'l') {
            chain.levels.add(node.id);
            if (node.front) chain.frontier.add(node.id);
        } else if (node.t === 'g' && context.gateShown(context.freezers[node.id])) {
            chain.overlays.add('g' + node.id);
        } else if (node.t === 's' && signOn(context, node.id)) {
            chain.overlays.add('s' + node.id);
        }
    });

    plan.nodes.forEach((node) => {
        if (node.t === 'l') {
            if (!context.progress.hidden[node.id]) chain.points.push(context.levels[node.id].p);
            return;
        }

        const position = stepPosition(context, node);
        if (position) chain.points.push(position);
    });

    plan.edges.forEach(([from, to]) => {
        const fromEnd = endOf(from);
        const toEnd = endOf(to);
        if (fromEnd != null && toEnd != null) chain.links.push([fromEnd, toEnd, 'req']);
    });

    // the number is the step, 1 being solved first; the panel lists the same numbers
    const numbers = steps.num;
    const heights: number[] = [];
    plan.nodes.forEach((node, key) => {
        const stepNumber = numbers.get(key);
        if (stepNumber === undefined) return;

        const position = endOf(key);
        const z = stepZ(context, node);
        if (position != null) chain.steps.push([position, stepNumber]);
        if (z != null) heights.push(z);
    });

    chain.layers = countBy(heights, mapLayerOf);
    return chain;
}
