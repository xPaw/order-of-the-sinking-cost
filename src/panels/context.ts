// The state of one drawn progress view, shared by its parts: the model's data, the goal the list and the map show with
// its levels, the list filter, the map and the open panel (VIEWER.md "The page (viewer)")
import type { Fog } from '../fog.ts';
import type { MapView, MapOptions, MapOverlay, SelectHow } from '../map/map-view.ts';
import { PROG } from '../data.ts';
import { state } from '../shared.ts';
import { compareText } from '../util.ts';
import type { PanelKey, PanelKind, ProgressFilters } from '../shared.ts';
import { FOG_LAYER_KEYS, mapLayerOf } from '../model/layers.ts';
import type { GoalLevel, GoalView } from '../model/goals-view.ts';
import type { ProgressModel } from '../model/progress-model.ts';
import type { ShownProgress } from '../model/progress.ts';
import type { Area, Freezer, GoldRoom, Position, ProgressLevel, Sign, Teleporter, Tower } from '../types.ts';
import { panelHash, panelKeep, setHash } from './hash.ts';

/** A level of the goal as the list shows it: the goal's levels by group, and the solved ones. */
export interface ListedLevel {
    i: number;
    group: GoalLevel['group'] | 'solved';
    role: GoalLevel['role'];
    leadsTo: string;
    onPlan: boolean;
}

/** Shows the panel of a level, tower, Freezer or sign. */
export type PanelSelector = (id: number, how?: SelectHow) => void;

// a level whose entrance is on the cell of a Freezer is drawn as one marker with the Freezer behind it
const cellKey = (position: Position): string => position.map((coordinate) => Math.round(coordinate)).join();

export class PanelContext {
    model: ProgressModel;
    status: ProgressModel['status'];
    progress: ShownProgress;
    levels: ProgressLevel[];
    teleporters: Teleporter[];
    fog: Fog;
    hide: boolean;
    filters: ProgressFilters;
    camp: string;
    freezers: Freezer[];
    signs: Sign[];
    towers: Tower[];
    goldRooms: GoldRoom[];
    areas: Area[];

    // the area name of each Freezer asked about, for this draw
    gateAreas = new Map<number, string | null>();

    // per level, the Freezer on its entrance cell; per such Freezer, its level
    iceOf: Array<number | undefined>;

    iceLevel = new Map<number, number>();

    // per tower name, its first tower
    towerAt = new Map<number, number>();

    // the level names in lower case, for the search
    lowNames: string[];

    // The goal the list and the map show, and its levels: the unsolved ones in the model's order, then the solved
    // ones, which the list keeps only while the Solved toggle is on
    goal: GoalView | null = null;

    entries = new Map<number, ListedLevel>();
    goalIds: number[] = [];

    // whether the list filter keeps each level, as of the last apply
    matches = new Uint8Array(0);

    // the levels the filter keeps, on every layer: the ones the list shows
    list: number[] = [];

    // the layer the map shows; a row names its layer when it is another
    mapLayer: string | null = null;

    // the level marked in the list
    selected: number | null = null;

    map: MapView | null = null;
    mapOptions: MapOptions | null = null;

    // the open panel as [kind, id]; the panels Back returns to; the points the open panel's chain frames
    current: PanelKey | null = null;

    back: PanelKey[] = [];
    chainPoints: Position[] = [];

    // the map's overlays, and the panel of each node kind (both set with the map)
    overlays: () => MapOverlay[] = () => [];

    selectors: Record<PanelKind, PanelSelector> = {
        level: () => {},
        tower: () => {},
        gate: () => {},
        sign: () => {},
    };

    constructor(model: ProgressModel) {
        if (state.camp === null) throw new Error('A progress view needs a campaign');

        this.model = model;
        this.status = model.status;
        this.progress = model.progress;
        this.levels = model.levels;
        this.teleporters = model.teleporters;
        this.fog = model.fog;
        this.hide = model.hide;
        this.filters = model.F;
        this.camp = state.camp;
        this.freezers = PROG.freezers;
        this.signs = PROG.signs || [];
        this.towers = PROG.towers;
        this.goldRooms = PROG.gold_rooms;
        this.areas = PROG.areas || [];

        const gateAtCell = new Map(
            model.gates.map((freezerIndex): [string, number] => [cellKey(this.freezers[freezerIndex].p), freezerIndex]),
        );
        this.iceOf = this.levels.map((level) => gateAtCell.get(cellKey(level.p)));
        this.iceOf.forEach((freezerIndex, levelIndex) => {
            if (freezerIndex !== undefined) this.iceLevel.set(freezerIndex, levelIndex);
        });

        this.progress.towers.forEach((tower, towerIndex) => {
            if (!this.towerAt.has(tower.t)) this.towerAt.set(tower.t, towerIndex);
        });

        this.lowNames = this.levels.map((level) => level.n.toLowerCase());
    }

