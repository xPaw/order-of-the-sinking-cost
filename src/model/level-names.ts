// How a level is named in text where its name may be hidden (viewer.md "The spoiler model (viewer)")

/** What stands for a level whose name is hidden, inside a sentence. */
export const HIDDEN_LEVEL_TEXT = 'a level';

/** A level's name, or HIDDEN_LEVEL_TEXT while its name is hidden. */
export function levelNameText(nameHidden: boolean[], levels: Array<{ n: string }>, levelIndex: number): string {
    if (nameHidden[levelIndex]) return HIDDEN_LEVEL_TEXT;
    return levels[levelIndex].n;
}
