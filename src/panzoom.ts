// Pan and zoom of an svg map by its viewBox. The map is a torus (world.md "Wrapping"): its content repeats in every direction, the view's
// centre is kept inside one copy of it, and the elements use[data-kx][data-ky] (copies shifted by that many content
// widths and heights) are shown where the view reaches them.
import { PROG } from './data.ts';
import type { XY } from './types.ts';

/** A rectangle of map positions: its corner and size. */
export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Pixels covered by overlaid controls on each side of the map, and the margin to leave around a box. */
export interface Insets {
    top?: number;
    right?: number;
    bottom?: number;
    m?: number;
}

/** What survives a redraw of one map: its view, and whether it was panned or zoomed by hand. */
export interface PanZoomKeep {
    vb?: Box;
    moved?: boolean;
}

/**
 * insets(): the pixels covered by overlaid controls. home(): the box of the reset view (Escape; else the cap box).
 * cap(): the cap box (default: the whole content). onView(view): after every view change, with the view as view() gives
 * it. onIdle(): when a drag, pinch or eased zoom ends. scaled: the elements whose --px follows the zoom (default: the
 * svg). onPixelScale(scale, closest): after --px is set to the squares per pixel `scale`; `closest` is that value at the
 * closest zoom.
 */
export interface PanZoomOptions {
    insets?: () => Insets;
    home?: () => Box | null;
    cap?: () => Box | null;
    onView?: (view: ViewCorner | null) => void;
    onIdle?: () => void;
    scaled?: ElementCSSInlineStyle[];
    onPixelScale?: (scale: number, closest: number) => void;
}

/** The svg's box on the page and the squares per pixel of the view. */
export interface ViewScale {
    rect: DOMRect;
    scale: number;
}

/** A world point, with the shift of the content copies at the time it was taken. */
export interface WorldPoint {
    x: number;
    y: number;
    shiftX: number;
    shiftY: number;
}

/** The view's top-left corner in world coordinates, with its scale and the svg's box. */
export interface ViewCorner extends ViewScale {
    x0: number;
    y0: number;
}

export interface PanZoom {
    scale: () => ViewScale;
    toWorld: (event: MouseEvent) => WorldPoint;
    /** A drag, pinch or eased zoom is running. */
    readonly busy: boolean;
    /** A drag or pinch has moved the map and the pointer is still down. */
    readonly dragging: boolean;
    /** Whether the pointer gesture that is running or ended last moved the map. */
    readonly wasDragged: boolean;
    /** The world coordinates of the view's top-left corner and squares per pixel; null while the svg has no size. */
    view: () => ViewCorner | null;
    reset: () => void;
    /** Eases to a view that the map kept (a viewBox); moved: whether it was panned or zoomed by hand. */
    goTo: (box: Box, wasMoved: boolean | undefined) => void;
    /** A view nobody panned or zoomed follows the box size and the overlay insets. */
    resize: () => void;
    zoom: (factor: number) => void;
    /** Brings the box into the free area: pans when it fits at the current zoom, zooms out when it does not. */
    fit: (box: Box, insets?: Insets) => void;
    reveal: (box: Box, insets: Insets) => void;
    /** Whether the box fits the free area at the current zoom. */
    fits: (box: Box, insets: Insets) => boolean;
}

/** A zoom that eases towards `width` with `point` held under the client position. */
interface ZoomTarget {
    width: number;
    point: WorldPoint;
    capCentre: WorldPoint;
    clientX: number;
    clientY: number;
    time: number;
}

interface Point {
    x: number;
    y: number;
}

interface Drag {
    pointerId: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
}

interface Pinch {
    distance: number;
    width: number;
    point: WorldPoint;
    capCentre: WorldPoint;
    clampWidth: (width: number) => number;
}

/** What a wheel event is: a mouse wheel step, a trackpad pinch or a trackpad scroll. */
type WheelKind = 'wheel' | 'pinch' | 'pan';

// the closest zoom shows one game screen (the fog grid's cell, 19 x 13 squares), whichever side binds
const minView = (): XY => PROG.fog?.grid.screen || [19, 13];

// the squares per pixel at the closest zoom, in an svg of this size
function closestScale(svgRect: DOMRect): number {
    const [minWidth, minHeight] = minView();
    const widthScale = svgRect.width > 0 ? minWidth / svgRect.width : 0;
    const heightScale = svgRect.height > 0 ? minHeight / svgRect.height : 0;
    return Math.max(widthScale, heightScale);
}

