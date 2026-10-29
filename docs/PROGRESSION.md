# Progression

The game's progression rules: Level_Entry unlocking (Freezers, Signs, towers), the campaign status fields, achievements
and ranks, the endings, campaigns and level sets, the in-game progress displays, treasures and gold rooms, and the
overworld level data.

## Level_Entry unlocking and state

- Entered: `enabled_t_target = 1` once `level_states` has any entry for `level_name` (any flags, even 0). An entry (flags 0) is added whenever that level is loaded.
- Solved: `level_states[level_name] & SOLVED (1)`. It sets `solved_t_target = 1` and is never read from anything else. SOLVED is set on victory for the current level's name.
- PARTIALLY_SOLVED (2): set when the hero activates an `Overworld_Unlock` in that level (sets `activated`, bark `overworld_unlocked`).
- ENTERED (4) is never set; the game sets only 1, 2 and 8. Legacy.
- TOWER_UNLOCK_SIGNALLED (8): set once a solved tower level's "tower is about to unlock" cue has played.
- Two enable checks differ. Applying the level state at load needs the entry present (flags 0 counts). The unlock pass needs flags ≠ 0. Load always runs the first, so presence is enough.
- The unlock pass runs only on Level_Entries with `enabled_t_target == 0`. With `unlocked_by_id` or `unlocked_by_id2` set the gate uses all three ids. With both 0 only `unlocked_by_id3` is used. With all three 0 the entry is skipped.
- Gate: `unlock_is_or_gate` true = any nonzero id satisfied; false = all nonzero ids satisfied.
- Unlocking is not saved. It is recomputed from the other state at every overworld load and after each change (a visual `enabled_t_target = 1`, bark `level_unlocked`). Entering checks `enabled_t`, copied from `enabled_t_target` at load.
- What an unlocker id may be (it resolves in the same level file):
  - **Level_Entry**: satisfied if its `solved_t_target ≠ 0` (SOLVED). For Level_Entry gates the mode (`partial_solve_count`, see Freezer) is −1, so a PARTIALLY_SOLVED unlocker does not count.
  - **Sign**: satisfied if `rank_satisfied`, which only reading the Sign sets ([Sign `rank_satisfied`](#sign-rank_satisfied)); a Sign with no rank, tower or gold-room setting counts as satisfied.
  - **Teleporter**: if `discovered`.
  - **Marker** named `intro_end1_freezer_thaw` (its `float_parameter` is set to the campaign rank while a hero is inside its box; satisfied when > 0, so at rank 1 or more; the same branch re-checks the Signs `intro_end2_sign` and `intro_end3_sign` against the rank and reruns the unlock pass) or with script `end3_exploit_level_freezer_thaw` (`boolean_argument`).
  - **Judge**: only for Freezers.
  - Any other type is never satisfied.
- `tower_flags`: does not gate the entry. It assigns the level to the Tower whose `tower_flags` is exactly equal.
- `dropdown`: a tower level that is optional for the tower. Counted in `total/solved_dropdown_levels`, not in `levels_required`. All dropdowns solved = the tower's gold status.
- `achievement`: when a SOLVED entry's state is applied (in practice on the overworld load after the win), the achievement is granted (bit 0 also set) and the rank raised ([Achievements and ranks](#achievements-and-ranks)). `Level_Entry.achievement` is the field's only reader.
- `currently_broken` or `currently_disfavored`: the entry is destroyed at every level load, so it never exists in play. Drop it from all counts.
- `Level_Entry.demo_phase` is never read by gameplay. Only `Sign.demo_phase` is read, by a level-export path (with `demo_bounds` markers). `*choice_demoN` in level sets is ignored.
- `context_type` (OPTIONAL 1, DIFFICULT 2, ORDERING 4, EASY 8, OTHER) and `context_details`: designer metadata, read by no game code.

### Freezer

- Evaluated while `unfrozen == 0`, with `unlocked_by_id`..`id4` and `unlock_is_or_gate` and the same gate rule. Satisfied → open.
- Mode = `partial_solve_count`. If it is not −1, a Level_Entry unlocker also counts when its level is PARTIALLY_SOLVED.
- Judge unlocker: `Judge.state_int0 ≥ Freezer.judge_unlock_level`. On load the first Judge is compared with every freezer that has `judge_unlock_level ≠ 0`.
- On opening, and only if `judge_unlock_level == 0`, the freezer Pid goes into Status opened list A (overworld) or B (any other level). On load these freezers are reopened from the lists.

### Sign `rank_satisfied`

A Sign is read when a hero stands in the cell next to it and faces it, with no closed Freezer in the Sign's own cell
and no Fence between the two cells. Reading tests the Sign's setting once, at that moment. If it holds,
`rank_satisfied` is set and the unlock pass reruns, which opens the Freezers that list the Sign. Nothing else tests
the setting, so a rank reached, a tower activated or a gold-room count met while the Sign is unread opens nothing
until a hero reads it. The flag stays set and the history keeps it. A Freezer's Sign gate is met exactly when the
Sign's `rank_satisfied` is set.

| Sign setup | Satisfied when read and |
|---|---|
| `unlock_freezers_with_rank` = r (`Character_Rank`) | r == 0xFF or r ≤ Status rank. 0xFF (255) skips the rank compare, so such a Sign is satisfied on the first read |
| `tower_id` ≠ 0 | that Tower has `activated` |
| `gold_room_connection_unlocker` (only on Signs without `tower_id`; with one, the tower decides) | at least 4 Teleporters on the overworld have `gold_room_endpoint && discovered` (a runtime count at the moment of reading) |
| none of the three (a status Sign) | never set; a Freezer that lists such a Sign counts it as met |

Only the Markers of the `intro` level set the flag without a read: the Signs `intro_end2_sign` and `intro_end3_sign`
follow the rank when it changes ([Level_Entry unlocking and state](#level_entry-unlocking-and-state)). The overworld
sets none that way.

### Tower

- `solved_normal_levels` counts Level_Entries with `tower_flags == Tower.tower_flags` and `dropdown == false` whose Status flags have SOLVED. Dropdowns are counted separately.
- The tower activates when not `activated` and `solved_normal_levels ≥ levels_required`. It enables its `teleporter_id` Teleporter (which makes that pad's Groups exist, [Teleporter pads and fast travel](MOVEMENT.md#teleporter-pads-and-fast-travel)) and grants an achievement from `tower_flags`: ground pair → TOWER_xx; UPSTAIRS (16) + one letter → TOWER_x_SKY; DOWNSTAIRS (32) + pair → TOWER_xx_UNDERWORLD.
- Tower id bits: H 1, M 2, S 4, P 8 (`Tower_Flags` HEROES, MIRRORS, SKIPPING, PROMESST). Pairs HM 3, HS 5, MS 6, HP 9, MP 10, SP 12 → TOWER_HM, HS, MS, HP, MP, SP.

## Status.sokoban_status fields

In file order. The names are labels for each field's use: the game has none. The save code writes the counters raw,
and the Steam side has achievements only (no stats). Byte layout and versions: [Status.sokoban_status (campaign status)](SAVES.md#statussokoban_status-campaign-status).

| File position | Name |
|---|---|
| s64 × 2 | last_saved (Apollo) |
| u8 | **rank** (`Character_Rank`): 0 Visitor, 1 Egressant, 2 Pusher, 3 Arranger, 4 Intrepid, 5 Sokoban ([Achievements and ranks](#achievements-and-ranks)) |
| s64 × 2 | play_time |
| s64 | achievements: bit n = `Achievement` n; bit 0 set whenever any is granted |
| u32 | **treasure_flags** ([Treasures and gold rooms](#treasures-and-gold-rooms)) |
| u32 | counter 0: gems taken with T (a Gem with `inventory_index` < 0 in the hero's cell; "GemDustoff"; [TRANSMUTE and the other skills](SKILLS.md#transmute-and-the-other-skills)) |
| u32 | counter 1: gems dropped with T onto a Gem_Slot (the hero's latest inventory gem) |
| u32 | counter 2: Artifacts picked up (every kind, wands included) |
| u32 | counter 3: never incremented |
| u32 | counter 4: Friendly_Dragon follow/unfollow toggles (TOGGLE_FRIENDLY_DRAGON, dragon within 1.25 of the hero) |
| u32 | counter 5: successful P1 wand uses ("p1wand_success") |
| u32 | counter 6: beams turned by a torc (cw/ccw/180) |
| u32 | counter 7: prism uses that succeeded ("PrismSuccess") |
| u32 | counter 8: entering an enabled Level_Entry |
| u32 | counter 9: ACTIVATE actions handled (counted before mirror and teleport handling) |
| s64 | **artifacts**: bit 1 << `Artifact.kind`, set only for kinds 3-6 (SPEED_CONTROL, UNDO_SIDE_PANEL, _EXTENDED, _VERY_EXTENDED) on pickup. Kinds 0-2 (PROMESST_1/2/3_WAND) set `Guy.inventory_flags` instead (WAND 0x400, TORC 0x800, PRISM 0x1000); 7 SPAWNER_MORPH only counts in counter 2. No level holds kind ≥ 3 and nothing reads the bits (time control is gated by `levels_solved > 0` or level `time_tutorial`), so it is always 0. Loading the overworld clears the bit of each Artifact still present there |
| u32 | **current_area_pin** ([Areas](STATE.md#areas)): recomputed every frame; 0 in every non-overworld level, so non-zero in a file only if saved on the overworld inside an activated area |
| s32 | **levels_solved**: overworld Level_Entries with `solved_t_target ≠ 0`. Shown as "% solved" in the campaign list. > 0 also enables time control |
| s32 | **tower_levels_solved**: the same, restricted to `tower_flags ≠ 0` |
| s32 | **towers_activated** |
| u8 | show-area-names toggle for the overhead map (Activate while the TAB map is open; needs ≥ 2 activated named Area_Pins, else forced 0); UI only |
| u8 | overworld_reached (lobby vs overworld; after a win: back to the overworld instead of advancing in the level set) |
| str16 | current level = `current_level_set.level_names[current_level_index]` |
| str16 | menu-background level |
| table | level_states (Jai Hash_Table, 32-byte entries: hash, string, u8 flags) |
| table | string table {str key, s64, str}: only load and save touch it (legacy) |
| list | **pid list A** = opened Freezers on the overworld |
| list | **pid list B** = opened Freezers in other levels |
| runtime | not saved (last shown area pin, play-time accounting) |

The 10 counters are written and saved, never read (a heuristic scan; their names come from where they are incremented).

## Achievements and ranks

| Achievement | Condition |
|---|---|
| TOWER_* (16) | that tower activates |
| ASCEND / DESCEND | the hero touches a point `grant_rank` Marker with `float_parameter` 2 / 4. There are two, both on the overworld: the sky hub (83, 72, 33) and the underworld hub (80, 69, −21), the bottom Stairs cell of the hub elevator. Also raises the rank to at least 2 / 4. Either order is accepted. Any other value logs "Unhandled rank % in 'grant_rank' Marker!" |
| COMPLETIONIST | on the overworld (`special_level == OVERWORLD`), **every** Level_Entry present (broken and disfavored ones are already destroyed) has `solved_t_target ≠ 0`. Dropdowns, tower levels and sky/underworld entries included. Entries in other levels don't count |
| the other 13 (GOLD_*, ENDGAME1-3, HEROES, MIRRORS, SKIPPING, PROMISE) | no code grants them by id. They come from `Level_Entry.achievement` on the entry whose level is solved ([Level_Entry unlocking and state](#level_entry-unlocking-and-state), [Overworld level data](#overworld-level-data)). ENDGAME1/2/3 also raise the rank to 1/3/5 |
| Sync | each overworld load re-derives the bits silently from solved carriers and activated towers, then re-sends every set bit 1..32 to Steam. SetAchievement runs only for a new bit. GetAchievement results are discarded |

32 achievements = 13 carriers + 16 TOWER_* + ASCEND, DESCEND, COMPLETIONIST. The game unlocks a Steam achievement by
its `Achievement` value name, which is the Steam API name, and Steam's bit is the value − 1. Steam display
names: "Antipode xx" (TOWER_xx), "Low xx" (TOWER_xx_UNDERWORLD), "High x" (TOWER_x_SKY),
"Gold HxM" etc. (GOLD_*), "Endgame" / "Endgame High" / "Endgame Low" (ENDGAME1/2/3; their descriptions say the Endgame,
the Second Endgame, the Final Endgame), Ascend, Descend, Completionist, Heroes, Mirror Isles, Skipping Stones,
Beamcasters. GOLD_* says "open the gold room" on Steam, but the game grants it
for solving that pair's worlds_collide level.

**Rank.** It only rises: each source sets rank = max(rank, N). ENDGAME1 → 1, ASCEND → 2, ENDGAME2 → 3, DESCEND → 4,
ENDGAME3 → 5. Order is not enforced: DESCEND at rank 0 gives 4, and ENDGAME1 then changes nothing. TOWER achievements
pass through the rank function and do nothing. A rise requests a campaign save. The rank is copied into the campaign
list entry (titles `rank_visitor`..`rank_sokoban`).

What ranks unlock (rank Signs exist only for 1, 3 and 5). A rank opens nothing by itself: each Sign opens its Freezers
when a hero reads it at that rank or higher ([Sign `rank_satisfied`](#sign-rank_satisfied)).

| Rank | Effect |
|---|---|
| ≥ 1 | the `sign_endgame_ground_star` Signs open the ground Freezers (25, 65), (72, 114), (72, 115), (81, 18), (130, 69), and (−15, 134) in front of the `~end1` Door. Bark Markers with `bark_flags` ONLY_BEFORE_END1 (8) stop playing |
| 2, 4 | nothing on the overworld; only ASCEND / DESCEND and the title |
| ≥ 3 | the `sign_endgame_sky` Signs open the gates (67, 13, 19), (106, 51, 33), (70, 73, 34), (33, 76, 35), (75, 91, 35) in the sky, and (−9, 134, 0) in front of the `~end2` Door |
| 5 | the `sign_endgame_underworld` Signs open (137, 134, −21) in the underworld and (−21, 134, 0) in front of the `~end3` Door |

In `intro`, the `intro_end1_freezer_thaw` box and the Signs `intro_end2_sign` / `intro_end3_sign` follow the rank (Signs
there ask for 1, 3, 5 and 255). `end3_promesst_red` and `end3_skipping_red` each have a rank-1 Sign. `intro_69_sign`
shows different text at rank 0. A Freezer's `color_frozen` tint is styling, not a rule.

**100 % as the game defines it** = COMPLETIONIST = SOLVED for every overworld Level_Entry that is not `currently_broken`
or `currently_disfavored`. "Required" for tower progress = non-dropdown entries with the tower's `tower_flags`, up to
`levels_required`. Dropdowns give the gold status. Everything is required for COMPLETIONIST.

## Endings

Three endings, one per ENDGAME achievement: Endgame (ENDGAME1, rank 1), Second Endgame (ENDGAME2, rank 3) and Final
Endgame (ENDGAME3, rank 5). Each ends at a ground Door south of the antipode hubs: `~end1` (−15, 134, 0), `~end2`
(−9, 134, 0), `~end3` (−21, 134, 0). Each Door stands behind a Freezer on a rank Sign (1, 3, 5) and leads to `intro`
at the matching `~endN` Marker. The Doors have no `switch_to_level_set`, so the level set follows the level name.

The antipode hubs stand at (−15, 147), half a period from the crossroads (80, 69): the ground hub at z 0, the sky hub
at z 37, the underworld hub at z −21.

Nothing else gates the endings. Low towers open no Freezer: their Signs are status signs. Artifacts and treasures gate
nothing on the overworld.

### Endgame

1. Activate 4 of the ground towers. Each needs N of its normal levels (`levels_required`): HM 8, HS 7, MS 7, HP 10,
   MP 6, SP 6.
2. Step on each active tower's MINOR pad, its `teleporter_id`, which activation enabled. It sends the hero to the
   tower's `gold_room_endpoint` pad in the ground hub and so discovers that gold room
   ([Treasures and gold rooms](#treasures-and-gold-rooms)).
3. `end1` stands in the ground hub at (−15, 147, 0), inside Freezers on the
   `gold_room_connection_unlocker` Sign (−19, 147, 0). Once 4 gold rooms are discovered, reading the Sign opens them
   ([Sign `rank_satisfied`](#sign-rank_satisfied)).
4. Win `end1`. The win returns the hero to `~end1` (−15, 138, 0) on the overworld. At rank 1 reading the rank-1 Sign
   (−15, 138) opens the Freezer (−15, 134); the Door leads to `intro`.

`end1` is a Judge level (Judge code `end1`, `return_to_prelude`). Its prelude rooms are boxed by the `=H`, `=M`, `=P`
and `=S` markers. The Judge's stage is `state_int0`; a Freezer with `judge_unlock_level` n opens when the stage is at
least n ([Freezer](#freezer)).
- Stage 0 → 1 when the opening story ends (the subtitle event `unfreeze`, or the prelude check when no story is
  pending).
- Four `~controller` END1 Switches: H (27, 22, 4), M (30, 19, 4), S (27, 16, 4), P (24, 19, 4), flavors 0..3. END1
  Switches ignore Guys, so only things in their cells press them. Each update the Judge builds a mask from the pressed
  ones.
- Stage N asks for the N-switch combinations not won yet: stage 1 the singles, stage 2 the 6 pairs, stage 3 the 4
  triples, stage 4 HMSP. 15 in all. The Judge is satisfied when the mask holds N Switches and is one of them.
- Groups `^X` exist while X is pressed; Groups `*XY…` exist while the mask is exactly that set. They are the z 0 puzzle
  rooms, each with an exit Door.
- Winning a room sets its combination's bit and a campaign flag at index stage offset + region (offsets 0, 4, 10, 14
  for stages 1..4), and each `~controller` entity with a matching bit runs an unlock, with a "freezers are about…"
  sound ("register_current_end1_or_end3_flags_as_completed"). The combination bits are not in
  `Status.sokoban_status`; they live in the level's own state (inferred).
- When a stage's list is done and the 3 s timer has run out, the stage goes up by one, the bits clear, and the bark
  `end1_dimension_<stage>` of the finished stage plays.
- Freezers at levels 1–4 stand at (24, 22), (30, 22), (30, 16) and (24, 16), each holding a Rock. Level 5 (23, 15) is
  the END1_EXIT Door to overworld `~end1`.
- A hero on END1_EXIT sets ESCAPE_FROM_PRELUDE and wins the level at once.
- At stage 1 the Level_State `misc_flags` has RETURN_TO_PRELUDE set, the Freezer (24, 22, 4) is unfrozen and the
  Judge's `state_int0` is 1.
- `end1`'s Freezers are never in opened list B, because of the `judge_unlock_level` exclusion ([Freezer](#freezer)).

So in `end1` the hero pushes the released Rocks onto the controller Switches, plays each combination's room, and
leaves at stage 5.

### Second Endgame

1. Reach the sky. The only lift built is the ruby lift in the crossroads column (84, 73). Its pieces wait in rank-1
   Freezers: the light `ruby_beamcaster`, its gem, three switch rocks and `upstairs_mirror`, all movable into place
   from the level data ([Routes that need these mechanics](MOVEMENT.md#routes-that-need-these-mechanics)). The ride
   lands on the ASCEND Marker.
2. Activate High Heroes. Each sky tower (H, M, S, P) needs N of its normal levels: H 12, M 6, S 6, P 10, and opens one
   of the four Freezers in step 4; High Heroes' Sign opens the south one, (−15, 144, 37), which the south way needs.
   Their pads are the MAJOR pads of the sky hub (z 37 and 38). Activation enables no map-room twin: a twin is enabled
   when its hub pad is first stepped on, so the first visit to the hub is on foot.
3. Walk to the sky hub by The Heroic Way (`area_s_heroes_way`), a sky path from the east of `catching_fire_v2`
   (55, 123, 54) west to the hub. The hero goes through the cell of the Freezer (55, 120, 54), which
   `catching_fire_v2` opens, and down by the dragon Monsters stacked at (55..56, 119..121, 46..52), to the dragon room
   (x 36..53, y 119..126, z 45) with its Priestess Wardrobes and the room below it at z 37, crosses north over more
   dragons, and follows one-way MINOR pads west to the hub. So this way needs `catching_fire_v2`. A second
   way in (unconfirmed): `skip_stack_1` opens the Freezer (48, 147, 44) on the edge of the pocket of the Heroic Way's
   east pad (44, 135, 38), and `skip_stack_1` itself stands behind a Freezer that `catching_fire_v2` opens.
4. The four Freezers (−15, 144, 37), (−23, 147, 37), (−13, 152, 37) and (−9, 146, 38) each open with one sky tower.
   They ring the hub elevator (−15, 147, 38) → (−15, 147, 47). The south one, (−15, 144, 37), holds nothing and
   opens the south way to it, which ends at a closed switch Gate whose Switch is fenced in; a closing Gate lifts the
   hero onto the step. Pressing that Switch takes a piece from another tower's Freezer: the west one holds a magic
   Mirror, the north one a MIRRORABLE and SKIPPABLE Rock, the east one a Rover (inferred;
   [Routes that need these mechanics](MOVEMENT.md#routes-that-need-these-mechanics)). The hub's four tower pads stand
   in four separate pockets on foot, each by its tower's Sign, and the sky has one Way area per tower kind (The Heroic
   Way, The Mirror Way, The Skipping Way, The Beam Way). Second Endgame takes all four sky towers, each reached by its
   own Way. An active sky tower does not open its hub Freezer until its Sign is read. Reading a tower's Sign needs its
   quarter: south for High Heroes, west for High Mirrors, north for High Skipping Stones and east for High
   Beamcasters. The levels each Way passes are the viewer's table of known routes ([Known routes](VIEWER.md#known-routes)).
5. The elevator's top opens onto the end2 room (z 44). There `laser_pointer` needs 11 levels: `allocate_heroes_v2` →
   `end2_heroes_1_2` → `end2_heroes_1_5`; `end2_mirror_3` → `mirror_prelude_v2_fix` → `peak_toggle`;
   `place_slot_4x4_pushstyle` → `color_picker` → `place_promesst_rooms`; `stack_prelude_pushstyle`. The set's other
   levels are not on the way.
6. `laser_pointer` opens the Freezer (0, 149, 46). It holds a Rover (θ 180) carrying a magic Mirror (0, 149, 47).
7. Go up to the z 47 deck and `all_together_now` (−9, 134, 47). The deck is fence floors (Group `end2_upper`, a plain
   Group that exists) in separate parts:
   - West: the Stairs top (−15, 147, 47), the centre (−17..−13, 144..146), row 141 at x −23..−15 and column −23. The
     Gate (−23, 152) is flavor 999992, Switch (−24, 150, 44). Behind it row 152 runs west to (−17, 153), then across
     the y seam to a PROTECTION Wardrobe (−17, −1, 47) and a dead end at (−17, 3). On foot from the Stairs top, every
     Freezer open, the hero reaches West and the z 44 room only.
   - A: row 141 at x −13..−8, column −13 (y 134..140), and the room (−13..−8, 133..135) with `all_together_now`
     (−9, 134), a Rock in its exit gate (−9, 132) and a goblin at (−9, 130). A has no floor at (−14, 141), and
     (−13, 141) is fenced west and north.
   - B1: (−7, 142..145), row 145 at x −7..−1, and (−1, 146). A fence on the north side of (−7, 145) closes it.
   - B2: (−7, 149..152), row 149 at x −7..−4, and row 152 east with the flavor-999993 Gates: the Switch
     (−6, 151, 44) opens (−7, 150) and (−9, 152) and shuts the notted (−7, 152). Row 152 runs east to (−13, 153),
     then across the seam to a PROTECTION Wardrobe (−13, −1, 47).
   - The corner cup: (−7, 141, 46) is a floor Fence fenced on all four sides at z 46. The air cell above it,
     (−7, 141, 47), is the only corner joining A (west) and B1 (north). A hero stepping in from either falls into the
     cup and is trapped. Anything in the cup holds up (−7, 141, 47), so a Rock pushed south into it from
     (−7, 142, 47) would bridge B1 to A.
   - The room's magic Mirrors: the vertical (−10, 143, 44), θ 180, arms west and up, in the `chart_a_course`
     Freezer; the flat (−8, 153, 44), θ 0, arms west and south; after `laser_pointer`, the flat one (0, 149, 47), θ 0,
     on the Rover (0, 149, 46), θ 180, whose track is x 0..−3. The Rover's Mirror is in screen 1, the others in
     screen 0. As placed no hop reaches A or B, so the `laser_pointer` gate opens nothing by itself.
   - Into B1 (inferred from the rules): push the vertical magic Mirror east 3 times along row 143 at z 44, to
     (−7, 143), the hero walking (−11 → −9, 143). It crosses `chart_a_course`'s Level_Entry (−8, 143) and ends on
     `sidestone_zach_2_end2`'s cell (−7, 143); Level_Entries block no move ([A move](MOVEMENT.md#a-move)). Then from
     (−10, 143, 44) ACTIVATE: d = 3 on the west arm maps 3 up the up arm, to the floor Fence (−7, 143, 47). Any d ≥ 3
     lands at or above it and falls onto it. That opens B1.
   - How the hero gets from B1 into A is open ([Progression and the viewer's model](UNCONFIRMED.md#progression-and-the-viewers-model)).
8. Win `all_together_now`. It opens its exit gate (−9, 132, 47). From there the hero drops to the rank-3 gate
   (−9, 134, 0) and the `~end2` Door.

### Final Endgame

1. Rank 3 or more. Signs test rank ≥ r when read, so at DESCEND's rank 4 reading a rank-3 Sign also opens its Freezers,
   the `~end2` Door's among them.
2. Reach the underworld. DESCEND is out of reach before the sky. Its Marker (80, 69, −21) is the hub elevator's
   bottom Stairs cell. Its pocket holds only `push_down_chain`, and its Freezers, (80, 66), (77, 69),
   (80, 72) and (83, 69) at z −21, all need `push_down_chain`. It is entered only by its pad (80, 68, −21), or by
   riding down from the sky once the elevator's stack is cleared from the top ([Elevators](MOVEMENT.md#elevators)).
   The pad's map-room twin (62, 119, 78) starts disabled, and only the twins of five underworld pads enable it:
   (97, 69, −21), (48, 68, −21), (81, 51, −21), (86, 105, −18) and (61, 86, −21). No ground pad's discovery chain
   names an underworld pad, and no walk, elevator or MINOR pad enters an underworld cell from the ground. The
   underworld hub's minor pads land outside the pocket.
3. The underworld hub (−15, 147, −21) holds the Low towers and `4wc` levels. On foot it is a sealed pocket, even
   with every Freezer open. Its ways in:
   - Its MAJOR pad (−11, 147, −21), from the twin (38, 138, 78). That twin starts disabled and undiscovered. The twin
     (42, 132, 78) of the end3 pad (4, 121, −24) enables it by `also_discover` (Group `UFTAntipodeLow_Main`). So
     stepping on the end3 pad opens fast travel to the hub.
   - Minor pad pairs, one per Low tower, between the underworld crossroads (67..86, 64..79, −20) and the hub. The hub-side pads are the
     Low towers' `teleporter_id`s; discovering one enables its crossroads twin. All start disabled.
   - The end3 pad's own pocket holds no levels. It is ringed by switch Gates (2, 126) and (4, 128) and notted
     monster Gates (6, 124) and (8, 124). Gate (4, 128) is flavor 33331; its only Switch, (12, 131, −25), sits in room
     A's exit pit and also opens (13, 137), A's way to B. So the pocket opens together with room B, right after room A.
     Gate (2, 126), flavor 33390, has no Switch: only an OPEN beam opens it. The monster Gates open only while a living
     Monster is in their screen room; none was found nearby.
4. The first end3 room, A (heroes), is reached only from the hub. It is a pocket: the hall (y 136–141)
   and the room (x 1–7, y 129–135, z −24). Besides its own exits and the back door from room H (the Freezer
   (−11, 129), below), its only link is a chute from the hub: (−15, 146, −21) → (−15, 145..144, −22) →
   (−15, 143..142, −23) → (−15, 141, −24) into the hall. It drops one z every 2 cells, so it is one-way down. It
   starts behind the Gate (−15, 147, −21), closed, a Promesst glyph gate of flavor 9 with no Switch and in no Group.
   In play it ends open, with all the hub's pads discovered. The only opener the rules give is an OPEN bump
   ([Gates, switches and buttons](MOVEMENT.md#gates-switches-and-buttons)): a mover in an OPEN beam, and in no ALTER
   beam, moving into it. The beam has to arrive at z −21 along row 147 from the east, along row 148, along column −16
   or −14, or along column −15 from y 149–151 (the Sign (−15, 152) stops it beyond). Beams pass solids and stop only
   at entities ([Promesst beams and powers](MOVEMENT.md#promesst-beams-and-powers)). No light in the level data
   reaches those cells, and the hub holds no light, Mirror or mover. What opens it is not known (unconfirmed;
   [Progression and the viewer's model](UNCONFIRMED.md#progression-and-the-viewers-model)).
   - Row 147 from the east crosses a goblin field: floor at z −22, x 54..70, y 141..153, with goblins riding plain
     Mirrors in rows 143, 147 and 151. The Mirrors turn in play from their level-data θ 90 (cause unconfirmed). A
     Rock stands on a pillar at (62, 147, −21). Pads at (58, 145), (66, 145), (58, 149) and (66, 149), z −22, lead to
     the Floor (62, 153, −21) at the south end of a jetty (61..63, 154..157, −21); jetty and field are one pocket.
     No light reaches (71, 146) heading north, and the row-147 Mirrors as placed turn a west-bound beam south, so the
     hub Gate has no OPEN source as placed.
   - The field is entered from the north, off a Lily highway: the river along y 160 (y 4 across the seam) at z −21
     runs the whole world width, flowing west, so it is a ring, and one Lily rides it. Each highway stop has an
     Activator whose Spawner puts that Lily back on the river just upstream of the stop: (62, 159), (78, 0),
     (104, 3), (118, 5), (135, 7), (151, 3) and (−15, 5, −18). The home stop (22, 6) puts it back at (26, 7), off the
     river. (62, 159, −21) is the field's stop: from it the Freezer (62, 158, −21), which needs `chain_gang`, leads
     onto the jetty. The home Lily leaves only when a skipping stone kicks it (derived from the rules): the Rock
     (19, 8, −21), pushed west from the Freezer cell (20, 8) (opened by `wrap_music`), skips round the world and
     comes in from the east to the Gate (29, 8, −22), flavor 111876. While the hero stands on its only Switch
     (29, 9, −21), the stone passes over and at (26, 8) kicks the Lily south onto the river at (26, 4), which flows
     west past the island's south shore (20..22, 5), where the hero boards it. How the hero first reaches the island
     or any stop is not known (unconfirmed).
5. The end3 rooms (x −22..30, y 103..139, z −24; to players Exit Low, northwest of the crossroads on the Low layer)
   hold the whole `endgame3` set, in the eight rooms below, as one chain. Each room's first levels are enabled, so the
   order is physical. Between rooms stand Freezers and switch Gates. The Switches sit in floor pits at z −25 and −26
   (flavors 33331–33339, 33390, 333310–333313); each pit pad at z −25 targets the next room's Marker. With every
   Freezer closed each room is its own pocket, so no room can be entered early. The order is the viewer's walk, with
   each pit's Switch taken as pressable once the hero is in the pit (unconfirmed):
   1. heroes (x 2–6, y 130–134), exit (10, 136) in its Freezer, which needs all 4 levels. Its levels hang from one root,
      `allocate_heroes_end3` (4, 134), which stands in the switch Gate (4, 134), flavor 33332. Its Switch
      (−4, 132, −25) is in the west pit, so the west pit comes before any level of room A, and the east pit (Switch
      (12, 131), flavor 33331) after. Both pits (x −4..0 and 8..12, y 129..135, z −25) are fenced on their hall sides at
      z −24 and walled on the others. The one open edge runs from each pad cell, (−2, 135) and (10, 135), north into
      a hall cell fenced on both sides, with a Wardrobe to its north. The hero enters by stepping off at z −24 and falling
      onto the pad, which a fall doesn't fire; he walks off it into the pit, and stepping back onto it takes him out
      ([Teleporter pads and fast travel](MOVEMENT.md#teleporter-pads-and-fast-travel)). West pit: push Rock
      (−2, 133) onto the Switch (−4, 132), 3 pushes. East pit: room A's exit Freezer stands in (10, 136, −24), the cell of
      the pad's target Marker and the only way into the pit, so entry and exit both wait for its 4 levels
      (`end3_skipping_red`, `end3_mirror_2_alt2`, `end3_heroes_1`, `end3_promesst_red`); then Rock (10, 133) goes
      onto the Switch (12, 131) in 4 pushes. Neither pit needs its magic Mirror;
   2. design (x 21–25, y 129–134), exit (30, 134) in its Freezer, which needs all 4 levels;
   3. exploit (y 117–123), exit (26, 119) in its Freezer;
   4. simplify, exit (23, 109) in its Freezer;
   5. mirror (x 24–30), exit (29, 109) in its Freezer. D and E share one hall, but E's first level stands in the switch
      Gate (24, 109), flavor 33337, whose Switch (25, 103, −25) is in the pit under D's exit (23, 109);
   6. off-topic and reorder, exit (8, 103) in its Freezer;
   7. environment art: `objects` opens the disappearing gates;
   8. pipeline: setup, design, cleanup, cut and reorder each open one gate. `end3_pipeline_aesthetics` opens the 4
      `disappear_to_nothing` gates (−16..−14, 127) and (−11, 129), a back door between H and A.
6. Win `end3_pipeline_aesthetics` and take the elevator (−21, 132, −24) → (−21, 132, 0). It arrives in the ground
   alcove of the `~end3` Door, which nothing else reaches. Rank 5 opens the gate (−21, 134).

### In `intro`

`intro` is also the opening level (`start_sign_keyboard` at (45, 83)).

- Arrival Markers, Group `entryway`: `~end1` (45, 50, 2), `~end2` (50, 50, 2), `~end3` (40, 50, 2). Each has a
  Checkpoint. Arrival runs the Wardrobe door-in reset ([Campaigns and level sets](#campaigns-and-level-sets)).
- Each arrival room (x 44–46 for `~end1`, 49–51 for `~end2`, 39–41 for `~end3`; y 49–51, z 2) is closed by its own
  Freezer at y 52, which the arrival's own rank opens: `intro_end1_freezer` (45, 52, 2) rank 1 (the Marker `end`
  stands in that cell), `intro_end2_freezer` (50, 52, 2) on a rank-3 Sign (50, 48, 2), `intro_end3_freezer`
  (40, 52, 2) on a rank-5 Sign (40, 48, 2). The rooms join only through those Freezers, in the hall at rows 53–54.
  Further on: another `intro_end3_freezer` (84, 23, 1) and a rank-3 Freezer (40, 22, 2).
- Onward from the hall: Stairs (44, 48) and (46, 48) go from z 2 to z 0. Their four Freezers, at the stair bottoms,
  open at rank 1 or more while a hero is inside the touch box of the Marker `intro_end1_freezer_thaw` (centre
  (45, 49.7, 3), extents 2.5 × 2.1 × 1.55), which holds the `~end1` arrival cell. At z 0 the opening hallway runs south to the start (45, −20, 0), with Rocks
  to push. The `jenga_dispenser` Freezer (65, 24, 0) and Stairs (67, 24) lead to the closed z 1 jenga room behind
  the rank-5 Freezer (84, 23, 1). North, column 38 leads to the cross hub (z 2, x 22–48, y 63–76).
- The exit is the Stairs (57, 0, 2) → (57, 0, 10) → the INTRO_FINAL_EXIT Door. At rank 3 the bottom pocket is small
  and drops one way to z 0. At rank 5 it joins the credits rooms (z 2, x 50–92, y 0–7) through the rank-5 Freezers
  (59, 0, 2) and (63, 6, 2). A walk on foot never reaches the credits rooms or the exit, but a teleport does: a
  magic Mirror pushed east of the cross hub and a light's beam take the hero into the credits rooms at rank 1, and
  from there the Stairs (57, 0) lead up to the exit with every rank-3 and rank-5 Freezer closed (seen in play). The
  credits rooms drop one way to the z 0 hallway, south of (49, 7, 2).
- The way out is the Door (45, 47, 0) to `overworld:start`, in a Freezer whose Sign has `unlock_freezers_with_rank`
  255, so it is open from the start. Every arrival can leave by it (inferred,
  [Progression and the viewer's model](UNCONFIRMED.md#progression-and-the-viewers-model)); INTRO_FINAL_EXIT is not
  needed:
  - from `~end1` (45, 50, 2), inside the thaw box: (44, 49, 2), down the Stairs (44, 48) (or (46, 48)) to z 0, then
    (44, 47, 0), (44, 46, 0), (45, 46, 0) and north into the Door; (45, 48, 0) is solid, so the stair bottoms reach
    the Door only round its side;
  - from `~end2` (50, 50, 2): through `intro_end2_freezer` (rank 3), the hall at rows 53–54 and `intro_end1_freezer`
    (rank 1), north into the thaw box, then as from `~end1`;
  - from `~end3` (40, 50, 2): through `intro_end3_freezer` (rank 5), the hall and (45, 52, 2), then as from `~end1`.
- Beyond lie the credits rooms: the Signs of Group `full_game_only`, the `credits` and `creditsbard` Markers and
  the `credits_art_*` Groups, with rank-3 and rank-5 freezers inside. The post-credits Level_Entries are there; they
  don't count for completion.
- The INTRO_FINAL_EXIT Door (45, −21, 10), Group `exit`. A hero on it in an INTRO level starts the long fade. After
  5.0 s the main loop's quit flag is set, the same flag the main menu's Quit and closing the window set, and the game
  closes. That branch writes nothing to Status. The shutdown save writes what earlier frames queued and nothing new
  ([Files and versions](SAVES.md#files-and-versions)), so the history's last record is the cell before the Door, and
  Status still names `intro`: the next start loads `intro` at that cell.
- A "The End" menu exists (`menu_the_end`, `menu_the_end_console_continue` "Return to Lobby"), but it never opens on
  PC (console only, inferred).

### No "finished" flag

- Status keeps no game-finished flag. The record is the ENDGAME1/2/3 bits and the rank: 5 (Sokoban) means all three
  endings.
- The rank only rises, so the Door gates stay open and an ending can be replayed.
- The next start loads the saved current level: the overworld after leaving `intro` by its Door, `intro` after
  quitting there, by the exit Door too ([Campaigns and level sets](#campaigns-and-level-sets)).
- 100 % is still COMPLETIONIST.

## Campaigns and level sets

- A campaign is a save subfolder holding Status.sokoban_status. All campaigns play the same game; no alternate mode, no new game plus.
- The first campaign folder is the **localized** `campaign_name_default` (en `default`, de `Standard`, fr `Par défaut`, ru `по умолчанию`, ...). If the in-memory name is empty when saving, the literal `default` is used.
- At startup the most recent campaign is loaded. "Start a New Campaign" names the folder from random localized words `campaign_name_h_*` + `m_*` + `s_*` + `p_*`, concatenated, retried on collision. Campaigns are unlimited (the `menu_campaign_limit_reached` dialog never opens).
- A level set (`.level_set`, "campaign" in code strings) is an ordered level list. `*choice` after level i: after a win at i return to the overworld (`OVERWORLD_DUE_TO_CHOICE`). `*worlds_collide` = mode 2. Otherwise the game advances to the next level of the set.
- The active set is chosen by level name: the set holding the level, preferring sets that are not `drafts*`/`tests*`/`render_tests*`/`gyms*`/`unplaced_levels`, and skipping `design_illustrations` once the overworld is reached. `Door.switch_to_level_set` switches by set name. Level sets don't split completion.
- On campaign load the game goes to the `overworld` set (if allowed), else to the saved current level. A campaign saved in `intro` after the overworld was reached loads into `intro` (seen in play); which check refuses the overworld there is not known (unconfirmed).
- Status `current level` keeps naming a level after the player leaves it, until Status is saved again.
- Teleporting the hero to a link Marker (a Door's `target_link`, a level-set switch with a link, the start-link arrival) in the INTRO level runs every Wardrobe's door-in reset on the hero ([Wardrobes](SKILLS.md#wardrobes)). Overworld pads don't.

## In-game progress displays

| Display | Computation |
|---|---|
| Campaign list "% solved" + play time + date | `levels_solved` |
| Tower status sign (`Sign.display_hook` TOWER_STATUS) | star: `solved_normal_levels ≥ levels_required`; gold: `solved_dropdown_levels == total_dropdown_levels`, no minimum, independent of activation (a tower without dropdowns is gold at once) |
| `END1_STATUS` (one Sign, the `gold_room_connection_unlocker` sign in the ground antipode hub) | the gold-room status sign: the discovered gold-room endpoints, star at 4 or more |
| `END2_STATUS`, `END3_STATUS` | draw nothing extra; no Sign uses them. Any other value logs "% has an unimplemented display hook" |
| Area_Pin | `activated` on contact (and `the_crossroads` by script). Entity state, not in Status. HUD title and map labels: [Areas](STATE.md#areas). No N-of-M counts |
| View_Giver (map scroll) | [Collectibles](ENTITIES.md#collectibles) |
| Collectibles | Voice_Log: heard = a `played` = 1 CHANGE in `overworld.history`. Doors are story transitions |

## Treasures and gold rooms

- Treasures are picked up inside the `skipping_stones` level (story_tag): `Level_State.skipping_stones_treasure_flags` (u8); bit = `Treasure.treasure_index`.
- On finishing that level, Status `treasure_flags |= skipping_stones_treasure_flags`. Each treasure has a Treasure_Display; the game's messages distinguish 0, 1, 2-4, 5 and all.
- Overworld: Treasure_Display i (`treasure_index` 0..5, plinths at (78..82, 52..56, 0); index 0 is the type default, absent from the data) shows acquired iff popcount(treasure_flags) > i. By count, not by bit.
- Treasures drive nothing else: no achievement, rank, % solved, tower or gate reads `treasure_flags`.
- Gold rooms: a gold room is visited when its `gold_room_endpoint` Teleporter is discovered (reached through the activated tower's MINOR pad). Unlocked = tower activated. A Sign with `tower_id` is decided by that tower even when it also has `gold_room_connection_unlocker`; only a Sign without `tower_id` counts discovered endpoints (≥ 4). Each tower has its worlds_collide level (GOLD_* carrier) beside it. Nothing else about gold rooms is in Status.

## Overworld level data

- Every Level_Entry without `unlocked_by_id*` has `enabled_t_target = 1` in the data (open from the start). The gated ones have 0, except `falloff_dragons`, `skybridge`, `zap_bridge` and `detachment`, which have 1, so they are open from the start too (the unlock pass only evaluates a gate while `enabled_t_target == 0`). No entry has `solved_t_target` set; none is broken or disfavored. A few are `dropdown`; the tower levels have `tower_flags`. So COMPLETIONIST = every overworld level name SOLVED. The Level_Entries in `intro` and the one in `end3_promesst_red` don't count.
- `achievement` carriers (all on the overworld): GOLD_HM `worlds_collide_heroes_and_mirrors_v3`, GOLD_HS `worlds_collide_heroes_and_stones`, GOLD_HP `worlds_collide_heroes_and_promesst_v4`, GOLD_MS `worlds_collide_mirrors_and_stones_v2`, GOLD_MP `worlds_collide_alt`, GOLD_SP `worlds_collide_ps`, HEROES `heroes3_21_condensed`, MIRRORS `mundane_mirror`, SKIPPING `skipping_shores_v3`, PROMISE `promesst2_streamlined`, ENDGAME1 `end1`, ENDGAME2 `all_together_now`, ENDGAME3 `end3_pipeline_aesthetics`.
- `demo_phase` is set on some entries; the game doesn't read it.
- The overworld's `level_names` are all unique.
