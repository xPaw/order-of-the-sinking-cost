// setHtml leaves an element alone when it was last given the same html
import { expect, test } from 'vitest';
import { setHtml } from '../src/util.ts';

interface FakeElement {
    innerHTML: string;
}

const fakeElement = (): FakeElement => ({ innerHTML: '' });

test('the same html is not set again', () => {
    const element = fakeElement();
    expect(setHtml(element, '<b>a</b>')).toBe(true);
    expect(setHtml(element, '<b>a</b>')).toBe(false);
    expect(setHtml(element, '<b>b</b>')).toBe(true);
    expect(element.innerHTML).toBe('<b>b</b>');
});

test('elements are tracked apart', () => {
    const first = fakeElement();
    const second = fakeElement();
    setHtml(first, 'x');
    expect(setHtml(second, 'x')).toBe(true);
});