    // a level names its area (the model's per-save pick; the nearest one outside every area box) only while that area
    // is shown
    areaOf(levelIndex: number): number | null {
        const area = this.model.levelArea[levelIndex];
        if (area == null || !this.model.areaShown(area)) return null;
        return area;
    }

    // the area a Freezer stands in while that area is shown
    gateArea(freezerIndex: number): string | null {
        let area = this.gateAreas.get(freezerIndex);
        if (area === undefined) {
            area = this.model.gateArea(freezerIndex);
            this.gateAreas.set(freezerIndex, area);
        }

        return area;
    }

    gateShown(freezer: Freezer): boolean {
        return this.model.shownAt(FOG_LAYER_KEYS[freezer.l], freezer.p);
    }

    layerOf(levelIndex: number): string {
        return mapLayerOf(this.levels[levelIndex].p[2]);
    }

    inView(levelIndex: number): boolean {
        return !this.mapLayer || this.layerOf(levelIndex) === this.mapLayer;
    }

    // a search text lists every level not under fog, whatever the goal, layer, state and chips say
    searching(): boolean {
        return !!this.filters.q;
    }

    // whether the tower or area chip is on
    narrowed(): boolean {
        return this.filters.tower !== '' || this.filters.area !== '';
    }

    // a level is listed when it is one of the goal's, the tower and area chips keep it and it is unsolved (or solved, with
    // the Solved toggle on); a search lists by name alone
    matchNow(levelIndex: number): boolean {
        if (this.progress.hidden[levelIndex]) return false;
        if (this.filters.q) return this.lowNames[levelIndex].includes(this.filters.q);
        if (!this.entries.has(levelIndex)) return false;

        const level = this.levels[levelIndex];
        const filters = this.filters;
        if (filters.tower !== '' && level.t !== this.progress.towers[Number(filters.tower)]?.t) return false;
        if (filters.area !== '' && String(this.model.levelArea[levelIndex] ?? '') !== filters.area) return false;
        return (this.progress.state[levelIndex] === 'solved') === filters.solved;
    }

    computeMatches(): void {
        this.matches = Uint8Array.from(this.levels, (_level, levelIndex) => (this.matchNow(levelIndex) ? 1 : 0));
    }

    match(levelIndex: number): boolean {
        return this.matches[levelIndex] === 1;
    }

    // the levels the filter keeps, on every layer: a goal's in the model's order, a search's by name
    listedLevels(): number[] {
        if (!this.searching()) return this.goalIds.filter((levelIndex) => this.match(levelIndex));

        const found: number[] = [];
        this.levels.forEach((_level, levelIndex) => {
            if (this.match(levelIndex)) found.push(levelIndex);
        });

        return found.toSorted((first, second) => compareText(this.levels[first].n, this.levels[second].n));
    }

    // a level of the goal, which the list shows
    entryOf(levelIndex: number): ListedLevel {
        const entry = this.entries.get(levelIndex);
        if (!entry) throw new Error(`Level ${levelIndex} is not one of the goal's`);
        return entry;
    }

    loadGoal(): void {
        this.goal = this.model.goalFor(this.filters.goal);
        this.entries = new Map();
        if (this.goal) {
            for (const entry of this.model.goalLevels(this.goal)) this.entries.set(entry.i, entry);
            for (const solved of this.model.goalSolved(this.goal)) {
                this.entries.set(solved, { i: solved, group: 'solved', role: null, leadsTo: '', onPlan: true });
            }
        }

        this.goalIds = [...this.entries.keys()];
    }

    // a one-of level off the goal's cheapest plans, listed after the ones on them
    isOffPlan(levelIndex: number): boolean {
        const entry = this.entryOf(levelIndex);
        return entry.role === 'one' && !entry.onPlan;
    }

    towerOf(levelIndex: number): number {
        const towerName = this.levels[levelIndex].t;
        if (!towerName) return -1;
        return this.towerAt.get(towerName) ?? -1;
    }

    towerShown(levelIndex: number): boolean {
        const towerIndex = this.towerOf(levelIndex);
        return towerIndex >= 0 && !this.progress.towerHidden[towerIndex];
    }

    // keeps the open panel for the campaign and names it in the address
    remember(key: PanelKey): void {
        panelKeep[this.camp] = key;
        this.current = key;

        setHash(panelHash(key, this));
    }

    open([kind, id]: PanelKey, how?: SelectHow): void {
        this.selectors[kind](id, how);
    }

    // the panel is closed: nothing is kept for the campaign or named in the address
    forget(): void {
        this.current = null;
        this.back.length = 0;
        delete panelKeep[this.camp];
        setHash('');
    }
}
