export type Need = { level: string } | { freezer: number } | { sign: number } | { rock: number };

export interface LevelRow {
    levels: string[];
    /** The levels that unlock playing these levels, from the game data. */
    requires?: string[];
    needs: Need[][] | 'unknown';
    from?: 'sky';
    /** The hole the hero drops through. */
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
        // the column of three Rocks west of the level is smashed by the SMASH beam and then the multi beam, which snipperclips_diagonal frees, and the hero walks down the column to the level
        levels: ['druid_multismash_v3'],
        needs: [
            [{ rock: 111225816 }],
            [{ rock: 111225812 }],
            [{ rock: 111225814 }],
        ],
    },
    {
        // the three Rocks in the corridor west of the level are smashed by the SMASH beam and then the multi beam, and the hero walks through to the level
        levels: ['red_yellow_alter_with_intro_v2'],
        needs: [
            [{ rock: 111225459 }],
            [{ rock: 111225465 }],
            [{ rock: 111225467 }],
        ],
    },
    {
        levels: ['snipperclips_0_square'],
        needs: [
            [{ freezer: 90180832 }],
        ],
    },
    {
        levels: ['snipperclips_square'],
        requires: ['snipperclips_0_square'],
        needs: [
            [{ freezer: 90180988 }],
        ],
    },
    {
        levels: ['snipperclips_diagonal'],
        requires: ['snipperclips_square'],
        needs: [
            [{ freezer: 90180988 }],
        ],
    },
    {
        levels: [
            'accidentally_unlock_v2',
            'boxes_vs_crystals',
        ],
        needs: 'unknown',
    },
    {
        levels: ['pushing_crystal_near_orange_v2'],
        requires: ['boxes_vs_crystals'],
        needs: 'unknown',
    },
    {
        levels: ['safety_gloves'],
        requires: ['pushing_crystal_near_orange_v2'],
        needs: 'unknown',
    },
    {
        levels: [
            'corner_loop',
            'double_team',
        ],
        needs: 'unknown',
    },
    {
        levels: ['orange_beam_deal'],
        needs: [
            [{ level: 'double_team' }],
        ],
    },
    {
        levels: [
            'dragon_on_the_wall',
            'jump_the_fence_v2',
        ],
        needs: 'unknown',
    },
    {
        levels: ['pushing_orange'],
        requires: ['jump_the_fence_v2'],
        needs: 'unknown',
    },
    {
        levels: ['beam_shatter'],
        requires: ['pushing_orange'],
        needs: [
            [{ level: 'jump_the_fence_v2' }],
        ],
    },
    {
        levels: ['pushing_near_orange'],
        needs: [
            [{ level: 'jump_the_fence_v2' }],
        ],
    },
    {
        levels: ['pulling_near_orange_v2'],
        requires: ['pushing_near_orange'],
        needs: [
            [{ level: 'jump_the_fence_v2' }],
        ],
    },
    {
        levels: ['bypass_gates'],
        requires: ['corner_loop'],
        needs: [
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
        levels: [
            'lock_picky',
            'multipush_for_me2',
            'oneway_beam',
            'pull_together',
        ],
        needs: 'unknown',
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
            [{ level: 'jump_the_fence_v2' }],
            [{ level: 'purple_haze' }],
        ],
    },
    {
        levels: ['torc_blocked'],
        requires: ['torc_blocked_easier'],
        needs: [
            [{ level: 'jump_the_fence_v2' }],
            [{ level: 'purple_haze' }],
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
        requires: ['simple_trap'],
        needs: [
            [{ level: 'pull_together' }],
        ],
    },
    {
        levels: ['pushback'],
        requires: ['untrap'],
        needs: [
            [{ level: 'pull_together' }],
        ],
    },
    {
        levels: [
            'purple_push_pal',
            'red_handed',
            'side_kick',
            'slide_rows',
            'smash_grid_kill',
        ],
        needs: 'unknown',
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
        needs: 'unknown',
    },
    {
        levels: ['wall_sneak'],
        requires: ['thief_through'],
        needs: 'unknown',
    },
    {
        levels: ['through_intro'],
        needs: 'unknown',
    },
    {
        levels: ['through_push'],
        requires: ['through_intro'],
        needs: 'unknown',
    },
    {
        levels: ['binary_maze'],
        requires: ['through_push'],
        needs: 'unknown',
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
        requires: ['heroes1_1'],
        needs: [],
    },
    {
        levels: ['heroes1_3'],
        requires: ['heroes1_2_v2'],
        needs: [],
    },
    {
        levels: ['heroes1_4'],
        requires: ['heroes1_3'],
        needs: [],
    },
    {
        levels: ['heroes1_4.5'],
        requires: ['heroes1_4'],
        needs: [],
    },
    {
        levels: ['heroes1_5_v2'],
        requires: ['heroes1_4.5'],
        needs: [],
    },
    {
        levels: ['heroes1_7_v2'],
        requires: ['heroes1_5_v2'],
        needs: [],
    },
    {
        levels: ['heroes1_6'],
        requires: ['heroes1_7_v2'],
        needs: [],
    },
    {
        levels: ['heroes1_7.5'],
        requires: ['heroes1_4.5'],
        needs: [],
    },
    {
        levels: ['heroes1_8_v2'],
        requires: ['heroes1_7.5'],
        needs: [],
    },
    {
        levels: ['heroes1_10_inv_v4_b'],
        requires: ['heroes1_8_v2'],
        needs: [],
    },
    {
        levels: ['heroes1_9'],
        requires: ['heroes1_10_inv_v4_b'],
        needs: [],
    },
    {
        levels: ['heroes1_11_v2'],
        // south of the two Freezers in the corridor below heroes1_4
        needs: [
            [{ level: 'heroes1_10_inv_v4_b' }],
            [{ freezer: 111254912 }],
            [{ freezer: 111254914 }],
        ],
    },
    {
        levels: ['heroes1_13_v2'],
        requires: ['heroes1_11_v2'],
        // south of the two Freezers in the corridor below heroes1_4
        needs: [
            [{ level: 'heroes1_10_inv_v4_b' }],
            [{ freezer: 111254912 }],
            [{ freezer: 111254914 }],
        ],
    },
    {
        levels: ['heroes1_12_v2_alt'],
        requires: ['heroes1_13_v2'],
        // south of the two Freezers in the corridor below heroes1_4
        needs: [
            [{ level: 'heroes1_10_inv_v4_b' }],
            [{ freezer: 111254912 }],
            [{ freezer: 111254914 }],
        ],
    },
    {
        levels: ['heroes1_15'],
        requires: ['heroes1_12_v2_alt'],
        // south of the two Freezers in the corridor below heroes1_4
        needs: [
            [{ level: 'heroes1_10_inv_v4_b' }],
            [{ freezer: 111254912 }],
            [{ freezer: 111254914 }],
        ],
    },
    {
        levels: ['heroes1_16_v3'],
        requires: ['heroes1_15'],
        // south of the two Freezers in the corridor below heroes1_4
        needs: [
            [{ level: 'heroes1_10_inv_v4_b' }],
            [{ freezer: 111254912 }],
            [{ freezer: 111254914 }],
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
        requires: ['heroes1_18'],
        needs: [
            [{ level: 'heroes1_17' }],
        ],
    },
    {
        levels: ['heroes1_21_v3'],
        requires: ['heroes1_19_jail'],
        needs: [
            [{ level: 'heroes1_17' }],
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
        requires: ['mirror_1'],
        needs: [],
    },
    {
        levels: ['mirror_3'],
        requires: ['mirror_2'],
        needs: [],
    },
    {
        levels: ['mirror_4'],
        requires: ['mirror_3'],
        needs: [],
    },
    {
        levels: ['mirror_5'],
        needs: [
            [{ level: 'mirror_3' }],
        ],
    },
    {
        levels: ['mirror_6_alt'],
        requires: ['mirror_5'],
        needs: [
            [{ level: 'mirror_3' }],
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
        requires: ['mirror_7'],
        needs: [
            [{ level: 'mirror_3' }],
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
        requires: ['mirror_11'],
        needs: [
            [{ level: 'skipping_stones' }],
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
        requires: ['mirror_15'],
        needs: [
            [{ level: 'mirror_12' }],
        ],
    },
    {
        levels: ['mirror_17'],
        requires: ['mirror_19'],
        needs: [
            [{ level: 'mirror_12' }],
        ],
    },
    {
        levels: ['mirror_sink'],
        requires: ['mirror_17'],
        needs: 'unknown',
        from: 'sky',
    },
    {
        levels: ['mirror_20'],
        requires: ['mirror_sink'],
        needs: 'unknown',
        from: 'sky',
    },
    {
        levels: ['mirror_18'],
        requires: ['mirror_20'],
        needs: 'unknown',
        from: 'sky',
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
        requires: ['mirror_21'],
        needs: [
            [{ level: 'skipping_stones' }],
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
        requires: ['mirror_13'],
        needs: [
            [{ level: 'mirror_factory_v2' }],
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
        requires: ['mirror_pals'],
        needs: [
            [{ level: 'skipping_stones' }],
        ],
    },
    {
        levels: ['two_step'],
        requires: ['already_dropped_v2'],
        needs: [
            [{ level: 'already_dropped_v2' }],
        ],
        from: 'sky',
    },
    {
        levels: ['use_and_remove'],
        requires: ['two_step'],
        needs: 'unknown',
        from: 'sky',
    },
    {
        levels: ['infinite_crystal_hack_v5'],
        requires: ['use_and_remove'],
        needs: 'unknown',
        from: 'sky',
    },
    {
        levels: ['mundane_mirror'],
        needs: 'unknown',
        from: 'sky',
    },
    {
        levels: ['mirror_10_b_v2'],
        requires: ['mundane_mirror'],
        needs: 'unknown',
        from: 'sky',
    },
    {
        levels: ['mirror_10_d'],
        requires: ['mirror_10_b_v2'],
        needs: 'unknown',
        from: 'sky',
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
        requires: ['double_trouble'],
        needs: [
            [{ level: 'double_trouble' }],
        ],
        from: 'sky',
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
        requires: ['allocate_heroes_v2'],
        needs: [
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['end2_heroes_1_5'],
        requires: ['end2_heroes_1_2'],
        needs: [
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: [
            'prelude_priest_water_goblins_only',
            'see_no_evil',
        ],
        requires: ['end2_heroes_1_5'],
        needs: [
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['end2_mirror_3'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['mirror_prelude_v2_fix'],
        requires: ['end2_mirror_3'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['peak_toggle'],
        requires: ['mirror_prelude_v2_fix'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['floor_plan_v3'],
        needs: [
            [{ level: 'peak_toggle' }],
            [{ level: 'prelude_priest_water_goblins_only' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['stone_economy'],
        needs: [
            [
                { level: 'end2_heroes_1_5' },
                { level: 'end2_river_place' },
                { level: 'stones_prelude' },
            ],
            [
                { level: 'end2_heroes_1_5' },
                { level: 'end2_river_place' },
                { level: 'place_promesst_rooms' },
            ],
            [
                { level: 'end2_heroes_1_5' },
                { level: 'peak_toggle' },
                { level: 'place_promesst_rooms' },
            ],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['place_lily_pushstyle_v6'],
        needs: [
            [
                { level: 'end2_heroes_1_5' },
                { level: 'stone_economy' },
            ],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['three_birds_push'],
        requires: ['place_lily_pushstyle_v6'],
        needs: [
            [
                { level: 'end2_heroes_1_5' },
                { level: 'stone_economy' },
            ],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['stones_prelude'],
        requires: ['three_birds_push'],
        needs: [
            [
                { level: 'end2_heroes_1_5' },
                { level: 'stone_economy' },
            ],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['end2_river_place'],
        requires: ['stones_prelude'],
        needs: [
            [
                { level: 'end2_heroes_1_5' },
                { level: 'stone_economy' },
            ],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['chart_a_course'],
        needs: [
            [{ level: 'end2_river_place' }],
            [{ level: 'peak_toggle' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['sidestone_zach_2_end2'],
        requires: ['chart_a_course'],
        needs: [
            [{ level: 'end2_river_place' }],
            [{ level: 'peak_toggle' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['who_you_gonna_call'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
            [{ level: 'stones_prelude' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['end2_monster_connect'],
        requires: ['who_you_gonna_call'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
            [{ level: 'stones_prelude' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['place_slot_4x4_pushstyle'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['color_picker'],
        requires: ['place_slot_4x4_pushstyle'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['place_promesst_rooms'],
        requires: ['color_picker'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['promesst_prelude_pushstyle'],
        requires: ['place_promesst_rooms'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['elevator_mechanic'],
        requires: ['promesst_prelude_pushstyle'],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['end2_prism_hp'],
        needs: [
            [{ level: 'place_promesst_rooms' }],
            [{ level: 'see_no_evil' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['stack_prelude_pushstyle'],
        needs: [
            [{ level: 'peak_toggle' }],
            [{ level: 'place_promesst_rooms' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
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
        levels: [
            '3wcn_purple_goblin',
            '3wcn_stonehenge',
        ],
        needs: 'unknown',
    },
    {
        levels: ['3wc_into_forest_v7'],
        requires: ['3wcn_stonehenge'],
        needs: 'unknown',
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
        requires: ['jenga_assorted'],
        needs: [
            [{ level: 'torus_goblins' }],
        ],
    },
    // Mirrorable Mirror Medley
    {
        levels: [
            'bard_metamirror',
            'druid_metamirror',
        ],
        needs: 'unknown',
    },
    {
        levels: ['mirror_the_unmirrorable_mirror'],
        requires: ['druid_metamirror'],
        needs: 'unknown',
    },
    {
        levels: ['druid_vertical_mirror'],
        needs: 'unknown',
    },
    {
        levels: ['special_move'],
        requires: ['druid_vertical_mirror'],
        needs: 'unknown',
    },
    {
        levels: [
            'self_teleporting',
            'wrapping_mirror0',
        ],
        needs: 'unknown',
    },
    {
        levels: ['wrapping_mirror0_relatively_prime'],
        requires: ['wrapping_mirror0'],
        needs: 'unknown',
    },
    {
        levels: ['the_line_must_be_drawn_HERE'],
        requires: ['wrapping_mirror0_relatively_prime'],
        needs: 'unknown',
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
        needs: 'unknown',
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
        levels: [
            'bon_voyage',
            'smash_midskip_simpler4',
        ],
        needs: 'unknown',
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
        requires: ['heroes2_2b'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_thief_goblin'],
        requires: ['heroes2_2'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_3_v2'],
        requires: ['heroes2_thief_goblin'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_5_altE'],
        requires: ['heroes2_3_v2'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_5_no_crystal'],
        requires: ['heroes2_5_altE'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_5.5v5'],
        requires: ['heroes2_5_no_crystal'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_6_v3'],
        requires: ['heroes2_5.5v5'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_9'],
        requires: ['heroes2_6_v3'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_10a_intro'],
        requires: ['heroes2_9'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_10'],
        requires: ['heroes2_10a_intro'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_11_v2_easier'],
        requires: ['heroes2_10'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_12_v2'],
        requires: ['heroes2_11_v2_easier'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_11_v2'],
        requires: ['heroes2_12_v2'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_10.5'],
        requires: ['heroes2_11_v2'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        levels: ['one_fire_v2'],
        requires: ['heroes2_10.5'],
        needs: 'unknown',
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_13'],
        requires: ['heroes2_12_v2'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_14'],
        requires: ['heroes2_13'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_15'],
        requires: ['heroes2_14'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_16v4'],
        requires: ['heroes2_15'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: [
            'heroes2_18',
            'heroes2_21b',
        ],
        requires: ['heroes2_16v4'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_22_v2'],
        requires: ['heroes2_21b'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        levels: ['mosh_pit_small'],
        requires: ['heroes2_16v4'],
        needs: 'unknown',
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_17_intro'],
        requires: ['mosh_pit_small'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: [
            'heroes2_17',
            'heroes2_20',
        ],
        requires: ['heroes2_17_intro'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_reprise'],
        requires: ['heroes2_15'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_10a'],
        requires: ['heroes2_10a_intro'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block
        levels: ['heroes2_3monster'],
        requires: ['heroes2_10a'],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    // Heroes and Artifacts
    {
        levels: ['cleric_isles'],
        needs: [
            [{ freezer: 115361714 }],
        ],
    },
    {
        levels: ['thief_wand'],
        needs: 'unknown',
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
            [{ level: 'thief_wand' }],
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
        requires: ['gem_transport'],
        needs: [
            [{ level: 'plus_signs_v3' }],
        ],
    },
    {
        // the Rocks in the Freezers thief_wand and flame_wand open
        levels: ['swap_and_spin'],
        needs: [
            [{ level: 'thief_wand' }],
            [{ level: 'flame_wand' }],
        ],
    },
    {
        // the Rocks in the Freezers thief_wand and flame_wand open
        levels: ['wizard_with_a_gun'],
        requires: ['swap_and_spin'],
        needs: [
            [{ level: 'thief_wand' }],
            [{ level: 'flame_wand' }],
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
            [{ level: 'jump_the_fence_v2' }],
            [{ level: 'purple_haze' }],
        ],
    },
    {
        levels: ['be_aggro_alt_2'],
        needs: 'unknown',
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
        requires: ['orange_wizard_intro'],
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
        levels: ['double_tempo'],
        needs: 'unknown',
    },
    {
        levels: ['button_playground'],
        requires: ['double_tempo'],
        needs: 'unknown',
    },
    {
        levels: ['endpoint_weapon'],
        requires: ['button_playground'],
        needs: 'unknown',
    },
    {
        levels: ['immobilize'],
        requires: ['endpoint_weapon'],
        needs: 'unknown',
    },
    {
        levels: ['invisible_hand'],
        needs: 'unknown',
    },
    {
        levels: ['purple_wizard_maze'],
        needs: [
            [{ level: 'invisible_hand' }],
        ],
    },
    {
        levels: ['magic_square'],
        needs: 'unknown',
    },
    {
        levels: ['magic_shield'],
        requires: ['magic_square'],
        needs: 'unknown',
    },
    {
        levels: [
            'mini_green_maze',
            'safe_returns',
        ],
        needs: 'unknown',
    },
    {
        levels: ['two_through_alt_2'],
        requires: ['safe_returns'],
        needs: 'unknown',
    },
    {
        levels: [
            'see_through',
            'wizard_finesse_1',
        ],
        needs: 'unknown',
    },
    {
        levels: ['wizard_finesse_2'],
        requires: ['wizard_finesse_1'],
        needs: 'unknown',
    },
    {
        levels: ['wizard_finesse_3'],
        requires: ['wizard_finesse_2'],
        needs: 'unknown',
    },
    {
        levels: ['wizard_finesse_4'],
        requires: ['wizard_finesse_3'],
        needs: 'unknown',
    },
    // Heroes and Mirrors
    {
        levels: ['wizard_mirror_intro'],
        needs: 'unknown',
    },
    {
        levels: ['regular_mirror_v4'],
        requires: ['wizard_mirror_intro'],
        needs: 'unknown',
    },
    {
        levels: ['moving_a_mirror'],
        requires: ['regular_mirror_v4'],
        needs: 'unknown',
    },
    {
        levels: ['moving_three_mirrors'],
        requires: ['moving_a_mirror'],
        needs: 'unknown',
    },
    {
        levels: ['mirror_dweller'],
        requires: ['moving_three_mirrors'],
        needs: 'unknown',
    },
    {
        levels: ['clone_goblin'],
        needs: 'unknown',
    },
    {
        levels: ['two_dragon_rooms'],
        needs: [
            [{ level: 'clone_goblin' }],
        ],
    },
    {
        levels: ['quad_torch'],
        requires: ['two_dragon_rooms'],
        needs: [
            [{ level: 'clone_goblin' }],
        ],
    },
    {
        levels: ['flip_flop_v2'],
        needs: 'unknown',
    },
    {
        levels: ['gate_shatter'],
        requires: ['flip_flop_v2'],
        needs: 'unknown',
    },
    {
        levels: ['iodine_clock_v2'],
        requires: ['gate_shatter'],
        needs: 'unknown',
    },
    {
        levels: ['mirror_clocks'],
        requires: ['iodine_clock_v2'],
        needs: 'unknown',
    },
    {
        levels: ['two_for_one'],
        requires: ['flip_flop_v2'],
        needs: 'unknown',
    },
    {
        levels: ['blocking_issue'],
        needs: [
            [
                { level: 'close_to_button' },
                { level: 'crystal_bridges' },
                { level: 'flip_flop_v2' },
                { freezer: 115377002 },
            ],
        ],
    },
    {
        levels: ['greenhouse'],
        requires: ['blocking_issue'],
        needs: 'unknown',
    },
    {
        levels: ['bitstring_small'],
        requires: ['greenhouse'],
        needs: 'unknown',
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
        requires: ['fly_and_flip'],
        needs: 'unknown',
    },
    {
        levels: ['elope'],
        requires: ['fire_and_flip'],
        needs: 'unknown',
    },
    {
        levels: ['reattachment'],
        needs: [
            [
                { level: 'close_to_button' },
                { level: 'crystal_bridges' },
                { level: 'flip_flop_v2' },
                { freezer: 115377002 },
            ],
        ],
    },
    {
        levels: ['detachment'],
        requires: ['reattachment'],
        needs: 'unknown',
    },
    {
        levels: ['holes'],
        needs: [
            [
                { level: 'crystal_bridges' },
                { level: 'flip_flop_v2' },
            ],
        ],
    },
    {
        levels: [
            'double_break',
            'drop_tool',
        ],
        requires: ['holes'],
        needs: 'unknown',
    },
    {
        levels: ['close_to_button'],
        needs: [
            [{ level: 'detachment' }],
            [{ level: 'drop_tool' }],
        ],
    },
    {
        levels: [
            'fuse',
            'goblin_parity',
            'mirror_hallway_v2',
            'red_cross',
            'the_swappers',
        ],
        needs: 'unknown',
    },
    {
        levels: ['tricky_swappers_v3'],
        requires: ['the_swappers'],
        needs: 'unknown',
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
        needs: 'unknown',
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
        needs: 'unknown',
    },
    {
        levels: ['pull_teamwork_alt'],
        requires: ['pull_it_v4'],
        needs: 'unknown',
    },
    {
        levels: ['hot_swap'],
        needs: [
            [
                { level: 'druids_stone_alt' },
                { level: 'new_cleric_fly' },
                { level: 'pull_teamwork_alt' },
                { level: 'stone_stopper3_v2' },
            ],
        ],
    },
    {
        levels: ['skipping_with_dragon'],
        requires: ['hot_swap'],
        needs: [
            [
                { level: 'druids_stone_alt' },
                { level: 'hot_swap' },
                { level: 'new_cleric_fly' },
                { level: 'pull_teamwork_alt' },
                { level: 'stone_stopper3_v2' },
            ],
        ],
    },
    {
        levels: ['walk_into_fire'],
        requires: ['skipping_with_dragon'],
        needs: [
            [
                { level: 'druids_stone_alt' },
                { level: 'hot_swap' },
                { level: 'new_cleric_fly' },
                { level: 'pull_teamwork_alt' },
                { level: 'stone_stopper3_v2' },
            ],
        ],
    },
    {
        levels: ['pull_skip_twins_v3'],
        needs: [
            [{ level: 'walk_into_fire' }],
        ],
    },
    {
        levels: [
            'druid_stone_p',
            'druids_stone_0_v2',
        ],
        needs: [
            [
                { level: 'hot_swap' },
                { level: 'new_cleric_fly' },
                { level: 'pull_teamwork_alt' },
                { level: 'stone_stopper3_v2' },
            ],
        ],
    },
    {
        levels: ['druids_stone_alt'],
        requires: ['druids_stone_0_v2'],
        needs: [
            [
                { level: 'hot_swap' },
                { level: 'new_cleric_fly' },
                { level: 'pull_teamwork_alt' },
                { level: 'stone_stopper3_v2' },
            ],
        ],
    },
    {
        levels: ['druids_stone_2_v4'],
        requires: ['druids_stone_alt'],
        needs: [
            [
                { level: 'druids_stone_alt' },
                { level: 'hot_swap' },
                { level: 'new_cleric_fly' },
                { level: 'pull_teamwork_alt' },
                { level: 'stone_stopper3_v2' },
            ],
        ],
    },
    {
        levels: ['stone_stopper_intro'],
        needs: 'unknown',
    },
    {
        levels: ['another_stone_stopper'],
        requires: ['stone_stopper_intro'],
        needs: 'unknown',
    },
    {
        levels: ['stone_stopper3_v2'],
        requires: ['another_stone_stopper'],
        needs: 'unknown',
    },
    {
        levels: ['stone_stopper5'],
        requires: ['stone_stopper3_v2'],
        needs: 'unknown',
    },
    // Heroes and Stones, West
    {
        levels: ['crystals_not_stones'],
        needs: 'unknown',
    },
    {
        levels: ['stones_not_crystals'],
        requires: ['crystals_not_stones'],
        needs: 'unknown',
    },
    {
        levels: ['one_bird_two_stones'],
        needs: 'unknown',
    },
    {
        levels: ['breath_skip'],
        requires: ['one_bird_two_stones'],
        needs: 'unknown',
    },
    {
        levels: ['indirect_skip'],
        requires: ['breath_skip'],
        needs: 'unknown',
    },
    {
        levels: ['indirect_skip_2'],
        requires: ['indirect_skip'],
        needs: 'unknown',
    },
    {
        levels: [
            'one_of_each',
            'slot_machine_v2',
        ],
        needs: 'unknown',
    },
    {
        levels: ['push_against'],
        requires: ['slot_machine_v2'],
        needs: 'unknown',
    },
    {
        levels: ['come_closer'],
        requires: ['push_against'],
        needs: 'unknown',
    },
    {
        levels: ['useful_stone'],
        requires: ['come_closer'],
        needs: 'unknown',
    },
    {
        levels: ['trick_shot'],
        requires: ['useful_stone'],
        needs: 'unknown',
    },
    {
        levels: ['sprint_skip0'],
        needs: 'unknown',
    },
    {
        levels: ['watergate'],
        requires: ['sprint_skip0'],
        needs: 'unknown',
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
            [
                { level: 'island_friends' },
                { level: 'sprint_skip0' },
            ],
        ],
    },
    {
        levels: ['bard_range4'],
        needs: [
            [
                { level: 'island_friends' },
                { level: 'wizard_with_a_capital_w' },
            ],
        ],
    },
    {
        levels: ['bard_range5'],
        requires: ['bard_range4'],
        needs: [
            [
                { level: 'island_friends' },
                { level: 'wizard_with_a_capital_w' },
            ],
        ],
    },
    {
        levels: ['bard_range6'],
        requires: ['bard_range5'],
        needs: [
            [
                { level: 'island_friends' },
                { level: 'wizard_with_a_capital_w' },
            ],
        ],
    },
    {
        levels: ['wizard_with_a_capital_w_2_v2'],
        needs: [
            [
                { level: 'island_friends' },
                { level: 'wizard_with_a_capital_w' },
            ],
        ],
    },
    // Heroes and Water
    {
        levels: ['a_wiz_out_of_water'],
        needs: 'unknown',
    },
    {
        levels: ['island_hopping'],
        requires: ['a_wiz_out_of_water'],
        needs: 'unknown',
    },
    {
        levels: ['dunk_tank_alt'],
        requires: ['island_hopping'],
        needs: 'unknown',
    },
    {
        levels: ['cleric_fly_intro3_v2'],
        needs: 'unknown',
    },
    {
        levels: ['monster_mover'],
        requires: ['cleric_fly_intro3_v2'],
        needs: 'unknown',
    },
    {
        levels: ['dipping_your_toes_in'],
        needs: 'unknown',
    },
    {
        levels: ['crystal_bridges'],
        requires: ['dipping_your_toes_in'],
        needs: 'unknown',
    },
    {
        levels: ['worlds_collide_heroes_and_mirrors_v3'],
        needs: [
            [{ level: 'crystal_bridges' }],
        ],
    },
    {
        levels: ['dont_push_the_button'],
        needs: 'unknown',
    },
    {
        levels: ['detonator'],
        requires: ['dont_push_the_button'],
        needs: 'unknown',
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
        levels: ['drowner'],
        needs: 'unknown',
    },
    {
        levels: ['surrounded'],
        requires: ['drowner'],
        needs: 'unknown',
    },
    {
        levels: ['gully_alt'],
        needs: 'unknown',
    },
    {
        levels: ['easy_situation_v2'],
        needs: [
            [{ level: 'gully_alt' }],
        ],
    },
    {
        levels: ['killer_wizard'],
        needs: 'unknown',
    },
    {
        levels: ['partial_pull'],
        requires: ['killer_wizard'],
        needs: 'unknown',
    },
    {
        levels: ['new_cleric_fly'],
        needs: 'unknown',
    },
    {
        levels: ['little_faith_alt'],
        requires: ['new_cleric_fly'],
        needs: 'unknown',
    },
    {
        levels: ['both_ways'],
        requires: ['little_faith_alt'],
        needs: 'unknown',
    },
    {
        levels: ['flamethrower'],
        requires: ['both_ways'],
        needs: 'unknown',
    },
    {
        levels: ['bard_stack_intro'],
        needs: [
            [
                { level: 'clone_maze' },
                { level: 'flamethrower' },
            ],
        ],
        from: 'sky',
        drop: [130, 131, 36],
    },
    {
        levels: ['goblin_express'],
        requires: ['bard_stack_intro'],
        needs: [
            [
                { level: 'clone_maze' },
                { level: 'flamethrower' },
            ],
        ],
        from: 'sky',
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
        requires: ['synchronized_swimmers'],
        needs: [
            [{ level: 'flamethrower' }],
        ],
    },
    {
        levels: ['on_command'],
        needs: 'unknown',
    },
    {
        levels: ['team_building_exercise'],
        requires: ['on_command', 'tug_boat'],
        needs: 'unknown',
    },
    {
        levels: [
            'push_and_pull_zach',
            'quadrants_follow_up',
        ],
        needs: 'unknown',
    },
    {
        levels: ['quadrants'],
        requires: ['quadrants_follow_up'],
        needs: 'unknown',
    },
    {
        levels: ['tug_boat'],
        needs: 'unknown',
    },
    // Heroes and Water, North
    {
        levels: ['monster_gate_in_water'],
        needs: [
            [{ level: 'stone_stopper5' }],
        ],
    },
    {
        levels: [
            'floating_gardens',
            'four_horsemen',
        ],
        needs: 'unknown',
    },
    {
        levels: ['put_down_roots_v3'],
        requires: ['four_horsemen'],
        needs: 'unknown',
    },
    {
        levels: ['dragon_garden'],
        requires: ['put_down_roots_v3'],
        needs: 'unknown',
    },
    // Heroes, Duplicated
    {
        levels: ['clone_adjust_mirror'],
        needs: 'unknown',
        from: 'sky',
        drop: [134, 117, 37],
    },
    {
        levels: ['clone_maze'],
        requires: ['clone_adjust_mirror'],
        needs: 'unknown',
        from: 'sky',
        drop: [134, 117, 37],
    },
    {
        levels: [
            'baby_steps_line',
            'surfing_lesson_alt',
        ],
        requires: ['goblin_express'],
        needs: [
            [
                { level: 'clone_maze' },
                { level: 'flamethrower' },
            ],
        ],
        from: 'sky',
        drop: [130, 131, 36],
    },
    {
        levels: ['bard_range3_with_intro'],
        requires: ['surfing_lesson_alt'],
        needs: 'unknown',
    },
    {
        levels: ['clone_adjust'],
        needs: [
            [{ level: 'clone_maze' }],
        ],
        from: 'sky',
    },
    {
        levels: ['clone_adjust_two_rocks'],
        requires: ['clone_adjust'],
        needs: [
            [{ level: 'clone_maze' }],
        ],
        from: 'sky',
    },
    {
        levels: ['pull_line'],
        requires: ['clone_adjust_two_rocks'],
        needs: [
            [{ level: 'clone_maze' }],
        ],
        from: 'sky',
    },
    {
        levels: ['arcadiav2_big'],
        needs: 'unknown',
    },
    {
        levels: ['arcadia_surprise_big'],
        requires: ['arcadiav2_big'],
        needs: 'unknown',
    },
    {
        levels: ['arcadia_surprise_big2'],
        requires: ['arcadia_surprise_big'],
        needs: 'unknown',
    },
    {
        levels: [
            'button_clone_journey',
            'pugo',
        ],
        needs: 'unknown',
    },
    // Mirrorable Mirrors
    {
        levels: ['metamirror_different_dir_alt'],
        needs: 'unknown',
    },
    {
        levels: ['metamirror_different_dir_3_alt'],
        requires: ['metamirror_different_dir_alt'],
        needs: 'unknown',
    },
    {
        levels: ['metamirror_different_dir_2_alt'],
        requires: ['metamirror_different_dir_3_alt'],
        needs: 'unknown',
    },
    {
        levels: ['metamirror_block_v2'],
        needs: [
            [{ level: 'metamirror_different_dir_2_alt' }],
        ],
    },
    {
        levels: ['metamirror_c_alt'],
        requires: ['metamirror_block_v2'],
        needs: 'unknown',
    },
    {
        levels: ['two_metamirrors'],
        requires: ['metamirror_c_alt'],
        needs: 'unknown',
    },
    {
        levels: ['metamirror_same_dir_v2'],
        needs: 'unknown',
    },
    {
        levels: ['metamirror_same_dir_2_alt_2'],
        requires: ['metamirror_same_dir_v2'],
        needs: 'unknown',
    },
    {
        levels: ['metamirror_same_dir_3_alt_2'],
        requires: ['metamirror_same_dir_2_alt_2'],
        needs: 'unknown',
    },
    {
        levels: ['metamirror_same_dir_5_alt'],
        requires: ['metamirror_same_dir_3_alt_2'],
        needs: 'unknown',
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
        requires: ['purple_corner_gem'],
        needs: [
            [{ level: 'promesst3_streamlined' }],
        ],
    },
    {
        levels: ['shunt2_alt'],
        needs: [
            [
                { level: 'friendly_nudges' },
                { level: 'plus_signs_v3' },
            ],
        ],
    },
    {
        levels: ['orange_doubleback'],
        needs: 'unknown',
    },
    {
        levels: ['orange_doubledoubleback'],
        requires: ['orange_doubleback'],
        needs: [
            [{ level: 'orange_doubleback' }],
        ],
    },
    {
        levels: ['sidetrack'],
        needs: 'unknown',
    },
    {
        levels: ['purple_wall_around_easier_vp'],
        requires: ['sidetrack'],
        needs: 'unknown',
    },
    {
        levels: ['purple_clm_v4'],
        needs: [
            [{ level: 'orange_doubledoubleback' }],
            [{ freezer: 111150999 }],
        ],
    },
    {
        levels: ['orange_clm_s'],
        requires: ['purple_clm_v4'],
        needs: [
            [{ level: 'orange_doubledoubleback' }],
            [{ freezer: 111150999 }],
        ],
    },
    // Reflected Beams
    {
        levels: ['tempered_glass_red'],
        needs: [
            [{ freezer: 106974224 }],
        ],
    },
    {
        levels: ['red_rooms_v5'],
        requires: ['tempered_glass_red'],
        needs: [
            [{ freezer: 106974224 }],
        ],
    },
    {
        levels: ['rover_water_purple_v9'],
        requires: ['red_rooms_v5'],
        needs: [
            [{ freezer: 106974224 }],
        ],
    },
    {
        levels: ['protrusions'],
        needs: [
            [
                { level: 'smash_or_dash_vs2' },
                { freezer: 115439713 },
            ],
        ],
    },
    {
        levels: ['mirror_promesst'],
        requires: ['protrusions'],
        needs: [
            [
                { level: 'smash_or_dash_vs2' },
                { freezer: 115439713 },
            ],
        ],
    },
    {
        levels: ['rover_water_purple_sequel_v3'],
        needs: [
            [{ freezer: 115439713 }],
        ],
    },
    {
        levels: ['wrapping_mirror_red_v4'],
        requires: ['red_rooms_v5'],
        needs: [
            [{ freezer: 106974224 }],
        ],
    },
    {
        levels: ['double_sideways'],
        needs: [
            [{ freezer: 111266483 }],
        ],
    },
    {
        levels: ['dual_screen'],
        needs: 'unknown',
    },
    {
        levels: ['mirror_non_turner_v3'],
        needs: [
            [{ freezer: 62923440 }],
        ],
    },
    {
        levels: ['adjust_explorer_v4'],
        requires: ['mirror_non_turner_v3'],
        needs: [
            [{ freezer: 62923440 }],
        ],
    },
    {
        levels: ['green_torq_mirror_vs4'],
        requires: ['adjust_explorer_v4'],
        needs: [
            [{ freezer: 87035116 }],
            [{ freezer: 87035120 }],
        ],
    },
    {
        levels: ['magic_rover'],
        needs: 'unknown',
    },
    {
        levels: ['remote_work'],
        requires: ['magic_rover'],
        needs: 'unknown',
    },
    {
        levels: ['mirror_rover_orange_2'],
        needs: 'unknown',
    },
    {
        levels: ['moving_bridge'],
        requires: ['infinite_crystal_hack_v5', 'square_dance'],
        needs: 'unknown',
    },
    {
        levels: ['smash_or_dash_vs2'],
        needs: 'unknown',
    },
    {
        levels: ['across_the_fence_vtrader_m_p'],
        requires: ['smash_or_dash_vs2'],
        needs: 'unknown',
    },
    {
        levels: ['break_through_focused'],
        requires: ['across_the_fence_vtrader_m_p'],
        needs: 'unknown',
    },
    {
        levels: ['worlds_collide_alt'],
        needs: 'unknown',
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
        requires: ['thats_my_ride'],
        needs: [
            [{ level: 'airmail' }],
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
        levels: ['short_ride_option_b'],
        requires: ['highway'],
        needs: [
            [{ level: 'place_to_stand' }],
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
        requires: ['mirror_stone_intro'],
        needs: [
            [{ level: 'place_to_stand' }],
        ],
    },
    {
        levels: ['catch_and_throw'],
        requires: ['catch_and_drop'],
        needs: [
            [{ level: 'place_to_stand' }],
        ],
    },
    {
        levels: ['already_dropped_v2'],
        needs: [
            [{ level: 'on_the_rocks' }],
        ],
        from: 'sky',
        drop: [131, 44, 29],
    },
    {
        levels: ['cancel_out'],
        needs: 'unknown',
    },
    {
        levels: ['zig_zag'],
        needs: [
            [{ level: 'cancel_out' }],
        ],
    },
    {
        levels: ['ricochet_v2'],
        requires: ['zig_zag'],
        needs: [
            [{ level: 'cancel_out' }],
        ],
    },
    {
        levels: ['run_the_clock_alt'],
        requires: ['ricochet_v2'],
        needs: [
            [{ level: 'cancel_out' }],
        ],
    },
    {
        levels: ['far_river'],
        needs: 'unknown',
    },
    {
        levels: ['ditching_cargo'],
        requires: ['far_river'],
        needs: 'unknown',
    },
    {
        levels: ['unblock_block_alt'],
        requires: ['ditching_cargo'],
        needs: 'unknown',
    },
    {
        levels: ['there_and_back'],
        requires: ['unblock_block_alt'],
        needs: 'unknown',
    },
    {
        levels: ['sink_together'],
        requires: ['there_and_back'],
        needs: 'unknown',
    },
    {
        levels: ['in_the_way_alt_3'],
        requires: ['sink_together'],
        needs: 'unknown',
    },
    {
        levels: ['coax_a_lot'],
        needs: [
            [{ level: 'sink_together' }],
        ],
    },
    {
        levels: ['river_push_v4'],
        requires: ['coax_a_lot'],
        needs: [
            [{ level: 'sink_together' }],
        ],
    },
    {
        levels: ['launch_and_collect'],
        needs: 'unknown',
    },
    {
        levels: ['lilyruga_simpler'],
        requires: ['launch_and_collect'],
        needs: 'unknown',
    },
    {
        levels: ['make_it_happen_v6'],
        needs: 'unknown',
    },
    {
        levels: ['wider_ocean'],
        requires: ['make_it_happen_v6'],
        needs: 'unknown',
    },
    {
        levels: ['reel_it_in'],
        requires: ['wider_ocean'],
        needs: 'unknown',
    },
    {
        levels: ['new_new_new_slam'],
        requires: ['reel_it_in'],
        needs: 'unknown',
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
        requires: ['bad_aim_v2'],
        needs: [
            [{ level: 'reel_it_in' }],
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
        requires: ['mirror_motion'],
        needs: [
            [{ level: 'reel_it_in' }],
        ],
    },
    {
        levels: ['the_long_way'],
        requires: ['diag_slide'],
        needs: [
            [{ level: 'reel_it_in' }],
        ],
    },
    {
        levels: ['ride_together'],
        requires: ['the_long_way'],
        needs: 'unknown',
    },
    {
        levels: ['two_bounce_v2'],
        requires: ['ride_together'],
        needs: [
            [{ level: 'reel_it_in' }],
        ],
    },
    {
        levels: [
            'reflect_momentum',
            'river_dictionary_alt_up',
            'river_plinko_v2_actual',
            'sidestone_zach_1',
        ],
        needs: 'unknown',
    },
    {
        levels: ['sidestone_zach_2'],
        requires: ['sidestone_zach_1'],
        needs: 'unknown',
    },
    {
        levels: ['sidestone_zach_3'],
        requires: ['sidestone_zach_2'],
        needs: 'unknown',
    },
    {
        levels: ['sidestone_zach_4'],
        requires: ['sidestone_zach_3'],
        needs: 'unknown',
    },
    {
        levels: ['square_dance'],
        requires: ['two_step'],
        needs: 'unknown',
    },
    // Alter Beam
    {
        levels: [
            'half_tutorial',
            'monkey_in_the_midpoint',
            'promesst2.5_deeper',
            'promesst3_streamlined',
        ],
        needs: 'unknown',
    },
    {
        levels: ['gem_beam_placement'],
        needs: [
            [{ freezer: 115348084 }],
        ],
    },
    // Stones Illuminated
    {
        // through the Freezer air_skating_v6 opens onto the sky platform, then a hole lands in the corridor of the level
        levels: ['first_flight'],
        needs: [
            [{ level: 'air_skating_v6' }],
        ],
        from: 'sky',
        drop: [16, 60, 38],
    },
    {
        // through the Freezer air_skating_v6 opens onto the sky platform, then a hole lands beside the level
        levels: ['orange_predicament'],
        needs: [
            [{ level: 'air_skating_v6' }],
        ],
        from: 'sky',
        drop: [8, 42, 38],
    },
    {
        // through the Freezer air_skating_v6 opens onto the sky platform, then a hole lands beside the level
        levels: ['skip_orange_maze_v3'],
        needs: [
            [{ level: 'air_skating_v6' }],
        ],
        from: 'sky',
        drop: [20, 39, 38],
    },
    {
        levels: ['orange_skip_place_v3'],
        requires: ['skip_orange_maze_v3'],
        needs: [
            [{ freezer: 111150955 }],
        ],
    },
    {
        levels: ['skip_orange_wall_v3'],
        requires: ['orange_skip_place_v3'],
        needs: [
            [{ freezer: 111150955 }],
        ],
    },
    {
        levels: ['rover_impulse_v2'],
        needs: [
            [
                { level: 'skipping_wrapping_v3' },
                { freezer: 111150955 },
            ],
        ],
    },
    {
        levels: ['rover_advance_c_v2'],
        requires: ['rover_impulse_v2'],
        needs: [
            [
                { level: 'skipping_wrapping_v3' },
                { freezer: 90203320 },
                { freezer: 111150955 },
            ],
        ],
    },
    {
        levels: ['rover_shift_p'],
        requires: ['rover_advance_c_v2'],
        needs: [
            [
                { level: 'skipping_wrapping_v3' },
                { freezer: 90203320 },
                { freezer: 111150955 },
            ],
        ],
    },
    {
        levels: ['doorstop'],
        needs: 'unknown',
    },
    {
        levels: ['doorstop_reprise_easier'],
        requires: ['doorstop'],
        needs: 'unknown',
    },
    {
        levels: ['glass_beach'],
        requires: ['doorstop_reprise_easier'],
        needs: 'unknown',
    },
    {
        levels: ['break_send_lily_c'],
        requires: ['glass_beach'],
        needs: 'unknown',
    },
    {
        levels: ['faster_than_stone'],
        needs: 'unknown',
    },
    {
        levels: ['hustle_v2'],
        requires: ['faster_than_stone'],
        needs: 'unknown',
    },
    {
        levels: ['frantic_factory_v2'],
        needs: 'unknown',
    },
    {
        levels: ['skipping_cyan_precise_c_v3'],
        requires: ['frantic_factory_v2'],
        needs: 'unknown',
    },
    {
        levels: ['indirect_skip_3'],
        requires: ['indirect_skip_2'],
        needs: 'unknown',
    },
    {
        levels: ['purple_beam_intro_v2_alt'],
        needs: 'unknown',
    },
    {
        levels: ['skipping_near_beams_v2'],
        needs: [
            [
                { level: 'purple_beam_intro_v2_alt' },
                { level: 'sp_crystal_tuto' },
            ],
        ],
    },
    {
        levels: [
            'skip_orange_block_c',
            'submarine',
        ],
        needs: 'unknown',
    },
    {
        levels: ['submarine_far_away'],
        requires: ['submarine'],
        needs: 'unknown',
    },
    {
        levels: ['crystal_rover_intro'],
        needs: [
            [{ freezer: 90203340 }],
        ],
        from: 'sky',
        drop: [7, 61, 29],
    },
    {
        levels: ['green_crystal_rover'],
        needs: [
            [{ freezer: 111152405 }],
        ],
    },
    {
        levels: ['skipping_promesst'],
        needs: [
            [
                { level: 'skipping_wrapping_v3' },
                { level: 'sp_crystal_tuto' },
                { freezer: 90203340 },
            ],
        ],
    },
    {
        levels: ['skipping_wrapping_v3'],
        needs: [
            [
                { level: 'sp_crystal_tuto' },
                { freezer: 90202953 },
            ],
        ],
    },
    {
        // through the Freezer rover_impulse_v2 opens into the submarine pocket, then through the Freezer submarine opens
        levels: ['skip_or_sink_r'],
        needs: [
            [{ freezer: 90203328 }],
            [{ freezer: 90203340 }],
        ],
    },
    {
        levels: ['skip_wand_v6'],
        requires: ['skip_or_sink_r'],
        needs: 'unknown',
    },
    {
        levels: ['through_way'],
        needs: 'unknown',
    },
    {
        levels: ['sp_crystal_tuto'],
        requires: ['through_way'],
        needs: 'unknown',
    },
    {
        levels: ['stonewalled'],
        requires: ['sp_crystal_tuto'],
        needs: 'unknown',
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
            [
                { level: 'flamethrower' },
                { level: 'i_beam_v2' },
                { level: 'jump_to_pillar_v3' },
            ],
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
        requires: ['no_charm'],
        needs: [
            [{ level: 'flamethrower' }],
        ],
    },
    {
        levels: ['tippy_intro'],
        needs: [
            [
                { level: 'flamethrower' },
                { level: 'mountain_music' },
            ],
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
        requires: ['tippy_towers_1'],
        needs: [
            [{ level: 'tippy_intro' }],
        ],
    },
    {
        levels: [
            'bard_triangle',
            'high_shelf_v2',
        ],
        requires: ['tippy_towers_4'],
        needs: 'unknown',
    },
    {
        levels: ['erosion_alt'],
        requires: ['falloff_dragons'],
        needs: [
            [{ level: 'falloff_dragons' }],
        ],
    },
    // Skipping and Falling
    {
        levels: ['on_the_rocks'],
        needs: [
            [
                { level: 'catching_fire_v2' },
                { level: 'depositor_thief' },
                { level: 'from_the_depths' },
                { sign: 63027706 },
                { sign: 115348468 },
            ],
        ],
    },
    {
        levels: ['button_shut_in'],
        requires: ['on_the_rocks'],
        needs: [
            [
                { level: 'catching_fire_v2' },
                { level: 'depositor_thief' },
                { level: 'from_the_depths' },
                { sign: 63027706 },
                { sign: 115348468 },
            ],
        ],
    },
    {
        levels: [
            'lily_falls_intro_v2',
            'pool_pal_v2',
        ],
        needs: 'unknown',
    },
    {
        levels: ['sunk_cost_2_v3'],
        requires: ['pool_pal_v2'],
        needs: 'unknown',
    },
    {
        levels: ['tiger_lily_v2'],
        needs: 'unknown',
    },
    {
        levels: ['carry_lily'],
        requires: ['tiger_lily_v2'],
        needs: 'unknown',
    },
    {
        levels: ['removal_v2'],
        requires: ['carry_lily'],
        needs: 'unknown',
    },
    {
        levels: ['many_falls'],
        needs: [
            [{ level: 'pool_pal_v2' }],
            [{ level: 'tiger_lily_v2' }],
        ],
    },
    {
        levels: ['delay_time_v2'],
        requires: ['many_falls'],
        needs: 'unknown',
    },
    // Heroes and Depth
    {
        levels: ['gated_twice_v2'],
        needs: [
            [
                { freezer: 112198043 },
                { freezer: 112198044 },
            ],
            [{ freezer: 115524995 }],
        ],
    },
    {
        levels: ['gated_twice_thief_v2'],
        requires: ['gated_twice_v2'],
        needs: [
            [
                { freezer: 112198043 },
                { freezer: 112198044 },
            ],
            [{ freezer: 115524995 }],
        ],
    },
    {
        levels: ['zombie_graves_v3'],
        needs: [
            [
                { level: 'gated_twice_thief_v2' },
                { sign: 115389568 },
            ],
        ],
    },
    {
        levels: ['dragon_bridge'],
        requires: ['zombie_graves_v3'],
        needs: [
            [
                { level: 'gated_twice_thief_v2' },
                { sign: 115389568 },
            ],
        ],
    },
    {
        levels: ['connect_the_dots_v5'],
        needs: [
            [
                { level: 'gated_twice_thief_v2' },
                { level: 'zombie_graves_v3' },
                { sign: 115389568 },
            ],
        ],
    },
    {
        levels: ['pulling_pedestals'],
        requires: ['connect_the_dots_v5'],
        needs: [
            [
                { level: 'gated_twice_thief_v2' },
                { level: 'zombie_graves_v3' },
                { sign: 115389568 },
            ],
        ],
    },
    {
        levels: ['thief_stack'],
        requires: ['pulling_pedestals'],
        needs: [
            [
                { level: 'gated_twice_thief_v2' },
                { level: 'zombie_graves_v3' },
                { sign: 115389568 },
            ],
        ],
    },
    {
        levels: ['priest_descent_simpler'],
        needs: [
            [
                { level: 'gated_twice_thief_v2' },
                { freezer: 111233689 },
                { sign: 115389568 },
            ],
        ],
    },
    {
        levels: ['priest_button_3d_revised'],
        requires: ['priest_descent_simpler'],
        needs: [
            [{ level: 'priest_descent_simpler' }],
        ],
    },
    {
        levels: ['priest_3d_goblin_pass'],
        requires: ['priest_button_3d_revised'],
        needs: [
            [{ level: 'priest_descent_simpler' }],
        ],
    },
    {
        levels: ['mountain_music'],
        needs: [
            [
                { level: 'jenga_shortstack_v2' },
                { level: 'tippy_intro' },
            ],
        ],
    },
    {
        levels: ['out_of_range_v4'],
        requires: ['mountain_music'],
        needs: [
            [
                { level: 'jenga_shortstack_v2' },
                { level: 'tippy_intro' },
            ],
        ],
    },
    {
        levels: ['magicians_assistant_v2'],
        needs: [
            [
                { level: 'archways_2_v2' },
                { level: 'going_up_v4' },
                { level: 'jenga_shortstack_v2' },
                { level: 'mountain_music' },
                { level: 'tippy_intro' },
            ],
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
        needs: 'unknown',
    },
    {
        levels: ['falloff_4'],
        requires: ['falloff_intro'],
        needs: 'unknown',
    },
    {
        levels: ['falloff_kill_goblins_v6'],
        requires: ['falloff_4'],
        needs: 'unknown',
    },
    {
        levels: ['falloff_dragons'],
        requires: ['falloff_4'],
        needs: [
            [{ level: 'falloff_4' }],
        ],
    },
    {
        levels: ['fire_stairs_part_2'],
        requires: ['fire_stairs_v2'],
        needs: 'unknown',
    },
    {
        levels: ['loading_docks_v2'],
        needs: 'unknown',
    },
    {
        levels: ['assassins_creed'],
        requires: ['loading_docks_v2'],
        needs: 'unknown',
    },
    {
        levels: ['magic_tower'],
        requires: ['erosion_alt'],
        needs: 'unknown',
    },
    {
        levels: ['sky_druid_kill'],
        needs: 'unknown',
    },
    {
        levels: ['sky_druid_kill_tall_2_goblins'],
        requires: ['sky_druid_kill'],
        needs: 'unknown',
    },
    {
        levels: ['stopper_topper_v2'],
        requires: ['sky_druid_kill_tall_2_goblins'],
        needs: [
            [{ level: 'sky_druid_kill_tall_2_goblins' }],
        ],
    },
    {
        levels: ['sky_druid_tree_ex'],
        requires: ['stopper_topper_v2'],
        needs: [
            [{ level: 'sky_druid_kill_tall_2_goblins' }],
        ],
    },
    {
        levels: ['druid_3d_beam'],
        requires: ['sky_druid_tree_ex'],
        needs: [
            [{ level: 'sky_druid_kill_tall_2_goblins' }],
        ],
    },
    {
        levels: ['weaklings_bard_v2'],
        requires: ['sky_druid_tree_ex'],
        needs: [
            [
                { level: 'sky_druid_kill_tall_2_goblins' },
                { freezer: 111233689 },
            ],
        ],
    },
    {
        levels: ['sky_druid_maze'],
        requires: ['weaklings_bard_v2'],
        needs: [
            [
                { level: 'sky_druid_kill_tall_2_goblins' },
                { freezer: 111233689 },
            ],
        ],
    },
    {
        levels: ['sky_druid_one'],
        requires: ['sky_druid_maze'],
        needs: [
            [
                { level: 'sky_druid_kill_tall_2_goblins' },
                { freezer: 111233689 },
            ],
        ],
    },
    // Double Beam Falling
    {
        levels: [
            'annoying_orange_v3',
            'double_up',
            'dragons_layer',
        ],
        needs: 'unknown',
    },
    {
        levels: ['the_sky_is_falling_v2'],
        requires: ['dragons_layer'],
        needs: 'unknown',
    },
    {
        levels: ['thin_ice_rooms'],
        needs: [
            [{ level: 'dragons_layer' }],
        ],
    },
    {
        levels: ['fire_from_above_2'],
        needs: 'unknown',
    },
    {
        levels: ['hat_maker'],
        requires: ['fire_from_above_2'],
        needs: 'unknown',
    },
    {
        levels: ['into_the_water_3'],
        needs: 'unknown',
    },
    {
        levels: ['air_skating_v6'],
        needs: [
            [{ level: 'into_the_water_3' }],
        ],
    },
    {
        levels: [
            'laser_stop_surprise',
            'monster_drop',
            'orange_snake',
            'side_sub_v2',
        ],
        needs: 'unknown',
    },
    {
        levels: ['side_sub_back'],
        requires: ['side_sub_v2'],
        needs: 'unknown',
    },
    {
        levels: ['sky_double_intro0'],
        needs: 'unknown',
    },
    {
        levels: ['sky_double_intro1'],
        requires: ['sky_double_intro0'],
        needs: 'unknown',
    },
    {
        levels: ['through_the_table_e'],
        needs: 'unknown',
    },
    {
        levels: ['through_the_table_f'],
        requires: ['through_the_table_e'],
        needs: 'unknown',
    },
    {
        levels: ['vertical_promesst_v2'],
        needs: 'unknown',
    },
    // Elevators
    {
        levels: ['sokobridge_v4'],
        needs: [
            [
                { level: '3d_intro_promesst_v5' },
                { level: 'dragons_layer' },
                { level: 'strong_monsters_v2' },
                { level: 'thin_ice_rooms' },
                { level: 'under_pressure' },
                { sign: 115389567 },
            ],
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
        // the Rock sokobridge_v4 frees is pushed off the ledge and lands as a stair up to the level
        levels: ['green_hat'],
        needs: [
            [{ level: 'sokobridge_v4' }],
        ],
    },
    {
        levels: ['its_a_tall_order'],
        requires: ['green_hat'],
        needs: 'unknown',
    },
    {
        levels: ['taking_the_lift'],
        needs: [
            [
                { freezer: 111153040 },
                { sign: 115389567 },
            ],
        ],
    },
    {
        levels: ['trick_landing'],
        requires: ['taking_the_lift'],
        needs: 'unknown',
    },
    {
        levels: ['drop_sokoban'],
        requires: ['trick_landing'],
        needs: [
            [
                { freezer: 111153040 },
                { sign: 115389567 },
            ],
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
        requires: ['beam_sisters'],
        needs: 'unknown',
    },
    {
        levels: ['landmines_v3'],
        needs: 'unknown',
    },
    {
        levels: ['shower'],
        requires: ['landmines_v3'],
        needs: 'unknown',
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
        requires: ['flamestrike_v3'],
        needs: [
            [{ level: 'priest_3d_intro_dragon_v4' }],
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
        requires: ['pachinko'],
        needs: 'unknown',
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
        needs: 'unknown',
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
            [{ level: 'landmines_v3' }],
            [{ level: 'seeing_red' }],
            [{ level: 'vacuum' }],
        ],
    },
    {
        // the beam jumps the hero onto the pink_platforms island, whose elevator rises to the level
        levels: ['suspend_intro'],
        needs: [
            [{ level: 'landmines_v3' }],
            [{ level: 'seeing_red' }],
            [{ level: 'vacuum' }],
        ],
    },
    {
        // the beam, turned up at the island and west across z 49 by the Mirrors those levels free, jumps the hero to a cell over the level, which he drops into
        levels: ['suspend_block_v2'],
        needs: [
            [{ level: 'landmines_v3' }],
            [{ level: 'seeing_red' }],
            [{ level: 'vacuum' }],
            [{ level: 'pink_platforms' }],
            [{ level: 'suspend_intro' }],
        ],
    },
    {
        // the Mirror suspend_block_v2 frees turns the beam south along the z 49 platform, and the jump ends beside the level
        levels: ['suspend_heterogeneous'],
        needs: [
            [{ level: 'landmines_v3' }],
            [{ level: 'seeing_red' }],
            [{ level: 'vacuum' }],
            [{ level: 'pink_platforms' }],
            [{ level: 'suspend_intro' }],
            [{ level: 'suspend_block_v2' }],
        ],
    },
    {
        levels: ['suspend_directions_v2'],
        requires: ['suspend_heterogeneous'],
        needs: [
            [{ level: 'seeing_red' }],
        ],
    },
    {
        levels: ['suspend_swapper_hard'],
        requires: ['suspend_directions_v2'],
        needs: [
            [{ level: 'seeing_red' }],
        ],
    },
    {
        // the same full beam relay ends in the corridor that holds the level and height_chooser_v0
        levels: ['beam_jail_v3'],
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
    },
    {
        levels: ['high_endpoint_v2'],
        needs: [
            [
                { level: 'beam_jail_v3' },
                { level: 'thin_ice_rooms' },
            ],
        ],
    },
    {
        // with the last Mirrors and Freezers of the relay cleared the beam runs down to z 38 and north, and the jump ends beside the level
        levels: ['height_chooser_v0'],
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
    },
    // Skipping Stacks
    {
        levels: ['skip_stack_1'],
        needs: [
            [
                { level: 'from_the_depths' },
                { sign: 63027706 },
                { sign: 115348468 },
            ],
        ],
    },
    {
        levels: ['depositor_thief'],
        requires: ['skip_stack_1'],
        needs: [
            [
                { level: 'catching_fire_v2' },
                { level: 'turn_control_v2' },
            ],
        ],
    },
    {
        levels: ['depositor_bard'],
        requires: ['depositor_thief'],
        needs: [
            [
                { level: 'catching_fire_v2' },
                { level: 'turn_control_v2' },
            ],
        ],
    },
    {
        levels: ['skip_stack_2'],
        requires: ['skip_stack_1'],
        needs: [
            [
                { level: 'catching_fire_v2' },
                { level: 'depositor_thief' },
                { level: 'from_the_depths' },
                { level: 'turn_control_v2' },
                { sign: 63027706 },
                { sign: 115348468 },
            ],
        ],
    },
    {
        levels: ['skip_stack_3'],
        requires: ['skip_stack_2'],
        needs: [
            [
                { level: 'catching_fire_v2' },
                { level: 'depositor_thief' },
                { level: 'turn_control_v2' },
            ],
        ],
    },
    {
        levels: ['the_waterfall_v4'],
        needs: [
            [
                { level: 'catching_fire_v2' },
                { level: 'depositor_thief' },
                { level: 'from_the_depths' },
                { sign: 63027706 },
            ],
        ],
    },
    {
        levels: ['priest_water_back_goblin'],
        requires: ['the_waterfall_v4'],
        needs: [
            [
                { level: 'catching_fire_v2' },
                { level: 'depositor_thief' },
                { level: 'from_the_depths' },
                { level: 'turn_control_v2' },
                { sign: 63027706 },
                { sign: 115348468 },
            ],
        ],
    },
    {
        levels: ['priest_water_back_place_v3'],
        requires: ['priest_water_back_goblin'],
        needs: [
            [
                { level: 'catching_fire_v2' },
                { level: 'depositor_thief' },
                { level: 'from_the_depths' },
                { level: 'turn_control_v2' },
                { sign: 63027706 },
                { sign: 115348468 },
            ],
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
        requires: ['personal_assistant_v3'],
        needs: [
            [{ level: 'personal_assistant_v3' }],
        ],
    },
    {
        levels: ['my_first_stack'],
        needs: [
            [
                { level: 'jenga_shortstack_v2' },
                { level: 'push_down_a_lot_small' },
            ],
        ],
    },
    {
        levels: ['single_out'],
        needs: 'unknown',
    },
    {
        levels: ['jenga_shortstack_v2'],
        requires: ['single_out'],
        needs: 'unknown',
    },
    {
        levels: ['jenga_easier'],
        requires: ['jenga_shortstack_v2'],
        needs: 'unknown',
    },
    // Goblin Turning
    {
        levels: ['chain_gang'],
        needs: 'unknown',
    },
    {
        levels: ['chain_gang3'],
        requires: ['chain_gang'],
        needs: 'unknown',
    },
    {
        levels: ['crystal_logistics'],
        needs: 'unknown',
    },
    {
        levels: ['beam_sisters'],
        requires: ['crystal_logistics'],
        needs: 'unknown',
    },
    {
        levels: ['goblin_below_intro_same_z'],
        needs: [
            [{ level: 'beam_sisters' }],
        ],
    },
    {
        // through the cage beam_sisters opens into the goblin_below_intro_same_z room, then south through both Freezers of its doorway, which goblin_below_intro_same_z and thin_ice_rooms open
        levels: ['pass_through_v2_same_z'],
        needs: [
            [{ level: 'beam_sisters' }],
            [{ level: 'goblin_below_intro_same_z' }],
            [{ level: 'thin_ice_rooms' }],
        ],
    },
    {
        levels: ['aggro_maze'],
        needs: [
            [
                { level: 'aggro_which0' },
                { level: 'thin_ice_rooms' },
            ],
        ],
    },
    {
        levels: ['aggro_which0'],
        needs: [
            [
                { level: 'aggro_maze' },
                { level: 'thin_ice_rooms' },
            ],
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
        levels: ['bridgey'],
        needs: 'unknown',
    },
    {
        levels: ['bridgey2'],
        requires: ['bridgey'],
        needs: 'unknown',
    },
    {
        levels: ['bridgey2b'],
        requires: ['bridgey2'],
        needs: 'unknown',
    },
    {
        levels: ['wolf_boat_carry'],
        needs: [
            [{ level: 'bridgey2b' }],
            [{ level: 'goblin_parity_3d' }],
        ],
    },
    {
        levels: ['bridgey3_abstract_art'],
        needs: 'unknown',
    },
    {
        levels: ['all_out_goblin_war'],
        requires: ['bridgey3_abstract_art'],
        needs: 'unknown',
    },
    {
        levels: ['escape_bridge'],
        requires: ['all_out_goblin_war'],
        needs: [
            [
                { level: 'all_out_goblin_war' },
                { level: 'bridgey2' },
            ],
        ],
    },
    {
        levels: ['tandem'],
        requires: ['escape_bridge'],
        needs: 'unknown',
    },
    {
        levels: ['catching_up_v2'],
        needs: 'unknown',
    },
    {
        levels: ['quick_redirect_v5'],
        requires: ['catching_up_v2'],
        needs: 'unknown',
    },
    {
        levels: [
            'implausible_bridge_2',
            'juggle',
            'new_way_mirror_later',
            'to_kill_a_goblin',
        ],
        needs: 'unknown',
    },
    {
        levels: ['tall_stack'],
        requires: ['to_kill_a_goblin'],
        needs: 'unknown',
    },
    {
        levels: ['bottom_adjust'],
        requires: ['tall_stack'],
        needs: 'unknown',
    },
    {
        levels: ['vert_mirror_intro'],
        needs: 'unknown',
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
            [{ level: 'vert_mirror_intro' }],
            [{ level: 'portable_stairs' }],
        ],
    },
    {
        // the vertical Mirror portable_stairs frees is pushed west along the south ledge, and its lift carries the hero onto the tower top row, west of the fences, where implausible_bridge stands
        levels: ['implausible_bridge'],
        requires: ['drawbridge'],
        needs: [
            [{ level: 'vert_mirror_intro' }],
            [{ level: 'portable_stairs' }],
        ],
    },
    {
        // the vertical Mirror implausible_bridge frees, at the west corner of the tower top, lifts the hero onto the inner court, where bottom_bridge_v2 stands
        levels: ['bottom_bridge_v2'],
        needs: [
            [{ level: 'vert_mirror_intro' }],
            [{ level: 'portable_stairs' }],
            [{ level: 'implausible_bridge' }],
        ],
    },
    {
        // the vertical Mirror implausible_bridge frees, at the east corner of the tower top, lifts the hero onto the inner court, where mission_impossible stands
        levels: ['mission_impossible'],
        requires: ['bottom_bridge_v2'],
        needs: [
            [{ level: 'vert_mirror_intro' }],
            [{ level: 'portable_stairs' }],
            [{ level: 'implausible_bridge' }],
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
        levels: ['overwrite'],
        requires: ['repel'],
        needs: 'unknown',
    },
    {
        levels: ['bottom_bridge_tall'],
        requires: ['bottom_bridge_v2'],
        needs: 'unknown',
    },
    // Protection and Support
    {
        levels: ['priest_3d_intro_dragon_v4'],
        needs: 'unknown',
    },
    {
        levels: ['priest_bottom_v2'],
        requires: ['priest_3d_intro_dragon_v4'],
        needs: 'unknown',
    },
    {
        levels: ['fire_stairs_v2'],
        requires: ['priest_bottom_v2'],
        needs: 'unknown',
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
            [
                { level: 'priest_bottom_v2' },
                { level: 'priest_traverse_e_fence' },
                { level: 'skip_stack_1' },
            ],
        ],
    },
    {
        levels: ['priest_two_warriors_v3'],
        requires: ['from_the_depths'],
        needs: 'unknown',
    },
    {
        levels: ['monster_stack'],
        requires: ['priest_two_warriors_v3'],
        needs: [
            [
                { level: 'from_the_depths' },
                { level: 'priest_bottom_v2' },
                { level: 'priest_traverse_e_fence' },
                { level: 'skip_stack_1' },
            ],
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
        requires: ['catching_fire_v2'],
        needs: 'unknown',
    },
    {
        levels: ['stuck_up_v2'],
        needs: 'unknown',
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
        requires: ['4wcn_all_fast'],
        needs: 'unknown',
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
        levels: ['limited_offsets'],
        needs: 'unknown',
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
        levels: [
            'pole_vault',
            'rowboat',
        ],
        needs: 'unknown',
    },
    {
        levels: ['boat_priest_v3'],
        requires: ['rowboat'],
        needs: [
            [{ level: 'bard_stack_intro' }],
        ],
    },
    {
        // the Rocks in the Freezers rowboat and boat_priest_v3 open, with a third, fill the fenced water west of boat_priest_v3, and the hero crosses them
        levels: ['front_side_bus2'],
        needs: [
            [{ level: 'rowboat' }],
            [{ level: 'boat_priest_v3' }],
        ],
    },
    {
        levels: ['front_side_bus3'],
        requires: ['front_side_bus2'],
        needs: [
            [{ level: 'rowboat_wizard_v2' }],
            [{ level: 'boat_priest_v3' }],
            [{ level: 'rowboat' }],
        ],
    },
    {
        levels: ['bard_movable_island'],
        needs: [
            [{ freezer: 115380334 }],
        ],
    },
    {
        levels: ['bard_movable_island2'],
        requires: ['bard_movable_island'],
        needs: [
            [{ level: 'bard_movable_island' }],
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
        requires: ['mirror_crystal_rover'],
        needs: 'unknown',
    },
    {
        levels: ['crystal_rover_bridge'],
        requires: ['crystal_rover_rush'],
        needs: 'unknown',
    },
    {
        levels: ['perch_3_rovers'],
        requires: ['crystal_rover_bridge'],
        needs: 'unknown',
    },
    {
        levels: ['triple_skip'],
        needs: [
            [{ level: 'crystal_rover_bridge' }],
        ],
    },
    {
        levels: ['quadruple_skip'],
        requires: ['triple_skip'],
        needs: [
            [{ level: 'crystal_rover_bridge' }],
        ],
    },
    {
        levels: [
            'endpoint_maze',
            'endpoint_wrap_druid_alt',
        ],
        needs: 'unknown',
    },
    // Doubling Beams
    {
        levels: [
            '3wcn_purple_mirror_skip',
            'duality_condensed',
        ],
        needs: 'unknown',
    },
    {
        // the ride of the Lily on the wrapping river, as for far_wings
        levels: ['duality_2'],
        requires: ['duality_condensed'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: [
            'half_journey_vh',
            'lazy_susan_v2',
            'magnitudes_v3',
            'orange_mirror_walk_button',
            'orange_water_button_vslow',
        ],
        needs: 'unknown',
    },
    {
        levels: ['orange_water_button_vdouble_v2'],
        requires: ['orange_water_button_vslow'],
        needs: 'unknown',
    },
    {
        levels: ['orange_water_button_vfour_alter'],
        requires: ['orange_water_button_vdouble_v2'],
        needs: 'unknown',
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
        needs: 'unknown',
    },
    // Endpoint Skipping
    {
        levels: ['ortho'],
        needs: [
            [
                { level: 'lily_switch_p' },
                { level: 'skybridge' },
            ],
        ],
    },
    {
        levels: ['ortho2'],
        requires: ['ortho'],
        needs: [
            [
                { level: 'lily_switch_p' },
                { level: 'skybridge' },
            ],
        ],
    },
    {
        levels: ['ortho3'],
        requires: ['ortho2'],
        needs: [
            [
                { level: 'lily_switch_p' },
                { level: 'skybridge' },
            ],
        ],
    },
    {
        levels: ['skip_purple_drop_alt'],
        needs: [
            [{ freezer: 115470447 }],
        ],
    },
    {
        levels: ['endpoint_holder3'],
        requires: ['skip_purple_drop_alt'],
        needs: 'unknown',
    },
    {
        levels: [
            'endpoint_holder4',
            'mobile_cover_2',
        ],
        requires: ['endpoint_holder3'],
        needs: 'unknown',
    },
    {
        levels: ['hover_corner_3'],
        requires: ['mobile_cover_2'],
        needs: 'unknown',
    },
    {
        levels: ['hover_corner_4'],
        requires: ['hover_corner_3'],
        needs: 'unknown',
    },
    {
        levels: ['stone_rescue_v3'],
        needs: [
            [{ freezer: 111195724 }],
        ],
    },
    {
        levels: ['wrap_music'],
        requires: ['stone_rescue_v3'],
        needs: [
            [{ level: 'stone_rescue_v3' }],
        ],
    },
    {
        levels: ['wrap_music_2'],
        requires: ['wrap_music'],
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
        requires: ['retvrn0'],
        needs: [
            [{ level: 'stone_rescue_v3' }],
        ],
    },
    {
        levels: [
            'drop_operation_v3',
            'juggalos',
        ],
        needs: 'unknown',
    },
    {
        levels: ['defender'],
        requires: ['juggalos', 'drop_operation_v3'],
        needs: 'unknown',
    },
    // Exit Low
    {
        levels: ['allocate_heroes_end3'],
        needs: 'unknown',
    },
    {
        levels: ['best_beam_colors'],
        requires: ['allocate_heroes_end3'],
        needs: 'unknown',
    },
    {
        levels: ['end3_promesst_red'],
        requires: ['best_beam_colors'],
        needs: 'unknown',
    },
    {
        levels: [
            'end3_heroes_1',
            'end3_mirror_1_v3',
        ],
        requires: ['allocate_heroes_end3'],
        needs: 'unknown',
    },
    {
        levels: ['end3_mirror_2_alt2'],
        requires: ['end3_mirror_1_v3'],
        needs: 'unknown',
    },
    {
        levels: ['end3_skipping_1'],
        requires: ['allocate_heroes_end3'],
        needs: 'unknown',
    },
    {
        levels: ['end3_skipping_red'],
        requires: ['end3_skipping_1'],
        needs: 'unknown',
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
        requires: ['design_corner'],
        needs: [
            [{ level: 'end3_skipping_red' }],
            [{ level: 'end3_mirror_2_alt2' }],
            [{ level: 'end3_heroes_1' }],
            [{ level: 'end3_promesst_red' }],
        ],
    },
    {
        levels: ['make_shoreline'],
        requires: ['make_sokoban'],
        needs: [
            [{ level: 'end3_skipping_red' }],
            [{ level: 'end3_mirror_2_alt2' }],
            [{ level: 'end3_heroes_1' }],
            [{ level: 'end3_promesst_red' }],
        ],
    },
    {
        levels: [
            'design_fts',
            'make_oneway',
            'make_thief_goblin_maze_v2',
        ],
        requires: ['make_shoreline'],
        needs: [
            [{ level: 'end3_skipping_red' }],
            [{ level: 'end3_mirror_2_alt2' }],
            [{ level: 'end3_heroes_1' }],
            [{ level: 'end3_promesst_red' }],
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
        requires: ['river_exploit_v2'],
        needs: [
            [{ level: 'design_fts' }],
            [{ level: 'make_thief_goblin_maze_v2' }],
            [{ level: 'make_oneway' }],
        ],
    },
    {
        levels: ['wizard_jailbreak_v2'],
        requires: ['fix_exploit'],
        needs: [
            [{ level: 'design_fts' }],
            [{ level: 'make_thief_goblin_maze_v2' }],
            [{ level: 'make_oneway' }],
        ],
    },
    {
        levels: ['fix_exploit_promesst_overworld'],
        requires: ['wizard_jailbreak_v2'],
        needs: [
            [{ level: 'design_fts' }],
            [{ level: 'make_thief_goblin_maze_v2' }],
            [{ level: 'make_oneway' }],
        ],
    },
    {
        levels: ['end2_clone_divergence'],
        requires: ['fix_exploit_promesst_overworld'],
        needs: [
            [{ level: 'design_fts' }],
            [{ level: 'make_thief_goblin_maze_v2' }],
            [{ level: 'make_oneway' }],
        ],
    },
    {
        levels: ['end2_clone_divergence_2'],
        requires: ['end2_clone_divergence'],
        needs: [
            [{ level: 'design_fts' }],
            [{ level: 'make_thief_goblin_maze_v2' }],
            [{ level: 'make_oneway' }],
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
        requires: ['simplify_wizard'],
        needs: [
            [{ level: 'end2_clone_divergence_2' }],
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
        requires: ['end3_redundant_beams'],
        needs: [
            [{ level: 'simplify_skipping' }],
        ],
    },
    {
        levels: ['end2_mirror1'],
        requires: ['end3_denoise_pool'],
        needs: [
            [{ level: 'simplify_skipping' }],
        ],
    },
    {
        levels: ['end2_mirror_4_islands_v2'],
        requires: ['end2_mirror1'],
        needs: [
            [{ level: 'simplify_skipping' }],
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
        requires: ['end3_off_topic_alt'],
        needs: [
            [{ level: 'end2_mirror_4_islands_v2' }],
        ],
    },
    {
        levels: ['end3_off_topic_heroes'],
        requires: ['end3_off_topic_mirror'],
        needs: [
            [{ level: 'end2_mirror_4_islands_v2' }],
        ],
    },
    {
        levels: ['end3_reorder_skipping_fix'],
        requires: ['end3_off_topic_heroes'],
        needs: [
            [{ level: 'end2_mirror_4_islands_v2' }],
        ],
    },
    {
        levels: ['end3_reorder_mirror'],
        requires: ['end3_reorder_skipping_fix'],
        needs: [
            [{ level: 'end2_mirror_4_islands_v2' }],
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
        requires: ['environment_art_grid'],
        needs: [
            [{ level: 'end3_reorder_mirror' }],
        ],
    },
    {
        levels: ['environment_art_objects'],
        requires: ['environment_art_background'],
        needs: [
            [{ level: 'end3_reorder_mirror' }],
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
        needs: 'unknown',
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
        requires: ['simultaneous_x'],
        needs: [
            [{ level: 'torus_mirrors' }],
        ],
    },
    {
        levels: ['three_artifacts_v3'],
        requires: ['simultaneous_x_surprise'],
        needs: 'unknown',
    },
    {
        levels: ['army_v5'],
        needs: [
            [{ level: 'torus_mirrors' }],
        ],
    },
    {
        levels: [
            'fail_to_mirror_sequence_v2',
            'mega_clone_v2',
            'mega_merge_v5',
            'pigeonhole_squished',
        ],
        needs: 'unknown',
    },
    {
        // by standing in a dragon fire that Mirrors carried by monsters reflect: the monsters turn toward the hero and turn their Mirrors with them
        levels: ['far_cl_no_walls_pit'],
        requires: ['pigeonhole_squished'],
        needs: [
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
        ],
    },
    {
        // the same fire and Mirrors as far_cl_no_walls_pit
        levels: ['goblin_hat_v2'],
        requires: ['pigeonhole_squished'],
        needs: [
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
        ],
    },
    // Mirrors and Rivers
    {
        levels: [
            'in_a_flash_alt_back',
            'mirror_180',
            'mirror_u',
        ],
        needs: 'unknown',
    },
    {
        levels: ['mirror_flip_donut'],
        requires: ['mirror_u'],
        needs: 'unknown',
    },
    {
        levels: ['in_a_flash_alt'],
        requires: ['mirror_flip_donut'],
        needs: 'unknown',
    },
    {
        levels: ['raft_corners_alt_3'],
        needs: 'unknown',
    },
    {
        // past raft_corners_alt_3, a Rock and a skipping stone pushed into the water let the hero cross on a Lily, a stone on another Lily shielding it from the Dragon's fire, to the room of raft_corners_2_small and raft_corners_4x4
        levels: ['raft_corners_2_small'],
        needs: [
            [{ level: 'raft_corners_alt_3' }],
        ],
    },
    {
        levels: ['raft_corners_4x4'],
        requires: ['raft_corners_2_small'],
        needs: 'unknown',
    },
    {
        levels: [
            'reroute_3',
            'river_maze_clear_tenacious_race_v2',
        ],
        needs: 'unknown',
    },
    {
        levels: ['river_rates_button'],
        requires: ['river_maze_clear_tenacious_race_v2'],
        needs: 'unknown',
    },
    {
        levels: [
            'river_rates_jagged',
            'water_bender_v3',
        ],
        needs: 'unknown',
    },
    // Mirrors as Obstacles
    {
        levels: ['moving_through_mirrors_v3'],
        needs: [
            [
                { level: 'druid_vertical_mirror' },
                { level: 'metamirror_different_dir_2_alt' },
                { level: 'self_teleporting' },
            ],
        ],
    },
    {
        // the four Rocks on the shallow strip are pushed into the water one after another at x 106, y 72 to 75, bridging from the strip to the level
        levels: ['crystal_island'],
        needs: [
            [{ level: 'push_down_chain' }],
        ],
    },
    {
        levels: ['bottleneck'],
        needs: 'unknown',
    },
    {
        levels: ['hanoi_3'],
        requires: ['bottleneck'],
        needs: [
            [
                { level: 'druid_vertical_mirror' },
                { level: 'metamirror_different_dir_2_alt' },
                { level: 'self_teleporting' },
            ],
        ],
    },
    {
        levels: ['busy_beaver'],
        requires: ['hanoi_3'],
        needs: [
            [
                { level: 'druid_vertical_mirror' },
                { level: 'metamirror_different_dir_2_alt' },
                { level: 'self_teleporting' },
            ],
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
        needs: 'unknown',
    },
    {
        levels: ['infinite_looping_skipper_alt'],
        requires: ['infinite_looping_skipper0_alt'],
        needs: 'unknown',
    },
    {
        levels: ['infinite_looping_skipper_far'],
        requires: ['infinite_looping_skipper_alt'],
        needs: 'unknown',
    },
    {
        // the ride of the Lily on the wrapping river, as for far_wings
        levels: ['infinite_looping_skipper_mirrored_ikaruga_alt'],
        requires: ['infinite_looping_skipper_far'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: ['lily_switch_p'],
        needs: 'unknown',
    },
    {
        levels: ['sombreros'],
        requires: ['lily_switch_p'],
        needs: [
            [{ level: 'lily_switch_p' }],
        ],
    },
    {
        levels: [
            'movable_button',
            'movable_buttons',
        ],
        needs: 'unknown',
    },
    {
        levels: ['gem_slot_on_lily'],
        requires: ['movable_buttons'],
        needs: 'unknown',
    },
    {
        levels: ['skybridge'],
        requires: ['ortho'],
        needs: 'unknown',
    },
    {
        levels: ['zap_bridge_perp'],
        requires: ['zap_bridge'],
        needs: [
            [
                { level: 'lily_switch_p' },
                { level: 'skybridge' },
            ],
        ],
    },
    {
        levels: [
            'frontier',
            'zap_bridge',
        ],
        requires: ['zap_bridge_perp'],
        needs: [
            [
                { level: 'lily_switch_p' },
                { level: 'skybridge' },
            ],
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
        levels: ['recycling'],
        needs: [
            [
                { level: 'falling_button' },
                { level: 'treadmill' },
            ],
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
        levels: ['fall_reset_v2'],
        needs: [
            [{ level: 'treadmill' }],
        ],
    },
    {
        levels: ['reset_trio'],
        needs: [
            [
                { level: 'fall_reset_v2' },
                { level: 'monster_spawn' },
                { level: 'treadmill' },
            ],
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
        needs: 'unknown',
    },
    {
        // the Rock the Freezer wrap_music opens is pushed onto the Activator that respawns the Lily beside the wrapping river; the hero pushes the Lily into the river and rides it
        levels: ['far_wings'],
        requires: ['before_wings'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: ['after_wings'],
        requires: ['far_wings'],
        needs: 'unknown',
    },
    {
        levels: ['layered_alt'],
        needs: 'unknown',
    },
    {
        // the ride of the Lily on the wrapping river, as for far_wings
        levels: ['sick_270_small'],
        requires: ['layered_alt'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: ['yars_revenge_setup_v3'],
        requires: ['sick_270_small'],
        needs: 'unknown',
    },
    // Beam Computation
    {
        levels: ['zachtronics_identity'],
        needs: 'unknown',
    },
    {
        levels: ['zachtronics_or'],
        requires: ['zachtronics_identity'],
        needs: [
            [{ level: 'zachtronics_identity' }],
        ],
    },
    {
        levels: ['zachtronics_xor'],
        requires: ['zachtronics_or'],
        needs: [
            [{ level: 'zachtronics_identity' }],
        ],
    },
    {
        levels: ['zachtronics'],
        requires: ['zachtronics_xor'],
        needs: 'unknown',
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
        requires: ['first_flight'],
        needs: 'unknown',
    },
    {
        levels: ['worlds_collide_ps'],
        needs: 'unknown',
    },
    // Heroes 3: Bard, Druid
    {
        levels: ['heroes3_10'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_11_v2'],
        requires: ['heroes3_10'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['druid_and_dragon'],
        requires: ['heroes3_11_v2'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['wizard_and_druid_alt_5'],
        requires: ['druid_and_dragon'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_15_v4'],
        requires: ['wizard_and_druid_alt_5'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_13_v2'],
        requires: ['heroes3_15_v4'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_druid_b_v2'],
        requires: ['heroes3_13_v2'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_druid_a'],
        requires: ['heroes3_druid_b_v2'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['wizard_and_druid_alt'],
        requires: ['wizard_and_druid_alt_5'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_1_v3'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_2_v4'],
        requires: ['heroes3_1_v3'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_3_v2'],
        requires: ['heroes3_2_v4'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: [
            'heroes3_4',
            'heroes3_5',
        ],
        requires: ['heroes3_3_v2'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_8_thief'],
        requires: ['heroes3_5'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_6_v3'],
        requires: ['heroes3_8_thief'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_7_v4'],
        requires: ['heroes3_6_v3'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_8_v4_alt'],
        requires: ['heroes3_7_v4'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_8_v3_alt3'],
        requires: ['heroes3_8_v4_alt'],
        needs: [
            [{ freezer: 115414729 }],
        ],
    },
    {
        levels: ['heroes3_14_v3'],
        needs: 'unknown',
    },
    {
        levels: ['compactor_v2'],
        requires: ['heroes3_14_v3'],
        needs: 'unknown',
    },
    {
        levels: [
            'gatekeeping_v3',
            'heroes3_21_condensed',
        ],
        requires: ['compactor_v2'],
        needs: 'unknown',
    },
    {
        levels: ['heroes3_16_v4_alt'],
        requires: ['heroes3_14_v3'],
        needs: 'unknown',
    },
    // Heroes Together
    {
        levels: ['worlds_collide_heroes_and_stones'],
        needs: [
            [
                { level: 'floating_gardens' },
                { level: 'monster_gate_in_water' },
                { level: 'one_of_each' },
                { level: 'sprint_skip0' },
                { level: 'stone_stopper5' },
                { level: 'stones_not_crystals' },
            ],
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
        levels: [
            'beam_rooms',
            'forbidden_room',
            'gem_pushers',
            'right_hand_man',
            'target_practice_gem',
            'worlds_collide_heroes_and_promesst_v4',
        ],
        needs: 'unknown',
    },
    // Archways
    {
        levels: ['archways_2_v2'],
        needs: [
            [
                { level: 'jenga_shortstack_v2' },
                { level: 'tippy_intro' },
            ],
        ],
    },
    {
        levels: ['cliff_duo'],
        needs: [
            [{ level: 'archways_2_v2' }],
        ],
    },
    {
        levels: [
            'archways_4',
            'hat_chain_vp',
        ],
        needs: 'unknown',
    },
    // The Heroic Way
    {
        levels: ['laser_pointer'],
        requires: ['stack_prelude_pushstyle'],
        needs: [
            [{ level: 'peak_toggle' }],
            [{ level: 'place_promesst_rooms' }],
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: ['all_together_now'],
        needs: 'unknown',
    },
    // Beams, Mirrorably
    {
        levels: ['floating_orange_purple'],
        requires: ['double_sideways'],
        needs: [
            [{ freezer: 111266483 }],
        ],
    },
    {
        levels: [
            'green_metamirror',
            'orange_floaty_reflect_v3',
        ],
        needs: 'unknown',
    },
    {
        levels: ['meta_orange_purple'],
        requires: ['orange_floaty_reflect_v3'],
        needs: 'unknown',
    },
    {
        levels: ['meta_orange_purple_2'],
        requires: ['meta_orange_purple'],
        needs: 'unknown',
    },
    {
        levels: ['the_spiral'],
        needs: 'unknown',
    },
    {
        levels: ['top_green_purple_v3'],
        requires: ['break_through_focused'],
        needs: 'unknown',
    },
    {
        levels: ['fun_house'],
        needs: [
            [
                { level: 'first_flight' },
                { level: 'metamirror_same_dir_3_alt_2' },
                { level: 'top_green_purple_v3' },
            ],
        ],
    },
    {
        levels: ['cyan_torc_maze_vs'],
        requires: ['fun_house'],
        needs: [
            [
                { level: 'first_flight' },
                { level: 'fun_house' },
                { level: 'metamirror_same_dir_3_alt_2' },
                { level: 'top_green_purple_v3' },
            ],
        ],
    },
    {
        levels: ['cyan_counter_med3'],
        requires: ['cyan_torc_maze_vs'],
        needs: 'unknown',
    },
    // Squeeze, Dragon
    {
        levels: [
            'endpoint1_skipping',
            'narrow_passage',
        ],
        needs: 'unknown',
    },
    {
        levels: ['close_circuit'],
        requires: ['narrow_passage'],
        needs: 'unknown',
    },
    {
        levels: [
            'dragon_drag',
            'free_ride',
        ],
        requires: ['close_circuit'],
        needs: 'unknown',
    },
    {
        levels: ['swap_seats'],
        requires: ['free_ride'],
        needs: 'unknown',
    },
    {
        levels: ['security_checkpoints_v2'],
        needs: [
            [
                { level: 'close_circuit' },
                { level: 'doorstop_reprise_easier' },
                { level: 'faster_than_stone' },
                { level: 'first_flight' },
                { level: 'frantic_factory_v2' },
                { level: 'purple_beam_intro_v2_alt' },
                { freezer: 62923495 },
            ],
        ],
    },
    {
        levels: ['ocean_blue'],
        requires: ['security_checkpoints_v2'],
        needs: 'unknown',
    },
    {
        levels: ['double_door'],
        requires: ['narrow_passage'],
        needs: 'unknown',
    },
    {
        levels: ['rsmash'],
        needs: 'unknown',
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
            [
                { level: 'archways_2_v2' },
                { level: 'going_up_v4' },
            ],
        ],
    },
    {
        levels: ['vertical_unclone_3'],
        requires: ['chasm_3'],
        needs: 'unknown',
    },
    // Spinning Beams
    {
        levels: ['turn_control_v2'],
        needs: [
            [
                { level: 'catching_fire_v2' },
                { level: 'depositor_thief' },
                { level: 'from_the_depths' },
                { sign: 63027706 },
                { sign: 115348468 },
            ],
        ],
    },
    {
        levels: ['spin_heroes'],
        requires: ['turn_control_v2'],
        needs: 'unknown',
    },
    {
        levels: ['spray_and_pray'],
        requires: ['spin_heroes'],
        needs: 'unknown',
    },
    {
        levels: ['rotator'],
        requires: ['spray_and_pray'],
        needs: 'unknown',
    },
    {
        levels: ['spin_doctors_v3'],
        requires: ['rotator'],
        needs: 'unknown',
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
        requires: ['3d_intro_vanilla'],
        needs: [
            [{ level: 'end1' }],
        ],
    },
    {
        // the first levels on arrival: the ruby lift is built from the Freezers of rank 1
        levels: ['sister_staircase_harder'],
        requires: ['push_down_v2'],
        needs: [
            [{ level: 'end1' }],
        ],
    },
    {
        // the first levels on arrival: the ruby lift is built from the Freezers of rank 1
        levels: ['carry_simplified'],
        requires: ['sister_staircase_harder'],
        needs: [
            [{ level: 'end1' }],
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
        requires: ['omnimirror_v2'],
        needs: [
            [{ level: 'hat_tricks_0_v3' }],
        ],
    },
    {
        levels: ['mirror_carry_duo'],
        requires: ['goblin_parity_3d'],
        needs: [
            [{ level: 'hat_tricks_0_v3' }],
        ],
    },
    {
        levels: ['bothersome_mirror'],
        needs: [
            [
                { level: 'all_out_goblin_war' },
                { sign: 115503348 },
            ],
            [
                { level: 'on_the_rocks' },
                { sign: 115503348 },
            ],
        ],
    },
    // Strength
    {
        levels: ['buff_explorer'],
        needs: [
            [
                { level: '3d_intro_promesst_v5' },
                { level: 'dragons_layer' },
                { level: 'green_hat' },
                { level: 'sokobridge_v4' },
                { level: 'thin_ice_rooms' },
                { sign: 115389567 },
            ],
        ],
    },
    {
        levels: [
            'cyan_bridge_v3',
            'strong_monsters_v2',
        ],
        requires: ['buff_explorer'],
        needs: [
            [{ level: 'buff_explorer' }],
        ],
    },
    {
        levels: ['floorhands_v5'],
        requires: ['buff_explorer'],
        needs: [
            [
                { level: '3d_intro_promesst_v5' },
                { level: 'green_hat' },
                { level: 'sokobridge_v4' },
                { level: 'strong_monsters_v2' },
                { level: 'thin_ice_rooms' },
                { level: 'under_pressure' },
                { sign: 115389567 },
            ],
        ],
    },
    {
        levels: ['stay_lit'],
        requires: ['floorhands_v5'],
        needs: [
            [
                { level: '3d_intro_promesst_v5' },
                { level: 'green_hat' },
                { level: 'sokobridge_v4' },
                { level: 'strong_monsters_v2' },
                { level: 'thin_ice_rooms' },
                { level: 'under_pressure' },
                { sign: 115389567 },
            ],
        ],
    },
    {
        levels: ['under_pressure'],
        requires: ['buff_explorer'],
        needs: [
            [{ level: 'buff_explorer' }],
        ],
    },
    {
        levels: ['high_horse'],
        requires: ['assassins_creed'],
        needs: 'unknown',
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
            [
                { level: 'lily_pull_intro' },
                { level: 'on_the_rocks' },
            ],
        ],
    },
    {
        levels: ['lily_pull'],
        needs: 'unknown',
    },
    {
        levels: [
            'retro',
            'retro_hooks',
        ],
        requires: ['lily_pull'],
        needs: 'unknown',
    },
    // Mirror Falling
    {
        levels: ['pillars'],
        needs: 'unknown',
    },
    {
        levels: ['long_platform_v2'],
        requires: ['pillars'],
        needs: 'unknown',
    },
    {
        levels: [
            'blind_spot_v2',
            'falling_blocker_v3',
            'make_a_right_simpler',
        ],
        needs: [
            [
                { level: '3d_intro_mirrors' },
                { level: 'bothersome_mirror' },
                { level: 'cliff_hopping' },
                { level: 'repel' },
                { level: 'to_kill_a_goblin' },
                { freezer: 62988686 },
            ],
        ],
    },
    {
        levels: ['make_a_right'],
        requires: ['make_a_right_simpler'],
        needs: [
            [
                { level: '3d_intro_mirrors' },
                { level: 'bothersome_mirror' },
                { level: 'cliff_hopping' },
                { level: 'repel' },
                { level: 'to_kill_a_goblin' },
                { freezer: 62988686 },
            ],
        ],
    },
    {
        levels: ['learn_to_catch_v2'],
        needs: [
            [
                { level: '3d_intro_mirrors' },
                { level: 'bothersome_mirror' },
                { level: 'cliff_hopping' },
                { level: 'make_a_right_simpler' },
                { level: 'repel' },
                { level: 'to_kill_a_goblin' },
                { freezer: 62988686 },
            ],
        ],
    },
    {
        levels: ['trust_falls'],
        requires: ['learn_to_catch_v2'],
        needs: [
            [
                { level: '3d_intro_mirrors' },
                { level: 'bothersome_mirror' },
                { level: 'cliff_hopping' },
                { level: 'make_a_right_simpler' },
                { level: 'repel' },
                { level: 'to_kill_a_goblin' },
                { freezer: 62988686 },
            ],
        ],
    },
    {
        levels: ['trader_descend'],
        needs: 'unknown',
    },
    {
        levels: ['cliff_hopping'],
        requires: ['trader_descend'],
        needs: 'unknown',
    },
    {
        // the Mirror pushed east off the z 34 ledge falls and teleports the Rock into the gap north of the plateau, the way to the level
        levels: ['triple_gate'],
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
    },
    // Crossroads Low
    {
        // the elevator carries the hero down to the level once all three Rocks of its stack are smashed: Rubble smashed in both the SMASH and the ALTER beam smashes every Rock of its kind in the room; on the way the red Gem is moved across the sky through the Freezers of taking_the_lift, drop_sokoban, bridgey3_abstract_art, overwrite and the Strength levels
        levels: ['push_down_chain'],
        needs: [
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
            [
                { level: 'boot_cycle_warrior' },
                { level: 'endpoint_maze' },
                { level: 'endpoint_wrap_druid_alt' },
                { level: 'mirror_rover_orange_2' },
                { level: 'push_down_chain' },
            ],
        ],
    },
    {
        levels: ['do_not_want'],
        needs: 'unknown',
    },
    {
        levels: ['wand_reintro'],
        needs: [
            [
                { level: 'boot_cycle_warrior' },
                { level: 'endpoint_maze' },
                { level: 'endpoint_wrap_druid_alt' },
                { level: 'mirror_rover_orange_2' },
                { level: 'nowhere_to_smash_combo' },
                { level: 'push_down_chain' },
            ],
            [
                { level: 'boot_cycle_warrior' },
                { level: 'do_not_want' },
                { level: 'endpoint_maze' },
                { level: 'endpoint_wrap_druid_alt' },
                { level: 'mirror_rover_orange_2' },
                { level: 'push_down_chain' },
                { level: 'rubble_chain' },
                { level: 'save_for_later' },
            ],
        ],
    },
    {
        levels: [
            'get_through_alt',
            'get_through_depths',
            'rubble_chain',
            'save_for_later',
            'smartbomb_combo_v3',
        ],
        needs: 'unknown',
    },
    // Lily Beam Rotation
    {
        // on foot from the hub elevator through the cages of get_through_alt and breaking_bread
        levels: ['river_rotate_beams_gr'],
        needs: [
            [{ level: 'push_down_chain' }],
            [{ level: 'get_through_alt' }],
            [{ level: 'breaking_bread' }],
        ],
    },
    {
        levels: [
            'kick',
            'lily_two_cyan',
        ],
        needs: 'unknown',
    },
    // Gems as Obstacles
    {
        levels: ['gem_trap'],
        needs: 'unknown',
    },
    {
        levels: ['gem_trap2'],
        requires: ['gem_trap'],
        needs: 'unknown',
    },
    {
        // on foot from the hub elevator through the cages of gem_trap2 and get_through_alt
        levels: ['negative_space'],
        needs: [
            [{ level: 'push_down_chain' }],
            [{ level: 'gem_trap2' }],
            [{ level: 'get_through_alt' }],
        ],
    },
    {
        levels: ['numberlink_alt'],
        needs: 'unknown',
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
            [
                { level: 'boot_cycle_warrior' },
                { level: 'endpoint_maze' },
                { level: 'endpoint_wrap_druid_alt' },
                { level: 'mirror_rover_orange_2' },
                { level: 'nowhere_to_smash_combo' },
                { level: 'push_down_chain' },
            ],
            [
                { level: 'boot_cycle_warrior' },
                { level: 'do_not_want' },
                { level: 'endpoint_maze' },
                { level: 'endpoint_wrap_druid_alt' },
                { level: 'mirror_rover_orange_2' },
                { level: 'push_down_chain' },
                { level: 'rubble_chain' },
                { level: 'save_for_later' },
            ],
        ],
    },
    {
        levels: ['no_murder_weapon_0'],
        requires: ['no_murder_weapon_wizard'],
        needs: [
            [
                { level: 'boot_cycle_warrior' },
                { level: 'endpoint_maze' },
                { level: 'endpoint_wrap_druid_alt' },
                { level: 'mirror_rover_orange_2' },
                { level: 'nowhere_to_smash_combo' },
                { level: 'push_down_chain' },
            ],
            [
                { level: 'boot_cycle_warrior' },
                { level: 'do_not_want' },
                { level: 'endpoint_maze' },
                { level: 'endpoint_wrap_druid_alt' },
                { level: 'mirror_rover_orange_2' },
                { level: 'push_down_chain' },
                { level: 'rubble_chain' },
                { level: 'save_for_later' },
            ],
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
            [{ level: 'no_murder_weapon_wizard' }],
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
            [
                { level: 'do_not_want' },
                { level: 'endpoint_maze' },
                { level: 'endpoint_wrap_druid_alt' },
                { level: 'mirror_rover_orange_2' },
                { level: 'push_down_chain' },
                { level: 'rubble_chain' },
                { level: 'save_for_later' },
            ],
            [
                { level: 'endpoint_maze' },
                { level: 'endpoint_wrap_druid_alt' },
                { level: 'mirror_rover_orange_2' },
                { level: 'nowhere_to_smash_combo' },
                { level: 'push_down_chain' },
            ],
        ],
    },
    {
        levels: ['boot_cycle_warrior'],
        requires: ['orange_gem_instant'],
        needs: 'unknown',
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
            [{ level: 'push_down_chain' }],
            [{ level: 'torus_goblins' }],
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
            [{ level: 'green_goblins' }],
            [{ level: 'no_murder_weapon_wizard' }],
        ],
    },
    {
        levels: ['monster_promesst_v3'],
        requires: ['thief_dragger_v2', 'open_monster'],
        needs: 'unknown',
    },
    {
        levels: ['button_and_beam_v3'],
        needs: [
            [
                { level: 'en_root_alt' },
                { level: 'green_goblins' },
                { level: 'open_monster' },
                { level: 'thief_dragger_v2' },
            ],
            [
                { level: 'metamirror_same_dir_3_alt_2' },
                { level: 'open_monster' },
                { level: 'thief_dragger_v2' },
            ],
        ],
    },
    {
        levels: ['battle_royale_v2'],
        requires: ['ice_climbers'],
        needs: 'unknown',
    },
    {
        levels: ['open_monster'],
        needs: 'unknown',
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
