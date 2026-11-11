// The elements of the map's overlay, made once and changed in place. The map wraps around, so the overlay is drawn as real
// elements in the first copy of the map and again in each other copy the view reaches. Every write to a mark goes to the
// mark's element in each of those copies, which are kept in step with the first. The marks of a layer are drawn into pools
// of elements in paint order (discs and lines are paths and lines, icons are image elements): a mark that is not drawn
// is hidden, and a pool grows only when a draw needs more marks than any before it.
import { isInRange, sameRange } from './torus.ts';
import type { CopyRange } from './torus.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The attributes an element carries: name to value. */
export type MarkAttributes = Record<string, string | number>;

/** An object drawn as an image on the map: the centre of its square on the map and its image. */
export interface ObjectImage {
    x: number;
    y: number;
    url: string;
}

/**
 * A mark: its element in the first copy of the map and in each other copy shown, in the order of the layer's copies,
 * and the attributes set on it.
 */
export class Mark {
    elements: Element[];
    attributes = new Map<string, string | number>();

    constructor(element: Element) {
        this.elements = [element];
    }

    /** Makes the elements carry exactly these attributes ({name: value}), writing only the ones that differ. */
    set(wanted: MarkAttributes): void {
        const { elements, attributes } = this;

        for (const name of attributes.keys()) {
            if (name in wanted) continue;

            for (const element of elements) element.removeAttribute(name);
            attributes.delete(name);
        }

        for (const name of Object.keys(wanted)) {
            const value = wanted[name];
            if (attributes.get(name) === value) continue;

            for (const element of elements) element.setAttribute(name, String(value));
            attributes.set(name, value);
        }
    }

    /** Hides the elements and keeps their other attributes, so a mark that comes back with the same ones writes only those. */
    hide(): void {
        if (this.attributes.get('display') === 'none') return;

        for (const element of this.elements) element.setAttribute('display', 'none');
        this.attributes.set('display', 'none');
    }

    /** Takes the element of a new copy of the map, which holds what the others hold. */
    addCopy(element: Element): void {
        this.elements.push(element);
    }

    /** Drops the element of the copy at this index among the copies (the first copy's element is not one of them). */
    removeCopy(copyIndex: number): void {
        this.elements.splice(copyIndex + 1, 1);
    }
}

/**
 * The marks of one map layer in paint order: the images of the objects in the view, under everything else, the overlay marks (a disc that takes the pointer, then the icons on the
 * discs), the selection's lines (a halo line and a coloured line each), the towers, the level markers (a ring that takes
 * the pointer, then the pad icons, role badges and frozen cages), the selected levels' markers (drawn over all others),
 * the images of what the cages hold, the hero, the pulsing ring round the level the save is in, the step badges and the
 * ring on the hovered marker. The ring is composited, so it comes after everything that does not need to sit over it.
 * Each layer has its own group, kept out of the overlay group while the layer is not shown.
 *
 * `root` holds the marks of the first copy of the map and a group per other copy shown, which holds a clone of them.
 */
export class LayerMarks {
    root: SVGGElement = document.createElementNS(SVG_NS, 'g');
    objectIcons: KeyedMarks<ObjectImage>;
    overlayMarks: MarkPool;
    overlayIcons: MarkPool;
    linkLines: MarkPool;
    towerMarks: MarkPool;
    towerIcons: MarkPool;
    levelMarks: MarkPool;
    levelIcons: MarkPool;
    raisedMarks: MarkPool;
    raisedIcons: MarkPool;
    cageLabels: MarkPool;
    heroMarks: MarkPool;
    ringMarks: MarkPool;
    stepMarks: MarkPool;
    hoverMarks: MarkPool;

    // the group of the first copy's marks
    private content: SVGGElement = document.createElementNS(SVG_NS, 'g');

    // the pools, in the order of the content's children
    private parts: MarkPool[] = [];

    private copies: LayerCopy[] = [];