export const ZOOM_STEP = 1.5;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// the whole number of lengths n nearest the offset d (half a length rounds up): the shift to the copy nearest a point d away
const nearestCopy = (offset: number, length: number): number => Math.round(offset / length) * length;

/**
 * The client rect of an element, measured once and kept until its box can change: a window resize, a scroll of the
 * element's page or of an ancestor, or a resize of the element or its container. A scroll of any other element (a list
 * beside the map) leaves it, so reading it after style writes does not force a style recalc.
 */
export class RectCache {
    private rect: DOMRect | null = null;
    private readonly element: Element;
    private readonly observer: ResizeObserver;

    constructor(element: Element) {
        this.element = element;
        addEventListener('scroll', this.onScroll, { capture: true, passive: true });
        addEventListener('resize', this.onResize);

        this.observer = new ResizeObserver(this.invalidate);
        this.observer.observe(element);
        if (element.parentElement) this.observer.observe(element.parentElement);
    }

    /** The element's rect; an empty one is measured again, as the element may not have been laid out. */
    get(): DOMRect {
        if (!this.rect || !(this.rect.width > 0)) this.rect = this.element.getBoundingClientRect();
        return this.rect;
    }

    /** Forgets the rect; the next get measures. */
    readonly invalidate = (): void => {
        this.rect = null;
    };

    /** Measures now, where style is clean, so a later get does not force a recalc. */
    refresh(): void {
        this.rect = this.element.getBoundingClientRect();
    }

    // whether the element is on the page; the listeners of one that left stop with their next event
    private attached(): boolean {
        if (this.element.isConnected) return true;

        removeEventListener('scroll', this.onScroll, { capture: true });
        removeEventListener('resize', this.onResize);
        this.observer.disconnect();
        return false;
    }

    private readonly onScroll = (event: Event): void => {
        if (!this.attached()) return;

        const target = event.target;
        if (target instanceof Node && target.contains(this.element)) this.invalidate();
    };

    private readonly onResize = (): void => {
        if (this.attached()) this.invalidate();
    };
}

// how long the view's scale must hold still before the markers are restyled to it
const PIXEL_SCALE_SETTLE_MS = 120;

// what a wheel event is (see the wheel handling in panZoom): 'wheel', 'pinch' or 'pan'; lastPan is the time of the last
// trackpad scroll
function classifyWheel(event: WheelEvent, lastPan: number): WheelKind {
    if (event.deltaMode !== 0) return 'wheel';
    if (event.deltaX === 0 && Math.abs(event.deltaY) >= 40) {
        if (event.timeStamp - lastPan < 80) return 'pan';
        return 'wheel';
    }

    if (event.ctrlKey) return 'pinch';
    return 'pan';
}

// whether an element can still scroll the way a wheel event turns (a panel the wheel acts on instead of the map)
function canScroll(element: Element, event: WheelEvent): boolean {
    let scrollSize: number;
    let clientSize: number;
    let position: number;
    let overflow: string;
    let delta: number;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        scrollSize = element.scrollWidth;
        clientSize = element.clientWidth;
        position = element.scrollLeft;
        overflow = getComputedStyle(element).overflowX;
        delta = event.deltaX;
    } else {
        scrollSize = element.scrollHeight;
        clientSize = element.clientHeight;
        position = element.scrollTop;
        overflow = getComputedStyle(element).overflowY;
        delta = event.deltaY;
    }

    if (!(scrollSize > clientSize + 1)) return false;
    if (!/auto|scroll/.test(overflow)) return false;
    if (delta < 0) return position > 0;
    return position + clientSize < scrollSize - 1;
}

const MARKER_SELECTOR = '[data-i],[data-tw],[data-gate],[data-sign],[data-gtw]';

