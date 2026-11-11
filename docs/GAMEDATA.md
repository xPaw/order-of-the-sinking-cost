# Game data formats

Byte layouts of the game's own data: the packages and `.entities` levels, the render assets (vertex paint, meshes,
textures, materials, water), localisation and display names, and the Jai type information the schema is read from. Types
are in [Notation](readme.md#notation).

## Game data packages

| File                                                     | Contents                                                                                                                                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/levels.package`                                    | `simp`: a `data-common/<level>.entities` and a `data-common/<level>.level_manifest` per level, the `data/level_sets/<set>.level_set` lists, one `data-pc/all.asset_manifest` |
| `data/materials.package`                                 | `simp`, text `.material` files under `data/art/...`                                                                                                                          |
| `data/shaders.package`                                   | `simp`, `data-pc/*.shader`                                                                                                                                                   |
| `data/animation.package`                                 | `simp`: animations and animation graphs (not decoded)                                                                                                                        |
| `data/All.variables`                                     | text variables, `:/Startup` section (`steam`, `running_packaged`, ...)                                                                                                       |
| `data/strings/*.localization`, `data/strings/subtitles/` | text (below)                                                                                                                                                                 |
| `data-common/<level>.all_paint_data`                     | per-entity vertex paint, one per level (below)                                                                                                                               |
| `data-pc/<mesh>.compressed_mesh`                         | meshes (below)                                                                                                                                                               |
| `data-pc/<name>.texture`                                 | textures (below), plus `*-probe_array.texture` light-probe arrays                                                                                                            |
| `data-pc/__<level>.texture`                              | level pictures: the level's start state from above, 2048 × 1152 BC1                                                                                                          |

### simp packages

A flat archive. Member data is contiguous from 0x40 to the table of contents, which runs to the end of the file.

| Offset | Type    | Field                                 |
| ------ | ------- | ------------------------------------- |
| 0x00   | char[4] | `simp`                                |
| 0x04   | u32     | version, 1                            |
| 0x10   | u64     | TOC offset                            |
| 0x40   |         | member data, back to back, no padding |

**TOC** (at the TOC offset):

| Offset | Type         | Field                                               |
| ------ | ------------ | --------------------------------------------------- |
| +0x00  | char[4], u32 | `toc!`, 0                                           |
| +0x08  | s64          | member count                                        |
| +0x40  | n × entry    | `u32 name length; name; u8 0; s64 size; s64 offset` |

### levels.package members

| Member                   | Format                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<level>.entities`       | level entities, below                                                                                                                                                                                                           |
| `<level>.level_manifest` | text: a `[1]` line, then `;;;;; textures` and `;;;;; meshes` sections, one resource name per line (`<name>~<level>` for per-level tint maps)                                                                                    |
| `<set>.level_set`        | text: a `[1]` version line, then one level name per line. `#` starts a comment, also after a name. `*directive` lines (`*choice`, `*worlds_collide`, `*glyphs`, ...) are not levels. A level can be in several sets, or in none |
| `all.asset_manifest`     | binary, starts `03 00 00 00` (not decoded)                                                                                                                                                                                      |

### `<level>.entities`

```
char[4] 'enty'
u16     version                  7 (versions <= 6 have no type table)
s64     BASE_ENTITY_VERSION      25
s64     n; n × { str64 entity type name; s64 type version }   the same table as in .history; every type in every level
u32     entity count
count × { u32 Pid; u16 type index; u32 blob length; blob }
```

The blob is an entity diff blob without the two u16 version words, which come from the header and the type table. It
is in CHANGE form: every field carries the type's default as the old value and the level's value as the new one. A
field missing from the blob holds the type default (position 0, scale 1, ...). Fields come in index order,
`Undoable_Entity_Data` fields first, then the type's own (bit 0x1000).

Pids are scoped to the level. The save's `.history` refers to them raw, but the same Pid appears in several levels,
often with different types. The namespace is not a level id: a level mixes many namespaces and one namespace spans many
levels. `#1021-1` is the `Level_State` in every level that has one. Cross-entity references (`unlocked_by_id`, `extension_of`, `target_id`, `map_label_marker_id`, ...) resolve
inside the same level.

### The grid

- At every level load the walls rebuild computes `Settings.grid` (corner and size) from the level's contents; a level
  with no Settings entity gets one, computed the same way. The stored grid counts only with `Settings.lock_grid`:
  then its x and y are kept, and it seeds the computed box in z. Wrapping plays no part: a wrapping level gets the
  computed box too, and wraps by it ([Wrapping](world.md#wrapping)).
- The box is the union of: each Wall_Set's `wall_data` box turned and moved by the set (both corners, corner and
  corner + dimensions − 1, rotated by its orientation, its position added, then min and max per axis, truncated to
  int); each Ocean_Map's grid box, turned and moved by the map's orientation and position the same way; the cells of every Guy, Rock, Door, Gate, Promesst_Light, Monster and Gem; and
  every floor Fence's cell. An empty level gets 1 × 1 × 1 at 0.
- In a level with an Annihilator the bottom goes down to ⌊z − 2 + 0.5⌋ of the Annihilator, and every side is padded by
  the largest `expand_bounds`.
- With `lock_grid` the Wall_Sets are skipped: the stored corner and size seed the box, and the Ocean_Maps, entity
  cells, floor Fences, the Annihilator and `expand_bounds` are added to it. The stored x and y are kept; z
  (`grid.corner.z`, `squares_z`) comes from that union, so it is never smaller than the stored z. The overworld has
  `lock_grid` set ([Settings (overworld values)](world.md#settings-overworld-values)).
- Voxels against the box: only existing Wall_Sets of kind WALLS are placed, each voxel at round(R · local + position)
  ([Wall_Set `wall_data` (voxels)](#wall_set-wall_data-voxels)). On a wrapping level x and y wrap once, by the grid or,
  above the fast-travel threshold, by the fast-travel box. A voxel still outside the grid in x or y is dropped. A voxel outside it only in z loses its own bit but still sets its column bit, so a column with voxels only
  above or below the z range counts as inside the level. Without `lock_grid` every voxel lies inside the box.
- The grid decides which cells are in the level for the solid query and the column mask ([Support](movement.md#support)).

## Render assets

The game draws the overworld from these.

**Asset header** (`.compressed_mesh`, `.texture`, `.shader`): `u16, u16, u16, u16 header length, u32 total size`
(header included), then an LZ4 block of `total - header` bytes. A file whose size equals the total is stored
uncompressed. Meshes have a 12-byte header, textures 40, shaders 24.

### `data-common/<level>.all_paint_data`

Per-entity vertex paint, version 6, all fields u32:

```
'allp'  version 6  entity count  array count
array count × { mesh checksum; n; n × paint }      arrays are shared by entities with identical paint
entity count × { Pid; array index }
```

A paint value is one vertex's RGBA8 (byte 0 = red). The array replaces the mesh's own vertex colours when its checksum
equals the mesh's checksum and its count equals the mesh's vertex count. The shaders
read it as layer weights, not colour: red exposes layer B (`blended2`, `ground_general`: weight
`clamp(r + h * (r + mask - 1))`, h = `blend_hardness`, mask = the `MASKS_tex` channel), blue attenuates normals.

### `data-pc/<mesh>.compressed_mesh` (decompressed)

```
u32 LOD count (3)   u32 vertex count   u32 checksum   u8, u8, u8 skinned, u8
f32 × 6 bounding box (min xyz, max xyz)   f32, f32   u32   u32 triangle list count (nl)
vertex count × f32 × 3 positions (+ 8 bytes per vertex when skinned: u8 × 4 skin weights, summing to 255, then
                                  u8 × 4 bone indices)
vertex count × 20 bytes: f32 u, f32 v (bytes 0..7), 4 bytes of a second texture coordinate pair (bytes 8..11, half
                         floats; unused ones hold stray bytes), u32 normal (bytes 12..15), u32 tangent (bytes 16..19)
vertex count × u32 vertex colour (default paint, same layout as all_paint_data)
LOD count × { nl × { u32 material index, u32 index count, u32 first index }
              u32 index count, u32 byte size, u16 format (0 = u16, 1 = u32), indices }
nl × str16 material name
```

A LOD's index buffer holds each list twice, the second copy with reversed winding (for mirrored placements). A front
face winds counter-clockwise seen from outside. A texture's last row is v = 0.
Positions are in metres in the entity's space: world = rotate(quaternion) · (scale × p) + position.
`base.materials[i]`, when non-empty, overrides material `i`.

A normal and a tangent are each 10-10-10-2 unsigned normalised: x in bits 0..9, y in 10..19, z in 20..29, component
= value / 511.5 − 1.

A skinned mesh ends with its skeleton: u32 node count, then per node `str16 name` and 16 f32, the inverse bind matrix
(row-vector convention, translation in the last row, last element 0.01). Its bone indices are node indices, in the
order of the bones of the model's `data-common/<name>.anim` in `data/animation.package` (not decoded here).

### `data-pc/<name>.texture`

Header bytes 12..: `u16 width, u16 height, u16 depth, u16 mips, u8 format, u8, u8, u8`. Format 0 = BC1, 1 = BC3,
5 = 4 bytes per pixel (RGBA8) are decoded, and 2 (8-byte blocks, masks) as BC4. 3 (16-byte blocks, normal maps) fits
BC5; 4 (16-byte blocks, light-probe arrays) is not decoded. Mips follow largest first, laid out like a D3D12 upload:
each block row padded to 256 bytes, each mip padded to 512.

### data/materials.package

Text materials: `# material version 1`, then `key value` lines (`"string"`, `(x y z w)`, numbers, `true`/`false`,
`flag Name`). `parent "<name>"` inherits every key the material does not set. `shader` picks the shader. The
albedo-related keys:

| Shader                               | Albedo                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `blended2`                           | lerp(`DIFFR_A` × `tint_color_A` × entity `tint_color_a`, `DIFFR_B` × `tint_color_B` × entity `tint_color_b`, paint weight); `use_tint_mask` limits the entity colour to `tint_mask_tex`; `swap_entity_colors` swaps a and b                                                                                                                                                                                                          |
| `ground_general`                     | as `blended2`, but each layer is also multiplied by a world-space tint map `tint_map_A/B`: u = (x − `tint_map_offset_X`) / `tint_map_size_XY`, v = (`tint_map_offset_Y` − y) / size, after rotating x, y by `tint_map_rotation` × 90°. `tint_align_mode` 1 and 2 use fixed maps: u = (x + 0.5) / 24, v = (−0.5 − y) / 24, and u = (x + 5) / 84.667, v = (−5 − y) / 84.667. The entity colour applies only with `use_tint_colors_A/B` |
| `basic`, `foliage*`, `rocks_general` | `DIFFR_tex` × tint; alpha = opacity in the masked variants                                                                                                                                                                                                                                                                                                                                                                           |
| `crystal_general`                    | `color_core` / `fracture_color`                                                                                                                                                                                                                                                                                                                                                                                                      |
| `additive`                           | emitted light, `tint_color` × the entity's effect colour: the glow of Level_Entry and Teleporter models, whose entity colour fields (`color_active`, `color_discovered`, …: red, green, blue, intensity) set it                                                                                                                                                                                                                      |

A material's booleans reach the shader as bits of its `material_flags` constant: the n-th boolean switch in the
`.shader`'s parameter list is bit n, set when the material (or a parent) has `<name> true`.

### Ocean_Map (water)

- The grid is in the entity's local frame: `grid.corner` is relative to the position; `grid.squares_x/y`;
  `ocean_values[k]`, k = i + j × squares_x, is the square at position + R(orientation) · (corner + (i, j)), rounded.
  A lookup at p turns the point back, local = R(orientation)⁻¹ · (p − position), and reads the square of `grid` that
  holds it, counted from `corner`. The map wraps with the level grid. The overworld has no rotated Ocean_Map.
- Value bits: 0 = water, 1 = river polarity, 2..4 = flow `Direction` (1 E, 2 N, 3 W, 4 S).
- With `detect_holes`, every square is set to water at load, and the voxels of each `OCEAN_HOLE` Wall_Set whose
  `ocean_hole_id` names the map clear bit 0 again.
- The movement rules (falling, drowning, stepping into water) take the map's own z as the water surface and never read
  `sink`. Only the drawing does: it puts the water surface `sink` below z. `sink` defaults to −1 (type initializer); a
  negative sink means 0.1.
- A save's OCEAN_CHANGE actions carry the new byte. Who writes them is in [Water in the save](state.md#water-in-the-save).
- A `Flow_Updater` (type version 8; fields `mode`, `first_move`, `direction`, `ocean_write_direction`, `soft_killed`,
  `river_polarity`) is a river front made at run time. `mode` is a `Flow_Updater_Mode`: FLOWING_FORWARD 0, ERASING 1,
  DIVERTING_RIGHT 2, DIVERTING_LEFT 3, DIVERTING_GIVE_UP 5. No value 4.

### Wall_Set `wall_data` (voxels)

- Fields: `corner` (local, from the position), `dimensions` (w, d, h) and `bits.slots`, a bit set in 64-bit words.
- Bit k is the voxel at local = corner + (k % w, ⌊k / w⌋ % d, ⌊k / (w · d)⌋). Its world cell is
  round(R(orientation) · local + position); an unrotated set uses its position's cell + local. The scale is not applied
  (the scaled overworld Wall_Sets are not rotated). The puzzle levels hold Wall_Sets turned +90° and −90°.
- An `OCEAN_HOLE` Wall_Set's voxels clear the map squares in the same world cell ([Ocean_Map (water)](#ocean_map-water)).

## Localisation and display names

`data/strings/<language>.localization`: one file per language (`de`, `en`, `es`, `fr`, `it`, `ja`, `ko`, `pt-br`, `ru`, `s-cn`,
`t-cn`), plus `subtitles/`. UTF-8 text with UNIX line endings; the first line is a `#` comment. A key line starts with
a backtick. The value is the following lines, up to a blank line or the next key.

| Keys                                             | What                                                                                                                                           |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `judge_*`, `sign_*`                              | Judge and Sign text                                                                                                                            |
| `area_g_*`, `area_s_*`, `area_u_*`               | area names, keyed by `Area_Pin.local_area_name` (ground, sky, underworld)                                                                      |
| `rank_visitor` .. `rank_sokoban`, `rank_granted` | `Character_Rank` names; "Rank Granted: %"                                                                                                      |
| `campaign_*`                                     | campaign folder names: `campaign_name_default` and the random word lists ([Campaigns and level sets](progression.md#campaigns-and-level-sets)) |
| the rest                                         | interface text, key names and one-off strings                                                                                                  |

Not in the game files:

- **Level names.** Levels have no display names. A level is known by its `Level_Entry.level_name`, which is also its
  file name; the viewer shows that.
- **Achievement names.** The localisation has no achievement keys; the names are Steam's, and Steam's bit is the
  `Achievement` value − 1. English names: HEROES "Heroes", MIRRORS "Mirror Isles", SKIPPING "Skipping Stones", PROMISE
  "Beamcasters", ENDGAME1 "Endgame", ENDGAME2 "Endgame High", ENDGAME3 "Endgame Low", ASCEND "Ascend", DESCEND
  "Descend", COMPLETIONIST "Completionist"; `TOWER_<w>` "Antipode <w>", `TOWER_<w>_SKY` "High <w>",
  `TOWER_<w>_UNDERWORLD` "Low <w>", `GOLD_<w>` "Gold <w>". `<w>` is the tower's worlds: one world by name (Heroes,
  Mirrors, Skipping Stones, Beamcasters), a pair as its letters joined by `x` (H, M, S, and B for P: "HxS", "MxB").
- **Tower names** in the viewer are the names of their achievements: "Antipode <w>", "High <w>", "Low <w>".

## Jai type information

The game's types come from the Jai runtime type info in the executable: one `Type_Info` record per type, in read-only
data, linked by pointers. Jai `string` = `{s64 count; *u8 data}`. An array view `[] T` = `{s64 count; *T data}`. A resizable array `[..] T` =
`{count, data, s64 allocated, Allocator {proc, data}}` (40 bytes). All offsets are in bytes.

`Type_Info` (16): `u32 type` (`Type_Info_Tag`), padding (read the tag as a u32),
`s64 runtime_size`.

`Type_Info_Tag`: INTEGER 0, FLOAT 1, BOOL 2, STRING 3, POINTER 4, PROCEDURE 5, VOID 6, STRUCT 7, ARRAY 8, ENUM 11,
VARIANT 18.

| Kind                     | Members after `info` (offset)                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Type_Info_Integer`      | 16 `bool signed`                                                                                                                                                                                                         |
| `Type_Info_Pointer`      | 16 `*Type_Info pointer_to`                                                                                                                                                                                               |
| `Type_Info_Array` (40)   | 16 `*Type_Info element_type`, 24 `Array_Type array_type` (u16: FIXED 0, VIEW 1, RESIZABLE 2), 32 `s64 array_count` (−1 unless FIXED)                                                                                     |
| `Type_Info_Variant` (40) | 16 `string name`, 32 `*Type_Info variant_of` (a named distinct type, such as `Pid` over u32)                                                                                                                             |
| `Type_Info_Enum` (80)    | 16 `string name`, 32 `*Type_Info_Integer internal_type`, 40 `[] string names`, 56 `[] s64 values`, 72 `u32 enum_type_flags`                                                                                              |
| `Type_Info_Struct` (160) | 16 `string name`, 32 `[] Type_Info_Struct_Member parameters`, 48 `specified_parameters`, 64 `members`, 80 `[] Type_Info_Tagged_Union_Binding tagged_union_bindings`, 128 `[] u8 constant_storage`, 144 `[] string notes` |

`Type_Info_Struct_Member` (64): 0 `string name`, 16 `*Type_Info type`, 24 `s64 offset_in_bytes` (−1 for
constants), 32 `u32 flags`, 40 `[] string notes`, 56 `s64 offset_into_constant_storage`.

Member flags: CONSTANT 1, IMPORTED 2, USING 4, AS 0x10, OVERLAY 0x20.
`using #as` sets 0x14; every entity type's `entity` member carries it. A note is the text
after `@` in the source: `@v14` → `v14`, `@NoSerialize` → `NoSerialize`.

`enum_type_flags` is 0x10000 on the types declared `enum_flags` and 0 on the other enums.

### Reading the schema out of the binary

The schema exporter is an IDAPython script run on the game binary. It writes `data/schema.json`.

- **Types.** Scan read-only data for records whose tag is STRUCT (or ENUM) and whose name string points into read-only
  data. A name can have several records; a type's own record is the one with a `VERSION` member.
- **Type version.** `VERSION` is a CONSTANT member; its value is the s64 at `constant_storage.data +
  offset_into_constant_storage`. A type without one is version 1.
- **Fields.** Walk `members` in order and skip:
    - CONSTANT, IMPORTED and OVERLAY members;
    - VOID members (zero-size editor page markers such as `Config` or `_Config` with `SwitchToPage:...`);
    - the `using #as` base at offset 0 (`using entity: Entity`);
    - members noted `NoSerialize`;
    - inside a flattened struct, members that overlap earlier ones;
    - `allocator` and `allocator_data` inside a `Bit_Array`.
- **Flattening.** A struct member flattens into its leaves (`position.x`). Each leaf takes its top-level member's
  version note. Each remaining leaf gets the next field index.
- **Field versions.** `vN` = present from type version N; `vN-M` = present in N..M. The field list for a file version
  keeps every member whose first version is `<=` it. The end version is not applied: a retired field (`vN-M`, usually
  renamed `xxx_deprecated_*`) stays in the list of every later version and takes an index there, though only blobs of
  versions N..M carry it. A field index is a position in the list for the blob's version, so a field added in the
  middle moves the indices of the fields after it in newer blobs only. `NoUndo`, `NoEditorUndo` and `NoEditorSave` mark
  fields that undo or the editor leave alone.
- **Value kinds.** Plain data has INTEGER, FLOAT, BOOL or ENUM leaves (or fixed arrays and structs of them). The other
  values are strings, pointers to `Triangle_Mesh` / `Material` / `Texture` (by name) and dynamic arrays.
- **Enums.** Read `names[i]` and `values[i]`. Flags = `enum_type_flags & 0x10000`. Enum names are not unique (several
  are named `Flags`), so an enum is identified by the field that uses it.
