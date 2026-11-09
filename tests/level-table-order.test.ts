// The level table lists the levels of a section after the levels they require, holds each level's game req in its needs, and lets every level be solved in some order
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { LEVEL_TABLE } from '../scripts/lib/level-table.ts';
import type { LevelRow, Need } from '../scripts/lib/level-table.ts';

interface ProgressLevel {
    n: string;
    req: number[];
    or?: number;
    en?: number;
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

// The section heading above each level of LEVEL_TABLE: a comment at the indent of the levels
function levelSections(): Map<string, string> {
    const sections = new Map<string, string>();
    let section = '';
    let inTable = false;
    for (const line of SOURCE.split('\n')) {
        if (line.startsWith('export const LEVEL_TABLE')) inTable = true;
        else if (line === '};') inTable = false;
        if (!inTable) continue;
        const heading = /^ {4}\/\/ (.+)$/.exec(line);
        if (heading) section = heading[1];
        const entry = /^ {4}'?([^':\s]+)'?: \{/.exec(line);
        if (entry) sections.set(entry[1], section);
    }
    return sections;
}

function placements(): Map<string, Placement> {
    const sections = levelSections();
    const placed = new Map<string, Placement>();
    let position = 0;
    for (const [name, row] of Object.entries(LEVEL_TABLE)) {
        placed.set(name, { section: sections.get(name)!, position, row });
        position += 1;
    }
    return placed;
}

function requiredNames(level: ProgressLevel): string[] {
    return level.req.map((index) => PROGRESS.levels[index].n);
}

// What a level needs first: every game `req` (one of them for `or`), then the levels of each group of its table needs
function prerequisites(level: ProgressLevel, row: LevelRow): Prerequisite[] {
    const result: Prerequisite[] = [];
    // A level enabled in the level data is open without its unlocks
    const reqs = level.en ? [] : requiredNames(level);
    if (level.or) {
        result.push({ kind: 'req', alternatives: reqs });
    } else {
        for (const name of reqs) result.push({ kind: 'req', alternatives: [name] });
    }
    for (const group of row.needs ?? []) {
        const alternatives: string[] = [];
        for (const need of group) {
            if ('level' in need) alternatives.push(need.level);
        }
        result.push({ kind: 'needs', alternatives });
    }
    return result;
}

// The groups a level asks for: its table needs, or its game unlocks when the table has none and they gate it
function needGroups(level: ProgressLevel, row: LevelRow): Need[][] {
    if (row.needs !== undefined) return row.needs;
    if (level.en) return [];
    const reqs = requiredNames(level).map((name): Need => ({ level: name }));
    if (level.or) return [reqs];
    return reqs.map((req) => [req]);
}

// The levels no order of play can solve: a level is solvable once every group of its needs has a Sign or a solvable level
function unsolvable(placed: Map<string, Placement>): string[] {
    const solvable = new Set<string>();
    let changed = true;
    while (changed) {
        changed = false;
        for (const level of PROGRESS.levels) {
            if (solvable.has(level.n)) continue;
            const groups = needGroups(level, placed.get(level.n)!.row);
            const met = groups.every((group) => group.some((need) => 'sign' in need || solvable.has(need.level)));
            if (!met) continue;
            solvable.add(level.n);
            changed = true;
        }
    }
    return PROGRESS.levels.filter((level) => !solvable.has(level.n)).map((level) => level.n);
}

describe('Level table order', () => {
    test('every level has a section', () => {
        expect(levelSections().size).toBe(Object.keys(LEVEL_TABLE).length);
    });

    test('a level follows what it requires and needs in its section', () => {
        const placed = placements();
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
                    failures.push(`${level.n} comes before ${name} (${prerequisite.kind}) in ${at.section}`);
                }
            }
        }
        expect(failures).toEqual([]);
    });

    test('the needs of a level hold its game req', () => {
        const placed = placements();
        const failures: string[] = [];
        for (const level of PROGRESS.levels) {
            const row = placed.get(level.n)!.row;
            const reqs = requiredNames(level);
            if (reqs.length === 0 || level.en) continue;
            if (row.needs === undefined) {
                failures.push(`${level.n} has no needs, the game requires [${reqs.join(', ')}]`);
                continue;
            }
            const held = (alternatives: string[]): boolean =>
                row.needs!.some((group) => {
                    const names = group.flatMap((need) => ('level' in need ? [need.level] : []));
                    return group.length === alternatives.length && alternatives.every((name) => names.includes(name));
                });
            const groups = level.or ? [reqs] : reqs.map((name) => [name]);
            for (const group of groups) {
                if (!held(group)) failures.push(`${level.n} needs lack [${group.join(', ')}]`);
            }
        }
        expect(failures).toEqual([]);
    });

    test('no level needs itself', () => {
        expect(unsolvable(placements())).toEqual([]);
    });
});
