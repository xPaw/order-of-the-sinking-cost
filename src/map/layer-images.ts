// The images of the map layers (DATAFILES.md "The map images"). A layer's thumbnail (one pixel per square) is embedded in
// the page as a data URL and drawn pixelated until the layer's full image (src/assets/map-<layer>.avif) is
// decoded. The images are the repeating backgrounds of html elements under the map's svg, so the wrap of the map needs
// no copies, and a layer is decoded once, before it is shown.
import { PROG } from '../data.ts';
import type { ViewCorner } from '../panzoom.ts';
import { mod } from '../walk/cells.ts';

/** The pixels per square of the layer images in src/assets/. */
export const MAP_IMAGE_PIXELS_PER_SQUARE = 32;

const IMAGE_URLS = import.meta.glob('../assets/map-*.avif', { query: '?url', import: 'default', eager: true });

const THUMBNAIL_URLS = import.meta.glob('./thumbs/*.avif', { query: '?inline', import: 'default', eager: true });

const THUMBNAILS = new Map<string, string>();
for (const [path, url] of Object.entries(THUMBNAIL_URLS)) {
    const fileName = path.slice(path.lastIndexOf('/') + 1);
    const layer = fileName.slice(0, fileName.lastIndexOf('.'));
    THUMBNAILS.set(layer, url);
}

/** The data URL of a layer's thumbnail, undefined when it has none. */
export function layerThumbnail(layer: string): string | undefined {
    return THUMBNAILS.get(layer);
}

/** The URL of a layer's full image, relative to the page. */
export function layerImageUrl(layer: string): string {
    const url = IMAGE_URLS[`../assets/map-${layer}.avif`];
    if (typeof url !== 'string') throw new Error(`no full image for the layer ${layer}`);
    return url;
}

function cssUrl(url: string): string {
    return `url("${url}")`;
}

// one repeating background and the size and offset last written to it, so a place that changes neither writes nothing
class Tile {
    readonly element: HTMLElement;
    private width = NaN;
    private height = NaN;
    private x = NaN;
    private y = NaN;

    constructor(element: HTMLElement) {
        this.element = element;
    }

    place(width: number, height: number, x: number, y: number): void {
        if (width !== this.width || height !== this.height) {
            this.width = width;
            this.height = height;
            this.element.style.backgroundSize = `${width}px ${height}px`;
        }

        if (x !== this.x || y !== this.y) {
            this.x = x;
            this.y = y;
            this.element.style.backgroundPosition = `${x}px ${y}px`;
        }
    }
}

// the images of one layer: a full image that repeats over the holder's box, over a thumbnail that does the same
class LayerImages {
    private thumbnail: Tile | null;
    private readonly full: Tile;

    // whether the elements are shown
    private shown = false;

    // the last place, which the full image takes when it replaces the thumbnail
    private placed = false;
    private width = 0;
    private height = 0;
    private x = 0;
    private y = 0;

    /** Whether the full image has been decoded, or failed to. */
    settled = false;

    /** Resolves once the full image is decoded; a full image that fails to decode leaves the thumbnail. */
    readonly decoded: Promise<void>;

    constructor(holder: HTMLElement, layer: string) {
        this.thumbnail = null;
        const thumbnailUrl = layerThumbnail(layer);
        if (thumbnailUrl) {
            const element = document.createElement('div');
            element.className = 'thumb';
            element.hidden = true;
            element.style.backgroundImage = cssUrl(thumbnailUrl);
            holder.append(element);
            this.thumbnail = new Tile(element);
        }

        const fullElement = document.createElement('div');
        fullElement.className = 'full';
        fullElement.hidden = true;
        holder.append(fullElement);
        this.full = new Tile(fullElement);

        const fullUrl = layerImageUrl(layer);
        const image = new Image();
        image.src = fullUrl;
        const showFull = (): void => {
            this.settled = true;
            fullElement.style.backgroundImage = cssUrl(fullUrl);
            this.thumbnail?.element.remove();
            this.thumbnail = null;
            if (this.placed) this.full.place(this.width, this.height, this.x, this.y);
        };
        const keepThumbnail = (): void => {
            this.settled = true;
        };
        this.decoded = image.decode().then(showFull, keepThumbnail);
    }

    // the world tile is `width` x `height` screen pixels; its corner lies at (left, top) from the box's corner, modulo the
    // tile
    place(left: number, top: number, width: number, height: number): void {
        this.placed = true;
        this.width = width;
        this.height = height;
        this.x = mod(left, width);
        this.y = mod(top, height);

        // the thumbnail is on screen until the full image replaces it, which then takes the last place
        const tile = this.thumbnail ?? this.full;
        tile.place(this.width, this.height, this.x, this.y);
    }

    setShown(shown: boolean): void {
        if (shown === this.shown) return;

        this.shown = shown;
        if (this.thumbnail) this.thumbnail.element.hidden = !shown;
        this.full.element.hidden = !shown;
    }
}

/**
 * The layer images under a map's svg, drawn in a holder element that covers the svg's box (the stylesheet makes both fill
 * the map's box), so the images are placed from the svg's top-left corner. A layer is one repeating background per
 * image, so the wrap of the map costs nothing; the images of a layer are made when the layer is first shown.
 */
export class TerrainImages {
    private holder: HTMLElement;
    private readonly layers = new Map<string, LayerImages>();
    private shownLayer: string | null = null;
    private view: ViewCorner | null = null;
    private crisp = false;

    constructor(holder: HTMLElement) {
        this.holder = holder;
    }

    /**
     * Moves the images into the holder of the map's html made again, so the layers decoded so far are not decoded
     * again (and shown as their thumbnails meanwhile).
     */
    attach(holder: HTMLElement): void {
        holder.append(...this.holder.children);
        this.holder = holder;
        this.holder.classList.toggle('crisp', this.crisp);
    }

    /** Draws the full images as blocks once a map image pixel is wider than a screen pixel. */
    setCrisp(crisp: boolean): void {
        this.crisp = crisp;
        this.holder.classList.toggle('crisp', crisp);
    }

    /** Shows a layer and starts decoding its full image. */
    show(layer: string): void {
        this.shownLayer = layer;
        this.layerImages(layer);
        for (const [key, images] of this.layers) {
            if (key !== layer) images.setShown(false);
        }

        if (this.view) this.place(this.view);
    }

    /** Whether the full image of a layer is decoded (or failed to decode). */
    isDecoded(layer: string): boolean {
        return !!this.layers.get(layer)?.settled;
    }

    /** Resolves once the full image of a layer is decoded (or failed to decode). */
    decoded(layer: string): Promise<void> {
        return this.layers.get(layer)?.decoded ?? Promise.resolve();
    }

    /**
     * Places the shown layer so that its world tile repeats from the view's corner: the tile is one world size in
     * screen pixels, and the background's offset is the corner's distance from the tile's origin modulo the tile.
     */
    place(view: ViewCorner): void {
        this.view = view;
        const layer = this.shownLayer;
        if (layer === null) return;

        const [width, height] = PROG.map.size;
        const tileWidth = width / view.scale;
        const tileHeight = height / view.scale;
        const images = this.layerImages(layer);
        images.place(-view.x0 / view.scale, -view.y0 / view.scale, tileWidth, tileHeight);
        images.setShown(true);
    }

    private layerImages(layer: string): LayerImages {
        let images = this.layers.get(layer);
        if (!images) {
            images = new LayerImages(this.holder, layer);
            this.layers.set(layer, images);
        }

        return images;
    }
}
