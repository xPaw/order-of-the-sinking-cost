// The areas listed under Completionist: the areas by layer with their solved counts, the map's layer first
// (viewer.md "The page (viewer)", "Level areas (viewer)")
import { PROG } from '../data.ts';
import { escapeHtml } from '../util.ts';
import { readPreference, setPreference } from '../shared.ts';
import { CHEVRON, areaEmblemHtml, checkIcon } from '../map/icons.ts';
import { viewLayer } from '../map/map-html.ts';
import { areaName } from '../model/areas.ts';
import { AREA_LAYERS, layerName } from '../model/layers.ts';
import type { ProgressModel } from '../model/progress-model.ts';
import type { Area } from '../types.ts';

/** The levels of an area that are not under fog, and how many of them are solved. */
interface AreaCount {
    all: number;
    solved: number;
}

// layer groups of the area list that were opened or closed by hand; the others follow the map's layer
const groupChoices = new Map<string, boolean>();

// whether the finished areas are listed under each layer's open ones
let finishedOpen = readPreference('finishedOpen') === '1';

// a layer group not toggled by hand is open when it is the map's layer, or when the map shows every layer
function layerGroupOpen(layerKey: string): boolean {
    const chosen = groupChoices.get(layerKey);
    if (chosen !== undefined) return chosen;

    const mapLayer = viewLayer();
    return !mapLayer || layerKey === mapLayer;
}

export function toggleLayerGroup(layerKey: string): void {
    groupChoices.set(layerKey, !layerGroupOpen(layerKey));
}

export function toggleFinished(): void {
    finishedOpen = !finishedOpen;
    setPreference('finishedOpen', finishedOpen ? '1' : '0');
}

// the map's layer first, then the others in their order
function layerFirst(layerKeys: string[]): string[] {
    const mapLayer = viewLayer();
    if (!mapLayer || !layerKeys.includes(mapLayer)) return layerKeys;
    return [mapLayer, ...layerKeys.filter((key) => key !== mapLayer)];
}

// a layer's header, a button that opens and closes it; its rows follow while open
function layerGroupHtml(layerKey: string, count: string, inner: string): string {
    const open = layerGroupOpen(layerKey);
    const toggle = ` data-grp="${layerKey}" role="button" tabindex="0" aria-expanded="${open}"`;

    const name = escapeHtml(layerName(layerKey));
    const nameHtml = `<span class="gn">${name}</span>`;
    const countHtml = `<span class="cnt">${count}</span>`;
    const header = `<div class="lh"${toggle}>${nameHtml}${CHEVRON}${countHtml}</div>`;
    if (!open) return header;
    return `${header}<div class="kids">${inner}</div>`;
}

// per area, its levels not under fog and how many of them are solved
function areaCounts(model: ProgressModel, areas: Area[]): AreaCount[] {
    const counts = areas.map((): AreaCount => ({ all: 0, solved: 0 }));
    model.levels.forEach((_level, levelIndex) => {
        const area = model.levelArea[levelIndex];
        if (area == null || model.progress.hidden[levelIndex]) return;

        counts[area].all++;
        if (model.progress.state[levelIndex] === 'solved') counts[area].solved++;
    });

    return counts;
}

const layerOfArea = (area: Area): string => area.layer || 'ground';

// the areas with a level not under fog, whose pin is not under fog, in the game's order
function listedAreasOf(model: ProgressModel, areas: Area[], counts: AreaCount[]): number[] {
    return [...areas.keys()]
        .filter((areaIndex) => counts[areaIndex].all && model.areaShown(areaIndex))
        .toSorted((first, second) => (areas[first].order ?? 1e9) - (areas[second].order ?? 1e9));
}

/** Whether any area is listed, which is what makes Completionist fold. */
export function hasListedAreas(model: ProgressModel): boolean {
    const areas = PROG.areas || [];
    return listedAreasOf(model, areas, areaCounts(model, areas)).length > 0;
}

/** The areas under Completionist: a row each with its solved count, grouped by layer when more than one has areas. */
export function areaRowsHtml(model: ProgressModel): string {
    const areas = PROG.areas || [];
    if (!areas.length) return '';

    const counts = areaCounts(model, areas);
    const finished = (areaIndex: number): boolean => counts[areaIndex].solved === counts[areaIndex].all;
    const listed = listedAreasOf(model, areas, counts);

    const listedLayers = new Set(listed.map((areaIndex) => layerOfArea(areas[areaIndex])));
    const extraLayers = [...listedLayers].filter((key) => !AREA_LAYERS.includes(key));
    const layers = layerFirst(AREA_LAYERS.concat(extraLayers));

    // with one layer listed, the rows stand under Completionist without layer subheads
    const grouped = listedLayers.size > 1;
    const pickedArea = model.F.area;
    const rowHtml = (areaIndex: number): string => {
        const done = finished(areaIndex);
        const { solved, all } = counts[areaIndex];
        const name = escapeHtml(areaName(areas[areaIndex]));
        const picked = String(areaIndex) === pickedArea;
        let extraClasses = '';
        let check = '';
        if (done) {
            extraClasses += ' done';
            check = checkIcon;
        }

        if (picked) extraClasses += ' on';

        const attributes = `data-area="${areaIndex}" aria-pressed="${picked}" title="${name}"`;
        const markHtml = `<span class="mk" title="All levels solved">${check}</span>`;
        const nameHtml = `${areaEmblemHtml(areas[areaIndex])}<span class="n">${name}</span>`;
        const countHtml = `<span class="cnt">${solved} / ${all}</span>`;
        return `<button class="plain gl${extraClasses}" ${attributes}>${markHtml}${nameHtml}${countHtml}</button>`;
    };

    // finished areas fold into one row under the open ones
    const finishedRowHtml = (layerKey: string, finishedCount: number): string => {
        const attributes = `data-fin="${layerKey}" role="button" tabindex="0" aria-expanded="${finishedOpen}"`;
        const title = 'title="Areas with every level solved"';
        const label = `<span>${finishedCount} finished</span>`;
        return `<div class="fin" ${attributes} ${title}><span class="mk"></span>${label}${CHEVRON}</div>`;
    };

    const layerHtml = (layerKey: string): string => {
        const inLayer = listed.filter((areaIndex) => layerOfArea(areas[areaIndex]) === layerKey);
        if (!inLayer.length) return '';

        const done = inLayer.filter(finished);
        let rows = inLayer
            .filter((areaIndex) => !finished(areaIndex))
            .map(rowHtml)
            .join('');
        if (done.length) {
            rows += finishedRowHtml(layerKey, done.length);
            if (finishedOpen) rows += done.map(rowHtml).join('');
        }

        if (!grouped) return rows;
        return layerGroupHtml(layerKey, `${done.length} / ${inLayer.length}`, rows);
    };

    return layers.map(layerHtml).join('');
}
