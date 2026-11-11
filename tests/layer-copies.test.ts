// The overlay marks of each copy of the map the view reaches are real elements kept in step with the first copy
import { beforeEach, expect, test, vi } from 'vitest';
import { LayerMarks } from '../src/map/mark-pool.ts';
import type { CopyRange } from '../src/map/torus.ts';

class FakeElement {
    tag: string;
    writes = 0;
    attributes = new Map<string, string>();
    children: FakeElement[] = [];
    parent: FakeElement | null = null;
    classes = new Set<string>();
    classList = {
        toggle: (name: string, on: boolean): void => {
            if (on) this.classes.add(name);
            else this.classes.delete(name);
        },
    };

    constructor(tag = 'g') {
        this.tag = tag;
    }

    get firstElementChild(): FakeElement | null {
        return this.children[0] ?? null;
    }

    append(...nodes: FakeElement[]): void {
        for (const node of nodes) {
            node.parent = this;
            this.children.push(node);
        }
    }

    remove(): void {
        if (!this.parent) return;

        this.parent.children = this.parent.children.filter((child) => child !== this);
        this.parent = null;
    }

    getAttribute(name: string): string | null {
        return this.attributes.get(name) ?? null;
    }

    setAttribute(name: string, value: string): void {
        this.attributes.set(name, value);
        this.writes++;
    }

    removeAttribute(name: string): void {
        this.attributes.delete(name);
        this.writes++;
    }

    cloneNode(): FakeElement {
        const clone = new FakeElement(this.tag);
        clone.attributes = new Map(this.attributes);
        clone.classes = new Set(this.classes);
        clone.append(...this.children.map((child) => child.cloneNode()));
        return clone;
    }
}

const range = (firstX: number, lastX: number, firstY: number, lastY: number): CopyRange => ({
    firstX,
    lastX,
    firstY,
    lastY,
});

const everything = range(-5, 5, -5, 5);

// every element the stub made, the layer's root first
let made: FakeElement[] = [];

// the section groups of the marks of the first copy (copy 0) or of another copy (by its place among the root's groups)
function sectionOf(copy: number, section: number): FakeElement {
    const [root] = made;
    if (copy === 0) return root.children[0].children[section];
    return root.children[copy].children[0].children[section];
}

const rootChildren = (): FakeElement[] => made[0].children;

const totalWrites = (): number => made.reduce((sum, element) => sum + element.writes, 0);

beforeEach(() => {
    made = [];
    vi.stubGlobal('document', {
        createElementNS: (_ns: string, tag: string) => {
            const element = new FakeElement(tag);
            made.push(element);
            return element;
        },
    });
});

test('a copy is a clone of the first copy, shifted by whole maps', () => {
    const marks = new LayerMarks();
    marks.levelMarks.draw([{ class: 'lv' }, { class: 'lv' }]);
    marks.setCopies(range(0, 1, -1, 0), everything, 100, 50);

    const shifts = rootChildren()
        .slice(1)
        .map((copy) => copy.attributes.get('transform'));
    expect(shifts).toEqual(['translate(0 -50)', 'translate(100 -50)', 'translate(100 0)']);

    const levels = sectionOf(1, 6);
    expect(levels.children.map((mark) => mark.attributes.get('class'))).toEqual(['lv', 'lv']);
    expect(marks.levelMarks.marks[0].elements).toHaveLength(4);
});

test('a write to a mark reaches its element in every copy', () => {
    const marks = new LayerMarks();
    marks.levelMarks.draw([{ class: 'lv', 'data-i': 3 }]);
    marks.setCopies(range(0, 1, 0, 0), everything, 100, 50);

    marks.levelMarks.draw([{ class: 'lv hl', 'data-i': 3 }]);
    for (const element of marks.levelMarks.marks[0].elements) {
        expect(element.getAttribute('class')).toBe('lv hl');
    }

    marks.levelMarks.hideFrom(0);
    expect(sectionOf(1, 6).children[0].attributes.get('display')).toBe('none');
    expect(sectionOf(0, 6).children[0].attributes.get('display')).toBe('none');
});

