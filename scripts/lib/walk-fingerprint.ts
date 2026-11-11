// A canonical, deterministic fingerprint of everything the overworld walk computes for one input, to prove that a faster
// replacement of part of the walk changes no answer.
//
// A fingerprint is { digest, hashes, fields }. `fields` holds one canonical value per walk output, `hashes` a short hash
// of each one's text and `digest` a hash of all the hashes, so a comparison names the field that changed. Canonical
// means: object keys sorted, Maps as objects with sorted keys, Sets as sorted arrays, typed arrays as arrays. Arrays
// otherwise keep their order. The iteration order of a Map or a Set is not compared.
//
// The inputs:
//   a save: computeProgress() of a Status and a History, the walker built for the same overworld state, and the walk's
//     reachability result
//   the fresh campaign: the empty save's status and history with the `demo` flag cleared, so the walk runs from the new
//     game's start position
//   NO_HISTORY: the level data alone, walked twice as the page does: every pad on and no Freezer closed (the map's floor
//     heights), and the new game's start (teleporterStatesOf(null), every Freezer closed) that staticRoles() uses
//   staticRoles(): the level roles
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PROG } from '../../src/data.ts';
import { worldReady } from '../../src/world-data.ts';
import { DEMO_STATUS, demoHistory } from '../../src/demo-save.ts';
import { computeProgress, setProgressCache, type ProgressStatus } from '../../src/model/progress.ts';
import { levelNeedsMet, metPadRoutes } from '../../src/model/route-needs.ts';
import { staticRoles } from '../../src/model/static-roles.ts';
import { isEntered } from '../../src/model/unlocking.ts';
import type { History } from '../../src/history-file.ts';
import { parseHistory, parseStatus } from '../../src/save.ts';
import type { DemoStatus, Status } from '../../src/status-file.ts';
import { floorHeights, NO_HISTORY, reachability } from '../../src/walk/reachability.ts';
import { setRoomAnswers } from '../../src/walk/room-answers.ts';
import { teleporterStatesOf } from '../../src/walk/teleporters.ts';
import { walker, type Walker } from '../../src/walk/walker.ts';
import { walkReady } from '../../src/walk-data.ts';
import { savesDir } from '../saves.ts';
import { isTypedArray, type Canonical } from './plain.ts';
import { storedRooms } from './stored-rooms.ts';

const STATUS_FILE = 'Status.sokoban_status';
const HISTORY_FILE = 'overworld.history';
const HASH_LENGTH = 12;
const DIFFERENCE_LINES = 8;
const LISTED_ITEMS = 6;

const PROGRESS_FIELDS = ['state', 'wayIn', 'access', 'ice', 'behind', 'needed', 'plans', 'goals'] as const;

/** The walk outputs by field name, as the walk computes them. */
export interface WalkOutputs {
    'reach.reached'?: Set<number>;
    [name: string]: unknown;
}

export interface Fingerprint {
    digest: string;
    hashes: Record<string, string>;
    fields: Record<string, Canonical>;
}

/** The status and history of a campaign. */
export interface Campaign {
    status: DemoStatus;
    history: History;
}

type CanonicalObject = { [key: string]: Canonical };

/** Loads the level data, the stored floor heights and the stored room answers, which the walkers use; await it before fingerprinting. */
export async function walkLoaded(): Promise<void> {
    await worldReady;
    await walkReady;
    setRoomAnswers(storedRooms());
}

function compareCanonical(left: Canonical, right: Canonical): number {
    if (typeof left === 'number' && typeof right === 'number') return left - right;

    const leftText = JSON.stringify(left);
    const rightText = JSON.stringify(right);
    if (leftText < rightText) return -1;
    if (leftText > rightText) return 1;
    return 0;
}

function canonicalMap(map: Map<unknown, unknown>, ancestors: Set<object>): CanonicalObject {
    const entries = [...map].map(([key, item]): [number | string, Canonical] => {
        if (typeof key !== 'number' && typeof key !== 'string') throw new Error(`Map key ${String(key)} is no number`);
        return [key, canonical(item, ancestors)];
    });
    entries.sort((left, right) => compareCanonical(left[0], right[0]));

    const plain: CanonicalObject = {};
    for (const [key, item] of entries) plain[String(key)] = item;
    return plain;
}

