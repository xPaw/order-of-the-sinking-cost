// The static levels page lists every level once, under its area, and keeps the levels whose area a save decides apart
import { expect, test } from 'vitest';
import { levelSections, levelsPageHtml } from '../scripts/lib/levels-page.ts';
import { PROG } from '../src/data.ts';
import { areaName } from '../src/model/areas.ts';

test('every level is listed once', () => {
    const listed = levelSections().flatMap((section) => section.levels.map((level) => level.name));
    expect(listed.toSorted()).toEqual(PROG.levels.map((level) => level.n).toSorted());
});

test('a level goes under its area, and a level in several areas under its new game area', () => {
    const sections = levelSections();
    const headingOf = (name: string): string | undefined => {
        return sections.find((section) => section.levels.some((level) => level.name === name))?.heading;
    };

    const single = PROG.levels.find((level) => level.area !== undefined && !level.overlap);
    const overlapping = PROG.levels.find((level) => level.overlap);
    if (!single || !overlapping) throw new Error('the level data has no such levels');

    expect(headingOf(single.n)).toBe(areaName(PROG.areas[single.area ?? 0]));
    expect(headingOf(overlapping.n)).toBe(areaName(PROG.areas[overlapping.area ?? 0]));
});

test('the page links each level to the viewer and has no script', () => {
    const html = levelsPageHtml(levelSections());
    const name = PROG.levels[0].n;
    expect(html).toContain(`href="/#level=${encodeURIComponent(name)}"`);
    expect(html.toLowerCase()).not.toContain('<script');
});
