# Progression

The game's progression rules: Level_Entry unlocking (Freezers, Signs, towers), the campaign status fields, achievements
and ranks, the endings, campaigns and level sets, the in-game progress displays, treasures and gold rooms, and the
overworld level data.

## Level_Entry unlocking and state

- Entered: `enabled_t_target = 1` once `level_states` has any entry for `level_name` (flags 0 counts). An entry is added whenever that level is loaded.
- Solved: `level_states[level_name] & SOLVED (1)` sets `solved_t_target = 1`. SOLVED is set on victory for the current level's name.
- PARTIALLY_SOLVED (2): set when the hero activates an `Overworld_Unlock` in that level.
- ENTERED (4) is never set. TOWER_UNLOCK_SIGNALLED (8): set once a solved tower level's "tower is about to unlock" cue has played.
- The unlock pass runs only on Level_Entries with `enabled_t_target == 0`. With `unlocked_by_id` or `unlocked_by_id2` set the gate uses all three ids. With both 0 only `unlocked_by_id3` is used. With all three 0 the entry is skipped.
- Gate: `unlock_is_or_gate` true = any nonzero id satisfied; false = all nonzero ids satisfied.
- Unlocking is not saved. It is recomputed from the other state at every overworld load and after each change.
- An unlocker id resolves in the same level file:
    - **Level_Entry**: satisfied if SOLVED. A PARTIALLY_SOLVED unlocker does not count (`partial_solve_count` is −1 for Level_Entry gates; see Freezer).
    - **Sign**: satisfied if `rank_satisfied`, which only reading the Sign sets ([Sign `rank_satisfied`](#sign-rank_satisfied)); a Sign with no rank, tower or gold-room setting counts as satisfied.
    - **Teleporter**: if `discovered`.
    - **Marker** named `intro_end1_freezer_thaw` (its `float_parameter` is set to the campaign rank while a hero is inside its box; satisfied at rank 1 or more; the same branch re-checks the Signs `intro_end2_sign` and `intro_end3_sign` against the rank) or with script `end3_exploit_level_freezer_thaw` (`boolean_argument`).
    - **Judge**: only for Freezers.
    - Any other type is never satisfied.
- `tower_flags` assigns the level to the Tower whose `tower_flags` is exactly equal; it does not gate the entry.
- `dropdown`: a tower level that is optional for the tower. Counted in `total/solved_dropdown_levels`, not in `levels_required`. All dropdowns solved = the tower's gold status.
- `achievement`: when a SOLVED entry's state is applied (on the overworld load after the win), the achievement is granted and the rank raised ([Achievements and ranks](#achievements-and-ranks)).
- `currently_broken` or `currently_disfavored`: the entry is destroyed at every level load. Drop it from all counts.
- `demo_phase`, `*choice_demoN`, `context_type` and `context_details` are read by no game code.

### Freezer

- Evaluated while `unfrozen == 0`, with `unlocked_by_id`..`id4` and `unlock_is_or_gate` and the same gate rule.
- If `partial_solve_count` is not −1, a Level_Entry unlocker also counts when its level is PARTIALLY_SOLVED.
- Judge unlocker: `Judge.state_int0 ≥ Freezer.judge_unlock_level`. On load the first Judge is compared with every freezer that has `judge_unlock_level ≠ 0`.
- On opening, and only if `judge_unlock_level == 0`, the freezer Pid goes into Status opened list A (overworld) or B (any other level) and is reopened from the lists on load.

### Sign `rank_satisfied`

A Sign is read when a hero stands in the cell next to it and faces it, with no closed Freezer in the Sign's own cell
and no Fence between the two cells. Reading tests the Sign's setting once. If it holds, `rank_satisfied` is set (it
stays set) and the unlock pass reruns. Nothing else tests the setting, so a rank, tower or gold-room count reached
while the Sign is unread opens nothing until a hero reads it.

| Sign setup                                                                                      | Satisfied when read and                                                         |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `unlock_freezers_with_rank` = r (`Character_Rank`)                                              | r == 0xFF (255, satisfied on the first read) or r ≤ Status rank                 |
| `tower_id` ≠ 0                                                                                  | that Tower has `activated`                                                      |
| `gold_room_connection_unlocker` (only on Signs without `tower_id`; with one, the tower decides) | at least 4 Teleporters on the overworld have `gold_room_endpoint && discovered` |
| none of the three (a status Sign)                                                               | never set; a Freezer that lists such a Sign counts it as met                    |

Only the `intro` level sets the flag without a read: the Signs `intro_end2_sign` and `intro_end3_sign` follow the rank
([Level_Entry unlocking and state](#level_entry-unlocking-and-state)).

### Tower

- `solved_normal_levels` counts Level_Entries with `tower_flags == Tower.tower_flags` and `dropdown == false` whose Status flags have SOLVED. Dropdowns are counted separately.
- The tower activates when `solved_normal_levels ≥ levels_required`. It enables its `teleporter_id` Teleporter (which makes that pad's Groups exist, [Teleporter pads and fast travel](movement.md#teleporter-pads-and-fast-travel)) and grants an achievement from `tower_flags`: ground pair → TOWER_xx; UPSTAIRS (16) + one letter → TOWER_x_SKY; DOWNSTAIRS (32) + pair → TOWER_xx_UNDERWORLD.
- Tower id bits: H 1, M 2, S 4, P 8 (`Tower_Flags` HEROES, MIRRORS, SKIPPING, PROMESST); a pair adds its bits (HM 3, SP 12).

## Status.sokoban_status fields

In file order. The names are labels: the game has none. Byte layout and versions: [Status.sokoban_status (campaign status)](saves.md#statussokoban_status-campaign-status).

| File position | Name                                                                                                                                                                                                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| s64 × 2       | last_saved                                                                                                                                                                                                                                                                                                     |
| u8            | **rank** (`Character_Rank`): 0 Visitor, 1 Egressant, 2 Pusher, 3 Arranger, 4 Intrepid, 5 Sokoban ([Achievements and ranks](#achievements-and-ranks))                                                                                                                                                           |
| s64 × 2       | play_time                                                                                                                                                                                                                                                                                                      |
| s64           | achievements: bit n = `Achievement` n; bit 0 set whenever any is granted                                                                                                                                                                                                                                       |
| u32           | **treasure_flags** ([Treasures and gold rooms](#treasures-and-gold-rooms))                                                                                                                                                                                                                                     |
| u32 × 10      | counters, written and never read: gems taken with T ([TRANSMUTE and the other skills](skills.md#transmute-and-the-other-skills)); gems dropped onto a Gem_Slot; Artifacts picked up; unused; Friendly_Dragon toggles; P1 wand uses; torc beam turns; prism uses; enabled Level_Entry entries; ACTIVATE actions |
| s64           | **artifacts**: bit 1 << `Artifact.kind` for kinds 3-6, set on pickup. Kinds 0-2 (PROMESST_1/2/3_WAND) set `Guy.inventory_flags` instead (WAND 0x400, TORC 0x800, PRISM 0x1000). No level holds kind ≥ 3, so it is always 0                                                                                     |
| u32           | **current_area_pin** ([Areas](state.md#areas)): 0 in every non-overworld level                                                                                                                                                                                                                                 |
| s32           | **levels_solved**: overworld Level_Entries with `solved_t_target ≠ 0`. Shown as "% solved" in the campaign list; > 0 enables time control                                                                                                                                                                      |
| s32 × 2       | **tower_levels_solved** (the same, with `tower_flags ≠ 0`), **towers_activated**                                                                                                                                                                                                                               |
| u8 × 2        | show-area-names toggle (UI only); overworld_reached (after a win: back to the overworld instead of advancing in the level set)                                                                                                                                                                                 |
| str16 × 2     | current level; menu-background level                                                                                                                                                                                                                                                                           |
| table         | level_states (n × str16 level, u8 flags)                                                                                                                                                                                                                                                                       |
| table         | string table (legacy, unused)                                                                                                                                                                                                                                                                                  |
| list × 2      | **pid list A** = opened Freezers on the overworld; **pid list B** = opened Freezers in other levels                                                                                                                                                                                                            |

## Achievements and ranks

| Achievement                                                           | Condition                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TOWER_* (16)                                                          | that tower activates                                                                                                                                                                                                                            |
| ASCEND / DESCEND                                                      | the hero touches a `grant_rank` Marker with `float_parameter` 2 / 4: the sky hub (83, 72, 33) or the underworld hub (80, 69, −21), the bottom Stairs cell of the hub elevator. Also raises the rank to at least 2 / 4. Either order is accepted |
| COMPLETIONIST                                                         | on the overworld, **every** Level_Entry present has `solved_t_target ≠ 0`, dropdowns, tower levels and sky/underworld entries included. Entries in other levels don't count                                                                     |
| the other 13 (GOLD_*, ENDGAME1-3, HEROES, MIRRORS, SKIPPING, PROMISE) | granted from `Level_Entry.achievement` on the entry whose level is solved ([Overworld level data](#overworld-level-data)). ENDGAME1/2/3 also raise the rank to 1/3/5                                                                            |
| Sync                                                                  | each overworld load re-derives the bits from solved carriers and activated towers, then re-sends every set bit to Steam                                                                                                                         |

32 achievements = 13 carriers + 16 TOWER_* + ASCEND, DESCEND, COMPLETIONIST. The game unlocks a Steam achievement by
its `Achievement` value name, which is the Steam API name, and Steam's bit is the value − 1. GOLD_* is granted for
solving that pair's worlds_collide level.

**Rank.** It only rises: each source sets rank = max(rank, N). ENDGAME1 → 1, ASCEND → 2, ENDGAME2 → 3, DESCEND → 4,
ENDGAME3 → 5. Order is not enforced. A rise requests a campaign save. The rank is copied into the campaign list entry
(titles `rank_visitor`..`rank_sokoban`).

Rank Signs exist only for 1, 3 and 5. A rank opens nothing by itself: each Sign opens its Freezers when a hero reads it
at that rank or higher ([Sign `rank_satisfied`](#sign-rank_satisfied)).

| Rank | Effect                                                                                                                                                                                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ≥ 1  | the `sign_endgame_ground_star` Signs open the ground Freezers (25, 65), (72, 114), (72, 115), (81, 18), (130, 69), and (−15, 134) in front of the `~end1` Door. Bark Markers with `bark_flags` ONLY_BEFORE_END1 (8) stop playing |
| ≥ 3  | the `sign_endgame_sky` Signs open the gates (67, 13, 19), (106, 51, 33), (70, 73, 34), (33, 76, 35), (75, 91, 35) in the sky, and (−9, 134, 0) in front of the `~end2` Door                                                      |
| 5    | the `sign_endgame_underworld` Signs open (137, 134, −21) in the underworld and (−21, 134, 0) in front of the `~end3` Door                                                                                                        |

In `intro`, the `intro_end1_freezer_thaw` box and the Signs `intro_end2_sign` / `intro_end3_sign` follow the rank.
`end3_promesst_red` and `end3_skipping_red` each have a rank-1 Sign.

**100 %** = COMPLETIONIST = SOLVED for every overworld Level_Entry. "Required" for tower progress = non-dropdown
entries with the tower's `tower_flags`, up to `levels_required`.

## Endings

Three endings, one per ENDGAME achievement: Endgame (ENDGAME1, rank 1), Second Endgame (ENDGAME2, rank 3) and Final
Endgame (ENDGAME3, rank 5). Each ends at a ground Door south of the antipode hubs: `~end1` (−15, 134, 0), `~end2`
(−9, 134, 0), `~end3` (−21, 134, 0). Each Door stands behind a Freezer on a rank Sign (1, 3, 5) and leads to `intro`
at the matching `~endN` Marker.

The antipode hubs stand at (−15, 147): the ground hub at z 0, the sky hub at z 37, the underworld hub at z −21.
Nothing else gates the endings. Low towers open no Freezer: their Signs are status signs.

### Endgame

1. Activate 4 of the ground towers. Each needs N of its normal levels (`levels_required`): HM 8, HS 7, MS 7, HP 10,
   MP 6, SP 6.
2. Step on each active tower's MINOR pad (`teleporter_id`). It sends the hero to the tower's `gold_room_endpoint` pad
   in the ground hub and so discovers that gold room ([Treasures and gold rooms](#treasures-and-gold-rooms)).
3. `end1` stands in the ground hub at (−15, 147, 0), inside Freezers on the `gold_room_connection_unlocker` Sign
   (−19, 147, 0). Once 4 gold rooms are discovered, reading the Sign opens them.
4. Win `end1`. The win returns the hero to `~end1` (−15, 138, 0) on the overworld. At rank 1 reading the rank-1 Sign
   (−15, 138) opens the Freezer (−15, 134); the Door leads to `intro`.

`end1` is a Judge level (Judge code `end1`). The Judge's stage is `state_int0`; a Freezer with `judge_unlock_level` n
opens when the stage is at least n ([Freezer](#freezer)). Stage 0 → 1 when the opening story ends.

- Four `~controller` END1 Switches: H (27, 22, 4), M (30, 19, 4), S (27, 16, 4), P (24, 19, 4). They ignore Guys, so
  only things in their cells press them. The Judge builds a mask from the pressed ones.
- Stage N asks for the N-switch combinations not won yet: stage 1 the singles, stage 2 the 6 pairs, stage 3 the 4
  triples, stage 4 HMSP. The Judge is satisfied when the mask holds N Switches and is one of them.
- Groups `^X` exist while X is pressed; Groups `*XY…` exist while the mask is exactly that set. They are the z 0 puzzle
  rooms, each with an exit Door. Winning a room sets its combination's bit in the level's own state. When a stage's
  list is done the stage goes up by one and the bits clear.
- Freezers at levels 1–4 stand at (24, 22), (30, 22), (30, 16) and (24, 16), each holding a Rock. Level 5 (23, 15) is
  the END1_EXIT Door to overworld `~end1`; a hero on it wins the level at once.

### Second Endgame

1. Reach the sky by the ruby lift in the crossroads column (84, 73). Its pieces wait in rank-1 Freezers: the light
   `ruby_beamcaster`, its gem, three switch rocks and `upstairs_mirror`
   ([Routes that need these mechanics](movement.md#routes-that-need-these-mechanics)). The ride lands on the ASCEND
   Marker.
2. Activate the four sky towers (H 12, M 6, S 6, P 10 normal levels). Their pads are the MAJOR pads of the sky hub
   (z 37 and 38). Activation enables no map-room twin: a twin is enabled when its hub pad is first stepped on, so the
   first visit to the hub is on foot, by The Heroic Way (`area_s_heroes_way`) from the east of `catching_fire_v2`
   (55, 123, 54), through the Freezer (55, 120, 54) that `catching_fire_v2` opens.
3. The four Freezers (−15, 144, 37), (−23, 147, 37), (−13, 152, 37) and (−9, 146, 38) each open with one sky tower.
   They ring the hub elevator (−15, 147, 38) → (−15, 147, 47). The hub's four tower pads stand in four separate
   pockets on foot, each by its tower's Sign; the sky has one Way area per tower kind (The Heroic Way, The Mirror Way,
   The Skipping Way, The Beam Way). A tower's Sign is read from its quarter: south for High Heroes, west for High
   Mirrors, north for High Skipping Stones, east for High Beamcasters. The levels each Way passes are the viewer's pad
   routes ([Level needs and pad routes](viewer.md#level-needs-and-pad-routes)).
4. The elevator's top opens onto the end2 room (z 44). There `laser_pointer` needs 11 levels: `allocate_heroes_v2` →
   `end2_heroes_1_2` → `end2_heroes_1_5`; `end2_mirror_3` → `mirror_prelude_v2_fix` → `peak_toggle`;
   `place_slot_4x4_pushstyle` → `color_picker` → `place_promesst_rooms`; `stack_prelude_pushstyle`. It opens the Freezer
   (0, 149, 46), which holds a Rover carrying a magic Mirror (0, 149, 47).
5. Go up to the z 47 deck and `all_together_now` (−9, 134, 47). The deck is fence floors (Group `end2_upper`) in
   separate parts:
    - West: the Stairs top (−15, 147, 47). On foot from there the hero reaches West and the z 44 room only.
    - A: the room (−13..−8, 133..135) with `all_together_now` (−9, 134) and its exit gate (−9, 132).
    - B1: (−7, 142..145) and row 145 to (−1, 146). B2: (−7, 149..152).
    - The corner cup (−7, 141, 46) is fenced on all four sides; the air cell above it is the only corner joining A and
      B1, and a hero stepping in falls into the cup and is trapped.
    - The vertical magic Mirror (−10, 143, 44), θ 180, in the `chart_a_course` Freezer, pushed east 3 times along
      row 143 to (−7, 143) and activated from (−10, 143, 44), lands its beam on the floor Fence (−7, 143, 47) in B1.
6. Win `all_together_now`. It opens its exit gate (−9, 132, 47). From there the hero drops to the rank-3 gate
   (−9, 134, 0) and the `~end2` Door.

### Final Endgame

1. Rank 3 or more.
2. Reach the underworld. DESCEND's Marker (80, 69, −21) is the hub elevator's bottom Stairs cell. Its pocket holds
   only `push_down_chain`, and its Freezers, (80, 66), (77, 69), (80, 72) and (83, 69), all need `push_down_chain`. It
   is entered by its pad (80, 68, −21), or by riding down from the sky once the elevator's stack is cleared from the
   top ([Elevators](movement.md#elevators)). The pad's map-room twin (62, 119, 78) starts disabled, and only the twins
   of underworld pads enable it. No walk, elevator or MINOR pad enters an underworld cell from the ground.
3. The underworld hub (−15, 147, −21) holds the Low towers and `4wc` levels. On foot it is a sealed pocket. Its ways
   in:
    - Its MAJOR pad (−11, 147, −21), from the twin (38, 138, 78), which starts disabled. The twin (42, 132, 78) of the
      end3 pad (4, 121, −24) enables it by `also_discover`, so stepping on the end3 pad opens fast travel to the hub.
    - Minor pad pairs, one per Low tower, between the underworld crossroads (67..86, 64..79, −20) and the hub.
      Discovering a hub-side pad (the tower's `teleporter_id`) enables its crossroads twin.
4. End3 room 1 (heroes) is reached only from the hub, down a one-way chute at x −15 from (−15, 146, −21) to the hall
   at (−15, 141, −24). The chute starts behind the Gate (−15, 147, −21), a Promesst glyph gate of flavor 9 with no
   Switch. Its only opener is an OPEN bump ([Gates, switches and buttons](movement.md#gates-switches-and-buttons)).
5. The end3 rooms (x −22..30, y 103..139, z −24; to players Exit Low) hold the whole `endgame3` set, in eight rooms
   as one chain. Between rooms stand Freezers and switch Gates whose Switches sit in floor pits at z −25 and −26; each
   pit pad at z −25 targets the next room's Marker. The order is the viewer's walk, with each pit's Switch taken as
   pressable once the hero is in the pit:
    1. heroes (x 2–6, y 130–134), exit (10, 136). Its levels hang from one root, `allocate_heroes_end3` (4, 134),
       which stands in the switch Gate (4, 134), flavor 33332. Its Switch (−4, 132, −25) is in the west pit, so the
       west pit comes before any level of room 1, and the east pit (Switch (12, 131), flavor 33331) after. A pit is
       entered by falling onto its pad (−2, 135) or (10, 135), which a fall doesn't fire
       ([Teleporter pads and fast travel](movement.md#teleporter-pads-and-fast-travel)). The east pit waits for room 1's
       4 levels (`end3_skipping_red`, `end3_mirror_2_alt2`, `end3_heroes_1`, `end3_promesst_red`), since the exit
       Freezer stands in its only way in;
    2. design, exit (30, 134);
    3. exploit, exit (26, 119);
    4. simplify, exit (23, 109);
    5. mirror, exit (29, 109). Its first level stands in the switch Gate (24, 109), flavor 33337, whose Switch
       (25, 103, −25) is in the pit under room 4's exit;
    6. off-topic and reorder, exit (8, 103);
    7. environment art;
    8. pipeline: `end3_pipeline_aesthetics` opens the `disappear_to_nothing` gates (−16..−14, 127) and (−11, 129).
       Each room's exit stands in a Freezer that needs the room's levels.
6. Win `end3_pipeline_aesthetics` and take the elevator (−21, 132, −24) → (−21, 132, 0). It arrives in the ground
   alcove of the `~end3` Door, which nothing else reaches. Rank 5 opens the gate (−21, 134).

### In `intro`

`intro` is also the opening level (`start_sign_keyboard` at (45, 83)).

- Arrival Markers, Group `entryway`: `~end1` (45, 50, 2), `~end2` (50, 50, 2), `~end3` (40, 50, 2). Arrival runs the
  Wardrobe door-in reset ([Campaigns and level sets](#campaigns-and-level-sets)).
- Each arrival room (x 44–46 for `~end1`, 49–51 for `~end2`, 39–41 for `~end3`; y 49–51, z 2) is closed by its own
  Freezer at y 52: `intro_end1_freezer` (45, 52, 2) at rank 1, `intro_end2_freezer` (50, 52, 2) on a rank-3 Sign
  (50, 48, 2), `intro_end3_freezer` (40, 52, 2) on a rank-5 Sign (40, 48, 2). The rooms join only through those
  Freezers, in the hall at rows 53–54.
- Stairs (44, 48) and (46, 48) go from z 2 to z 0. Their four Freezers, at the stair bottoms, open at rank 1 or more
  while a hero is inside the touch box of the Marker `intro_end1_freezer_thaw` (centre (45, 49.7, 3), extents
  2.5 × 2.1 × 1.55), which holds the `~end1` arrival cell. At z 0 the opening hallway runs south to the start
  (45, −20, 0); column 38 leads north to the cross hub (z 2, x 22–48, y 63–76).
- The Door (45, 47, 0) to `overworld:start` stands in a Freezer whose Sign has `unlock_freezers_with_rank` 255, so it
  is open from the start. Every arrival can leave by it.
- The INTRO_FINAL_EXIT Door (45, −21, 10), Group `exit`, is reached by the Stairs (57, 0, 2) → (57, 0, 10), from the
  credits rooms (z 2, x 50–92, y 0–7; rank-5 Freezers (59, 0, 2) and (63, 6, 2)). They hold the Signs of Group
  `full_game_only`, the `credits` Markers and the post-credits Level_Entries. A hero on the Door starts a fade; after
  5.0 s the game quits without writing Status ([Files and versions](saves.md#files-and-versions)).

### No "finished" flag

- Status keeps no game-finished flag. The record is the ENDGAME1/2/3 bits and the rank: 5 (Sokoban) means all three
  endings. The rank only rises, so the Door gates stay open and an ending can be replayed.
- The next start loads the saved current level: the overworld after leaving `intro` by its Door, `intro` after
  quitting there, by the exit Door too ([Campaigns and level sets](#campaigns-and-level-sets)).

## Campaigns and level sets

- A campaign is a save subfolder holding Status.sokoban_status. All campaigns play the same game.
- The first campaign folder is the localized `campaign_name_default` (`default` if the name is empty when saving). "Start a New Campaign" names the folder from random localized words `campaign_name_h_*` + `m_*` + `s_*` + `p_*`. At startup the most recent campaign is loaded.
- A level set (`.level_set`) is an ordered level list. `*choice` after level i: after a win at i return to the overworld (`OVERWORLD_DUE_TO_CHOICE`). `*worlds_collide` = mode 2. Otherwise the game advances to the next level of the set.
- The active set is chosen by level name: the set holding the level, preferring sets that are not `drafts*`/`tests*`/`render_tests*`/`gyms*`/`unplaced_levels`, and skipping `design_illustrations` once the overworld is reached. `Door.switch_to_level_set` switches by set name.
- On campaign load the game goes to the `overworld` set (if allowed), else to the saved current level. A campaign saved in `intro` after the overworld was reached loads into `intro`.
- Status `current level` keeps naming a level after the player leaves it, until Status is saved again.
- Teleporting the hero to a link Marker in the INTRO level runs every Wardrobe's door-in reset on the hero ([Wardrobes](skills.md#wardrobes)). Overworld pads don't.

## In-game progress displays

| Display                                                                             | Computation                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Campaign list "% solved" + play time + date                                         | `levels_solved`                                                                                                                                                                |
| Tower status sign (`Sign.display_hook` TOWER_STATUS)                                | star: `solved_normal_levels ≥ levels_required`; gold: `solved_dropdown_levels == total_dropdown_levels`, independent of activation (a tower without dropdowns is gold at once) |
| `END1_STATUS` (the `gold_room_connection_unlocker` sign in the ground antipode hub) | the discovered gold-room endpoints, star at 4 or more                                                                                                                          |
| `END2_STATUS`, `END3_STATUS`                                                        | draw nothing extra; no Sign uses them                                                                                                                                          |
| Area_Pin                                                                            | `activated` on contact ([Areas](state.md#areas)); entity state, not in Status                                                                                                  |
| View_Giver, Voice_Log                                                               | [Collectibles](entities.md#collectibles)                                                                                                                                       |

## Treasures and gold rooms

- Treasures are picked up inside the `skipping_stones` level (story_tag): `Level_State.skipping_stones_treasure_flags` (u8); bit = `Treasure.treasure_index`.
- On finishing that level, Status `treasure_flags |= skipping_stones_treasure_flags`.
- Overworld: Treasure_Display i (`treasure_index` 0..5, plinths at (78..82, 52..56, 0)) shows acquired iff popcount(treasure_flags) > i: by count, not by bit.
- Nothing else reads `treasure_flags`.
- Gold rooms: a gold room is visited when its `gold_room_endpoint` Teleporter is discovered (reached through the activated tower's MINOR pad). Unlocked = tower activated. Each tower has its worlds_collide level (GOLD_* carrier) beside it.

## Overworld level data

- Every Level_Entry without `unlocked_by_id*` has `enabled_t_target = 1` in the data (open from the start). The gated ones have 0, except `falloff_dragons`, `skybridge`, `zap_bridge` and `detachment`, which are open from the start. No entry is broken or disfavored. A few are `dropdown`; the tower levels have `tower_flags`.
- `achievement` carriers: GOLD_HM `worlds_collide_heroes_and_mirrors_v3`, GOLD_HS `worlds_collide_heroes_and_stones`, GOLD_HP `worlds_collide_heroes_and_promesst_v4`, GOLD_MS `worlds_collide_mirrors_and_stones_v2`, GOLD_MP `worlds_collide_alt`, GOLD_SP `worlds_collide_ps`, HEROES `heroes3_21_condensed`, MIRRORS `mundane_mirror`, SKIPPING `skipping_shores_v3`, PROMISE `promesst2_streamlined`, ENDGAME1 `end1`, ENDGAME2 `all_together_now`, ENDGAME3 `end3_pipeline_aesthetics`.
- The overworld's `level_names` are all unique.
