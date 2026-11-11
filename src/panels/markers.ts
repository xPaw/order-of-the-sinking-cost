// What the map draws for the progress view: the level markers by state or role, the towers, the area labels and the
// overlays (Freezers, signs, pads, gold rooms, voice logs, map scrolls, Area_Pins, treasures)
// (viewer.md "The page (viewer)", "The spoiler model (viewer)")
import { PROG } from '../data.ts';
import { escapeHtml } from '../util.ts';
import { ROLES, towerEmblemHtml } from '../map/icons.ts';
import type { IconName, Role } from '../map/icons.ts';
import type { OverlayKind } from '../map/map-html.ts';
import type { MapFreezer, MapLabel, MapMarker, MapOverlay, MapTower, MarkerStyle } from '../map/map-view.ts';
import type { PanelKey } from '../shared.ts';
import { achievementName } from '../model/achievements.ts';
import { areaName } from '../model/areas.ts';
import type { FindKind } from '../model/find-kinds.ts';
import { capitalized, freezerNoun, isDoorway } from '../model/freezer-names.ts';
import { roleFor } from '../model/goal-roles.ts';
import { FOG_LAYER_KEYS, layerName, mapLayerOf } from '../model/layers.ts';
import { stateLabel } from '../model/progress.ts';
import { towerName } from '../model/towers.ts';
import { signStateOf } from '../model/unlocking.ts';
import type { LevelState } from '../model/unlocking.ts';
import type { Area, AreaPinRow, GoldRoom, TreasureDisplay, ViewGiver, VoiceLog } from '../types.ts';
import type { PanelContext } from './context.ts';
import { FOG_TEXT, gateMode, levelPadHtml, levelPadOf, signNeed, signText, towerNameHtml } from './plan-chips.ts';

// Which overlay markers the map draws: what is left to do for the goal. Freezers that are open or that the goal does
// not need, signs satisfied, and teleporters, gold rooms, logs, map scrolls and treasures found are left out, unless
// the Solved or All toggle asks for what is done. Under Completionist every closed Freezer is drawn, whether or not it is needed.
export function markerShown(overlay: MapOverlay, solvedShown: boolean, completionist: boolean): boolean {
    if (solvedShown) return true;
    if (overlay.done) return false;

    const isFreezer = overlay.kind === 'pods' || overlay.kind === 'doorways';
    if (completionist && isFreezer) return true;
    return overlay.req !== false;
}

// the order markers are drawn in: solved, then locked and blocked ones and those outside the goal, then playable ones,
// then playable ones on the goal's cheapest plans, then the level the save is in
function drawRank(levelState: LevelState, inGoal: boolean, onPlan: boolean | undefined, current: boolean): number {
    if (current) return 4;
    if (levelState === 'solved') return 0;
    if (levelState === 'locked' || levelState === 'blocked' || !inGoal) return 1;
    if (onPlan) return 3;
    return 2;
}

// what a level's role for the goal says in its tooltip
function roleTip(context: PanelContext, levelIndex: number): string {
    const role = context.entries.get(levelIndex)?.role;
    if (!role) return '';
    return ` · ${ROLES[role][0]}`;
}

// a level marker per level; a fogged tower stays unnamed on the levels it owns
export function levelMarkers(context: PanelContext): MapMarker[] {
    const progress = context.progress;
    return context.levels.map((level, levelIndex): MapMarker => {
        let tower = '';
        if (context.towerShown(levelIndex)) {
            let dropdown = '';
            if (level.d) dropdown = ' · dropdown';
            tower = `<br>${escapeHtml(towerName(level.t ?? 0))}${dropdown}`;
        }

        const freezerIndex = context.iceOf[levelIndex];
        let ice: MapFreezer | undefined;
        if (freezerIndex !== undefined) {
            ice = { id: 'g' + freezerIndex, doorway: isDoorway(freezerIndex), open: progress.gateOpen[freezerIndex] };
        }

        return {
            levelIndex,
            x: level.p[0],
            y: level.p[1],
            z: level.p[2],
            ice,
            get tip() {
                let achievement = '';
                if (level.a) achievement = `<br>${escapeHtml(achievementName(level.a))}`;

                let gate = '';
                if (freezerIndex !== undefined) {
                    let openness = 'Closed';
                    if (progress.gateOpen[freezerIndex]) openness = 'Open';
                    gate = `<br>In a ${freezerNoun(freezerIndex)} · ${openness}`;
                }

                const name = escapeHtml(level.n);
                const state = stateLabel(progress, progress.state[levelIndex]);
                const role = roleTip(context, levelIndex);
                return `<b>${name}</b><br>${state}${role}${tower}${achievement}${gate}`;
            },
        };
    });
}