function canonicalObject(value: object, ancestors: Set<object>): CanonicalObject {
    const plain: CanonicalObject = {};
    for (const key of Object.keys(value).toSorted()) plain[key] = canonical(Reflect.get(value, key), ancestors);
    return plain;
}

function canonicalContainer(value: object, ancestors: Set<object>): Canonical {
    if (value instanceof Map) return canonicalMap(value, ancestors);
    if (value instanceof Set) return [...value].map((item) => canonical(item, ancestors)).toSorted(compareCanonical);
    if (Array.isArray(value)) {
        const items: Canonical[] = [];
        for (let index = 0; index < value.length; index++) items.push(canonical(value[index], ancestors));
        return items;
    }
    return canonicalObject(value, ancestors);
}

function canonicalReference(value: object, ancestors: Set<object>): Canonical {
    if (isTypedArray(value)) {
        const items: Canonical[] = [];
        for (const item of value) items.push(canonical(item, ancestors));
        return items;
    }
    if (ancestors.has(value)) throw new Error('a value that contains itself has no canonical form');

    ancestors.add(value);
    const plain = canonicalContainer(value, ancestors);
    ancestors.delete(value);
    return plain;
}

/**
 * The canonical form of a value: plain JSON values only, with objects' keys sorted, Maps as objects, Sets as sorted
 * arrays and typed arrays as arrays. What JSON cannot hold is a marker object: `{ $: 'undefined' }`, `{ $: 'NaN' }`,
 * `{ $: 'function' }` and `{ $bigint: digits }`.
 */
export function canonical(value: unknown, ancestors: Set<object> = new Set()): Canonical {
    switch (typeof value) {
        case 'undefined':
            return { $: 'undefined' };
        case 'function':
            return { $: 'function' };
        case 'bigint':
            return { $bigint: value.toString() };
        case 'symbol':
            return { $: value.toString() };
        case 'string':
        case 'boolean':
            return value;
        case 'number':
            if (Number.isFinite(value)) return value;
            return { $: String(value) };
        default:
            // an object or null
            if (typeof value === 'object' && value !== null) return canonicalReference(value, ancestors);
            return null;
    }
}

function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

/** The fingerprint of a record of walk outputs, by field name. */
export function fingerprintOf(outputs: WalkOutputs): Fingerprint {
    const fields: Record<string, Canonical> = {};
    const hashes: Record<string, string> = {};
    const digestLines: string[] = [];

    for (const name of Object.keys(outputs).toSorted()) {
        fields[name] = canonical(outputs[name]);
        hashes[name] = sha256(JSON.stringify(fields[name])).slice(0, HASH_LENGTH);
        digestLines.push(`${name} ${hashes[name]}`);
    }

    return { digest: sha256(digestLines.join('\n')).slice(0, HASH_LENGTH), hashes, fields };
}

/** Per map layer, the columns that are set, as a sorted list: the dense per-column arrays are mostly zero. */
function columnsSet(columnsByLayer: Record<string, ArrayLike<number>>): Record<string, number[]> {
    const setColumns: Record<string, number[]> = {};
    for (const [layerKey, columns] of Object.entries(columnsByLayer)) {
        setColumns[layerKey] = [];
        for (let column = 0; column < columns.length; column++) {
            if (columns[column] !== 0) setColumns[layerKey].push(column);
        }
    }
    return setColumns;
}

/** Per map layer, the [column, height] pairs of the columns that have a height. */
function heightsSet(heightsByLayer: Record<string, ArrayLike<number>>): Record<string, [number, number][]> {
    const heightPairs: Record<string, [number, number][]> = {};
    for (const [layerKey, heights] of Object.entries(heightsByLayer)) {
        heightPairs[layerKey] = [];
        for (let column = 0; column < heights.length; column++) {
            if (!Number.isNaN(heights[column])) heightPairs[layerKey].push([column, heights[column]]);
        }
    }
    return heightPairs;
}

/** What a walker computes on its own: the pad linkage, the skip lanes, the hops and the cell sets. */
function walkerOutputs(prefix: string, walk: Walker): WalkOutputs {
    const outputs: WalkOutputs = {};
    outputs[`${prefix}.shown`] = walk.shown.map((padIndices) => padIndices.toSorted((left, right) => left - right));
    outputs[`${prefix}.lanes`] = walk.lanes;
    outputs[`${prefix}.hops`] = walk.hops;
    outputs[`${prefix}.driftHops`] = walk.driftHops;
    outputs[`${prefix}.fire`] = walk.fire;
    outputs[`${prefix}.beam`] = walk.beam;
    outputs[`${prefix}.thru`] = walk.thru;
    outputs[`${prefix}.openBeam`] = walk.openBeam;
    return outputs;
}

