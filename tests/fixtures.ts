// Fixtures shared by the tests that build synthetic overworlds and progress
import { freshCampaign } from '../scripts/lib/walk-fingerprint.ts';
import type { Campaign } from '../scripts/lib/walk-fingerprint.ts';
import { PROG } from '../src/data.ts';
import { FOG_LAYER_KEYS } from '../src/model/layers.ts';
import { computeProgress } from '../src/model/progress.ts';
import { latestOf, overrideLatest } from '../src/save.ts';
import { state } from '../src/shared.ts';
import type { LatestValues } from '../src/save.ts';
import type { Freezer, Position, ProgressLevel, Teleporter } from '../src/types.ts';

/** Per column, the z values or ocean indices. */
export type Columns = Record<number, number[]>;

/** Rows of the world's entity lists a test sets. */
export type Rows = Record<string, unknown[]>;

/** Latest values with nothing read, created, skilled or turned. */
export const NONE: LatestValues = {
    get: () => undefined,
    ocean: [],
    created: new Map(),
    skills: new Map(),
    firstHeadings: new Map(),
};

/** A level with the fields a test leaves out set to ones that point nowhere. */
export const level = (name: string, extra: Partial<ProgressLevel> = {}): ProgressLevel => ({
    n: name,
    p: [0, 0, 0],
    glow: 'green',
    req: [],
    ...extra,
});

export const progressLevel = (extra: Partial<ProgressLevel> = {}): ProgressLevel => level('', extra);

export const freezerAt = (pid: number, p: Position): Freezer => ({ pid, p, l: 0, req: [] });

// an enabled minor pad; `to` is the position of a target that is not a pad
export const padAt = (pid: number, p: Position, target: number, to?: Position): Teleporter => {
    const teleporter: Teleporter = { pid, p, l: 0, major: 0, target, en: 1 };
    if (to) teleporter.to = to;
    return teleporter;
};

// a pad with the fields a test leaves out set to ones that point nowhere
export function pad(fields: Partial<Teleporter> & Pick<Teleporter, 'pid'>): Teleporter {
    return { p: [0, 0, 0], l: 0, major: 0, target: 0, en: 0, ...fields };
}

/** The bytes of a little-endian float32. */
export const f32 = (value: number) => new Uint8Array(new Float32Array([value]).buffer);

const READ = Uint8Array.of(1);

/** The rank 1 Sign by the Bard and Druid area, which opens two Freezers. */
export const RANK_ONE_SIGN_PID = 111245225;
/** A tower Sign, which opens one Freezer. */
export const TOWER_SIGN_PID = 115348482;

/** What a synthetic campaign has beyond the fresh one. */
export interface CampaignOptions {
    rank?: number;
    /** Signs with `rank_satisfied` in the history. */
    readPids?: number[];
    /** Freezers listed opened in the status. */
    openedPids?: number[];
    /** Clear every region of the ground layer's fog, so the ground is shown and the sky and underworld stay hidden. */
    groundShown?: boolean;
}

// every region of the fog entities on the ground layer cleared
function clearGroundFog(fogStates: Map<number, Uint8Array>): void {
    const fog = PROG.fog;
    const [columns, rows] = fog.grid.count;
    const groundIndex = FOG_LAYER_KEYS.indexOf('ground');

    for (const primary of fog.primary) {
        if (primary.layer !== groundIndex) continue;

        fogStates.set(primary.pid, new Uint8Array(columns * rows).fill(2));
    }
}

/** The fresh campaign with a rank, Signs read in its history, Freezers opened in its status and the ground fog cleared. */
export function syntheticCampaign(options: CampaignOptions = {}): Campaign {
    const { rank = 0, readPids = [], openedPids = [], groundShown = false } = options;
    const { status, history } = freshCampaign();
    const fogStates = new Map(history.fogStates);
    if (groundShown) clearGroundFog(fogStates);

    const built: Campaign = {
        status: { ...status, rank, openedFreezers: [...status.openedFreezers, ...openedPids] },
        history: { ...history, fogStates },
    };

    const read = new Set(readPids);
    const latest = latestOf(built.history);
    overrideLatest(built.history, {
        ...latest,
        get: (pid: number, field: string) => {
            if (field === 'rank_satisfied' && read.has(pid)) return READ;
            return latest.get(pid, field);
        },
    });

    return built;
}

/** Lists the campaign's status and history among the loaded files under the campaign name `name`. */
export function registerCampaign(name: string, loaded: Campaign): void {
    state.files.set(`${name}/Status.sokoban_status`, {
        path: `${name}/Status.sokoban_status`,
        parsed: loaded.status,
        file: null,
        buf: null,
        error: null,
    });
    state.files.set(`${name}/overworld.history`, {
        path: `${name}/overworld.history`,
        parsed: loaded.history,
        file: null,
        buf: null,
        error: null,
    });
}

/** The progress of the fresh campaign at `rank`, with the Signs of `readPids` read and the Freezers of `openedPids` open. */
export function campaign(rank: number, readPids: number[] = [], openedPids: number[] = []) {
    const { status, history } = syntheticCampaign({ rank, readPids, openedPids });
    return computeProgress(status, history);
}
