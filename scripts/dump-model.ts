// Writes, as JSON, everything the page's progress view reads for one campaign: computeProgress's P, the progress model
// with spoilers hidden and shown (goals, their levels and roles, areas, plan steps, fog), and the plans. Two runs on
// the same saves give the same bytes, so a refactor of src/ can be checked against an earlier dump.
//
// Reads the campaign's Status.sokoban_status and overworld.history in place; writes only <outFile>.
//
// Usage: node scripts/dump-model.ts <saveFolder|campaign|--demo> <outFile>
//   saveFolder: a folder holding the campaign's saves; campaign: a folder name in the game's save folder
//   --demo: the empty save the page shows before any save is loaded
//
// Output: Maps as {map: [[key, value], ...]}, Sets as {set: [...]}, typed arrays as arrays, BigInts as
// {bigint: digits}, functions as "fn", undefined as {undefined: true}, in the order the code builds them.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { registerHooks, type LoadFnOutput, type LoadHookContext } from 'node:module';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isTypedArray, type Canonical } from './lib/plain.ts';
import { savesDir } from './saves.ts';

// A save file the dump read: its name, size and hash
type ReadSave = { name: string; size: number; sha256: string };

// The campaign the dump is of, and the save files that were read for it
type OpenedCampaign = { camp: string; saves: ReadSave[] };

const STATUS_FILE = 'Status.sokoban_status';
const HISTORY_FILE = 'overworld.history';

// src/folder.ts starts the page when it loads: timers, the remembered folder and the demo. It loads as a module of the
// same exports that do nothing.
const PAGE_START_MODULE = '/src/folder.ts';
const EXPORTED_FUNCTION = /^export\s+(?:async\s+)?function\*?\s+([\w$]+)/gm;
const EXPORTED_BINDING = /^export\s+(?:const|let|var|class)\s+([\w$]+)/gm;
function inertModuleSource(source: string): string {
    const lines: string[] = [];
    for (const [, name] of source.matchAll(EXPORTED_FUNCTION)) lines.push(`export function ${name}() {}`);
    for (const [, name] of source.matchAll(EXPORTED_BINDING)) lines.push(`export const ${name} = undefined;`);
    return lines.join('\n');
}
function loadWithoutPageStart(
    url: string,
    context: LoadHookContext,
    nextLoad: (url: string, context?: Partial<LoadHookContext>) => LoadFnOutput,
): LoadFnOutput {
    if (!url.endsWith(PAGE_START_MODULE)) return nextLoad(url, context);
    const source = readFileSync(fileURLToPath(url), 'utf8');
    return { format: 'module', source: inertModuleSource(source), shortCircuit: true };
}

// The page modules register DOM listeners when they load. These stand-ins take them; once the modules are loaded any
// further DOM use throws NoDom, so nothing is drawn.
class NoDom extends Error {}
let domOpen = true;
const inertElement = {
    addEventListener() {},
    removeEventListener() {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    dataset: {},
    style: {},
};
function queryElement() {
    if (!domOpen) throw new NoDom('the page is not drawn');
    return inertElement;
}
function installDomStandIns(): void {
    Object.assign(globalThis, {
        document: {
            querySelector: queryElement,
            querySelectorAll: () => [],
            getElementById: queryElement,
            addEventListener() {},
            removeEventListener() {},
            body: inertElement,
            documentElement: inertElement,
        },
        window: {},
        matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        addEventListener: () => {},
        removeEventListener: () => {},
    });
}

function parseArguments(argv: string[]): { input: string; outFile: string } {
    const [input, outFile] = argv;
    if (!input || !outFile) {
        console.error('Usage: node scripts/dump-model.ts <saveFolder|campaign|--demo> <outFile>');
        process.exit(2);
    }
    return { input, outFile: resolve(outFile) };
}

function saveFolderOf(input: string): string {
    if (existsSync(input) && statSync(input).isDirectory()) return resolve(input);
    return join(savesDir(), input);
}

// Maps, Sets, typed arrays, BigInts, functions and undefined as JSON values; an object met again inside itself is
// {cycle: true}
function toPlain(value: unknown, ancestors: Set<object> = new Set()): Canonical {
    switch (typeof value) {
        case 'undefined':
            return { undefined: true };
        case 'function':
            return 'fn';
        case 'bigint':
            return { bigint: value.toString() };
        case 'symbol':
            return { symbol: value.toString() };
        case 'string':
        case 'boolean':
            return value;
        case 'number':
            if (Number.isFinite(value)) return value;
            return { number: String(value) };
        default:
            // an object or null
            if (typeof value === 'object' && value !== null) return plainReference(value, ancestors);
            return null;
    }
}

function plainReference(value: object, ancestors: Set<object>): Canonical {
    if (value instanceof DataView) {
        return { dataView: Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)) };
    }
    if (isTypedArray(value)) {
        const items: Canonical[] = [];
        for (const item of value) items.push(toPlain(item));
        return items;
    }
    if (ancestors.has(value)) return { cycle: true };
    ancestors.add(value);
    const plain = plainContainer(value, ancestors);
    ancestors.delete(value);
    return plain;
}

