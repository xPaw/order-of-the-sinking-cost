# Derived data and the map images

The schema of every data file the viewer is built from (`schema.json`, `levels.json`, `level_areas.json`, `fog.json`,
`map.json`, `world.json`, `progress.json`, `walk.json`) and the map images.

## Derived data files

The pipeline turns the game data into these files in `data/`, and the viewer embeds `schema.json`, `progress.json` and
`walk.json`. It also embeds `wikitactics.txt`, which is not derived: it is a copy of
[joric/ootss data/wt.txt](https://github.com/joric/ootss/blob/main/data/wt.txt), refreshed by replacing the file. Each
row is `level,area,anchor`, and a level's panel links to `https://sinkingstar.wikitactics.com/areas/<area>/#<anchor>`.
Positions are world units; a cell is (i, j) = ((x − corner.x) mod W, (y − corner.y) mod H) with the overworld grid
corner (−24, −2) and W × H = 190 × 156. The world, fog and map scripts fill a field a blob leaves out with its type
default: the first value stored for that field in any level of the package (no two levels disagree), not the
overworld's alone. A row's trailing `(, exists)` column is described under
[data/world.json](#dataworldjson).

### data/schema.json

`{base: {name: "Undoable_Entity_Data", fields}, types: {<type>: {version, size, fields}}, enums: {<key>: {flags, values}}}`.

- `types` has every entity type. A type the exporter could not find is `{missing: true}`.
- A field: `i` index, `n` name (flattened, `position.x`), `v` [first, last] version (−1 = none), `k` kind, `sz` size
  in bytes (plain data), `t` type name (`f32`, `u8`, `bool`, `Vector3`, `enum <name>`, `[]u8`, `*Material`, ...),
  `enum` the enum key and `enum_t` its integer type (enum fields), `e` the element description and `at` the
  `Array_Type` (arrays), `notes` (`NoUndo`, `NoEditorUndo`, `NoEditorSave`).
- `k`: `p` plain data (raw `sz` bytes), `s` string, `r` resource pointer (by name), `a` dynamic array, `x` anything else.
- Enum keys: the enum's name when it is unique, else the first field that uses it (`Settings.special_level`,
  `Rock.properties`), else `<name>#2`, `#3`. `values` = [[name, value]]. `flags` = an `enum_flags` type.
- The exported enums are the ones fields use, plus a fixed list: `Level_State_Flags`, `Level_State_Misc_Flags`,
  `Move_Type`, `Direction`, `Action_Type`, `Character_Index`, `Character_Rank`, `Status_Flags`, `Entity_Flags`,
  `Transition_Glyph_Flags`, `Tower_Flags`, `End1_Flags`, `Skill_Flags`, `Inventory_Flags`, `One_Time_Bark_Flags`,
  `Achievement`, `Language`, `Promesst_Power`, `Render_Resolution`, `Graphics_Mode`, `Msaa_Mode`. `Action_Icon` and
  the undo record `Flags` are not exported; their values are above.

### data/levels.json and data/level_entities/

`levels.json` = `{level_sets: {<set>: [level names]}, levels: [...]}`, one row per level in the package:

- `name`, `level_sets` (the sets that list it), `entity_count`, `namespaces` (the 6 most common, [namespace, count]),
  `type_counts` (progression types only);
- `settings`: these `Settings` fields, type defaults filled in: `grid.squares_x`, `grid.squares_y`, `grid.num_squares`,
  `grid.wrapping`, `grid.corner.x`, `grid.corner.y`, `grid.corner.z`, `squares_z`, `story_tag`, `special_level`,
  `fast_travel_corner.x`, `fast_travel_corner.y`, `fast_travel_extents.x`, `fast_travel_extents.y`, `level_data_version`, `designers`, `intro_cutscene`,
  `outro_cutscene`, `story_proc`, `story_proc_arg_string`, `story_proc_arg_int`, `sound_level_name`;
- `entities`: `{<type>: [{id, pid, fields}]}` for `Level_Entry`, `Level_Connector`, `Overworld_Unlock`, `Area_Pin`,
  `Gem_Slot`, `Treasure`, `Treasure_Display`, `Level_State`, `Checkpoint`, `Teleporter`, `Artifact`, `Voice_Log`,
  `Marker`, `Switch`, `Freezer`, `Tower`, `Sign`, `Door`.

Entity `fields` hold only what the blob stores (a missing field is the type default). Base fields are prefixed `base.`
and only position, `orientation.z/w`, `entity_flags`, `entity_name`, `group_id` and `mesh` are kept. Floats are rounded
to 4 places. Enums are value names; a flags enum is a list of names, plus an int for unnamed bits. Reference fields
(`*_id`, `*_id2..4`, `group_id`, `target_id`, `also_discover`, `map_label_marker_id`, ...) are `["#ns-serial", pid]`, or
0 for none.

`level_entities/<level>.json` = `{level, columns: ["pid", "type", "x", "y", "z", "mesh"], types: [type names], meshes:
[mesh names], ents: [[pid, type index, x, y, z, mesh index or −1]]}` for every entity of the level.

### data/level_areas.json

The current-area rule applied at each overworld Level_Entry (the rule itself is in [Areas](STATE.md#areas) and
[Level areas (viewer)](VIEWER.md#level-areas-viewer)).

- `rule`: the rule text.
- `areas`: `{<local_area_name>: {pin, pin_id, local_area_name, display_name (en), local_area_image, position,
  map_label_marker, map_label_position, local_area_markers: [Marker pid], local_area_boxes: [{p, q, s, e, f, w}],
  level_count, level_count_with_fallback}}`. A box: `p` position, `q` orientation quaternion (x, y, z, w), `s` scale,
  `e` `props.box_extents`, `f` `float_parameter` (priority, lower wins), `w` the wrap widths used for x and y (the grid
  size, or the fast-travel extents for boxes at map-room height).
- `levels`: `{<level_name>: {entry, position, ...}}`. Inside a box: `area_pin`, `local_area_name`, `display_name`,
  `exact: true`, `marker`, `candidates` (how many boxes hold it), and for an entry in boxes of more than one area
  `overlap`: [[local_area_name, float_parameter]] of every box holding it, in record order. Outside every box: `exact: false`,
  `nearest_area_pin`, `nearest_local_area_name`, `nearest_display_name`, `nearest_marker`, `margin` (distance outside
  the nearest box, the largest per-axis value).
- `unassigned`: the levels outside every box.

### data/fog.json

- `level` "overworld"; `grid` {corner (−24, −2), screen (19, 13), count (10, 12), wrapping}: region = sx + 10 × sy,
  sx = ⌊(x − corner.x) / 19⌋, sy = ⌊(y − corner.y) / 13⌋, wrapped; −1 outside.
- `layers`: [{index, name, zmin, zmax}] the ground layer table (ONGROUND, UNDERGROUND, SKYGROUND,
  FAST_TRAVEL_UNDERGROUND, FAST_TRAVEL_ONGROUND, FAST_TRAVEL_SKYGROUND; null = unbounded).
- `states`: {0 FILLED, 1 PARTIAL, 2 CLEARED}.
- `primary`: [{pid, id, name, layer, z, zmin, zmax, z_overrides: [[region, zmin, zmax, Fog_Of_War_Z id]]}], one per
  layer. zmin / zmax = z − `descent` / z + `ascent` (defaults 4.5 / 6.5). The first Fog_Of_War_Z per region wins.
- `boxes`: [{pid, id, name, layer, min, max, regions (0 with `clear_as_part_of_room`, else 1), only_overhang}].
- `clears`: [{id, layer, region, dir (`clear_neighboring_screen`), to (the neighbour region, −1 for none), radius}].
- `level_entries`: [[level_name, layer, region]] for the overworld Level_Entries that are not broken or disfavored.
- `area_pins`: [[id, local_area_name, layer, region]].
- `start`: {hero, regions: {Fog_Of_War pid: [region]}, pins: [Area_Pin pid]}: a fresh campaign whose hero walked
  everywhere reachable at the start, taken as the fog before a save is loaded. It is a fixed value in `build-fog.ts`,
  read once from such a save ([Fog of war](STATE.md#fog-of-war)).

### data/map.json

`{corner, size, layers, oceans}`: the frame of the overhead map, which [The map images](#the-map-images) fill.

- `corner` is the world position of square (0, 0)'s centre. Square (i, j) covers x in [corner.x + i − 0.5, +1) and
  y in [corner.y + j − 0.5, +1).
- `layers`: [{key, name, z: [z0, z1]}] in the order underworld (−57, −4.001), ground (−4, 9.999), sky (10, 75.156). A
  layer holds the z in [z0, z1). The ground layer table gives the bounds: the Settings' underground and skyground
  barriers and the fast-travel rooms above the sky. The underworld has no lower barrier; its lowest surface is at −57.
- `oceans`: [{pid, layer (index into `layers`), x0, y0, sx, sy, zw, water}] for every drawn Ocean_Map that is not
  PLAYER_BLOCKING_ONLY: square k is world square (x0 + k % sx, y0 + ⌊k / sx⌋), the drawn surface is at `zw` (z −
  `sink`), and `water` = base64 of the initial bit-0 mask, holes applied (bit k % 8 of byte k >> 3). Only an unrotated
  map fits this row; the build refuses a rotated one (the overworld has none).

### data/world.json

`{world, teleporters, treasure_displays, gold_rooms}`: the overworld as walkable cells, for the walk model
([The walk model (viewer)](VIEWER.md#the-walk-model-viewer)). `l` and `zlayer` values are ground-layer table indices:
0 ground, 1 underworld, 2 sky, 3-5 the fast-travel map rooms (underworld, ground, sky).

**`exists` column.** A row whose entity can be absent ends in `exists`: its state when the level loads. On load every
existence Group (`is_existence_group`) takes its `exists_by_default`; its stored `exists` is ignored. Its direct members
(other than `EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY` ones) get IN_EXISTENCE_GROUP and a CURRENTLY_EXISTS that
follows it, whatever flags they store, and the change passes into existence subgroups. So `exists` is:
- for a direct member of an existence Group: that Group's `exists_by_default`;
- for another entity flagged IN_EXISTENCE_GROUP: its stored CURRENTLY_EXISTS;
- 0 for an entity the cell lookup skips: `EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY`, `NOT_SNAPPED_TO_GRID` (no
  Door is in these lists) or `PLAYABLE_IN_PRELUDE` (the overworld has no prelude).

Rows without the column always exist. The save overrides it: member `entity_flags` CHANGEs, a Group's saved `exists`
(applied to its members and subgroups when it differs from the default) and CREATION_OR_DESTRUCTION records.

| Key | Shape |
|---|---|
| `world.grid` | {corner [−24, −2], size [190, 156], zoff 64, ft}. A z byte is z + zoff. ft = {corner [35, 104], size [50, 36], z 75}: Settings `fast_travel_corner` / `fast_travel_extents`, and the first integer z at or above the lowest FAST_TRAVEL Camera_Marker box (its centre z − extent − 0.5, rounded up). Cells at that z and above wrap inside the ft box instead of the grid |
| `world.zlayer` | [256] ground layer of each integer z = index − zoff: −64..−5 → 1, −4..9 → 0, 10..75 → 2, 76..84 → 3, 85..95 → 4, 96..191 → 5 |
| `world.solid` | zlib + base64 (JS `DecompressionStream('deflate')`). Per column j × W + i: u8 n, then n u8 (z + zoff), ascending. Wall_Set voxels of Wall_Sets without an `exists` entry, `OCEAN_HOLE` ones excluded, placed by the Wall_Set's position and orientation ([Wall_Set `wall_data` (voxels)](GAMEDATA.md#wall_set-wall_data-voxels)). A voxel at z fills the cell z |
| `world.groups`, `world.group_cells` | [{pid, exists, n}]: the Wall_Sets with an `exists` entry. `group_cells` = zlib + base64 of u8 triplets (i, j, z + zoff), n per Wall_Set in list order |
| `world.egroups` | [[pid, exists_by_default, [subgroup], [unexisted by], [member pid]]], the existence Groups sorted by pid (few exist by default). subgroup: its child existence Groups. unexisted by: the existence Groups whose `unexist_this_id`/`2`/`3` names it. Both are indices into `egroups`. member pid: its direct members other than Groups and the skipped kinds above. Making a Group exist makes its members and its subgroups exist, except a subgroup that an existing Group unexists; a Group that already exists stops the recursion (depth cap 21) |
| `world.floors` | [[pid, i, j, z(, exists)]] Fences with `blocking` and `is_floor`: a floor at the bottom of their own cell. It holds the hero at z and blocks vertical moves through it |
| `world.fences` | [[pid, i, j, z, side(, exists)]] blocking non-floor Fences on the grid axes. side 0 east, 1 north, 2 west, 3 south: the cell edge its +x axis points to. It blocks a move out of its cell across that edge and a move into its cell against it. Fences off the axes block nothing |
| `world.gates` | [[pid, i, j, z, open, notted, flavor, monster, closes(, exists)]] every Gate with its level-data `open`; a closed one blocks its cell and holds up the cell above (none is FLAT) until its switches or a hero in an OPEN beam open it ([Moves](VIEWER.md#moves)). monster = `is_monster_gate`. closes: the way the Gate pushes what stands in its cell as it closes, its local −z axis (local −x with `sideways`), reversed by `negate_direction`, as a side (0 east, 1 north, 2 west, 3 south), 4 up or 5 down ([Gates, switches and buttons](MOVEMENT.md#gates-switches-and-buttons)). A few are monster gates and a few stand open; many are notted |
| `world.switches` | [[pid, flavor, pressed, i, j, z(, exists)]] every Switch with its level-data `pressed` (all unpressed; most flavors have a single Switch). Gates of the same flavor follow them ([Cells](VIEWER.md#cells), [Moves](VIEWER.md#moves)) |
| `world.oceans` | [[pid, z, l, i, j, sx, sy(, exists)]] every Ocean_Map, all kinds. z = the map's z, the surface the movement rules use. Square k is cell ((i + k % sx) mod W, (j + ⌊k / sx⌋) mod H). A save's OCEAN_CHANGE `index` is k. Only unrotated maps fit this row; the build refuses a rotated one (the overworld has none) |
| `world.water` | zlib + base64. Per column j × W + i: u8 n, then n u16 indices into `oceans`, ascending: the maps with water (bit 0, after `detect_holes`) at that square in the level data |
| `world.rivers` | [[i, j, z, dir]] water squares with a flow `Direction` (1 E, 2 N, 3 W, 4 S) in the level data, in the maps the overhead map draws (not PLAYER_BLOCKING_ONLY, existing at load); z = the map's z rounded |
| `world.elevators` | [[i, j, zb, i2, j2, zt, mask, bottom pid, bottom exists, top pid, top exists(, one-Rock mask, [Rock pids])]] per Elevator_Platform: its `bottom_owner` and `top_owner` Stairs frames (exists −1 when the frame has no `exists` entry), sorted by zb, j, i. mask bit 1: rides up from the bottom frame; bit 2: down from the top; it is the mask with no Rock on the platform, 0 when a static solid voxel lies in the bottom frame's column between the frames. The last two fields are only on an elevator with Rocks stacked on its platform: their pids, bottom first, and the mask with one of them left. A single Rock on the platform clears the bit of the end the platform rests at, and the other end's bit stays only when that frame cell has two opposite open sides (to push the rock off). Two or more Rocks left ride nowhere. The walk counts the stacked Rocks that are still at their level-data cells. Most work both ways |
| `world.rocks` | [[pid, i, j, z(, exists)]] every Rock at its level-data position. The save moves them (position CHANGE), destroys them and creates others (CREATION_OR_DESTRUCTION) |
| `world.bridges` | [[rock or Gem pid, push i, j, z, water i, j, z]]. A non-SKIPPABLE Rock or a Gem standing on support, pushed by the hero from the push cell behind it (not solid, supported, no fence on that edge). It travels straight over supported cells that hold no solid, Gate, Freezer or other Rock and have no fence on the edge crossed (at most 40). The first unsupported cell must be water (a map surface within 0.6 of z) with no solid at z − 1. The rock stops one cell under the surface at any depth and holds the hero up |
| `world.movables` | [[pid, i, j, z, kind(, exists)]] what the hero pushes besides Rocks and Monsters: kind 0 Gem, 1 Promesst_Light, 2 Mirror, 3 Rover, 4 Friendly_Dragon. They stop dragon fire, and beams unless mirrorable |
| `world.blockers` | [[pid, i, j, z(, exists)]] Signs (`demo_phase` FULL_GAME), Treasure_Displays and Judges (none on the overworld): they cannot be pushed, block the hero, hold up what stands on them, and stop fire and beams |
| `world.mirrorable` | [pid]: the Rocks whose `properties` hold MIRRORABLE and the Rovers with `mirrorable`. Beams pass them |
| `world.magic_mirrors` | [[pid, i, j, z, ax, ay, bx, by, vertical, freezer(, exists)]] every Mirror with `is_magic` at its level-data position. (ax, ay) and (bx, by): a flat one's two open sides as grid steps, (0, 0) for a vertical one. freezer: the pid of the Freezer in its cell, else 0. The walk's hops ([Magic-mirror hops](VIEWER.md#magic-mirror-hops)) |
| `world.mirror_facings` | [[pid, quarter turns, shape]] every Mirror: its level-data `theta_target` in quarter turns (the save holds its changes) and shape 0 flat, 1 vertical, 2 `is_vertical_downward`. They give the open sides a TELEPORT line meets ([Moves](VIEWER.md#moves)) |
| `world.skippable` | [pid]: the SKIPPABLE Rocks, the skipping stones. The walk's skip lanes ([Skip lanes and the TELEPORT swap](VIEWER.md#skip-lanes-and-the-teleport-swap)) |
| `world.teleport` | [pid]: the Wardrobes whose `skill_flags` hold TELEPORT |
| `world.charm` | [pid]: the Wardrobes whose `skill_flags` hold CHARM. The walk's stones launched with CHARM ([Moves](VIEWER.md#moves)) |
| `world.transmute` | [pid]: the Wardrobes whose `skill_flags` hold TRANSMUTE |
| `world.trees` | [[pid, i, j, z(, exists)]] Trees. They stop dragon fire and beams while they exist; TRANSMUTE turns one into a crystal Rock (a CREATION record destroys the Tree) |
| `world.lilies` | [[pid, i, j, z(, exists)]] Lily pads at their level-data position; standable in their own cell over water. Those absent at load are all in the map rooms |
| `world.rover_facings` | [[pid, quarter turns]] per Rover: its level-data `theta_target`; even runs the Rover east-west, odd north-south ([Rovers](MOVEMENT.md#rovers)). The save's `theta_target` replaces it |
| `world.rock_spawns` | the same rows for the Spawners whose `spawned_entity_id` is a Rock. The walk puts a Rock the save left elsewhere back at the Spawner's cell once it reaches one of the Activators ([Rocks a Spawner puts back](VIEWER.md#moves)) |
| `world.lily_spawns` | [[spawner pid, i, j, z, lily pid, [[activator pid, i, j, z(, exists)]](, exists)]] the Spawners whose `spawned_entity_id` is a Lily, at their own cell, with the Activators whose `spawner_1` to `spawner_16` name them ([Activators and Spawners](MOVEMENT.md#activators-and-spawners)). The walk drifts the Lily from the Spawner's cell when it is a river cell ([Skip lanes and the TELEPORT swap](VIEWER.md#skip-lanes-and-the-teleport-swap)) |
| `world.area_pins` | [[pid, x, y, z]] world positions |
| `world.mechs` | [[kind, pid, i, j, z(, exists)]] what the walk models only in part, named in a level's "why": 0 DRAGON Monster, 1 beam blocker Rock (named `*beam_blocker` or `*beam_barrier*`), 2 Mirror or MIRRORABLE Rock, 3 SKIPPABLE Rock without FLIPPING_TARGET (a sunk stone carries it). Rock `properties` bits: MIRRORABLE 1, SKIPPABLE 2, SKIPPING 4, FLIPPING_TARGET 8. The walk adds every existing light's cell and its powered beam's cells as kind 1 |
| `world.monsters` | [[pid, i, j, z, kind(, exists)]] every Monster at its level-data position; each one stops dragon fire. kind = a DRAGON's facing side (its +x axis, as `fences`), −1 a GOBLIN, −2 neither ([Goblins, dragons and PROTECTION](MOVEMENT.md#goblins-dragons-and-protection), [Attacks](VIEWER.md#attacks)) |
| `world.beam_stops` | [[i, j, z]] cells of Eggs (none on the overworld). A beam also ends in `movables`, `blockers`, Trees, Rocks, shut Gates and frozen Freezers. Guys, Monsters, MIRRORABLE Rocks and mirrorable Rovers do not stop it ([Promesst beams and powers](MOVEMENT.md#promesst-beams-and-powers), [Beams](VIEWER.md#beams)) |
| `world.lights` | [[pid, i, j, z, side, up, down, powered, color(, exists)]] every Promesst_Light at its level-data position. side (as `fences`) is the beam's direction, its +x axis; −1 off the grid axes. up / down = `vertical_up` / `vertical_down`. powered = the level-data `powered` (0 for all; the save holds its changes; the walk computes power from `gem_slots` instead, [Beams](VIEWER.md#beams)). color = its `Promesst_Power` value: OPEN 0, THROUGH 1, SMASH 2, DOUBLE 3, STRONG 4, ENDPOINT 5, ALTER 7, GEM 8, SQUEEZE 9 |
| `world.gem_slots` | [[pid, i, j, z, beam_powered(, exists)]] every Gem_Slot; beam_powered = its level-data `flags` hold BEAM_POWERED (the save holds its changes). A room's lights are powered when its existing slots are all filled ([Promesst beams and powers](MOVEMENT.md#promesst-beams-and-powers)) |
| `world.held_gems` | [pid]: the Gems whose level-data `attached_to_entity_id` names a holder. Only a free Gem fills a slot |
| `world.wardrobes` | [[pid, i, j, z, side, skill(, exists)]] Wardrobes on the grid axes. side (as `fences`) is the door edge, its +x axis; fire does not cross it. skill 1 PROTECTION, 2 another skill, 0 none, inventory only |
| `world.guy` | [pid, protection]: the overworld Guy; protection = its level-data `skill_flags` hold PROTECTION (0) |
| `teleporters[]` | {pid, p: [x, y, z], l, major (1 MAJOR, else MINOR), target (`target_id` pid), en (level-data `enabled_t_target` > 0), and when set: also / also2 (`also_discover` / `also_discover2` pid), disc (`discovered`), gold (`gold_room_endpoint`), ex (as the `exists` column), g / ag (the `egroups` index of the pad's own Group and of its `also_exist_this_group_id` Group: enabling the pad makes both exist), to (the position of a target that is not a pad, a Marker, where the pad sends the mover)}. l follows a Group's `bind_to_layer`. Most pads are MAJOR, and most start enabled |
| `treasure_displays[]` | {pid, p, i = `treasure_index`}, sorted by i |
| `gold_rooms[]` | {tower (Tower pid), pad (teleporter index of the tower's `teleporter_id`, a MINOR pad), endpoint (teleporter index of its target, a `gold_room_endpoint` pad in the gold hub)}, one per ground tower |

### data/progress.json

Everything the viewer knows about the overworld in one file: progression rows, `world.json` merged in whole, `map.json`
as `map`, and fog. Level roles (Required / Optional, the Freezers each level sits behind) are not in it; they are in
[data/walk.json](#datawalkjson).

| Key | Shape |
|---|---|
| `levels[]` | the overworld Level_Entries that are not `currently_broken` or `currently_disfavored`, in level-data order: {n (level_name), p, req (indices into `levels` of `unlocked_by_id`..`id3`; may be empty), or (`unlock_is_or_gate` with 2+ ids), en (gated but `enabled_t_target` 1 in the data, so open from the start), t (`tower_flags` bits: HEROES 1, MIRRORS 2, SKIPPING 4, PROMESST 8, UPSTAIRS 16, DOWNSTAIRS 32), glow (the glow colour group of its pad: green, orange, yellow, blue or purple, the group whose hue its `color_active` is nearest to; reds count as orange, cyans as blue, magentas as purple; [The marker icons](#the-marker-icons)), tower (1 when its `style` is SIXTEEN_POINTS, the 16-point star pad of the tower levels, which is also the pad of a few levels with no `tower_flags`), d (dropdown), a (achievement name), set: [index into `sets`, place in the set from 1], area (index into `areas`), areaNear (outside every area box, grouped with the nearest), overlap (in boxes of more than one area: [[index into `areas`, float_parameter]] in record order; the viewer picks among them by activated pins, [Level areas (viewer)](VIEWER.md#level-areas-viewer))} |
| `sets[]` | {name, n (levels in the set that exist)}: each level's first level set by set name, a `drafts*` set only when it has no other |
| `towers[]` | {pid, t (tower_flags bits), req (`levels_required`, type default filled in), p, pad (index into `teleporters` of the tower's `teleporter_id` pad when that is a MINOR pad: a ground or low tower's pad stands on or beside the tower, a high tower's is a MAJOR pad elsewhere and has no `pad`), hub (index into `teleporters` of the tower's `teleporter_id` pad when that is a MAJOR pad: a sky tower's pad in the sky hub)}, sorted ground first, then sky, then underworld, then by t |
| `freezers[]` | {pid, p, l (ground layer by z), req (indices into `levels` of `unlocked_by_id`..`id4`), or, partial (`partial_solve_count` set), judge (`judge_unlock_level`), doorway (model B, `base.mesh` `GAME_OVER_Freezer_B`), signs when some unlock ids are not levels: [{pid, rank} \| {pid, tower: index into towers} \| {pid, gold: 4} \| {pid}]} |
| `signs[]` | {pid, p, l, rank \| tower (index) \| gold: 4, status (a TOWER_STATUS sign), gates (indices into `freezers` that list it)}: the Signs that open gates by rank, tower or gold rooms, and the tower status signs |
| `treasures` | the number of Treasure_Displays |
| `voice_logs[]` | {pid, p, l, name, author, d (already `played` in the level data)} |
| `view_givers[]` | {pid, p, l}: the map scrolls |
| `areas[]` | {local_area_name, display (en name, else the key), p (label position: the `map_label_marker_id` Marker, else the pin), pin (Area_Pin pid), boxes (as `level_areas.json`), layer (ground / sky / underworld from the name's g/s/u), order}. order sorts by layer (ground, sky, underworld), then by the wrapped distance from that layer's hub area (`area_g_crossroads`, `area_s_upper_crossroads`, `area_u_crossroads_low`) |
| `fog` | {grid, primary: [{pid, layer}], boxes: [{pid, layer, min, max}] (boxes with `only_overhang` left out), levels: {level name: [layer, region]}, start} from `fog.json` |
| `map` | `map.json`, plus `main_box`: {underworld \| ground \| sky: {c: centre, e: extents}} of each layer's MAIN_MAP Camera_Marker box, the overhead map's view of the whole layer. Ground: c (79, 76, 2), e (94.57, 78.94, 4.62) |
| `endgame_way_ins` | [[level, [freezer index], replace]]: the way-in gates of the endgame levels, which the walk does not find, from the gate unlockers and positions ([Unlock plans and next steps (viewer)](VIEWER.md#unlock-plans-and-next-steps-viewer)). replace 1: the gates are alternatives and stand in for the walk's; 0: the gates are all needed together, besides the walk's way in (they are the way in where the walk finds none). Rows: `end1` (the gold-room Sign's gates, 1); the end2 room's levels (the four sky tower gates under the room, 0); `all_together_now` (every gate the set's other levels open, 0); every `endgame3` level (the chain in set order, 1) |
| `known_routes[]` | the hand-written table of routes the walk does not find ([Known routes](VIEWER.md#known-routes)), written in `scripts/lib/known-routes.ts` with names and entity ids that the build resolves to indices (a name or id the data lacks fails the build). A row: {id, to, needs, area?, tower?}. `to` is the target, one of {level: index into `levels`} (its entrance), {pad: index into `teleporters`} or {at: [x, y, z]} (the cell of another overworld entity). `needs` is [[need]]: all of the groups, one need of a group; a need is {level: index into `levels`} solved, {freezer: index into `freezers`} open or {sign: index into `signs`} read, and a group with no need is one that is not known, which nothing meets. `area` (index into `areas`) and `tower` (index into `towers`) mark a sky Way: the Way area, and the sky tower whose hub quarter it leads to, whose hub pad `to` is |
| `ending_stages[]` | the hand-written stages of the second and third endings ([Goals (viewer)](VIEWER.md#goals-viewer)), written in `scripts/lib/ending-stages.ts` with names (levels, areas, tower flags, achievements) and Freezer and pad Pids that the build resolves to indices (a name the data lacks fails the build). A row is {ending (the ending's achievement), stages: [{name, done, seen}]} with the stages in order. `name`: {area} \| {level} \| {tower} \| {route}, an index into `areas`, `levels`, `towers` or `known_routes` (a sky Way's row, written by its id). `done`: {rule: 'achievement', name} (earned), {rule: 'tower', tower} (active), {rule: 'freezers', freezers} (all open: indices into `freezers`), {rule: 'solved', level}, {rule: 'pads', pads} (one of the pads, indices into `teleporters`, discovered). `seen`: pads whose discovery shows the stage though its area is not named. Rows: ENDGAME2 (the sky crossroads, each of the four sky towers followed by its Way, the sky hub, `laser_pointer`, `all_together_now`), ENDGAME3 (the underworld crossroads, the underworld hub, the end3 rooms in set order, `end3_pipeline_aesthetics`); the first ending's children are the ground towers' Antipode teleporters, from `gold_rooms` |
| `world`, `teleporters`, `treasure_displays`, `gold_rooms` | from `world.json`; `gold_rooms[].tower` becomes an index into `towers` (−1 if none) |

### data/walk.json

What the walk model ([The walk model (viewer)](VIEWER.md#the-walk-model-viewer)) works out from the level data alone,
so the page doesn't redo it on every load. `scripts/build-walk.ts` runs the room search (`searchRooms()`), then the
page's own `staticRoles()` and `floorHeights()` with the room answers in use, over `progress.json`, and writes it last
in the pipeline.

| Key | Shape |
|---|---|
| `inputs` | {`progress.json`, `world.json`}: the SHA-256 (hex) of each input file's bytes. `tests/walk-data.test.ts` fails when they no longer match, or when the walk on the current code gives other roles, floors or room answers |
| `roles.need` | {l, g}: one digit per level (`progress.json` `levels` order) and per Freezer (`freezers` order): 2 Required, 1 Required as one of several, 0 Optional ([Level roles (viewer)](VIEWER.md#level-roles-viewer)) |
| `roles.bg` | {l, g}: per level and per Freezer, the indices into `freezers` of the Freezers it sits behind, ascending |
| `floors` | {underworld, ground, sky}: per map layer key, zlib + base64 of one byte per map column (W × H = 29640, row-major, row 0 = north, as `map.json`): the highest z where the walk on the level data stands the hero there, plus 128; 0 where it stands him nowhere. The flood: gates as stored, no Freezer closed, every teleporter enabled and discovered, seeded at every Level_Entry, pad and Area_Pin. All values are whole numbers |
| `rooms` | {searched, variants, answered, empty, states, capped, data}: the exhaustive push search of the screen rooms ([Room answers](VIEWER.md#room-answers)) on the level data, with every Freezer closed and, for a room with up to three Freezers around it, with each other combination of them open. `searched`: rooms with an object and a place for the hero to start, searched with every Freezer closed; `variants`: rooms searched with some Freezers open (a merged room counts once for each combination that makes it); `answered`: answers stored that have entries; `empty`: answers stored with no entries, for rooms with no start, nothing to tell or too many positions (a walker that finds such a room as the level data has it does not search it again); `states`: positions visited in all; `capped`: the first cell of each room (or merged room) that hit the cap of 200 000 positions (no entries). `data`: zlib + base64 of JSON, a list of rooms `[cells, attackers, entries, opens]`: `cells` the room's cells (grid cell keys, ascending, each as the difference from the one before, the first from 0); `attackers` the pids of the Monsters whose attacks cross the room or the cells beside it, with the Freezers of `opens` open; `entries` the answers, one per start and one for all starts together, each `[reps, bridges, holders, filled, dead]`: `reps` a cell of each start piece of ground; `bridges`, `holders` and `filled` flat lists of `key, count, values…` (per Rock its water cells, per Switch cell its objects, per Gem_Slot cell its Gems, a Rock, object or Gem by the cell the level data puts it in); `dead` the cells of the Monsters that die; `opens` the states of the Freezers around the room (the Freezers in its cells or beside them, above or below, ascending by index) the answer holds for, each a bit set with bit n set when the nth of those Freezers is open (0: all closed). A cell key is `(z + 80) × W × H + row × W + column` on the walk's grid |

## The map images

`src/assets/map-<layer>.avif` holds one image per map layer (`underworld`, `ground`, `sky`), each a top-down render of
that layer of the overworld with the fog cleared, the hero hidden and the time frozen.

- An image is 32 pixels per square: 190 × 156 squares are 6080 × 4992 pixels. Pixel row 0 is the north edge.
- Square (i, j) of the map grid ([data/map.json](#datamapjson)) covers pixels x in [32 i, 32 i + 32) and rows
  [32 (155 − j), 32 (155 − j) + 32). World square (x, y) has its centre at pixel ((x + 24.5) × 32, (153.5 − y) × 32).
- The pixels are opaque RGB. Pits are black.
- The images show everything, fogged parts included; the viewer covers what the save has not uncovered
  ([Fog of war](STATE.md#fog-of-war)).
- `src/map/thumbs/<layer>.avif` is the same layer at one pixel per square (190 × 156, each pixel the average colour
  of its square, row 0 north). The page embeds the thumbnails and draws a layer's thumbnail pixelated until its full
  image, published in the page's `assets/` folder, has loaded and decoded.

## The marker icons

`src/assets/icons/<name>.avif` holds one 128 × 128 image per marker kind and state, rendered from the game's own
3D models by `scripts/build-icons.ts` (`npm run icons`). The pixels are RGBA on a transparent background: the object
fills the frame (5 pixels of margin), with a thin dark outline and a soft drop shadow so it reads on any terrain. The
whole set is about 300 KB.

| Icon | Model | Colour |
|---|---|---|
| `ice-cage`, `ice-gate` | the Freezer models `Freezer_A` and `Freezer_B` | the entity's tints |
| `sign` | the Sign model `overworld_plaque` | the entity's tints |
| `teleporter` | the Teleporter model `Reset_B` | the glowing parts take the entity's `color_discovered` |
| `tower-pad` | the Teleporter model `Reset_C` | the same |
| `gold-room` | `Reset_C` of a gold room's endpoint | `color_discovered` and the entity's own tints (gold) |
| `voice-log` | the game's texture `UI_Voice_Log_Activate` (a brass horn) | the texture's own |
| `map-scroll` | the View_Giver model `CamControl_Scroll` | the entity's tints |
| `treasure` | the Treasure_Display's plinth with its treasure's model standing on top | the entity's tints |
| `treasure-taken` | the Treasure_Display's acquired model (`Chest_Open_A`) | the entity's tints |
| `level-locked`, `level-solved`, `level-available-<group>` | the plain 8-point Level_Entry models `Entry_Locked_A` and `Entry_Available_A` | the viewer's colours (below) |
| `level-tower-locked`, `level-tower-solved`, `level-tower-available-<group>` | the 16-point models of the tower levels, `Entry_Hero_Locked_A` and `Entry_Hero_Available_A` | the same |
| `hero` | the game's texture `wheel_queen`, the queen's head portrait | the texture's own |
| `area-<emblem>` | the game's `OverworldIcon_<emblem>` textures, the emblems of the areas (`local_area_image` of an Area_Pin, `image` in `progress.json` `areas`; empty for the hubs and endgame areas): `soko` Heroes, `prom` Beamcasters, `mirror` Mirror Isles, `skipping` Skipping Stones, and the six pairs (`soko-prom`, `prom-mirror`, ...) | the texture's own |
| `tower-<worlds>`, `tower-<worlds>-gold` | the game's `tower_status_<worlds>` and `_gold` textures, the badges of the towers of one or two worlds: `h` Heroes, `m` Mirror Isles, `s` Skipping Stones, `p` Beamcasters, and the pairs `hm`, `hs`, `hp`, `ms`, `mp`, `sp`, picked by the tower's world bits (`t`) | the texture's own |

The texture icons are mip 0 of the texture scaled down to 128 px with an area filter on premultiplied colours and fitted
into the square keeping their aspect, so they have no outline or shadow.

- The view is orthographic: the camera sits south of the object and 25° east of south, 42° above the ground, so a
  model's front faces south, as on the map. The Level_Entry and Teleporter pads are seen straight from above, north up. The sign and the ice gate
  face +x, so they are seen from the east, 24° above, face-on.
- Where a model is placed in the overworld, the icon uses one placed entity's own fields: the first entity of that type
  with that model (and, for the Teleporters, the first gold-room endpoint or the first other one).
- The Teleporters' glowing parts take the hue of the entity's `color_discovered`, dimmer for a small intensity (the
  field's fourth number) or a dark colour. The undiscovered pads have no icons: the map dims them.
- Each Level_Entry has its own glow colour, `color_active`: mostly green, then orange, magenta, cyan, yellow, blue,
  purple and a few red. The icons group them into five by hue, `glow` in `progress.json` `levels` (green, orange,
  yellow, blue, purple, near the median of each group's colours, with 282, 220, 97, 170 and 151 of the 920 levels).
  The 16-point pads of the tower levels have their own
  icons, `tower` in `levels`.
- The level pads do not use the game's stone tints or exact colours, which hardly tell the states apart. The viewer's
  own: locked is dark grey stone (#4a5058) with no glow; available is the group's glow (green #4fe06c, orange
  #ff8a1e, yellow #ffd21a, blue #2ab4ff, purple #b048ff) on mid stone (#8c8a80), also for a level entered but not
  solved; solved is a dim gold stone (#8a7440) with no glow, for every group.
- Shading is a smooth Lambert shade from the mesh's vertex normals, a key light from the top left, a fill light from the
  right and a rim light behind. Normal maps, reflections and shadows are not drawn.
- `favicon-32.png` and `favicon-64.png` are the `Entry_Solved_A` model in bright gold (#e6b83a glow on #b8902c stone)
  seen from straight above, cropped to its star, at 32 and 64 pixels, as PNG.