/**
 * The walk outputs for a campaign's status and history: the reachability result (`reach.*`, the reached cells as
 * `reach.reached`), what computeProgress derives from it (`progress.*`) and the walker's own outputs (`walker.*`),
 * built for the same overworld state.
 */
export function saveOutputs(status: ProgressStatus, history: History): WalkOutputs {
    setProgressCache(new WeakMap());
    const progress = computeProgress(status, history);
    const outputs: WalkOutputs = {};

    for (const name of PROGRESS_FIELDS) outputs[`progress.${name}`] = progress[name];

    if (!progress.reachKnown || progress.lt === null) return outputs;

    const closedFreezers = progress.gateOpen.map((open) => !open);
    const entered = progress.state.map(isEntered);
    const reach = reachability(
        history,
        progress.lt,
        progress.tst,
        closedFreezers,
        entered,
        metPadRoutes(progress.needsView),
        levelNeedsMet(progress.needsView),
    );
    for (const [name, value] of Object.entries(reach)) {
        if (name === 'cols') outputs['reach.cols'] = columnsSet(value);
        else outputs[`reach.${name}`] = value;
    }

    Object.assign(outputs, walkerOutputs('walker', walker(progress.lt, progress.tst, closedFreezers)));
    return outputs;
}

/** The walk outputs for the level data alone (NO_HISTORY): see the header for the two walkers. */
export function noHistoryOutputs(): WalkOutputs {
    const everyPadOn = PROG.teleporters.map(() => ({ en: true, disc: true }));
    const outputs: WalkOutputs = {};
    Object.assign(outputs, walkerOutputs('allPadsOn', walker(NO_HISTORY, everyPadOn, [])));

    const allFreezersClosed = PROG.freezers.map(() => true);
    const startWalker = walker(NO_HISTORY, teleporterStatesOf(null), allFreezersClosed);
    Object.assign(outputs, walkerOutputs('start', startWalker));

    const heights = floorHeights();
    if (heights === null) throw new Error('the floor heights are not available');
    outputs['floorHeights'] = heightsSet(heights);
    return outputs;
}

/** The walk outputs of staticRoles(). */
export function staticRolesOutputs(): WalkOutputs {
    const roles = staticRoles();
    if (roles === null) throw new Error('no static roles');
    return {
        'need.l': roles.need.l,
        'need.g': roles.need.g,
        'bg.g': roles.bg.g,
    };
}

/** The empty save with its `demo` flag cleared, so the walk runs from the new game's start: { status, history }. */
export function freshCampaign(): Campaign {
    return { status: DEMO_STATUS, history: { ...demoHistory(), demo: false } };
}

/** The folder of a campaign: a folder path as given, else a campaign name in the saves folder. */
export function saveFolderOf(input: string): string {
    if (existsSync(input) && statSync(input).isDirectory()) return resolve(input);
    return join(savesDir(), input);
}

/** Reads a campaign folder's status and history in place: { status, history }. */
export function readSaveFolder(folder: string): { status: Status; history: History } {
    const statusFile = join(folder, STATUS_FILE);
    const historyFile = join(folder, HISTORY_FILE);
    if (!existsSync(statusFile)) throw new Error(`no ${STATUS_FILE} in ${folder}`);
    if (!existsSync(historyFile)) throw new Error(`no ${HISTORY_FILE} in ${folder}`);

    const status = parseStatus(new Uint8Array(readFileSync(statusFile)));
    const history = parseHistory(new Uint8Array(readFileSync(historyFile)));
    return { status, history };
}

/** The text of a fingerprint file: JSON with one field per line, so a text diff names the field. */
export function fingerprintText(fingerprint: Fingerprint): string {
    const hashLines = Object.entries(fingerprint.hashes).map(([name, hash]) => `${JSON.stringify(name)}: "${hash}"`);
    const fieldLines = Object.entries(fingerprint.fields).map(
        ([name, value]) => `${JSON.stringify(name)}: ${JSON.stringify(value)}`,
    );
    return [
        '{',
        `"digest": "${fingerprint.digest}",`,
        `"hashes": {\n${hashLines.join(',\n')}\n},`,
        `"fields": {\n${fieldLines.join(',\n')}\n}`,
        '}',
        '',
    ].join('\n');
}

