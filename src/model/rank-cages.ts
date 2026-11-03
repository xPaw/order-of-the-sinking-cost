// The cages that rank Signs open, for the results list of the ending being worked toward (VIEWER.md "Goals (viewer)")
import { PROG } from '../data.ts';

/** A closed cage whose rank Sign's rank is reached. */
export interface RankCage {
    /** Index into `freezers`. */
    gate: number;
    /** Index into `signs` of the rank Sign that lists it. */
    sign: number;
    /** Whether the cell holds a Promesst_Light or a Mirror. */
    liftPiece: boolean;
}

/** What the cages are picked from: the rank reached, which cages are open and which things fog leaves shown. */
export interface RankCageInput {
    rank: number;
    gateOpen: boolean[];
    gateShown: (gate: number) => boolean;
    signShown: (sign: number) => boolean;
}

// the world.movables kinds of a Promesst_Light and a Mirror
const LIGHT_KIND = 1;
const MIRROR_KIND = 2;

// a Sign that asks for any rank, which is no rank Sign
const ANY_RANK = 255;

let liftGateCache: Set<number> | undefined;

// the Freezers whose cell is the position of a Promesst_Light or a Mirror
function liftGatesOf(): Set<number> {
    if (liftGateCache) return liftGateCache;

    const [cornerX, cornerY] = PROG.world.grid.corner;
    const liftKeys = new Set<string>();
    for (const [, column, row, z, kind] of PROG.world.movables) {
        if (kind === LIGHT_KIND || kind === MIRROR_KIND) liftKeys.add(`${column + cornerX},${row + cornerY},${z}`);
    }

    const liftGates = new Set<number>();
    PROG.freezers.forEach((freezer, freezerIndex) => {
        if (liftKeys.has(freezer.p.join(','))) liftGates.add(freezerIndex);
    });

    liftGateCache = liftGates;
    return liftGates;
}

/**
 * The closed cages that a rank Sign lists, whose rank the save has reached and that fog does not hide, with the cage's
 * Sign: the cages that hold a Promesst_Light or a Mirror first, each part in the order of the Signs.
 */
export function rankCages(input: RankCageInput): RankCage[] {
    const liftGates = liftGatesOf();
    const liftPieces: RankCage[] = [];
    const others: RankCage[] = [];
    const listed = new Set<number>();

    PROG.signs.forEach((sign, signIndex) => {
        if (!sign.rank || sign.rank === ANY_RANK || sign.rank > input.rank) return;
        if (!input.signShown(signIndex)) return;

        for (const gate of sign.gates) {
            if (listed.has(gate) || input.gateOpen[gate] || !input.gateShown(gate)) continue;

            listed.add(gate);
            const liftPiece = liftGates.has(gate);
            const cage = { gate, sign: signIndex, liftPiece };
            if (liftPiece) {
                liftPieces.push(cage);
            } else {
                others.push(cage);
            }
        }
    });

    return [...liftPieces, ...others];
}
