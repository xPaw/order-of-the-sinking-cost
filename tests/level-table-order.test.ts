// The level table lists the levels of a section after the levels they require, and gives each level its game req as requires
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { LEVEL_TABLE } from '../scripts/lib/level-table.ts';
import type { LevelRow, Need } from '../scripts/lib/level-table.ts';

interface ProgressLevel {
    n: string;
    req: number[];
    or?: number;
}

interface ProgressFreezer {
    pid: number;
    req: number[];
    or?: number;
}

interface Placement {
    section: string;
    position: number;
    row: LevelRow;
}

// One way to meet a prerequisite: all of these levels
type Alternative = string[];

interface Prerequisite {
    kind: string;
    alternatives: Alternative[];
}

const PROGRESS: { levels: ProgressLevel[]; freezers: ProgressFreezer[] } = JSON.parse(
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

function requiredNames(level: ProgressLevel | ProgressFreezer): string[] {
    return level.req.map((index) => PROGRESS.levels[index].n);
}

// The ways one alternative of a need is met, as levels: a level, or the levels a Freezer needs (all of them, or any
// one for an `or` Freezer)
function needAlternatives(need: Need, freezers: Map<number, ProgressFreezer>): Alternative[] {
    if ('level' in need) return [[need.level]];
    if (!('freezer' in need)) return [];
    const freezer = freezers.get(need.freezer);
    if (!freezer) return [];
    const names = requiredNames(freezer);
    if (freezer.or) return names.map((name) => [name]);
    return names.length > 0 ? [names] : [];
}

// What a level needs first: every game `req` (one of them for `or`), then each group of its table needs
function prerequisites(level: ProgressLevel, row: LevelRow, freezers: Map<number, ProgressFreezer>): Prerequisite[] {
    const result: Prerequisite[] = [];
    const reqs = requiredNames(level);
    if (level.or) {
        result.push({ kind: 'req', alternatives: reqs.map((name) => [name]) });
    } else {
        for (const name of reqs) result.push({ kind: 'req', alternatives: [[name]] });
    }
    if (row.needs === 'unknown') return result;
    for (const group of row.needs) {
        const alternatives: Alternative[] = [];
        for (const need of group) alternatives.push(...needAlternatives(need, freezers));
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

function linkMap(placed: Map<string, Placement>, freezers: Map<number, ProgressFreezer>): Map<string, Set<string>> {
    const links = new Map<string, Set<string>>();
    for (const level of PROGRESS.levels) {
        const at = placed.get(level.n);
        if (!at) continue;
        const names = new Set<string>();
        for (const prerequisite of prerequisites(level, at.row, freezers)) {
            for (const alternative of prerequisite.alternatives) for (const name of alternative) names.add(name);
        }
        links.set(level.n, names);
    }
    return links;
}

function freezerMap(): Map<number, ProgressFreezer> {
    return new Map(PROGRESS.freezers.map((freezer) => [freezer.pid, freezer]));
}

describe('Level table order', () => {
    test('every row has a section', () => {
        expect(rowSections().length).toBe(LEVEL_TABLE.length);
    });

    test('a level follows what it requires and needs in its section', () => {
        const placed = placements();
        const freezers = freezerMap();
        const links = linkMap(placed, freezers);
        const failures: string[] = [];
        for (const level of PROGRESS.levels) {
            const at = placed.get(level.n);
            if (!at) continue;
            for (const prerequisite of prerequisites(level, at.row, freezers)) {
                // Only levels of the same section count; a prerequisite with none there asks nothing
                const inSection: Alternative[] = [];
                for (const alternative of prerequisite.alternatives) {
                    const names = alternative.filter((name) => placed.get(name)?.section === at.section);
                    if (names.length > 0) inSection.push(names);
                }
                if (inSection.length === 0) continue;
                const met = inSection.some((alternative) => {
                    return alternative.every((name) => placed.get(name)!.position < at.position);
                });
                if (met) continue;
                for (const alternative of inSection) {
                    for (const name of alternative) {
                        if (placed.get(name)!.position < at.position) continue;
                        // Two levels that require each other cannot both come second
                        if (reaches(links, name, level.n)) continue;
                        failures.push(`${level.n} comes before ${name} (${prerequisite.kind}) in ${at.section}`);
                    }
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
