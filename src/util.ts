// DOM and text helpers: queries, escaping, the save's Apollo times (saves.md "Status.sokoban_status (campaign status)"),
// durations and hex dumps

/** The first element of the page that matches `selector`. Callers of an element the markup may lack use `?.`. */
export const $ = (selector: string, root: ParentNode = document): HTMLElement =>
    root.querySelector<HTMLElement>(selector)!;

/** Orders two texts the way the user's language does; sorts use it in place of localeCompare, which builds a collator per call. */
export const compareText = new Intl.Collator().compare;

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

/** The text with the characters that are special in HTML escaped. */
export const escapeHtml = (text: unknown): string =>
    String(text).replace(/[&<>"]/g, (character) => HTML_ESCAPES[character]);

const APOLLO_TO_FILETIME = (-630480n << 64n) + 0xae1758526cfc8000n;
const apolloTicks = (lo: bigint, hi: bigint): bigint => (hi << 64n) | BigInt.asUintN(64, lo);

/** The date of an Apollo time, given as the low and high halves of its 128-bit tick count. */
export function apolloDate(lo: bigint, hi: bigint): Date {
    const fileTime = (apolloTicks(lo, hi) - APOLLO_TO_FILETIME) / 100000000n;
    return new Date(Number((fileTime - 116444736000000000n) / 10000n));
}

/** The seconds of an Apollo duration, given as the low and high halves of its 128-bit tick count. */
export function apolloSeconds(lo: bigint, hi: bigint): number {
    return Number(apolloTicks(lo, hi) / 1000000000000n) / 1000;
}

/** A duration as "1h 05m" from an hour on, else "4m 09s". */
export function duration(seconds: number): string {
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total / 60) % 60;
    const rest = total % 60;
    if (hours) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
    return `${minutes}m ${String(rest).padStart(2, '0')}s`;
}

/** The first `max` bytes as hex, with the byte count when there are more. */
export function hexDump(bytes: Uint8Array, max = 64): string {
    let text = Array.from(bytes.subarray(0, max), (byte) => byte.toString(16).padStart(2, '0')).join(' ');
    if (bytes.length > max) text += ` … (${bytes.length} bytes)`;
    return text;
}

/** Per key keyOf(item), how many of the items have it, in first-seen order. */
export const countBy = <Item, Key>(items: Iterable<Item>, keyOf: (item: Item) => Key): Map<Key, number> => {
    const counts = new Map<Key, number>();
    for (const item of items) {
        const key = keyOf(item);
        counts.set(key, (counts.get(key) || 0) + 1);
    }

    return counts;
};

/** The indices of the items that `keep` accepts. */
export function indicesWhere<Item>(items: Item[], keep: (item: Item, index: number) => boolean): number[] {
    const indices: number[] = [];
    items.forEach((item, index) => {
        if (keep(item, index)) indices.push(index);
    });
    return indices;
}

// the html each element was last given by setHtml
const writtenHtml = new WeakMap<Element, string>();

/** Sets the element's html unless setHtml gave it the same last, so an unchanged list is not rebuilt; whether it was set. */
export function setHtml(element: Element, html: string): boolean {
    if (writtenHtml.get(element) === html) return false;

    element.innerHTML = html;
    writtenHtml.set(element, html);
    return true;
}

/** Marks a segmented-control button as on or off. */
export function setButtonPressed(button: HTMLElement, pressed: boolean): void {
    button.classList.toggle('on', pressed);
    button.setAttribute('aria-pressed', String(pressed));
}
