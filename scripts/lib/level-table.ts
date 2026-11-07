export type Need = { level: string } | { sign: number };

export interface LevelRow {
    levels: string[];
    /**
     * What these levels need to be reached: all of the groups, one need of a group. It lists the levels that unlock them in
     * the game data first, then what play adds. A row that adds nothing leaves the reach to the walk.
     */
    needs?: Need[][];
    /** These needs are the whole way in, though they add nothing to the game's unlocks. */
    known?: boolean;
    /** The hole the hero drops through; a level with one is entered from the sky. */
    drop?: [number, number, number];
}

export const LEVEL_TABLE: LevelRow[] = [
    // The Antipode
    {
        levels: ['end1'],
        needs: [
            [{ sign: 115344129 }],
        ],
    },
    // Heroes and Light
    {
        levels: ['snipperclips_0_square'],
        needs: [
            [{ level: 'promesst3_streamlined' }],
        ],
    },
    {
        levels: ['snipperclips_square'],
        known: true,
        needs: [
            [{ level: 'snipperclips_0_square' }],
        ],
    },
    {
        levels: ['snipperclips_diagonal'],
        needs: [
            [{ level: 'snipperclips_square' }],
        ],
    },
    {
        // the column of three Rocks west of the level is smashed by the SMASH beam and then the multi beam, which snipperclips_diagonal frees, and the hero walks down the column to the level
        levels: ['druid_multismash_v3'],
        needs: [
            [{ level: 'snipperclips_diagonal' }],
        ],
    },
    {
        // the three Rocks in the corridor west of the level are smashed by the SMASH beam and then the multi beam, and the hero walks through to the level
        levels: ['red_yellow_alter_with_intro_v2'],
        needs: [
            [{ level: 'snipperclips_diagonal' }],
        ],
    },
    {
        levels: [
            'accidentally_unlock_v2',
            'boxes_vs_crystals',
        ],
    },
    {
        levels: ['pushing_crystal_near_orange_v2'],
        needs: [
            [{ level: 'boxes_vs_crystals' }],
        ],
    },
    {
        levels: ['safety_gloves'],
        needs: [
            [{ level: 'pushing_crystal_near_orange_v2' }],
        ],
    },
    {
        levels: ['corner_loop'],
    },
    {
        levels: ['double_team'],
        needs: [
            [{ level: 'worlds_collide_heroes_and_promesst_v4' }],
        ],
    },
    {
        levels: ['orange_beam_deal'],
        needs: [
            [{ level: 'double_team' }],
        ],
    },
    {
        levels: ['dragon_on_the_wall'],
        needs: [
            [{ level: 'side_slide_intro_v2' }],
        ],
    },
    {
        levels: ['pushing_near_orange'],
        needs: [
            [{ level: 'orange_beam_deal' }],
        ],
    },
    {
        levels: ['pulling_near_orange_v2'],
        needs: [
            [{ level: 'pushing_near_orange' }],
        ],
    },
    {
        levels: ['jump_the_fence_v2'],
        needs: [
            [{ level: 'pulling_near_orange_v2' }],
        ],
    },
    {
        levels: ['pushing_orange'],
        needs: [
            [{ level: 'jump_the_fence_v2' }],
        ],
    },
    {
        levels: ['beam_shatter'],
        needs: [
            [{ level: 'pushing_orange' }],
        ],
    },
    {
        levels: ['bypass_gates'],
        needs: [
            [{ level: 'corner_loop' }],
            [{ level: 'jump_the_fence_v2' }],
        ],
    },
    {
        levels: ['through_sokoban'],
        needs: [
            [{ level: 'bypass_gates' }],
        ],
    },
    {
        levels: ['oneway_beam'],
    },
    {
        levels: ['multipush_for_me2'],
        needs: [
            [{ level: 'side_slide_intro_v2' }],
        ],
    },
    {
        levels: ['pull_together'],
        needs: [
            [{ level: 'beam_shatter' }],
        ],
    },
    {
        levels: ['endpoint_team'],
        needs: [
            [{ level: 'pull_together' }],
        ],
    },
    {
        levels: [
            'endpoint_gates',
            'purple_haze',
        ],
        needs: [
            [{ level: 'endpoint_team' }],
        ],
    },
    {
        levels: [
            'middle_smash',
            'through_maze_v2',
            'torc_blocked_easier',
        ],
        needs: [
            [{ level: 'purple_haze' }],
        ],
    },
    {
        levels: ['torc_blocked'],
        needs: [
            [{ level: 'torc_blocked_easier' }],
        ],
    },
    {
        levels: ['purple_perpendicular'],
        needs: [
            [{ level: 'purple_haze' }],
        ],
    },
    {
        levels: ['simple_trap'],
        needs: [
            [{ level: 'pull_together' }],
        ],
    },
    {
        levels: ['untrap'],
        needs: [
            [{ level: 'simple_trap' }],
        ],
    },
    {
        levels: ['pushback'],
        needs: [
            [{ level: 'untrap' }],
        ],
    },
    {
        levels: [
            'red_handed',
            'smash_grid_kill',
        ],
    },
    {
        levels: ['lock_picky'],
        needs: [
            [{ level: 'red_handed' }],
        ],
    },
    {
        levels: ['purple_push_pal'],
        needs: [
            [{ level: 'purple_haze' }],
        ],
    },
    {
        levels: ['slide_rows'],
        needs: [
            [{ level: 'purple_push_pal' }],
        ],
    },
    {
        levels: ['side_kick'],
        needs: [
            [{ level: 'side_slide_intro_v2' }],
        ],
    },
    {
        // through the Freezer smash_grid_kill opens, the Rock between the two facing Dragons is smashed so their fire kills them, which opens the way up to the level
        levels: ['smash_grid_4'],
        needs: [
            [{ level: 'smash_grid_kill' }],
        ],
    },
    {
        levels: ['thief_through'],
    },
    {
        levels: ['wall_sneak'],
        needs: [
            [{ level: 'thief_through' }],
        ],
    },
    {
        levels: ['through_intro'],
    },
    {
        levels: ['through_push'],
        needs: [
            [{ level: 'through_intro' }],
        ],
    },
    {
        levels: ['binary_maze'],
        needs: [
            [{ level: 'through_push' }],
        ],
    },
    {
        levels: ['help_drop'],
        needs: [
            [{ level: 'plus_signs_v3' }],
        ],
    },
    // Heroes of Hauling
    {
        levels: ['heroes1_1'],
        needs: [],
    },
    {
        levels: ['heroes1_2_v2'],
        needs: [
            [{ level: 'heroes1_1' }],
        ],
    },
    {
        levels: ['heroes1_3'],
        needs: [
            [{ level: 'heroes1_2_v2' }],
        ],
    },
    {
        levels: ['heroes1_4'],
        needs: [
            [{ level: 'heroes1_3' }],
        ],
    },
    {
        levels: ['heroes1_4.5'],
        needs: [
            [{ level: 'heroes1_4' }],
        ],
    },
    {
        levels: ['heroes1_5_v2'],
        needs: [
            [{ level: 'heroes1_4.5' }],
        ],
    },
    {
        levels: ['heroes1_7_v2'],
        needs: [
            [{ level: 'heroes1_5_v2' }],
        ],
    },
    {
        levels: ['heroes1_6'],
        needs: [
            [{ level: 'heroes1_7_v2' }],
        ],
    },
    {
        levels: ['heroes1_7.5'],
        needs: [
            [{ level: 'heroes1_4.5' }],
        ],
    },
    {
        levels: ['heroes1_8_v2'],
        needs: [
            [{ level: 'heroes1_7.5' }],
        ],
    },
    {
        levels: ['heroes1_10_inv_v4_b'],
        needs: [
            [{ level: 'heroes1_8_v2' }],
        ],
    },
    {
        levels: ['heroes1_9'],
        needs: [
            [{ level: 'heroes1_10_inv_v4_b' }],
        ],
    },
    {
        levels: ['heroes1_11_v2'],
        // south of the two Freezers in the corridor below heroes1_4
        needs: [
            [{ level: 'heroes1_10_inv_v4_b' }],
            [{ level: 'heroes1_7_v2' }],
        ],
    },
    {
        levels: ['heroes1_13_v2'],
        // south of the two Freezers in the corridor below heroes1_4
        needs: [
            [{ level: 'heroes1_11_v2' }],
        ],
    },
    {
        levels: ['heroes1_12_v2_alt'],
        // south of the two Freezers in the corridor below heroes1_4
        needs: [
            [{ level: 'heroes1_13_v2' }],
        ],
    },
    {
        levels: ['heroes1_15'],
        // south of the two Freezers in the corridor below heroes1_4
        needs: [
            [{ level: 'heroes1_12_v2_alt' }],
        ],
    },
    {
        levels: ['heroes1_16_v3'],
        // south of the two Freezers in the corridor below heroes1_4
        needs: [
            [{ level: 'heroes1_15' }],
        ],
    },
    {
        // past heroes1_15, by a Wardrobe swap
        levels: ['heroes1_17'],
        needs: [
            [{ level: 'heroes1_15' }],
        ],
    },
    {
        levels: ['heroes1_18'],
        needs: [
            [{ level: 'heroes1_17' }],
        ],
    },
    {
        levels: ['heroes1_19_jail'],
        needs: [
            [{ level: 'heroes1_18' }],
        ],
    },
    {
        levels: ['heroes1_21_v3'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        levels: ['victory_lap'],
        needs: [
            [{ level: 'heroes3_21_condensed' }],
        ],
    },
    // The Mirror Isles
    {
        levels: ['mirror_1'],
        needs: [],
    },
    {
        levels: ['mirror_2'],
        needs: [
            [{ level: 'mirror_1' }],
        ],
    },
    {
        levels: ['mirror_3'],
        needs: [
            [{ level: 'mirror_2' }],
        ],
    },
    {
        levels: ['mirror_4'],
        needs: [
            [{ level: 'mirror_3' }],
        ],
    },
    {
        levels: ['mirror_5'],
        needs: [
            [{ level: 'mirror_3' }],
        ],
    },
    {
        levels: ['mirror_6_alt'],
        needs: [
            [{ level: 'mirror_5' }],
        ],
    },
    {
        levels: ['mirror_7'],
        needs: [
            [{ level: 'mirror_3' }],
        ],
    },
    {
        levels: ['mirror_8_v5'],
        needs: [
            [{ level: 'mirror_7' }],
        ],
    },
    {
        levels: ['mirror_11'],
        needs: [
            [{ level: 'skipping_stones' }],
        ],
    },
    {
        levels: ['mirror_12'],
        needs: [
            [{ level: 'mirror_11' }],
        ],
    },
    {
        levels: ['mirror_15'],
        needs: [
            [{ level: 'mirror_12' }],
        ],
    },
    {
        levels: ['mirror_19'],
        needs: [
            [{ level: 'mirror_15' }],
        ],
    },
    {
        levels: ['mirror_17'],
        needs: [
            [{ level: 'mirror_19' }],
            [{ level: 'mirror_8_v5' }],
        ],
    },
    {
        levels: ['mirror_sink'],
        needs: [
            [{ level: 'mirror_17' }],
        ],
    },
    {
        levels: ['mirror_20'],
        needs: [
            [{ level: 'mirror_sink' }],
        ],
    },
    {
        levels: ['mirror_18'],
        needs: [
            [{ level: 'mirror_20' }],
        ],
    },
    {
        levels: ['mirror_10_alt2'],
        needs: [
            [{ level: 'mirror_18' }],
        ],
    },
    {
        levels: ['mirror_21'],
        needs: [
            [{ level: 'skipping_stones' }],
        ],
    },
    {
        levels: ['mirror_22_v2'],
        needs: [
            [{ level: 'mirror_21' }],
        ],
    },
    {
        levels: ['mirror_factory_v2'],
        needs: [
            [{ level: 'skipping_stones' }],
        ],
    },
    {
        levels: ['mirror_13'],
        needs: [
            [{ level: 'mirror_factory_v2' }],
        ],
    },
    {
        levels: ['mirror_14'],
        needs: [
            [{ level: 'mirror_13' }],
        ],
    },
    {
        levels: ['mirror_pals'],
        needs: [
            [{ level: 'skipping_stones' }],
        ],
    },
    {
        levels: ['walk_it_over'],
        needs: [
            [{ level: 'mirror_pals' }],
        ],
    },
    {
        levels: ['two_step'],
        known: true,
        needs: [
            [{ level: 'already_dropped_v2' }],
        ],
    },
    {
        levels: ['use_and_remove'],
        needs: [
            [{ level: 'two_step' }],
        ],
    },
    {
        levels: ['infinite_crystal_hack_v5'],
        needs: [
            [{ level: 'use_and_remove' }],
        ],
    },
    {
        levels: ['mundane_mirror'],
        needs: [
            [{ level: 'mirror_10_alt2' }],
        ],
    },
    {
        levels: ['mirror_10_b_v2'],
        needs: [
            [{ level: 'mundane_mirror' }],
        ],
    },
    {
        levels: ['mirror_10_d'],
        needs: [
            [{ level: 'mirror_10_b_v2' }],
        ],
    },
    // Vault of the Beamcasters
    {
        levels: ['promesst1_streamlined'],
        needs: [],
    },
    {
        levels: ['promesst2_streamlined'],
        needs: [
            [{ level: 'promesst1_streamlined' }],
        ],
    },
    {
        levels: ['orange_cross'],
        needs: [
            [{ level: 'double_trouble' }],
        ],
    },
    // Skipping Stones
    {
        levels: ['skipping_stones'],
        needs: [],
    },
    {
        levels: ['time_tutorial'],
        needs: [
            [{ level: 'skipping_stones' }],
        ],
    },
    {
        levels: ['skipping_pals'],
        needs: [
            [{ level: 'time_tutorial' }],
        ],
    },
    // Antipode High
    {
        levels: ['allocate_heroes_v2'],
        needs: [
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['end2_heroes_1_2'],
        needs: [
            [{ level: 'allocate_heroes_v2' }],
        ],
    },
    {
        levels: ['end2_heroes_1_5'],
        needs: [
            [{ level: 'end2_heroes_1_2' }],
        ],
    },
    {
        levels: [
            'prelude_priest_water_goblins_only',
            'see_no_evil',
        ],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
        ],
    },
    {
        levels: ['end2_mirror_3'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
        ],
    },
    {
        levels: ['mirror_prelude_v2_fix'],
        needs: [
            [{ level: 'end2_mirror_3' }],
        ],
    },
    {
        levels: ['peak_toggle'],
        needs: [
            [{ level: 'mirror_prelude_v2_fix' }],
        ],
    },
    {
        levels: ['floor_plan_v3'],
        needs: [
            [{ level: 'peak_toggle' }],
            [{ level: 'prelude_priest_water_goblins_only' }],
        ],
    },
    {
        levels: ['stone_economy'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
        ],
    },
    {
        levels: ['place_lily_pushstyle_v6'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
        ],
    },
    {
        levels: ['three_birds_push'],
        needs: [
            [{ level: 'place_lily_pushstyle_v6' }],
        ],
    },
    {
        levels: ['stones_prelude'],
        needs: [
            [{ level: 'three_birds_push' }],
        ],
    },
    {
        levels: ['end2_river_place'],
        needs: [
            [{ level: 'stones_prelude' }],
        ],
    },
    {
        levels: ['chart_a_course'],
        needs: [
            [{ level: 'end2_river_place' }],
            [{ level: 'peak_toggle' }],
        ],
    },
    {
        levels: ['sidestone_zach_2_end2'],
        needs: [
            [{ level: 'chart_a_course' }],
        ],
    },
    {
        levels: ['who_you_gonna_call'],
        needs: [
            [{ level: 'stones_prelude' }],
        ],
    },
    {
        levels: ['end2_monster_connect'],
        needs: [
            [{ level: 'who_you_gonna_call' }],
        ],
    },
    {
        levels: ['place_slot_4x4_pushstyle'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
        ],
    },
    {
        levels: ['color_picker'],
        needs: [
            [{ level: 'place_slot_4x4_pushstyle' }],
        ],
    },
    {
        levels: ['place_promesst_rooms'],
        needs: [
            [{ level: 'color_picker' }],
        ],
    },
    {
        levels: ['promesst_prelude_pushstyle'],
        needs: [
            [{ level: 'place_promesst_rooms' }],
        ],
    },
    {
        levels: ['elevator_mechanic'],
        needs: [
            [{ level: 'promesst_prelude_pushstyle' }],
        ],
    },
    {
        levels: ['end2_prism_hp'],
        needs: [
            [{ level: 'place_promesst_rooms' }],
            [{ level: 'see_no_evil' }],
        ],
    },
    {
        levels: ['stack_prelude_pushstyle'],
        needs: [
            [{ level: 'peak_toggle' }],
            [{ level: 'place_promesst_rooms' }],
        ],
    },
    // Three at Once
    {
        levels: ['3wcn_shm_dragon_lily'],
        needs: [
            [{ level: 'magnitudes_v3' }],
        ],
    },
    {
        levels: ['3wcn_purple_goblin'],
        needs: [
            [{ level: 'half_journey_vh' }],
        ],
    },
    {
        levels: ['3wcn_stonehenge'],
        needs: [
            [{ level: 'triple_skip' }],
        ],
    },
    {
        levels: ['3wc_into_forest_v7'],
        needs: [
            [{ level: '3wcn_stonehenge' }],
        ],
    },
    // Heterogeneous Stacks
    {
        levels: ['jenga_assorted'],
        needs: [
            [{ level: 'torus_goblins' }],
        ],
    },
    {
        levels: ['how_to_train_your_dragon'],
        needs: [
            [{ level: 'jenga_assorted' }],
        ],
    },
    // Mirrorable Mirror Medley
    {
        levels: ['bard_metamirror'],
    },
    {
        levels: ['druid_metamirror'],
        needs: [
            [{ level: 'metamirror_different_dir_2_alt' }],
        ],
    },
    {
        levels: ['mirror_the_unmirrorable_mirror'],
        needs: [
            [{ level: 'druid_metamirror' }],
        ],
    },
    {
        levels: ['druid_vertical_mirror'],
        needs: [
            [{ level: 'busy_beaver' }],
        ],
    },
    {
        levels: ['special_move'],
        needs: [
            [{ level: 'druid_vertical_mirror' }],
        ],
    },
    {
        levels: ['self_teleporting'],
        needs: [
            [{ level: 'druid_metamirror' }],
        ],
    },
    {
        levels: ['wrapping_mirror0'],
        needs: [
            [{ level: 'self_teleporting' }],
        ],
    },
    {
        levels: ['wrapping_mirror0_relatively_prime'],
        needs: [
            [{ level: 'wrapping_mirror0' }],
        ],
    },
    {
        levels: ['the_line_must_be_drawn_HERE'],
        needs: [
            [{ level: 'wrapping_mirror0_relatively_prime' }],
        ],
    },
    {
        // the Rock in the Freezer wrapping_mirror0_relatively_prime opens
        levels: [
            'lemonade',
            'lemonade_tng_stages_towers_no_float',
        ],
        needs: [
            [{ level: 'wrapping_mirror0_relatively_prime' }],
        ],
    },
    {
        levels: ['wrapping_mirror_alt'],
        needs: [
            [{ level: 'druid_vertical_mirror' }],
        ],
    },
    {
        levels: ['base_jump'],
        needs: [
            [{ level: 'wrapping_mirror_alt' }],
        ],
    },
    {
        levels: ['hyper_jump_2c'],
        needs: [
            [{ level: 'base_jump' }],
        ],
    },
    {
        levels: ['hyper_jump'],
        needs: [
            [{ level: 'hyper_jump_2c' }],
        ],
    },
    // Skipping, Misc Beams
    {
        levels: ['smash_midskip_simpler4'],
        needs: [
            [{ level: 'skip_purple_drop_alt' }],
        ],
    },
    {
        levels: ['bon_voyage'],
        needs: [
            [{ level: 'smash_midskip_simpler4' }],
        ],
    },
    {
        levels: ['breaking_bread'],
        needs: [
            [{ level: 'get_through_alt' }],
        ],
    },
    // Wrapping Mirrors
    {
        levels: ['torus_mirrors'],
        needs: [
            [{ level: 'crystal_island' }],
        ],
    },
    {
        levels: ['wrapping_magic_mirror_2'],
        needs: [
            [{ level: 'torus_mirrors' }],
        ],
    },
    {
        levels: ['double_sided_skip'],
        needs: [
            [{ level: 'wrapping_magic_mirror_2' }],
        ],
    },
    {
        levels: ['stasis_v2'],
        needs: [
            [{ level: 'crystal_island' }],
        ],
    },
    // Heroes 2: Monsters
    {
        levels: ['side_slide_intro_v2'],
        needs: [
            [{ level: 'compactor_v2' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_2b'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_2'],
        needs: [
            [{ level: 'heroes2_2b' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_thief_goblin'],
        needs: [
            [{ level: 'heroes2_2' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_3_v2'],
        needs: [
            [{ level: 'heroes2_thief_goblin' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_5_altE'],
        needs: [
            [{ level: 'heroes2_3_v2' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_5_no_crystal'],
        needs: [
            [{ level: 'heroes2_5_altE' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_5.5v5'],
        needs: [
            [{ level: 'heroes2_5_no_crystal' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_6_v3'],
        needs: [
            [{ level: 'heroes2_5.5v5' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_9'],
        needs: [
            [{ level: 'heroes2_6_v3' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_10a_intro'],
        needs: [
            [{ level: 'heroes2_9' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_10'],
        needs: [
            [{ level: 'heroes2_10a_intro' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_11_v2_easier'],
        needs: [
            [{ level: 'heroes2_10' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_12_v2'],
        needs: [
            [{ level: 'heroes2_11_v2_easier' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_11_v2'],
        needs: [
            [{ level: 'heroes2_12_v2' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_10.5'],
        needs: [
            [{ level: 'heroes2_11_v2' }],
        ],
    },
    {
        levels: ['one_fire_v2'],
        needs: [
            [{ level: 'heroes2_10.5' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_13'],
        needs: [
            [{ level: 'heroes2_12_v2' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_14'],
        needs: [
            [{ level: 'heroes2_13' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_15'],
        needs: [
            [{ level: 'heroes2_14' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_16v4'],
        needs: [
            [{ level: 'heroes2_15' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: [
            'heroes2_18',
            'heroes2_21b',
        ],
        needs: [
            [{ level: 'heroes2_16v4' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_22_v2'],
        needs: [
            [{ level: 'heroes2_21b' }],
        ],
    },
    {
        levels: ['mosh_pit_small'],
        needs: [
            [{ level: 'heroes2_16v4' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_17_intro'],
        needs: [
            [{ level: 'mosh_pit_small' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: [
            'heroes2_17',
            'heroes2_20',
        ],
        needs: [
            [{ level: 'heroes2_17_intro' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_reprise'],
        needs: [
            [{ level: 'heroes2_15' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_10a'],
        needs: [
            [{ level: 'heroes2_10a_intro' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_3monster'],
        needs: [
            [{ level: 'heroes2_10a' }],
        ],
    },
    // Heroes and Artifacts
    {
        levels: ['cleric_isles'],
        needs: [
            [{ level: 'flamethrower' }],
        ],
    },
    {
        levels: ['thief_wand'],
        needs: [
            [{ level: 'worlds_collide_heroes_and_promesst_v4' }],
        ],
    },
    {
        levels: ['flame_wand'],
        needs: [
            [{ level: 'thief_wand' }],
        ],
    },
    {
        // the Rocks in the Freezers thief_wand and flame_wand open
        levels: ['plus_signs_v3'],
        needs: [
            [{ level: 'flame_wand' }],
        ],
    },
    {
        levels: [
            'friendly_nudges',
            'gem_transport',
        ],
        needs: [
            [{ level: 'plus_signs_v3' }],
        ],
    },
    {
        levels: ['gem_transport_2'],
        needs: [
            [{ level: 'gem_transport' }],
        ],
    },
    {
        // the Rocks in the Freezers thief_wand and flame_wand open
        levels: ['swap_and_spin'],
        needs: [
            [{ level: 'flame_wand' }],
        ],
    },
    {
        // the Rocks in the Freezers thief_wand and flame_wand open
        levels: ['wizard_with_a_gun'],
        needs: [
            [{ level: 'swap_and_spin' }],
        ],
    },
    {
        levels: ['bug_spray'],
        needs: [
            [{ level: 'thief_wand' }],
        ],
    },
    // Heroes and Light, Advanced
    {
        levels: [
            'endpoint_object',
            'matching_purple',
        ],
        needs: [
            [{ level: 'purple_haze' }],
        ],
    },
    {
        levels: ['be_aggro_alt_2'],
    },
    {
        levels: ['orange_wizard_intro'],
        needs: [
            [
                { level: 'be_aggro_alt_2' },
                { level: 'magic_square' },
                { level: 'mini_green_maze' },
                { level: 'safe_returns' },
            ],
        ],
    },
    {
        levels: ['learning_double'],
        needs: [
            [{ level: 'orange_wizard_intro' }],
        ],
    },
    {
        levels: ['double_tempo'],
    },
    {
        levels: ['button_playground'],
        needs: [
            [{ level: 'double_tempo' }],
        ],
    },
    {
        levels: ['endpoint_weapon'],
        needs: [
            [{ level: 'button_playground' }],
        ],
    },
    {
        levels: ['immobilize'],
        needs: [
            [{ level: 'endpoint_weapon' }],
        ],
    },
    {
        levels: ['invisible_hand'],
    },
    {
        levels: ['purple_wizard_maze'],
        needs: [
            [{ level: 'invisible_hand' }],
        ],
    },
    {
        levels: ['magic_square'],
    },
    {
        levels: ['magic_shield'],
        needs: [
            [{ level: 'magic_square' }],
        ],
    },
    {
        levels: [
            'mini_green_maze',
            'safe_returns',
        ],
    },
    {
        levels: ['two_through_alt_2'],
        needs: [
            [{ level: 'safe_returns' }],
        ],
    },
    {
        levels: ['see_through'],
    },
    {
        levels: ['wizard_finesse_1'],
        needs: [
            [{ level: 'endpoint_object' }],
            [{ level: 'dragon_on_the_wall' }],
        ],
    },
    {
        levels: ['wizard_finesse_2'],
        needs: [
            [{ level: 'wizard_finesse_1' }],
        ],
    },
    {
        levels: ['wizard_finesse_3'],
        needs: [
            [{ level: 'wizard_finesse_2' }],
        ],
    },
    {
        levels: ['wizard_finesse_4'],
        needs: [
            [{ level: 'wizard_finesse_3' }],
        ],
    },
    // Heroes and Mirrors
    {
        levels: ['blocking_issue'],
        needs: [
            [{ level: 'crystal_bridges' }],
        ],
    },
    {
        levels: ['greenhouse'],
        needs: [
            [{ level: 'blocking_issue' }],
        ],
    },
    {
        levels: ['bitstring_small'],
        needs: [
            [{ level: 'greenhouse' }],
        ],
    },
    {
        levels: ['fly_and_flip'],
        needs: [
            [{ level: 'blocking_issue' }],
            [{ level: 'flamethrower' }],
        ],
    },
    {
        levels: ['fire_and_flip'],
        needs: [
            [{ level: 'fly_and_flip' }],
        ],
    },
    {
        levels: ['elope'],
        needs: [
            [{ level: 'fire_and_flip' }],
        ],
    },
    {
        levels: ['reattachment'],
        needs: [
            [{ level: 'crystal_bridges' }],
        ],
    },
    {
        levels: ['detachment'],
        needs: [
            [{ level: 'reattachment' }],
        ],
    },
    {
        levels: ['holes'],
        needs: [
            [{ level: 'crystal_bridges' }],
        ],
    },
    {
        levels: [
            'double_break',
            'drop_tool',
        ],
        needs: [
            [{ level: 'holes' }],
        ],
    },
    {
        levels: ['close_to_button'],
        needs: [
            [{ level: 'detachment' }],
            [{ level: 'drop_tool' }],
        ],
    },
    {
        levels: ['flip_flop_v2'],
        needs: [
            [{ level: 'close_to_button' }],
        ],
    },
    {
        levels: ['gate_shatter'],
        needs: [
            [{ level: 'flip_flop_v2' }],
        ],
    },
    {
        levels: ['iodine_clock_v2'],
        needs: [
            [{ level: 'gate_shatter' }],
        ],
    },
    {
        levels: ['mirror_clocks'],
        needs: [
            [{ level: 'iodine_clock_v2' }],
        ],
    },
    {
        levels: ['two_for_one'],
        needs: [
            [{ level: 'flip_flop_v2' }],
        ],
    },
    {
        levels: ['red_cross'],
        needs: [
            [{ level: 'blocking_issue' }],
        ],
    },
    {
        levels: ['mirror_hallway_v2'],
        needs: [
            [{ level: 'flip_flop_v2' }],
        ],
    },
    {
        levels: ['the_swappers'],
        needs: [
            [{ level: 'flip_flop_v2' }],
        ],
    },
    {
        levels: ['goblin_parity'],
        needs: [
            [{ level: 'the_swappers' }],
        ],
    },
    {
        levels: ['clone_goblin'],
        needs: [
            [{ level: 'goblin_parity' }],
        ],
    },
    {
        levels: ['two_dragon_rooms'],
        needs: [
            [{ level: 'clone_goblin' }],
        ],
    },
    {
        levels: ['quad_torch'],
        needs: [
            [{ level: 'two_dragon_rooms' }],
        ],
    },
    {
        levels: ['fuse'],
        needs: [
            [{ level: 'two_dragon_rooms' }],
        ],
    },
    {
        levels: ['wizard_mirror_intro'],
        needs: [
            [{ level: 'fuse' }],
        ],
    },
    {
        levels: ['regular_mirror_v4'],
        needs: [
            [{ level: 'wizard_mirror_intro' }],
        ],
    },
    {
        levels: ['moving_a_mirror'],
        needs: [
            [{ level: 'regular_mirror_v4' }],
        ],
    },
    {
        levels: ['moving_three_mirrors'],
        needs: [
            [{ level: 'moving_a_mirror' }],
        ],
    },
    {
        levels: ['mirror_dweller'],
        needs: [
            [{ level: 'moving_three_mirrors' }],
        ],
    },
    {
        levels: ['tricky_swappers_v3'],
        needs: [
            [{ level: 'the_swappers' }],
        ],
    },
    {
        // through the Freezers clone_goblin and the_swappers open to fuse, then through the Freezer fuse opens
        levels: ['trick_kills'],
        needs: [
            [{ level: 'clone_goblin' }],
            [{ level: 'the_swappers' }],
            [{ level: 'fuse' }],
        ],
    },
    {
        levels: ['walk_the_plank'],
        needs: [
            [{ level: 'fire_and_flip' }],
        ],
    },
    {
        levels: ['oneway_dragon_toast'],
        needs: [
            [{ level: 'walk_the_plank' }],
        ],
    },
    // Heroes and Stones, East
    {
        levels: ['skipping_shores_v3'],
        needs: [
            [{ level: 'skipping_pals' }],
        ],
    },
    {
        levels: ['pull_it_v4'],
        needs: [
            [{ level: 'sprint_skip0' }],
        ],
    },
    {
        levels: ['pull_teamwork_alt'],
        needs: [
            [{ level: 'pull_it_v4' }],
        ],
    },
    {
        levels: ['stone_stopper_intro'],
        needs: [
            [{ level: 'new_cleric_fly' }],
        ],
    },
    {
        levels: ['another_stone_stopper'],
        needs: [
            [{ level: 'stone_stopper_intro' }],
        ],
    },
    {
        levels: ['stone_stopper3_v2'],
        needs: [
            [{ level: 'another_stone_stopper' }],
        ],
    },
    {
        levels: ['stone_stopper5'],
        needs: [
            [{ level: 'stone_stopper3_v2' }],
        ],
    },
    {
        levels: ['hot_swap'],
        needs: [
            [{ level: 'stone_stopper3_v2' }],
        ],
    },
    {
        levels: ['skipping_with_dragon'],
        needs: [
            [{ level: 'hot_swap' }],
        ],
    },
    {
        levels: ['walk_into_fire'],
        needs: [
            [{ level: 'skipping_with_dragon' }],
        ],
    },
    {
        levels: ['pull_skip_twins_v3'],
        needs: [
            [{ level: 'walk_into_fire' }],
        ],
    },
    {
        levels: ['druid_stone_p'],
        needs: [
            [{ level: 'pull_teamwork_alt' }],
        ],
    },
    {
        levels: ['druids_stone_0_v2'],
        needs: [
            [{ level: 'pull_teamwork_alt' }],
        ],
    },
    {
        levels: ['druids_stone_alt'],
        needs: [
            [{ level: 'druids_stone_0_v2' }],
        ],
    },
    {
        levels: ['druids_stone_2_v4'],
        needs: [
            [{ level: 'druids_stone_alt' }],
        ],
    },
    // Heroes and Stones, West
    {
        levels: ['one_of_each'],
        needs: [
            [{ level: 'worlds_collide_heroes_and_stones' }],
        ],
    },
    {
        levels: ['crystals_not_stones'],
        needs: [
            [{ level: 'one_of_each' }],
        ],
    },
    {
        levels: ['stones_not_crystals'],
        needs: [
            [{ level: 'crystals_not_stones' }],
        ],
    },
    {
        levels: ['one_bird_two_stones'],
        needs: [
            [{ level: 'stones_not_crystals' }],
        ],
    },
    {
        levels: ['breath_skip'],
        needs: [
            [{ level: 'one_bird_two_stones' }],
        ],
    },
    {
        levels: ['indirect_skip'],
        needs: [
            [{ level: 'breath_skip' }],
        ],
    },
    {
        levels: ['indirect_skip_2'],
        needs: [
            [{ level: 'indirect_skip' }],
        ],
    },
    {
        levels: ['sprint_skip0'],
        needs: [
            [{ level: 'stones_not_crystals' }],
        ],
    },
    {
        levels: ['watergate'],
        needs: [
            [{ level: 'sprint_skip0' }],
        ],
    },
    {
        levels: ['island_friends'],
        needs: [
            [{ level: 'sprint_skip0' }],
        ],
    },
    {
        levels: ['wizard_with_a_capital_w'],
        needs: [
            [{ level: 'sprint_skip0' }],
        ],
    },
    {
        levels: ['bard_range4'],
        needs: [
            [{ level: 'wizard_with_a_capital_w' }],
            [{ level: 'island_friends' }],
        ],
    },
    {
        levels: ['bard_range5'],
        needs: [
            [{ level: 'bard_range4' }],
        ],
    },
    {
        levels: ['slot_machine_v2'],
        needs: [
            [{ level: 'bard_range5' }],
        ],
    },
    {
        levels: ['push_against'],
        needs: [
            [{ level: 'slot_machine_v2' }],
        ],
    },
    {
        levels: ['come_closer'],
        needs: [
            [{ level: 'push_against' }],
        ],
    },
    {
        levels: ['useful_stone'],
        needs: [
            [{ level: 'come_closer' }],
        ],
    },
    {
        levels: ['trick_shot'],
        needs: [
            [{ level: 'useful_stone' }],
        ],
    },
    {
        levels: ['bard_range6'],
        needs: [
            [{ level: 'bard_range5' }],
        ],
    },
    {
        levels: ['wizard_with_a_capital_w_2_v2'],
        needs: [
            [{ level: 'wizard_with_a_capital_w' }],
            [{ level: 'island_friends' }],
        ],
    },
    // Heroes and Water
    {
        levels: ['worlds_collide_heroes_and_mirrors_v3'],
        needs: [
            [{ level: 'mundane_mirror' }],
            [{ level: 'heroes1_10_inv_v4_b' }],
        ],
    },
    {
        levels: ['dipping_your_toes_in'],
        needs: [
            [{ level: 'worlds_collide_heroes_and_mirrors_v3' }],
        ],
    },
    {
        levels: ['crystal_bridges'],
        needs: [
            [{ level: 'dipping_your_toes_in' }],
        ],
    },
    {
        levels: ['a_wiz_out_of_water'],
        needs: [
            [{ level: 'crystal_bridges' }],
        ],
    },
    {
        levels: ['island_hopping'],
        needs: [
            [{ level: 'a_wiz_out_of_water' }],
        ],
    },
    {
        levels: ['dunk_tank_alt'],
        needs: [
            [{ level: 'island_hopping' }],
        ],
    },
    {
        levels: ['gully_alt'],
    },
    {
        levels: ['easy_situation_v2'],
        needs: [
            [{ level: 'gully_alt' }],
        ],
    },
    {
        levels: ['new_cleric_fly'],
        needs: [
            [
                { level: 'worlds_collide_heroes_and_stones' },
                { level: 'crystal_bridges' },
            ],
        ],
    },
    {
        levels: ['little_faith_alt'],
        needs: [
            [{ level: 'new_cleric_fly' }],
        ],
    },
    {
        levels: ['both_ways'],
        needs: [
            [{ level: 'little_faith_alt' }],
        ],
    },
    {
        levels: ['flamethrower'],
        needs: [
            [{ level: 'both_ways' }],
        ],
    },
    {
        levels: ['killer_wizard'],
        needs: [
            [{ level: 'flamethrower' }],
        ],
    },
    {
        levels: ['partial_pull'],
        needs: [
            [{ level: 'killer_wizard' }],
        ],
    },
    {
        levels: ['cleric_fly_intro3_v2'],
        needs: [
            [{ level: 'partial_pull' }],
        ],
    },
    {
        levels: ['monster_mover'],
        needs: [
            [{ level: 'cleric_fly_intro3_v2' }],
        ],
    },
    {
        levels: ['bard_stack_intro'],
        needs: [
            [{ level: 'flamethrower' }],
        ],
        drop: [130, 131, 36],
    },
    {
        levels: ['goblin_express'],
        needs: [
            [{ level: 'bard_stack_intro' }],
        ],
        drop: [130, 131, 36],
    },
    {
        levels: [
            'one_vs_three',
            'synchronized_swimmers',
        ],
        needs: [
            [{ level: 'flamethrower' }],
        ],
    },
    {
        levels: ['dragon_compass'],
        needs: [
            [{ level: 'synchronized_swimmers' }],
        ],
    },
    {
        levels: ['on_command'],
        needs: [
            [{ level: 'cleric_fly_intro3_v2' }],
        ],
    },
    {
        levels: ['team_building_exercise'],
        needs: [
            [
                { level: 'on_command' },
                { level: 'tug_boat' },
            ],
        ],
    },
    {
        levels: ['push_and_pull_zach'],
        needs: [
            [{ level: 'crystal_bridges' }],
        ],
    },
    {
        levels: ['drowner'],
        needs: [
            [{ level: 'push_and_pull_zach' }],
        ],
    },
    {
        levels: ['surrounded'],
        needs: [
            [{ level: 'drowner' }],
        ],
    },
    {
        levels: ['quadrants_follow_up'],
        needs: [
            [{ level: 'surrounded' }],
        ],
    },
    {
        levels: ['dont_push_the_button'],
        needs: [
            [{ level: 'quadrants_follow_up' }],
        ],
    },
    {
        levels: ['detonator'],
        needs: [
            [{ level: 'dont_push_the_button' }],
        ],
    },
    {
        levels: ['prisoners_dilemma_alt'],
        needs: [
            [{ level: 'dragon_garden' }],
            [{ level: 'detonator' }],
            [{ level: 'dunk_tank_alt' }],
        ],
    },
    {
        levels: ['quadrants'],
        needs: [
            [{ level: 'quadrants_follow_up' }],
        ],
    },
    {
        levels: ['tug_boat'],
        needs: [
            [{ level: 'cleric_fly_intro3_v2' }],
        ],
    },
    // Heroes and Water, North
    {
        levels: ['monster_gate_in_water'],
        needs: [
            [{ level: 'stone_stopper5' }],
        ],
    },
    {
        levels: ['floating_gardens'],
        needs: [
            [{ level: 'worlds_collide_heroes_and_stones' }],
        ],
    },
    {
        levels: ['four_horsemen'],
        needs: [
            [{ level: 'floating_gardens' }],
        ],
    },
    {
        levels: ['put_down_roots_v3'],
        needs: [
            [{ level: 'four_horsemen' }],
        ],
    },
    {
        levels: ['dragon_garden'],
        needs: [
            [{ level: 'put_down_roots_v3' }],
        ],
    },
    // Heroes, Duplicated
    {
        // the Freezers going_up_v4 and fly_and_flip open lead down the column to the hole
        levels: ['clone_adjust_mirror'],
        needs: [
            [{ level: 'going_up_v4' }],
            [{ level: 'fly_and_flip' }],
        ],
        drop: [134, 117, 37],
    },
    {
        levels: ['clone_maze'],
        needs: [
            [{ level: 'clone_adjust_mirror' }],
        ],
        drop: [134, 117, 37],
    },
    {
        levels: [
            'baby_steps_line',
            'surfing_lesson_alt',
        ],
        needs: [
            [{ level: 'goblin_express' }],
        ],
        drop: [130, 131, 36],
    },
    {
        levels: ['bard_range3_with_intro'],
        needs: [
            [{ level: 'surfing_lesson_alt' }],
        ],
    },
    {
        levels: ['clone_adjust'],
        needs: [
            [{ level: 'clone_maze' }],
        ],
    },
    {
        levels: ['clone_adjust_two_rocks'],
        needs: [
            [{ level: 'clone_adjust' }],
        ],
    },
    {
        levels: ['pull_line'],
        needs: [
            [{ level: 'clone_adjust_two_rocks' }],
        ],
    },
    {
        levels: ['arcadiav2_big'],
        needs: [
            [{ level: 'pull_line' }],
        ],
    },
    {
        levels: ['arcadia_surprise_big'],
        needs: [
            [{ level: 'arcadiav2_big' }],
        ],
    },
    {
        levels: ['arcadia_surprise_big2'],
        needs: [
            [{ level: 'arcadia_surprise_big' }],
        ],
    },
    {
        levels: ['pugo'],
        needs: [
            [{ level: 'pull_line' }],
        ],
    },
    {
        levels: ['button_clone_journey'],
        needs: [
            [{ level: 'pull_line' }],
        ],
    },
    // Mirrorable Mirrors
    {
        // past the Cage to_kill_a_goblin opens, a drop from the sky moves the Rock a little above the level, and the Mirrors then teleport the hero to it
        levels: ['metamirror_same_dir_v2'],
        needs: [
            [{ level: 'to_kill_a_goblin' }],
        ],
    },
    {
        levels: ['metamirror_same_dir_2_alt_2'],
        needs: [
            [{ level: 'metamirror_same_dir_v2' }],
        ],
    },
    {
        levels: ['metamirror_same_dir_3_alt_2'],
        needs: [
            [{ level: 'metamirror_same_dir_2_alt_2' }],
        ],
    },
    {
        levels: ['metamirror_different_dir_alt'],
        needs: [
            [{ level: 'metamirror_same_dir_3_alt_2' }],
        ],
    },
    {
        levels: ['metamirror_different_dir_3_alt'],
        needs: [
            [{ level: 'metamirror_different_dir_alt' }],
        ],
    },
    {
        levels: ['metamirror_different_dir_2_alt'],
        needs: [
            [{ level: 'metamirror_different_dir_3_alt' }],
        ],
    },
    {
        levels: ['metamirror_block_v2'],
        needs: [
            [{ level: 'metamirror_different_dir_2_alt' }],
        ],
    },
    {
        levels: ['metamirror_c_alt'],
        needs: [
            [{ level: 'metamirror_block_v2' }],
        ],
    },
    {
        levels: ['two_metamirrors'],
        needs: [
            [{ level: 'metamirror_c_alt' }],
        ],
    },
    {
        levels: ['metamirror_same_dir_5_alt'],
        needs: [
            [{ level: 'metamirror_same_dir_3_alt_2' }],
        ],
    },
    // Beams Reflected
    {
        levels: ['purple_corner_gem'],
        needs: [
            [{ level: 'promesst3_streamlined' }],
        ],
    },
    {
        levels: ['gem_clg_v4'],
        needs: [
            [{ level: 'purple_corner_gem' }],
        ],
    },
    {
        levels: ['shunt2_alt'],
        needs: [
            [{ level: 'plus_signs_v3' }],
        ],
    },
    {
        levels: ['orange_doubleback'],
        needs: [
            [{ level: 'dual_screen' }],
        ],
    },
    {
        levels: ['orange_doubledoubleback'],
        known: true,
        needs: [
            [{ level: 'orange_doubleback' }],
        ],
    },
    {
        levels: ['sidetrack'],
        needs: [
            [{ level: 'orange_doubledoubleback' }],
        ],
    },
    {
        levels: ['purple_wall_around_easier_vp'],
        needs: [
            [{ level: 'sidetrack' }],
        ],
    },
    {
        levels: ['purple_clm_v4'],
        needs: [
            [{ level: 'sidetrack' }],
        ],
    },
    {
        levels: ['orange_clm_s'],
        needs: [
            [{ level: 'purple_clm_v4' }],
        ],
    },
    // Reflected Beams
    {
        levels: ['tempered_glass_red'],
        needs: [
            [{ level: 'green_crystal_rover' }],
        ],
    },
    {
        levels: ['red_rooms_v5'],
        needs: [
            [{ level: 'tempered_glass_red' }],
        ],
    },
    {
        levels: ['rover_water_purple_v9'],
        needs: [
            [{ level: 'red_rooms_v5' }],
        ],
    },
    {
        levels: ['protrusions'],
        needs: [
            [{ level: 'rover_water_purple_v9' }],
        ],
    },
    {
        levels: ['mirror_promesst'],
        needs: [
            [{ level: 'protrusions' }],
        ],
    },
    {
        levels: ['rover_water_purple_sequel_v3'],
        needs: [
            [{ level: 'rover_water_purple_v9' }],
        ],
    },
    {
        levels: ['wrapping_mirror_red_v4'],
        needs: [
            [{ level: 'red_rooms_v5' }],
        ],
    },
    {
        levels: ['double_sideways'],
        needs: [
            [{ level: 'orange_predicament' }],
        ],
    },
    {
        levels: ['dual_screen'],
        needs: [
            [{ level: 'mirror_promesst' }],
        ],
    },
    {
        levels: ['mirror_non_turner_v3'],
        needs: [
            [{ level: 'dual_screen' }],
        ],
    },
    {
        levels: ['adjust_explorer_v4'],
        needs: [
            [{ level: 'mirror_non_turner_v3' }],
        ],
    },
    {
        levels: ['green_torq_mirror_vs4'],
        needs: [
            [{ level: 'wrapping_mirror_red_v4' }],
            [{ level: 'adjust_explorer_v4' }],
        ],
    },
    {
        levels: ['magic_rover'],
        needs: [
            [{ level: 'mirror_promesst' }],
        ],
    },
    {
        levels: ['remote_work'],
        needs: [
            [{ level: 'magic_rover' }],
        ],
    },
    {
        levels: ['mirror_rover_orange_2'],
        needs: [
            [{ level: 'green_crystal_rover' }],
        ],
    },
    {
        levels: ['moving_bridge'],
        needs: [
            [{ level: 'infinite_crystal_hack_v5' }],
            [{ level: 'square_dance' }],
        ],
    },
    {
        levels: ['smash_or_dash_vs2'],
        needs: [
            [{ level: 'red_rooms_v5' }],
        ],
    },
    {
        levels: ['across_the_fence_vtrader_m_p'],
        needs: [
            [{ level: 'smash_or_dash_vs2' }],
        ],
    },
    {
        levels: ['break_through_focused'],
        needs: [
            [{ level: 'across_the_fence_vtrader_m_p' }],
        ],
    },
    {
        levels: ['worlds_collide_alt'],
    },
    // Mirrors and Stones
    {
        levels: ['worlds_collide_mirrors_and_stones_v2'],
        needs: [
            [{ level: 'skipping_stones' }],
        ],
    },
    {
        levels: ['airmail'],
        needs: [
            [{ level: 'worlds_collide_mirrors_and_stones_v2' }],
        ],
    },
    {
        levels: ['thats_my_ride'],
        needs: [
            [{ level: 'airmail' }],
        ],
    },
    {
        levels: [
            'emergency_brake',
            'place_to_stand',
        ],
        needs: [
            [{ level: 'thats_my_ride' }],
        ],
    },
    {
        levels: [
            'first_diversions',
            'highway',
        ],
        needs: [
            [{ level: 'place_to_stand' }],
        ],
    },
    {
        levels: ['river_dictionary_alt_up'],
        needs: [
            [{ level: 'first_diversions' }],
        ],
    },
    {
        levels: ['short_ride_option_b'],
        needs: [
            [{ level: 'highway' }],
        ],
    },
    {
        levels: ['mirror_stone_intro'],
        needs: [
            [{ level: 'place_to_stand' }],
        ],
    },
    {
        levels: ['catch_and_drop'],
        needs: [
            [{ level: 'mirror_stone_intro' }],
        ],
    },
    {
        levels: ['catch_and_throw'],
        needs: [
            [{ level: 'catch_and_drop' }],
        ],
    },
    {
        levels: ['already_dropped_v2'],
        needs: [
            [{ level: 'on_the_rocks' }],
        ],
        drop: [131, 44, 29],
    },
    {
        levels: ['cancel_out'],
    },
    {
        levels: ['zig_zag'],
        needs: [
            [{ level: 'cancel_out' }],
        ],
    },
    {
        levels: ['ricochet_v2'],
        needs: [
            [{ level: 'zig_zag' }],
        ],
    },
    {
        levels: ['run_the_clock_alt'],
        needs: [
            [{ level: 'ricochet_v2' }],
        ],
    },
    {
        levels: ['far_river'],
        needs: [
            [{ level: 'river_dictionary_alt_up' }],
        ],
    },
    {
        levels: ['ditching_cargo'],
        needs: [
            [{ level: 'far_river' }],
        ],
    },
    {
        levels: ['unblock_block_alt'],
        needs: [
            [{ level: 'ditching_cargo' }],
        ],
    },
    {
        levels: ['there_and_back'],
        needs: [
            [{ level: 'unblock_block_alt' }],
        ],
    },
    {
        levels: ['sink_together'],
        needs: [
            [{ level: 'there_and_back' }],
        ],
    },
    {
        levels: ['in_the_way_alt_3'],
        needs: [
            [{ level: 'sink_together' }],
        ],
    },
    {
        levels: ['coax_a_lot'],
        needs: [
            [{ level: 'sink_together' }],
        ],
    },
    {
        levels: ['river_push_v4'],
        needs: [
            [{ level: 'coax_a_lot' }],
        ],
    },
    {
        levels: ['launch_and_collect'],
        needs: [
            [{ level: 'catch_and_throw' }],
        ],
    },
    {
        levels: ['lilyruga_simpler'],
        needs: [
            [{ level: 'launch_and_collect' }],
        ],
    },
    {
        levels: ['make_it_happen_v6'],
        needs: [
            [{ level: 'place_to_stand' }],
        ],
    },
    {
        levels: ['wider_ocean'],
        needs: [
            [{ level: 'make_it_happen_v6' }],
        ],
    },
    {
        levels: ['reel_it_in'],
        needs: [
            [{ level: 'wider_ocean' }],
        ],
    },
    {
        levels: ['new_new_new_slam'],
        needs: [
            [{ level: 'reel_it_in' }],
        ],
    },
    {
        levels: ['bad_aim_v2'],
        needs: [
            [{ level: 'reel_it_in' }],
        ],
    },
    {
        levels: [
            'multipurpose',
            'wide_ocean',
        ],
        needs: [
            [{ level: 'bad_aim_v2' }],
        ],
    },
    {
        levels: ['mirror_motion'],
        needs: [
            [{ level: 'reel_it_in' }],
        ],
    },
    {
        levels: ['diag_slide'],
        needs: [
            [{ level: 'mirror_motion' }],
        ],
    },
    {
        levels: ['the_long_way'],
        needs: [
            [{ level: 'diag_slide' }],
        ],
    },
    {
        levels: ['ride_together'],
        needs: [
            [{ level: 'the_long_way' }],
        ],
    },
    {
        levels: ['two_bounce_v2'],
        needs: [
            [{ level: 'ride_together' }],
        ],
    },
    {
        levels: ['river_plinko_v2_actual'],
        needs: [
            [{ level: 'coax_a_lot' }],
        ],
    },
    {
        levels: ['reflect_momentum'],
        needs: [
            [{ level: 'catch_and_throw' }],
        ],
    },
    {
        levels: ['sidestone_zach_1'],
        needs: [
            [{ level: 'lilyruga_simpler' }],
        ],
    },
    {
        levels: ['sidestone_zach_2'],
        needs: [
            [{ level: 'sidestone_zach_1' }],
        ],
    },
    {
        levels: ['sidestone_zach_3'],
        needs: [
            [{ level: 'sidestone_zach_2' }],
        ],
    },
    {
        levels: ['sidestone_zach_4'],
        needs: [
            [{ level: 'sidestone_zach_3' }],
        ],
    },
    {
        levels: ['square_dance'],
        needs: [
            [{ level: 'two_step' }],
        ],
    },
    // Alter Beam
    {
        levels: ['promesst2.5_deeper'],
        needs: [
            [{ level: 'promesst2_streamlined' }],
        ],
    },
    {
        levels: ['half_tutorial', 'monkey_in_the_midpoint', 'promesst3_streamlined'],
        needs: [
            [{ level: 'promesst2.5_deeper' }],
        ],
    },
    {
        levels: ['gem_beam_placement'],
        needs: [
            [{ level: 'promesst3_streamlined' }],
        ],
    },
    // Stones Illuminated
    {
        // through the Freezer air_skating_v6 opens onto the sky platform, then a hole lands in the corridor of the level
        levels: ['first_flight'],
        needs: [
            [{ level: 'air_skating_v6' }],
        ],
        drop: [16, 60, 38],
    },
    {
        // through the Freezer air_skating_v6 opens onto the sky platform, then a hole lands beside the level
        levels: ['orange_predicament'],
        needs: [
            [{ level: 'air_skating_v6' }],
        ],
        drop: [8, 42, 38],
    },
    {
        // through the Freezer air_skating_v6 opens onto the sky platform, then a hole lands beside the level
        levels: ['skip_orange_maze_v3'],
        needs: [
            [{ level: 'air_skating_v6' }],
        ],
        drop: [20, 39, 38],
    },
    {
        levels: ['orange_skip_place_v3'],
        known: true,
        needs: [
            [{ level: 'skip_orange_maze_v3' }],
        ],
    },
    {
        levels: ['skip_orange_wall_v3'],
        needs: [
            [{ level: 'orange_skip_place_v3' }],
        ],
    },
    {
        levels: ['through_way'],
        needs: [
            [{ level: 'worlds_collide_ps' }],
        ],
    },
    {
        levels: ['sp_crystal_tuto'],
        needs: [
            [{ level: 'through_way' }],
        ],
    },
    {
        levels: ['purple_beam_intro_v2_alt'],
        needs: [
            [{ level: 'sp_crystal_tuto' }],
        ],
    },
    {
        levels: ['faster_than_stone'],
        needs: [
            [{ level: 'purple_beam_intro_v2_alt' }],
        ],
    },
    {
        levels: ['doorstop'],
        needs: [
            [{ level: 'faster_than_stone' }],
        ],
    },
    {
        levels: ['doorstop_reprise_easier'],
        needs: [
            [{ level: 'doorstop' }],
        ],
    },
    {
        levels: ['glass_beach'],
        needs: [
            [{ level: 'doorstop_reprise_easier' }],
        ],
    },
    {
        levels: ['break_send_lily_c'],
        needs: [
            [{ level: 'glass_beach' }],
        ],
    },
    {
        levels: ['hustle_v2'],
        needs: [
            [{ level: 'faster_than_stone' }],
        ],
    },
    {
        levels: ['frantic_factory_v2'],
        needs: [
            [{ level: 'promesst3_streamlined' }],
        ],
    },
    {
        levels: ['skipping_cyan_precise_c_v3'],
        needs: [
            [{ level: 'frantic_factory_v2' }],
        ],
    },
    {
        levels: ['indirect_skip_3'],
        needs: [
            [{ level: 'indirect_skip_2' }],
        ],
    },
    {
        levels: ['skipping_near_beams_v2'],
        needs: [
            [{ level: 'sp_crystal_tuto' }],
        ],
    },
    {
        levels: ['skip_orange_block_c'],
        needs: [
            [{ level: 'faster_than_stone' }],
        ],
    },
    {
        levels: ['skipping_promesst'],
        needs: [
            [{ level: 'sp_crystal_tuto' }],
        ],
    },
    {
        levels: ['skipping_wrapping_v3'],
        needs: [
            [{ level: 'skipping_promesst' }],
        ],
    },
    {
        levels: ['rover_impulse_v2'],
        needs: [
            [{ level: 'skipping_wrapping_v3' }],
        ],
    },
    {
        levels: ['submarine'],
        needs: [
            [{ level: 'rover_impulse_v2' }],
        ],
    },
    {
        levels: ['submarine_far_away'],
        needs: [
            [{ level: 'submarine' }],
        ],
    },
    {
        levels: ['crystal_rover_intro'],
        needs: [
            [{ level: 'submarine' }],
        ],
        drop: [7, 61, 29],
    },
    {
        levels: ['green_crystal_rover'],
        needs: [
            [{ level: 'crystal_rover_intro' }],
        ],
    },
    {
        levels: ['rover_advance_c_v2'],
        needs: [
            [{ level: 'rover_impulse_v2' }],
        ],
    },
    {
        levels: ['rover_shift_p'],
        needs: [
            [{ level: 'rover_advance_c_v2' }],
        ],
    },
    {
        // through the Freezer rover_impulse_v2 opens into the submarine pocket, then through the Freezer submarine opens
        levels: ['skip_or_sink_r'],
        needs: [
            [{ level: 'rover_impulse_v2' }],
            [{ level: 'submarine' }],
        ],
    },
    {
        levels: ['skip_wand_v6'],
        needs: [
            [{ level: 'skip_or_sink_r' }],
        ],
    },
    {
        levels: ['stonewalled'],
        needs: [
            [{ level: 'sp_crystal_tuto' }],
        ],
    },
    // Charmed Stacks
    {
        levels: ['i_beam_v2'],
        needs: [
            [{ level: 'flamethrower' }],
        ],
    },
    {
        levels: ['bard_must_stack4_fix'],
        needs: [
            [{ level: 'flamethrower' }],
        ],
    },
    {
        levels: [
            'jump_to_pillar_v3',
            'no_charm',
        ],
        needs: [
            [{ level: 'flamethrower' }],
        ],
    },
    {
        levels: ['stones_below_v3'],
        needs: [
            [{ level: 'no_charm' }],
        ],
    },
    {
        levels: ['mountain_music'],
        needs: [
            [{ level: 'jenga_shortstack_v2' }],
        ],
    },
    {
        levels: ['tippy_intro'],
        needs: [
            [{ level: 'mountain_music' }],
        ],
    },
    {
        levels: ['tippy_towers_1'],
        needs: [
            [{ level: 'tippy_intro' }],
        ],
    },
    {
        levels: ['tippy_towers_4'],
        needs: [
            [{ level: 'tippy_towers_1' }],
        ],
    },
    {
        levels: [
            'bard_triangle',
            'high_shelf_v2',
        ],
        needs: [
            [{ level: 'tippy_towers_4' }],
        ],
    },
    {
        levels: ['erosion_alt'],
        known: true,
        needs: [
            [{ level: 'falloff_dragons' }],
        ],
    },
    // Skipping and Falling
    {
        levels: ['lily_falls_intro_v2'],
        needs: [
            [{ level: '3d_intro_skipping' }],
        ],
    },
    {
        levels: ['many_falls'],
        needs: [
            [{ level: 'lily_falls_intro_v2' }],
        ],
    },
    {
        levels: ['pool_pal_v2'],
        needs: [
            [{ level: 'many_falls' }],
        ],
    },
    {
        levels: ['tiger_lily_v2'],
        needs: [
            [{ level: 'many_falls' }],
        ],
    },
    {
        levels: ['on_the_rocks'],
        needs: [
            [{ level: 'pool_pal_v2' }],
            [{ level: 'tiger_lily_v2' }],
        ],
    },
    {
        levels: ['button_shut_in'],
        needs: [
            [{ level: 'on_the_rocks' }],
        ],
    },
    {
        levels: ['sunk_cost_2_v3'],
        needs: [
            [{ level: 'pool_pal_v2' }],
        ],
    },
    {
        levels: ['carry_lily'],
        needs: [
            [{ level: 'tiger_lily_v2' }],
        ],
    },
    {
        levels: ['removal_v2'],
        needs: [
            [{ level: 'carry_lily' }],
        ],
    },
    {
        levels: ['delay_time_v2'],
        needs: [
            [{ level: 'many_falls' }],
        ],
    },
    // Heroes and Depth
    {
        levels: ['gated_twice_v2'],
        needs: [
            [{ level: '3d_intro_heroes' }],
        ],
    },
    {
        levels: ['gated_twice_thief_v2'],
        needs: [
            [{ level: 'gated_twice_v2' }],
        ],
    },
    {
        levels: ['connect_the_dots_v5'],
        needs: [
            [{ level: 'gated_twice_thief_v2' }],
        ],
    },
    {
        levels: ['zombie_graves_v3'],
        needs: [
            [{ level: 'connect_the_dots_v5' }],
        ],
    },
    {
        levels: ['dragon_bridge'],
        needs: [
            [{ level: 'zombie_graves_v3' }],
        ],
    },
    {
        levels: ['pulling_pedestals'],
        needs: [
            [{ level: 'connect_the_dots_v5' }],
        ],
    },
    {
        levels: ['thief_stack'],
        needs: [
            [{ level: 'pulling_pedestals' }],
        ],
    },
    {
        levels: ['priest_descent_simpler'],
        needs: [
            [{ level: 'connect_the_dots_v5' }],
        ],
    },
    {
        levels: ['priest_button_3d_revised'],
        known: true,
        needs: [
            [{ level: 'priest_descent_simpler' }],
        ],
    },
    {
        levels: ['priest_3d_goblin_pass'],
        needs: [
            [{ level: 'priest_button_3d_revised' }],
        ],
    },
    {
        levels: ['out_of_range_v4'],
        needs: [
            [{ level: 'mountain_music' }],
        ],
    },
    {
        levels: ['magicians_assistant_v2'],
        needs: [
            [{ level: 'jenga_shortstack_v2' }],
        ],
    },
    {
        levels: [
            'musical_staircase_v2',
            'sticky',
        ],
        needs: [
            [{ level: 'mountain_music' }],
        ],
    },
    {
        levels: ['falloff_intro'],
        needs: [
            [{ level: 'magicians_assistant_v2' }],
        ],
    },
    {
        levels: ['falloff_4'],
        needs: [
            [{ level: 'falloff_intro' }],
        ],
    },
    {
        levels: ['falloff_kill_goblins_v6'],
        needs: [
            [{ level: 'falloff_4' }],
        ],
    },
    {
        levels: ['falloff_dragons'],
        known: true,
        needs: [
            [{ level: 'falloff_4' }],
        ],
    },
    {
        levels: ['fire_stairs_part_2'],
        needs: [
            [{ level: 'fire_stairs_v2' }],
        ],
    },
    {
        levels: ['loading_docks_v2'],
        needs: [
            [{ level: 'zombie_graves_v3' }],
        ],
    },
    {
        levels: ['assassins_creed'],
        needs: [
            [{ level: 'loading_docks_v2' }],
        ],
    },
    {
        levels: ['magic_tower'],
        needs: [
            [{ level: 'erosion_alt' }],
        ],
    },
    {
        levels: ['sky_druid_kill'],
        needs: [
            [{ level: 'zombie_graves_v3' }],
        ],
    },
    {
        levels: ['sky_druid_kill_tall_2_goblins'],
        needs: [
            [{ level: 'sky_druid_kill' }],
        ],
    },
    {
        levels: ['stopper_topper_v2'],
        known: true,
        needs: [
            [{ level: 'sky_druid_kill_tall_2_goblins' }],
        ],
    },
    {
        levels: ['sky_druid_tree_ex'],
        needs: [
            [{ level: 'stopper_topper_v2' }],
        ],
    },
    {
        levels: ['druid_3d_beam'],
        needs: [
            [{ level: 'sky_druid_tree_ex' }],
        ],
    },
    {
        levels: ['weaklings_bard_v2'],
        needs: [
            [{ level: 'sky_druid_tree_ex' }],
        ],
    },
    {
        levels: ['sky_druid_maze'],
        needs: [
            [{ level: 'weaklings_bard_v2' }],
        ],
    },
    {
        levels: ['sky_druid_one'],
        needs: [
            [{ level: 'sky_druid_maze' }],
        ],
    },
    // Double Beam Falling
    {
        // the red Gem is moved a long way, as for green_hat, and getting it up here takes drop_sokoban
        levels: ['into_the_water_3'],
        needs: [
            [{ level: 'drop_sokoban' }],
        ],
    },
    {
        levels: ['air_skating_v6'],
        needs: [
            [{ level: 'into_the_water_3' }],
        ],
    },
    {
        levels: ['thin_ice_rooms'],
        needs: [
            [{ level: 'air_skating_v6' }],
        ],
    },
    {
        levels: ['dragons_layer'],
        needs: [
            [{ level: 'thin_ice_rooms' }],
        ],
    },
    {
        levels: ['the_sky_is_falling_v2'],
        needs: [
            [{ level: 'dragons_layer' }],
        ],
    },
    {
        levels: ['monster_drop'],
        needs: [
            [{ level: 'thin_ice_rooms' }],
        ],
    },
    {
        levels: ['sky_double_intro0'],
        needs: [
            [{ level: 'drop_sokoban' }],
        ],
    },
    {
        levels: ['sky_double_intro1'],
        needs: [
            [{ level: 'sky_double_intro0' }],
        ],
    },
    {
        levels: ['through_the_table_e'],
        needs: [
            [{ level: 'dragons_layer' }],
        ],
    },
    {
        levels: ['laser_stop_surprise'],
        needs: [
            [{ level: 'through_the_table_e' }],
        ],
    },
    {
        levels: ['double_up'],
        needs: [
            [{ level: 'laser_stop_surprise' }],
        ],
    },
    {
        levels: ['side_sub_v2'],
        needs: [
            [{ level: 'double_up' }],
        ],
    },
    {
        levels: ['side_sub_back'],
        needs: [
            [{ level: 'side_sub_v2' }],
        ],
    },
    {
        levels: ['orange_snake'],
        needs: [
            [{ level: 'double_up' }],
        ],
    },
    {
        levels: ['annoying_orange_v3'],
        needs: [
            [{ level: 'double_up' }],
        ],
    },
    {
        levels: ['fire_from_above_2'],
        needs: [
            [{ level: 'laser_stop_surprise' }],
        ],
    },
    {
        levels: ['hat_maker'],
        needs: [
            [{ level: 'fire_from_above_2' }],
        ],
    },
    {
        levels: ['through_the_table_f'],
        needs: [
            [{ level: 'through_the_table_e' }],
        ],
    },
    {
        levels: ['vertical_promesst_v2'],
        needs: [
            [{ level: '3d_intro_promesst_v5' }],
        ],
    },
    // Elevators
    {
        levels: ['sokobridge_v4'],
        needs: [
            [{ level: '3d_intro_promesst_v5' }],
        ],
    },
    {
        // the Rock sokobridge_v4 frees is pushed west to x 42, south off the elevator landing onto the south row of the z 35 ledge and west along it, and drops into the gap at x 39 as a bridge to the level; the Activator beside its Spawner puts it back for another use
        levels: ['elevator_cyan'],
        needs: [
            [{ level: 'sokobridge_v4' }],
        ],
    },
    {
        // the red Gem is moved a long way, past the Freezer that also leads to breaking the Rocks on the way to Low
        levels: ['green_hat'],
        needs: [
            [{ sign: 115389567 }],
            [{ level: 'stay_lit' }],
        ],
    },
    {
        levels: ['its_a_tall_order'],
        needs: [
            [{ level: 'green_hat' }],
        ],
    },
    {
        levels: ['taking_the_lift'],
        needs: [
            [{ level: 'sokobridge_v4' }],
        ],
    },
    {
        levels: ['trick_landing'],
        needs: [
            [{ level: 'taking_the_lift' }],
        ],
    },
    {
        levels: ['drop_sokoban'],
        needs: [
            [{ level: 'trick_landing' }],
        ],
    },
    {
        // the Gem taking_the_lift frees is pushed off the plateau and across the courtyard to the east side of the 1-high pillar the level stands on; the hero rides the elevator at (28, 71) up to the z 40 platform and drops from its west edge onto the Gem, a step level with the level
        levels: ['double_the_fun'],
        needs: [
            [{ level: 'taking_the_lift' }],
        ],
    },
    {
        levels: ['corner_trick_easier'],
        needs: [
            [{ level: 'beam_sisters' }],
        ],
    },
    {
        levels: ['landmines_v3'],
        needs: [
            [{ level: 'taking_the_lift' }],
        ],
    },
    {
        levels: ['shower'],
        needs: [
            [{ level: 'landmines_v3' }],
        ],
    },
    // The Mirror Way
    {
        levels: ['flamestrike_v3'],
        needs: [
            [{ level: 'priest_3d_intro_dragon_v4' }],
        ],
    },
    {
        levels: ['volcano_v3'],
        needs: [
            [{ level: 'flamestrike_v3' }],
        ],
    },
    {
        // the vertical magic Mirrors east of the strip hop the hero out over the gaps, the last one into the corridor the level stands in
        levels: ['pachinko'],
        needs: [
            [{ level: 'repel' }],
        ],
    },
    {
        levels: ['pachinko_rescue_w'],
        needs: [
            [{ level: 'pachinko' }],
        ],
    },
    {
        // from the corridor north of the pad that pachinko_rescue_w frees, the downward vertical Mirror high above it throws the hero ten cells west, over the chasm_3 room, and he drops into it
        levels: ['chasm_3'],
        needs: [
            [{ level: 'pachinko_rescue_w' }],
        ],
    },
    // Vertical Endpoints
    {
        // the Gem landmines_v3 frees goes onto its Gem_Slot; the lights it powers open the way down to the level
        levels: ['sender_simplified_v2'],
        needs: [
            [{ level: 'landmines_v3' }],
        ],
    },
    {
        levels: ['seeing_red'],
        needs: [
            [{ level: 'wolf_boat_carry' }],
        ],
    },
    {
        levels: ['one_floor_down_v2'],
        needs: [
            [{ level: 'seeing_red' }],
        ],
    },
    {
        // the hero steps north in the beam of the Light landmines_v3 frees, now clear of the seeing_red Freezer, and jumps to its end beside the level
        levels: ['vacuum'],
        needs: [
            [{ level: 'landmines_v3' }],
            [{ level: 'seeing_red' }],
        ],
    },
    {
        // the beam, turned up and east by the Mirror vacuum frees, jumps the hero onto the island of the level
        levels: ['pink_platforms'],
        needs: [
            [{ level: 'vacuum' }],
        ],
    },
    {
        // the beam jumps the hero onto the pink_platforms island, whose elevator rises to the level
        levels: ['suspend_intro'],
        needs: [
            [{ level: 'vacuum' }],
        ],
    },
    {
        // the beam, turned up at the island and west across z 49 by the Mirrors those levels free, jumps the hero to a cell over the level, which he drops into
        levels: ['suspend_block_v2'],
        needs: [
            [{ level: 'pink_platforms' }],
            [{ level: 'suspend_intro' }],
        ],
    },
    {
        // the Mirror suspend_block_v2 frees turns the beam south along the z 49 platform, and the jump ends beside the level
        levels: ['suspend_heterogeneous'],
        needs: [
            [{ level: 'suspend_block_v2' }],
        ],
    },
    {
        levels: ['suspend_directions_v2'],
        needs: [
            [{ level: 'suspend_heterogeneous' }],
        ],
    },
    {
        levels: ['suspend_swapper_hard'],
        needs: [
            [{ level: 'suspend_directions_v2' }],
        ],
    },
    {
        // the same full beam relay ends in the corridor that holds the level and height_chooser_v0
        levels: ['beam_jail_v3'],
        needs: [
            [{ level: 'suspend_directions_v2' }],
            [{ level: 'one_floor_down_v2' }],
        ],
    },
    {
        levels: ['high_endpoint_v2'],
        needs: [
            [{ level: 'beam_jail_v3' }],
        ],
    },
    {
        // with the last Mirrors and Freezers of the relay cleared the beam runs down to z 38 and north, and the jump ends beside the level
        levels: ['height_chooser_v0'],
        needs: [
            [{ level: 'suspend_directions_v2' }],
            [{ level: 'one_floor_down_v2' }],
        ],
    },
    // Skipping Stacks
    {
        levels: ['skip_stack_1'],
        needs: [
            [{ level: 'pool_pal_v2' }],
            [{ level: 'tiger_lily_v2' }],
        ],
    },
    {
        levels: ['skip_stack_2'],
        needs: [
            [{ level: 'skip_stack_1' }],
        ],
    },
    {
        levels: ['skip_stack_3'],
        needs: [
            [{ level: 'skip_stack_2' }],
        ],
    },
    {
        levels: ['depositor_thief'],
        needs: [
            [{ level: 'skip_stack_1' }],
            [{ level: 'skip_stack_3' }],
        ],
    },
    {
        levels: ['depositor_bard'],
        needs: [
            [{ level: 'depositor_thief' }],
        ],
    },
    {
        levels: ['the_waterfall_v4'],
        needs: [
            [{ level: 'from_the_depths' }],
            [{ level: 'depositor_thief' }],
        ],
    },
    {
        levels: ['priest_water_back_goblin'],
        needs: [
            [{ level: 'the_waterfall_v4' }],
        ],
    },
    {
        levels: ['priest_water_back_place_v3'],
        needs: [
            [{ level: 'priest_water_back_goblin' }],
        ],
    },
    // Stacks and Water
    {
        levels: ['personal_assistant_v3'],
        needs: [
            [{ level: '3d_intro_heroes' }],
        ],
    },
    {
        levels: ['push_down_a_lot_small'],
        known: true,
        needs: [
            [{ level: 'personal_assistant_v3' }],
        ],
    },
    {
        levels: ['my_first_stack'],
        needs: [
            [{ level: 'push_down_a_lot_small' }],
        ],
    },
    {
        levels: ['single_out'],
        needs: [
            [{ level: 'my_first_stack' }],
        ],
    },
    {
        levels: ['jenga_shortstack_v2'],
        needs: [
            [{ level: 'single_out' }],
        ],
    },
    {
        levels: ['jenga_easier'],
        needs: [
            [{ level: 'jenga_shortstack_v2' }],
        ],
    },
    // Goblin Turning
    {
        levels: ['crystal_logistics'],
        needs: [
            [{ level: 'sokobridge_v4' }],
        ],
    },
    {
        levels: ['beam_sisters'],
        needs: [
            [{ level: 'crystal_logistics' }],
        ],
    },
    {
        levels: ['goblin_below_intro_same_z'],
        needs: [
            [{ level: 'beam_sisters' }],
        ],
    },
    {
        levels: ['chain_gang'],
        needs: [
            [{ level: 'thin_ice_rooms' }],
            [{ level: 'goblin_below_intro_same_z' }],
        ],
    },
    {
        levels: ['chain_gang3'],
        needs: [
            [{ level: 'chain_gang' }],
        ],
    },
    {
        // through the cage beam_sisters opens into the goblin_below_intro_same_z room, then south through both Freezers of its doorway, which goblin_below_intro_same_z and thin_ice_rooms open
        levels: ['pass_through_v2_same_z'],
        needs: [
            [{ level: 'goblin_below_intro_same_z' }],
            [{ level: 'thin_ice_rooms' }],
        ],
    },
    {
        levels: ['aggro_maze'],
        needs: [
            [{ level: 'thin_ice_rooms' }],
        ],
    },
    {
        levels: ['aggro_which0'],
        needs: [
            [{ level: 'aggro_maze' }],
        ],
    },
    // Top of the World
    {
        levels: ['priest_traverse_e_fence'],
        needs: [
            [{ level: 'frame_advance_v5' }],
        ],
    },
    // Vertical Mirrors
    {
        levels: ['vert_mirror_intro'],
        needs: [
            [{ level: 'falling_blocker_v3' }],
        ],
    },
    {
        // the vertical Mirror vert_mirror_intro frees lifts the hero from the corridor west of the tower up onto its ground-level top, where portable_stairs stands
        levels: ['portable_stairs'],
        needs: [
            [{ level: 'vert_mirror_intro' }],
        ],
    },
    {
        // the vertical Mirror portable_stairs frees is pushed east along the south ledge, and its lift carries the hero onto the tower top row, east of the fences, where drawbridge stands
        levels: ['drawbridge'],
        needs: [
            [{ level: 'portable_stairs' }],
        ],
    },
    {
        // the vertical Mirror portable_stairs frees is pushed west along the south ledge, and its lift carries the hero onto the tower top row, west of the fences, where implausible_bridge stands
        levels: ['implausible_bridge'],
        needs: [
            [{ level: 'drawbridge' }],
        ],
    },
    {
        // the vertical Mirror implausible_bridge frees, at the west corner of the tower top, lifts the hero onto the inner court, where bottom_bridge_v2 stands
        levels: ['bottom_bridge_v2'],
        needs: [
            [{ level: 'implausible_bridge' }],
        ],
    },
    {
        // the vertical Mirror implausible_bridge frees, at the east corner of the tower top, lifts the hero onto the inner court, where mission_impossible stands
        levels: ['mission_impossible'],
        needs: [
            [{ level: 'bottom_bridge_v2' }],
        ],
    },
    {
        // the vertical Mirror mission_impossible frees is pushed west along the inner court row and lifts the hero onto the platform above the court, where repel stands
        levels: ['repel'],
        needs: [
            [{ level: 'mission_impossible' }],
        ],
    },
    {
        levels: ['new_way_mirror_later'],
        needs: [
            [{ level: 'repel' }],
        ],
    },
    {
        levels: ['implausible_bridge_2'],
        needs: [
            [{ level: 'new_way_mirror_later' }],
        ],
    },
    {
        levels: ['catching_up_v2'],
        needs: [
            [{ level: 'implausible_bridge_2' }],
        ],
    },
    {
        levels: ['quick_redirect_v5'],
        needs: [
            [{ level: 'catching_up_v2' }],
        ],
    },
    {
        levels: ['to_kill_a_goblin'],
        needs: [
            [{ level: 'quick_redirect_v5' }],
        ],
    },
    {
        levels: ['tall_stack'],
        needs: [
            [{ level: 'to_kill_a_goblin' }],
        ],
    },
    {
        levels: ['bottom_adjust'],
        needs: [
            [{ level: 'tall_stack' }],
        ],
    },
    {
        levels: ['bridgey'],
        needs: [
            [{ level: 'to_kill_a_goblin' }],
        ],
    },
    {
        levels: ['bridgey2'],
        needs: [
            [{ level: 'bridgey' }],
        ],
    },
    {
        levels: ['bridgey2b'],
        needs: [
            [{ level: 'bridgey2' }],
        ],
    },
    {
        levels: ['wolf_boat_carry'],
        needs: [
            [{ level: 'bridgey2b' }],
            [{ level: 'goblin_parity_3d' }],
        ],
    },
    {
        levels: ['juggle'],
        needs: [
            [{ level: 'wolf_boat_carry' }],
        ],
    },
    {
        levels: ['bridgey3_abstract_art'],
        needs: [
            [{ level: 'bridgey2' }],
        ],
    },
    {
        levels: ['all_out_goblin_war'],
        needs: [
            [{ level: 'bridgey3_abstract_art' }],
        ],
    },
    {
        levels: ['escape_bridge'],
        needs: [
            [{ level: 'all_out_goblin_war' }],
        ],
    },
    {
        levels: ['tandem'],
        needs: [
            [{ level: 'escape_bridge' }],
        ],
    },
    {
        levels: ['overwrite'],
        needs: [
            [{ level: 'repel' }],
        ],
    },
    {
        levels: ['bottom_bridge_tall'],
        needs: [
            [{ level: 'bottom_bridge_v2' }],
        ],
    },
    // Protection and Support
    {
        // the Freezer stands on the elevator up to the dragon's fire line, which holds up the Protected hero along the pads
        levels: ['priest_3d_intro_dragon_v4'],
        needs: [
            [{ level: 'priest_3d_goblin_pass' }],
        ],
    },
    {
        levels: ['priest_bottom_v2'],
        needs: [
            [{ level: 'priest_3d_intro_dragon_v4' }],
        ],
    },
    {
        levels: ['fire_stairs_v2'],
        needs: [
            [{ level: 'priest_bottom_v2' }],
        ],
    },
    {
        levels: ['priest_warrior_descent'],
        needs: [
            [{ level: 'priest_bottom_v2' }],
        ],
    },
    {
        levels: ['from_the_depths'],
        needs: [
            [{ level: 'priest_bottom_v2' }],
        ],
    },
    {
        levels: ['priest_two_warriors_v3'],
        needs: [
            [{ level: 'from_the_depths' }],
        ],
    },
    {
        levels: ['monster_stack'],
        needs: [
            [{ level: 'priest_two_warriors_v3' }],
        ],
    },
    {
        levels: ['catching_fire_v2'],
        needs: [
            [{ level: 'priest_two_warriors_v3' }],
        ],
    },
    {
        levels: ['frame_advance_v5'],
        needs: [
            [{ level: 'catching_fire_v2' }],
        ],
    },
    {
        levels: ['stuck_up_v2'],
        needs: [[{ level: 'frame_advance_v5' }]],
    },
    // Four Together
    {
        // through the orange light above simultaneous_x, which turns once three_artifacts_v3 and magnitudes_v3 are solved (the Torc turn is not walked)
        levels: ['4wcn_all_fast'],
        needs: [
            [{ level: 'three_artifacts_v3' }],
            [{ level: 'magnitudes_v3' }],
        ],
    },
    {
        levels: ['4wc_dragon_cyan_s_v2'],
        needs: [
            [{ level: '4wcn_all_fast' }],
        ],
    },
    // Bard and Water
    {
        levels: [
            'rowboat_wizard_v2',
            'ice_climbers',
        ],
        needs: [
            [{ level: 'bard_stack_intro' }],
        ],
    },
    {
        levels: ['goblin_two_rovers_alt'],
        needs: [
            [
                { level: 'open_monster' },
                { level: 'thief_dragger_v2' },
            ],
        ],
    },
    {
        levels: ['rowboat'],
        needs: [
            [{ level: 'rowboat_wizard_v2' }],
        ],
    },
    {
        levels: ['boat_priest_v3'],
        needs: [
            [{ level: 'rowboat' }],
        ],
    },
    {
        levels: ['limited_offsets'],
        needs: [
            [{ level: 'boat_priest_v3' }],
        ],
    },
    {
        levels: ['drop_off'],
        needs: [
            [{ level: 'limited_offsets' }],
        ],
    },
    {
        // the laser and the Rock in the Freezers limited_offsets opens open the red Gate between the two Dragons, which kill each other and open the monster Gate around the level
        levels: ['limited_offsets_surprise_v2'],
        needs: [
            [{ level: 'limited_offsets' }],
        ],
    },
    {
        // the Rocks in the Freezers rowboat and boat_priest_v3 open, with a third, fill the fenced water west of boat_priest_v3, and the hero crosses them
        levels: ['front_side_bus2'],
        needs: [
            [{ level: 'boat_priest_v3' }],
        ],
    },
    {
        levels: ['front_side_bus3'],
        needs: [
            [{ level: 'front_side_bus2' }],
        ],
    },
    {
        levels: ['bard_movable_island'],
        needs: [
            [{ level: 'front_side_bus3' }],
        ],
    },
    {
        levels: ['bard_movable_island2'],
        known: true,
        needs: [
            [{ level: 'bard_movable_island' }],
        ],
    },
    {
        levels: ['pole_vault'],
        needs: [
            [{ level: 'bard_movable_island2' }],
        ],
    },
    {
        // the Rocks in the Freezers bard_movable_island2 opens, with the room's own, fill the water east of the floor block west of missile_command, and the hero crosses them
        levels: ['missile_command'],
        needs: [
            [{ level: 'bard_movable_island2' }],
        ],
    },
    // Crystal Carts
    {
        levels: ['mirror_crystal_rover'],
        needs: [
            [{ level: 'mirror_rover_orange_2' }],
        ],
    },
    {
        levels: ['crystal_rover_rush'],
        needs: [
            [{ level: 'mirror_crystal_rover' }],
        ],
    },
    {
        levels: ['crystal_rover_bridge'],
        needs: [
            [{ level: 'crystal_rover_rush' }],
        ],
    },
    {
        levels: ['perch_3_rovers'],
        needs: [
            [{ level: 'crystal_rover_bridge' }],
        ],
    },
    {
        levels: ['triple_skip'],
        needs: [
            [{ level: 'crystal_rover_bridge' }],
        ],
    },
    {
        levels: ['quadruple_skip'],
        needs: [
            [{ level: 'triple_skip' }],
        ],
    },
    {
        levels: ['endpoint_wrap_druid_alt'],
        needs: [
            [{ level: 'get_through_alt' }],
        ],
    },
    {
        levels: ['endpoint_maze'],
        needs: [
            [{ level: 'endpoint_wrap_druid_alt' }],
        ],
    },
    // Doubling Beams
    {
        levels: ['3wcn_purple_mirror_skip'],
    },
    {
        levels: ['duality_condensed'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        // the ride of the Lily on the wrapping river, as for far_wings
        levels: ['duality_2'],
        needs: [
            [{ level: 'wrap_music' }],
            [{ level: 'duality_condensed' }],
        ],
    },
    {
        levels: ['half_journey_vh'],
        needs: [
            [{ level: 'zachtronics_identity' }],
        ],
    },
    {
        levels: [
            'orange_mirror_walk_button',
            'orange_water_button_vslow',
        ],
    },
    {
        levels: ['lazy_susan_v2'],
        needs: [
            [{ level: 'three_artifacts_v3' }],
        ],
    },
    {
        levels: ['magnitudes_v3'],
        needs: [
            [{ level: 'three_artifacts_v3' }],
        ],
    },
    {
        levels: ['orange_water_button_vdouble_v2'],
        needs: [
            [{ level: 'orange_water_button_vslow' }],
        ],
    },
    {
        levels: ['orange_water_button_vfour_alter'],
        needs: [
            [{ level: 'orange_water_button_vdouble_v2' }],
        ],
    },
    // Endpoint Falling
    {
        levels: [
            'beam_me_up_v3',
            'pat_on_the_back_v2',
        ],
        needs: [
            [{ level: 'endpoint_maze' }],
        ],
    },
    {
        levels: ['toggler00'],
        needs: [
            [{ level: 'crystal_rover_bridge' }],
        ],
    },
    {
        levels: ['two_half_togglers'],
        needs: [
            [{ level: 'toggler00' }],
        ],
    },
    {
        levels: ['purple_heart'],
    },
    // Endpoint Skipping
    {
        levels: ['ortho'],
        needs: [
            [{ level: 'lily_switch_p' }],
        ],
    },
    {
        levels: ['ortho2'],
        needs: [
            [{ level: 'ortho' }],
        ],
    },
    {
        levels: ['ortho3'],
        needs: [
            [{ level: 'ortho2' }],
        ],
    },
    {
        levels: ['skip_purple_drop_alt'],
        needs: [
            [{ level: 'breaking_bread' }],
        ],
    },
    {
        levels: ['endpoint_holder3'],
        needs: [
            [{ level: 'skip_purple_drop_alt' }],
        ],
    },
    {
        levels: [
            'endpoint_holder4',
            'mobile_cover_2',
        ],
        needs: [
            [{ level: 'endpoint_holder3' }],
        ],
    },
    {
        levels: ['hover_corner_3'],
        needs: [
            [{ level: 'mobile_cover_2' }],
        ],
    },
    {
        levels: ['hover_corner_4'],
        needs: [
            [{ level: 'hover_corner_3' }],
        ],
    },
    {
        levels: ['stone_rescue_v3'],
        needs: [
            [{ level: 'skip_purple_drop_alt' }],
        ],
    },
    {
        levels: ['wrap_music'],
        known: true,
        needs: [
            [{ level: 'stone_rescue_v3' }],
        ],
    },
    {
        levels: ['wrap_music_2'],
        known: true,
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: ['retvrn0'],
        needs: [
            [{ level: 'stone_rescue_v3' }],
        ],
    },
    {
        levels: ['tricky_endpoint'],
        needs: [
            [{ level: 'retvrn0' }],
        ],
    },
    {
        levels: [
            'drop_operation_v3',
            'juggalos',
        ],
    },
    {
        levels: ['defender'],
        needs: [
            [{ level: 'juggalos' }],
            [{ level: 'drop_operation_v3' }],
        ],
    },
    // Exit Low
    {
        // behind the red barrier in Antipode Low, which a laser from the hub opens once the six Low towers are done
        levels: ['allocate_heroes_end3'],
        needs: [
            [{ sign: 115348569 }],
            [{ sign: 115373188 }],
            [{ sign: 115348557 }],
            [{ sign: 115348577 }],
            [{ sign: 115373173 }],
            [{ sign: 115348542 }],
        ],
    },
    {
        levels: ['best_beam_colors'],
        needs: [
            [{ level: 'allocate_heroes_end3' }],
        ],
    },
    {
        levels: ['end3_promesst_red'],
        needs: [
            [{ level: 'best_beam_colors' }],
        ],
    },
    {
        levels: [
            'end3_heroes_1',
            'end3_mirror_1_v3',
        ],
        needs: [
            [{ level: 'allocate_heroes_end3' }],
        ],
    },
    {
        levels: ['end3_mirror_2_alt2'],
        needs: [
            [{ level: 'end3_mirror_1_v3' }],
        ],
    },
    {
        levels: ['end3_skipping_1'],
        needs: [
            [{ level: 'allocate_heroes_end3' }],
        ],
    },
    {
        levels: ['end3_skipping_red'],
        needs: [
            [{ level: 'end3_skipping_1' }],
        ],
    },
    {
        levels: ['design_corner'],
        needs: [
            [{ level: 'end3_skipping_red' }],
            [{ level: 'end3_mirror_2_alt2' }],
            [{ level: 'end3_heroes_1' }],
            [{ level: 'end3_promesst_red' }],
        ],
    },
    {
        levels: ['make_sokoban'],
        needs: [
            [{ level: 'design_corner' }],
        ],
    },
    {
        levels: ['make_shoreline'],
        needs: [
            [{ level: 'make_sokoban' }],
        ],
    },
    {
        levels: [
            'design_fts',
            'make_oneway',
            'make_thief_goblin_maze_v2',
        ],
        needs: [
            [{ level: 'make_shoreline' }],
        ],
    },
    {
        levels: ['river_exploit_v2'],
        needs: [
            [{ level: 'design_fts' }],
            [{ level: 'make_thief_goblin_maze_v2' }],
            [{ level: 'make_oneway' }],
        ],
    },
    {
        levels: ['fix_exploit'],
        needs: [
            [{ level: 'river_exploit_v2' }],
        ],
    },
    {
        levels: ['wizard_jailbreak_v2'],
        needs: [
            [{ level: 'fix_exploit' }],
        ],
    },
    {
        levels: ['fix_exploit_promesst_overworld'],
        needs: [
            [{ level: 'wizard_jailbreak_v2' }],
        ],
    },
    {
        levels: ['end2_clone_divergence'],
        needs: [
            [{ level: 'fix_exploit_promesst_overworld' }],
        ],
    },
    {
        levels: ['end2_clone_divergence_2'],
        needs: [
            [{ level: 'end2_clone_divergence' }],
        ],
    },
    {
        levels: ['simplify_wizard'],
        needs: [
            [{ level: 'end2_clone_divergence_2' }],
        ],
    },
    {
        levels: ['simplify_skipping'],
        needs: [
            [{ level: 'simplify_wizard' }],
        ],
    },
    {
        levels: ['end3_redundant_beams'],
        needs: [
            [{ level: 'simplify_skipping' }],
        ],
    },
    {
        levels: ['end3_denoise_pool'],
        needs: [
            [{ level: 'end3_redundant_beams' }],
        ],
    },
    {
        levels: ['end2_mirror1'],
        needs: [
            [{ level: 'end3_denoise_pool' }],
        ],
    },
    {
        levels: ['end2_mirror_4_islands_v2'],
        needs: [
            [{ level: 'end2_mirror1' }],
        ],
    },
    {
        levels: ['end3_off_topic_alt'],
        needs: [
            [{ level: 'end2_mirror_4_islands_v2' }],
        ],
    },
    {
        levels: ['end3_off_topic_mirror'],
        needs: [
            [{ level: 'end3_off_topic_alt' }],
        ],
    },
    {
        levels: ['end3_off_topic_heroes'],
        needs: [
            [{ level: 'end3_off_topic_mirror' }],
        ],
    },
    {
        levels: ['end3_reorder_skipping_fix'],
        needs: [
            [{ level: 'end3_off_topic_heroes' }],
        ],
    },
    {
        levels: ['end3_reorder_mirror'],
        needs: [
            [{ level: 'end3_reorder_skipping_fix' }],
        ],
    },
    {
        levels: ['environment_art_grid'],
        needs: [
            [{ level: 'end3_reorder_mirror' }],
        ],
    },
    {
        levels: ['environment_art_background'],
        needs: [
            [{ level: 'environment_art_grid' }],
        ],
    },
    {
        levels: ['environment_art_objects'],
        needs: [
            [{ level: 'environment_art_background' }],
        ],
    },
    {
        levels: ['end3_pipeline_setup'],
        needs: [
            [{ level: 'environment_art_objects' }],
        ],
    },
    {
        levels: ['end3_pipeline_design'],
        needs: [
            [{ level: 'end3_pipeline_setup' }],
        ],
    },
    {
        levels: ['end3_pipeline_cleanup'],
        needs: [
            [{ level: 'end3_pipeline_design' }],
        ],
    },
    {
        levels: ['end3_pipeline_cut'],
        needs: [
            [{ level: 'end3_pipeline_cleanup' }],
        ],
    },
    {
        levels: ['end3_pipeline_reorder'],
        needs: [
            [{ level: 'end3_pipeline_cut' }],
        ],
    },
    {
        levels: ['end3_pipeline_aesthetics'],
        needs: [
            [{ level: 'end3_pipeline_reorder' }],
        ],
    },
    {
        levels: ['rotating_cavalry_spaced'],
        needs: [
            [{ level: 'goblin_two_rovers_alt' }],
        ],
    },
    // Mirrors and Artifacts
    {
        // from the pad above the orange light room the hero works the Rock Spawner rocks into the pits and the resets, turns the light with the Torc from the Wardrobe there (not walked) and walks row 77 on to the level; torus_mirrors stands for the walk reaching that pad
        levels: ['simultaneous_x'],
        needs: [
            [{ level: 'torus_mirrors' }],
        ],
    },
    {
        // the walk of row 77 past the orange light, as for simultaneous_x
        levels: ['simultaneous_x_surprise'],
        needs: [
            [{ level: 'torus_mirrors' }],
            [{ level: 'simultaneous_x' }],
        ],
    },
    {
        levels: ['three_artifacts_v3'],
        needs: [
            [{ level: 'simultaneous_x_surprise' }],
        ],
    },
    {
        levels: ['army_v5'],
        needs: [
            [{ level: 'torus_mirrors' }],
        ],
    },
    {
        levels: ['fail_to_mirror_sequence_v2'],
    },
    {
        levels: ['mega_clone_v2'],
        needs: [
            [{ level: 'torus_mirrors' }],
        ],
    },
    {
        levels: ['mega_merge_v5'],
        needs: [
            [{ level: 'mega_clone_v2' }],
        ],
    },
    {
        levels: ['pigeonhole_squished'],
        needs: [
            [{ level: 'chain_gang' }],
            [{ level: 'stasis_v2' }],
        ],
    },
    {
        // by standing in a dragon fire that Mirrors carried by monsters reflect: the monsters turn toward the hero and turn their Mirrors with them
        levels: ['far_cl_no_walls_pit'],
        needs: [
            [{ level: 'pigeonhole_squished' }],
        ],
    },
    {
        // the same fire and Mirrors as far_cl_no_walls_pit
        levels: ['goblin_hat_v2'],
        needs: [
            [{ level: 'pigeonhole_squished' }],
        ],
    },
    // Mirrors and Rivers
    {
        levels: ['in_a_flash_alt_back'],
    },
    {
        levels: ['raft_corners_alt_3'],
        needs: [
            [{ level: 'zach_lilies_v3' }],
        ],
    },
    {
        // past raft_corners_alt_3, a Rock and a skipping stone pushed into the water let the hero cross on a Lily, a stone on another Lily shielding it from the Dragon's fire, to the room of raft_corners_2_small and raft_corners_4x4
        levels: ['raft_corners_2_small'],
        needs: [
            [{ level: 'raft_corners_alt_3' }],
        ],
    },
    {
        levels: ['mirror_180'],
        needs: [
            [{ level: 'raft_corners_2_small' }],
        ],
    },
    {
        levels: ['raft_corners_4x4'],
        needs: [
            [{ level: 'raft_corners_2_small' }],
        ],
    },
    {
        levels: ['mirror_u'],
        needs: [
            [{ level: 'raft_corners_4x4' }],
        ],
    },
    {
        levels: ['mirror_flip_donut'],
        needs: [
            [{ level: 'mirror_u' }],
        ],
    },
    {
        levels: ['in_a_flash_alt'],
        needs: [
            [{ level: 'mirror_flip_donut' }],
        ],
    },
    {
        levels: ['river_maze_clear_tenacious_race_v2'],
    },
    {
        levels: ['reroute_3'],
        needs: [
            [{ level: 'mirror_180' }],
        ],
    },
    {
        levels: ['river_rates_button'],
        needs: [
            [{ level: 'river_maze_clear_tenacious_race_v2' }],
        ],
    },
    {
        levels: [
            'river_rates_jagged',
            'water_bender_v3',
        ],
    },
    // Mirrors as Obstacles
    {
        // the four Rocks on the shallow strip are pushed into the water one after another at x 106, y 72 to 75, bridging from the strip to the level
        levels: ['crystal_island'],
        needs: [
            [{ level: 'push_down_chain' }],
        ],
    },
    {
        levels: ['bottleneck'],
        needs: [
            [{ level: 'crystal_island' }],
        ],
    },
    {
        levels: ['hanoi_3'],
        known: true,
        needs: [
            [{ level: 'bottleneck' }],
        ],
    },
    {
        levels: ['busy_beaver'],
        needs: [
            [{ level: 'hanoi_3' }],
        ],
    },
    {
        levels: ['moving_through_mirrors_v3'],
        needs: [
            [{ level: 'busy_beaver' }],
        ],
    },
    // Moving the Flat Things
    {
        // the ride of the Lily on the wrapping river, as for far_wings
        levels: ['swapwiz_harder'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: ['infinite_looping_skipper0_alt'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: ['infinite_looping_skipper_alt'],
        needs: [
            [{ level: 'infinite_looping_skipper0_alt' }],
        ],
    },
    {
        levels: ['infinite_looping_skipper_far'],
        needs: [
            [{ level: 'infinite_looping_skipper_alt' }],
        ],
    },
    {
        // the ride of the Lily on the wrapping river, as for far_wings
        levels: ['infinite_looping_skipper_mirrored_ikaruga_alt'],
        needs: [
            [{ level: 'wrap_music' }],
            [{ level: 'infinite_looping_skipper_far' }],
        ],
    },
    {
        levels: ['movable_button'],
        needs: [
            [{ level: 'raft_corners_2_small' }],
        ],
    },
    {
        levels: ['movable_buttons'],
        needs: [
            [{ level: 'movable_button' }],
        ],
    },
    {
        levels: ['gem_slot_on_lily'],
        needs: [
            [{ level: 'movable_buttons' }],
        ],
    },
    {
        levels: ['lily_switch_p'],
        needs: [
            [{ level: 'gem_slot_on_lily' }],
        ],
    },
    {
        levels: ['sombreros'],
        known: true,
        needs: [
            [{ level: 'lily_switch_p' }],
        ],
    },
    {
        levels: ['skybridge'],
        needs: [
            [{ level: 'ortho' }],
        ],
    },
    {
        // enabled in the level data, so open without the level that unlocks it
        levels: ['zap_bridge'],
        needs: [
            [{ level: 'lily_switch_p' }],
        ],
    },
    {
        levels: ['zap_bridge_perp'],
        needs: [
            [{ level: 'zap_bridge' }],
        ],
    },
    {
        levels: ['frontier'],
        needs: [
            [{ level: 'zap_bridge_perp' }],
        ],
    },
    // Partial Resets
    {
        // the ride of the Lily on the wrapping river; the first level of the area
        levels: ['easy_reset_small'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: [
            'chain_reaction',
            'falling_button',
        ],
        needs: [
            [{ level: 'easy_reset_small' }],
        ],
    },
    {
        levels: ['reset_mirror'],
        needs: [
            [{ level: 'easy_reset_small' }],
        ],
    },
    {
        levels: ['wrong_reset'],
        needs: [
            [{ level: 'reset_mirror' }],
        ],
    },
    {
        levels: ['treadmill'],
        needs: [
            [{ level: 'easy_reset_small' }],
        ],
    },
    {
        levels: ['recycling'],
        needs: [
            [{ level: 'treadmill' }],
        ],
    },
    {
        levels: ['fall_reset_v2'],
        needs: [
            [{ level: 'treadmill' }],
        ],
    },
    {
        levels: ['reset_trio'],
        needs: [
            [{ level: 'treadmill' }],
        ],
    },
    {
        levels: ['monster_spawn'],
        needs: [
            [{ level: 'treadmill' }],
        ],
    },
    // Endless Skipping
    {
        levels: ['before_wings'],
        needs: [
            [{ level: 'new_new_new_slam' }],
        ],
    },
    {
        // the Rock the Freezer wrap_music opens is pushed onto the Activator that respawns the Lily beside the wrapping river; the hero pushes the Lily into the river and rides it
        levels: ['far_wings'],
        needs: [
            [{ level: 'before_wings' }],
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: ['after_wings'],
        needs: [
            [{ level: 'far_wings' }],
        ],
    },
    {
        levels: ['layered_alt'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        // the ride of the Lily on the wrapping river, as for far_wings
        levels: ['sick_270_small'],
        needs: [
            [{ level: 'wrap_music' }],
            [{ level: 'layered_alt' }],
        ],
    },
    {
        levels: ['yars_revenge_setup_v3'],
        needs: [
            [{ level: 'sick_270_small' }],
        ],
    },
    // Beam Computation
    {
        levels: ['zachtronics_identity'],
        needs: [
            [{ level: 'endpoint_maze' }],
        ],
    },
    {
        levels: ['zachtronics_or'],
        known: true,
        needs: [
            [{ level: 'zachtronics_identity' }],
        ],
    },
    {
        levels: ['zachtronics_xor'],
        needs: [
            [{ level: 'zachtronics_or' }],
        ],
    },
    {
        levels: ['zachtronics'],
        needs: [
            [{ level: 'zachtronics_xor' }],
        ],
    },
    // Torc
    {
        levels: [
            'cyan_overlap_intro_longer',
            'green_revolution',
            'torcoban_2',
        ],
        needs: [
            [{ level: 'promesst2_streamlined' }],
        ],
    },
    {
        levels: ['blue_revolution_v2'],
        needs: [
            [{ level: 'torcoban_2' }],
        ],
    },
    {
        levels: ['double_trouble'],
        known: true,
        needs: [
            [{ level: 'first_flight' }],
        ],
    },
    {
        levels: ['worlds_collide_ps'],
        needs: [
            [{ level: 'torcoban_2' }],
            [{ level: 'skipping_pals' }],
        ],
    },
    // Heroes 3: Bard, Druid
    {
        levels: ['heroes3_10'],
        needs: [
            [{ level: 'heroes2_22_v2' }],
        ],
    },
    {
        levels: ['heroes3_11_v2'],
        needs: [
            [{ level: 'heroes3_10' }],
        ],
    },
    {
        levels: ['druid_and_dragon'],
        needs: [
            [{ level: 'heroes3_11_v2' }],
        ],
    },
    {
        levels: ['wizard_and_druid_alt_5'],
        needs: [
            [{ level: 'druid_and_dragon' }],
        ],
    },
    {
        levels: ['heroes3_15_v4'],
        needs: [
            [{ level: 'wizard_and_druid_alt_5' }],
        ],
    },
    {
        levels: ['heroes3_13_v2'],
        needs: [
            [{ level: 'heroes3_15_v4' }],
        ],
    },
    {
        levels: ['heroes3_druid_b_v2'],
        needs: [
            [{ level: 'heroes3_13_v2' }],
        ],
    },
    {
        levels: ['heroes3_druid_a'],
        needs: [
            [{ level: 'heroes3_druid_b_v2' }],
        ],
    },
    {
        levels: ['wizard_and_druid_alt'],
        needs: [
            [{ level: 'wizard_and_druid_alt_5' }],
        ],
    },
    {
        levels: ['heroes3_1_v3'],
        needs: [
            [{ level: 'heroes2_22_v2' }],
        ],
    },
    {
        levels: ['heroes3_2_v4'],
        needs: [
            [{ level: 'heroes3_1_v3' }],
        ],
    },
    {
        levels: ['heroes3_3_v2'],
        needs: [
            [{ level: 'heroes3_2_v4' }],
        ],
    },
    {
        levels: [
            'heroes3_4',
            'heroes3_5',
        ],
        needs: [
            [{ level: 'heroes3_3_v2' }],
        ],
    },
    {
        levels: ['heroes3_8_thief'],
        needs: [
            [{ level: 'heroes3_5' }],
        ],
    },
    {
        levels: ['heroes3_6_v3'],
        needs: [
            [{ level: 'heroes3_8_thief' }],
        ],
    },
    {
        levels: ['heroes3_7_v4'],
        needs: [
            [{ level: 'heroes3_6_v3' }],
        ],
    },
    {
        levels: ['heroes3_8_v4_alt'],
        needs: [
            [{ level: 'heroes3_7_v4' }],
        ],
    },
    {
        levels: ['heroes3_8_v3_alt3'],
        needs: [
            [{ level: 'heroes3_8_v4_alt' }],
        ],
    },
    {
        levels: ['heroes3_14_v3'],
        needs: [
            [{ level: 'heroes3_druid_b_v2' }],
            [{ level: 'heroes3_7_v4' }],
        ],
    },
    {
        levels: ['compactor_v2'],
        needs: [
            [{ level: 'heroes3_14_v3' }],
        ],
    },
    {
        levels: [
            'gatekeeping_v3',
            'heroes3_21_condensed',
        ],
        needs: [
            [{ level: 'compactor_v2' }],
        ],
    },
    {
        levels: ['heroes3_16_v4_alt'],
        needs: [
            [{ level: 'heroes3_14_v3' }],
        ],
    },
    // Heroes Together
    {
        levels: ['worlds_collide_heroes_and_stones'],
        needs: [
            [{ level: 'skipping_shores_v3' }],
        ],
    },
    // Cart, Rod
    {
        levels: ['pushy'],
        needs: [
            [{ level: 'promesst2_streamlined' }],
        ],
    },
    {
        levels: ['worlds_collide_heroes_and_promesst_v4'],
        needs: [
            [{ level: 'dragon_on_the_wall' }],
            [{ level: 'multipush_for_me2' }],
            [{ level: 'side_kick' }],
        ],
    },
    {
        levels: ['gem_pushers'],
        needs: [
            [{ level: 'worlds_collide_heroes_and_promesst_v4' }],
        ],
    },
    {
        levels: ['forbidden_room'],
        needs: [
            [{ level: 'pushy' }],
        ],
    },
    {
        levels: ['right_hand_man'],
        needs: [
            [{ level: 'pushy' }],
        ],
    },
    {
        levels: ['target_practice_gem'],
        needs: [
            [{ level: 'right_hand_man' }],
            [{ level: 'forbidden_room' }],
        ],
    },
    {
        levels: ['beam_rooms'],
        needs: [
            [{ level: 'right_hand_man' }],
            [{ level: 'forbidden_room' }],
        ],
    },
    // Archways
    {
        levels: ['archways_2_v2'],
        needs: [
            [{ level: 'tippy_intro' }],
        ],
    },
    {
        levels: ['cliff_duo'],
        needs: [
            [{ level: 'archways_2_v2' }],
        ],
    },
    {
        levels: ['archways_4'],
        needs: [
            [{ level: 'archways_2_v2' }],
        ],
    },
    {
        levels: ['hat_chain_vp'],
        needs: [
            [{ level: 'archways_4' }],
        ],
    },
    // The Heroic Way
    {
        levels: ['laser_pointer'],
        needs: [
            [{ level: 'stack_prelude_pushstyle' }],
        ],
    },
    {
        levels: ['all_together_now'],
        needs: [
            [{ level: 'end2_monster_connect' }],
            [{ level: 'end2_prism_hp' }],
            [{ level: 'floor_plan_v3' }],
            [{ level: 'laser_pointer' }],
            [{ level: 'sidestone_zach_2_end2' }],
            [{ level: 'stone_economy' }],
        ],
    },
    // Beams, Mirrorably
    {
        levels: ['floating_orange_purple'],
        needs: [
            [{ level: 'double_sideways' }],
        ],
    },
    {
        levels: [
            'green_metamirror',
            'orange_floaty_reflect_v3',
        ],
    },
    {
        levels: ['meta_orange_purple'],
        needs: [
            [{ level: 'orange_floaty_reflect_v3' }],
        ],
    },
    {
        levels: ['meta_orange_purple_2'],
        needs: [
            [{ level: 'meta_orange_purple' }],
        ],
    },
    {
        levels: ['the_spiral'],
    },
    {
        levels: ['top_green_purple_v3'],
        needs: [
            [{ level: 'break_through_focused' }],
        ],
    },
    {
        levels: ['fun_house'],
        needs: [
            [{ level: 'top_green_purple_v3' }],
        ],
    },
    {
        levels: ['cyan_torc_maze_vs'],
        needs: [
            [{ level: 'fun_house' }],
        ],
    },
    {
        levels: ['cyan_counter_med3'],
        needs: [
            [{ level: 'cyan_torc_maze_vs' }],
        ],
    },
    // Squeeze, Dragon
    {
        levels: [
            'endpoint1_skipping',
            'narrow_passage',
        ],
    },
    {
        levels: ['close_circuit'],
        needs: [
            [{ level: 'narrow_passage' }],
        ],
    },
    {
        levels: [
            'dragon_drag',
            'free_ride',
        ],
        needs: [
            [{ level: 'close_circuit' }],
        ],
    },
    {
        levels: ['swap_seats'],
        needs: [
            [{ level: 'free_ride' }],
        ],
    },
    {
        levels: ['security_checkpoints_v2'],
        needs: [
            [
                { level: 'close_circuit' },
                { level: 'first_flight' },
                { level: 'purple_beam_intro_v2_alt' },
                { level: 'promesst3_streamlined' },
            ],
        ],
    },
    {
        levels: ['ocean_blue'],
        needs: [
            [{ level: 'security_checkpoints_v2' }],
        ],
    },
    {
        levels: ['double_door'],
        needs: [
            [{ level: 'narrow_passage' }],
        ],
    },
    {
        levels: ['rsmash'],
        needs: [
            [{ level: 'promesst3_streamlined' }],
        ],
    },
    // Mirrors and Buttons
    {
        levels: ['going_up_v4'],
        needs: [
            [{ level: 'archways_2_v2' }],
        ],
    },
    {
        levels: ['automatic_door_v5'],
        needs: [
            [{ level: 'archways_2_v2' }],
        ],
    },
    {
        levels: ['vertical_unclone_3'],
        needs: [
            [{ level: 'chasm_3' }],
        ],
    },
    // Spinning Beams
    {
        levels: ['turn_control_v2'],
        needs: [
            [{ level: 'pool_pal_v2' }],
            [{ level: 'tiger_lily_v2' }],
        ],
    },
    {
        levels: ['spin_heroes'],
        needs: [
            [{ level: 'turn_control_v2' }],
        ],
    },
    {
        levels: ['spray_and_pray'],
        needs: [
            [{ level: 'spin_heroes' }],
        ],
    },
    {
        levels: ['rotator'],
        needs: [
            [{ level: 'spray_and_pray' }],
        ],
    },
    {
        levels: ['spin_doctors_v3'],
        needs: [
            [{ level: 'rotator' }],
        ],
    },
    // Crossroads High
    {
        // the first levels on arrival: the ruby lift is built from the Freezers of rank 1
        levels: ['3d_intro_vanilla'],
        needs: [
            [{ level: 'end1' }],
        ],
    },
    {
        // the first levels on arrival: the ruby lift is built from the Freezers of rank 1
        levels: ['push_down_v2'],
        needs: [
            [{ level: '3d_intro_vanilla' }],
        ],
    },
    {
        // the first levels on arrival: the ruby lift is built from the Freezers of rank 1
        levels: ['sister_staircase_harder'],
        needs: [
            [{ level: 'push_down_v2' }],
        ],
    },
    {
        // the first levels on arrival: the ruby lift is built from the Freezers of rank 1
        levels: ['carry_simplified'],
        needs: [
            [{ level: 'sister_staircase_harder' }],
        ],
    },
    {
        levels: [
            '3d_intro_heroes',
            '3d_intro_mirrors',
            '3d_intro_promesst_v5',
            '3d_intro_skipping',
        ],
        needs: [
            [{ level: 'carry_simplified' }],
        ],
    },
    // Mirror on Head
    {
        // the vertical Mirror repel frees, at the bottom of the slot in the tower base, lifts the hero from the corridor onto the ledge where hat_tricks_0_v3 stands
        levels: ['hat_tricks_0_v3'],
        needs: [
            [{ level: 'repel' }],
        ],
    },
    {
        levels: ['omnimirror_v2'],
        needs: [
            [{ level: 'hat_tricks_0_v3' }],
        ],
    },
    {
        levels: ['goblin_parity_3d'],
        needs: [
            [{ level: 'omnimirror_v2' }],
        ],
    },
    {
        levels: ['mirror_carry_duo'],
        needs: [
            [{ level: 'goblin_parity_3d' }],
        ],
    },
    {
        levels: ['bothersome_mirror'],
        needs: [
            [{ level: 'all_out_goblin_war' }],
        ],
    },
    // Strength
    {
        levels: ['buff_explorer'],
        needs: [
            [{ level: 'sokobridge_v4' }],
        ],
    },
    {
        levels: [
            'cyan_bridge_v3',
            'strong_monsters_v2',
        ],
        known: true,
        needs: [
            [{ level: 'buff_explorer' }],
        ],
    },
    {
        levels: ['floorhands_v5'],
        needs: [
            [{ level: 'buff_explorer' }],
        ],
    },
    {
        levels: ['stay_lit'],
        needs: [
            [{ level: 'floorhands_v5' }],
        ],
    },
    {
        levels: ['under_pressure'],
        known: true,
        needs: [
            [{ level: 'buff_explorer' }],
        ],
    },
    {
        levels: ['high_horse'],
        needs: [
            [{ level: 'assassins_creed' }],
        ],
    },
    // Vertical Mirror Skipping
    {
        levels: ['lily_pull_intro'],
        needs: [
            [{ level: 'on_the_rocks' }],
        ],
    },
    {
        levels: ['falling_down'],
        needs: [
            [{ level: 'on_the_rocks' }],
        ],
    },
    {
        levels: ['lily_pull'],
        needs: [
            [{ level: 'falling_down' }],
            [{ level: 'lily_pull_intro' }],
        ],
    },
    {
        levels: [
            'retro',
            'retro_hooks',
        ],
        needs: [
            [{ level: 'lily_pull' }],
        ],
    },
    // Mirror Falling
    {
        levels: ['trader_descend'],
        needs: [
            [{ level: '3d_intro_mirrors' }],
        ],
    },
    {
        levels: ['cliff_hopping'],
        needs: [
            [{ level: 'trader_descend' }],
        ],
    },
    {
        levels: ['make_a_right_simpler'],
        needs: [
            [{ level: '3d_intro_mirrors' }],
        ],
    },
    {
        levels: ['make_a_right'],
        needs: [
            [{ level: 'make_a_right_simpler' }],
        ],
    },
    {
        levels: ['learn_to_catch_v2'],
        needs: [
            [{ level: 'make_a_right_simpler' }],
        ],
    },
    {
        levels: ['trust_falls'],
        needs: [
            [{ level: 'learn_to_catch_v2' }],
        ],
    },
    {
        levels: ['falling_blocker_v3'],
        needs: [
            [{ level: 'trust_falls' }],
        ],
    },
    {
        levels: ['pillars'],
        needs: [
            [{ level: 'falling_blocker_v3' }],
        ],
    },
    {
        levels: ['long_platform_v2'],
        needs: [
            [{ level: 'pillars' }],
        ],
    },
    {
        levels: ['blind_spot_v2'],
        needs: [
            [{ level: 'long_platform_v2' }],
        ],
    },
    {
        // the Mirror pushed east off the z 34 ledge falls and teleports the Rock into the gap north of the plateau, the way to the level
        levels: ['triple_gate'],
        needs: [
            [{ level: 'cliff_hopping' }],
            [{ level: 'blind_spot_v2' }],
        ],
    },
    // Crossroads Low
    {
        // the elevator carries the hero down to the level once all three Rocks of its stack are smashed: Rubble smashed in both the SMASH and the ALTER beam smashes every Rock of its kind in the room; on the way the red Gem is moved across the sky through the Freezers of taking_the_lift, drop_sokoban, bridgey3_abstract_art, overwrite and the Strength levels
        levels: ['push_down_chain'],
        needs: [
            [{ level: 'promesst2.5_deeper' }],
            [{ level: 'drop_sokoban' }],
            [{ level: 'under_pressure' }],
            [{ level: 'strong_monsters_v2' }],
            [{ level: 'stay_lit' }],
            [{ level: 'bridgey3_abstract_art' }],
            [{ level: 'overwrite' }],
        ],
    },
    {
        levels: ['zach_lilies_v3'],
        needs: [
            [{ level: 'push_down_chain' }],
        ],
    },
    // Alter-Smash
    {
        levels: ['nowhere_to_smash_combo'],
        needs: [
            [{ level: 'push_down_chain' }],
        ],
    },
    {
        // the levels of the tower come down one after another: each frees what lets the next one drop to the floor
        levels: ['get_through_alt'],
        needs: [
            [{ level: 'nowhere_to_smash_combo' }],
        ],
    },
    {
        levels: ['get_through_depths'],
        needs: [
            [{ level: 'get_through_alt' }],
        ],
    },
    {
        levels: ['save_for_later'],
        needs: [
            [{ level: 'get_through_depths' }],
        ],
    },
    {
        levels: ['rubble_chain'],
        needs: [
            [{ level: 'save_for_later' }],
        ],
    },
    {
        levels: ['do_not_want'],
        needs: [
            [{ level: 'rubble_chain' }],
        ],
    },
    {
        // on the floor of the open room south of the tower, a fall from the walkway
        levels: ['smartbomb_combo_v3'],
        needs: [
            [{ level: 'do_not_want' }],
        ],
    },
    {
        levels: ['wand_reintro'],
        needs: [
            [{ level: 'push_down_chain' }],
        ],
    },
    // Lily Beam Rotation
    {
        // on foot from the hub elevator through the cages of get_through_alt and breaking_bread
        levels: ['river_rotate_beams_gr'],
        needs: [
            [{ level: 'breaking_bread' }],
        ],
    },
    {
        levels: ['lily_two_cyan'],
        needs: [
            [{ level: 'river_rotate_beams_gr' }],
        ],
    },
    {
        levels: ['kick'],
        needs: [
            [{ level: 'push_down_chain' }],
        ],
    },
    // Gems as Obstacles
    {
        levels: ['gem_trap'],
        needs: [
            [{ level: 'get_through_alt' }],
        ],
    },
    {
        levels: ['gem_trap2'],
        needs: [
            [{ level: 'gem_trap' }],
        ],
    },
    {
        // on foot from the hub elevator through the cages of gem_trap2 and get_through_alt
        levels: ['negative_space'],
        needs: [
            [{ level: 'gem_trap2' }],
        ],
    },
    {
        levels: ['numberlink_alt'],
        needs: [
            [{ level: 'gem_trap2' }],
        ],
    },
    // Monsters, Through
    {
        levels: ['torus_goblins'],
        needs: [
            [{ level: 'push_down_chain' }],
        ],
    },
    {
        levels: ['no_murder_weapon_wizard'],
        needs: [
            [{ level: 'push_down_chain' }],
        ],
    },
    {
        levels: ['no_murder_weapon_0'],
        needs: [
            [{ level: 'no_murder_weapon_wizard' }],
        ],
    },
    {
        levels: ['dragonsweeper'],
        needs: [
            [{ level: 'no_murder_weapon_wizard' }],
        ],
    },
    {
        // the Freezers of both levels open the way through the room to the corridor north of it, and the hero steps down from the corridor into the level
        levels: ['green_goblins'],
        needs: [
            [{ level: 'dragonsweeper' }],
        ],
    },
    {
        levels: ['en_root_alt'],
        needs: [
            [{ level: 'green_goblins' }],
        ],
    },
    // Gem Beams
    {
        levels: ['orange_gem_instant'],
        needs: [
            [{ level: 'push_down_chain' }],
        ],
    },
    {
        levels: ['boot_cycle_warrior'],
        needs: [
            [{ level: 'orange_gem_instant' }],
        ],
    },
    // Wrapping Wizard
    {
        levels: ['torus_bard'],
        needs: [
            [{ level: 'torus_goblins' }],
        ],
    },
    {
        // through the doorway push_down_chain opens, then the Freezers torus_goblins and torus_bard open
        levels: ['torus_blocks_alt_v4'],
        needs: [
            [{ level: 'torus_bard' }],
        ],
    },
    {
        levels: ['grid_hopping0'],
        needs: [
            [{ level: 'torus_blocks_alt_v4' }],
        ],
    },
    {
        levels: ['wasteland'],
        needs: [
            [{ level: 'torus_goblins' }],
        ],
    },
    // Gate Opening
    {
        // past en_root_alt, the way on reaches the room of thief_dragger_v2, open_monster and monster_promesst_v3
        levels: ['thief_dragger_v2'],
        needs: [
            [{ level: 'en_root_alt' }],
        ],
    },
    {
        levels: ['monster_promesst_v3'],
        needs: [
            [
                { level: 'thief_dragger_v2' },
                { level: 'open_monster' },
            ],
            [{ level: 'metamirror_same_dir_3_alt_2' }],
        ],
    },
    {
        levels: ['button_and_beam_v3'],
        needs: [
            [{ level: 'metamirror_same_dir_3_alt_2' }],
        ],
    },
    {
        levels: ['battle_royale_v2'],
        needs: [
            [{ level: 'ice_climbers' }],
        ],
    },
    {
        levels: ['open_monster'],
        needs: [
            [{ level: 'button_and_beam_v3' }],
        ],
    },
];

export interface PadRouteRow {
    id: string;
    to: number;
    needs: Need[][];
    // the Way area (by local area name) that leads to the hub quarter of the sky tower whose hub pad is `to`
    area?: string;
    // the flag name of that sky tower
    tower?: string;
}

// Routes to a pad or an overworld position, with what each asks for. An empty group is a need that is not known:
// nothing meets it.
export const PAD_ROUTES: PadRouteRow[] = [
    {
        id: 'heroes_way',
        to: 106958293,
        needs: [
            [{ level: 'catching_fire_v2' }],
        ],
        area: 'area_s_heroes_way',
        tower: 'HEROES',
    },
    {
        id: 'mirror_way',
        to: 106958295,
        needs: [
            [{ level: 'priest_3d_intro_dragon_v4' }],
            [{ level: 'pachinko' }],
            [{ level: 'pachinko_rescue_w' }],
        ],
        area: 'area_s_mirror_way',
        tower: 'MIRRORS',
    },
    {
        // what the route asks for is not known
        id: 'skipping_way',
        to: 106958297,
        needs: [
            [],
        ],
        area: 'area_s_skipping_way',
        tower: 'SKIPPING',
    },
    {
        id: 'beam_way',
        to: 106958291,
        needs: [
            [{ level: 'high_endpoint_v2' }],
            [{ level: 'beam_jail_v3' }, { level: 'thin_ice_rooms' }],
        ],
        area: 'area_s_beam_way',
        tower: 'PROMESST',
    },
    {
        // the pad in the cage cliff_hopping opens carries the hero up to the z 37 ledge of Mirror Falling
        id: 'mirror_falling_cage_pad',
        to: 115497407,
        needs: [
            [{ level: 'cliff_hopping' }],
        ],
    },
    {
        // from the platform where repel stands the Mirrors lift the hero to the z 48 plateau east of the tower, its pad carries him to the west quarter of the sky hub, and the hub pad there lands him on the strip beside the Mirror Way
        id: 'mirror_way_strip_pad',
        to: 111249623,
        needs: [
            [{ level: 'repel' }],
        ],
    },
];