export function panZoom(svg: SVGSVGElement, keep?: PanZoomKeep, options: PanZoomOptions = {}): PanZoom {
    const base = svg.viewBox.baseVal;
    const content: Box = { x: base.x, y: base.y, w: base.width, h: base.height };
    const scaled = options.scaled || [svg];

    const keptView = keep?.vb;
    let viewBox: Box = keptView ? { ...keptView } : { ...content };
    let panFrame = 0;
    let moved = !!keptView;
    let zoomTarget: ZoomTarget | null = null;
    let zoomFrame = 0;
    let pixelScale = 0;
    const clientRect = new RectCache(svg);
    let pixelTimer: ReturnType<typeof setTimeout> | undefined;
    let wasDragged = false;

    // the content shifts by whole widths and heights when the view's centre is moved back into the first copy, so a
    // world point kept across a gesture is corrected by the shift made since it was taken
    const shift = { x: 0, y: 0 };
    const copies = [...svg.querySelectorAll<SVGUseElement>('use[data-kx][data-ky]')].map((element) => ({
        element,
        group: element.dataset.group ?? '',
        kx: Number(element.dataset.kx),
        ky: Number(element.dataset.ky),
        shown: element.style.display !== 'none',
    }));

    // whether the view was panned or zoomed by hand, kept with the view
    const setMoved = (value: boolean | undefined): void => {
        moved = !!value;
        if (keep) keep.moved = value;
    };

    const touch = (): void => setMoved(true);

    const scale = (): ViewScale => {
        const svgRect = clientRect.get();
        return { rect: svgRect, scale: Math.max(viewBox.w / svgRect.width, viewBox.h / svgRect.height) };
    };

    // the world point at the svg's top-left corner: the view is letterboxed inside the svg's box at `scale` per pixel
    const corner = (svgRect: DOMRect, viewScale: number): Point => ({
        x: viewBox.x - (svgRect.width * viewScale - viewBox.w) / 2,
        y: viewBox.y - (svgRect.height * viewScale - viewBox.h) / 2,
    });

    // A copy is shown when the view reaches it. The browser paints and layers a shown copy whole, even where it lies
    // outside the view.
    const showCopies = ({ rect: svgRect, scale: viewScale }: ViewScale, topLeft: Point): void => {
        const right = topLeft.x + svgRect.width * viewScale;
        const bottom = topLeft.y + svgRect.height * viewScale;

        for (const copy of copies) {
            const copyX = content.x + copy.kx * content.w;
            const copyY = content.y + copy.ky * content.h;
            const shown =
                copyX < right && copyX + content.w > topLeft.x && copyY < bottom && copyY + content.h > topLeft.y;
            if (shown !== copy.shown) {
                copy.shown = shown;
                if (shown) {
                    copy.element.setAttribute('href', copy.group);
                    copy.element.style.display = '';
                } else {
                    // a hidden use still keeps a clone of its group up to date, so it drops the reference
                    copy.element.removeAttribute('href');
                    copy.element.style.display = 'none';
                }
            }
        }
    };

    const cornerView = ({ rect: svgRect, scale: viewScale }: ViewScale, topLeft: Point): ViewCorner | null => {
        if (!(viewScale > 0 && isFinite(viewScale))) return null;

        return { x0: topLeft.x, y0: topLeft.y, scale: viewScale, rect: svgRect };
    };

    const currentView = (): ViewCorner | null => {
        const view = scale();
        return cornerView(view, corner(view.rect, view.scale));
    };

    const applyView = (): void => {
        if (!(viewBox.w > 0 && viewBox.h > 0)) return;

        const copyShiftX = Math.floor((viewBox.x + viewBox.w / 2 - content.x) / content.w) * content.w;
        const copyShiftY = Math.floor((viewBox.y + viewBox.h / 2 - content.y) / content.h) * content.h;
        viewBox.x -= copyShiftX;
        viewBox.y -= copyShiftY;
        shift.x -= copyShiftX;
        shift.y -= copyShiftY;

        const view = scale();
        const topLeft = corner(view.rect, view.scale);
        showCopies(view, topLeft);

        const viewScale = view.scale;
        svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
        if (keep) keep.vb = { ...viewBox };

        // markers follow the zoom through --px; a change under 2% is not worth restyling them. A custom property
        // restyles every element under the one it is set on, so it goes on the groups that use it, not the whole svg.
        // The first value is set at once; later ones wait until the scale holds still, as every step of a zoom would
        // restyle every marker and the viewBox already scales them meanwhile.
        if (viewScale > 0 && isFinite(viewScale) && !(Math.abs(viewScale - pixelScale) <= pixelScale * 0.02)) {
            if (pixelScale === 0) {
                applyPixelScale(viewScale);
            } else {
                clearTimeout(pixelTimer);
                pixelTimer = setTimeout(settlePixelScale, PIXEL_SCALE_SETTLE_MS);
            }
        }
        options.onView?.(cornerView(view, topLeft));
    };

    const applyPixelScale = (viewScale: number): void => {
        pixelScale = viewScale;
        for (const element of scaled) element.style.setProperty('--px', String(viewScale));
        options.onPixelScale?.(viewScale, closestScale(clientRect.get()));
    };

    const settlePixelScale = (): void => {
        const viewScale = scale().scale;
        if (viewScale > 0 && isFinite(viewScale)) applyPixelScale(viewScale);
    };

    // cancels the eased pan and the eased zoom
    const stop = (): void => {
        cancelAnimationFrame(panFrame);
        cancelAnimationFrame(zoomFrame);
        zoomTarget = null;
    };

    // view that puts the box in the middle of the area left free by the pixel insets (top, right, bottom and the margin
    // m); fixedScale keeps the zoom
    const place = (box: Box, insets: Insets = {}, fixedScale?: number): Box => {
        const svgRect = clientRect.get();
        const top = insets.top || 0;
        const margin = insets.m || 0;
        const freeWidth = Math.max(40, svgRect.width - (insets.right || 0) - 2 * margin);
        const freeHeight = Math.max(40, svgRect.height - top - (insets.bottom || 0) - 2 * margin);
        const viewScale = Math.max(
            fixedScale || Math.max(box.w / freeWidth, box.h / freeHeight),
            closestScale(svgRect),
        );
        return {
            x: box.x + box.w / 2 - (margin + freeWidth / 2) * viewScale,
            y: box.y + box.h / 2 - (top + margin + freeHeight / 2) * viewScale,
            w: svgRect.width * viewScale,
            h: svgRect.height * viewScale,
        };
    };

    // the box the zoom-out cap fits on both axes and centres on
    const capBox = (): Box => options.cap?.() || content;
    const home = (): Box => {
        const insets = options.insets?.() || {};
        return place(options.home?.() || capBox(), { top: insets.top || 0, bottom: insets.bottom || 0 });
    };

    // the copy of a box (positioned in the first copy of the content) whose centre is nearest the view's centre
    const nearest = (box: Box): Box => ({
        ...box,
        x: box.x + nearestCopy(viewBox.x + viewBox.w / 2 - box.x - box.w / 2, content.w),
        y: box.y + nearestCopy(viewBox.y + viewBox.h / 2 - box.y - box.h / 2, content.h),
    });

    const fits = (box: Box, insets: Insets): boolean => {
        const { rect: svgRect, scale: viewScale } = scale();
        const margin = insets.m || 0;
        const fitsWide = box.w / viewScale <= svgRect.width - (insets.right || 0) - 2 * margin;
        const fitsTall = box.h / viewScale <= svgRect.height - (insets.top || 0) - (insets.bottom || 0) - 2 * margin;
        return fitsWide && fitsTall;
    };

    const animTo = (target: Box): void => {
        stop();
        if (!(target.w > 0 && target.h > 0)) return;

        if (document.hidden) {
            viewBox = { ...target };
            applyView();
            return;
        }

        const from = { ...viewBox };
        const startTime = performance.now();
        const step = (now: number): void => {
            const progress = Math.max(0, Math.min(1, (now - startTime) / 280));
            const eased = 1 - (1 - progress) ** 3;
            viewBox = {
                x: from.x + (target.x - from.x) * eased,
                y: from.y + (target.y - from.y) * eased,
                w: from.w + (target.w - from.w) * eased,
                h: from.h + (target.h - from.h) * eased,
            };
            applyView();
            if (progress < 1) panFrame = requestAnimationFrame(step);
        };

        panFrame = requestAnimationFrame(step);
    };

    if (!keptView) viewBox = home();
    applyView();

    // the world point under a client position, in the frame of the view as it is now
    const worldAt = (clientX: number, clientY: number): WorldPoint => {
        const { rect: svgRect, scale: viewScale } = scale();
        const topLeft = corner(svgRect, viewScale);
        return {
            x: topLeft.x + (clientX - svgRect.left) * viewScale,
            y: topLeft.y + (clientY - svgRect.top) * viewScale,
            shiftX: shift.x,
            shiftY: shift.y,
        };
    };

    // moves the view by client pixels
    const panBy = (deltaX: number, deltaY: number): void => {
        const viewScale = scale().scale;
        viewBox.x += deltaX * viewScale;
        viewBox.y += deltaY * viewScale;
        applyView();
    };

    // the widest view (keeping the aspect of the current one) that is the zoom-out cap: the cap box shows whole on both
    // axes, and along the axis with room to spare the neighbouring copies show
    const capWidth = (): number => {
        const svgRect = clientRect.get();
        const cap = capBox();
        if (!(svgRect.width > 0 && svgRect.height > 0)) return viewBox.w;

        const capScale = Math.max(cap.w / svgRect.width, cap.h / svgRect.height);
        const aspectScale = Math.max(1 / svgRect.width, viewBox.h / (viewBox.w * svgRect.height));
        return capScale / aspectScale;
    };

    // clamps a view width to those the view may take from here: never forced in or out from where it is, otherwise
    // between the closest zoom and the zoom-out cap
    const limits = (): ((width: number) => number) => {
        const [minWidth, minHeight] = minView();
        const lowest = Math.min(viewBox.w, Math.max(minWidth, (minHeight * viewBox.w) / viewBox.h));
        const highest = Math.max(viewBox.w, capWidth());
        return (width) => Math.min(highest, Math.max(lowest, width));
    };

    // the centre of the copy of the cap box nearest the view's centre. A zoom gesture keeps the copy it started with:
    // the copy nearest the moving view flips when the view crosses halfway between two copies.
    const capCentreAt = (): WorldPoint => {
        const cap = capBox();
        const capCentreX = cap.x + cap.w / 2;
        const capCentreY = cap.y + cap.h / 2;
        const viewCentreX = viewBox.x + viewBox.w / 2;
        const viewCentreY = viewBox.y + viewBox.h / 2;
        return {
            x: capCentreX + nearestCopy(viewCentreX - capCentreX, content.w),
            y: capCentreY + nearestCopy(viewCentreY - capCentreY, content.h),
            shiftX: shift.x,
            shiftY: shift.y,
        };
    };

    // sizes the view to `width` (keeping its aspect) with the world point (from worldAt) under the client position;
    // false while the svg has no size
    const anchor = (
        width: number,
        point: WorldPoint,
        capCentre: WorldPoint,
        clientX: number,
        clientY: number,
    ): boolean => {
        const svgRect = clientRect.get();
        if (!(svgRect.width > 0 && svgRect.height > 0)) return false;

        const height = (width * viewBox.h) / viewBox.w;
        const viewScale = Math.max(width / svgRect.width, height / svgRect.height);
        const cap = capWidth();
        const zoomingOut = width > viewBox.w;
        viewBox = {
            x:
                point.x +
                shift.x -
                point.shiftX -
                (clientX - svgRect.left) * viewScale +
                (svgRect.width * viewScale - width) / 2,
            y:
                point.y +
                shift.y -
                point.shiftY -
                (clientY - svgRect.top) * viewScale +
                (svgRect.height * viewScale - height) / 2,
            w: width,
            h: height,
        };

        // zooming out over the last quarter of the way to the cap draws the view's centre to the cap box's, so the cap
        // shows the whole box centred
        if (zoomingOut && width > cap * 0.75) {
            const pull = Math.min(1, (width - cap * 0.75) / (cap * 0.25));
            const capCentreX = capCentre.x + shift.x - capCentre.shiftX;
            const capCentreY = capCentre.y + shift.y - capCentre.shiftY;
            const viewCentreX = viewBox.x + width / 2;
            const viewCentreY = viewBox.y + height / 2;
            viewBox.x += pull * (capCentreX - viewCentreX);
            viewBox.y += pull * (capCentreY - viewCentreY);
        }

        applyView();
        return true;
    };

    const zoomNow = (clientX: number, clientY: number, factor: number): void => {
        stop();
        touch();
        anchor(limits()(viewBox.w * factor), worldAt(clientX, clientY), capCentreAt(), clientX, clientY);
    };

    // zoom steps accumulate into a target width; the view eases towards it with the anchored point held under the client position
    const zoomBy = (clientX: number, clientY: number, factor: number): void => {
        if (document.hidden || reducedMotion.matches) {
            zoomNow(clientX, clientY, factor);
            return;
        }

        cancelAnimationFrame(panFrame);
        touch();

        const previous = zoomTarget;
        const startWidth = previous ? previous.width : viewBox.w;
        zoomTarget = {
            width: limits()(startWidth * factor),
            point: worldAt(clientX, clientY),
            capCentre: previous ? previous.capCentre : capCentreAt(),
            clientX,
            clientY,
            time: previous ? previous.time : performance.now(),
        };
        if (!previous) zoomFrame = requestAnimationFrame(zoomStep);
    };

    const zoomStep = (now: number): void => {
        const target = zoomTarget;
        if (!target) return;

        const elapsed = Math.min(100, Math.max(0, now - target.time));
        target.time = now;

        let width = viewBox.w + (target.width - viewBox.w) * (1 - Math.exp(-elapsed / 50));
        const done = Math.abs(target.width - width) < target.width * 0.004;
        if (done) width = target.width;

        if (!anchor(width, target.point, target.capCentre, target.clientX, target.clientY) || done) {
            zoomTarget = null;
            options.onIdle?.();
        } else {
            zoomFrame = requestAnimationFrame(zoomStep);
        }
    };

    // Wheel devices are told apart by what they send. A ctrlKey wheel with small deltas is a trackpad pinch (zooms 1:1, gently).
    // Pixel deltas that are small or horizontal are a trackpad scroll (pans 1:1). Line or page deltas, and vertical steps of
    // 40+ pixels (fractional at a browser zoom other than 100%), are a mouse wheel (zooms, eased); such steps within 80 ms
    // of a trackpad scroll belong to its momentum.
    let lastPan = -1e9;
    const wheelKind = (event: WheelEvent): WheelKind => {
        const kind = classifyWheel(event, lastPan);
        if (kind === 'pan') lastPan = event.timeStamp;
        return kind;
    };

    // the wheel acts anywhere over the map box, except inside a panel that can still scroll that way itself
    const mapBox = svg.parentElement!;
    mapBox.addEventListener(
        'wheel',
        (event) => {
            const kind = wheelKind(event);
            if (kind !== 'pinch') {
                let element = event.target instanceof Element ? event.target : null;
                while (element && element !== mapBox) {
                    if (canScroll(element, event)) return;
                    if (element.classList.contains('sel') && getComputedStyle(element).position === 'static') return;

                    element = element.parentElement;
                }
            }

            event.preventDefault();

            if (kind === 'pinch') {
                const pinchDelta = Math.max(-25, Math.min(25, event.deltaY));
                zoomNow(event.clientX, event.clientY, Math.exp(pinchDelta * 0.01));
            } else if (kind === 'pan') {
                stop();
                touch();
                panBy(event.deltaX, event.deltaY);
            } else {
                const unitPixels = [1, 33, clientRect.get().height][event.deltaMode];
                const wheelDelta = Math.max(-300, Math.min(300, event.deltaY * unitPixels));
                zoomBy(event.clientX, event.clientY, Math.exp(wheelDelta * 0.0015));
            }
        },
        { passive: false },
    );

    // One pointer pans, two pinch around their midpoint and pan with it. A double click or tap off the markers zooms in.
    const pointers = new Map<number, Point>();
    const isMarker = (target: EventTarget | null): boolean =>
        target instanceof Element && target.closest(MARKER_SELECTOR) !== null;
    let drag: Drag | null = null;
    let pinch: Pinch | null = null;
    let lastTap: { time: number; x: number; y: number } | null = null;

    // The grabbing cursor is on a childless element over the svg that is shown while the map is dragged: a cursor set on
    // the svg is inherited, so changing it would restyle every element of the map.
    const grabShield = document.createElement('div');
    grabShield.className = 'grab';
    grabShield.style.display = 'none';
    svg.after(grabShield);
    let dragging = false;

    const setDragging = (value: boolean): void => {
        if (value === dragging) return;

        dragging = value;
        grabShield.style.display = value ? 'block' : 'none';
    };

    // distance and midpoint of the two pointers
    const pointerPair = (): { distance: number; x: number; y: number } => {
        const [first, second] = [...pointers.values()];
        return {
            distance: Math.hypot(first.x - second.x, first.y - second.y),
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
        };
    };

    const dragFrom = (pointerId: number, point: Point): void => {
        drag = { pointerId, x: point.x, y: point.y, startX: point.x, startY: point.y };
    };

    const pointerMove = (event: PointerEvent): void => {
        const point = pointers.get(event.pointerId);
        if (!point) return;

        point.x = event.clientX;
        point.y = event.clientY;

        if (pinch) {
            const pair = pointerPair();
            if (pair.distance < 1) return;

            const width = pinch.clampWidth((pinch.width * pinch.distance) / pair.distance);
            anchor(width, pinch.point, pinch.capCentre, pair.x, pair.y);
        } else if (drag && drag.pointerId === event.pointerId) {
            if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 3) {
                wasDragged = true;
                setDragging(true);
                touch();
            }
            panBy(drag.x - event.clientX, drag.y - event.clientY);
            drag.x = event.clientX;
            drag.y = event.clientY;
        }
    };

    const pointerEnd = (event: PointerEvent): void => {
        if (!pointers.delete(event.pointerId)) return;

        if (pinch) {
            pinch = null;
            const remaining = [...pointers];
            if (remaining.length) dragFrom(remaining[0][0], remaining[0][1]);
        } else if (drag?.pointerId === event.pointerId) {
            drag = null;
        }

        if (pointers.size) return;

        setDragging(false);
        removeEventListener('pointermove', pointerMove);
        removeEventListener('pointerup', pointerEnd);
        removeEventListener('pointercancel', pointerEnd);
        options.onIdle?.();
        if (event.type !== 'pointerup' || wasDragged) return;

        const now = performance.now();
        const closeInTime = lastTap !== null && now - lastTap.time < 350;
        const closeInSpace = lastTap !== null && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 30;
        if (closeInTime && closeInSpace) {
            lastTap = null;

            if (!isMarker(event.target)) zoomBy(event.clientX, event.clientY, 0.5);
        } else {
            lastTap = { time: now, x: event.clientX, y: event.clientY };
        }
    };

    svg.addEventListener('pointerdown', (event) => {
        if (event.button || pointers.size >= 2) return;

        stop();
        clientRect.refresh();

        const point = { x: event.clientX, y: event.clientY };
        if (!pointers.size) {
            wasDragged = false;
            addEventListener('pointermove', pointerMove);
            addEventListener('pointerup', pointerEnd);
            addEventListener('pointercancel', pointerEnd);
        }

        pointers.set(event.pointerId, point);

        if (pointers.size === 1) {
            dragFrom(event.pointerId, point);
        } else {
            const pair = pointerPair();
            pinch = {
                distance: Math.max(1, pair.distance),
                width: viewBox.w,
                point: worldAt(pair.x, pair.y),
                capCentre: capCentreAt(),
                clampWidth: limits(),
            };
            drag = null;
            wasDragged = true;
            setDragging(true);
            touch();
        }
    });

    return {
        scale,
        toWorld: (event) => worldAt(event.clientX, event.clientY),
        get busy() {
            return pointers.size > 0 || !!zoomTarget;
        },
        get dragging() {
            return dragging;
        },
        get wasDragged() {
            return wasDragged;
        },
        view: currentView,
        reset() {
            setMoved(false);
            animTo(nearest(home()));
        },
        goTo(box, wasMoved) {
            setMoved(wasMoved);
            animTo(nearest(box));
        },
        resize() {
            clientRect.invalidate();
            if (!moved) {
                cancelAnimationFrame(panFrame);
                viewBox = home();
            }
            applyView();
        },
        zoom(factor) {
            const svgRect = clientRect.get();
            zoomBy(svgRect.left + svgRect.width / 2, svgRect.top + svgRect.height / 2, factor);
        },
        fit(box, insets) {
            touch();
            animTo(place(nearest(box), insets, 0));
        },
        reveal(box, insets) {
            const target = nearest(box);
            const { rect: svgRect, scale: viewScale } = scale();
            const { x: x0, y: y0 } = corner(svgRect, viewScale);
            const margin = insets.m || 0;
            const left = (target.x - x0) / viewScale;
            const right = (target.x + target.w - x0) / viewScale;
            const top = (target.y - y0) / viewScale;
            const bottom = (target.y + target.h - y0) / viewScale;

            const insideLeft = left >= margin;
            const insideRight = right <= svgRect.width - (insets.right || 0) - margin;
            const insideTop = top >= (insets.top || 0) + margin;
            const insideBottom = bottom <= svgRect.height - (insets.bottom || 0) - margin;
            if (insideLeft && insideRight && insideTop && insideBottom) return;

            touch();

            let fixedScale = 0;
            if (fits(target, insets)) fixedScale = viewScale;
            animTo(place(target, insets, fixedScale));
        },
        fits,
    };
}
