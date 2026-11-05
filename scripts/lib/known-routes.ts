// The hand-written table of known routes: routes the walk does not find, with what each asks for (VIEWER.md "Known
// routes"), and the resolving of its names and pids to the indices data/progress.json holds.
import type {
    Area,
    Freezer,
    KnownRoute,
    Position,
    ProgressLevel,
    RouteNeed,
    RouteTarget,
    Sign,
    Teleporter,
} from '../../src/types.ts';

type NeedSource = { level: string } | { freezer: number } | { sign: number } | { rock: number };
type TargetSource = { level: string } | { pid: number };

/**
 * One row of the table. `needs`: all of the groups, one of the needs inside a group; a need is a level (by name)
 * solved, a Freezer (by pid) open, a Sign (by pid) read or a Rock (by pid) smashed. An empty group is a need that is not known: nothing meets
 * it. `to`: the level (by name) whose entrance the hero reaches, or the overworld entity (by pid) whose cell he
 * reaches. `area` and `tower` (a tower flag name such as HEROES) mark a sky Way: the Way area (by local area name) that
 * leads to the hub quarter of the sky tower, whose hub pad is `to`. `onto` (sky or underworld) marks the way onto that
 * layer, which then asks for the route's needs too.
 */
interface KnownRouteSource {
    id: string;
    to: TargetSource;
    needs: NeedSource[][];
    area?: string;
    tower?: string;
    onto?: string;
    note?: string;
}

// what the way down to the underworld asks for: routes that start in the underworld ask for it too
const LOW_WAY_NEEDS: NeedSource[][] = [
    [{ level: 'promesst2.5_deeper' }],
    [{ level: 'taking_the_lift' }],
    [{ level: 'drop_sokoban' }],
    [{ level: 'under_pressure' }],
    [{ level: 'strong_monsters_v2' }],
    [{ level: 'stay_lit' }],
    [{ level: 'bridgey3_abstract_art' }],
    [{ level: 'overwrite' }],
    [{ rock: 62941709 }],
    [{ rock: 62941723 }],
    [{ rock: 111153054 }],
];

