export type Need = { level: string } | { freezer: number } | { sign: number } | { rock: number };

export interface LevelRow {
    levels: string[];
    needs: Need[][] | 'unknown';
    from?: 'sky';
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
        levels: [
            'beam_shatter',
            'bypass_gates',
            'pulling_near_orange_v2',
            'pushing_near_orange',
        ],
        needs: [
            [{ level: 'jump_the_fence_v2' }],
        ],
    },
    {
        levels: [
            'endpoint_team',
            'pushback',
            'simple_trap',
            'untrap',
        ],
        needs: [
            [{ level: 'pull_together' }],
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
        levels: ['snipperclips_0_square'],
        needs: [
            [{ freezer: 90180832 }],
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
            'snipperclips_diagonal',
            'snipperclips_square',
        ],
        needs: [
            [{ freezer: 90180988 }],
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
            'middle_smash',
            'through_maze_v2',
            'torc_blocked',
            'torc_blocked_easier',
        ],
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
        levels: ['orange_beam_deal'],
        needs: [
            [{ level: 'double_team' }],
        ],
    },
    {
        levels: [
            'accidentally_unlock_v2',
            'binary_maze',
            'boxes_vs_crystals',
            'corner_loop',
            'double_team',
            'dragon_on_the_wall',
            'jump_the_fence_v2',
            'lock_picky',
            'multipush_for_me2',
            'oneway_beam',
            'pull_together',
            'purple_push_pal',
            'pushing_crystal_near_orange_v2',
            'pushing_orange',
            'red_handed',
            'safety_gloves',
            'side_kick',
            'slide_rows',
            'smash_grid_kill',
            'thief_through',
            'through_intro',
            'through_push',
            'wall_sneak',
        ],
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
        levels: [
            'heroes1_1',
            'heroes1_10_inv_v4_b',
            'heroes1_2_v2',
            'heroes1_3',
            'heroes1_4',
            'heroes1_4.5',
            'heroes1_5_v2',
            'heroes1_6',
            'heroes1_7.5',
            'heroes1_7_v2',
            'heroes1_8_v2',
            'heroes1_9',
        ],
        needs: [],
    },
    {
        levels: [
            'heroes1_11_v2',
            'heroes1_12_v2_alt',
            'heroes1_13_v2',
            'heroes1_15',
            'heroes1_16_v3',
        ],
        needs: [
            [{ level: 'heroes1_10_inv_v4_b' }],
        ],
    },
    {
        levels: [
            'heroes1_18',
            'heroes1_19_jail',
            'heroes1_21_v3',
        ],
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
    {
        // past heroes1_15, by a Wardrobe swap
        levels: ['heroes1_17'],
        needs: [
            [{ level: 'heroes1_15' }],
        ],
    },
    // The Mirror Isles
    {
        levels: [
            'mirror_1',
            'mirror_2',
            'mirror_3',
            'mirror_4',
        ],
        needs: [],
    },
    {
        levels: ['mirror_10_alt2'],
        needs: [
            [{ level: 'mirror_18' }],
        ],
    },
    {
        levels: [
            'mirror_11',
            'mirror_12',
            'mirror_21',
            'mirror_22_v2',
            'mirror_factory_v2',
            'mirror_pals',
            'walk_it_over',
        ],
        needs: [
            [{ level: 'skipping_stones' }],
        ],
    },
    {
        levels: [
            'mirror_5',
            'mirror_6_alt',
            'mirror_7',
            'mirror_8_v5',
        ],
        needs: [
            [{ level: 'mirror_3' }],
        ],
    },
    {
        levels: [
            'mirror_13',
            'mirror_14',
        ],
        needs: [
            [{ level: 'mirror_factory_v2' }],
        ],
    },
    {
        levels: [
            'mirror_15',
            'mirror_17',
            'mirror_19',
        ],
        needs: [
            [{ level: 'mirror_12' }],
        ],
    },
    {
        levels: ['two_step'],
        needs: [
            [{ level: 'already_dropped_v2' }],
        ],
        from: 'sky',
    },
    {
        levels: [
            'infinite_crystal_hack_v5',
            'mirror_10_b_v2',
            'mirror_10_d',
            'mirror_18',
            'mirror_20',
            'mirror_sink',
            'mundane_mirror',
            'use_and_remove',
        ],
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
        levels: [
            'allocate_heroes_v2',
            'end2_heroes_1_2',
            'end2_heroes_1_5',
            'prelude_priest_water_goblins_only',
            'see_no_evil',
        ],
        needs: [
            [{ sign: 115348482 }],
            [{ sign: 115348478 }],
            [{ sign: 115348468 }],
            [{ sign: 115348474 }],
        ],
    },
    {
        levels: [
            'color_picker',
            'elevator_mechanic',
            'end2_mirror_3',
            'mirror_prelude_v2_fix',
            'peak_toggle',
            'place_promesst_rooms',
            'place_slot_4x4_pushstyle',
            'promesst_prelude_pushstyle',
        ],
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
        levels: [
            'end2_river_place',
            'place_lily_pushstyle_v6',
            'stones_prelude',
            'three_birds_push',
        ],
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
        levels: [
            'chart_a_course',
            'sidestone_zach_2_end2',
        ],
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
        levels: [
            'end2_monster_connect',
            'who_you_gonna_call',
        ],
        needs: [
            [{ level: 'end2_heroes_1_5' }],
            [{ level: 'stones_prelude' }],
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
            '3wc_into_forest_v7',
            '3wcn_purple_goblin',
            '3wcn_stonehenge',
        ],
        needs: 'unknown',
    },
    // Heterogeneous Stacks
    {
        levels: [
            'how_to_train_your_dragon',
            'jenga_assorted',
        ],
        needs: [
            [{ level: 'torus_goblins' }],
        ],
    },
    // Mirrorable Mirror Medley
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
        levels: [
            'bard_metamirror',
            'druid_metamirror',
            'druid_vertical_mirror',
            'mirror_the_unmirrorable_mirror',
            'self_teleporting',
            'special_move',
            'the_line_must_be_drawn_HERE',
            'wrapping_mirror0',
            'wrapping_mirror0_relatively_prime',
            'wrapping_mirror_alt',
        ],
        needs: 'unknown',
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
        levels: ['wrapping_magic_mirror_2'],
        needs: [
            [{ level: 'torus_mirrors' }],
        ],
    },
    {
        // unsure
        levels: ['torus_mirrors'],
        needs: [
            [{ level: 'crystal_island' }],
        ],
    },
    {
        // unsure
        levels: ['stasis_v2'],
        needs: [
            [{ level: 'crystal_island' }],
        ],
    },
    {
        levels: ['double_sided_skip'],
        needs: [
            [{ level: 'wrapping_magic_mirror_2' }],
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
        // the Rock in the Freezer heroes1_19_jail opens unlocks a blue block; unsure
        levels: [
            'heroes2_10',
            'heroes2_10.5',
            'heroes2_10a',
            'heroes2_10a_intro',
            'heroes2_11_v2',
            'heroes2_11_v2_easier',
            'heroes2_12_v2',
            'heroes2_13',
            'heroes2_14',
            'heroes2_15',
            'heroes2_16v4',
            'heroes2_17',
            'heroes2_17_intro',
            'heroes2_18',
            'heroes2_2',
            'heroes2_20',
            'heroes2_21b',
            'heroes2_22_v2',
            'heroes2_2b',
            'heroes2_3_v2',
            'heroes2_3monster',
            'heroes2_5.5v5',
            'heroes2_5_altE',
            'heroes2_5_no_crystal',
            'heroes2_6_v3',
            'heroes2_9',
            'heroes2_reprise',
            'heroes2_thief_goblin',
        ],
        needs: [
            [{ level: 'heroes1_19_jail' }],
        ],
    },
    {
        levels: [
            'mosh_pit_small',
            'one_fire_v2',
        ],
        needs: 'unknown',
    },
    // Heroes and Artifacts
    {
        levels: ['flame_wand'],
        needs: [
            [{ level: 'thief_wand' }],
        ],
    },
    {
        levels: ['bug_spray'],
        needs: [
            [{ level: 'thief_wand' }],
        ],
    },
    {
        levels: ['cleric_isles'],
        needs: [
            [{ freezer: 115361714 }],
        ],
    },
    {
        levels: [
            'friendly_nudges',
            'gem_transport',
            'gem_transport_2',
        ],
        needs: [
            [{ level: 'plus_signs_v3' }],
        ],
    },
    {
        levels: ['thief_wand'],
        needs: 'unknown',
    },
    {
        // the Rocks in the Freezers thief_wand and flame_wand open; unsure
        levels: [
            'plus_signs_v3',
            'swap_and_spin',
            'wizard_with_a_gun',
        ],
        needs: [
            [{ level: 'thief_wand' }],
            [{ level: 'flame_wand' }],
        ],
    },
    // Heroes and Light, Advanced
    {
        levels: [
            'learning_double',
            'orange_wizard_intro',
        ],
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
        levels: ['purple_wizard_maze'],
        needs: [
            [{ level: 'invisible_hand' }],
        ],
    },
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
        levels: [
            'be_aggro_alt_2',
            'button_playground',
            'double_tempo',
            'endpoint_weapon',
            'immobilize',
            'invisible_hand',
            'magic_shield',
            'magic_square',
            'mini_green_maze',
            'safe_returns',
            'see_through',
            'two_through_alt_2',
            'wizard_finesse_1',
            'wizard_finesse_2',
            'wizard_finesse_3',
            'wizard_finesse_4',
        ],
        needs: 'unknown',
    },
    // Heroes and Mirrors
    {
        levels: ['close_to_button'],
        needs: [
            [{ level: 'detachment' }],
            [{ level: 'drop_tool' }],
        ],
    },
    {
        levels: ['oneway_dragon_toast'],
        needs: [
            [{ level: 'walk_the_plank' }],
        ],
    },
    {
        levels: [
            'quad_torch',
            'two_dragon_rooms',
        ],
        needs: [
            [{ level: 'clone_goblin' }],
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
        levels: [
            'blocking_issue',
            'reattachment',
        ],
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
        levels: ['holes'],
        needs: [
            [
                { level: 'crystal_bridges' },
                { level: 'flip_flop_v2' },
            ],
        ],
    },
    {
        levels: ['wizard_mirror_intro'],
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
        levels: [
            'bitstring_small',
            'clone_goblin',
            'detachment',
            'double_break',
            'drop_tool',
            'elope',
            'fire_and_flip',
            'flip_flop_v2',
            'fuse',
            'gate_shatter',
            'goblin_parity',
            'greenhouse',
            'iodine_clock_v2',
            'mirror_clocks',
            'mirror_dweller',
            'mirror_hallway_v2',
            'moving_a_mirror',
            'moving_three_mirrors',
            'red_cross',
            'regular_mirror_v4',
            'the_swappers',
            'tricky_swappers_v3',
            'two_for_one',
            'walk_the_plank',
        ],
        needs: 'unknown',
    },
    // Heroes and Stones, East
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
        // unsure
        levels: ['pull_skip_twins_v3'],
        needs: [
            [{ level: 'walk_into_fire' }],
        ],
    },
    {
        levels: [
            'skipping_with_dragon',
            'walk_into_fire',
        ],
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
        levels: [
            'druid_stone_p',
            'druids_stone_0_v2',
            'druids_stone_alt',
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
        levels: ['skipping_shores_v3'],
        needs: [
            [{ level: 'skipping_pals' }],
        ],
    },
    {
        levels: ['druids_stone_2_v4'],
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
        levels: [
            'another_stone_stopper',
            'pull_it_v4',
            'pull_teamwork_alt',
            'stone_stopper3_v2',
            'stone_stopper5',
            'stone_stopper_intro',
        ],
        needs: 'unknown',
    },
    // Heroes and Stones, West
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
        levels: [
            'bard_range4',
            'bard_range5',
            'bard_range6',
            'wizard_with_a_capital_w_2_v2',
        ],
        needs: [
            [
                { level: 'island_friends' },
                { level: 'wizard_with_a_capital_w' },
            ],
        ],
    },
    {
        levels: [
            'breath_skip',
            'come_closer',
            'crystals_not_stones',
            'indirect_skip',
            'indirect_skip_2',
            'one_bird_two_stones',
            'one_of_each',
            'push_against',
            'slot_machine_v2',
            'sprint_skip0',
            'stones_not_crystals',
            'trick_shot',
            'useful_stone',
            'watergate',
        ],
        needs: 'unknown',
    },
    // Heroes and Water
    {
        levels: [
            'bard_stack_intro',
            'goblin_express',
        ],
        needs: [
            [
                { level: 'clone_maze' },
                { level: 'flamethrower' },
            ],
        ],
        from: 'sky',
    },
    {
        levels: [
            'dragon_compass',
            'one_vs_three',
            'synchronized_swimmers',
        ],
        needs: [
            [{ level: 'flamethrower' }],
        ],
    },
    {
        levels: ['easy_situation_v2'],
        needs: [
            [{ level: 'gully_alt' }],
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
        levels: ['worlds_collide_heroes_and_mirrors_v3'],
        needs: [
            [{ level: 'crystal_bridges' }],
        ],
    },
    {
        levels: [
            'a_wiz_out_of_water',
            'both_ways',
            'cleric_fly_intro3_v2',
            'crystal_bridges',
            'detonator',
            'dipping_your_toes_in',
            'dont_push_the_button',
            'drowner',
            'dunk_tank_alt',
            'flamethrower',
            'gully_alt',
            'island_hopping',
            'killer_wizard',
            'little_faith_alt',
            'monster_mover',
            'new_cleric_fly',
            'on_command',
            'partial_pull',
            'push_and_pull_zach',
            'quadrants',
            'quadrants_follow_up',
            'surrounded',
            'team_building_exercise',
            'tug_boat',
        ],
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
            'dragon_garden',
            'floating_gardens',
            'four_horsemen',
            'put_down_roots_v3',
        ],
        needs: 'unknown',
    },
    // Heroes, Duplicated
    {
        levels: [
            'baby_steps_line',
            'surfing_lesson_alt',
        ],
        needs: [
            [
                { level: 'clone_maze' },
                { level: 'flamethrower' },
            ],
        ],
        from: 'sky',
    },
    {
        levels: [
            'clone_adjust',
            'clone_adjust_two_rocks',
            'pull_line',
        ],
        needs: [
            [{ level: 'clone_maze' }],
        ],
        from: 'sky',
    },
    {
        levels: [
            'clone_adjust_mirror',
            'clone_maze',
        ],
        needs: 'unknown',
        from: 'sky',
    },
    {
        levels: [
            'arcadia_surprise_big',
            'arcadia_surprise_big2',
            'arcadiav2_big',
            'bard_range3_with_intro',
            'button_clone_journey',
            'pugo',
        ],
        needs: 'unknown',
    },
    // Mirrorable Mirrors
    {
        levels: ['metamirror_block_v2'],
        needs: [
            [{ level: 'metamirror_different_dir_2_alt' }],
        ],
    },
    {
        levels: [
            'metamirror_c_alt',
            'metamirror_different_dir_2_alt',
            'metamirror_different_dir_3_alt',
            'metamirror_different_dir_alt',
            'metamirror_same_dir_2_alt_2',
            'metamirror_same_dir_3_alt_2',
            'metamirror_same_dir_5_alt',
            'metamirror_same_dir_v2',
            'two_metamirrors',
        ],
        needs: 'unknown',
    },
    // Beams Reflected
    {
        levels: [
            'gem_clg_v4',
            'purple_corner_gem',
        ],
        needs: [
            [{ level: 'promesst3_streamlined' }],
        ],
    },
    {
        levels: ['orange_doubledoubleback'],
        needs: [
            [{ level: 'orange_doubleback' }],
        ],
    },
    {
        levels: [
            'orange_clm_s',
            'purple_clm_v4',
        ],
        needs: [
            [{ level: 'orange_doubledoubleback' }],
            [{ freezer: 111150999 }],
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
        levels: [
            'orange_doubleback',
            'purple_wall_around_easier_vp',
            'sidetrack',
        ],
        needs: 'unknown',
    },
    // Reflected Beams
    {
        levels: [
            'adjust_explorer_v4',
            'mirror_non_turner_v3',
        ],
        needs: [
            [{ freezer: 62923440 }],
        ],
    },
    {
        levels: [
            'red_rooms_v5',
            'rover_water_purple_v9',
            'tempered_glass_red',
            'wrapping_mirror_red_v4',
        ],
        needs: [
            [{ freezer: 106974224 }],
        ],
    },
    {
        levels: ['green_torq_mirror_vs4'],
        needs: [
            [{ freezer: 87035116 }],
            [{ freezer: 87035120 }],
        ],
    },
    {
        levels: [
            'mirror_promesst',
            'protrusions',
        ],
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
        levels: [
            'across_the_fence_vtrader_m_p',
            'break_through_focused',
            'double_sideways',
            'dual_screen',
            'magic_rover',
            'mirror_rover_orange_2',
            'moving_bridge',
            'remote_work',
            'smash_or_dash_vs2',
            'worlds_collide_alt',
        ],
        needs: 'unknown',
    },
    // Mirrors and Stones
    {
        levels: [
            'bad_aim_v2',
            'diag_slide',
            'mirror_motion',
            'multipurpose',
            'the_long_way',
            'two_bounce_v2',
            'wide_ocean',
        ],
        needs: [
            [{ level: 'reel_it_in' }],
        ],
    },
    {
        levels: [
            'coax_a_lot',
            'river_push_v4',
        ],
        needs: [
            [{ level: 'sink_together' }],
        ],
    },
    {
        levels: [
            'ricochet_v2',
            'run_the_clock_alt',
            'zig_zag',
        ],
        needs: [
            [{ level: 'cancel_out' }],
        ],
    },
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
        levels: [
            'emergency_brake',
            'place_to_stand',
            'thats_my_ride',
        ],
        needs: [
            [{ level: 'airmail' }],
        ],
    },
    {
        levels: [
            'catch_and_drop',
            'catch_and_throw',
            'first_diversions',
            'highway',
            'mirror_stone_intro',
            'short_ride_option_b',
        ],
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
    },
    {
        levels: [
            'cancel_out',
            'ditching_cargo',
            'far_river',
            'in_the_way_alt_3',
            'launch_and_collect',
            'lilyruga_simpler',
            'make_it_happen_v6',
            'new_new_new_slam',
            'reel_it_in',
            'reflect_momentum',
            'ride_together',
            'river_dictionary_alt_up',
            'river_plinko_v2_actual',
            'sidestone_zach_1',
            'sidestone_zach_2',
            'sidestone_zach_3',
            'sidestone_zach_4',
            'sink_together',
            'square_dance',
            'there_and_back',
            'unblock_block_alt',
            'wider_ocean',
        ],
        needs: 'unknown',
    },
    // Alter Beam
    {
        levels: ['gem_beam_placement'],
        needs: [
            [{ freezer: 115348084 }],
        ],
    },
    {
        levels: [
            'half_tutorial',
            'monkey_in_the_midpoint',
            'promesst2.5_deeper',
            'promesst3_streamlined',
        ],
        needs: 'unknown',
    },
    // Stones Illuminated
    {
        levels: ['crystal_rover_intro'],
        needs: [
            [{ freezer: 90203340 }],
        ],
        from: 'sky',
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
        // through the Freezer air_skating_v6 opens onto the sky platform, then a drop lands in the corridor of the level
        levels: ['first_flight'],
        needs: [
            [{ level: 'air_skating_v6' }],
        ],
        from: 'sky',
    },
    {
        levels: ['green_crystal_rover'],
        needs: [
            [{ freezer: 111152405 }],
        ],
    },
    {
        // through the Freezer air_skating_v6 opens onto the sky platform, then a drop off its west edge lands beside the level
        levels: ['orange_predicament'],
        needs: [
            [{ level: 'air_skating_v6' }],
        ],
        from: 'sky',
    },
    {
        // through the Freezer air_skating_v6 opens onto the sky platform, then a drop off it lands beside the level
        levels: ['skip_orange_maze_v3'],
        needs: [
            [{ level: 'air_skating_v6' }],
        ],
        from: 'sky',
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
        levels: [
            'orange_skip_place_v3',
            'skip_orange_wall_v3',
        ],
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
        levels: [
            'rover_advance_c_v2',
            'rover_shift_p',
        ],
        needs: [
            [
                { level: 'skipping_wrapping_v3' },
                { freezer: 90203320 },
                { freezer: 111150955 },
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
        levels: [
            'break_send_lily_c',
            'doorstop',
            'doorstop_reprise_easier',
            'faster_than_stone',
            'frantic_factory_v2',
            'glass_beach',
            'hustle_v2',
            'indirect_skip_3',
            'purple_beam_intro_v2_alt',
            'skip_orange_block_c',
            'skip_wand_v6',
            'skipping_cyan_precise_c_v3',
            'sp_crystal_tuto',
            'stonewalled',
            'submarine',
            'submarine_far_away',
            'through_way',
        ],
        needs: 'unknown',
    },
    // Charmed Stacks
    {
        levels: [
            'i_beam_v2',
            'jump_to_pillar_v3',
            'no_charm',
            'stones_below_v3',
        ],
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
        levels: ['erosion_alt'],
        needs: [
            [{ level: 'falloff_dragons' }],
        ],
    },
    {
        levels: [
            'tippy_towers_1',
            'tippy_towers_4',
        ],
        needs: [
            [{ level: 'tippy_intro' }],
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
            'bard_triangle',
            'high_shelf_v2',
        ],
        needs: 'unknown',
    },
    // Skipping and Falling
    {
        levels: ['many_falls'],
        needs: [
            [{ level: 'pool_pal_v2' }],
            [{ level: 'tiger_lily_v2' }],
        ],
    },
    {
        levels: [
            'button_shut_in',
            'on_the_rocks',
        ],
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
            'carry_lily',
            'delay_time_v2',
            'lily_falls_intro_v2',
            'pool_pal_v2',
            'removal_v2',
            'sunk_cost_2_v3',
            'tiger_lily_v2',
        ],
        needs: 'unknown',
    },
    // Heroes and Depth
    {
        levels: [
            'dragon_bridge',
            'zombie_graves_v3',
        ],
        needs: [
            [
                { level: 'gated_twice_thief_v2' },
                { sign: 115389568 },
            ],
        ],
    },
    {
        levels: [
            'druid_3d_beam',
            'sky_druid_tree_ex',
            'stopper_topper_v2',
        ],
        needs: [
            [{ level: 'sky_druid_kill_tall_2_goblins' }],
        ],
    },
    {
        levels: ['falloff_dragons'],
        needs: [
            [{ level: 'falloff_4' }],
        ],
    },
    {
        levels: [
            'connect_the_dots_v5',
            'pulling_pedestals',
            'thief_stack',
        ],
        needs: [
            [
                { level: 'gated_twice_thief_v2' },
                { level: 'zombie_graves_v3' },
                { sign: 115389568 },
            ],
        ],
    },
    {
        levels: [
            'mountain_music',
            'out_of_range_v4',
        ],
        needs: [
            [
                { level: 'jenga_shortstack_v2' },
                { level: 'tippy_intro' },
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
        levels: [
            'sky_druid_maze',
            'sky_druid_one',
            'weaklings_bard_v2',
        ],
        needs: [
            [
                { level: 'sky_druid_kill_tall_2_goblins' },
                { freezer: 111233689 },
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
        levels: [
            'priest_3d_goblin_pass',
            'priest_button_3d_revised',
        ],
        needs: [
            [{ level: 'priest_descent_simpler' }],
        ],
    },
    {
        levels: [
            'assassins_creed',
            'falloff_4',
            'falloff_intro',
            'falloff_kill_goblins_v6',
            'fire_stairs_part_2',
            'gated_twice_thief_v2',
            'gated_twice_v2',
            'loading_docks_v2',
            'magic_tower',
            'sky_druid_kill',
            'sky_druid_kill_tall_2_goblins',
        ],
        needs: 'unknown',
    },
    // Double Beam Falling
    {
        levels: ['air_skating_v6'],
        needs: [
            [{ level: 'into_the_water_3' }],
        ],
    },
    {
        levels: ['thin_ice_rooms'],
        needs: [
            [{ level: 'dragons_layer' }],
        ],
    },
    {
        levels: [
            'annoying_orange_v3',
            'double_up',
            'dragons_layer',
            'fire_from_above_2',
            'hat_maker',
            'into_the_water_3',
            'laser_stop_surprise',
            'monster_drop',
            'orange_snake',
            'side_sub_back',
            'side_sub_v2',
            'sky_double_intro0',
            'sky_double_intro1',
            'the_sky_is_falling_v2',
            'through_the_table_e',
            'through_the_table_f',
            'vertical_promesst_v2',
        ],
        needs: 'unknown',
    },
    // Elevators
    {
        // the Gem taking_the_lift frees is pushed off the plateau and across the courtyard to the east side of the 1-high pillar the level stands on; the hero rides the elevator at (28, 71) up to the z 40 platform and drops from its west edge onto the Gem, a step level with the level
        levels: ['double_the_fun'],
        needs: [
            [{ level: 'taking_the_lift' }],
        ],
    },
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
        levels: [
            'corner_trick_easier',
            'drop_sokoban',
            'its_a_tall_order',
            'landmines_v3',
            'shower',
            'taking_the_lift',
            'trick_landing',
        ],
        needs: 'unknown',
    },
    // The Mirror Way
    {
        // from the corridor north of the pad that pachinko_rescue_w frees, the downward vertical Mirror high above it throws the hero ten cells west, over the chasm_3 room, and he drops into it
        levels: ['chasm_3'],
        needs: [
            [{ level: 'pachinko_rescue_w' }],
        ],
    },
    {
        levels: [
            'flamestrike_v3',
            'volcano_v3',
        ],
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
        needs: 'unknown',
    },
    // Vertical Endpoints
    {
        levels: [
            'one_floor_down_v2',
            'suspend_directions_v2',
            'suspend_swapper_hard',
        ],
        needs: [
            [{ level: 'seeing_red' }],
        ],
    },
    {
        // the Gem landmines_v3 frees goes onto its Gem_Slot; the lights it powers open the way down to the level
        levels: ['sender_simplified_v2'],
        needs: [
            [{ level: 'landmines_v3' }],
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
        levels: ['high_endpoint_v2'],
        needs: [
            [
                { level: 'beam_jail_v3' },
                { level: 'thin_ice_rooms' },
            ],
        ],
    },
    {
        levels: ['seeing_red'],
        needs: 'unknown',
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
        levels: [
            'depositor_bard',
            'depositor_thief',
        ],
        needs: [
            [
                { level: 'catching_fire_v2' },
                { level: 'turn_control_v2' },
            ],
        ],
    },
    {
        levels: [
            'priest_water_back_goblin',
            'priest_water_back_place_v3',
            'skip_stack_2',
        ],
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
    // Stacks and Water
    {
        levels: ['personal_assistant_v3'],
        needs: [
            [{ level: '3d_intro_heroes' }],
        ],
    },
    {
        levels: ['push_down_a_lot_small'],
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
        levels: [
            'jenga_easier',
            'jenga_shortstack_v2',
            'single_out',
        ],
        needs: 'unknown',
    },
    // Goblin Turning
    {
        levels: ['goblin_below_intro_same_z'],
        needs: [
            [{ level: 'beam_sisters' }],
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
        // through the cage beam_sisters opens into the goblin_below_intro_same_z room, then south through both Freezers of its doorway, which goblin_below_intro_same_z and thin_ice_rooms open
        levels: ['pass_through_v2_same_z'],
        needs: [
            [{ level: 'beam_sisters' }],
            [{ level: 'goblin_below_intro_same_z' }],
            [{ level: 'thin_ice_rooms' }],
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
    {
        levels: [
            'beam_sisters',
            'chain_gang',
            'chain_gang3',
            'crystal_logistics',
        ],
        needs: 'unknown',
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
        levels: ['escape_bridge'],
        needs: [
            [
                { level: 'all_out_goblin_war' },
                { level: 'bridgey2' },
            ],
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
            [{ level: 'vert_mirror_intro' }],
            [{ level: 'portable_stairs' }],
        ],
    },
    {
        // the vertical Mirror portable_stairs frees is pushed west along the south ledge, and its lift carries the hero onto the tower top row, west of the fences, where implausible_bridge stands
        levels: ['implausible_bridge'],
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
        levels: ['wolf_boat_carry'],
        needs: [
            [{ level: 'bridgey2b' }],
            [{ level: 'goblin_parity_3d' }],
        ],
    },
    {
        levels: [
            'all_out_goblin_war',
            'bottom_adjust',
            'bottom_bridge_tall',
            'bridgey',
            'bridgey2',
            'bridgey2b',
            'bridgey3_abstract_art',
            'catching_up_v2',
            'implausible_bridge_2',
            'juggle',
            'new_way_mirror_later',
            'overwrite',
            'quick_redirect_v5',
            'tall_stack',
            'tandem',
            'to_kill_a_goblin',
            'vert_mirror_intro',
        ],
        needs: 'unknown',
    },
    // Protection and Support
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
        levels: ['monster_stack'],
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
        levels: [
            'catching_fire_v2',
            'fire_stairs_v2',
            'frame_advance_v5',
            'priest_3d_intro_dragon_v4',
            'priest_bottom_v2',
            'priest_two_warriors_v3',
            'stuck_up_v2',
        ],
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
        needs: 'unknown',
    },
    // Bard and Water
    {
        levels: [
            'drop_off',
            'front_side_bus3',
        ],
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
        // the Rocks in the Freezers bard_movable_island2 opens, with the room's own, fill the water east of the floor block west of missile_command, and the hero crosses them
        levels: ['missile_command'],
        needs: [
            [{ level: 'bard_movable_island2' }],
        ],
    },
    {
        levels: [
            'boat_priest_v3',
            'rowboat_wizard_v2',
        ],
        needs: [
            [{ level: 'bard_stack_intro' }],
        ],
    },
    {
        levels: ['ice_climbers'],
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
        levels: ['goblin_two_rovers_alt'],
        needs: [
            [
                { level: 'open_monster' },
                { level: 'thief_dragger_v2' },
            ],
        ],
    },
    {
        levels: [
            'bard_movable_island',
            'bard_movable_island2',
            'limited_offsets',
            'pole_vault',
            'rowboat',
        ],
        needs: 'unknown',
    },
    // Crystal Carts
    {
        levels: ['mirror_crystal_rover'],
        needs: [
            [{ level: 'mirror_rover_orange_2' }],
        ],
    },
    {
        levels: [
            'quadruple_skip',
            'triple_skip',
        ],
        needs: [
            [{ level: 'crystal_rover_bridge' }],
        ],
    },
    {
        levels: [
            'crystal_rover_bridge',
            'crystal_rover_rush',
            'endpoint_maze',
            'endpoint_wrap_druid_alt',
            'perch_3_rovers',
        ],
        needs: 'unknown',
    },
    // Doubling Beams
    {
        // the ride of the Lily on the wrapping river, as for far_wings
        levels: ['duality_2'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: [
            '3wcn_purple_mirror_skip',
            'duality_condensed',
            'half_journey_vh',
            'lazy_susan_v2',
            'magnitudes_v3',
            'orange_mirror_walk_button',
            'orange_water_button_vdouble_v2',
            'orange_water_button_vfour_alter',
            'orange_water_button_vslow',
        ],
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
        levels: [
            'ortho',
            'ortho2',
            'ortho3',
        ],
        needs: [
            [
                { level: 'lily_switch_p' },
                { level: 'skybridge' },
            ],
        ],
    },
    {
        levels: [
            'defender',
            'drop_operation_v3',
            'endpoint_holder3',
            'endpoint_holder4',
            'hover_corner_3',
            'hover_corner_4',
            'juggalos',
            'mobile_cover_2',
            'retvrn0',
            'skip_purple_drop_alt',
            'stone_rescue_v3',
            'tricky_endpoint',
            'wrap_music',
            'wrap_music_2',
        ],
        needs: 'unknown',
    },
    // Exit Low
    {
        levels: [
            'design_corner',
            'design_fts',
            'make_oneway',
            'make_shoreline',
            'make_sokoban',
            'make_thief_goblin_maze_v2',
        ],
        needs: [
            [{ level: 'end3_skipping_red' }],
            [{ level: 'end3_mirror_2_alt2' }],
            [{ level: 'end3_heroes_1' }],
            [{ level: 'end3_promesst_red' }],
        ],
    },
    {
        levels: [
            'end2_clone_divergence',
            'end2_clone_divergence_2',
            'fix_exploit',
            'fix_exploit_promesst_overworld',
            'river_exploit_v2',
            'wizard_jailbreak_v2',
        ],
        needs: [
            [{ level: 'design_fts' }],
            [{ level: 'make_thief_goblin_maze_v2' }],
            [{ level: 'make_oneway' }],
        ],
    },
    {
        levels: [
            'simplify_skipping',
            'simplify_wizard',
        ],
        needs: [
            [{ level: 'end2_clone_divergence_2' }],
        ],
    },
    {
        levels: [
            'end2_mirror1',
            'end2_mirror_4_islands_v2',
            'end3_denoise_pool',
            'end3_redundant_beams',
        ],
        needs: [
            [{ level: 'simplify_skipping' }],
        ],
    },
    {
        levels: [
            'end3_off_topic_alt',
            'end3_off_topic_heroes',
            'end3_off_topic_mirror',
            'end3_reorder_mirror',
            'end3_reorder_skipping_fix',
        ],
        needs: [
            [{ level: 'end2_mirror_4_islands_v2' }],
        ],
    },
    {
        levels: [
            'environment_art_background',
            'environment_art_grid',
            'environment_art_objects',
        ],
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
        levels: [
            'allocate_heroes_end3',
            'best_beam_colors',
            'end3_heroes_1',
            'end3_mirror_1_v3',
            'end3_mirror_2_alt2',
            'end3_promesst_red',
            'end3_skipping_1',
            'end3_skipping_red',
            'rotating_cavalry_spaced',
        ],
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
        needs: [
            [{ level: 'torus_mirrors' }],
        ],
    },
    {
        // by standing in a dragon fire that Mirrors carried by monsters reflect: the monsters turn toward the hero and turn their Mirrors with them
        levels: ['far_cl_no_walls_pit'],
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
            'three_artifacts_v3',
        ],
        needs: 'unknown',
    },
    // Mirrors and Rivers
    {
        // past raft_corners_alt_3, a Rock and a skipping stone pushed into the water let the hero cross on a Lily, a stone on another Lily shielding it from the Dragon's fire, to the room of raft_corners_2_small and raft_corners_4x4
        levels: ['raft_corners_2_small'],
        needs: [
            [{ level: 'raft_corners_alt_3' }],
        ],
    },
    {
        levels: [
            'in_a_flash_alt',
            'in_a_flash_alt_back',
            'mirror_180',
            'mirror_flip_donut',
            'mirror_u',
            'raft_corners_4x4',
            'raft_corners_alt_3',
            'reroute_3',
            'river_maze_clear_tenacious_race_v2',
            'river_rates_button',
            'river_rates_jagged',
            'water_bender_v3',
        ],
        needs: 'unknown',
    },
    // Mirrors as Obstacles
    {
        levels: [
            'busy_beaver',
            'hanoi_3',
            'moving_through_mirrors_v3',
        ],
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
    // Moving the Flat Things
    {
        levels: [
            'frontier',
            'zap_bridge',
            'zap_bridge_perp',
        ],
        needs: [
            [
                { level: 'lily_switch_p' },
                { level: 'skybridge' },
            ],
        ],
    },
    {
        // the ride of the Lily on the wrapping river, as for far_wings
        levels: [
            'infinite_looping_skipper_mirrored_ikaruga_alt',
            'swapwiz_harder',
        ],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: ['sombreros'],
        needs: [
            [{ level: 'lily_switch_p' }],
        ],
    },
    {
        levels: [
            'gem_slot_on_lily',
            'infinite_looping_skipper0_alt',
            'infinite_looping_skipper_alt',
            'infinite_looping_skipper_far',
            'lily_switch_p',
            'movable_button',
            'movable_buttons',
            'skybridge',
        ],
        needs: 'unknown',
    },
    // Partial Resets
    {
        levels: [
            'fall_reset_v2',
            'monster_spawn',
        ],
        needs: [
            [{ level: 'treadmill' }],
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
        levels: ['wrong_reset'],
        needs: [
            [{ level: 'reset_mirror' }],
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
            'reset_mirror',
            'treadmill',
        ],
        needs: [
            [{ level: 'easy_reset_small' }],
        ],
    },
    // Endless Skipping
    {
        // the Rock the Freezer wrap_music opens is pushed onto the Activator that respawns the Lily beside the wrapping river; the hero pushes the Lily into the river and rides it
        levels: ['far_wings'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        // the ride of the Lily on the wrapping river, as for far_wings
        levels: ['sick_270_small'],
        needs: [
            [{ level: 'wrap_music' }],
        ],
    },
    {
        levels: [
            'after_wings',
            'before_wings',
            'layered_alt',
            'yars_revenge_setup_v3',
        ],
        needs: 'unknown',
    },
    // Beam Computation
    {
        levels: [
            'zachtronics_or',
            'zachtronics_xor',
        ],
        needs: [
            [{ level: 'zachtronics_identity' }],
        ],
    },
    {
        levels: [
            'zachtronics',
            'zachtronics_identity',
        ],
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
        levels: [
            'double_trouble',
            'worlds_collide_ps',
        ],
        needs: 'unknown',
    },
    // Heroes 3: Bard, Druid
    {
        levels: [
            'druid_and_dragon',
            'heroes3_10',
            'heroes3_11_v2',
            'heroes3_13_v2',
            'heroes3_15_v4',
            'heroes3_1_v3',
            'heroes3_2_v4',
            'heroes3_3_v2',
            'heroes3_4',
            'heroes3_5',
            'heroes3_6_v3',
            'heroes3_7_v4',
            'heroes3_8_thief',
            'heroes3_8_v3_alt3',
            'heroes3_8_v4_alt',
            'heroes3_druid_a',
            'heroes3_druid_b_v2',
            'wizard_and_druid_alt',
            'wizard_and_druid_alt_5',
        ],
        needs: [
            [
                { level: 'compactor_v2' },
                { level: 'dragon_on_the_wall' },
                { level: 'heroes2_22_v2' },
                { level: 'multipush_for_me2' },
                { level: 'side_kick' },
                { level: 'side_slide_intro_v2' },
                { sign: 111245225 },
            ],
        ],
    },
    {
        levels: [
            'compactor_v2',
            'gatekeeping_v3',
            'heroes3_14_v3',
            'heroes3_16_v4_alt',
            'heroes3_21_condensed',
        ],
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
        levels: [
            'cyan_counter_med3',
            'floating_orange_purple',
            'green_metamirror',
            'meta_orange_purple',
            'meta_orange_purple_2',
            'orange_floaty_reflect_v3',
            'the_spiral',
            'top_green_purple_v3',
        ],
        needs: 'unknown',
    },
    // Squeeze, Dragon
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
        levels: [
            'close_circuit',
            'double_door',
            'dragon_drag',
            'endpoint1_skipping',
            'free_ride',
            'narrow_passage',
            'ocean_blue',
            'rsmash',
            'swap_seats',
        ],
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
        levels: [
            'rotator',
            'spin_doctors_v3',
            'spin_heroes',
            'spray_and_pray',
        ],
        needs: 'unknown',
    },
    // Crossroads High
    {
        // the first levels on arrival: the ruby lift is built from the Freezers of rank 1
        levels: [
            '3d_intro_vanilla',
            'carry_simplified',
            'push_down_v2',
            'sister_staircase_harder',
        ],
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
    {
        levels: [
            'goblin_parity_3d',
            'mirror_carry_duo',
            'omnimirror_v2',
        ],
        needs: [
            [{ level: 'hat_tricks_0_v3' }],
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
            'under_pressure',
        ],
        needs: [
            [{ level: 'buff_explorer' }],
        ],
    },
    {
        levels: [
            'floorhands_v5',
            'stay_lit',
        ],
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
        levels: ['high_horse'],
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
        levels: [
            'lily_pull',
            'retro',
            'retro_hooks',
        ],
        needs: 'unknown',
    },
    // Mirror Falling
    {
        levels: [
            'blind_spot_v2',
            'falling_blocker_v3',
            'make_a_right',
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
        levels: [
            'learn_to_catch_v2',
            'trust_falls',
        ],
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
    {
        levels: [
            'cliff_hopping',
            'long_platform_v2',
            'pillars',
            'trader_descend',
        ],
        needs: 'unknown',
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
            'do_not_want',
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
        // on foot from the hub elevator through the cages of gem_trap2 and get_through_alt
        levels: ['negative_space'],
        needs: [
            [{ level: 'push_down_chain' }],
            [{ level: 'gem_trap2' }],
            [{ level: 'get_through_alt' }],
        ],
    },
    {
        levels: [
            'gem_trap',
            'gem_trap2',
            'numberlink_alt',
        ],
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
        levels: [
            'no_murder_weapon_0',
            'no_murder_weapon_wizard',
        ],
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
        // the Freezers of both levels open the way through the room to the corridor north of it, and the hero steps down from the corridor into the level
        levels: ['green_goblins'],
        needs: [
            [{ level: 'dragonsweeper' }],
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
        needs: 'unknown',
    },
    // Wrapping Wizard
    {
        levels: [
            'torus_bard',
            'wasteland',
        ],
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
        levels: [
            'battle_royale_v2',
            'monster_promesst_v3',
            'open_monster',
        ],
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