function plainContainer(value: object, ancestors: Set<object>): Canonical {
    if (value instanceof Map) {
        return { map: [...value].map(([key, item]) => [toPlain(key, ancestors), toPlain(item, ancestors)]) };
    }
    if (value instanceof Set) return { set: [...value].map((item) => toPlain(item, ancestors)) };
    if (Array.isArray(value)) {
        const items: Canonical[] = [];
        for (let index = 0; index < value.length; index++) items.push(toPlain(value[index], ancestors));
        return items;
    }
    const plain: { [key: string]: Canonical } = {};
    for (const [key, item] of Object.entries(value)) plain[key] = toPlain(item, ancestors);
    return plain;
}

function isPrimitive(value: Canonical): value is null | string | number | boolean {
    return value === null || typeof value !== 'object';
}

// JSON of a plain value, one entry per line, but an array or object of primitives only on one line
function formatJson(value: Canonical, indent = ''): string {
    if (isPrimitive(value)) return JSON.stringify(value);
    const inner = indent + ' ';
    if (Array.isArray(value)) {
        if (!value.length) return '[]';
        if (value.every(isPrimitive)) return JSON.stringify(value);
        return `[\n${value.map((item) => inner + formatJson(item, inner)).join(',\n')}\n${indent}]`;
    }
    const entries = Object.entries(value);
    if (!entries.length) return '{}';
    if (entries.every(([, item]) => isPrimitive(item))) return JSON.stringify(value);
    const lines = entries.map(([key, item]) => `${inner}${JSON.stringify(key)}: ${formatJson(item, inner)}`);
    return `{\n${lines.join(',\n')}\n${indent}}`;
}

// a goal and its children (the towers' and the achievements'), as the page lists them
function flatGoals(goals: Goal[] | undefined): Goal[] {
    return (goals || []).flatMap((goal) => [goal, ...(goal.children || [])]);
}

function sha256(bytes: Uint8Array | string): string {
    return createHash('sha256').update(bytes).digest('hex');
}

async function loadModules() {
    registerHooks({ load: loadWithoutPageStart });
    installDomStandIns();
    const data = await import('../src/data.ts');
    const walkData = await import('../src/walk-data.ts');
    const shared = await import('../src/shared.ts');
    const save = await import('../src/save.ts');
    const files = await import('../src/files.ts');
    const fog = await import('../src/fog.ts');
    const progress = await import('../src/model/progress.ts');
    const model = await import('../src/model/progress-model.ts');
    const layers = await import('../src/model/layers.ts');
    const achievements = await import('../src/model/achievements.ts');
    const plans = await import('../src/model/plans.ts');
    const goals = await import('../src/model/goals.ts');
    const nextSteps = await import('../src/model/next-steps.ts');
    const goalRoles = await import('../src/model/goal-roles.ts');
    domOpen = false;
    await data.worldReady;
    await walkData.walkReady;
    return {
        data,
        shared,
        save,
        files,
        fog,
        layers,
        progress,
        achievements,
        plans,
        goals,
        nextSteps,
        goalRoles,
        model,
    };
}

type Modules = Awaited<ReturnType<typeof loadModules>>;

// the demo campaign as the page opens it; drawing it stops at the first DOM use
async function openDemo(modules: Modules): Promise<OpenedCampaign> {
    try {
        await modules.files.showDemo();
    } catch (error) {
        if (!(error instanceof NoDom)) throw error;
    }
    const camp = modules.shared.state.camp;
    if (camp === null || !modules.files.statusEntry(camp)) throw new Error('the demo campaign did not load');
    return { camp, saves: [] };
}

function openSaveFolder(modules: Modules, folder: string): OpenedCampaign {
    const camp = basename(folder);
    const saves: ReadSave[] = [];
    for (const name of [STATUS_FILE, HISTORY_FILE]) {
        const file = join(folder, name);
        if (!existsSync(file)) {
            if (name === STATUS_FILE) throw new Error(`no ${STATUS_FILE} in ${folder}`);
            continue;
        }
        const bytes = new Uint8Array(readFileSync(file));
        saves.push({ name, size: bytes.length, sha256: sha256(bytes) });
        const parsed = name === STATUS_FILE ? modules.save.parseStatus(bytes) : modules.save.parseHistory(bytes);
        const path = `${camp}/${name}`;
        modules.shared.state.files.set(path, { path, file: null, buf: null, parsed, error: null });
    }
    modules.shared.state.camp = camp;
    return { camp, saves };
}

type Model = ReturnType<Modules['model']['progressModel']>;
type Goal = Model['goals'][number];

function rolesOf(modules: Modules, goal: Goal): Canonical {
    const { PROG } = modules.data;
    const { roleFor } = modules.goalRoles;
    return {
        key: goal.key,
        l: PROG.levels.map((level, i) => roleFor(goal, 'l', i)),
        g: PROG.freezers.map((freezer, fi) => roleFor(goal, 'g', fi)),
    };
}