const KNOWN_ROUTES: KnownRouteSource[] = [
    {
        id: 'heroes_way',
        to: { pid: 106958293 },
        needs: [[{ level: 'catching_fire_v2' }]],
        area: 'area_s_heroes_way',
        tower: 'HEROES',
    },
    {
        id: 'mirror_way',
        to: { pid: 106958295 },
        needs: [[{ level: 'priest_3d_intro_dragon_v4' }], [{ level: 'pachinko' }], [{ level: 'pachinko_rescue_w' }]],
        area: 'area_s_mirror_way',
        tower: 'MIRRORS',
    },
    {
        id: 'skipping_way',
        to: { pid: 106958297 },
        needs: [[]],
        area: 'area_s_skipping_way',
        tower: 'SKIPPING',
        note: 'what the route asks for is not known',
    },
    {
        id: 'beam_way',
        to: { pid: 106958291 },
        needs: [[{ level: 'high_endpoint_v2' }], [{ level: 'beam_jail_v3' }, { level: 'thin_ice_rooms' }]],
        area: 'area_s_beam_way',
        tower: 'PROMESST',
    },
    {
        id: 'green_hat_rock_stair',
        to: { level: 'green_hat' },
        needs: [[{ level: 'sokobridge_v4' }]],
        note: 'the Rock sokobridge_v4 frees is pushed off the ledge and lands as a stair up to the level',
    },
    {
        id: 'elevator_cyan_rock_bridge',
        to: { level: 'elevator_cyan' },
        needs: [[{ level: 'sokobridge_v4' }]],
        note: 'the Rock sokobridge_v4 frees is pushed west to x 42, south off the elevator landing onto the south row of the z 35 ledge and west along it, and drops into the gap at x 39 as a bridge to the level; the Activator beside its Spawner puts it back for another use',
    },
    {
        id: 'double_the_fun_gem_step',
        to: { level: 'double_the_fun' },
        needs: [[{ level: 'taking_the_lift' }]],
        note: 'the Gem taking_the_lift frees is pushed off the plateau and across the courtyard to the east side of the 1-high pillar the level stands on; the hero rides the elevator at (28, 71) up to the z 40 platform and drops from its west edge onto the Gem, a step level with the level',
    },
    {
        id: 'sender_simplified_gem_slot',
        to: { level: 'sender_simplified_v2' },
        needs: [[{ level: 'landmines_v3' }]],
        note: 'the Gem landmines_v3 frees goes onto its Gem_Slot; the lights it powers open the way down to the level',
    },
    {
        id: 'mirror_falling_cage_pad',
        to: { pid: 115497407 },
        needs: [[{ level: 'cliff_hopping' }]],
        note: 'the pad in the cage cliff_hopping opens carries the hero up to the z 37 ledge of Mirror Falling',
    },
    {
        id: 'triple_gate_mirror_drop',
        to: { level: 'triple_gate' },
        needs: [
            [{ level: 'trader_descend' }],
            [{ level: 'cliff_hopping' }],
            [{ level: 'make_a_right_simpler' }],
            [{ level: 'learn_to_catch_v2' }],
            [{ level: 'trust_falls' }],
            [{ level: 'falling_blocker_v3' }],
            [{ level: 'pillars' }],
            [{ level: 'long_platform_v2' }],
            [{ level: 'blind_spot_v2' }],
        ],
        note: 'the Mirror pushed east off the z 34 ledge falls and teleports the Rock into the gap north of the plateau, the way to the level',
    },
    {
        id: 'vacuum_beam_jump',
        to: { level: 'vacuum' },
        needs: [[{ level: 'landmines_v3' }], [{ level: 'seeing_red' }]],
        note: 'the hero steps north in the beam of the Light landmines_v3 frees, now clear of the seeing_red Freezer, and jumps to its end beside the level',
    },
    {
        id: 'pink_platforms_beam_jump',
        to: { level: 'pink_platforms' },
        needs: [[{ level: 'landmines_v3' }], [{ level: 'seeing_red' }], [{ level: 'vacuum' }]],
        note: 'the beam, turned up and east by the Mirror vacuum frees, jumps the hero onto the island of the level',
    },
    {
        id: 'suspend_intro_beam_jump',
        to: { level: 'suspend_intro' },
        needs: [[{ level: 'landmines_v3' }], [{ level: 'seeing_red' }], [{ level: 'vacuum' }]],
        note: 'the beam jumps the hero onto the pink_platforms island, whose elevator rises to the level',
    },
    {
        id: 'suspend_block_v2_beam_jump',
        to: { level: 'suspend_block_v2' },
        needs: [
            [{ level: 'landmines_v3' }],
            [{ level: 'seeing_red' }],
            [{ level: 'vacuum' }],
            [{ level: 'pink_platforms' }],
            [{ level: 'suspend_intro' }],
        ],
        note: 'the beam, turned up at the island and west across z 49 by the Mirrors those levels free, jumps the hero to a cell over the level, which he drops into',
    },
    {
        id: 'suspend_heterogeneous_beam_jump',
        to: { level: 'suspend_heterogeneous' },
        needs: [
            [{ level: 'landmines_v3' }],
            [{ level: 'seeing_red' }],
            [{ level: 'vacuum' }],
            [{ level: 'pink_platforms' }],
            [{ level: 'suspend_intro' }],
            [{ level: 'suspend_block_v2' }],
        ],
        note: 'the Mirror suspend_block_v2 frees turns the beam south along the z 49 platform, and the jump ends beside the level',
    },
    {
        id: 'height_chooser_v0_beam_jump',
        to: { level: 'height_chooser_v0' },
        needs: [
            [{ level: 'landmines_v3' }],
            [{ level: 'seeing_red' }],
            [{ level: 'vacuum' }],
            [{ level: 'pink_platforms' }],
            [{ level: 'suspend_intro' }],
            [{ level: 'suspend_block_v2' }],
            [{ level: 'suspend_directions_v2' }],
            [{ level: 'one_floor_down_v2' }],
        ],
        note: 'with the last Mirrors and Freezers of the relay cleared the beam runs down to z 38 and north, and the jump ends beside the level',
    },
    {
        id: 'beam_jail_v3_beam_jump',
        to: { level: 'beam_jail_v3' },
        needs: [
            [{ level: 'landmines_v3' }],
            [{ level: 'seeing_red' }],
            [{ level: 'vacuum' }],
            [{ level: 'pink_platforms' }],
            [{ level: 'suspend_intro' }],
            [{ level: 'suspend_block_v2' }],
            [{ level: 'suspend_directions_v2' }],
            [{ level: 'one_floor_down_v2' }],
        ],
        note: 'the same full beam relay ends in the corridor that holds the level and height_chooser_v0',
    },
    {
        id: 'smash_grid_4_dragons',
        to: { level: 'smash_grid_4' },
        needs: [[{ level: 'smash_grid_kill' }]],
        note: 'through the Freezer smash_grid_kill opens, the Rock between the two facing Dragons is smashed so their fire kills them, which opens the way up to the level',
    },
    {
        id: 'crystal_island_rock_bridge',
        to: { level: 'crystal_island' },
        needs: [[{ level: 'push_down_chain' }]],
        note: 'the four Rocks on the shallow strip are pushed into the water one after another at x 106, y 72 to 75, bridging from the strip to the level',
    },
    {
        id: 'green_goblins_step_down',
        to: { level: 'green_goblins' },
        needs: [[{ level: 'dragonsweeper' }], [{ level: 'no_murder_weapon_wizard' }]],
        note: 'the Freezers of both levels open the way through the room to the corridor north of it, and the hero steps down from the corridor into the level',
    },
    {
        id: 'negative_space_hub_walk',
        to: { level: 'negative_space' },
        needs: [[{ level: 'push_down_chain' }], [{ level: 'gem_trap2' }], [{ level: 'get_through_alt' }]],
        note: 'on foot from the hub elevator through the cages of gem_trap2 and get_through_alt',
    },
    {
        id: 'river_rotate_beams_gr_hub_walk',
        to: { level: 'river_rotate_beams_gr' },
        needs: [[{ level: 'push_down_chain' }], [{ level: 'get_through_alt' }], [{ level: 'breaking_bread' }]],
        note: 'on foot from the hub elevator through the cages of get_through_alt and breaking_bread',
    },
    {
        id: 'portable_stairs_mirror_lift',
        to: { level: 'portable_stairs' },
        needs: [[{ level: 'vert_mirror_intro' }]],
        note: 'the vertical Mirror vert_mirror_intro frees lifts the hero from the corridor west of the tower up onto its ground-level top, where portable_stairs stands',
    },
    {
        id: 'drawbridge_east_top',
        to: { level: 'drawbridge' },
        needs: [[{ level: 'vert_mirror_intro' }], [{ level: 'portable_stairs' }]],
        note: 'the vertical Mirror portable_stairs frees is pushed east along the south ledge, and its lift carries the hero onto the tower top row, east of the fences, where drawbridge stands',
    },
    {
        id: 'implausible_bridge_west_top',
        to: { level: 'implausible_bridge' },
        needs: [[{ level: 'vert_mirror_intro' }], [{ level: 'portable_stairs' }]],
        note: 'the vertical Mirror portable_stairs frees is pushed west along the south ledge, and its lift carries the hero onto the tower top row, west of the fences, where implausible_bridge stands',
    },
    {
        id: 'bottom_bridge_v2_court',
        to: { level: 'bottom_bridge_v2' },
        needs: [[{ level: 'vert_mirror_intro' }], [{ level: 'portable_stairs' }], [{ level: 'implausible_bridge' }]],
        note: 'the vertical Mirror implausible_bridge frees, at the west corner of the tower top, lifts the hero onto the inner court, where bottom_bridge_v2 stands',
    },
    {
        id: 'mission_impossible_court',
        to: { level: 'mission_impossible' },
        needs: [[{ level: 'vert_mirror_intro' }], [{ level: 'portable_stairs' }], [{ level: 'implausible_bridge' }]],
        note: 'the vertical Mirror implausible_bridge frees, at the east corner of the tower top, lifts the hero onto the inner court, where mission_impossible stands',
    },
    {
        id: 'repel_mirror_lift',
        to: { level: 'repel' },
        needs: [[{ level: 'mission_impossible' }]],
        note: 'the vertical Mirror mission_impossible frees is pushed west along the inner court row and lifts the hero onto the platform above the court, where repel stands',
    },
    {
        id: 'hat_tricks_slot_lift',
        to: { level: 'hat_tricks_0_v3' },
        needs: [[{ level: 'repel' }]],
        note: 'the vertical Mirror repel frees, at the bottom of the slot in the tower base, lifts the hero from the corridor onto the ledge where hat_tricks_0_v3 stands',
    },
    {
        id: 'mirror_way_strip_pad',
        to: { pid: 111249623 },
        needs: [[{ level: 'repel' }]],
        note: 'from the platform where repel stands the Mirrors lift the hero to the z 48 plateau east of the tower, its pad carries him to the west quarter of the sky hub, and the hub pad there lands him on the strip beside the Mirror Way',
    },
    {
        id: 'pachinko_mirror_hops',
        to: { level: 'pachinko' },
        needs: [[{ level: 'repel' }]],
        note: 'the vertical magic Mirrors east of the strip hop the hero out over the gaps, the last one into the corridor the level stands in',
    },
    {
        id: 'chasm_3_mirror_drop',
        to: { level: 'chasm_3' },
        needs: [[{ level: 'pachinko_rescue_w' }]],
        note: 'from the corridor north of the pad that pachinko_rescue_w frees, the downward vertical Mirror high above it throws the hero ten cells west, over the chasm_3 room, and he drops into it',
    },
    {
        id: 'monster_promesst_v3_from_en_root_alt',
        to: { level: 'thief_dragger_v2' },
        needs: [[{ level: 'en_root_alt' }], [{ level: 'green_goblins' }], [{ level: 'no_murder_weapon_wizard' }]],
        note: 'past en_root_alt, the way on reaches the room of thief_dragger_v2, open_monster and monster_promesst_v3',
    },
    {
        id: 'druid_multismash_v3_smashed_column',
        to: { level: 'druid_multismash_v3' },
        needs: [[{ rock: 111225816 }], [{ rock: 111225812 }], [{ rock: 111225814 }]],
        note: 'the column of three Rocks west of the level is smashed by the SMASH beam and then the multi beam, which snipperclips_diagonal frees, and the hero walks down the column to the level',
    },
    {
        id: 'red_yellow_alter_smashed_corridor',
        to: { level: 'red_yellow_alter_with_intro_v2' },
        needs: [[{ rock: 111225459 }], [{ rock: 111225465 }], [{ rock: 111225467 }]],
        note: 'the three Rocks in the corridor west of the level are smashed by the SMASH beam and then the multi beam, and the hero walks through to the level',
    },
    {
        id: 'push_down_chain_ride',
        to: { level: 'push_down_chain' },
        needs: LOW_WAY_NEEDS,
        onto: 'underworld',
        note: 'the elevator carries the hero down to the level once all three Rocks of its stack are smashed: Rubble smashed in both the SMASH and the ALTER beam smashes every Rock of its kind in the room; on the way the red Gem is moved across the sky through the Freezers of taking_the_lift, drop_sokoban, bridgey3_abstract_art, overwrite and the Strength levels',
    },
    {
        id: 'far_cl_no_walls_pit_fire_mirrors',
        to: { level: 'far_cl_no_walls_pit' },
        needs: LOW_WAY_NEEDS,
        note: 'by standing in a dragon fire that Mirrors carried by monsters reflect: the monsters turn toward the hero and turn their Mirrors with them',
    },
    {
        id: 'goblin_hat_v2_fire_mirrors',
        to: { level: 'goblin_hat_v2' },
        needs: LOW_WAY_NEEDS,
        note: 'the same fire and Mirrors as far_cl_no_walls_pit',
    },
    {
        id: 'pass_through_v2_same_z_cage',
        to: { level: 'pass_through_v2_same_z' },
        needs: [[{ freezer: 115531504 }], [{ freezer: 135424859 }], [{ freezer: 135424860 }]],
        note: 'through the cage beam_sisters opens into the goblin_below_intro_same_z room, then south through both Freezers of its doorway, which goblin_below_intro_same_z and thin_ice_rooms open',
    },
    {
        id: 'first_flight_sky_drop',
        to: { level: 'first_flight' },
        needs: [[{ freezer: 111163715 }]],
        note: 'through the Freezer air_skating_v6 opens onto the sky platform, then a drop lands in the corridor of the level',
    },
    {
        id: 'front_side_bus2_rock_bridge',
        to: { level: 'front_side_bus2' },
        needs: [[{ freezer: 62941423 }], [{ freezer: 62941421 }]],
        note: 'the Rocks in the Freezers rowboat and boat_priest_v3 open, with a third, fill the fenced water west of boat_priest_v3, and the hero crosses them',
    },
    {
        id: 'missile_command_rock_bridge',
        to: { level: 'missile_command' },
        needs: [[{ freezer: 90194122 }], [{ freezer: 111267358 }]],
        note: "the Rocks in the Freezers bard_movable_island2 opens, with the room's own, fill the water east of the floor block west of missile_command, and the hero crosses them",
    },
    {
        id: 'raft_corners_2_small_lily_crossing',
        to: { level: 'raft_corners_2_small' },
        needs: [[{ level: 'raft_corners_alt_3' }]],
        note: "past raft_corners_alt_3, a Rock and a skipping stone pushed into the water let the hero cross on a Lily, a stone on another Lily shielding it from the Dragon's fire, to the room of raft_corners_2_small and raft_corners_4x4",
    },
    {
        id: 'limited_offsets_surprise_v2_dragons',
        to: { level: 'limited_offsets_surprise_v2' },
        needs: [[{ freezer: 115555628 }], [{ freezer: 115555631 }]],
        note: 'the laser and the Rock in the Freezers limited_offsets opens open the red Gate between the two Dragons, which kill each other and open the monster Gate around the level',
    },
    {
        id: 'orange_predicament_sky_drop',
        to: { level: 'orange_predicament' },
        needs: [[{ freezer: 111163715 }]],
        note: 'through the Freezer air_skating_v6 opens onto the sky platform, then a drop off its west edge lands beside the level',
    },
    {
        id: 'skip_orange_maze_v3_sky_drop',
        to: { level: 'skip_orange_maze_v3' },
        needs: [[{ freezer: 111163715 }]],
        note: 'through the Freezer air_skating_v6 opens onto the sky platform, then a drop off it lands beside the level',
    },
    {
        id: 'skip_or_sink_r_submarine',
        to: { level: 'skip_or_sink_r' },
        needs: [[{ freezer: 90203328 }], [{ freezer: 90203340 }]],
        note: 'through the Freezer rover_impulse_v2 opens into the submarine pocket, then through the Freezer submarine opens',
    },
    {
        id: 'torus_blocks_alt_v4_chain',
        to: { level: 'torus_blocks_alt_v4' },
        needs: [[{ freezer: 115373174 }], [{ freezer: 111273015 }], [{ freezer: 111273021 }]],
        note: 'through the doorway push_down_chain opens, then the Freezers torus_goblins and torus_bard open',
    },
    {
        id: 'trick_kills_fuse',
        to: { level: 'trick_kills' },
        needs: [[{ freezer: 62971317 }], [{ freezer: 115377426 }], [{ freezer: 46142281 }]],
        note: 'through the Freezers clone_goblin and the_swappers open to fuse, then through the Freezer fuse opens',
    },
    {
        id: 'far_wings_river_lily',
        to: { level: 'far_wings' },
        needs: [[{ level: 'wrap_music' }]],
        note: 'the Rock the Freezer wrap_music opens is pushed onto the Activator that respawns the Lily beside the wrapping river; the hero pushes the Lily into the river and rides it',
    },
    {
        id: 'sick_270_small_river_lily',
        to: { level: 'sick_270_small' },
        needs: [[{ level: 'wrap_music' }]],
        note: 'the ride of the Lily on the wrapping river, as for far_wings',
    },
    {
        id: 'infinite_looping_skipper_mirrored_ikaruga_alt_river_lily',
        to: { level: 'infinite_looping_skipper_mirrored_ikaruga_alt' },
        needs: [[{ level: 'wrap_music' }]],
        note: 'the ride of the Lily on the wrapping river, as for far_wings',
    },
    {
        id: 'swapwiz_harder_river_lily',
        to: { level: 'swapwiz_harder' },
        needs: [[{ level: 'wrap_music' }]],
        note: 'the ride of the Lily on the wrapping river, as for far_wings',
    },
    {
        id: 'duality_2_river_lily',
        to: { level: 'duality_2' },
        needs: [[{ level: 'wrap_music' }]],
        note: 'the ride of the Lily on the wrapping river, as for far_wings',
    },
    {
        id: 'simultaneous_x_orange_light',
        to: { level: 'simultaneous_x' },
        needs: [[{ level: 'torus_mirrors' }]],
        note: 'from the pad above the orange light room the hero works the Rock Spawner rocks into the pits and the resets, turns the light with the Torc from the Wardrobe there (not walked) and walks row 77 on to the level; torus_mirrors stands for the walk reaching that pad',
    },
    {
        id: 'simultaneous_x_surprise_orange_light',
        to: { level: 'simultaneous_x_surprise' },
        needs: [[{ level: 'torus_mirrors' }]],
        note: 'the walk of row 77 past the orange light, as for simultaneous_x',
    },
    {
        id: 'all_fast_orange_light',
        to: { level: '4wcn_all_fast' },
        needs: [[{ level: 'three_artifacts_v3' }], [{ level: 'magnitudes_v3' }]],
        note: 'through the orange light above simultaneous_x, which turns once three_artifacts_v3 and magnitudes_v3 are solved (the Torc turn is not walked)',
    },
];

