// The images of the map layers (DATAFILES.md "The map images"). A layer's thumbnail (one pixel per square) is embedded in
// the page as a data URL and drawn pixelated until the layer's full image (src/assets/map-<layer>.avif) is
// decoded. The images are html elements under the map's svg, each copy of the wrapping map a pair of them placed by a
// transform, so the browser composites them on the GPU and decodes a layer once, before it is shown.
import { PROG } from '../data.ts';
import type { ViewCorner } from '../panzoom.ts';

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

function createImage(className: string, source: string, width: number, height: number): HTMLImageElement {
    const image = document.createElement('img');
    image.className = className;
    image.alt = '';
    image.draggable = false;
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
    image.src = source;
    return image;
}

// one copy of a layer's map: the full image (hidden until decoded) over the thumbnail
class ImageCopy {
    private readonly thumbnail: HTMLImageElement | null;
    private readonly full: HTMLImageElement;
    private shown = false;

    /** Whether the full image has been decoded, or failed to. */
    settled = false;

    /** The number of the last placement of the layer's copies that reached this one. */
    placement = 0;

    /** Resolves once the full image is decoded; a full image that fails to decode leaves the thumbnail. */
    readonly decoded: Promise<void>;

    constructor(holder: HTMLElement, layer: string) {
        const [width, height] = PROG.map.size;
        const thumbnailUrl = layerThumbnail(layer);
        this.thumbnail = null;
        if (thumbnailUrl) {
            this.thumbnail = createImage('thumb', thumbnailUrl, width, height);
            this.thumbnail.hidden = true;
            holder.append(this.thumbnail);
        }

        const fullWidth = width * MAP_IMAGE_PIXELS_PER_SQUARE;
        const fullHeight = height * MAP_IMAGE_PIXELS_PER_SQUARE;
        this.full = createImage('full pending', layerImageUrl(layer), fullWidth, fullHeight);
        this.full.hidden = true;
        holder.append(this.full);

        const showFull = (): void => {
            this.settled = true;
            this.full.classList.remove('pending');
            this.thumbnail?.remove();
        };
        const keepThumbnail = (): void => {
            this.settled = true;
        };
        this.decoded = this.full.decode().then(showFull, keepThumbnail);
    }

    // squares per screen pixel `scale`; (left, top): where the copy's corner is, in screen pixels
    place(left: number, top: number, scale: number): void {
        const position = `translate(${left}px, ${top}px)`;
        if (this.thumbnail) this.thumbnail.style.transform = `${position} scale(${1 / scale})`;
        this.full.style.transform = `${position} scale(${1 / (scale * MAP_IMAGE_PIXELS_PER_SQUARE)})`;
        this.setShown(true);
    }

    setShown(shown: boolean): void {
        if (shown === this.shown) return;

        this.shown = shown;
        if (this.thumbnail) this.thumbnail.hidden = !shown;
        this.full.hidden = !shown;
    }
}

// the copies of a layer in a row of the grid of copies; the offsets a view reaches stay far below half of it
const COPIES_PER_ROW = 1 << 16;

// the copies of one layer made so far, by their offset in whole world sizes (row * COPIES_PER_ROW + column); the first
// one made tells when the layer is decoded
class LayerCopies {
    readonly copies = new Map<number, ImageCopy>();
    first: ImageCopy | null = null;
}

/**
 * The layer images under a map's svg, drawn in a holder element that covers the svg's box (the stylesheet makes both fill
 * the map's box), so the images are placed from the svg's top-left corner. The map wraps, so a layer is
 * shown as many copies as the view reaches; the copies of a layer are made when the layer is first shown.
 */
export class TerrainImages {
    private holder: HTMLElement;
    private readonly layers = new Map<string, LayerCopies>();
    private shownLayer: string | null = null;
    private view: ViewCorner | null = null;

    // counts the calls of place, so that a copy tells whether the last one reached it
    private placements = 0;

    constructor(holder: HTMLElement) {
        this.holder = holder;
    }

    /**
     * Moves the images into the holder of the map's html made again, so the layers decoded so far are not decoded
     * again (and shown as their thumbnails meanwhile).
     */
    attach(holder: HTMLElement): void {
        holder.classList.toggle('crisp', this.holder.classList.contains('crisp'));
        holder.append(...this.holder.children);
        this.holder = holder;
    }

    /** Draws the full images as blocks once a map image pixel is wider than a screen pixel. */
    setCrisp(crisp: boolean): void {
        this.holder.classList.toggle('crisp', crisp);
    }

    /** Shows a layer and starts decoding its full image. */
    show(layer: string): void {
        this.shownLayer = layer;
        for (const [key, layerCopies] of this.layers) {
            if (key === layer) continue;
            for (const copy of layerCopies.copies.values()) copy.setShown(false);
        }

        if (this.view) {
            this.place(this.view);
            return;
        }

        this.copyAt(layer, 0, 0);
    }

    /** Whether the full image of a layer is decoded (or failed to decode). */
    isDecoded(layer: string): boolean {
        return !!this.layers.get(layer)?.first?.settled;
    }

    /** Resolves once the full image of a layer is decoded (or failed to decode). */
    decoded(layer: string): Promise<void> {
        return this.layers.get(layer)?.first?.decoded ?? Promise.resolve();
    }

    /** Puts the copies of the shown layer that the view reaches where they belong, and hides the others. */
    place(view: ViewCorner): void {
        this.view = view;
        const layer = this.shownLayer;
        if (layer === null) return;

        const [width, height] = PROG.map.size;
        const right = view.x0 + view.rect.width * view.scale;
        const bottom = view.y0 + view.rect.height * view.scale;
        const firstX = Math.floor(view.x0 / width);
        const lastX = Math.floor(right / width);
        const firstY = Math.floor(view.y0 / height);
        const lastY = Math.floor(bottom / height);
        this.placements++;

        for (let copyY = firstY; copyY <= lastY; copyY++) {
            for (let copyX = firstX; copyX <= lastX; copyX++) {
                const left = (copyX * width - view.x0) / view.scale;
                const top = (copyY * height - view.y0) / view.scale;
                const copy = this.copyAt(layer, copyX, copyY);
                copy.place(left, top, view.scale);
                copy.placement = this.placements;
            }
        }

        for (const copy of this.layerCopies(layer).copies.values()) {
            if (copy.placement !== this.placements) copy.setShown(false);
        }
    }

    private layerCopies(layer: string): LayerCopies {
        let layerCopies = this.layers.get(layer);
        if (!layerCopies) {
            layerCopies = new LayerCopies();
            this.layers.set(layer, layerCopies);
        }

        return layerCopies;
    }

    private copyAt(layer: string, copyX: number, copyY: number): ImageCopy {
        const layerCopies = this.layerCopies(layer);
        const key = copyY * COPIES_PER_ROW + copyX;
        let copy = layerCopies.copies.get(key);
        if (!copy) {
            copy = new ImageCopy(this.holder, layer);
            layerCopies.copies.set(key, copy);
            layerCopies.first ??= copy;
        }

        return copy;
    }
}