// the list order of the unsolved levels not under fog, with the model's tests of what fog hides
function nextStepOrders(modules: Modules, M: Model, goals: Goal[]): Canonical {
    const { progress } = M;
    const { orderNextSteps } = modules.nextSteps;
    const shown = {
        level: (j: number) => !progress.hidden[j],
        gate: (fi: number) => M.stepShown({ t: 'g', id: fi }),
        tower: (ti: number) => M.stepShown({ t: 't', id: ti }),
        dist: M.heroDist,
    };
    const ids = M.levels.map((level, i) => i).filter((i) => progress.state[i] !== 'solved' && !progress.hidden[i]);
    const orders: { key: string | null; order: number[] }[] = [
        { key: null, order: orderNextSteps(progress, ids, shown, null) },
    ];
    for (const goal of goals) orders.push({ key: goal.key, order: orderNextSteps(progress, ids, shown, goal) });
    return orders;
}

function stepsShown(modules: Modules, M: Model): Canonical {
    const { PROG } = modules.data;
    const nodes = M.progress.plans?.G?.node || [];
    const layers = (PROG.map?.layers || []).map((layer) => layer.key);
    return {
        nodes: nodes.map((node) => (node ? M.stepShown(node) : null)),
        layers: layers.map((key) => [key, M.stepShown({ t: 'a', id: key })]),
    };
}

function fogView(modules: Modules, M: Model): Canonical {
    const { PROG } = modules.data;
    const { FOG_LAYER_KEYS } = modules.layers;
    return {
        knownLayers: M.fog.knownLayers(),
        levelHidden: M.levels.map((level) => M.fog.levelHidden(level.n, level.p)),
        rects: FOG_LAYER_KEYS.map((key) => [key, M.fog.rects(key)]),
        open: FOG_LAYER_KEYS.map((key) => [key, M.fog.open(key)]),
        mapLayers: (PROG.map?.layers || []).map((layer) => layer.key),
    };
}

// the model's per-thing tests, over every thing they are asked about
function modelTests(modules: Modules, M: Model): Canonical {
    const { PROG } = modules.data;
    const { achievementNames } = modules.achievements;
    return {
        areaShown: (PROG.areas || []).map((area, ai) => M.areaShown(ai)),
        padDisc: M.teleporters.map((pad, i) => M.padDisc(i)),
        heard: (PROG.voice_logs || []).map((log) => M.heard(log)),
        taken: (PROG.view_givers || []).map((giver) => M.taken(giver)),
        achievementHidden: achievementNames().map((name) => [name, M.achievementHidden(name)]),
        gateArea: PROG.freezers.map((freezer, fi) => M.gateArea(fi)),
        heroDist: M.levels.map((level, i) => M.heroDist(i)),
    };
}

function modelDump(modules: Modules, camp: string, spoilersHidden: boolean): Canonical {
    const { PROG } = modules.data;
    modules.shared.setSpoilersHidden(spoilersHidden);
    const M = modules.model.progressModel(camp);
    const goals = flatGoals(M.goals);
    const { progress, status, levels, teleporters, ...rest } = M;
    return {
        spoilersHidden,
        sameAsData: { L: levels === PROG.levels, T: teleporters === (PROG.teleporters || []) },
        P: toPlain(progress),
        model: toPlain(rest),
        goalFor: M.goalFor('')?.key ?? null,
        goalLevels: goals.map((goal) => ({ key: goal.key, levels: toPlain(M.goalLevels(goal)) })),
        goalLevelsFogged: goals.map((goal) => ({ key: goal.key, fogged: M.goalLevelsFogged(goal) })),
        goalSolved: goals.map((goal) => ({ key: goal.key, levels: M.goalSolved(goal) })),
        roles: goals.map((goal) => rolesOf(modules, goal)),
        orderNextSteps: nextStepOrders(modules, M, goals),
        stepShown: stepsShown(modules, M),
        fog: fogView(modules, M),
        tests: modelTests(modules, M),
        status: toPlain(status),
    };
}

function plansDump(modules: Modules, camp: string): Canonical {
    const status = modules.files.statusEntry(camp)?.parsed;
    if (!status) throw new Error(`no status for ${camp}`);
    const history = modules.files.historyEntry(camp)?.parsed || null;
    const P = modules.progress.computeProgress(status, history);
    return {
        planAll: toPlain(modules.plans.planAll(P)),
        goalLadder: toPlain(modules.goals.goalLadder(P, status)),
    };
}

async function main(): Promise<void> {
    const { input, outFile } = parseArguments(process.argv.slice(2));
    const modules = await loadModules();
    let opened: OpenedCampaign;
    if (input === '--demo') opened = await openDemo(modules);
    else opened = openSaveFolder(modules, saveFolderOf(input));
    const dump: Canonical = {
        camp: opened.camp,
        saves: opened.saves,
        plans: plansDump(modules, opened.camp),
        spoilersHidden: modelDump(modules, opened.camp, true),
        spoilersShown: modelDump(modules, opened.camp, false),
    };
    const text = formatJson(dump) + '\n';
    writeFileSync(outFile, text);
    console.log(`${outFile}: ${Buffer.byteLength(text)} bytes, sha256 ${sha256(text)}`);
}

await main();
