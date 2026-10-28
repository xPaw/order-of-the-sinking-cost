// Completion progress of a campaign from its saves: level states, towers, Freezers, the walk's reach, the ways into
// the levels it cannot reach and the plans built on them (rules: PROGRESSION.md "Level_Entry unlocking and state", the
// viewer's model: VIEWER.md "Level states (viewer)", data: data/progress.json)
import { PROG, WORLD } from '../data.ts';
import { latestFlag, latestOf } from '../save.ts';
import type { History, LatestValues } from '../save.ts';
import type { Status } from '../status-file.ts';
import type { KnownRoute } from '../types.ts';
import { reachability } from '../walk/reachability.ts';
import type { Reachability } from '../walk/reachability.ts';
import { teleporterStatesOf } from '../walk/teleporters.ts';
import type { TeleporterState } from '../walk/teleporters.ts';
import type { StoredRoles } from '../walk-data.ts';
import { goalLadder } from './goals.ts';
import type { LadderGoal } from './goals.ts';
import { metRoutes } from './known-routes.ts';
import { ROLE } from './level-roles.ts';
import { nextSteps } from './next-steps.ts';
import type { NextStep } from './next-steps.ts';
import { planAll } from './plans.ts';
import type { Plans } from './plans.ts';
import { towerProgress } from './towers.ts';
import type { TowerProgress } from './towers.ts';
import { freezersOpen, isSolved, levelFlagsOf, levelStates, signRuleMet } from './unlocking.ts';
import type { LevelFlags, LevelState, SignRule } from './unlocking.ts';
import { accessOf, gatesBehind, signAccessOf, signWayInOf, unlocksOf, wayInModel } from './way-in.ts';
import type { LevelUnlocks, WhyBlocked } from './way-in.ts';

export const RANKS = ['Visitor', 'Egressant', 'Pusher', 'Arranger', 'Intrepid', 'Sokoban'];

export const STATE_LABELS: Record<LevelState, string> = {
    solved: 'Solved',
    partial: 'Partially solved',
    visited: 'Entered',
    unlocked: 'Reachable',
    blocked: 'Blocked',
    locked: 'Locked',
};

/** The parts of a status the progress is worked out from. */
export type ProgressStatus = Pick<Status, 'rank' | 'achievements' | 'treasureFlags' | 'levels' | 'openedFreezers'>;

/** Completion progress of a campaign, before the plans built on it. */
export interface BaseProgress {
    state: LevelState[];
    /** Per level, the levels that require it. */
    unlocks: LevelUnlocks[];
    towers: TowerProgress[];
    /** Per Freezer, whether it is open. */
    gateOpen: boolean[];
    /** Per teleporter, its state. */
    tst: TeleporterState[];
    /** The gold rooms found. */
    goldFound: number;
    /** Whether a Sign's rule holds. */
    signOk: (rule: SignRule) => boolean;
    /** Whether the hero has read a Sign (by pid); the Freezers it opens open only then. */
    signRead: (pid: number) => boolean;
    /** Whether the save has smashed a Rock (by pid). */
    rockSmashed: (pid: number) => boolean;
    /** Per Sign, the layer the walk reaches nowhere that a hero must get onto to read it; null for the others. */
    signAccess: Array<string | null>;
    /** Per Sign the hero cannot face yet, the closed Freezers whose opening lets the walk face it. */
    signWayIn: number[][];
    /** The walk over the overworld state; null for the empty save. */
    reach: Reachability | null;
    /** Per level, the closed gates whose leads or pocket hold it. */
    behind: number[][];
    /** Per level the walk cannot reach, why it may still be; null for the others. */
    why: Array<WhyBlocked | null>;
    /** Per level the walk cannot reach, its way-in gates; null for the others. */
    wayIn: Array<number[] | null>;
    /**
     * Per level the walk cannot reach, its way-in gates that open onto nothing but more closed Freezers, each with the
     * ways through it: the gates all needed together; null for a level with none.
     */
    wayInChains: Array<Map<number, number[][]> | null>;
    /**
     * Per level the walk cannot reach, the closed gates the endgame table asks for besides its way in, all of them
     * together (the end2 room's levels: the sky hub's Freezers).
     */
    wayInAll?: Map<number, number[]>;
    /** The levels whose way in is the level data's alone. */
    wayInFixed: Set<number>;
    /** Per level the walk cannot reach, the layer it needs a way onto; null for the others. */
    access: Array<string | null>;
    /** Per level, the closed Freezer it is frozen in. */
    ice: Array<number | undefined>;
    /** The latest values of the history; null without one. */
    lt: LatestValues | null;
    /** The levels solved. */
    solved: number;
}

/** Completion progress of a campaign. */
export interface CampaignProgress extends BaseProgress {
    plans: Plans;
    needed: Array<NextStep | null>;
    goals: LadderGoal[];
}