    // the ranges the last setCopies made the copies for, null before the first
    private wantedRange: CopyRange | null = null;
    private keptRange: CopyRange | null = null;

    constructor() {
        this.root.append(this.content);
        this.objectIcons = new KeyedMarks(this.addPool('image'));
        this.overlayMarks = this.addPool('path');
        this.overlayIcons = this.addPool('image');
        this.linkLines = this.addPool('line');
        this.towerMarks = this.addPool('path');
        this.towerIcons = this.addPool('image');
        this.levelMarks = this.addPool('path');
        this.levelIcons = this.addPool('image');
        this.raisedMarks = this.addPool('path');
        this.raisedIcons = this.addPool('image');
        this.cageLabels = this.addPool('image');
        this.heroMarks = this.addPool('image');
        this.ringMarks = this.addPool('path');
        this.stepMarks = this.addPool('g', (badge) => {
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('r', '10');

            const number = document.createElementNS(SVG_NS, 'text');
            number.setAttribute('y', '5.5');
            badge.append(circle, number);
        });
        this.hoverMarks = this.addPool('path');
    }

    /**
     * Dims the level markers that are not part of a selection. The dimming is on the two groups that hold them, so a
     * selection starting or ending restyles two elements in each copy of the map, not every marker.
     */
    dimLevels(on: boolean): void {
        for (const parent of this.levelMarks.parents) parent.classList.toggle('dimmed', on);
        for (const parent of this.levelIcons.parents) parent.classList.toggle('dimmed', on);
    }

    /**
     * Makes the copies of the marks besides the first the ones in `want` (shifts in whole maps; the first copy, which is
     * always there, is skipped), and drops those outside `keep`. A copy is a clone of the first, made when it is wanted.
     */
    setCopies(want: CopyRange, keep: CopyRange, mapWidth: number, mapHeight: number): void {
        const unchanged =
            this.wantedRange !== null &&
            this.keptRange !== null &&
            sameRange(want, this.wantedRange) &&
            sameRange(keep, this.keptRange);
        if (unchanged) return;

        this.wantedRange = { ...want };
        this.keptRange = { ...keep };

        for (let index = this.copies.length - 1; index >= 0; index--) {
            const copy = this.copies[index];
            if (!isInRange(keep, copy.copyX, copy.copyY)) this.removeCopy(index);
        }

        for (let copyY = want.firstY; copyY <= want.lastY; copyY++) {
            for (let copyX = want.firstX; copyX <= want.lastX; copyX++) {
                if (copyX === 0 && copyY === 0) continue;
                if (this.hasCopy(copyX, copyY)) continue;

                this.addCopy(copyX, copyY, mapWidth, mapHeight);
            }
        }
    }

    // a pool in a group of its own, after the groups made before it
    private addPool(tag: string, fill?: (element: SVGElement) => void): MarkPool {
        const section = document.createElementNS(SVG_NS, 'g');
        this.content.append(section);

        const pool = new MarkPool(section, tag, fill);
        this.parts.push(pool);
        return pool;
    }

    private hasCopy(copyX: number, copyY: number): boolean {
        return this.copies.some((copy) => copy.copyX === copyX && copy.copyY === copyY);
    }

    private addCopy(copyX: number, copyY: number, mapWidth: number, mapHeight: number): void {
        const group = document.createElementNS(SVG_NS, 'g');
        group.setAttribute('transform', `translate(${copyX * mapWidth} ${copyY * mapHeight})`);
        group.append(this.content.cloneNode(true));

        const clone = group.firstElementChild;
        if (!clone) throw new Error('The clone of the marks is empty');

        this.parts.forEach((part, index) => part.addCopy(clone.children[index]));
        this.root.append(group);
        this.copies.push({ copyX, copyY, group });
    }

    private removeCopy(index: number): void {
        const [copy] = this.copies.splice(index, 1);
        copy.group.remove();
        for (const part of this.parts) part.removeCopy(index);
    }
}

