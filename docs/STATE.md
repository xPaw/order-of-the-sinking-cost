# Saved state, fog and areas

What a save keeps of a level and how it is read: the undo history, the overworld state from the save, fog of war and
areas.

## Undo history

Format: [`<level>.history` (undo state)](SAVES.md#levelhistory-undo-state). How state is read from it: [Overworld state from the save](#overworld-state-from-the-save).

- For the overworld the history is the only record of entity state: fog, pins, teleporters, rocks, lilies, voice logs, existence. Records, mip levels and thinning: [Thinning](SAVES.md#thinning).
- Each record holds the hero's position after its block, the level time and the rover timer ([Rovers](MOVEMENT.md#rovers)), and CHANGE, CREATION_OR_DESTRUCTION, OCEAN_CHANGE and SCRAPE_CHANGE actions with old and new values. The current value of a field is the newest value in the history, else the level data.
- Undo never reverts a Fog_Of_War CHANGE in play, but the undone record is freed, so a region cleared during an undone move is not saved.
- When `Settings.level_data_version` differs from the save's, the level's world state is reset ("World state has been reset, because we changed this level."). On the overworld the discovered MAJOR teleporters are then carried over.

## Overworld state from the save

**Record key.** Each undo record has `first` (first move index) and `span`. Its key is the end move `first + span`; on
equal end moves the coarser mip level ranks higher (a merged record and the finer record ending at the same move hold
the same end state). The level-start record (Action_Icon START, move 0, after the mip levels in the file) ranks oldest.

**Latest value rule.** The current value of an entity field is the `new` value of the CHANGE action in the record with
the largest key. On equal keys the first CHANGE in file order wins, but a CREATION_OR_DESTRUCTION action wins over the
actions before it (an Activator reset destroys then creates the same Pid in one record). No action = the level-data
value. A created entity's blob holds the whole entity; a position axis missing from it is 0. An entity whose latest
CREATION_OR_DESTRUCTION destroyed it is gone. A later-keyed CHANGE overrides a created blob's fields. Undo records are
replayed and reverted by the undo replayer (old or new side per direction; CREATION 2, OCEAN_CHANGE 3).

**Hero position** = the s32 × 3 of the record with the largest key that has a non-zero span and a non-zero position.
Every record's position is a kept hero position ([Reading the current state](SAVES.md#reading-the-current-state)).

**PROTECTION at a kept position**: the Guy's `skill_flags` CHANGEs in key order; a position is protected when the
latest change at or before its record key holds PROTECTION (else the level-data `skill_flags`).

### Water in the save

- OCEAN_CHANGE has two writers. A Flow_Updater (river) sets `ocean_values[idx] = 1 | (river_polarity == 1) << 1 | direction << 2` and only rewrites squares that already hold water (old and new both have bit 0). An `ocean_resetter` Spawner, fired by its Activator, copies the level-data `ocean_values` back into the map and logs an OCEAN_CHANGE for every square that differs, so water can drain again. Merged records keep one OCEAN_CHANGE per touched square, possibly with old == new.
- `idx = (x − corner.x) + (y − corner.y) × squares_x` in the map's local grid, x/y rounded with +0.5 floor, wrapped.
- Water query: [Water](MOVEMENT.md#water).
- Every existence-group Ocean_Map is in the map rooms; nothing on the playable layers drains except by an ocean reset.
- Viewer recipe: for each OCEAN_CHANGE (latest per (pid, index)), `water = new & 1`; with `map.oceans[pid]`, square = (x0 + idx % sx, y0 + ⌊idx / sx⌋); draw water where that bit becomes 1 and the square's walk floor is below `zw` (or it has none).

### Freezers in the save

- Every overworld freezer is one square. No `judge_unlock_level` and no Judge on the overworld.
- `other` unlockers on the overworld are all Signs.
- Opened = Pid in Status list A, or the gate is satisfied now (the unlock pass runs at every overworld load). A Sign
  gate is satisfied once the Sign is read (`rank_satisfied` in the history, [Sign `rank_satisfied`](PROGRESSION.md#sign-rank_satisfied)).

### Teleporters in the save

- MAJOR pads come in pairs, a world pad and its map-room twin; MINOR pads stand alone. Each world pad (layers 0-2) pairs by `target_id` with a twin in a map room (layers 3-5, mostly existence-group members, `enabled_t_target` 0). Stepping on a pad discovers it and its twin: the twin's CHANGE sets `entity_flags` (existence), `enabled_t_target` 1 and `discovered`, in the same record as the world pad's discovery. A twin never comes first.
- Discovery and travel: [Teleporter pads and fast travel](MOVEMENT.md#teleporter-pads-and-fast-travel).
- `discovered` = latest CHANGE, default = level data (only the crossroads pad's map-room twin is discovered in data). `enabled` = latest `enabled_t_target` > 0, else data.
- The discovered-teleporter carry-over runs only when loading the history resets the overworld world state (`level_data_version` newer than the save's; "World state has been reset, because we changed this level."). It reloads the old state and keeps MAJOR pads that were enabled and discovered, also opening a Freezer in the same cell and clearing their fog region. For the viewer the history is the only source.
- The MINOR pad that rides a Rover logs many position CHANGEs along y; they are not state.

### Dragons, Rocks and the rest

- Dragon state in the save: position, `theta_target`, `dead_t`, `status_flags` DEAD, existence, CREATION records (TRANSMUTE). A DEAD Monster has `dead_t` = 1.
- Rocks: position CHANGEs (pushes, falls), CREATION_OR_DESTRUCTION (TRANSMUTE crystals with runtime Pids in namespace 1023, Activator resets), `properties` (SKIPPING, FLIPPING_TARGET after a sink, MIRRORABLE on crystals).
- Lilies: position, `moving_direction`, `kick_direction` CHANGEs. `moving_direction` is NONE in the level data and returns to NONE (0) when the Lily stops. A Lily's first non-zero recorded `moving_direction` (EAST 1, NORTH 2, WEST 3, SOUTH 4) is the way its first move went.
- Activators: the saved `discovered` field is set when the hero comes near (within about 8 cells), not only on contact.
- Turbulence: runtime entities made at the cells of sunk stones. Their `particle_group_id` changes in almost every record; it is noise, not state.
- Promesst_Light `powered` (1-byte bool), Gate `open`, Switch `pressed`, Group `exists`, member `entity_flags`, Voice_Log `played`, View_Giver `activation_order`, Area_Pin `activated`, Guy `skill_flags`.

## Fog of war

Data: `data/fog.json`. The type table spells `Fog_Of_War` plainly. `Fog_Volume` has no region state and takes no part.

- Fog layers follow the ground-layer table ([Ground layers](WORLD.md#ground-layers)): 0 ONGROUND, 1 UNDERGROUND, 2 SKYGROUND, 3-5 the map rooms. Boundaries −4 / 10 / 75.16. An entity in a Group with `bind_to_layer` takes that layer.
- A **primary** `Fog_Of_War` (`ground_primary_fog`, `underworld_primary_fog`, `sky_primary_fog`) owns one region per screen of its layer: `region_states` has `ceil(squares_x / squares_per_screen_x) × ceil(squares_y / squares_per_screen_y)` = 10 × 12 = 120 entries (needs `per_screen_camera`).
- Region index = `sx + 10 · sy`, `sx = int((x − per_screen_camera_corner.x) / 19)`, `sy = int((y − corner.y) / 13)`, corner (−24, −2). The index itself does not wrap; positions are wrapped first.
- States (`Fog_Of_War_Region_State`): 0 FILLED, 1 PARTIAL (fading out), 2 CLEARED. PARTIAL becomes CLEARED when the fade ends and at every load, so 1 and 2 both mean revealed.
- A region clears when a hero on the fog's layer stands in it with `z ≤ top`. Top = the region's `Fog_Of_War_Z` (`z + ascent`) or else the fog's own `z + ascent` (ascent < 0 → 6.5).
- At level load, before the history is applied: the region under each hero at its level-data position on the fog's layer clears; each `Fog_Of_War_Clear` with `radius` 0 and `clear_neighboring_screen` 0 clears its region (none on the overworld); PARTIAL regions become CLEARED. After that, every frame clears the region under each hero on the current layer.
- Other clears: Markers named `hack_intro_fog_clear`; discovered Teleporters (the carry-over, [Teleporters in the save](#teleporters-in-the-save)).
- `Fog_Of_War_Clear` with `clear_neighboring_screen`: when its screen clears, the neighbour EAST (sx + 1), NORTH (sy + 1), WEST (sx − 1) or SOUTH (sy − 1) is set CLEARED at once, floor-mod 10 × 12 on wrapping levels, and the rule chains. Radius markers only start `manual_clear_time`.
- Non-primary `Fog_Of_War` (all in the sky): one `region_states` entry (none with `clear_as_part_of_room`), set PARTIAL when any hero is inside `position ± props.box_extents` (half-open; the point is moved to its copy nearest the box, so boxes that cross the seam cover both sides). `create_overhang` boxes also build overhang geometry; `only_overhang_no_fog` ones draw no fog.
- `Fog_Of_War_Z` sets its region's vertical extent: `[z − descent, z + ascent]` (4.5 / 6.5 when negative). The first one per region wins.
- **Saved state**: `region_states` is entity state (`NoEditorSave`, empty in level data). It is in `overworld.history` as CHANGE actions on the fog Pids, each carrying the whole array. Current state = the `new` of the action with the largest record key ([Overworld state from the save](#overworld-state-from-the-save)). No action = all FILLED. Nothing in Status.
- A region cleared during a move that was then undone is not in the saved history: after a reload it is FILLED again unless a hero stands in it or a later move cleared it ([Reading the current state](SAVES.md#reading-the-current-state)).
- A new campaign starts with ground regions 44, 45, 54, 55, 56 and 65 cleared around the start (hero at (81, 76, 0)) and 2 Area_Pins activated (`data/fog.json` `start`).
- The viewer takes the element-wise maximum of every kept `region_states` value per fog Pid: kept history only moves towards cleared.

## Areas

- An area is an `Area_Pin` (`local_area_name`, `local_area_image`, `map_label_marker_id`, `activated`) plus the `Marker`s with `script_name` `local_area` whose `script_target_entity_id` is that pin: oriented boxes (position, orientation, scale, `props.box_extents`).
- Every frame the game resets `current_area_pin` to 0 and the best priority to +∞ (skipped while the active hero entry has no living Guy: every Guy in it has DEAD in `status_flags`), then walks the Entity_Manager's Marker array, skipping zero-extent boxes. A `local_area` box holding a hero is a candidate. The box test uses the hero's `position` (not `visual_position`), moved to its copy nearest the box as in [Wrapping](WORLD.md#wrapping) (by the fast-travel box for boxes at map-room z). A candidate counts only if its `float_parameter` is strictly lower (`<`) than the best so far, and only a candidate whose pin is `activated` updates the best priority and the current pin. On equal priority the first in the array wins. The array is in file record order, and no Marker is ever destroyed on the overworld, so the order holds in play. With no box, or inside a level, it is 0. Status keeps the pin's Pid.
- A level is entered from its Level_Entry's cell ([Winning and other inputs](SKILLS.md#winning-and-other-inputs)), so the area shown there is the box rule at the entry's position. An entry outside every `local_area` box shows no area.
- Since an unactivated pin's box doesn't lower the best priority, a box inside a lower-`float_parameter` box is named only while the outer pin is not activated. The overworld has such nested boxes. So in an overlap the named area depends on the save's activated pins.
- The local area map, opened by TAB inside a map room, shows `current_area_pin`'s name and image ([Wrapping](WORLD.md#wrapping)).
- The area title (`show_area_title`) appears when the current pin becomes a non-zero pin other than the last one shown, in normal camera mode only. Leaving every box shows nothing. The HUD draws the name and `local_area_image` only from `current_area_pin`.
- A pin activates when the hero touches it, and `the_crossroads` by script. Activation is entity state in `overworld.history`. A new game starts with 2 pins activated.
- Area names are localization keys `area_g_*`, `area_s_*`, `area_u_*` (ground, sky, underworld).
- The overhead map labels every activated named pin at its `map_label_marker_id` once at least 2 are activated. Activating while the map is open toggles the labels (a Status u8). No fog check.
- Level_Entry has no area field and Area_Pin no level list. Which area a level belongs to has to come from geometry ([Level areas (viewer)](VIEWER.md#level-areas-viewer)).
