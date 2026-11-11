// A key keeps its element and attributes while it is shown, so an object entering the view writes one mark
import { beforeEach, expect, test, vi } from 'vitest';
import { KeyedMarks, MarkPool } from '../src/map/mark-pool.ts';
import type { MarkAttributes } from '../src/map/mark-pool.ts';

class FakeElement {
    writes = 0;
    removals = 0;
    attributes = new Map<string, string>();
    children: FakeElement[] = [];
    insertions = 0;

    append(child: FakeElement): void {
        this.children.push(child);
        this.insertions++;
    }

    setAttribute(name: string, value: string): void {
        this.attributes.set(name, value);
        this.writes++;
    }

    removeAttribute(name: string): void {
        this.attributes.delete(name);
        this.removals++;
    }
}

function totalWrites(parent: FakeElement): number {
    return parent.children.reduce((sum, child) => sum + child.writes, 0);
}

function attributesOf(key: number): MarkAttributes {
    return { class: 'ho', href: `icon${key % 3}.png`, x: key, y: key * 2, width: 1, height: 1 };
}

beforeEach(() => {
    vi.stubGlobal('document', { createElementNS: () => new FakeElement() });
});

test('an object entering the view writes only its own mark and adds no element once the pool is grown', () => {
    const parent = new FakeElement();
    const marks = new KeyedMarks<number>(new MarkPool(parent, 'image'));
    const keys = Array.from({ length: 100 }, (_, index) => index);

    marks.show(keys, attributesOf);
    const elements = parent.children.slice();
    expect(parent.insertions).toBe(100);

    // the pan drops the first object and brings one in at the end
    const writesBefore = totalWrites(parent);
    marks.show([...keys.slice(1), 100], attributesOf);

    // one hide for the object that left; the freed mark, reused, loses display and takes the three attributes that differ
    expect(totalWrites(parent) - writesBefore).toBe(1 + 3);
    expect(parent.insertions).toBe(100);
    expect(parent.children).toEqual(elements);
    for (const key of keys.slice(1)) expect(marks.slotOf.get(key)).toBe(key);
});

test('a positional pool rewrites every mark after the one that left', () => {
    const parent = new FakeElement();
    const pool = new MarkPool(parent, 'image');
    const keys = Array.from({ length: 100 }, (_, index) => index);

    pool.draw(keys.map(attributesOf));
    const writesBefore = totalWrites(parent);
    pool.draw([...keys.slice(1), 100].map(attributesOf));

    expect(totalWrites(parent) - writesBefore).toBeGreaterThan(100);
});

test('marks that stay in view are not written when other keys change', () => {
    const parent = new FakeElement();
    const marks = new KeyedMarks<number>(new MarkPool(parent, 'image'));

    marks.show([1, 2, 3], attributesOf);
    const writesBefore = totalWrites(parent);
    marks.show([3, 2, 1], attributesOf);

    expect(totalWrites(parent)).toBe(writesBefore);
});
