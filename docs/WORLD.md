# The game folder and the overworld

The game folder, levels, level sets and saves, and the overworld: its coordinates, ground layers, screens and rooms,
wrapping and map rooms.

## Game folder

| Path | Contents |
|---|---|
| `sinking_star.exe` | the game (Jai, Thekla) |
| `data/levels.package` | `simp` archive: one `<level>.entities` and one `<level>.level_manifest` per level, the `.level_set` lists, one asset manifest |
| `data/materials.package`, `shaders.package`, `animation.package` | materials (text), shaders, animations and sound events |
| `data/strings/*.localization` | one text file per language (`en`, `de`, `es`, `fr`, `it`, `ja`, `ko`, `pt-br`, `ru`, `s-cn`, `t-cn`) plus `subtitles/`. A key line starts with a backtick; its value lines follow up to a blank line. `Language` has a value for each |
| `data/fonts`, `data/sound` | fonts; sound banks (`GeneratedSoundBanks`) |
| `data/*.keymap`, `All.variables`, `Local.variables` | key bindings and variables (text) |
| `data-common/<level>.all_paint_data`, `.all_lightmap_data` | per-level vertex paint and lightmaps, one each per level |
| `data-pc/*.compressed_mesh`, `*.texture` | LZ4-compressed meshes and textures; `data-pc/__<level>.texture` is a level's start-state screenshot |