export function towerMarkers(context: PanelContext): MapTower[] {
    const progress = context.progress;
    return progress.towers
        .map((tower, towerIndex): MapTower => {
            let activated = '';
            if (tower.active) activated = ' · activated';

            // a tower with a pad of its own is drawn on the pad
            let position = tower.p;
            let padLine = '';
            if (tower.pad !== undefined) {
                position = context.teleporters[tower.pad].p;
                padLine = '<br>Teleporter · not discovered';
                if (context.model.padDisc(tower.pad)) padLine = '<br>Teleporter · discovered';
            }

            const name = towerEmblemHtml(tower) + escapeHtml(towerName(tower.t));
            return {
                towerIndex,
                x: position[0],
                y: position[1],
                z: position[2],
                activated: tower.active,
                onPad: tower.pad !== undefined,
                padFound: tower.pad !== undefined && context.model.padDisc(tower.pad),
                tip: `<b>${name}</b><br>${tower.solvedNormal} / ${tower.req} solved${activated}${padLine}`,
            };
        })
        .filter((tower) => !progress.towerHidden[tower.towerIndex]);
}

/** An area with the number of levels that name it. */
interface SizedArea {
    area: Area;
    levelCount: number;
    areaIndex: number;
}

// the names of the areas shown; bigger areas first, so they keep their label when labels crowd
export function areaLabels(context: PanelContext): MapLabel[] {
    const model = context.model;
    const sizes = context.areas.map(() => 0);
    model.levelArea.forEach((area) => {
        if (area != null) sizes[area]++;
    });

    return context.areas
        .map((area, areaIndex): SizedArea => ({ area, levelCount: sizes[areaIndex], areaIndex }))
        .filter(
            ({ area, areaIndex }) =>
                area.p && model.areaShown(areaIndex) && model.shownAt(mapLayerOf(area.p[2]), area.p),
        )
        .toSorted((first, second) => second.levelCount - first.levelCount)
        .map(({ area }): MapLabel => ({ x: area.p[0], y: area.p[1], z: area.p[2], text: areaName(area) }));
}

// how a level marker is drawn: hidden when the filter leaves it out, its pad icon, the role badge of a level in the
// goal that is not solved yet, and its rank
export function markerStyle(context: PanelContext, marker: MapMarker): MarkerStyle {
    const levelIndex = marker.levelIndex;
    const progress = context.progress;
    const levelState = progress.state[levelIndex];
    const current = levelIndex === context.model.inLevel;
    const entry = context.entries.get(levelIndex);
    const rank = drawRank(levelState, !!entry?.role, entry?.onPlan, current);
    const pad = levelPadOf(progress, levelIndex);

    let role: Role | null = null;
    if (entry?.role && levelState !== 'solved') role = entry.role;

    return {
        hidden: !context.match(levelIndex),
        gone: progress.hidden[levelIndex],
        pad: pad.icon,
        blocked: pad.blocked,
        role,
        big: context.towerShown(levelIndex),
        current,
        rank,
    };
}

function levelNameHtml(context: PanelContext, levelIndex: number): string {
    if (context.progress.hidden[levelIndex]) return FOG_TEXT;
    return levelPadHtml(context.progress, levelIndex) + escapeHtml(context.levels[levelIndex].n);
}

// overlays: Freezers, signs, MAJOR world pads, warp pads, gold rooms at their hub endpoints, voice logs, map scrolls, Area_Pins,
// treasure plinths; none under fog while it hides things
function gateOverlay(context: PanelContext, freezerIndex: number): MapOverlay {
    const progress = context.progress;
    const freezer = context.freezers[freezerIndex];
    const isOpen = progress.gateOpen[freezerIndex];

    // levels behind the gate that fog hides are left out of the count, not out of Next steps
    const leads = progress.leads[freezerIndex].filter((level) => !progress.hidden[level]).length;

    const mode = gateMode(freezer);
    const options = [
        ...freezer.req.map((level) => levelNameHtml(context, level)),
        ...(freezer.signs || []).map((sign) => signText(context, sign)),
    ];
    let withMode = '';
    if (mode) withMode = ' ' + mode;
    const needs = `Opens with${withMode}<br>${options.join('<br>')}`;

    const area = context.gateArea(freezerIndex);
    let inArea = '';
    if (area != null) inArea = ` · ${escapeHtml(area)}`;

    let tip = `<b>${capitalized(freezerNoun(freezerIndex))}</b>${inArea}<br>`;
    if (isOpen) {
        tip += 'Open';
    } else {
        tip += `Closed<hr>${needs}`;
        if (leads) {
            let plural = '';
            if (leads > 1) plural = 's';
            tip += `<hr><span class="muted">Leads to ${leads} level${plural} not reached (approx.)</span>`;
        }
    }

    let kind: OverlayKind = 'pods';
    let icon: IconName = 'ice-cage';
    let holds = freezer.holds;
    if (isDoorway(freezerIndex)) {
        kind = 'doorways';
        icon = 'ice-gate';
        holds = undefined;
    }

    return {
        id: 'g' + freezerIndex,
        panel: ['gate', freezerIndex],
        merge: context.iceLevel.get(freezerIndex),
        kind,
        findKind: kind,
        state: isOpen ? 'Open' : 'Closed',
        done: isOpen,
        req: roleFor(context.goal, 'g', freezerIndex) !== 'optional',
        layer: FOG_LAYER_KEYS[freezer.l],
        x: freezer.p[0],
        y: freezer.p[1],
        position: freezer.p,
        icon,
        holds,
        tip,
    };
}

