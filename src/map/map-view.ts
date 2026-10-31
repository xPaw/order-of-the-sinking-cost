// The overworld map of the progress view (VIEWER.md "The page (viewer)"): one layer's image under the fog, the
// Reachable overlay, the overlay marks, the level and tower markers with the selection's links and steps, the area
// labels, the selection panel, the toolbar and the tooltip, over panZoom's view of the wrapping map
import { PROG } from '../data.ts';
import type { Fog, FogRect } from '../fog.ts';
import type { FindKind } from '../model/find-kinds.ts';
import { AREA_LAYERS, mapLayerOf, wrapDelta } from '../model/layers.ts';
import { panZoom } from '../panzoom.ts';
import type { Box, Insets, PanZoom, ViewCorner } from '../panzoom.ts';
import { setPreference } from '../shared.ts';
import type { PanelKey, PanelKind } from '../shared.ts';
import type { MapLayer, Position } from '../types.ts';
import { $, setButtonPressed } from '../util.ts';
import { ICON_URLS, ROLE_BADGE_URLS, SHAPES } from './icons.ts';
import type { IconName, Role } from './icons.ts';
import { MAP_IMAGE_PIXELS_PER_SQUARE, TerrainImages } from './layer-images.ts';
import type { LevelIconName } from './level-icons.ts';
import type { OceanSquares } from './ocean-water.ts';
import { isOverlayKind, knownLayers, mapKeep, overlayOn, startLayer, switchOf } from './map-html.ts';
import type { MapKeep, OverlayKind } from './map-html.ts';
import { LayerMarks } from './mark-pool.ts';
import type { MarkAttributes } from './mark-pool.ts';
import { reachedRects, reachImage } from './reach-image.ts';
import { mapXY, rawXY, torusBox, wrapRect } from './torus.ts';
import type { Rect } from './torus.ts';

/** The overlay of a Freezer on a level's entrance: the overlay id of the Freezer, its model and whether it is open. */
export interface MapFreezer {
    id: string;
    doorway: boolean;
    open: boolean;
}

/** A level marker. `tip` is the tooltip's html, made when it is shown. */
export interface MapMarker {
    levelIndex: number;
    x: number;
    y: number;
    z: number;
    ice?: MapFreezer;
    readonly tip: string;
}

/** How a level marker is drawn. */
export interface MarkerStyle {
    /** The list filter leaves the level out. */
    hidden: boolean;
    /** The level is under fog and not drawn at all. */
    gone: boolean;
    /** The entry pad's icon: whether the level can be entered, was entered or is solved. */
    pad: LevelIconName;
    /** The level is open but not reachable yet: its icon is dimmed. */
    blocked: boolean;
    /** The level's role for the selected goal, null for a level that is not in it. */
    role: Role | null;
    big: boolean;
    /** The save is in the level. */
    current: boolean;
    rank: number;
}

/** A tower marker; one on its tower pad is drawn as the pad's icon and belongs to the Tower pads switch. */
export interface MapTower {
    towerIndex: number;
    x: number;
    y: number;
    z: number;
    activated: boolean;
    onPad: boolean;
    /** The tower's pad has been discovered. */
    padFound: boolean;
    tip: string;
}

/** An area label. */
export interface MapLabel {
    x: number;
    y: number;
    z: number;
    text: string;
}

/**
 * A mark of the overlay group. `kind` names its rim style and, unless `findKind` says otherwise, the overlay switch that
 * shows or hides it; `findKind` is the kind whose Find on the map list counts it, null for none; `layer` is the map layer
 * key; `icon` is the image on its disc; `done` is false while the thing is not done yet, and the mark is drawn as used
 * (grey rim, desaturated icon) once it is, or before it is for `dimUntilDone`; `accent` is a rim colour that replaces the
 * kind's: a sign ready to read, a gold room visited; `panel` is the panel a click opens, which also makes the mark
 * clickable; `merge` is the marker index whose pad shows the mark's Freezer while that marker is drawn, so the mark
 * itself is left out; `req` is false for a gate the goal does not need; `position` is where the Find on the map list
 * names its place from, unless `place` names it; `state` is what became of it.
 */
export interface MapOverlay {
    kind: string;
    findKind: FindKind | null;
    layer: string;
    x: number;
    y: number;
    position: Position;
    icon: IconName;
    dimUntilDone?: boolean;
    accent?: 'ready' | 'gold';
    tip: string;
    id: string;
    place?: string;
    state: string;
    done: boolean;
    panel?: PanelKey;
    merge?: number;
    req?: boolean;
}

/** An end of a link: a marker index, or the position of a tower. */
export type LinkEnd = number | Position;

/** A line from the first end to the second: solid for a requirement, dashed for what it unlocks. */
export type MapLink = [from: LinkEnd, to: LinkEnd, kind: 'req' | 'unl'];

/** A numbered badge of an unlock chain on one of its ends. */
export type MapStep = [end: LinkEnd, number: number];

/**
 * What the map highlights: `levels` are the markers of the selection, `tower` the tower index, `exact` always fits the
 * points (with at least MIN_BOX squares around them), `focus` the level marker on top, `frontier` the levels at the
 * chain's frontier, `overlays` the overlay ids, `html` the panel's body, `z` the height that picks the layer, `points`
 * the points to frame, `links` the lines and `steps` the numbered badges.
 */
export interface MapSelection {
    levels: Set<number>;
    tower?: number;
    exact?: boolean;
    focus?: number;
    frontier?: Set<number>;
    overlays?: Set<string>;
    html?: string;
    z?: number;
    points?: Position[];
    links?: MapLink[];
    steps?: MapStep[];
}

/** still keeps the view and the focus; keepFocus keeps the focus only. */
export interface SelectHow {
    still?: boolean;
    keepFocus?: boolean;
}

/** A world point with a height: a marker, a tower or the hero. */
export interface MapPoint {
    x: number;
    y: number;
    z: number;
}

/**
 * panel: the element that holds the selection's html (it is hidden while there is none); markers: the level markers;
 * style(marker): how one is drawn; towers; labels: the area labels; hero; fog (shown and
 * framed as the home view when given); onOpen() and onClose(): after a selection is made or cleared; keep(overlay): whether the list filter keeps an
 * overlay (the selection's overlays are drawn whatever it says); reach: the column bitmap of the reached squares per
 * layer key (the Reachable overlay; without it the toggle is hidden); overlays: the marks of the overlay group;
 * onLayer(key); water: the squares of changed water per layer key.
 */
export interface MapOptions {
    panel: HTMLElement;
    markers: MapMarker[];
    style: (marker: MapMarker) => MarkerStyle;
    towers: MapTower[];
    labels: MapLabel[];
    hero?: MapPoint | null;
    fog?: Fog | null;
    onClose?: () => void;
    onOpen?: () => void;
    keep?: (overlay: MapOverlay) => boolean;
    reach?: Record<string, Uint8Array>;
    overlays: MapOverlay[];
    onLayer?: (key: string) => void;
    water?: OceanSquares;
}

/** The layer and view of a map, to come back to with setView. */
export interface MapViewState {
    layer: string;
    vb: Box | undefined;
    moved: boolean;
}

/** A level marker with the style it is drawn in. */
interface StyledMarker {
    marker: MapMarker;
    style: MarkerStyle;
}

/** An interactive element of the first copy of the map and its position in map pixels. */
interface HitTarget {
    element: SVGGeometryElement;
    x: number;
    y: number;
}

/** An area label placed on the map: its text, position and box width in pixels at the smallest label size. */
interface PlacedLabel {
    text: string;
    x: number;
    y: number;
    width: number;
}

/** A level marker of the last draw. */
interface DrawnMarker {
    x: number;
    y: number;
    levelIndex: number;
}

