# The game folder and the overworld

The game folder, levels, level sets and saves, and the overworld: its coordinates, ground layers, screens and rooms,
wrapping and map rooms.

## Game folder

| Path                                                             | Contents                                                                                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `sinking_star.exe`                                               | the game (Jai, Thekla)                                                                                                        |
| `data/levels.package`                                            | `simp` archive: one `<level>.entities` and one `<level>.level_manifest` per level, the `.level_set` lists, one asset manifest |
| `data/materials.package`, `shaders.package`, `animation.package` | materials, shaders, animations and sound events                                                                               |
| `data/strings/*.localization`                                    | one text file per language plus `subtitles/`. A key line starts with a backtick; its value lines follow up to a blank line    |
| `data/fonts`, `data/sound`, `data/*.keymap`, `*.variables`       | fonts, sound banks, key bindings, variables                                                                                   |
| `data-common/<level>.all_paint_data`, `.all_lightmap_data`       | per-level vertex paint and lightmaps                                                                                          |
| `data-pc/*.compressed_mesh`, `*.texture`                         | LZ4-compressed meshes and textures; `data-pc/__<level>.texture` is a level's start-state screenshot                           |

Saves are not in the game folder ([Levels, level sets and saves](#levels-level-sets-and-saves)). Package and file layouts: [Game data packages](gamedata.md#game-data-packages).

## Levels, level sets and saves

- A level is one `.entities` file: a type table and a flat entity list, with exactly one `Settings` entity.
- Every entity has a Pid (`namespace << 20 | serial`, written `#ns-serial`), unique only inside its level. References between entities (`unlocked_by_id`, `target_id`, `tower_id`, `group_id`, ...) are Pids in the same level.
- `Settings.special_level`: `OVERWORLD` (only `overworld`), `INTRO` (`intro`), `END1` and `HEROES_CAGE_DISAPPEAR` (one level each), `NONE` for every other level.
- A puzzle level is entered from its `Level_Entry` once that entry is enabled, by the TakeOrDrop action while one living hero stands on it ([Winning and other inputs](skills.md#winning-and-other-inputs)). Loading a level gives it a `Level_State_Flags` entry in the campaign status; a win sets `SOLVED` ([Level_Entry unlocking and state](progression.md#level_entry-unlocking-and-state)).
- Level sets (`.level_set`) are ordered level lists with `*choice`, `*worlds_collide` and `*glyphs` directives. A few levels are in no set; a level can be in several. Each overworld level is in exactly one set outside `drafts*`, `tests*`, `render_tests*`, `gyms*`, `unplaced_levels` and `design_illustrations`. That set is an authoring group, not an area.
- `Door` is in nearly every level. The 3 overworld Doors (mesh `GAME_SOKO_Exit_A`) lead to `intro` with `target_link` `~end1`, `~end2`, `~end3`. `Door.switch_to_level_set` switches level sets.
- `Level_State` (Pid `#1021-1` where a level has one) holds per-level runtime state: `misc_flags` (`Level_State_Misc_Flags`), `skipping_stones_treasure_flags`, ...
- `Overworld_Unlock` is in `promesst1_streamlined`, `promesst2_streamlined`, `promesst2.5_deeper`, `promesst3_streamlined`, `skipping_stones` and `ingame_particles`. Touching it marks the level `PARTIALLY_SOLVED`.
- Level_Entries outside the overworld (the post-credits ones in `intro`, one in `end3_promesst_red`) do not count for completion.
- Some levels wrap their grid (`grid.wrapping`): `overworld`, `intro`, the `torus_*` and `wrapping_mirror*` levels, `promesst1..3_streamlined`, `frontier`, `ortho*` and others.
- `Settings.story_tag` names story levels: `overworld`, `skipping_stones`, `skipping_pals`, `promesst1`..`3`, `magnitudes_intro`.

Saves live in `%USERPROFILE%\Saved Games\Order of the Sinking Star\`, one folder per campaign. A campaign folder holds
`Status.sokoban_status` and one `<level>.history` per level with its kept undo state. Saves go through a save thread
that writes `_temp_<name>` and then replaces the target. On exit, the `.history` of a won puzzle level is deleted ([Files and versions](saves.md#files-and-versions)).
Campaign naming and level-set selection: [Campaigns and level sets](progression.md#campaigns-and-level-sets).

## The overworld: coordinates, layers, screens, wrapping

The overworld is ONE level, `overworld` (most of its entities are `Inanimate` scenery). Ground, sky,
underworld and the three map rooms are height bands of the same grid, not separate levels.

### Settings (overworld values)

| Field                                        | Value               | What it does                                                                                                                                  |
| -------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `grid.corner`                                | (−24, −2, −102)     | world position of grid square (0, 0, 0)                                                                                                       |
| `grid.squares_x × squares_y`, `squares_z`    | 190 × 156, 212      | grid size; z runs −102..109                                                                                                                   |
| `grid.wrapping`                              | true                | positions wrap in x and y                                                                                                                     |
| `lock_grid`                                  | true                | the load keeps the stored grid in x and y; nothing lies above z 109 or below −102, the Annihilator's floor ([The grid](gamedata.md#the-grid)) |
| `special_level`                              | OVERWORLD           | turns on the overworld-only rules (fast-travel wrap, the dry implicit floor, the map handoff)                                                 |
| `level_data_version`                         | 7                   | a save made under another version gets its world state reset ([Overworld state from the save](state.md#overworld-state-from-the-save))        |
| `per_screen_camera`                          | true                | the camera shows one screen; rooms are screens                                                                                                |
| `squares_per_screen_x/y`                     | 19 × 13             | screen size                                                                                                                                   |
| `per_screen_camera_corner`                   | (−24, −2)           | screen grid origin                                                                                                                            |
| `fast_travel_corner`, `fast_travel_extents`  | (35, 104), (50, 36) | the box the map rooms wrap in                                                                                                                 |
| `underground_barrier`, `underground_z0`      | −4, −25             | below −4 is the underworld; its floor is −25                                                                                                  |
| `skyground_barrier`, `skyground_z0`          | 10, 33              | from 10 up is the sky                                                                                                                         |
| `can_walk_into_water`                        | true                | [Water](movement.md#water)                                                                                                                    |
| `allow_wizard_swap_from_below`               | false               | [TELEPORT and PULL](skills.md#teleport-and-pull)                                                                                              |
| `force_wrapping_override_despite_per_screen` | false               | [Wrapping](#wrapping)                                                                                                                         |
| `wrapping_override`                          | 0 (all directions)  | `Direction_Flags` EAST 1, NORTH 2, WEST 4, SOUTH 8                                                                                            |
| `time_per_skip`, `time_per_rover_update`     | 0.24, 1.0           | seconds per skipping-stone skip ([Skipping stones](movement.md#skipping-stones)) and between Rover steps ([Rovers](movement.md#rovers))       |

### Positions and cells

- One grid square is one unit. Positions are floats. The cell of a position is `floor(p + 0.5)` per axis. Grid index `i = round(x) − corner.x`, `j = round(y) − corner.y`.
- The overworld's world coordinates are what the docs use. A position in the docs is a world position unless it says grid index.

### Ground layers

The game builds a layer table from Settings and the three `FAST_TRAVEL` `Camera_Marker` boxes. Each layer has an index, a z range, a base (its floor height) and a z0.

| Index   | Layer               | z range                                                | Base / z0    |
| ------- | ------------------- | ------------------------------------------------------ | ------------ |
| 0       | ONGROUND            | [−4, 10)                                               | 0            |
| 1       | UNDERGROUND         | below −4                                               | −25          |
| 2       | SKYGROUND           | [10, 75.16) (the bottom of the lowest FAST_TRAVEL box) | 33, no floor |
| 3, 4, 5 | the three map rooms | [75.157, 84.843], [84.844, 95.855], 95.856 and up      | 78, 89, 104  |

- A map-room layer's base is the z of the entity its FAST_TRAVEL `Camera_Marker` names in `overhead_map_id`, or the
  box's middle z without one: a pad twin in the underworld room (78) and in the ground room (89), a Marker in the
  sky room (104). A dry fall in a map room ends at the base ([Support](movement.md#support)).
- A `Group` with `bind_to_layer` (`Group_Layer_Index`: GROUND, SKY, UNDERWORLD, FAST_TRAVEL_GROUND, FAST_TRAVEL_SKY, FAST_TRAVEL_UNDERWORLD) puts its members on that layer whatever their z.
- `data/progress.json` `map.layers` draws underworld z −57..−4, ground −4..10, sky 10..75.16, in that order.
- Each layer has its own Level_Entries, Towers and Area_Pins.
- One `Annihilator` sits at z −100. Anything falling below it is annihilated.

### Screens and rooms

- A screen is 19 × 13 squares counted from `per_screen_camera_corner`: column `sx = int((x + 24) / 19)`, row `sy = int((y + 2) / 13)`. The overworld has 10 × 12 screens per layer.
- A room is one screen within one ground layer. Room key = `sx + sy·10 + layer·120` for the first three layers; each map-room layer is one room. Without `per_screen_camera` the whole level is one room.
- Rooms decide: which Gem_Slots power a Promesst_Light (in a map room, every slot on the layer powers every light there; [Promesst beams and powers](movement.md#promesst-beams-and-powers)), which Monsters hold a monster gate shut ([Gates, switches and buttons](movement.md#gates-switches-and-buttons)), which mirrors take part in a magic-mirror activation ([Magic mirrors](movement.md#magic-mirrors)), and fog regions ([Fog of war](state.md#fog-of-war)).

### Wrapping

- Positions wrap in x and y, never in z, with one ± period correction before rounding: `d = p − corner; if d < 0: d += size; if d ≥ size: d −= size`.
- The period depends on z. Below the fast-travel threshold it is the grid: 190 × 156 from (−24, −2), shared by underworld, ground and sky ([The grid](gamedata.md#the-grid)). At or above the threshold it is the fast-travel box: corner (35, 104), size (50, 36), so x 35..84, y 104..139. The threshold is 74.656 (the bottom of the lowest FAST_TRAVEL box − 0.501), so integer z ≥ 75 wraps in the box. Only OVERWORLD sets a threshold; every other level uses +∞.
- Lines step one square at a time and wrap at each step: dragon fire, the wizard's TELEPORT line, Promesst beams, magic-mirror rays. Fire, the wizard line and beams have no length cap: a line that meets nothing ends after one lap. Magic-mirror rays stop after 190 squares; the mirror's return trace is capped at twice the outgoing length.
- Box tests (Markers, Camera_Markers, Fog boxes, Audio_Marker, ...) use the point's copy nearest the box (± one period), so a box crossing the seam covers both sides.
- Every move target wraps the same way: walks, DOUBLE moves, pushes, pulls, charm moves, jumps, skipping stones and lily drift. The period is the level grid, or the fast-travel box at or above the threshold z. Both axes always wrap; `wrapping_override` is not read for moves.
- `Level_State.misc_flags` UPSTAIRS_HAS_EVER_WRAPPED (128) / DOWNSTAIRS_HAS_EVER_WRAPPED (256): set when a hero move covers more than `squares_x / 2`, i.e. wrapped; DOWNSTAIRS when the hero is in the underground layer, else UPSTAIRS. In a level with `Wrapping_Mask` entities (only `promesst1..3_streamlined`) the copies across the seam stay hidden until the hero has wrapped on that layer once.

Drawing and the TAB map:

- The world is drawn once per copy offset: the main copy and copies one period away (0, ±W, ±H; in the map-room layers ±50, ±36). A `per_screen_camera` level without `force_wrapping_override_despite_per_screen` draws only the near-side copies, picked by comparing the camera centre with half the period. Otherwise all 8 neighbours plus the main copy are drawn, filtered by `wrapping_override`.
- The camera has map modes: 0 normal, 1 the overhead (TAB) map, 2 the local area map. Any non-zero map blend draws all copies. TAB toggles 0 ↔ 1, and 2 → 1. The story event `overhead_map` forces mode 1 until `overhead_map_release`.
- The local area map (mode 2): while the active hero stands inside a FAST_TRAVEL `Camera_Marker` box (a map room), TAB toggles 0 ↔ 2, and 1 → 0. It needs `disable_local_area_map` off and at least one map scroll taken ([Collectibles](entities.md#collectibles)); otherwise TAB does nothing there. It frames the hero's current room box and draws no map overlays. The HUD draws only `current_area_pin`'s `local_area_name` and `local_area_image` ([Areas](state.md#areas)).
- Overhead map bounds: by default the grid. With the overhead `Camera_Controls` flag `adjust_to_explored_fog`: the box of cleared fog screens on the layer, at least 5 × 5 screens plus a 4-square pad. An axis where that box touches both grid edges takes the layer's MAIN_MAP `Camera_Marker` box instead.

### Map rooms

- Each map room is the whole 190 × 156 world scaled into the fast-travel box: x scale 0.263, y 0.233, offsets 40.9 / 104.0. Room z: underworld 78, ground 89, sky 105.
- Every MAJOR pad on a layer has a twin in its map room. Every twin targets its world pad.
- Map-room geometry is existence-group content ([Existence groups](entities.md#existence-groups)): most of it is absent until a pad's discovery makes its Group exist.
- A map-room layer is one room ([Screens and rooms](#screens-and-rooms)).
- Three twin links in the underworld room (z 78) need a mechanic to walk:
    - (55, 114, 78) → (48, 117, 78), FUGreenBeamRoom → FUZap, through the THROUGH Promesst_Light at (58, 114, 78). The room's Gem_Slot, Gem and light are members of Group FUGreenBeamRoom, so the link opens on its own.
    - (72, 130, 78) → (72, 125, 78), FUThiefMirrorableMirror → FUMirrorableMirror, through the magic Mirror at (71, 126, 78): the hero goes (71, 127) → (72, 126), then south onto the pad. Magic Mirrors use no room power ([Magic mirrors](movement.md#magic-mirrors)). It is the only way from the pocket at (118, 112, −21) to the one at (121, 90, −21).
    - (45, 124, 78) → (49, 123, 78), FURoverstravaganzaSouth → FUCrystalRover: an island reached by riding the `mirrorable` Rover at (47, 124, 77), θ 0. Its Freezer is unlocked by the Level_Entry `mirror_crystal_rover` (30, 86, −21). The Rover, its Freezer and the pad (49, 123, 78) are members of FUCrystalRover, which exists only once the twin (45, 124, 78), enabled by its world pad (18, 87, −21), has discovered it. The ride leaves the closed underworld pocket of `crystal_rover_*`, `perch_3_rovers`, `triple_skip` and `quadruple_skip` for (32, 83, −21); it never enters it.
