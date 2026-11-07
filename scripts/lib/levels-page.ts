// The static /levels/ page: every level by area, as plain HTML a search engine can read
import { PROG } from '../../src/data.ts';
import { areaName } from '../../src/model/areas.ts';
import { layerName, mapLayerOf } from '../../src/model/layers.ts';
import { towerName } from '../../src/model/towers.ts';
import { compareText, escapeHtml } from '../../src/util.ts';

export const SITE = 'https://sinkingstar.xpaw.me';

export interface PageLevel {
    name: string;
    layer: string;
    tower: string | null;
}

export interface PageSection {
    heading: string;
    levels: PageLevel[];
}

const OTHER_LEVELS = 'Other levels';

/**
 * The levels grouped under their areas in the order the viewer lists the areas. A level outside every area box goes
 * under its nearest area, and a level in the boxes of several areas under its area in a new game, as the viewer does
 * without a save. A level with no area goes under "Other levels", which comes last.
 */
export function levelSections(): PageSection[] {
    const bySection = new Map<string, PageLevel[]>();
    const areaOrder = PROG.areas
        .map((area, index) => ({ index, order: area.order }))
        .toSorted((a, b) => a.order - b.order);

    for (const level of PROG.levels) {
        let heading = OTHER_LEVELS;
        if (level.area !== undefined) heading = areaName(PROG.areas[level.area]);

        let tower: string | null = null;
        if (level.t) tower = towerName(level.t);

        const entry: PageLevel = { name: level.n, layer: layerName(mapLayerOf(level.p[2])), tower };
        const levels = bySection.get(heading) ?? [];
        levels.push(entry);
        bySection.set(heading, levels);
    }

    const sections: PageSection[] = [];
    for (const { index } of areaOrder) {
        const heading = areaName(PROG.areas[index]);
        const levels = bySection.get(heading);
        if (levels) sections.push({ heading, levels: sortByName(levels) });
    }

    const others = bySection.get(OTHER_LEVELS);
    if (others) sections.push({ heading: OTHER_LEVELS, levels: sortByName(others) });
    return sections;
}

function sortByName(levels: PageLevel[]): PageLevel[] {
    return levels.toSorted((a, b) => compareText(a.name, b.name));
}

const STYLES = `
body { margin: 0; background: #0a2234; color: #ece3cd; font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 56rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
h1 { color: #f1e6c4; font-size: 1.6rem; margin: 0 0 0.5rem; }
h2 { color: #f5d84a; font-size: 1.2rem; margin: 2rem 0 0.5rem; border-bottom: 1px solid #9f7e26; }
a { color: #8fd6f0; }
ul { list-style: none; margin: 0; padding: 0; columns: 16rem; }
li { break-inside: avoid; padding: 0.1rem 0; }
.note { color: #b2aa94; }
`;

/** The page: a heading per area with its levels, each linking to the viewer's panel for the level. */
export function levelsPageHtml(sections: PageSection[]): string {
    const total = sections.reduce((sum, section) => sum + section.levels.length, 0);
    const title = 'Order of the Sinking Star levels by area';
    const description = `All ${total} level names of Order of the Sinking Star, listed by area, with their layer and tower. Open one in the save viewer.`;

    const body: string[] = [];
    for (const section of sections) {
        body.push(`<h2>${escapeHtml(section.heading)}</h2>`, '<ul>');
        for (const level of section.levels) {
            const id = escapeHtml(level.name);
            const href = `/#level=${encodeURIComponent(level.name)}`;
            let details = level.layer;
            if (level.tower) details += `, ${level.tower}`;
            body.push(
                `<li id="${id}"><a href="${escapeHtml(href)}">${id}</a> <span class="note">${escapeHtml(details)}</span></li>`,
            );
        }
        body.push('</ul>');
    }

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="color-scheme" content="dark">
<link rel="canonical" href="${SITE}/levels/">
<style>${STYLES}</style>
</head>
<body>
<main>
<h1>${escapeHtml(title)}</h1>
<p class="note">This page lists the game's levels, so it contains spoilers. Open the <a href="/">save viewer</a> to follow your own progress.</p>
${body.join('\n')}
</main>
</body>
</html>
`;
}