/** A copy of the layer's marks besides the first: its shift in whole maps and its group. */
interface LayerCopy {
    copyX: number;
    copyY: number;
    group: SVGGElement;
}

/**
 * A pool whose marks stay with their keys: a key keeps its mark, and the attributes on it, for as long as it is shown.
 * A key that is shown takes the first mark no key holds, and a key that is not shown hides its mark and frees it, so
 * showing another set of keys writes only to the marks of the keys that entered or left and never moves an element.
 */
export class KeyedMarks<Key> {
    pool: MarkPool;
    slots: (Key | null)[] = [];
    slotOf = new Map<Key, number>();

    // the keys of the show in progress
    private readonly wanted = new Set<Key>();

    constructor(pool: MarkPool) {
        this.pool = pool;
    }

    /** Shows these keys, drawing each new key with attributesOf(key). */
    show(keys: readonly Key[], attributesOf: (key: Key) => MarkAttributes): void {
        const wanted = this.wanted;
        wanted.clear();
        for (const key of keys) wanted.add(key);

        for (let slot = 0; slot < this.slots.length; slot++) {
            const held = this.slots[slot];
            if (held === null || wanted.has(held)) continue;

            this.pool.at(slot).hide();
            this.slots[slot] = null;
            this.slotOf.delete(held);
        }

        let free = 0;
        for (const key of keys) {
            if (this.slotOf.has(key)) continue;

            while (free < this.slots.length && this.slots[free] !== null) free++;
            if (free === this.slots.length) this.slots.push(null);

            this.slots[free] = key;
            this.slotOf.set(key, free);
            this.pool.at(free).set(attributesOf(key));
        }
    }
}

export class MarkPool {
    /** The group of the marks in the first copy of the map, then the one in each other copy shown. */
    parents: Element[];
    tag: string;
    fill: ((element: SVGElement) => void) | undefined;
    marks: Mark[] = [];

    /** parent: the group the elements go in; tag: their element name; fill(element) adds what an element always holds. */
    constructor(parent: SVGElement, tag: string, fill?: (element: SVGElement) => void) {
        this.parents = [parent];
        this.tag = tag;
        this.fill = fill;
    }

    /** The mark at an index, made (with the ones before it) when the pool is shorter. */
    at(index: number): Mark {
        while (this.marks.length <= index) {
            const mark = new Mark(this.makeElement(this.parents[0]));
            for (let copy = 1; copy < this.parents.length; copy++) mark.addCopy(this.makeElement(this.parents[copy]));
            this.marks.push(mark);
        }

        return this.marks[index];
    }

    /**
     * Draws the attribute sets in order, one mark each, and hides the marks after them, or with `trim` removes them: for
     * a list whose length follows a filter, where marks hidden for good would only add to the copies of the group.
     */
    draw(list: MarkAttributes[], trim = false): void {
        list.forEach((wanted, index) => this.at(index).set(wanted));
        if (!trim) {
            this.hideFrom(list.length);
            return;
        }

        for (const mark of this.marks.splice(list.length)) {
            for (const element of mark.elements) element.remove();
        }
    }

    hideFrom(count: number): void {
        for (let index = count; index < this.marks.length; index++) this.marks[index].hide();
    }

    /** Takes the group of a new copy of the map, which holds a clone of each mark's element in the mark's order. */
    addCopy(parent: Element): void {
        this.parents.push(parent);
        this.marks.forEach((mark, index) => mark.addCopy(parent.children[index]));
    }

    removeCopy(copyIndex: number): void {
        this.parents.splice(copyIndex + 1, 1);
        for (const mark of this.marks) mark.removeCopy(copyIndex);
    }

    // an element of the pool's tag, in a group
    private makeElement(parent: Element): SVGElement {
        const element = document.createElementNS(SVG_NS, this.tag);
        this.fill?.(element);
        parent.append(element);
        return element;
    }
}