Saves are not in the game folder ([Levels, level sets and saves](#levels-level-sets-and-saves)). Package and file layouts: [Game data packages](GAMEDATA.md#game-data-packages).

## Levels, level sets and saves

- A level is one `.entities` file: a type table (every entity type, in every level) and a flat entity list. Each level has exactly one `Settings` entity.
- Every entity has a Pid (`namespace << 20 | serial`, written `#ns-serial`), unique only inside its level. References between entities (`unlocked_by_id`, `target_id`, `tower_id`, `map_label_marker_id`, `group_id`, ...) are Pids in the same level.
- `Settings.special_level`: `OVERWORLD` (only `overworld`), `INTRO` (`intro`), `END1` and `HEROES_CAGE_DISAPPEAR` (one level each), `NONE` for every other level.
- A puzzle level is entered from its `Level_Entry` once that entry is enabled, by the TakeOrDrop action while one living hero stands on it ([Winning and other inputs](SKILLS.md#winning-and-other-inputs)). Loading a level gives it a `Level_State_Flags` entry in the campaign status; a win sets `SOLVED` ([Level_Entry unlocking and state](PROGRESSION.md#level_entry-unlocking-and-state)).
- Level sets (`.level_set`) are ordered level lists with `*choice`, `*worlds_collide` and `*glyphs` directives. A few levels are in no set; a level can be in several. Each overworld level is in exactly one set outside `drafts*`, `tests*`, `render_tests*`, `gyms*`, `unplaced_levels` and `design_illustrations`. That set is an authoring group, not an area: one set spans nearly the grid's whole width. `data/progress.json` keeps it per level (`set`).
- `Door` is in nearly every level. The 3 overworld Doors (mesh `GAME_SOKO_Exit_A`) lead to `intro` with `target_link` `~end1`, `~end2`, `~end3`. `Door.switch_to_level_set` switches level sets.
- `Level_State` (Pid `#1021-1` where a level has one) holds per-level runtime state: `misc_flags` (`Level_State_Misc_Flags`), `skipping_stones_treasure_flags`, ...
  - `light_colors_entered` and `light_colors_used` are 32-bit masks with one bit per `Promesst_Power` colour index. `entered` gets bit n when a Guy first stands in a beam of colour n; its only reader is a one-time sound event for the strong beam on the first Promesst level. `used` gets bit n on every move that uses a beam of colour n (with the `character_beam_use_<colour>` events); nothing reads it.
- `Overworld_Unlock` is in 6 levels (`promesst1_streamlined`, `promesst2_streamlined`, `promesst2.5_deeper`, `promesst3_streamlined`, `skipping_stones`, `ingame_particles`). Touching it marks the level `PARTIALLY_SOLVED`.
- Level_Entries outside the overworld: the post-credits ones in `intro`, and one in `end3_promesst_red`. They do not count for completion.
- Some levels wrap their grid (`grid.wrapping`): `overworld`, `intro`, the `torus_*` and `wrapping_mirror*` levels, `promesst1..3_streamlined`, `frontier`, `ortho*` and others.
- `Settings.story_tag` names story levels: `overworld`, `skipping_stones`, `skipping_pals`, `promesst1`..`3`, `magnitudes_intro`.
- Boats exist only in 5 story levels (`skipping_stones`, `skipping_pals`, `end3_skipping_1`, `end3_skipping_red`, `skipping_near_beams_v2`). `Boat.identity` picks a dialogue speaker. The overworld has none.

Saves live in `%USERPROFILE%\Saved Games\Order of the Sinking Star\`: `settings.menu_state` plus one folder per
campaign. A campaign folder holds `Status.sokoban_status` (rank, achievements, per-level flags, opened Freezers,
counters) and one `<level>.history` per level with its kept undo state. Saves go through a save thread that writes
`_temp_<name>` and then replaces the target. A level's `.history` is deleted when the level is won. Status names the
current level until it is saved again, so file times can't tell leaving a level from playing it. Campaign naming and
level-set selection: [Campaigns and level sets](PROGRESSION.md#campaigns-and-level-sets).

## The overworld: coordinates, layers, screens, wrapping

The overworld is ONE level, `overworld` (most of its entities are `Inanimate` scenery). Ground, sky,
underworld and the three map rooms are height bands of the same grid, not separate levels.

### Settings (overworld values)

| Field | Value | What it does |
|---|---|---|
| `grid.corner` | (−24, −2, −102) | world position of grid square (0, 0, 0) |
| `grid.squares_x × squares_y`, `squares_z` | 190 × 156, 212 | grid size; z runs −102..109 |
| `grid.wrapping` | true | positions wrap in x and y |
| `lock_grid` | true | the load keeps the stored grid in x and y; z comes from the stored box joined with the level's contents, and nothing lies above 109 or below −102, the Annihilator's floor ([The grid](GAMEDATA.md#the-grid)) |
| `special_level` | OVERWORLD | turns on the overworld-only rules below (fast-travel wrap, the dry implicit floor, the map handoff) |
| `level_data_version` | 7 | a save made under another version gets its world state reset ([Overworld state from the save](STATE.md#overworld-state-from-the-save)) |
| `per_screen_camera` | true | the camera shows one screen; rooms are screens |
| `squares_per_screen_x/y` | 19 × 13 | screen size |
| `per_screen_camera_corner` | (−24, −2) | screen grid origin |
| `fast_travel_corner`, `fast_travel_extents` | (35, 104), (50, 36) | the box the map rooms wrap in |
| `ground_z0` | 0 (default) | ground floor height |
| `underground_barrier`, `underground_z0` | −4, −25 | below −4 is the underworld; its floor is −25 |
| `skyground_barrier`, `skyground_z0` | 10, 33 | from 10 up is the sky |
| `has_lower_layer`, `has_upper_layer` | true, true | the underworld and sky exist |
| `can_walk_into_water` | true | stepping into water is allowed under the water rules ([Water](MOVEMENT.md#water)) |
| `allow_wizard_swap_from_below` | false (default) | [TELEPORT and PULL](SKILLS.md#teleport-and-pull) |
| `disable_double_beam_falling` | false | never read by the game |
| `force_wrapping_override_despite_per_screen` | false | [Wrapping](#wrapping) |
| `wrapping_override` | 0 (all directions) | `Direction_Flags` EAST 1, NORTH 2, WEST 4, SOUTH 8 |
| `disable_local_area_map` | false | the local area map in the map rooms ([Wrapping](#wrapping)) is on |
| `lily_kickoff_time` | | delay before a kicked lily moves |
| `time_per_skip` | 0.24 | seconds per skipping-stone skip ([Skipping stones](MOVEMENT.md#skipping-stones)) |
| `time_per_rover_update` | 1.0 | seconds between Rover steps ([Rovers](MOVEMENT.md#rovers)); type default 0.6 |
| `story_tag` | `overworld` | |

### Positions and cells

- One grid square is one unit. Positions are floats. The cell of a position is `floor(p + 0.5)` per axis. Grid index `i = round(x) − corner.x`, `j = round(y) − corner.y`.
- The overworld's world coordinates are what the docs use. A position in the docs is a world position unless it says grid index.

### Ground layers

The game builds a layer table from Settings and the three `FAST_TRAVEL` `Camera_Marker` boxes (anchor string
"Expected 3 FAST_TRAVEL Camera_Markers"). Each layer has an index, a z range, a base (its floor height) and a z0.

| Index | Layer | z range | Base / z0 |
|---|---|---|---|
| 0 | ONGROUND | [−4, 10) | 0 |
| 1 | UNDERGROUND | below −4 | −25 |
| 2 | SKYGROUND | [10, 75.16) (the bottom of the lowest FAST_TRAVEL box) | 33, no floor |
| 3, 4, 5 | the three map rooms | [75.157, 84.843], [84.844, 95.855], 95.856 and up | 78, 89, 104 |

- A map-room layer's base is the z of the entity its FAST_TRAVEL `Camera_Marker` names in `overhead_map_id`, or the
  box's middle z without one. On the overworld those are a pad twin in the underworld room (78) and in the ground
  room (89), and a Marker in the sky room (104). Every base lies above its layer's bottom, so a dry fall in a map
  room ends at the base, inside its layer ([Support](MOVEMENT.md#support)).

- A `Group` with `bind_to_layer` (`Group_Layer_Index`: GROUND, SKY, UNDERWORLD, FAST_TRAVEL_GROUND, FAST_TRAVEL_SKY, FAST_TRAVEL_UNDERWORLD) puts its members on that layer whatever their z.
- `data/progress.json` `map.layers` draws underworld z −57..−4, ground −4..10, sky 10..75.16 (−57 is the lowest height drawn), in that order.
- Each layer has its own Level_Entries, Towers and Area_Pins.
- One `Annihilator` sits at z −100. Anything falling below it is annihilated.

### Screens and rooms

- A screen is 19 × 13 squares counted from `per_screen_camera_corner`: column `sx = int((x + 24) / 19)`, row `sy = int((y + 2) / 13)`. The overworld has 10 × 12 = 120 screens per layer (190 = 10 × 19, 156 = 12 × 13).
- A room is one screen within one ground layer. Room key = `sx + sy·10 + layer·120` for the first three layers; each layer beyond the third is one room; a z outside every layer uses the nearest layer below. Columns and rows are clamped to the screen grid. Without `per_screen_camera` the whole level is one room.
- Rooms decide: which Gem_Slots power a Promesst_Light (in a map room, every slot on the layer powers every light there) ([Promesst beams and powers](MOVEMENT.md#promesst-beams-and-powers)), which Monsters hold a monster gate shut ([Gates, switches and buttons](MOVEMENT.md#gates-switches-and-buttons)), which mirrors take part in a magic-mirror activation ([Magic mirrors](MOVEMENT.md#magic-mirrors)), and fog regions (one region per screen, [Fog of war](STATE.md#fog-of-war)).

### Wrapping

- Positions wrap in x and y, never in z. Every move record wraps its start and target, so stored positions always lie inside the grid. The arithmetic is one ± period correction in float before rounding: `d = p − corner; if d < 0: d += size; if d ≥ size: d −= size`.
- The box depends on z. Below the fast-travel threshold the period is the grid: 190 × 156 from (−24, −2), shared by underworld, ground and sky. At or above the threshold the period is the fast-travel box: corner (35, 104), size (50, 36), so x 35..84, y 104..139. The threshold is (bottom of the lowest FAST_TRAVEL `Camera_Marker` box − 0.001) − 0.5 = 74.656, so integer z ≥ 75 wraps in the box. Only OVERWORLD sets a threshold; every other level uses +∞.
- The grid period is the level's cell grid, built at load from the computed `Settings.grid` (its squares and corner, [The grid](GAMEDATA.md#the-grid)); a cell grid of the same size that already exists is kept, corner included. The fast-travel box is `fast_travel_corner` and `fast_travel_extents`.
- Walking off a map room's edge comes back at its opposite edge. Map-room walls at y 103 and y 140 lie outside the box and are never reached.
- Lines step one square at a time and wrap at each step: dragon fire, the wizard's TELEPORT line, Promesst beams, magic-mirror rays. Fire, the wizard line and beams have no length cap: a line that meets nothing ends after one lap, back at its start (a beam at its own light, which stops it). Magic-mirror rays stop after max(100, squares_x, squares_y) = 190 squares; the mirror's return trace is capped at twice the outgoing length.
- A 101-cell beam cap exists in code only behind a flag that nothing sets: no beam cap in play.
- Box tests (Markers, Camera_Markers, Fog_Of_War boxes, Fog_Volume, Audio_Marker, ...) move the point to its copy nearest the box (± one period), so a box crossing the seam covers both sides. For visual moves, the camera and box tests, a point more than half a period away is moved by one period.
- The fog region index does not wrap; callers pass wrapped positions. The `Fog_Of_War_Clear` neighbour chain floor-mods screen indices by 10 × 12 on wrapping levels.
- Skipping stones and lily drift add their steps through the same move-record builder, so they wrap too. The builder wraps only in a level with `grid.wrapping`.
- Every move target wraps the same way: walks, DOUBLE moves, pushes, pulls, charm moves and jumps. The period is the level grid, or the fast-travel box at or above the threshold z, the same rule as the TELEPORT line. Both axes always wrap here; `wrapping_override` is not read.
- `Level_State.misc_flags` UPSTAIRS_HAS_EVER_WRAPPED (128) / DOWNSTAIRS_HAS_EVER_WRAPPED (256): set when a hero move (CHARMED, PULLED, PUSHED, LINEAR, SUPPORT, CONTROLLER_PROC, LILY or SKIP) covers more than `squares_x / 2`, i.e. it wrapped. DOWNSTAIRS when the hero is in the underground layer, else UPSTAIRS. In a level with `Wrapping_Mask` entities (only `promesst1..3_streamlined`) the copies across the seam stay hidden until the hero has wrapped on that layer once.

Drawing and the TAB map:

- The world is drawn once per copy offset: the main copy and copies one period away (0, ±W, ±H; in the map-room layers ±50, ±36).
- In normal view, a `per_screen_camera` level without `force_wrapping_override_despite_per_screen` draws only the near-side copies: the main one, one east or west, one north or south and the diagonal between, picked by comparing the camera centre (relative to `per_screen_camera_corner`, or the fast-travel box on layers 3+) with half the period. Otherwise all 8 neighbours plus the main copy are drawn, filtered by `wrapping_override` (a set bit allows that direction, a diagonal needs both bits, 0 = all).
- The camera has map modes: 0 normal, 1 the overhead (TAB) map, 2 the local area map. Two blend weights (local, overhead) ease toward (0,0) in mode 0, (0,1) in mode 1 and (1,0) in mode 2. Any non-zero blend draws all copies. On a `per_screen_camera` level `action_toggle_overhead_map` (TAB) toggles mode 0 ↔ 1, and 2 → 1. The story event `overhead_map` forces mode 1 and locks the toggle until `overhead_map_release`.
- The local area map (mode 2). On the overworld, while the active hero stands inside a FAST_TRAVEL `Camera_Marker` box (a map room), TAB works the local area map instead: 0 ↔ 2, and 1 → 0. It needs `disable_local_area_map` off and at least one map scroll taken (`enabled_alternate_views` not empty, [Collectibles](ENTITIES.md#collectibles)); otherwise TAB does nothing there. Outside those boxes TAB is the overhead map toggle above. The local area map is its own input action, which TAB calls inside a box; outside the boxes that action toggles 0 ↔ 2 on a `per_screen_camera` level. The prompt reads "overhead_map_local" inside a box, "overhead_map_full" elsewhere and "overhead_map_exit" while a map is open.
  - Framing: inside a box the camera's local-map box is the hero's current room box; on a map-room layer that is a 16.67 × 9 screen counted from `fast_travel_corner`. If mode 2 is still on outside the boxes, the box is 3 × 3 screens around the hero's screen (its centre ± 1.5 screens), panning by 3 screens when he passes an edge, with no room margin.
  - What it shows: the normal world draw, framed on that box (inferred). Only the current ground layer's scenery groups are drawn, those above the camera's z hidden. The overhead-only overhang groups need an overhead weight over 0.5, so they never show in mode 2. Mode 2 draws no map overlays: the Level_Entry markers and the Area_Pin name labels need the overhead weight, which is 0 there, and a layer of 2 or less, so they never show inside a map room. The area-name toggle (`action_activate`) works only in mode 1.
  - The HUD draws only `current_area_pin`'s `local_area_name` and `local_area_image` ([Areas](STATE.md#areas)).
- Overhead map bounds (anchor "Could not figure out the overhead view bounds"): by default the grid, [corner − 0.5, corner + size − 0.5]. With the overhead `Camera_Controls` flag `adjust_to_explored_fog`: the box of cleared fog screens on the layer, at least 5 × 5 screens (95 × 65 = MAIN_MAP_INITIAL_BOUNDS) plus a 4-square pad. An axis where that box touches both grid edges takes the layer's MAIN_MAP `Camera_Marker` box instead: ground centre (79, 76) extents (94.6, 78.9); sky (70.2, 77), (94.4, 78.9); underworld (80, 77), (84.6, 78.9). Half-height = max(bounds_w × window_h / window_w, bounds_h) / 2: the bounds fit on both axes. The view centres on the bounds' centre, so the fully zoomed-out ground map centres near x 79, not on the grid centre 70.5.
- The ocean band on the TAB map is land, not the seam: the easternmost screen column (x 147..165) has far fewer land squares per column than most others.

### Map rooms

- Each map room is the whole 190 × 156 world scaled into the fast-travel box: x scale 0.263, y 0.233, offsets 40.9 / 104.0, largest error 1.5 cells. Room z: underworld twins at 78, ground at 89, sky at 105 (one at 109). The FAST_TRAVEL markers at (60, 122) ± (25.4, 18.8) match the box.
- Every MAJOR pad on a layer has a twin in a map room (ground ↔ room at z 89, underworld ↔ z 78, sky ↔ z 105). Every twin targets its world pad.
- Map-room geometry is existence-group content ([Existence groups](ENTITIES.md#existence-groups)): most of it is absent until a pad's discovery makes its Group exist.
- A map-room layer is one room ([Screens and rooms](#screens-and-rooms)), so the whole z 78 room is a single room for Gem_Slot power and for magic Mirrors.
- Three twin links in the underworld room (z 78) need a mechanic to walk:
  - (55, 114, 78) → (48, 117, 78), FUGreenBeamRoom → FUZap, through the THROUGH Promesst_Light at (58, 114, 78). The room's only Gem_Slot (59, 114, 78), the Gem on it and the light are all members of Group FUGreenBeamRoom. The room powers the moment that Group exists, and the beam comes on ("beam_on"), so the link opens on its own. It is a fast-travel link only: the pocket at (52, 42, −21) is entered and left on foot along the THROUGH beam of the light at (59, 42, −21), whose Freezer is opened by `breaking_bread`. The far twin (48, 117) is also enabled by the twin (53, 112, 78).
  - (72, 130, 78) → (72, 125, 78), FUThiefMirrorableMirror → FUMirrorableMirror, through the magic Mirror at (71, 126, 78): the hero goes (71, 127) → (72, 126), then south onto the pad. Magic Mirrors use no room power, and the hero stands in the Mirror's room (the whole layer), so ACTIVATE works there unpowered ([Magic mirrors](MOVEMENT.md#magic-mirrors)). It is the only way from the pocket at (118, 112, −21) to the one at (121, 90, −21), which is otherwise entered only through its own pad.
  - (45, 124, 78) → (49, 123, 78), FURoverstravaganzaSouth → FUCrystalRover: a small island in deep water, reached by riding the `mirrorable` Rover at (47, 124, 77), θ 0. The Rover sits in a Freezer whose `unlocked_by_id` is the Level_Entry `mirror_crystal_rover` (30, 86, −21), so it can drive only after that level is solved. The Rover, its Freezer and the pad (49, 123, 78) are members of FUCrystalRover, which does not exist by default. The twin (45, 124, 78) starts disabled, and only its world pad (18, 87, −21) enables it; that pad lies inside the closed underworld pocket of `crystal_rover_*`, `perch_3_rovers`, `triple_skip` and `quadruple_skip`. Its `also_discover` enables (49, 123) and so makes the Rover exist. So the ride is that pocket's way out, to (32, 83, −21) in the main underworld region, never its way in: riding west from (49, 123) the hero arrives on a disabled twin. Where the Rover's track stops (the fenced east edge of (49, 124)) and boarding at (46, 124) are inferred.