/** What the names and pids of the table resolve against. */
export interface RouteData {
    levels: ProgressLevel[];
    freezers: Freezer[];
    signs: Sign[];
    areas: Area[];
    teleporters: Teleporter[];
    /** The index into `towers` of the sky tower with this flag name. */
    skyTower: (flagName: string) => number | undefined;
    /** The position of the overworld entity with this pid. */
    positionOf: (pid: number) => Position | undefined;
    /** Whether the overworld has a Rock with this pid. */
    isRock: (pid: number) => boolean;
}

function indexOrThrow(index: number, what: string): number {
    if (index < 0) throw new Error(`known_routes: no ${what}`);
    return index;
}

function resolveNeed(source: NeedSource, data: RouteData): RouteNeed {
    if ('level' in source) {
        const level = data.levels.findIndex((candidate) => candidate.n === source.level);
        return { level: indexOrThrow(level, `level ${source.level}`) };
    }

    if ('freezer' in source) {
        const freezer = data.freezers.findIndex((candidate) => candidate.pid === source.freezer);
        return { freezer: indexOrThrow(freezer, `Freezer ${source.freezer}`) };
    }

    if ('rock' in source) {
        if (!data.isRock(source.rock)) throw new Error(`known_routes: no Rock ${source.rock}`);
        return { rock: source.rock };
    }

    const sign = data.signs.findIndex((candidate) => candidate.pid === source.sign);
    return { sign: indexOrThrow(sign, `Sign ${source.sign}`) };
}