/** The progress with what the fog hides: per level and per tower. */
export type ShownProgress = CampaignProgress & { hidden: boolean[]; towerHidden: boolean[] };

/** The label of a level state; without a reachability model an open level is only known to be not entered yet. */
export const stateLabel = (progress: { reach: Reachability | null }, state: LevelState): string => {
    if (state === 'unlocked' && !progress.reach) return 'Not entered';
    return STATE_LABELS[state];
};

// per status: the history, the progress, the ROLE it was computed under and how to redo progress.wayIn and
// progress.wayInChains under another
interface CachedProgress {
    history: History | null;
    progress: CampaignProgress;
    role: StoredRoles | null;
    wayIn: () => Pick<BaseProgress, 'wayIn' | 'wayInChains' | 'wayInAll'>;
}

let progressCache = new WeakMap<object, CachedProgress>();

export const setProgressCache = (cache: WeakMap<object, CachedProgress>): void => {
    progressCache = cache;
};

/** Whether the progress of a status and history is worked out already. */
export const progressCached = (status: ProgressStatus, history: History | null): boolean =>
    progressCache.get(status)?.history === history;

// the walk over the overworld state; null for the empty save, which has no walked places to start the fill from
function reachOf(
    history: History | null,
    latest: LatestValues | null,
    teleporterStates: TeleporterState[],
    gateOpen: boolean[],
    levelFlags: LevelFlags,
    routes: KnownRoute[],
): Reachability | null {
    if (!history || !latest || !WORLD || !PROG.world || history.demo) return null;

    const closed = gateOpen.map((open) => !open);
    const entered = levelFlags.map((flags) => flags !== undefined);
    return reachability(history, latest, teleporterStates, closed, entered, routes);
}

/** The completion progress of a campaign from its status and history; the result is reused while both stay the same. */
export function computeProgress(status: ProgressStatus, history: History | null): CampaignProgress {
    const cached = progressCache.get(status);
    if (cached && cached.history === history) {
        // roles computed since: only the parts built on them change
        if (cached.role !== ROLE) {
            cached.role = ROLE;
            const { wayIn, wayInChains, wayInAll } = cached.wayIn();
            cached.progress.wayIn = wayIn;
            cached.progress.wayInChains = wayInChains;
            cached.progress.wayInAll = wayInAll;
            cached.progress.plans = planAll(cached.progress);
            cached.progress.needed = nextSteps(cached.progress, status);
            cached.progress.goals = goalLadder(cached.progress, status);
        }
        return cached.progress;
    }

    const levelFlags = levelFlagsOf(status);
    const solved = (level: number) => isSolved(levelFlags, level);
    const towers = towerProgress(solved);
    const latest = history ? latestOf(history) : null;
    const teleporterStates = teleporterStatesOf(latest);
    const goldFound = (PROG.teleporters || []).filter(
        (teleporter, i) => teleporter.gold && teleporterStates[i].disc,
    ).length;
    const signOk = (rule: SignRule) => signRuleMet(rule, status, towers, goldFound);
    const signRead = (pid: number) => latestFlag(latest, pid, 'rank_satisfied');
    const gateOpen = freezersOpen(status, levelFlags, signRead);
    const rockSmashed = (pid: number) => !!latest?.created.get(pid)?.destroyed;
    const routes = metRoutes({ levelSolved: solved, freezerOpen: (index) => gateOpen[index], signRead, rockSmashed });
    const reach = reachOf(history, latest, teleporterStates, gateOpen, levelFlags, routes);
    const state = levelStates(levelFlags, reach);
    const unlocks = unlocksOf();
    const behind = gatesBehind(reach);
    const { why, wayInOf, wayInFixed, ice } = wayInModel({
        levelFlags,
        solved,
        state,
        reach,
        unlocks,
        behind,
        gateOpen,
        towers,
    });
    const { wayIn, wayInChains, wayInAll } = wayInOf();

    const baseProgress: BaseProgress = {
        state,
        unlocks,
        towers,
        gateOpen,
        tst: teleporterStates,
        goldFound,
        signOk,
        signRead,
        rockSmashed,
        signAccess: signAccessOf(reach),
        signWayIn: signWayInOf(reach, gateOpen),
        reach,
        behind,
        why,
        wayIn,
        wayInChains,
        wayInAll,
        wayInFixed,
        access: accessOf(state, reach),
        ice,
        lt: latest,
        solved: state.filter((levelState) => levelState === 'solved').length,
    };

    const progress: CampaignProgress = { ...baseProgress, plans: planAll(baseProgress), needed: [], goals: [] };
    progress.needed = nextSteps(progress, status);
    progress.goals = goalLadder(progress, status);
    progressCache.set(status, { history, progress, role: ROLE, wayIn: wayInOf });
    return progress;
}
