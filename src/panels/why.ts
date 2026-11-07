// Why the walk calls a level unreachable: the closed gates in front of it, the layer it is on, and the mechanics the
// walk does not model near the way in, named while spoilers show or once the save has met them (their world's
// achievement) (VIEWER.md "Pockets, leads and why", "The spoiler model (viewer)")
import { PROG } from '../data.ts';
import { hasAchievement } from '../model/achievements.ts';
import { freezerNoun, freezersNoun } from '../model/freezer-names.ts';
import { layerName, wayTo } from '../model/layers.ts';
import type { ProgressModel } from '../model/progress-model.ts';
import type { ShownProgress } from '../model/progress.ts';
import type { PanelContext } from './context.ts';

/** The members of the panel context that the why text reads. */
export interface WhyContext extends Pick<PanelContext, 'hide' | 'freezers' | 'iceOf' | 'gateShown' | 'gateArea'> {
    status: Pick<PanelContext['status'], 'achievements'>;
    progress: Pick<ShownProgress, 'wayIn' | 'wayInAll' | 'why' | 'access' | 'behind'>;
    model: Pick<ProgressModel, 'stepShown'>;
}

/**
 * The pieces of why a level is not reachable: its gates, the mechanics and the layer it needs, whether nothing is known,
 * whether the level data enters it from the sky (`skyEntry`) and whether that shows (`fromSky`), and the gates in front
 * of it that the level itself unlocks.
 */
export interface WhyParts {
    gate: string;
    mech: string;
    layer: string;
    none: boolean;
    skyEntry: boolean;
    fromSky: boolean;
    ownGates: string;
}

// the world's achievement that names a mechanic, and the mechanic in the game's words (it capitalises its objects)
const MECHANICS: Record<string, [achievement: string, text: string]> = {
    dragon: ['HEROES', 'Dragon fire'],
    beam: ['PROMISE', 'Beams'],
    mirror: ['MIRRORS', 'Mirrors'],
    stones: ['SKIPPING', 'Skipping Stones'],
};

/** A level's way-in gates that fog does not hide. */
export function wayIn(context: WhyContext, levelIndex: number): number[] {
    const gates = context.progress.wayIn?.[levelIndex] || [];
    return gates.filter((freezerIndex) => context.gateShown(context.freezers[freezerIndex]));
}

// " · <area>" after a gate's text while the gate's area is shown
function gateAreaSuffix(context: WhyContext, freezerIndex: number): string {
    const area = context.gateArea(freezerIndex);
    if (area == null) return '';
    return ' · ' + area;
}

function gateText(context: WhyContext, levelIndex: number, gates: number[]): string {
    if (!gates.length) return '';

    const ice = context.iceOf[levelIndex];
    if (ice !== undefined && gates.includes(ice)) return `in a ${freezerNoun(ice)}${gateAreaSuffix(context, ice)}`;
    // the gates the table asks for are all needed, whether or not the walk finds a way in besides
    const needed = context.progress.wayInAll?.get(levelIndex) ?? [];
    if (gates.length > 1 && gates.every((freezerIndex) => needed.includes(freezerIndex))) {
        return `behind all ${gates.length} ${freezersNoun(gates)}`;
    }

    if (gates.length > 1) return `behind one of ${gates.length} ${freezersNoun(gates)}`;
    return `behind ${freezerNoun(gates[0])}${gateAreaSuffix(context, gates[0])}`;
}

// the closed gates a level's pocket bumps into, when every one of them that fog shows needs the level itself
function ownGatesText(context: WhyContext, levelIndex: number): string {
    const bumped = context.progress.behind[levelIndex] || [];
    const shown = bumped.filter((freezerIndex) => context.gateShown(context.freezers[freezerIndex]));
    if (!shown.length || shown.length < bumped.length) return '';

    const needsLevel = (freezerIndex: number) => context.freezers[freezerIndex].req.includes(levelIndex);
    if (!shown.every(needsLevel)) return '';

    if (shown.length > 1) return `only behind ${freezersNoun(shown)} it unlocks`;
    return `only behind a ${freezerNoun(shown[0])} it unlocks${gateAreaSuffix(context, shown[0])}`;
}

function mechanicsText(context: WhyContext, mechanics: string[]): string {
    if (!mechanics.length) return '';

    const known = mechanics.filter((key) => !context.hide || hasAchievement(context.status, MECHANICS[key][0]));
    if (!known.length) return 'may need something the map does not model';
    return `may need ${known.map((key) => MECHANICS[key][1]).join(' / ')}`;
}

/** The pieces of why a level the walk cannot reach may still be reachable, as the panels word them. */
export function whyParts(context: WhyContext, levelIndex: number): WhyParts {
    const progress = context.progress;
    const mechanics = progress.why?.[levelIndex]?.mech ?? [];
    const layer = progress.access?.[levelIndex];

    // a layer the walk has not reached, named once its way onto it shows as a plan step
    let layerText = '';
    if (layer && context.model.stepShown({ t: 'a', id: layer })) {
        layerText = `needs ${wayTo(layer)}`;
    }

    // the level is entered from the sky; named once the sky shows
    const skyEntry = PROG.levels[levelIndex].drop !== undefined;
    const fromSky = skyEntry && context.model.stepShown({ t: 'a', id: 'sky' });
    return {
        gate: gateText(context, levelIndex, wayIn(context, levelIndex)),
        mech: mechanicsText(context, mechanics),
        layer: layerText,
        none: !progress.wayIn?.[levelIndex]?.length && !mechanics.length && !layer,
        skyEntry,
        fromSky,
        ownGates: ownGatesText(context, levelIndex),
    };
}

/** The tooltip that says the walk model is approximate, naming what it leaves out while spoilers show. */
export function approxTip(context: WhyContext): string {
    let leftOut = 'Mirrors, vertical Beams and Dragon fire';
    if (context.hide) leftOut = 'some mechanics';
    return `Approximate: the walk model leaves out ${leftOut}`;
}

/** Why the walk calls a level unreachable, in one line. */
export function whyText(context: WhyContext, levelIndex: number): string {
    const parts = whyParts(context, levelIndex);
    const text = [parts.gate, parts.mech, parts.layer].filter(Boolean).join(' · ');
    if (text) return text;
    if (!parts.none) return 'not reachable from where you have been';

    // a sky under fog is not named; while a drop from it leads in, the gates the level unlocks are not its only way
    if (parts.fromSky) return `from ${layerName('sky')}`;
    if (parts.skyEntry) return 'not reachable from where you have been';
    if (parts.ownGates) return parts.ownGates;
    return 'no known route';
}
