// The Credits entry of the sidebar's Find on the map: the voice logs of the `intro` level and the levels that only the
// `intro` level opens, as chains in unlock order (viewer.md "The page (viewer)"). It has no place on the map and is no
// goal.
import { PROG } from '../data.ts';
import { latestFlag } from '../save.ts';
import type { LatestValues } from '../save.ts';
import type { Status } from '../status-file.ts';
import { hasAchievement } from './achievements.ts';
import { flagsSolved, statusFlags } from './unlocking.ts';

/** What stands for a level's name while it is hidden. */
export const HIDDEN_CREDITS_LEVEL = 'Level';

/** How far the save is in a level of a chain: not in the status's level table, entered, or solved. */
export type CreditsStepStatus = 'locked' | 'entered' | 'solved';

/** A level of a chain: its name (or the plain word while hidden) and how far the save is in it. */
export interface CreditsStep {
    label: string;
    status: CreditsStepStatus;
}

/** The levels of one chain in unlock order; `done` when every step the Credits counts is solved. */
export interface CreditsChain {
    steps: CreditsStep[];
    done: boolean;
}

/** The Credits list: whether each listed voice log is heard, the chains, and how many are done of how many. */
export interface CreditsView {
    heard: boolean[];
    chains: CreditsChain[];
    done: number;
    total: number;
}

/**
 * The Credits list of a save. A voice log is heard once its `played` change is in the intro history (`intro`, null
 * without one); a level is found once the status's level table holds it, and done when its flags say it is solved. A
 * level that is also an overworld level is a step of its chain but is not counted. With spoilers hidden, a counted thing
 * is listed once it is found or the ending that gates it is earned (or it has no ending), the total is the number
 * listed, a chain is listed with its first counted step, and an unsolved level goes unnamed.
 */
export function creditsOf(
    status: { levels: Status['levels']; achievements: bigint },
    intro: LatestValues | null,
    hide: boolean,
): CreditsView {
    const heardLogs: boolean[] = [];
    const chains: CreditsChain[] = [];
    let done = 0;
    let total = 0;

    const flagsByName = statusFlags(status);
    const listed = (found: boolean, ending: string | undefined): boolean => {
        if (!hide || found) return true;
        return ending === undefined || hasAchievement(status, ending);
    };

    for (const log of PROG.credits.logs) {
        const heard = latestFlag(intro, log.pid, 'played');
        if (!listed(heard, log.e)) continue;

        total++;
        if (heard) done++;
        heardLogs.push(heard);
    }

    for (const chain of PROG.credits.chains) {
        const steps: CreditsStep[] = [];
        let counted = 0;
        let solvedCounted = 0;
        for (const level of chain) {
            const flags = flagsByName.get(level.n);
            if (!level.o && !listed(flags !== undefined, level.e)) continue;

            const solved = flagsSolved(flags);
            let stepStatus: CreditsStepStatus = 'locked';
            if (solved) {
                stepStatus = 'solved';
            } else if (flags !== undefined) {
                stepStatus = 'entered';
            }

            let label = level.n;
            if (hide && !solved) label = HIDDEN_CREDITS_LEVEL;
            steps.push({ label, status: stepStatus });
            if (!level.o) {
                counted++;
                if (solved) solvedCounted++;
            }
        }

        if (counted === 0) continue;

        total += counted;
        done += solvedCounted;
        chains.push({ steps, done: solvedCounted === counted });
    }

    return { heard: heardLogs, chains, done, total };
}