/** The two ends of a drawn link with the radii of the markers on them: x1, y1, start radius, x2, y2, end radius. */
type LinkEndpoints = [x1: number, y1: number, startRadius: number, x2: number, y2: number, endRadius: number];

/** A box in screen pixels: left, top, right, bottom. */
type PixelRect = [left: number, top: number, right: number, bottom: number];

/** The pixels of the map covered by its controls. */
interface MapInsets {
    top: number;
}

// the map drawn last
export let activeMap: MapView | null = null;

// the layer images of each map by its id, kept while the page makes the map's html again
const terrainImages = new Map<string, TerrainImages>();

// told when a drag, pinch or eased zoom of a map ends
let gestureEndListener: (() => void) | null = null;

export function onGestureEnd(listener: () => void): void {
    gestureEndListener = listener;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// the elements a pointer event can be on, found by geometry in the copies of the map
const INTERACTIVE = '[data-i],[data-tw],[data-gate],[data-sign],[data-gtw],[data-tip]';

// the smallest box a selection or a set of points is framed in, in squares; an unlock chain's steps get a closer one
const MIN_BOX = 24;

const MIN_CHAIN_BOX = 8;

// the margin around a framed box, in pixels
const FRAME_MARGIN = 28;

// the squares one mark unit spans: marks grow and shrink with the map
const MARK_SCALE = 0.09;

// the screen pixels one mark unit spans at the least: a mark stays about 10 px across however far the map is zoomed out
const MARK_MIN_PIXELS = 0.7;

// the squares one mark unit spans while the view shows `squaresPerPixel` squares per screen pixel; the stylesheet's marks
// scale by it through --mk
const markScale = (squaresPerPixel: number): number => Math.max(MARK_SCALE, MARK_MIN_PIXELS * squaresPerPixel);

// an area label keeps a constant screen size until a square is wider than 11 px
const labelScale = (squaresPerPixel: number): number => Math.max(MARK_SCALE, squaresPerPixel);

// how far a mark reaches from its position, in mark units: the largest, a selected tower with its stroke and glow, and
// a step badge stay within it
const MARK_REACH = 32;

// the radius of a mark's disc and of the icon on it, in mark units: every overlay mark, tower pad and level pad has them
// (a big level marker's and the focused level's discs are larger)
const DISC_RADIUS = 8;
const ICON_MARGIN = 1;

// the radius of a tower's diamond
const TOWER_RADIUS = 8.5;

// the radius of the icon on a disc
const iconRadiusOn = (discRadius: number): number => discRadius - ICON_MARGIN;

// the diamond of a tower without a pad
const TOWER_DIAMOND = `M0 ${-TOWER_RADIUS}L${TOWER_RADIUS} 0L0 ${TOWER_RADIUS}L${-TOWER_RADIUS} 0Z`;

/** The marks of one level marker: the ring that takes the pointer, and the icons on it (pad, frozen cage, role badge). */
interface LevelParts {
    ring: MarkAttributes;
    icons: MarkAttributes[];
}

// the part of the map's markup that matches a selector; the markup always has it
function find<Part extends Element>(root: ParentNode, selector: string, type: abstract new () => Part): Part {
    const part = root.querySelector(selector);
    if (!(part instanceof type)) throw new Error(`The map has no ${selector}`);
    return part;
}

// world rectangle [x, y, w, h] to map coordinates
function toMap([x, y, width, height]: Rect): Rect {
    const [mapX, mapY] = rawXY(x, y + height);
    return [mapX - 0.5, mapY + 0.5, width, height];
}

const rectHtml = (x: number, y: number, width: number, height: number, grow: number): string =>
    `<rect x="${x - grow}" y="${y - grow}" width="${width + 2 * grow}" height="${height + 2 * grow}"/>`;

// the screen position of a mark, which its transform reads
const placedAt = (x: number, y: number): string => `--x:${x.toFixed(2)}px;--y:${y.toFixed(2)}px`;

// the data attribute that makes a mark open each kind of panel; the pointer handlers read the same attributes
const PANEL_ATTRIBUTES: Record<PanelKind, string> = {
    level: 'data-i',
    tower: 'data-gtw',
    gate: 'data-gate',
    sign: 'data-sign',
};

// the attributes of a mark, hidden when it is not drawn
function hiddenWhen(hidden: boolean, attributes: MarkAttributes): MarkAttributes {
    if (hidden) attributes.display = 'none';
    return attributes;
}

const boxOf = (points: Array<[number, number]>): Box => torusBox(points.map(([x, y]): Rect => [x, y, 0, 0]));

function padBox(box: Box, min = MIN_BOX): Box {
    const width = Math.max(box.w, min);
    const height = Math.max(box.h, min);
    return { x: box.x - (width - box.w) / 2, y: box.y - (height - box.h) / 2, w: width, h: height };
}

const greatestCommonDivisor = (first: number, second: number): number =>
    second ? greatestCommonDivisor(second, first % second) : first;

function mapLayer(key: string): MapLayer {
    const layer = PROG.map.layers.find((candidate) => candidate.key === key);
    if (!layer) throw new Error(`The map has no layer ${key}`);
    return layer;
}

// a level marker's radius in mark units: larger for the focused level and for big markers
function levelMarkerRadius(style: MarkerStyle, focused: boolean): number {
    if (focused) return 11;
    if (style.big) return 10;
    return DISC_RADIUS;
}

// a circle's path around (0, 0), which the stylesheet draws as a disc or a ring
const discPath = (radius: number): string => SHAPES.circle.path(radius);

// the attributes of an image element that draws `url` in a square around the mark's position
function iconAttributes(url: string, radius: number, position: string): MarkAttributes {
    return {
        href: url,
        x: -radius,
        y: -radius,
        width: 2 * radius,
        height: 2 * radius,
        style: position,
    };
}

// an end of a link: a marker index, or an [x, y, z] position (a tower)
const isPosition = (end: LinkEnd): end is Position => Array.isArray(end);

// the overlay switch a button of the map's controls stands for
function overlayKindOf(button: HTMLElement): OverlayKind {
    const kind = button.dataset.ov;
    if (kind === undefined || !isOverlayKind(kind)) throw new Error(`The map has no overlay ${kind}`);
    return kind;
}

// the element to give focus back to: the focused element, when it can take focus
function focusableOf(element: Element | null): HTMLElement | SVGElement | null {
    if (element instanceof HTMLElement || element instanceof SVGElement) return element;
    return null;
}

// The caller sets onPick(level), onTower(i), onGate(i) and onSign(i) for clicks on the map.
export class MapView {
    onPick?: (level: number) => void;
    onTower?: (tower: number) => void;
    onGate?: (gate: number) => void;
    onSign?: (sign: number) => void;

    private options: MapOptions;
    private box: HTMLElement;
    private svg: SVGSVGElement;
    private overlayGroup: SVGGElement;
    private tip: HTMLElement;
    private panel: HTMLElement;
    private controls: HTMLElement;
    private keep: MapKeep;
    private layoutFrame = 0;
    private currentLayer: string;

    // the layer a click on the layer toggle waits to switch to, while its full image decodes; empty for none
    private pendingLayer = '';

    // the selection (see select), or null
    private selection: MapSelection | null = null;

    // the level markers of the last draw, for the tooltip of overlapping ones
    private drawnMarkers: DrawnMarker[] = [];

    private linkEnds: LinkEndpoints[] = [];
    private fogOn: boolean;

    // with fog shown, layers the player has not uncovered yet have no button (mapHtml leaves them out)
    private known: string[] | null;

    // undefined until the home box is worked out for the current draw
    private homeCache: Box | null | undefined = undefined;

    private hitList: HitTarget[] | null = null;
    private hover: Element | null = null;
    private tipHtml = '';

    // the marks of each layer drawn so far, by layer key, and those of the layer shown; the lines, labels, fog edge
    // and hatch follow the view
    private layerMarks = new Map<string, LayerMarks>();

    private marks: LayerMarks | null = null;

    // The area labels sit outside the repeated overlay group: each copy of the map has a text element of its own,
    // made the first time that copy's label is shown. labels: the labels of the last draw;
    // labelPool: the text elements by label and copy; labelsOn: the ones shown
    private labelsGroup: SVGGElement;

    private labelPool = new Map<string, SVGTextElement>();
    private labelsLayer: string | null = null;
    private labels: PlacedLabel[] = [];
    private labelsOn = new Set<SVGTextElement>();
    private fogGroup: SVGGElement;
    private fogCore: SVGGElement;
    private blur: SVGFEGaussianBlurElement;
    private hatch: SVGPatternElement | null;
    private reachFogGroup: SVGGElement;
    private fogBlur = 0;
    private hatchWidth = 0;

    // the layer images under the svg, and the terrain group of the svg, which holds the Reachable images; both are
    // `crisp` once a map image pixel is wider than a screen pixel
    private terrain: TerrainImages;
    private terrainGroup: SVGGElement;

    // the Reachable overlay image of each layer of this map, built the first time the layer is shown
    private reachUrls: Record<string, string | null> = {};

    // the layer's image, fogged rectangles, Reachable image and hatch, and changed water: drawn again when the
    // layer or the Reachable switch changes (drawnLayer); reachEmpty: no Reachable image or hatch on the layer
    private drawnLayer: string | null = null;

    private reachEmpty = true;

    // the control that had focus when the panel opened gets it back when the panel closes
    private opener: HTMLElement | SVGElement | null = null;

    private sized = false;
    private waiting: Array<() => void> = [];

    // how far past the map the far ends of the selection's lines lie, in squares
    private linkReach = 0;

    private viewport: PanZoom;

    constructor(id: string, options: MapOptions) {
        this.options = options;
        this.box = $('#' + id);
        this.svg = find(this.box, ':scope > svg', SVGSVGElement);
        this.overlayGroup = find(this.svg, '.ov', SVGGElement);
        this.tip = find(this.box, '.tip', HTMLElement);
        this.panel = options.panel;
        this.controls = find(this.box, '.ctl', HTMLElement);
        this.keep = mapKeep(id);
        this.currentLayer = startLayer(this.keep, options.fog, options.hero);
        this.fogOn = !!options.fog;
        this.known = knownLayers(options.fog);

        // the layers share coordinates, so a layer that cannot be kept (no longer uncovered) leaves the view where it was
        this.keep.layer = this.currentLayer;

        this.labelsGroup = find(this.svg, 'g.lbl', SVGGElement);
        const terrainHolder = find(this.box, ':scope > .terrain', HTMLElement);
        let terrain = terrainImages.get(id);
        if (terrain) {
            terrain.attach(terrainHolder);
        } else {
            terrain = new TerrainImages(terrainHolder);
            terrainImages.set(id, terrain);
        }
        this.terrain = terrain;
        this.terrainGroup = find(this.svg, `#${id}-w`, SVGGElement);
        this.fogGroup = find(this.svg, '.fog', SVGGElement);
        this.fogCore = find(this.svg, '.fogc', SVGGElement);
        this.blur = find(this.svg, 'feGaussianBlur', SVGFEGaussianBlurElement);
        this.hatch = this.svg.querySelector<SVGPatternElement>('.hatch');
        this.reachFogGroup = find(this.svg, '.rfog', SVGGElement);

        this.viewport = panZoom(this.svg, this.keep, {
            insets: () => this.insets(),
            pick: (event) => this.pick(event),
            home: () => this.homeBox(),
            cap: () => this.capBox(),
            onView: (view) => this.viewChanged(view),
            onIdle: () => gestureEndListener?.(),
            scaled: [this.overlayGroup, this.labelsGroup],
            onPixelScale: (scale) => {
                this.overlayGroup.style.setProperty('--mk', String(markScale(scale)));
                this.labelsGroup.style.setProperty('--mk', String(labelScale(scale)));
            },
            reach: (group, scale) => this.copyReach(group, scale),
        });

        this.wireControls();
        this.wirePointer();

        new ResizeObserver(() => {
            if (this.box.isConnected) this.viewport.resize();
            this.settle();
        }).observe(this.box);

        // a box that is never laid out (hidden)
        setTimeout(() => this.settle(), 500);

        this.panel.hidden = true;
        this.draw();
    }

    // puts the marks of a layer (made the first time it is drawn) in the overlay group in place of the last layer's
    private showMarks(layer: string): void {
        let marks = this.layerMarks.get(layer);
        if (!marks) {
            marks = new LayerMarks();
            this.layerMarks.set(layer, marks);
        }

        if (marks === this.marks) return;

        this.overlayGroup.replaceChildren(marks.root);
        this.marks = marks;
    }

    // the marks of the layer shown, which every draw makes first
    private get shownMarks(): LayerMarks {
        if (!this.marks) throw new Error('The map has not drawn a layer yet');
        return this.marks;
    }

    // the toolbar floats over the top of the map: a framed view keeps below it
    private insets(): MapInsets {
        const controlsBottom = this.controls.offsetTop + this.controls.offsetHeight;
        return { top: controlsBottom + 4 };
    }

    // with fog shown, the home view frames the uncovered regions of the layer plus the markers a click revealed under
    // the fog (else the levels shown on it), with a margin; the box is rebuilt on every draw
    private homeBox(): Box | null {
        if (!this.fogOn) return null;
        if (this.homeCache !== undefined) return this.homeCache;

        this.homeCache = this.uncoveredBox();
        return this.homeCache;
    }

    private uncoveredBox(): Box | null {
        const { options } = this;
        const fog = options.fog;
        if (!fog) return null;

        const layer = this.currentLayer;
        const spot = (x: number, y: number): Rect => {
            const [mapX, mapY] = mapXY(x, y);
            return [mapX - 6, mapY - 6, 12, 12];
        };

        const shown = (options.markers || []).filter(
            (marker) => mapLayerOf(marker.z) === layer && !options.style(marker).gone,
        );
        const rects = fog.open(layer).map(toMap);
        const anyOpen = rects.length > 0;

        for (const marker of shown) {
            if (!anyOpen || fog.at(layer, marker.x, marker.y, marker.z)) rects.push(spot(marker.x, marker.y));
        }

        for (const tower of options.towers || []) {
            if (mapLayerOf(tower.z) === layer && fog.at(layer, tower.x, tower.y, tower.z)) {
                rects.push(spot(tower.x, tower.y));
            }
        }

        if (!rects.length) return null;

        const box = torusBox(rects);
        const margin = 2;
        return { x: box.x - margin, y: box.y - margin, w: box.w + 2 * margin, h: box.h + 2 * margin };
    }

    // how far the copies of a group reach past the map, in squares: the terrain not at all (it is clipped to the map),
    // the marks by their size and the selection's lines by their far ends
    private copyReach(group: string | null, scale: number): number {
        if (group !== `#${this.box.id}-o`) return 0;
        return MARK_REACH * markScale(scale) + this.linkReach;
    }

    // the zoom-out cap is the layer's MAIN_MAP camera box, the view of the in-game overhead map: it fits the box on
    // both axes and centres on it
    private capBox(): Box | null {
        const camera = PROG.map.main_box?.[this.currentLayer];
        if (!camera) return null;

        const [mapX, mapY] = rawXY(camera.c[0], camera.c[1]);
        return { x: mapX - camera.e[0], y: mapY - camera.e[1], w: 2 * camera.e[0], h: 2 * camera.e[1] };
    }

    // The interactive elements of the first copy of the map, with their positions
    private hitTargets(): HitTarget[] {
        if (!this.hitList) {
            const elements = this.shownMarks.root.querySelectorAll<SVGGeometryElement>(INTERACTIVE);
            this.hitList = [...elements].map((element) => ({
                element,
                x: parseFloat(element.style.getPropertyValue('--x')),
                y: parseFloat(element.style.getPropertyValue('--y')),
            }));
        }

        return this.hitList;
    }

    // A copy of the map answers pointer events as its use element, so the element under the pointer is found by
    // geometry among the interactive elements of the first copy (the last in document order is on top); null where a
    // copy has nothing. The first copy's own elements are their own targets.
    private pick(event: MouseEvent): Element | null {
        const target = event.target;
        if (!(target instanceof Element)) return null;
        if (!target.matches('use[data-kx]')) return target;

        const hitList = this.hitTargets();
        const point = this.viewport.toWorld(event);
        const [width, height] = PROG.map.size;
        const reach = 20 * markScale(this.viewport.scale().scale);
        let hit: Element | null = null;

        for (const candidate of hitList) {
            const dx = wrapDelta(candidate.x - point.x, width);
            const dy = wrapDelta(candidate.y - point.y, height);
            if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;

            const style = getComputedStyle(candidate.element);
            if (style.display === 'none' || style.pointerEvents === 'none') continue;

            const local = new DOMMatrix(style.transform)
                .inverse()
                .transformPoint(new DOMPoint(candidate.x - dx, candidate.y - dy));
            const inFill = style.fill !== 'none' && candidate.element.isPointInFill(local);
            const inStroke = style.stroke !== 'none' && candidate.element.isPointInStroke(local);
            if (inFill || inStroke) hit = candidate.element;
        }

        return hit;
    }

    // the layer images follow the view in the same task as the viewBox, so they never lag the svg by a frame
    private viewChanged(view: ViewCorner | null): void {
        if (view) this.terrain.place(view);

        this.tip.style.display = 'none';
        if (this.layoutFrame) return;

        this.layoutFrame = requestAnimationFrame(() => {
            this.layoutFrame = 0;
            this.layout();
        });
    }

    private layout(): void {
        const view = this.viewport.view();
        if (!view) return;

        this.placeLinks(view);
        this.cullLabels(view);
        this.softenFog(view);
        this.sharpenImages(view);
    }

    // the layer images are smoothed, except once the map is zoomed in past one image pixel per screen pixel: then their
    // pixels are shown as blocks
    private sharpenImages({ scale }: ViewCorner): void {
        const crisp = scale < 1 / MAP_IMAGE_PIXELS_PER_SQUARE;
        this.terrainGroup.classList.toggle('crisp', crisp);
        this.terrain.setCrisp(crisp);
    }

    // the fog's feathered edge keeps about the same width on screen: its blur and growth (a stroke in the fog colour,
    // 0.7 std outside each rectangle) follow the zoom; the hatch over fogged regions keeps its stripes 10 px apart on
    // screen
    private softenFog(view: ViewCorner): void {
        // the stripes are 45 degrees: one world size along an axis is W / sqrt(2) along the stripe normal, so a period
        // that divides gcd(W, H) / sqrt(2) puts the stripes of every copy of the map on those of the first
        const [width, height] = PROG.map.size;
        const unit = greatestCommonDivisor(width, height) / Math.SQRT2;
        const hatchWidth = unit / Math.max(1, Math.round(unit / (10 * view.scale)));
        if (this.hatch && hatchWidth !== this.hatchWidth) {
            this.hatchWidth = hatchWidth;
            this.hatch.setAttribute('width', String(hatchWidth));
            this.hatch.setAttribute('height', String(hatchWidth));

            const stripe = this.hatch.firstElementChild;
            stripe?.setAttribute('width', String(hatchWidth * 0.2));
            stripe?.setAttribute('height', String(hatchWidth));
        }

        const blurRadius = Math.round(Math.min(2.2, Math.max(0.15, 7 * view.scale)) * 20) / 20;
        if (blurRadius === this.fogBlur) return;

        this.fogBlur = blurRadius;
        this.blur.setAttribute('stdDeviation', String(blurRadius));
        this.fogGroup.setAttribute('stroke-width', String(1.4 * blurRadius));
    }

    // area labels keep a constant screen size (growing with the map once a square is bigger than the markers). Each copy
    // of a label is shown when its anchor lies inside the view, whatever covers that part of the map, and its box
    // overlaps no label placed before it, in label order
    private cullLabels(view: ViewCorner): void {
        const { x0, y0, scale, rect: viewRect } = view;
        const placed: PixelRect[] = [];
        const shownTexts = new Set<SVGTextElement>();
        const grow = Math.max(1, 0.09 / scale);
        const overlaps = (first: PixelRect, second: PixelRect): boolean =>
            first[0] < second[2] && first[2] > second[0] && first[1] < second[3] && first[3] > second[1];
        const [width, height] = PROG.map.size;
        const right = x0 + viewRect.width * scale;
        const bottom = y0 + viewRect.height * scale;

        this.labels.forEach((label, index) => {
            const labelWidth = label.width * grow;

            // the copies whose anchor lies inside the view
            const firstCopyY = Math.ceil((y0 - label.y) / height);
            const lastCopyY = Math.floor((bottom - label.y) / height);
            const firstCopyX = Math.ceil((x0 - label.x) / width);
            const lastCopyX = Math.floor((right - label.x) / width);

            for (let copyY = firstCopyY; copyY <= lastCopyY; copyY++) {
                for (let copyX = firstCopyX; copyX <= lastCopyX; copyX++) {
                    const x = (label.x + copyX * width - x0) / scale;
                    const y = (label.y + copyY * height - y0) / scale;
                    const rect: PixelRect = [x - labelWidth / 2, y - 17 * grow, x + labelWidth / 2, y + 5 * grow];
                    if (placed.some((other) => overlaps(rect, other))) continue;

                    placed.push(rect);
                    shownTexts.add(this.labelText(label, index, copyX, copyY));
                }
            }
        });

        for (const text of this.labelsOn) {
            if (!shownTexts.has(text)) text.classList.add('off');
        }

        for (const text of shownTexts) text.classList.remove('off');
        this.labelsOn = shownTexts;
    }

    // the text element of one copy of a label, made the first time it is shown
    private labelText(label: PlacedLabel, index: number, copyX: number, copyY: number): SVGTextElement {
        const [width, height] = PROG.map.size;
        const copy = `${index}:${copyX}:${copyY}`;
        const existing = this.labelPool.get(copy);
        if (existing) return existing;

        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('class', 'area');
        text.setAttribute('x', String(label.x + copyX * width));
        text.setAttribute('y', String(label.y + copyY * height));
        text.textContent = label.text;
        this.labelsGroup.append(text);
        this.labelPool.set(copy, text);
        return text;
    }

    // a marker's drawn radius in mark units
    private endRadius(end: LinkEnd): number {
        if (isPosition(end)) return TOWER_RADIUS + 1;

        const style = this.options.style(this.options.markers[end]);
        const focused = this.selection?.focus === end;
        return levelMarkerRadius(style, focused) + 1;
    }

    // lines run from marker edge to marker edge; one with no visible stretch left is hidden
    private placeLinks({ scale }: ViewCorner): void {
        const unit = markScale(scale);
        const marks = this.shownMarks.linkLines.marks;

        this.linkEnds.forEach(([x1, y1, startRadius, x2, y2, endRadius], index) => {
            const length = Math.hypot(x2 - x1, y2 - y1);
            const startGap = startRadius * unit;
            const endGap = endRadius * unit;
            const visible = length - startGap - endGap >= 6 * scale;
            const lines = [marks[2 * index].element, marks[2 * index + 1].element];
            for (const line of lines) line.style.display = visible ? '' : 'none';
            if (!visible) return;

            const ux = (x2 - x1) / length;
            const uy = (y2 - y1) / length;
            for (const line of lines) {
                line.setAttribute('x1', String(x1 + ux * startGap));
                line.setAttribute('y1', String(y1 + uy * startGap));
                line.setAttribute('x2', String(x2 - ux * endGap));
                line.setAttribute('y2', String(y2 - uy * endGap));
            }
        });
    }

    // markers drawn over fog get a dark halo: one a click revealed, or one uncovered below a fog box the map draws over it
    private overFog(x: number, y: number): string {
        if (this.fogOn && this.options.fog?.cover(this.currentLayer, x, y)) return ' fg';
        return '';
    }

    private kept(overlay: MapOverlay): boolean {
        if (this.isChosen(overlay)) return true;
        return !this.options.keep || this.options.keep(overlay);
    }

    // whether the selection holds an overlay
    private isChosen(overlay: MapOverlay): boolean {
        if (overlay.id === undefined) return false;
        return !!this.selection?.overlays?.has(overlay.id);
    }

    // runs a view change once the layer shown has its full image decoded, so that the animation does not stall on the
    // decoding; the thumbnail is on screen meanwhile. A layer switched away from meanwhile is left alone.
    private afterLayerDecoded(run: () => void): void {
        const layer = this.currentLayer;
        if (this.terrain.isDecoded(layer)) {
            run();
            return;
        }

        void this.terrain.decoded(layer).then(() => {
            if (this.currentLayer === layer) run();
        });
    }

    private drawLayer(): void {
        const { options, svg } = this;
        const layer = this.currentLayer;

        // fogged squares are an opaque core; a blurred, grown copy feathers the outside edge only.
        // Both are clipped to the map, so fog ends at the map border.
        let rects: FogRect[] = [];
        if (options.fog && this.fogOn) rects = options.fog.rects(layer);
        const fogParts = rects.map(toMap).flatMap(wrapRect);
        this.fogGroup.innerHTML = fogParts.map((rect) => rectHtml(...rect, 0)).join('');

        // the slight overlap leaves no seams between neighbours
        this.fogCore.innerHTML = fogParts.map((rect) => rectHtml(...rect, 0.02)).join('');

        this.terrain.show(layer);

        if (options.reach && !(layer in this.reachUrls)) {
            this.reachUrls[layer] = reachImage(mapLayer(layer), options.reach, options.fog);
        }

        const reachUrl = options.reach && this.reachUrls[layer];
        svg.querySelectorAll<SVGImageElement>('image.reach').forEach((image) => {
            const isShown = overlayOn.reach && !!reachUrl && image.dataset.layer === layer;
            if (isShown && image.getAttribute('href') !== reachUrl) image.setAttribute('href', reachUrl);
            image.style.display = isShown ? '' : 'none';
        });

        // with the fog shown, fogged rectangles that hold a reached column are hatched whole, never square by square
        let reachFog: FogRect[] = [];
        if (this.fogOn && options.reach) reachFog = reachedRects(options.reach[layer], rects);

        let hatchHtml = '';
        if (overlayOn.reach) {
            const hatchRects = reachFog.flatMap((rect) => wrapRect(toMap(rect)));
            hatchHtml = hatchRects.map((rect) => rectHtml(...rect, 0)).join('');
        }

        this.reachFogGroup.innerHTML = hatchHtml;

        const water = options.water?.[layer] || [];
        find(svg, '.wtr', SVGGElement).innerHTML = water
            .map(([x, y]) => {
                const [mapX, mapY] = mapXY(x, y);
                return `<rect x="${mapX - 0.5}" y="${mapY - 0.5}" width="1" height="1"/>`;
            })
            .join('');

        this.box
            .querySelectorAll<HTMLElement>('[data-role=layers] button')
            .forEach((button) => setButtonPressed(button, button.dataset.layer === layer));
        this.reachEmpty = !reachUrl && !reachFog.length;
    }

    // markers that overlap stack by relevance: the selection's focus on top, then its levels, then by style rank
    private stackRank({ marker, style }: StyledMarker): number {
        if (this.selection?.focus === marker.levelIndex) return 1e3;

        const rank = style.rank || 0;
        if (this.selection?.levels.has(marker.levelIndex)) return 100 + rank;
        return rank;
    }

    // ' hl' for a level of the selection (the stylesheet dims the others while there is one)
    private selectionClass(index: number): string {
        if (this.selection?.levels.has(index)) return ' hl';
        return '';
    }

    private draw(): void {
        const { options } = this;
        const layer = this.currentLayer;
        const selection = this.selection;

        const layerKey = `${layer}:${overlayOn.reach}`;
        if (this.drawnLayer !== layerKey) {
            this.drawnLayer = layerKey;
            this.drawLayer();
        }

        this.box.querySelectorAll<HTMLElement>('[data-ov]').forEach((button) => {
            setButtonPressed(button, overlayOn[overlayKindOf(button)]);
            button.classList.toggle('empty', this.reachEmpty);
        });

        this.homeCache = undefined;
        this.setHover(null);
        this.overlayGroup.classList.toggle('picked', !!selection);
        this.showMarks(layer);

        const levels = (options.markers || [])
            .filter((marker) => mapLayerOf(marker.z) === layer)
            .map((marker): StyledMarker => ({ marker, style: options.style(marker) }))
            .filter((level) => !level.style.gone);

        // a level filtered out is still drawn when it is the level the save is in or part of the selection
        const isDrawn = ({ marker, style }: StyledMarker): boolean => {
            if (!style.hidden || style.current) return true;
            return !!selection?.levels.has(marker.levelIndex);
        };

        const isRaised = (marker: MapMarker): boolean =>
            selection?.focus === marker.levelIndex || !!selection?.levels.has(marker.levelIndex);

        const drawnLevels = new Set(levels.filter(isDrawn).map((level) => level.marker.levelIndex));

        // the selection's levels are drawn again over the others (focus last); their places among the others only hide
        // the marker, so a selection moves no element. A level the list filter hides has no place among the others.
        const raisedLevels = levels
            .filter((level) => isDrawn(level) && isRaised(level.marker))
            .toSorted((first, second) => this.stackRank(first) - this.stackRank(second));
        const baseLevels = levels
            .filter((level) => !level.style.hidden || level.style.current)
            .toSorted((first, second) => (first.style.rank || 0) - (second.style.rank || 0));

        this.drawnMarkers = [];
        const baseRings: MarkAttributes[] = [];
        const baseIcons: MarkAttributes[] = [];

        for (const { marker, style } of baseLevels) {
            const hidden = isRaised(marker);
            if (!hidden) this.noteDrawn(marker);
            const parts = this.levelMarkAttributes(marker, style, hidden);
            baseRings.push(parts.ring);
            baseIcons.push(...parts.icons);
        }

        const raisedRings: MarkAttributes[] = [];
        const raisedIcons: MarkAttributes[] = [];

        for (const { marker, style } of raisedLevels) {
            this.noteDrawn(marker);
            const parts = this.levelMarkAttributes(marker, style, false);
            raisedRings.push(parts.ring);
            raisedIcons.push(...parts.icons);
        }

        const marks = this.shownMarks;
        const overlays = this.overlayMarkAttributes(drawnLevels);
        marks.overlayMarks.draw(overlays.discs);
        marks.overlayIcons.draw(overlays.icons);
        marks.linkLines.draw(this.linkAttributes());
        const towers = this.towerAttributes();
        marks.towerMarks.draw(towers.discs);
        marks.towerIcons.draw(towers.icons);
        marks.levelMarks.fit(baseRings);
        marks.levelIcons.fit(baseIcons);
        marks.raisedMarks.draw(raisedRings);
        marks.raisedIcons.draw(raisedIcons);

        this.drawHero();
        this.drawRing(levels.find((level) => level.style.current && isDrawn(level)));
        this.drawSteps();
        if (layer !== this.labelsLayer) this.drawLabels(layer);

        this.viewport.showCopies();
        this.hitList = null;
        this.layout();
    }

    // the area labels of a layer go on top (cullLabels makes their elements); they ignore the pointer, so markers under
    // them stay clickable
    private drawLabels(layer: string): void {
        this.labelsLayer = layer;
        this.labels = (this.options.labels || [])
            .filter((label) => mapLayerOf(label.z) === layer)
            .map((label): PlacedLabel => {
                const [x, y] = mapXY(label.x, label.y);
                return { text: label.text, x, y, width: label.text.length * 8.6 + 10 };
            });

        this.labelsGroup.replaceChildren();
        this.labelPool.clear();
        this.labelsOn = new Set();
    }

    // gates, signs, teleporters and treasures under everything else: a disc with the kind's rim, which carries the
    // tooltip and, for gates, signs and gold rooms (overlay.panel), the data attribute that makes it clickable, and the
    // icon on it. A gate on a level's entrance (overlay.merge) is left out while that level's marker is drawn, since
    // the marker shows it. The ones not drawn stay in their places, hidden.
    private overlayMarkAttributes(drawnLevels: Set<number>): { discs: MarkAttributes[]; icons: MarkAttributes[] } {
        const discs: MarkAttributes[] = [];
        const icons: MarkAttributes[] = [];

        for (const overlay of this.options.overlays || []) {
            if (overlay.layer !== this.currentLayer) continue;

            let hidden = false;
            const overlaySwitch = switchOf(overlay);
            if (overlaySwitch !== null && !overlayOn[overlaySwitch] && !this.isChosen(overlay)) hidden = true;
            if (!this.kept(overlay)) hidden = true;
            if (overlay.merge != null && drawnLevels.has(overlay.merge)) hidden = true;

            let dim = overlay.done;
            if (overlay.dimUntilDone) dim = !overlay.done;

            const [x, y] = mapXY(overlay.x, overlay.y);
            let classes = `k ovk o-${overlay.kind}`;
            if (dim) classes += ' dn';
            if (overlay.accent) classes += ' ' + overlay.accent;
            if (this.isChosen(overlay)) classes += ' chosen';

            const position = placedAt(x, y);
            const disc: MarkAttributes = {
                class: classes,
                d: discPath(DISC_RADIUS),
                style: position,
                'data-tip': overlay.tip,
            };
            if (overlay.panel) {
                const [panelKind, panelId] = overlay.panel;
                disc[PANEL_ATTRIBUTES[panelKind]] = panelId;
            }

            let iconClasses = 'k mi';
            if (dim) iconClasses += ' dn';
            iconClasses += this.overFog(overlay.x, overlay.y);
            discs.push(hiddenWhen(hidden, disc));
            icons.push(
                hiddenWhen(hidden, {
                    class: iconClasses,
                    ...iconAttributes(ICON_URLS[overlay.icon], iconRadiusOn(DISC_RADIUS), position),
                }),
            );
        }

        return { discs, icons };
    }

    // a marker's [x, y, z], or undefined for a level marker that is not drawn
    private endPoint(end: LinkEnd): MapPoint | undefined {
        if (isPosition(end)) return { x: end[0], y: end[1], z: end[2] };
        return this.options.markers[end];
    }

    // lines from the selected level to the levels it requires (solid) and the ones it unlocks (dashed), on this layer,
    // under the towers and markers; placeLinks sets their ends for the current zoom
    private linkAttributes(): MarkAttributes[] {
        const layer = this.currentLayer;
        const [width, height] = PROG.map.size;
        const isGone = (end: LinkEnd): boolean =>
            !isPosition(end) && this.options.style(this.options.markers[end]).gone;
        const list: MarkAttributes[] = [];
        this.linkEnds = [];
        this.linkReach = 0;

        for (const [from, to, kind] of this.selection?.links || []) {
            const start = this.endPoint(from);
            const finish = this.endPoint(to);
            if (!start || !finish || mapLayerOf(start.z) !== layer || mapLayerOf(finish.z) !== layer) continue;
            if (isGone(from) || isGone(to)) continue;

            // a dark halo under each line keeps it readable on any terrain
            list.push({ class: 'link halo' }, { class: `link ${kind}` });

            // the far end is placed in the copy of the map nearest the near end, so a line over the seam runs the short
            // way
            const [x1, y1] = mapXY(start.x, start.y);
            const [x2, y2] = mapXY(finish.x, finish.y);
            const farX = x1 + wrapDelta(x2 - x1, width);
            const farY = y1 + wrapDelta(y2 - y1, height);
            this.linkEnds.push([x1, y1, this.endRadius(from), farX, farY, this.endRadius(to)]);
            this.linkReach = Math.max(this.linkReach, -farX, farX - width, -farY, farY - height);
        }

        return list;
    }

    // the towers: a diamond, or for a tower with a pad the pad's disc with its icon (a pad not discovered is dimmed)
    private towerAttributes(): { discs: MarkAttributes[]; icons: MarkAttributes[] } {
        const discs: MarkAttributes[] = [];
        const icons: MarkAttributes[] = [];

        for (const tower of this.options.towers || []) {
            if (mapLayerOf(tower.z) !== this.currentLayer) continue;

            const [x, y] = mapXY(tower.x, tower.y);
            const position = placedAt(x, y);
            const selected = this.selection?.tower === tower.towerIndex;
            let classes = 'tw';
            if (tower.activated && !tower.onPad) classes += ' on';
            if (selected) classes += ' hl';
            classes += this.overFog(tower.x, tower.y);

            let iconClasses = 'k mi';
            if (selected) iconClasses += ' hl';
            let path = TOWER_DIAMOND;
            if (tower.onPad) {
                classes += ' ovk o-towerPads';
                if (!tower.padFound) {
                    classes += ' dn';
                    iconClasses += ' dn';
                }

                path = discPath(DISC_RADIUS);
            }

            const disc: MarkAttributes = {
                class: `k ${classes}`,
                d: path,
                style: position,
                'data-tw': tower.towerIndex,
                'data-tip': tower.tip,
            };
            const hidden = tower.onPad && !overlayOn.towerPads;
            discs.push(hiddenWhen(hidden, disc));

            const iconHidden = hidden || !tower.onPad;
            icons.push(
                hiddenWhen(iconHidden, {
                    class: iconClasses,
                    ...iconAttributes(ICON_URLS['tower-pad'], iconRadiusOn(DISC_RADIUS), position),
                }),
            );
        }

        return { discs, icons };
    }

    // the marks of a level: the ring that takes the pointer and shows the selection, then the icons in paint order (the
    // entry pad, the closed Freezer on its entrance if it has one, the role badge at the lower edge if it has a role). A
    // level that is not drawn keeps its marks, hidden.
    private levelMarkAttributes(marker: MapMarker, style: MarkerStyle, hidden: boolean): LevelParts {
        const selection = this.selection;
        const [x, y] = mapXY(marker.x, marker.y);
        const focused = selection?.focus === marker.levelIndex;
        const radius = levelMarkerRadius(style, focused);
        const position = placedAt(x, y);
        let classes = this.selectionClass(marker.levelIndex);
        if (selection?.frontier?.has(marker.levelIndex)) classes += ' fr';
        if (marker.ice && selection?.overlays?.has(marker.ice.id)) classes += ' chosen';
        const fogClass = this.overFog(marker.x, marker.y);
        classes += fogClass;

        const ring = hiddenWhen(hidden, {
            class: `lv k${classes}`,
            d: discPath(radius),
            style: position,
            'data-i': marker.levelIndex,
        });

        let iconClasses = 'k mi lvi';
        if (selection?.levels.has(marker.levelIndex)) iconClasses += ' sel';
        iconClasses += fogClass;

        let padClasses = iconClasses;
        if (style.blocked) padClasses += ' dim';
        const iconRadius = iconRadiusOn(radius);
        const pad = hiddenWhen(hidden, {
            class: padClasses,
            ...iconAttributes(ICON_URLS[style.pad], iconRadius, position),
        });

        const icons = [pad];
        if (marker.ice && !marker.ice.open) {
            let cageIcon: IconName = 'ice-cage';
            let iceOn = overlayOn.pods;
            if (marker.ice.doorway) {
                cageIcon = 'ice-gate';
                iceOn = overlayOn.doorways;
            }

            const cage = hiddenWhen(hidden || !iceOn, {
                class: `${iconClasses} cage`,
                ...iconAttributes(ICON_URLS[cageIcon], iconRadius, position),
            });
            icons.push(cage);
        }

        if (style.role) {
            const badgeRadius = 4;
            // the stylesheet grows the badge about its centre while the map is zoomed out, so it stays readable
            const badgeTop = radius - 2 * badgeRadius + 1;
            const badgeCentre = badgeTop + badgeRadius;
            const badge = hiddenWhen(hidden, {
                class: `${iconClasses} rb`,
                ...iconAttributes(ROLE_BADGE_URLS[style.role], badgeRadius, `${position};--cy:${badgeCentre}px`),
                y: badgeTop,
            });
            icons.push(badge);
        }

        return { ring, icons };
    }

    // a drawn level marker, for the tooltip of overlapping ones
    private noteDrawn(marker: MapMarker): void {
        const [x, y] = mapXY(marker.x, marker.y);
        this.drawnMarkers.push({ x, y, levelIndex: marker.levelIndex });
    }

    private drawHero(): void {
        const marks = this.shownMarks;
        const hero = this.options.hero;
        if (!hero || mapLayerOf(hero.z) !== this.currentLayer) {
            marks.heroMark.hide();
            return;
        }

        const [x, y] = mapXY(hero.x, hero.y);
        const attributes = iconAttributes(ICON_URLS['hero'], DISC_RADIUS, placedAt(x, y));
        marks.heroMark.set({ class: 'k mi hero', ...attributes });
    }

    // the ring round the drawn level the save is in, undefined when there is none
    private drawRing(current: StyledMarker | undefined): void {
        const marks = this.shownMarks;
        if (!current) {
            marks.ringMark.hide();
            return;
        }

        const { marker, style } = current;
        const [x, y] = mapXY(marker.x, marker.y);
        const focused = this.selection?.focus === marker.levelIndex;
        const radius = levelMarkerRadius(style, focused) + 3;
        marks.ringMark.set({ class: 'k cur', d: discPath(radius), style: placedAt(x, y) });
    }

    // the steps of the unlock chain are numbered on top of the markers
    private drawSteps(): void {
        const stepMarks = this.shownMarks.stepMarks;
        let count = 0;

        for (const [end, stepNumber] of this.selection?.steps || []) {
            const point = this.endPoint(end);
            if (!point || mapLayerOf(point.z) !== this.currentLayer) continue;
            if (!isPosition(end) && this.options.style(this.options.markers[end]).gone) continue;

            const [x, y] = mapXY(point.x, point.y);
            const badge = stepMarks.at(count);
            count++;
            badge.set({ class: 'bd', style: placedAt(x, y) });

            const label = badge.element.lastElementChild;
            if (label && label.textContent !== String(stepNumber)) label.textContent = String(stepNumber);
        }

        stepMarks.hideFrom(count);
    }

    // whether the map can show a layer: the fog has uncovered it
    private canShow(layer: string): boolean {
        return !this.known || this.known.includes(layer);
    }

    // switches the layer (not to one the fog has not uncovered); onLayer lets the lists follow
    private showLayer(layer: string): void {
        this.currentLayer = layer;
        this.keep.layer = layer;
        this.draw();
        this.options.onLayer?.(layer);
    }

    private wireControls(): void {
        const { box, options } = this;
        box.querySelectorAll<HTMLElement>('[data-z]').forEach((button) =>
            button.addEventListener('click', () => this.viewport.zoom(Number(button.dataset.z))),
        );

        box.querySelectorAll<HTMLElement>('[data-role=layers] button').forEach((button) =>
            button.addEventListener('click', () => this.switchLayerWhenDecoded(button.dataset.layer ?? '')),
        );
        find(box, '[data-role=ovl]', HTMLElement).hidden = !options.reach;
        box.querySelectorAll<HTMLElement>('[data-ov]').forEach((button) => {
            const kind = overlayKindOf(button);
            button.hidden = kind === 'reach' && !options.reach;
            button.addEventListener('click', () => this.setOverlay(kind, !overlayOn[kind]));
        });
    }

    // the marker under the pointer is highlighted by a class, which the copies of the map follow (:hover does not reach
    // them)
    private setHover(element: Element | null): void {
        if (element === this.hover) return;

        this.hover?.classList.remove('hv');
        this.hover = element;
        this.hover?.classList.add('hv');
    }

    // the tooltips of the drawn markers that overlap under the cursor, up to eight
    private nearTips(event: MouseEvent, html: string): string {
        const point = this.viewport.toWorld(event);
        const [width, height] = PROG.map.size;
        const reach = DISC_RADIUS * markScale(this.viewport.scale().scale);
        const near = this.drawnMarkers.filter((marker) => {
            const dx = wrapDelta(marker.x - point.x, width);
            const dy = wrapDelta(marker.y - point.y, height);
            return Math.hypot(dx, dy) <= reach;
        });

        if (near.length <= 1) return html;

        let tips = near
            .slice(0, 8)
            .map((marker) => this.options.markers[marker.levelIndex].tip)
            .join('<hr>');
        if (near.length > 8) tips += `<hr><span class="muted">${near.length - 8} more</span>`;
        return tips;
    }

    private showTip(event: MouseEvent): void {
        const { svg, tip } = this;
        if (svg.classList.contains('drag')) {
            this.setHover(null);
            return;
        }

        const target = this.pick(event)?.closest<SVGElement>('[data-tip],[data-i]');
        if (target?.matches('.lv')) this.setHover(target);
        else this.setHover(null);
        if (!target) {
            tip.style.display = 'none';
            return;
        }

        const boxRect = this.box.getBoundingClientRect();
        let html = target.dataset.tip ?? '';

        // a level's tooltip is made when it is shown; markers that overlap under the cursor are listed together
        const markerIndex = target.dataset.i;
        if (markerIndex !== undefined) html = this.nearTips(event, this.options.markers[Number(markerIndex)].tip);
        if (html !== this.tipHtml) {
            this.tipHtml = html;
            tip.innerHTML = html;
        }

        tip.style.display = 'block';

        const cursorX = event.clientX - boxRect.left;
        const cursorY = event.clientY - boxRect.top;
        const tipHeight = tip.offsetHeight;
        tip.style.left = Math.max(8, Math.min(boxRect.width - tip.offsetWidth - 8, cursorX + 14)) + 'px';
        let top = cursorY + 14;
        if (top + tipHeight > boxRect.height - 8) top = Math.max(8, cursorY - 10 - tipHeight);
        tip.style.top = top + 'px';
    }

    // an empty click closes the panel at once (a double-click then zooms with it closed)
    private clicked(event: MouseEvent): void {
        if (this.viewport.wasDragged || event.detail > 1) return;

        const target = this.pick(event);
        const tower = target?.closest<SVGElement>('[data-tw]');
        const level = target?.closest<SVGElement>('[data-i]');
        const gate = target?.closest<SVGElement>('[data-gate]');
        const sign = target?.closest<SVGElement>('[data-sign]');
        const gateTower = target?.closest<SVGElement>('[data-gtw]');
        if (tower && this.onTower) this.onTower(Number(tower.dataset.tw));
        else if (level && this.onPick) this.onPick(Number(level.dataset.i));
        else if (gate && this.onGate) this.onGate(Number(gate.dataset.gate));
        else if (sign && this.onSign) this.onSign(Number(sign.dataset.sign));
        else if (gateTower && this.onTower) this.onTower(Number(gateTower.dataset.gtw));
        else if (this.selection) this.select(null);
    }

    private wirePointer(): void {
        const { svg } = this;
        svg.addEventListener('mousemove', (event) => this.showTip(event));
        svg.addEventListener('mouseleave', () => {
            this.tip.style.display = 'none';
            this.setHover(null);
        });

        svg.addEventListener('click', (event) => this.clicked(event));
    }

    private settle(): void {
        if (this.sized) return;

        this.sized = true;
        this.waiting.splice(0).forEach((run) => run());
    }

    // frames the selection's points on the current layer: a level selection zooms in when the map is far out, so
    // neighbouring requirements and their lines separate
    private frameSelection(selection: MapSelection): void {
        const points = (selection.points || [])
            .filter((point) => mapLayerOf(point[2]) === this.currentLayer)
            .map((point) => mapXY(point[0], point[1]));
        if (!points.length) return;

        const box = boxOf(points);
        const { rect: viewRect, scale } = this.viewport.scale();
        const frame: Insets = { ...this.insets(), m: FRAME_MARGIN };
        if (selection.links && (selection.exact || viewRect.width * scale > MIN_BOX * 2.5)) {
            let min = MIN_BOX;
            if (selection.steps?.length && !selection.exact) min = MIN_CHAIN_BOX;
            this.viewport.fit(padBox(box, min), frame);
        } else {
            this.viewport.reveal(box, frame);
        }
    }

    redraw(): void {
        this.draw();
    }

    // switches an overlay toggle (remembered like a click)
    setOverlay(kind: OverlayKind, enabled: boolean): void {
        if (overlayOn[kind] === enabled) return;

        overlayOn[kind] = enabled;
        setPreference('mapOverlays', JSON.stringify(overlayOn));
        this.draw();
    }

    // closes the selection and frames the hero, on the hero's layer
    showHero(): void {
        const hero = this.options.hero;
        if (!hero) return;

        if (this.selection) this.select(null);
        this.fitPoints([[hero.x, hero.y, hero.z]]);
    }

    // the layer and view, to come back to with setView
    getView(): MapViewState {
        return {
            layer: this.currentLayer,
            vb: this.keep.vb && { ...this.keep.vb },
            moved: !!this.keep.moved,
        };
    }

    setView(view: MapViewState): void {
        if (view.layer !== this.currentLayer && this.canShow(view.layer)) this.showLayer(view.layer);

        this.afterLayerDecoded(() => {
            if (view.vb) this.viewport.goTo(view.vb, view.moved);
            else this.viewport.reset();
        });
    }

    // a click on the layer toggle switches once the layer's full image is decoded, so that the blocky thumbnail is never
    // shown at close zoom; the toggle looks busy meanwhile
    private switchLayerWhenDecoded(layer: string): void {
        if (layer === this.currentLayer || !this.canShow(layer)) return;

        const toggle = find(this.box, '[data-role=layers]', HTMLElement);
        if (this.terrain.isDecoded(layer)) {
            this.pendingLayer = '';
            toggle.classList.remove('busy');
            this.setLayer(layer);
            return;
        }

        this.pendingLayer = layer;
        toggle.classList.add('busy');
        void this.terrain.decoded(layer).then(() => {
            if (this.pendingLayer !== layer) return;

            this.pendingLayer = '';
            toggle.classList.remove('busy');
            this.setLayer(layer);
        });
    }

    setLayer(layer: string): void {
        if (layer === this.currentLayer || !this.canShow(layer)) return;

        this.currentLayer = layer;
        this.keep.layer = layer;
        this.draw();
        this.viewport.resize();
        this.options.onLayer?.(layer);
    }

    get busy(): boolean {
        return this.box.isConnected && this.viewport.busy;
    }

    // runs run() once the box has been laid out (its first resize), at once when it has
    ready(run: () => void): void {
        if (this.sized) {
            run();
            return;
        }

        this.waiting.push(run);
    }

    get layer(): string {
        return this.currentLayer;
    }

    get layers(): string[] {
        return AREA_LAYERS.filter((key) => PROG.map.layers.some((layer) => layer.key === key) && this.canShow(key));
    }

    reset(): void {
        if (this.box.isConnected) this.viewport.reset();
    }

    get open(): boolean {
        return !!this.selection && this.box.isConnected;
    }

    // selects a level, tower or overlay and frames it, or clears the selection with null
    select(selection: MapSelection | null, how: SelectHow = {}): void {
        const { panel, options } = this;
        const focused = document.activeElement;
        const inPanel = panel.contains(focused);

        // the level in a selected Freezer is selected with it
        if (selection) {
            const holdsChosenIce = (marker: MapMarker): boolean =>
                marker.ice !== undefined && !!selection.overlays?.has(marker.ice.id);
            const iceLevels = (options.markers || []).filter(holdsChosenIce).map((marker) => marker.levelIndex);
            this.selection = { ...selection, levels: new Set([...selection.levels, ...iceLevels]) };
        } else {
            this.selection = null;
        }

        panel.innerHTML = selection?.html || '';
        panel.hidden = !selection?.html;

        // a level on a layer the fog has not uncovered keeps the current layer
        const before = this.currentLayer;
        if (selection?.z != null && !how.still && this.canShow(mapLayerOf(selection.z))) {
            this.currentLayer = mapLayerOf(selection.z);
            this.keep.layer = this.currentLayer;
        }

        this.draw();
        if (this.currentLayer !== before) options.onLayer?.(this.currentLayer);

        panel.querySelector('[data-close]')?.addEventListener('click', () => this.select(null));
        if (selection && !how.still && !how.keepFocus) {
            if (!inPanel && focused !== document.body) this.opener = focusableOf(focused);
            panel.querySelector<HTMLElement>('.hd b')?.focus({ preventScroll: true });
        }

        if (!selection) {
            options.onClose?.();
            if (this.opener?.isConnected && (inPanel || document.activeElement === document.body)) {
                this.opener.focus({ preventScroll: true });
            }

            this.opener = null;
        } else {
            options.onOpen?.();
        }

        if (selection && !how.still) this.afterLayerDecoded(() => this.frameSelection(selection));
    }

    // centres the map on the world point (x, y) of a layer key, first moving to that layer
    frameAt(layer: string, x: number, y: number): void {
        if (!this.canShow(layer)) return;
        if (layer !== this.currentLayer) this.showLayer(layer);

        const point = mapXY(x, y);
        this.afterLayerDecoded(() => {
            this.viewport.fit(padBox(boxOf([point])), { ...this.insets(), m: FRAME_MARGIN });
        });
    }

    // zooms to world points [x, y, z], first moving to their layer when none is on the current one
    fitPoints(points: Position[]): void {
        if (!points.length) return;

        if (!points.some((point) => mapLayerOf(point[2]) === this.currentLayer)) {
            const layer = mapLayerOf(points[0][2]);
            if (!this.canShow(layer)) return;

            this.showLayer(layer);
        }

        const onLayer = points
            .filter((point) => mapLayerOf(point[2]) === this.currentLayer)
            .map((point) => mapXY(point[0], point[1]));
        this.afterLayerDecoded(() => {
            this.viewport.fit(padBox(boxOf(onLayer)), { ...this.insets(), m: FRAME_MARGIN });
        });
    }
}

export function mapInit(id: string, options: MapOptions): MapView {
    const map = new MapView(id, options);
    activeMap = map;
    return map;
}
