# Entities

The overworld's entity types, the existence groups that make entities appear and vanish together, and the collectibles.

## Entity catalogue

"Blocks" = the hero can't enter the cell; "pushed" =
[Pushing and pulling](MOVEMENT.md#pushing-and-pulling); "supports" = holds up what stands on it ([Support](MOVEMENT.md#support)).

| Type | Fields that matter | Movement effect |
|---|---|---|
| `Wall_Set` | `kind` (`WALLS`, `OCEAN_HOLE`), `wall_data` voxel bitset, `ocean_hole_id`, `base.group_id` | WALLS: solid voxels, placed by the set's position and orientation ([Wall_Set `wall_data` (voxels)](GAMEDATA.md#wall_set-wall_data-voxels)); block, support; put their columns inside the level ([Support](MOVEMENT.md#support)). OCEAN_HOLE: clears water squares of the Ocean_Map `ocean_hole_id` names (`detect_holes`) |
| `Fence` | `blocking`, `is_floor`, rotation, `belongs_to_tree` | `blocking` + axis-aligned: closes the cell edge its +x axis points to (most Fences). `blocking` + `is_floor`: a floor at the bottom of its own cell. `is_solid_wall` + `blocking` refuses a magic-mirror ray in the map rooms ([Magic mirrors](MOVEMENT.md#magic-mirrors)); a floor Fence puts its column inside the level ([Support](MOVEMENT.md#support)); `blocks_flat_things_above` concerns flat entities; `belongs_to_tree` fences die with their tree |
| `Gate` | `open`, `flavor`, `notted`, `is_monster_gate`, `room_index`, mesh | blocks its whole cell while closed; a closed Gate below supports. `sideways` / `negate_direction` pick the direction a closing gate pushes in ([Gates, switches and buttons](MOVEMENT.md#gates-switches-and-buttons)). Glyph gates use mesh `GAME_SOKO_Gate_Glyph_Promesst`; no Switch shares their `flavor` |
| `Switch` | `flavor`, `pressed`, `special_type` (NORMAL on all), `existence_group` (0 on all) | drives the Gates of its `flavor` ([Gates, switches and buttons](MOVEMENT.md#gates-switches-and-buttons)) |
| `Freezer` | `unfrozen`, `unlocked_by_id`..`id4`, `unlock_is_or_gate`, `partial_solve_count`, `judge_unlock_level`, `color_frozen` | one-square ice block; blocks while frozen; a frozen one below supports. On every layer, the map rooms included. Two models: A (`GAME_OVER_Freezer_A`), a pod, often standing around a rock or a level entry; B (`GAME_OVER_Freezer_B`), a doorway turned to stand across a passage, mostly with walls, fences or drops on both sides. The model is only looks: a frozen Freezer of either model blocks its square from all four sides, and the rules read only `unfrozen` ([A move](MOVEMENT.md#a-move)). `color_frozen` tints it (looks only) |
| `Rock` | `properties` (`Rock.properties`: MIRRORABLE 1, SKIPPABLE 2, SKIPPING 4, FLIPPING_TARGET 8, CANNOT_MIRROR_TELEPORT_UNTIL_ANOTHER_SKIP_HAPPENS 16, SINK_IMMEDIATELY_... 128, NO_RUBBLE 256), `transmuted_from_entity_type`, `transmute_spawner_source_id`, `move_theta`, `num_out_of_bounds_skips` | supports; pushed; sinks or skips in water ([Objects in water](MOVEMENT.md#objects-in-water), [Skipping stones](MOVEMENT.md#skipping-stones)). MIRRORABLE ones are crystals and some skipping stones; SKIPPABLE ones are the skipping stones |
| `Promesst_Light` | `color` (`Promesst_Power`), `powered`, `vertical_up`, `vertical_down`, facing | supports; pushed; casts a beam while `powered` ([Promesst beams and powers](MOVEMENT.md#promesst-beams-and-powers)). ENDPOINT and DOUBLE are the most common colours, GEM the rarest |
| `Gem` | `inventory_index`, `attached_to_entity_id` | supports (not a TAKE_GEMS Guy); pushed; TAKE_GEMS takes it with T, and a carried Gem is off the grid ([TRANSMUTE and the other skills](SKILLS.md#transmute-and-the-other-skills)); fills `Gem_Slot`s |
| `Gem_Slot` | | powers its room's lights when every slot holds a Gem ([Promesst beams and powers](MOVEMENT.md#promesst-beams-and-powers)) |
| `Mirror` | `is_magic`, `is_vertical`, `is_vertical_downward`, `mirrorable`, `theta_target` | pushed; turns fire and beams ([Mirrors turning fire and beams](MOVEMENT.md#mirrors-turning-fire-and-beams)); a magic one teleports ([Magic mirrors](MOVEMENT.md#magic-mirrors)); an `is_vertical` Mirror supports the cell above |
| `Rover` | `forward`, `stalled`, `mirrorable` (a few) | supports, so it carries what stands on it; drives itself ([Rovers](MOVEMENT.md#rovers)); pushed |
| `Monster` | `constant_flags` (GOBLIN or DRAGON), `theta_target`, `dead_t`, `status_flags` DEAD | pushed; supports; goblin attack and dragon fire ([Goblins, dragons and PROTECTION](MOVEMENT.md#goblins-dragons-and-protection)); drowns in water. A DEAD one is inert: it blocks nothing, holds nothing up and is never pushed ([Support](MOVEMENT.md#support)) |
| `Friendly_Dragon` | `following_id` | pushed; supports (unless the mover is a Gem); breathes no fire; follows the hero when toggled (`TOGGLE_FRIENDLY_DRAGON`). The overworld's stands at (26, 16, 0) |
| `Tree` | | blocks (can't be pushed); supports; TRANSMUTE turns it into a crystal (its root fences go) |
| `Sign` | `demo_phase`, `unlock_freezers_with_rank`, `tower_id`, `gold_room_connection_unlocker`, `display_hook` | blocks; supports. A Sign whose `demo_phase` is not FULL_GAME does not exist in the full game; the overworld has demo Signs too |
| `Treasure_Display` | `treasure_index` | blocks; supports |
| `Judge` | | solid-like (blocks, supports) where present; none on the overworld |
| `Egg` | | stops beams where present; none on the overworld |
| `Lily` | `moving_direction`, `kick_direction`, `movement_group` | holds what stands in its cell; drifts on rivers ([Lilies](MOVEMENT.md#lilies)). The `nonmoving` ones are in the map rooms |
| `Ocean_Map` | `ocean_values`, `kind` (NORMAL_OCEAN, PLAYER_BLOCKING_ONLY, ...), `detect_holes`, z = surface | water ([Water](MOVEMENT.md#water)), rivers ([Rivers](MOVEMENT.md#rivers)). Not all are drawn on the map |
| `Stairs` / `Elevator_Platform` | `other_end_id`, `platform_id`; `bottom_owner`, `top_owner`, `seconds_per_square` | elevators ([Elevators](MOVEMENT.md#elevators)): two Stairs per platform |
| `Teleporter` | `teleporter_type`, `target_id`, `also_discover`, `also_discover2`, `enabled_t_target`, `discovered`, `gold_room_endpoint`, `group_id`, `also_exist_this_group_id` | passable; pads ([Teleporter pads and fast travel](MOVEMENT.md#teleporter-pads-and-fast-travel)), MAJOR and MINOR. One MINOR pad rides a Rover along y |
| `Wardrobe` | `skill_flags`, `inventory_flags`, facing | passable from every side; the door edge changes the skill ([Wardrobes](SKILLS.md#wardrobes)). PROTECTION, another skill, or inventory only |
| `Activator` | `spawner_1`..`spawner_16` | ACTIVATE while standing on it respawns its Spawners ([Activators and Spawners](MOVEMENT.md#activators-and-spawners)) |
| `Spawner` | `prototype_entity_to_clone`, `spawned_entity_id`, `activator_1/2`, `ocean_resetter`, `gate_resetter`, `skill_flags` | respawns: most often Rocks, then Monsters, Mirrors, Lights, Lilies, Gems, Rovers, Gates and Trees, a few Teleporters and Ocean_Maps, and rarely an Elevator_Platform or a Switch |
| `Marker` | `script_name`, `float_parameter`, `boolean_argument`, `script_target_entity_id`, `props.box_extents`, `is_point_marker`, `bark_flags` | `local_area` boxes; `grant_rank`; `may_jump_into_water`; `FastTravelEnableGroup`, `FastTravelDiscoverTeleporter`, `SmashFastTravelRock`; `wait_for_fall`; teleporter targets; `diagonal_push_okay` (only in `skipping_pals`); `stop_flow_erasure` (none on the overworld) |
| `Group` | `is_existence_group`, `exists`, `exists_by_default`, `bind_to_layer`, `unexist_this_id`/`2`/`3` | [Existence groups](#existence-groups) |
| `Door` | `target_link` | passable; leaves to `intro` |
| `Level_Entry` | [Level_Entry unlocking and state](PROGRESSION.md#level_entry-unlocking-and-state) | passable: blocks no move, the hero's or a pushed thing's ([A move](MOVEMENT.md#a-move)); the hero enters the level with TakeOrDrop while he stands on it ([Winning and other inputs](SKILLS.md#winning-and-other-inputs)) |
| `Area_Pin` | `local_area_name`, `local_area_image`, `map_label_marker_id`, `activated` | passable; [Areas](STATE.md#areas) |
| `Tower` | `tower_flags`, `levels_required`, `teleporter_id`, `activated` | [Level_Entry unlocking and state](PROGRESSION.md#level_entry-unlocking-and-state) |
| `Rubble` | `rubble_type`, `source_entity_id` | left by a smash ([Promesst beams and powers](MOVEMENT.md#promesst-beams-and-powers)). Walkable: doesn't block, can't be pushed, supports nothing (things fall through it), no push or elevator weight, not a TELEPORT target. A flat thing (Rubble, Door, Switch, ...) inside a solid voxel does block movers |
| `Voice_Log`, `View_Giver`, `Fog_Of_War*`, `Fog_Volume`, `Statue`, `Level_State`, `Camera_*`, `Sky`/`Sun`/`Wind`, `Animating`, `Inanimate`, lights, decals, audio, particles | | passable or cosmetic |
| `Guy` | `skill_flags`, `inventory_flags`, `pre_protected`, `protected`, `supported_by_id`, `colors_struct` | the hero. The only one on the overworld: no Spawner makes a Guy |
| `Boat` | `identity` | only in a few story levels; none on the overworld |

The cell lookup that every gameplay test uses (moves, support, pushes, contacts) skips some entities; [Existence groups](#existence-groups).

## Existence groups

- A `Group` with `is_existence_group` makes its members appear and vanish together.
- Load: the level-load post pass, game branch, calls `change_existence_group_status(exists_by_default, force)` on every existence Group, prelude Groups and the rest alike. `exists` becomes `exists_by_default`; the stored `exists` is ignored. Every direct member (`base.group_id` = the Group, EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY members left out) gets IN_EXISTENCE_GROUP and CURRENTLY_EXISTS = the status; switching a Group off clears CURRENTLY_EXISTS on every member but Inanimate ones. It recurses into member Groups that are existence groups (depth cap 21). The CURRENTLY_EXISTS stored on members in the level data is stale editor state in every level; the load overwrites it. The same pass sets `Level_State.misc_flags` DOING_PRELUDE when `Settings.has_prelude` is set.
- Prelude rooms stand on floor Fences (`blocking`, `is_floor`) that are PLAYABLE_IN_PRELUDE and members of the prelude Group; they hold up what stands in their own cell ([Support](MOVEMENT.md#support)). PLAYER_BLOCKING_ONLY Ocean_Maps may cover holes in that floor: the hero's water step check refuses a step into a hole with no support in reach, and a Rock pushed over one falls ([Water](MOVEMENT.md#water)). Completing the prelude switches the prelude Groups off and re-checks what they held ([Winning and other inputs](SKILLS.md#winning-and-other-inputs)).
- The only Groups whose `exists` differs from `exists_by_default` in the package are FTEnd2 (stored 1, default 0, so off at load) and BridgeExistenceA (no members). So a member exists at load iff its Group exists by default. Some entities outside existence Groups carry IN_EXISTENCE_GROUP + CURRENTLY_EXISTS and keep them.
- The package flags many map-room members CURRENTLY_EXISTS while their Group is off, mostly Wall_Sets and Fences. The load pass turns them off. So a save's Wall_Set existence CHANGEs go 0 → 1.
- Then `load_level` loads the history, which restores Group `exists` and member `entity_flags`. Only when the history loaded, it walks every existence Group and calls `change_existence_group_status(exists, force)` again on each whose restored `exists` differs from the status applied at load, which reaches its members and subgroups.
- Making a Group exist recurses into its existence subgroups, except a subgroup named by `unexist_this_id`/`2`/`3` of a Group that exists at that moment (with a Settings byte set, only Groups of the same `bind_to_layer` count). Those ids are read nowhere else; nothing actively unexists a Group. The `X_*` connector caps in the map rooms work this way: a child of one area, unexisted by the neighbouring area.
- What toggles Groups: Teleporter enable (`group_id`, `also_exist_this_group_id`), `FastTravelEnableGroup` Markers, a Switch with `existence_group` (none on the overworld), story and subtitle events (`cage_disappear`, `magistrate_group`, `egg_hatch`), Judge puzzles, RubbleDisappear, Hedron/Activate, level load and transitions.
- Entering existence sets CURRENTLY_EXISTS and clears INVISIBLE_IN_A_TOGGLABLE_WAY (the reverse on leaving); Ocean_Map members are rebuilt then. Every existence-group Ocean_Map is in the map rooms.
- On playable layers only a few Fences, Teleporters, Groups and a View_Giver are group members. So a save's existence flips are almost all in the map rooms (z ≥ 75) and on map-room twins.
- Entity-exists test: with IN_EXISTENCE_GROUP, an entity exists iff CURRENTLY_EXISTS; without it, unless EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY.
- The shared cell lookup (support, the landing and water move check, hero contacts, ...) skips: an entity IN_EXISTENCE_GROUP without CURRENTLY_EXISTS; one with EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY; one `scheduled_for_destruction`; a NOT_SNAPPED_TO_GRID one other than a Door, wherever it stands; a PLAYABLE_IN_PRELUDE one unless `Level_State.misc_flags` has DOING_PRELUDE. Fence blocking goes through it too. Skipped by the lookup is not absent: the beam update's light loop has the exists and prelude test but no snap test, so a NOT_SNAPPED_TO_GRID light still casts its beam.
- Code that walks a type's entity list directly applies the same exists and prelude test where it skips. These skip: the weight crush and the push and elevator weight ([Pushing and pulling](MOVEMENT.md#pushing-and-pulling)), the charmed list's Monsters, the hero roster, the magic-mirror ACTIVATE, the move commit, the Gate update and its Switches, the monster gate pass, the Switch update, light power and the light passes, the beam update's light loop, the water list, the Lily update, the dragon attack, Rover movement, the Door passes, the level-start hero contacts and the walls rebuild's Wall_Sets.
- These don't skip, so an absent entity still takes part:
  - the discovered-teleporter carry-over ([Teleporters in the save](STATE.md#teleporters-in-the-save)): an absent pad that was discovered and enabled is applied;
  - the TAB toggle's search for a FAST_TRAVEL box ([Wrapping](WORLD.md#wrapping)): an absent box still counts;
  - an Area_Pin's activation: once 2 or more pins of the hero's layer class are activated, every untaken View_Giver of that class is taken, an absent one too;
  - an Activator's respawn: an absent earlier clone still counts as the Spawner's clone (inferred);
  - the Monster pass: an absent Monster still ticks its cooldown and picks a target, but its attack skips;
  - the charmed list's Rocks and Mirrors: an absent charmed Rock or Mirror stays on the list (whether that can happen is inferred);
  - Lily movement groups: an absent Lily next to a moving Lily or hero joins its group and moves with it; an absent Lily at a drifting Lily's target stops the drift; an absent floating Lily makes the river step run at level start;
  - the walls rebuild's floor Fences and Ocean_Maps: absent ones still put their column inside the level in the column mask ([Support](MOVEMENT.md#support)), which lily steps, magic-mirror activation and the `drop_rock` script read;
  - the GEM beam's slot gather ([Promesst beams and powers](MOVEMENT.md#promesst-beams-and-powers)): neither the carriers nor the Gem_Slots near them are tested, so an absent carrier powers a slot and an absent slot gets powered;
  - the gather of Guys, Monsters and Rovers within 3.5 of a mover: Rovers get no test, and Guys skip only DEAD and EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY, so absent Rovers and absent group Guys are on it. Only the Monster pass reads it, so an absent Rover within 3.5 can wake a Monster ([Goblins, dragons and PROTECTION](MOVEMENT.md#goblins-dragons-and-protection)). The 1.1 list of the same gather gets the full exists and prelude test, and attacks use it; entries it drops for a fence edge (a mover without SQUEEZE) move onto the 3.5 list;
  - the room power flags (display only; light power itself skips);
  - the Freezer reopen and unlock passes: absent map-room Freezers open with the rest;
  - story events (`cage_disappear` and the like) toggle absent lights and take absent View_Givers (inferred).
- Entities absent at load are almost all in the map rooms (z ≥ 75): Fences, Wall_Sets, Ocean_Maps, pad twins, a few Rocks, Wardrobes, Lilies, Monsters and Mirrors. On a playable layer only a floor Fence is absent. So the sites that don't skip matter almost only in the map rooms.

## Collectibles

| Thing | In game terms |
|---|---|
| Voice logs | `Voice_Log` (on every layer and in a map room; `name`, `author`: SOKOBAN, ACTING, SABBATICAL, DEVELOPER): heard when `played` is set on Activate; a CHANGE in `overworld.history` |
| Map scrolls | `View_Giver` (one per layer): taking one adds its `map_overview_id` / `_2` Camera_Controls to `enabled_alternate_views`; a layer's TAB overhead map needs that layer's camera. Saved as `activation_order` ≠ 0 plus INVISIBLE_IN_A_TOGGLABLE_WAY. No fog effect |
| Treasures | `Treasure`s in `skipping_stones` (`treasure_index` 0-5); plinths (`Treasure_Display`) at (78..82, 52..56, 0); [Treasures and gold rooms](PROGRESSION.md#treasures-and-gold-rooms) |
| Gameplay counters | 10 Status counters, written and saved, never read ([Status.sokoban_status fields](PROGRESSION.md#statussokoban_status-fields)) |

`Switch.pressed` and `Gem_Slot` state are puzzle state, not collectibles.