test('a mark made after a copy exists is made in the copy too', () => {
    const marks = new LayerMarks();
    marks.setCopies(range(-1, 0, 0, 0), everything, 100, 50);
    marks.towerMarks.draw([{ class: 'tw' }, { class: 'tw' }, { class: 'tw' }]);

    expect(sectionOf(1, 4).children).toHaveLength(3);
    expect(marks.towerMarks.marks[2].elements).toHaveLength(2);
});

test('the dimming reaches every copy', () => {
    const marks = new LayerMarks();
    marks.setCopies(range(0, 1, 0, 0), everything, 100, 50);

    marks.dimLevels(true);

    for (const copy of [0, 1]) expect(sectionOf(copy, 6).classes.has('dimmed')).toBe(true);
});

test('a single mark pool is drawn and hidden in every copy', () => {
    const marks = new LayerMarks();
    marks.setCopies(range(0, 1, 0, 0), everything, 100, 50);

    marks.heroMarks.draw([{ class: 'hero' }]);
    marks.heroMarks.draw([]);

    for (const element of marks.heroMarks.marks[0].elements) {
        expect(element.getAttribute('display')).toBe('none');
    }
    expect(marks.heroMarks.marks[0].elements).toHaveLength(2);
});

test('trimming a pool removes the marks after the list from every copy', () => {
    const marks = new LayerMarks();
    marks.setCopies(range(0, 1, 0, 0), everything, 100, 50);
    marks.levelMarks.draw([{ class: 'lv' }, { class: 'lv' }, { class: 'lv' }], true);
    marks.levelMarks.draw([{ class: 'lv' }], true);

    expect(sectionOf(0, 6).children).toHaveLength(1);
    expect(sectionOf(1, 6).children).toHaveLength(1);
    expect(marks.levelMarks.marks).toHaveLength(1);
});

test('a copy that is not wanted is kept while it is inside the kept range, and dropped outside it', () => {
    const marks = new LayerMarks();
    marks.levelMarks.draw([{ class: 'lv' }]);
    marks.setCopies(range(0, 1, 0, 0), everything, 100, 50);

    marks.setCopies(range(0, 0, 0, 0), range(0, 1, 0, 0), 100, 50);
    expect(rootChildren()).toHaveLength(2);

    marks.setCopies(range(0, 0, 0, 0), range(0, 0, 0, 0), 100, 50);
    expect(rootChildren()).toHaveLength(1);
    expect(marks.levelMarks.marks[0].elements).toHaveLength(1);
    expect(marks.levelMarks.parents).toHaveLength(1);
});

test('wanting the copies already there writes nothing and makes no element', () => {
    const marks = new LayerMarks();
    marks.levelMarks.draw([{ class: 'lv' }]);
    marks.setCopies(range(-1, 1, -1, 1), everything, 100, 50);

    const copies = rootChildren().slice();
    const elementsBefore = made.length;
    const writesBefore = totalWrites();

    marks.setCopies(range(-1, 1, -1, 1), everything, 100, 50);

    expect(rootChildren()).toEqual(copies);
    expect(copies).toHaveLength(9);
    expect(made).toHaveLength(elementsBefore);
    expect(totalWrites()).toBe(writesBefore);
});

test('removing a copy in the middle keeps the others in step', () => {
    const marks = new LayerMarks();
    marks.levelMarks.draw([{ class: 'lv' }]);
    marks.setCopies(range(0, 2, 0, 0), everything, 100, 50);
    marks.setCopies(range(2, 2, 0, 0), range(2, 2, 0, 0), 100, 50);

    marks.levelMarks.draw([{ class: 'lv hl' }]);
    expect(rootChildren()).toHaveLength(2);
    expect(rootChildren()[1].attributes.get('transform')).toBe('translate(200 0)');
    expect(sectionOf(1, 6).children[0].attributes.get('class')).toBe('lv hl');
    expect(marks.levelMarks.marks[0].elements).toHaveLength(2);
});