// signs that open gates open their panel; a tower status sign opens its tower's
function signOverlay(context: PanelContext, signIndex: number): MapOverlay {
    const sign = context.signs[signIndex];
    // a tower status sign is never read: it counts as done once its tower is active
    let signState = signStateOf(context.progress, sign);
    if (sign.status && signState === 'ready') signState = 'read';

    let panel: PanelKey = ['sign', signIndex];
    let findKind: FindKind | null = 'signs';
    let status = 'Not yet';
    if (signState === 'read') status = 'Satisfied';
    if (signState === 'ready') status = 'Ready to read';
    let tip = `<b>Sign</b><br>${signNeed(context, sign)}<br>${status}`;
    if (sign.status && sign.tower !== undefined) {
        const tower = context.progress.towers[sign.tower];
        let activated = '';
        if (tower.active) activated = ' · activated';
        const towerHtml = towerNameHtml(context, sign.tower);
        tip = `<b>Tower sign</b><br>${towerHtml}<br>${tower.solvedNormal} / ${tower.req} solved${activated}`;
        panel = ['tower', sign.tower];

        // a tower status sign is not among the signs that open Freezers, which the Signs row counts
        findKind = null;
    }

    let accent: MapOverlay['accent'];
    if (signState === 'ready') accent = 'ready';
    return {
        id: 's' + signIndex,
        panel,
        kind: 'signs',
        findKind,
        state: status,
        done: signState === 'read',
        layer: FOG_LAYER_KEYS[sign.l],
        x: sign.p[0],
        y: sign.p[1],
        position: sign.p,
        icon: 'sign',
        accent,
        tip,
    };
}

// world pads only, their twins sitting in the map rooms: a Teleporter, or a MINOR pad that hops across the map
function padOverlay(
    context: PanelContext,
    teleporterIndex: number,
    kind: 'tps' | 'minorPads',
    discovered: boolean,
): MapOverlay {
    const pad = context.teleporters[teleporterIndex];
    let status = 'Not discovered';
    if (discovered) status = 'Discovered';

    let disabled = ' · disabled';
    if (context.progress.tst[teleporterIndex].en) disabled = '';

    let id = 'p' + teleporterIndex;
    let icon: IconName = 'teleporter';
    let title = 'Teleporter';
    if (kind === 'minorPads') {
        id = 'q' + teleporterIndex;
        icon = 'pad';
        title = 'Warp pad';
    }

    return {
        id,
        kind,
        findKind: kind,
        state: status,
        layer: FOG_LAYER_KEYS[pad.l],
        x: pad.p[0],
        y: pad.p[1],
        position: pad.p,
        done: discovered,
        icon,
        dimUntilDone: true,
        tip: `<b>${title}</b><br>${status}${disabled}`,
    };
}

// a gold room is visited once its endpoint is discovered, and open once its tower is activated
function goldRoomLabel(context: PanelContext, room: GoldRoom): string {
    const states = context.progress.tst;
    if (states[room.endpoint].disc) return 'Visited';

    const tower = context.progress.towers[room.tower];
    if (tower?.active || states[room.pad]?.en || states[room.endpoint].en) return 'Open, not visited';
    return 'Locked';
}

