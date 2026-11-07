// The level table lists the levels of a section after the levels they require, and gives each level its game req as requires
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { LEVEL_TABLE } from '../scripts/lib/level-table.ts';
import type { LevelRow } from '../scripts/lib/level-table.ts';

interface ProgressLevel {
    n: string;
    req: number[];
    or?: number;
}

interface Placement {
    section: string;
    position: number;
    row: LevelRow;
}

// A prerequisite is met by any one of its levels
interface Prerequisite {
    kind: string;
    alternatives: string[];
}

const PROGRESS: { levels: ProgressLevel[] } = JSON.parse(
    readFileSync(new URL('../data/progress.json', import.meta.url), 'utf8'),
);
const SOURCE = readFileSync(new URL('../scripts/lib/level-table.ts', import.meta.url), 'utf8');

// The section heading above each row of LEVEL_TABLE: a comment at the indent of the rows
function rowSections(): string[] {
    const sections: string[] = [];
    let section = '';
    let inTable = false;
    for (const line of SOURCE.split('\n')) {
        if (line.startsWith('export const LEVEL_TABLE')) inTable = true;
        else if (line === '];') inTable = false;
        if (!inTable) continue;
        const heading = /^ {4}\/\/ (.+)$/.exec(line);
        if (heading) section = heading[1];
        if (line === '    {') sections.push(section);
    }
    return sections;
}

function placements(): Map<string, Placement> {
    const sections = rowSections();
    const placed = new Map<string, Placement>();
    let position = 0;
    for (const [rowIndex, row] of LEVEL_TABLE.entries()) {
        for (const name of row.levels) {
            placed.set(name, { section: sections[rowIndex], position, row });
            position += 1;
        }
    }
    return placed;
}

function requiredNames(level: ProgressLevel): string[] {
    return level.req.map((index) => PROGRESS.levels[index].n);
}

// What a level needs first: every game `req` (one of them for `or`), then the levels of each group of its table needs
function prerequisites(level: ProgressLevel, row: LevelRow): Prerequisite[] {
    const result: Prerequisite[] = [];
    const reqs = requiredNames(level);
    if (level.or) {
        result.push({ kind: 'req', alternatives: reqs });
    } else {
        for (const name of reqs) result.push({ kind: 'req', alternatives: [name] });
    }
    if (row.needs === 'unknown') return result;
    for (const group of row.needs) {
        const alternatives: string[] = [];
        for (const need of group) {
            if ('level' in need) alternatives.push(need.level);
        }
        result.push({ kind: 'needs', alternatives });
    }
    return result;
}

// Whether `from` leads to `target` through req and needs links, which makes the two a cycle when `target` leads back
function reaches(links: Map<string, Set<string>>, from: string, target: string): boolean {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
        const name = stack.pop()!;
        if (name === target) return true;
        if (seen.has(name)) continue;
        seen.add(name);
        for (const next of links.get(name) ?? []) stack.push(next);
    }
    return false;
}

function linkMap(placed: Map<string, Placement>): Map<string, Set<string>> {
    const links = new Map<string, Set<string>>();
    for (const level of PROGRESS.levels) {
        const at = placed.get(level.n);
        if (!at) continue;
        const names = new Set<string>();
        for (const prerequisite of prerequisites(level, at.row)) {
            for (const name of prerequisite.alternatives) names.add(name);
        }
        links.set(level.n, names);
    }
    return links;
}

describe('Level table order', () => {
    test('every row has a section', () => {
        expect(rowSections().length).toBe(LEVEL_TABLE.length);
    });

    test('a level follows what it requires and needs in its section', () => {
        const placed = placements();
        const links = linkMap(placed);
        const failures: string[] = [];
        for (const level of PROGRESS.levels) {
            const at = placed.get(level.n);
            if (!at) continue;
            for (const prerequisite of prerequisites(level, at.row)) {
                // Only levels of the same section count; a prerequisite with none there asks nothing
                const inSection = prerequisite.alternatives.filter((name) => placed.get(name)?.section === at.section);
                if (inSection.length === 0) continue;
                if (inSection.some((name) => placed.get(name)!.position < at.position)) continue;
                for (const name of inSection) {
                    // Two levels that require each other cannot both come second
                    if (reaches(links, name, level.n)) continue;
                    failures.push(`${level.n} comes before ${name} (${prerequisite.kind}) in ${at.section}`);
                }
            }
        }
        expect(failures).toEqual([]);
    });

    test('the requires of a level are its game req', () => {
        const placed = placements();
        const failures: string[] = [];
        for (const level of PROGRESS.levels) {
            const at = placed.get(level.n);
            if (!at) continue;
            const reqs = requiredNames(level);
            const requires = at.row.requires ?? [];
            if (requires.join(',') !== reqs.join(',')) {
                failures.push(`${level.n} requires [${requires.join(', ')}], the game requires [${reqs.join(', ')}]`);
            }
        }
        expect(failures).toEqual([]);
    });
});