function isPlainObject(value: Canonical | undefined): value is CanonicalObject {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function describeNumberLists(before: number[], after: number[], path: string, lines: string[]): void {
    const beforeSet = new Set(before);
    const afterSet = new Set(after);
    const removed = before.filter((item) => !afterSet.has(item));
    const added = after.filter((item) => !beforeSet.has(item));
    const parts: string[] = [];
    if (removed.length > 0) parts.push(`${removed.length} only before [${removed.slice(0, LISTED_ITEMS).join(', ')}]`);
    if (added.length > 0) parts.push(`${added.length} only after [${added.slice(0, LISTED_ITEMS).join(', ')}]`);

    if (parts.length > 0) {
        lines.push(`${path}: ${parts.join(', ')}`);
        return;
    }

    if (before.length !== after.length) {
        lines.push(`${path}: same items, length ${before.length} -> ${after.length}`);
        return;
    }

    let shown = 0;
    for (let index = 0; index < before.length && shown < LISTED_ITEMS; index++) {
        if (before[index] === after[index]) continue;
        lines.push(`${path}[${index}]: ${before[index]} -> ${after[index]}`);
        shown++;
    }
}

function describeArrays(before: Canonical[], after: Canonical[], path: string, lines: string[]): void {
    if (before.every((item) => typeof item === 'number') && after.every((item) => typeof item === 'number')) {
        describeNumberLists(before, after, path, lines);
        return;
    }

    if (before.length !== after.length) lines.push(`${path}: length ${before.length} -> ${after.length}`);

    const common = Math.min(before.length, after.length);
    for (let index = 0; index < common && lines.length < DIFFERENCE_LINES; index++) {
        describeDifference(before[index], after[index], `${path}[${index}]`, lines);
    }
}

function describeObjects(before: CanonicalObject, after: CanonicalObject, path: string, lines: string[]): void {
    const beforeKeys = Object.keys(before);
    const afterKeys = Object.keys(after);
    const removed = beforeKeys.filter((key) => !(key in after));
    const added = afterKeys.filter((key) => !(key in before));
    if (removed.length > 0) lines.push(`${path}: keys only before [${removed.slice(0, LISTED_ITEMS).join(', ')}]`);
    if (added.length > 0) lines.push(`${path}: keys only after [${added.slice(0, LISTED_ITEMS).join(', ')}]`);

    for (const key of beforeKeys) {
        if (lines.length >= DIFFERENCE_LINES) return;
        if (key in after) describeDifference(before[key], after[key], `${path}.${key}`, lines);
    }
}

/** Appends to `lines` where two canonical values differ, at most DIFFERENCE_LINES lines in all. */
function describeDifference(before: Canonical, after: Canonical, path: string, lines: string[]): void {
    if (lines.length >= DIFFERENCE_LINES) return;
    if (JSON.stringify(before) === JSON.stringify(after)) return;

    if (Array.isArray(before) && Array.isArray(after)) {
        describeArrays(before, after, path, lines);
    } else if (isPlainObject(before) && isPlainObject(after)) {
        describeObjects(before, after, path, lines);
    } else {
        lines.push(`${path}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    }
}

/**
 * Compares two fingerprints: the lines that name each field that differs, with where it differs, or an empty list when
 * they are identical.
 */
export function diffFingerprints(before: Fingerprint, after: Fingerprint): string[] {
    const lines: string[] = [];
    const names = [...new Set([...Object.keys(before.hashes), ...Object.keys(after.hashes)])].toSorted();

    for (const name of names) {
        if (!(name in after.hashes)) {
            lines.push(`${name}: only in the first (${before.hashes[name]})`);
        } else if (!(name in before.hashes)) {
            lines.push(`${name}: only in the second (${after.hashes[name]})`);
        } else if (before.hashes[name] !== after.hashes[name]) {
            lines.push(`${name}: ${before.hashes[name]} -> ${after.hashes[name]}`);
            const details: string[] = [];
            describeDifference(before.fields[name], after.fields[name], name, details);
            for (const detail of details) lines.push(`    ${detail}`);
        }
    }

    return lines;
}