function goldRoomOverlay(context: PanelContext, room: GoldRoom): MapOverlay {
    const progress = context.progress;
    const endpoint = context.teleporters[room.endpoint];
    const tower = progress.towers[room.tower];
    const label = goldRoomLabel(context, room);
    const visited = progress.tst[room.endpoint].disc;
    let accent: MapOverlay['accent'];
    if (visited) accent = 'gold';
    let panel: PanelKey | undefined;
    if (tower && !progress.towerHidden[room.tower]) panel = ['tower', room.tower];

    let towerLine = '';
    if (tower) {
        let activated = '';
        if (tower.active) activated = ' · activated';
        towerLine = `<br>${towerNameHtml(context, room.tower)}${activated}`;
    }

    let place = 'Antipode';
    if (tower) place = towerName(tower.t);

    return {
        id: 'r' + room.endpoint,
        kind: 'gold',
        findKind: 'towerPads',
        place,
        state: label,
        layer: FOG_LAYER_KEYS[endpoint.l],
        x: endpoint.p[0],
        y: endpoint.p[1],
        position: endpoint.p,
        done: visited,
        icon: 'gold-room',
        accent,
        panel,
        tip: `<b>Antipode teleporter</b><br>${label}${towerLine}`,
    };
}

function voiceLogOverlay(context: PanelContext, log: VoiceLog): MapOverlay {
    const heard = context.model.heard(log);
    let status = 'Not heard';
    if (heard) status = 'Heard';

    return {
        id: 'l' + log.pid,
        kind: 'logs',
        findKind: 'logs',
        state: status,
        layer: FOG_LAYER_KEYS[log.l],
        x: log.p[0],
        y: log.p[1],
        position: log.p,
        done: heard,
        icon: 'voice-log',
        tip: `<b>Voice log</b><br>${status}`,
    };
}

function mapScrollOverlay(context: PanelContext, giver: ViewGiver): MapOverlay {
    const taken = context.model.taken(giver);
    let status = 'Not taken';
    if (taken) status = 'Taken';

    return {
        id: 'm' + giver.pid,
        kind: 'maps',
        findKind: 'maps',
        state: status,
        layer: FOG_LAYER_KEYS[giver.l],
        x: giver.p[0],
        y: giver.p[1],
        position: giver.p,
        done: taken,
        icon: 'map-scroll',
        tip: `<b>Map scroll</b><br>${escapeHtml(layerName(FOG_LAYER_KEYS[giver.l]))} · ${status}`,
    };
}

// an Area_Pin is named by its area once activated, the game naming an area only then
function areaPinOverlay(context: PanelContext, [pid, x, y, z]: AreaPinRow): MapOverlay {
    const activated = context.model.pinOn(pid);
    let status = 'Not activated';
    if (activated) status = 'Activated';

    let place: string | undefined;
    const areaIndex = context.areas.findIndex((area) => area.pin === pid);
    if (areaIndex >= 0 && context.model.areaShown(areaIndex)) place = areaName(context.areas[areaIndex]);

    let placeLine = '';
    if (place) placeLine = `${escapeHtml(place)} · `;

    return {
        id: 'a' + pid,
        kind: 'pins',
        findKind: 'pins',
        place,
        state: status,
        layer: mapLayerOf(z),
        x,
        y,
        position: [x, y, z],
        done: activated,
        icon: 'area-pin',
        tip: `<b>Area pin</b><br>${placeLine}${status}`,
    };
}

function treasureOverlay(context: PanelContext, plinth: TreasureDisplay, acquired: number): MapOverlay {
    const got = acquired > plinth.i;
    let status = 'Empty';
    let icon: IconName = 'treasure';
    if (got) {
        status = 'Acquired';
        icon = 'treasure-taken';
    }

    return {
        id: 't' + plinth.i,
        kind: 'treasures',
        findKind: 'treasures',
        state: status,
        layer: mapLayerOf(plinth.p[2]),
        x: plinth.p[0],
        y: plinth.p[1],
        position: plinth.p,
        done: got,
        icon,
        tip: `<b>Treasure ${plinth.i + 1}</b><br>${status}`,
    };
}

export function overlaysOf(context: PanelContext): MapOverlay[] {
    const model = context.model;
    const voiceLogs = PROG.voice_logs || [];
    const viewGivers = PROG.view_givers || [];
    const { plinths, got: acquired } = model.treasures;
    return [
        ...model.gates.map((freezerIndex) => gateOverlay(context, freezerIndex)),
        ...model.signs.map((signIndex) => signOverlay(context, signIndex)),
        ...model.pads.map((index) => padOverlay(context, index, 'tps', model.padDisc(index))),
        // a MINOR pad is discovered once stepped on
        ...model.minorPads.map((index) => padOverlay(context, index, 'minorPads', context.progress.tst[index].disc)),
        ...model.rooms.map((room) => goldRoomOverlay(context, room)),
        ...model.logs.map((log) => voiceLogOverlay(context, voiceLogs[log])),
        ...model.maps.map((giver) => mapScrollOverlay(context, viewGivers[giver])),
        ...model.pins.map((pin) => areaPinOverlay(context, pin)),
        ...plinths.map((plinth) => treasureOverlay(context, plinth, acquired)),
    ];
}
