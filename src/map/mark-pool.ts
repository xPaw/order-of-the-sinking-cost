// The elements of the map's overlay group, made once and changed in place. The group as a whole is repeated by use
// elements, and the browser rebuilds every copy of it when an element is added, removed or moved inside it, but only
// restyles the elements whose attributes change. So the marks of a layer are drawn into pools of elements in paint
// order (discs and lines are paths and lines, icons are image elements): a mark that is not drawn is hidden, and a pool
// grows only when a draw needs more marks than any before it.
const SVG_NS = 'http://www.w3.org/2000/svg';

/** The attributes an element carries: name to value. */
export type MarkAttributes = Record<string, string | number>;

/** An element and the attributes set on it. */
export class Mark {
    element: SVGElement;
    attributes = new Map<string, string | number>();

    constructor(element: SVGElement) {
        this.element = element;
    }

    /** Makes the element carry exactly these attributes ({name: value}), writing only the ones that differ. */
    set(wanted: MarkAttributes): void {
        const { element, attributes } = this;

        for (const name of attributes.keys()) {
            if (name in wanted) continue;

            element.removeAttribute(name);
            attributes.delete(name);
        }

        for (const name of Object.keys(wanted)) {
            const value = wanted[name];
            if (attributes.get(name) === value) continue;

            element.setAttribute(name, String(value));
            attributes.set(name, value);
        }
    }

    hide(): void {
        if (this.attributes.get('display') === 'none') return;

        this.element.setAttribute('display', 'none');
        this.attributes.set('display', 'none');
    }
}

/**
 * The marks of one map layer in paint order: the images of the objects in the view, under everything else, the overlay marks (a disc that takes the pointer, then the icons on the
 * discs), the selection's lines (a halo line and a coloured line each), the towers, the level markers (a ring that takes
 * the pointer, then the pad icons, role badges and frozen cages), the selected levels' markers (drawn over all others),
 * the images of what the cages hold, the hero, the pulsing ring round the level the save is in and the step badges. The ring is composited, so it comes
 * after everything that does not need to sit over it. Each layer has its own group, kept out of the overlay group while
 * the layer is not shown: every copy of the overlay group carries all the elements inside it, hidden or not.
 */
export class LayerMarks {
    root: SVGGElement = document.createElementNS(SVG_NS, 'g');
    objectIcons: MarkPool;
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
    heroMark: Mark;
    ringMark: Mark;
    stepMarks: MarkPool;

    constructor() {
        this.objectIcons = new MarkPool(this.addSection(), 'image');
        this.overlayMarks = new MarkPool(this.addSection(), 'path');
        this.overlayIcons = new MarkPool(this.addSection(), 'image');
        this.linkLines = new MarkPool(this.addSection(), 'line');
        this.towerMarks = new MarkPool(this.addSection(), 'path');
        this.towerIcons = new MarkPool(this.addSection(), 'image');
        this.levelMarks = new MarkPool(this.addSection(), 'path');
        this.levelIcons = new MarkPool(this.addSection(), 'image');
        this.raisedMarks = new MarkPool(this.addSection(), 'path');
        this.raisedIcons = new MarkPool(this.addSection(), 'image');
        this.cageLabels = new MarkPool(this.addSection(), 'image');
        this.heroMark = new Mark(this.addElement('image'));
        this.ringMark = new Mark(this.addElement('path'));
        this.stepMarks = new MarkPool(this.addSection(), 'g', (badge) => {
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('r', '10');

            const number = document.createElementNS(SVG_NS, 'text');
            number.setAttribute('y', '5.5');
            badge.append(circle, number);
        });
    }

    /** A group for one kind of mark, after the groups made before it. */
    addSection(): SVGGElement {
        return this.addElement('g');
    }

    addElement<Tag extends keyof SVGElementTagNameMap>(tag: Tag): SVGElementTagNameMap[Tag] {
        const element = document.createElementNS(SVG_NS, tag);
        this.root.append(element);
        return element;
    }
}

export class MarkPool {
    parent: SVGElement;
    tag: string;
    fill: ((element: SVGElement) => void) | undefined;
    marks: Mark[] = [];

    /** parent: the group the elements go in; tag: their element name; fill(element) adds what an element always holds. */
    constructor(parent: SVGElement, tag: string, fill?: (element: SVGElement) => void) {
        this.parent = parent;
        this.tag = tag;
        this.fill = fill;
    }

    /** The mark at an index, made (with the ones before it) when the pool is shorter. */
    at(index: number): Mark {
        while (this.marks.length <= index) {
            const element = document.createElementNS(SVG_NS, this.tag);
            this.fill?.(element);
            this.parent.append(element);
            this.marks.push(new Mark(element));
        }

        return this.marks[index];
    }

    /** Draws the attribute sets in order, one mark each, and hides the marks after them. */
    draw(list: MarkAttributes[]): void {
        list.forEach((wanted, index) => this.at(index).set(wanted));
        this.hideFrom(list.length);
    }

    /**
     * Draws the attribute sets in order, one mark each, and removes the marks after them: for a list whose length
     * follows a filter, where marks hidden for good would only add to the copies of the group.
     */
    fit(list: MarkAttributes[]): void {
        list.forEach((wanted, index) => this.at(index).set(wanted));
        for (const mark of this.marks.splice(list.length)) mark.element.remove();
    }

    hideFrom(count: number): void {
        for (let index = count; index < this.marks.length; index++) this.marks[index].hide();
    }
}
