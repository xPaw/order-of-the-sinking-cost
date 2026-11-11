// The map's client rect is measured again only when its box can change, not on a scroll of an unrelated element
import { beforeEach, expect, test, vi } from 'vitest';
import type { RectCache } from '../src/panzoom.ts';

vi.mock('../src/data.ts', () => ({ PROG: {} }));

type Listener = (event: { target?: FakeNode }) => void;

class FakeNode {
    parentElement: FakeNode | null = null;
    isConnected = true;
    rects = 0;

    contains(other: FakeNode): boolean {
        for (let node: FakeNode | null = other; node; node = node.parentElement) {
            if (node === this) return true;
        }
        return false;
    }

    getBoundingClientRect(): { width: number; height: number } {
        this.rects++;
        return { width: 100, height: 50 };
    }
}

let listeners: Map<string, Listener>;
let observed: FakeNode[];
let resizeCallback: () => void;

class FakeResizeObserver {
    constructor(callback: () => void) {
        resizeCallback = callback;
    }

    observe(node: FakeNode): void {
        observed.push(node);
    }

    disconnect(): void {}
}

beforeEach(() => {
    listeners = new Map();
    observed = [];
    vi.stubGlobal('Node', FakeNode);
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('addEventListener', (type: string, listener: Listener) => listeners.set(type, listener));
    vi.stubGlobal('removeEventListener', (type: string) => listeners.delete(type));
});

async function setup(): Promise<{ cache: RectCache; svg: FakeNode; box: FakeNode }> {
    const { RectCache: Cache } = await import('../src/panzoom.ts');
    const box = new FakeNode();
    const svg = new FakeNode();
    svg.parentElement = box;
    const cache = new Cache(svg);
    return { cache, svg, box };
}

function fire(type: string, target?: FakeNode): void {
    listeners.get(type)!({ target });
}

test('the rect is measured once and kept', async () => {
    const { cache, svg } = await setup();
    cache.get();
    cache.get();
    expect(svg.rects).toBe(1);
});

test('a scroll of an unrelated element keeps the rect', async () => {
    const { cache, svg } = await setup();
    cache.get();
    fire('scroll', new FakeNode());
    cache.get();
    expect(svg.rects).toBe(1);
});

test('a scroll of an ancestor measures again', async () => {
    const { cache, svg, box } = await setup();
    cache.get();
    fire('scroll', box);
    cache.get();
    expect(svg.rects).toBe(2);
});

test('a window resize measures again', async () => {
    const { cache, svg } = await setup();
    cache.get();
    fire('resize');
    cache.get();
    expect(svg.rects).toBe(2);
});

test('a resize of the svg or its container measures again', async () => {
    const { cache, svg, box } = await setup();
    expect(observed).toEqual([svg, box]);
    cache.get();
    resizeCallback();
    cache.get();
    expect(svg.rects).toBe(2);
});

test('refresh measures at once and get reuses it', async () => {
    const { cache, svg } = await setup();
    cache.refresh();
    cache.get();
    expect(svg.rects).toBe(1);
});

test('an element off the page drops its listeners', async () => {
    const { svg } = await setup();
    svg.isConnected = false;
    fire('scroll', svg);
    expect(listeners.has('scroll')).toBe(false);
    expect(listeners.has('resize')).toBe(false);
});