function resolveTarget(source: TargetSource, data: RouteData): RouteTarget {
    if ('level' in source) {
        const level = data.levels.findIndex((candidate) => candidate.n === source.level);
        return { level: indexOrThrow(level, `level ${source.level}`) };
    }

    const pad = data.teleporters.findIndex((candidate) => candidate.pid === source.pid);
    if (pad >= 0) return { pad };

    const at = data.positionOf(source.pid);
    if (at === undefined) throw new Error(`known_routes: no overworld entity ${source.pid}`);
    return { at };
}

function resolveRoute(source: KnownRouteSource, data: RouteData): KnownRoute {
    const route: KnownRoute = {
        id: source.id,
        to: resolveTarget(source.to, data),
        needs: source.needs.map((group) => group.map((need) => resolveNeed(need, data))),
    };

    if (source.area !== undefined) {
        const area = data.areas.findIndex((candidate) => candidate.local_area_name === source.area);
        route.area = indexOrThrow(area, `area ${source.area}`);
    }

    if (source.tower !== undefined) {
        const tower = data.skyTower(source.tower);
        if (tower === undefined) throw new Error(`known_routes: no sky tower ${source.tower}`);
        route.tower = tower;
    }

    if (source.onto !== undefined) {
        if (source.onto !== 'sky' && source.onto !== 'underworld') {
            throw new Error(`known_routes: no layer ${source.onto} to lead onto`);
        }
        route.onto = source.onto;
    }

    return route;
}

/** The table with its names and pids resolved to indices; a name or pid the data lacks fails the build. */
export function buildKnownRoutes(data: RouteData): KnownRoute[] {
    return KNOWN_ROUTES.map((source) => resolveRoute(source, data));
}
