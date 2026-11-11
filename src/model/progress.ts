// Completion progress of a campaign from its saves: level states, towers, Freezers, the levels the level table reaches,
// the ways into the others and the plans built on them (rules: progression.md "Level_Entry unlocking and state", the
// viewer's model: viewer.md "Level states (viewer)", data: data/progress.json)
import { PROG } from '../data.ts';
import { latestFlag, latestOf } from '../save.ts';
import type { History, LatestValues } from '../save.ts';
import type { Status } from '../status-file.ts';
import { teleporterStatesOf } from '../walk/teleporters.ts';
import type { TeleporterState } from '../walk/teleporters.ts';
import type { StoredRoles } from '../walk-data.ts';
import { goalLadder } from './goals.ts';
import type { LadderGoal } from './goals.ts';
import type { BehindState } from './level-freezers.ts';
import { ROLE } from './level-roles.ts';
import { nextSteps } from './next-steps.ts';
import type { NextStep } from './next-steps.ts';
import { planAll } from './plans.ts';
import type { Plans } from './plans.ts';
import { needsReach } from './route-needs.ts';
import type { NeedsView } from './route-needs.ts';
import { towerProgress } from './towers.ts';
import type { TowerProgress } from './towers.ts';
import { freezersOpen, isSolved, levelFlagsOf, levelStates, signRuleMet } from './unlocking.ts';
import type { LevelState, SignRule } from './unlocking.ts';
import {
    accessOf,
    frozenInOf,
    gatesBehind,
    layersReachedOf,
    leadsOf,
    signAccessOf,
    signsFacedOf,
    signWayInOf,
    unlocksOf,
    wayInFor,
} from './way-in.ts';
import type { LevelUnlocks } from './way-in.ts';

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
    /** What the save says about the things a level need or pad route can ask for. */
    needsView: NeedsView;
    /** Per Sign, whether a hero can face it: every Freezer it sits behind from the start is open. */
    signFaced: boolean[];
    /** Per Sign, the layer with no reached level that a hero must get onto to read it; null for the others. */
    signAccess: Array<string | null>;
    /** Per Sign the hero cannot face yet, the closed Freezers it sits behind. */
    signWayIn: number[][];
    /** Whether the save has a history to say which levels are reached; without one an open level is only known to be not entered. */
    reachKnown: boolean;
    /** Per level, whether the hero can walk up to its door: its needs hold, a level of its own `req` counting once reached. */
    doorReached: boolean[];
    /** The map layers that hold a reached level. */
    layersReached: ReadonlySet<string>;
    /** Per level its needs do not reach, the closed Freezers it sits behind from the start. */
    behind: number[][];
    /** Per Freezer, the levels its needs do not reach that sit behind it while it is closed. */
    leads: number[][];
    /** Per level its needs do not reach, its way-in gates; null for the others. */
    wayIn: Array<number[] | null>;
    /**
     * Per level its needs do not reach, the closed gates the endgame table asks for besides its way in, all of them
     * together (the end2 room's levels: the sky hub's Freezers).
     */
    wayInAll?: Map<number, number[]>;
    /** Per level its needs do not reach, the layer it needs a way onto; null for the others. */
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

/** The label of a level state; without a history an open level is only known to be not entered yet. */
export const stateLabel = (progress: { reachKnown: boolean }, state: LevelState): string => {
    if (state === 'unlocked' && !progress.reachKnown) return 'Not entered';
    return STATE_LABELS[state];
};

// per status: the history, the progress, the ROLE it was computed under and how to redo progress.wayIn under another
interface CachedProgress {
    history: History | null;
    progress: CampaignProgress;
    role: StoredRoles | null;
    wayIn: () => Pick<BaseProgress, 'wayIn' | 'wayInAll'>;
}

let progressCache = new WeakMap<object, CachedProgress>();

export const setProgressCache = (cache: WeakMap<object, CachedProgress>): void => {
    progressCache = cache;
};

/** Whether the progress of a status and history is worked out already. */
export const progressCached = (status: ProgressStatus, history: History | null): boolean =>
    progressCache.get(status)?.history === history;

/** The completion progress of a campaign from its status and history; the result is reused while both stay the same. */
export function computeProgress(status: ProgressStatus, history: History | null): CampaignProgress {
    const cached = progressCache.get(status);
    if (cached && cached.history === history) {
        // roles computed since: only the parts built on them change
        if (cached.role !== ROLE) {
            cached.role = ROLE;
            const { wayIn, wayInAll } = cached.wayIn();
            cached.progress.wayIn = wayIn;
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
    const needsView: NeedsView = {
        levelSolved: solved,
        signRead,
    };
    const entered = levelFlags.map((flags) => flags !== undefined);
    const ice = frozenInOf(gateOpen);
    // a level with no needs in the level data is open from the start
    const { reached: levelReached, doorReached } = needsReach(needsView, entered, ice);
    const reachKnown = !!history && !history.demo;
    const knownReach = reachKnown ? levelReached : null;
    const state = levelStates(levelFlags, knownReach);
    const unlocks = unlocksOf();
    const behindState: BehindState = { levelReached, levelSolved: solved, gateOpen };
    const behind = gatesBehind(behindState);
    const layersReached = layersReachedOf(knownReach);
    const signFaced = signsFacedOf(gateOpen);
    const wayInOf = wayInFor({ levelFlags, solved, state, unlocks, behind, gateOpen, ice });
    const { wayIn, wayInAll } = wayInOf();

    const baseProgress: BaseProgress = {
        state,
        unlocks,
        towers,
        gateOpen,
        tst: teleporterStates,
        goldFound,
        signOk,
        signRead,
        needsView,
        signFaced,
        signAccess: signAccessOf(signFaced, layersReached),
        signWayIn: signWayInOf(signFaced, gateOpen),
        reachKnown,
        doorReached,
        layersReached,
        behind,
        leads: leadsOf(behindState),
        wayIn,
        wayInAll,
        access: accessOf(state, layersReached),
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
