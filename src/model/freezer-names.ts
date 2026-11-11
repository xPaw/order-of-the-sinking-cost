// What the page calls a Freezer, by its model: the pod (model A) is a cage, the doorway (model B, `doorway`) a gate
// (viewer.md "The page (viewer)")
import { PROG } from '../data.ts';

/** Whether the Freezer is the doorway model. */
export const isDoorway = (freezer: number): boolean => !!PROG.freezers[freezer].doorway;

/** "cage" or "gate". */
export function freezerNoun(freezer: number): string {
    if (isDoorway(freezer)) return 'gate';
    return 'cage';
}

/** The plural of one model: "gates" for the doorways, else "cages". */
export function modelNoun(doorway: boolean): string {
    if (doorway) return 'gates';
    return 'cages';
}

/** "cages", "gates", or "cages and gates" when the Freezers are of both models; "cages" for none. */
export function freezersNoun(indices: number[]): string {
    const doorways = indices.filter(isDoorway).length;
    if (doorways === 0) return modelNoun(false);
    if (doorways === indices.length) return modelNoun(true);
    return 'cages and gates';
}

/** A noun with a capital first letter, for labels: "Cage". */
export const capitalized = (noun: string): string => noun[0].toUpperCase() + noun.slice(1);
