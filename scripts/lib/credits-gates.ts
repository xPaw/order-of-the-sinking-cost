// The ending that has to be earned before each find of the `intro` level can be reached, from the maintainer's in-game
// account: the opening hall's voice logs are open from the start, the hard-puzzles room follows the high ending, and
// every other find follows the low ending.
const LOW_ENDING = 'ENDGAME3';

/** The finds (voice logs by `name`, levels by `level_name`) not gated by the low ending; null for open from the start. */
export const ENDING_EXCEPTIONS = new Map<string, string | null>([
    ['intro_1', null],
    ['intro_before_teleporter', null],
    ['paradise_lost_invocation_2', null],
    ['audiolog_sky_10000_things', 'ENDGAME2'],
    ['audiolog_sky_laws_of_form', 'ENDGAME2'],
    ['jenga_dispenser', 'ENDGAME2'],
    ['wizards_true_nature', 'ENDGAME2'],
]);

/** The achievement that gates a find of the `intro` level; undefined for one open from the start. */
export function creditsEnding(name: string): string | undefined {
    const ending = ENDING_EXCEPTIONS.get(name);
    if (ending === undefined) return LOW_ENDING;
    return ending ?? undefined;
}
