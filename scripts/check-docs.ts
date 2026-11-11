// Checks the docs: every Markdown link in docs/*.md resolves to a file and, for a docs page, to a heading anchor; no
// two headings of a page share an anchor; no heading starts with a section number or holds raw <...> outside code; no
// text cites a section by its number.
//
// Anchors follow GitHub's: the heading text without inline markup, lowercased, without every character that is not a
// letter, digit, mark, space, hyphen or underscore, spaces turned into hyphens.
//
// Usage: node scripts/check-docs.ts [--anchors]   (--anchors also lists every page's headings and anchors)
// Exits with 1 when there is a problem.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT } from './lib/paths.ts';

interface Heading {
    lineNumber: number;
    level: number;
    text: string;
    anchor: string;
}

interface Page {
    headings: Heading[];
    links: { lineNumber: number; target: string }[];
    cites: { lineNumber: number; text: string }[];
}

const DOCS = join(ROOT, 'docs');
const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LINK = /(?<!!)\[((?:[^[\]]|\[[^\]]*\])*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/g;
const INLINE_CODE = /`[^`]*`/g;
const NUMBERED = /^\s*(\d|§|(Step|Part|Section|Chapter)\s+\d)/i;
const CITE =
    /§|\b[A-Z][A-Z_]*(\.md)?\s+\d+\.\d+(\.\d+)*\b|\b[A-Z][A-Z_]*\.md\s+\d+\b|\b[Ss]ection\s+\d|\bsections?\s+"/g;
const EXTERNAL = /^[a-z]+:/;
const SLUG_KEEPS = /[\p{L}\p{N}\p{M} _-]/u;

// Heading text as displayed: images and links by their text, no code ticks, bold or italics
function plain(text: string): string {
    return text
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replaceAll('`', '')
        .replace(/(\*\*|__)(.+?)\1/g, '$2')
        .replace(/(?<![\p{L}\p{N}_*])\*(?!\s)(.+?)(?<!\s)\*(?![\p{L}\p{N}_*])/gu, '$1');
}

function slug(text: string): string {
    const kept = Array.from(plain(text).toLowerCase()).filter((char) => SLUG_KEEPS.test(char));
    return kept.join('').replaceAll(' ', '-');
}

// The headings, links and numbered citations of one page, outside fenced code
function scan(path: string): Page {
    const page: Page = { headings: [], links: [], cites: [] };
    let fenced = false;
    readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .forEach((line, index) => {
            const lineNumber = index + 1;
            if (FENCE.test(line)) {
                fenced = !fenced;
                return;
            }
            if (fenced) return;
            const heading = HEADING.exec(line);
            if (heading) {
                const text = heading[2];
                page.headings.push({ lineNumber, level: heading[1].length, text, anchor: slug(text) });
            }
            const codeFree = line.replace(INLINE_CODE, '');
            for (const link of codeFree.matchAll(LINK)) page.links.push({ lineNumber, target: link[2] });
            for (const cite of codeFree.matchAll(CITE)) page.cites.push({ lineNumber, text: cite[0] });
        });
    return page;
}

function headingProblems(name: string, page: Page): string[] {
    const problems: string[] = [];
    const firstLine = new Map<string, number>();
    for (const { lineNumber, text, anchor } of page.headings) {
        if (firstLine.has(anchor)) {
            problems.push(
                `${name}:${lineNumber}: duplicate heading anchor #${anchor} (first at line ${firstLine.get(anchor)})`,
            );
        } else {
            firstLine.set(anchor, lineNumber);
        }
        if (NUMBERED.test(plain(text))) {
            problems.push(`${name}:${lineNumber}: heading starts with a number or section mark "${text}"`);
        }
        const outsideCode = text.replaceAll('`<', '').replaceAll('>`', '');
        if (outsideCode.includes('<') && !text.includes('`')) {
            problems.push(`${name}:${lineNumber}: heading has raw <...> outside code: "${text}"`);
        }
    }
    return problems;
}

function linkProblems(
    name: string,
    page: Page,
    anchors: Map<string, Set<string>>,
): { problems: string[]; checked: number } {
    const problems: string[] = [];
    let checked = 0;
    for (const { lineNumber, target } of page.links) {
        if (EXTERNAL.test(target)) continue;
        checked++;
        const hashAt = target.indexOf('#');
        let filePart = target;
        let anchor = '';
        if (hashAt >= 0) {
            filePart = target.slice(0, hashAt);
            anchor = target.slice(hashAt + 1);
        }
        let destination = name;
        if (filePart !== '') destination = posix.normalize(filePart.replaceAll('\\', '/'));
        const destinationAnchors = anchors.get(destination);
        if (!destinationAnchors) {
            if (!existsSync(join(DOCS, filePart)))
                problems.push(`${name}:${lineNumber}: link to missing file ${target}`);
            continue;
        }
        if (anchor && !destinationAnchors.has(anchor)) {
            problems.push(`${name}:${lineNumber}: broken anchor ${target}`);
        }
    }
    return { problems, checked };
}

function printAnchors(pages: Map<string, Page>): void {
    for (const [name, page] of pages) {
        console.log(`\n## ${name}`);
        for (const { level, text, anchor } of page.headings)
            console.log(`${'  '.repeat(level - 1)}${plain(text)} -> #${anchor}`);
    }
}

function main(): void {
    const { values } = parseArgs({ options: { anchors: { type: 'boolean' } } });
    const names = readdirSync(DOCS)
        .filter((name) => name.endsWith('.md'))
        .toSorted();
    const pages = new Map<string, Page>();
    const anchors = new Map<string, Set<string>>();
    for (const name of names) {
        const page = scan(join(DOCS, name));
        pages.set(name, page);
        anchors.set(name, new Set(page.headings.map((heading) => heading.anchor)));
    }
    const problems: string[] = [];
    let checked = 0;
    for (const [name, page] of pages) {
        problems.push(...headingProblems(name, page));
        const links = linkProblems(name, page, anchors);
        problems.push(...links.problems);
        checked += links.checked;
        for (const { lineNumber, text } of page.cites) {
            problems.push(`${name}:${lineNumber}: numbered cross-reference "${text}"`);
        }
    }
    for (const problem of problems) console.log(problem);
    if (values.anchors) printAnchors(pages);
    console.log(`\n${checked} links checked in ${names.length} files, ${problems.length} problems`);
    if (problems.length) process.exitCode = 1;
}

main();
