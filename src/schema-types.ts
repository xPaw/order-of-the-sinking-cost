// The entity types and enums of data/schema.json that the page reads. The build keeps only these in the page's copy of
// the schema (vite.config.ts), so a save's entity of another type has no schema.

/** The entity types whose latest state the overworld views read from a save. */
export const LATEST_TYPES: ReadonlySet<string> = new Set([
    'Wall_Set',
    'Teleporter',
    'Freezer',
    'Rock',
    'Area_Pin',
    'Fence',
    'Gate',
    'Lily',
    'Switch',
    'Ocean_Map',
    'Voice_Log',
    'View_Giver',
    'Monster',
    'Guy',
    'Wardrobe',
    'Promesst_Light',
    'Tree',
    'Gem',
    'Gem_Slot',
    'Mirror',
    'Rover',
    'Friendly_Dragon',
    'Group',
    'Sign',
]);

/** The entity type of a fog region's cleared squares. */
export const FOG_TYPE = 'Fog_Of_War';

/** The enums whose names the page looks up. */
export const PAGE_ENUMS: readonly string[] = ['Achievement'];
