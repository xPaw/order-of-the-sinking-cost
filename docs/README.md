# Docs

How *Order of the Sinking Star* works: its files, its rules and the logic the save viewer builds on. These pages are
meant to be enough to rebuild the viewer's map and progress logic with nothing else but the game and a save.

> [!WARNING]
> **Everything here was written by AI.** Claude reverse engineered the shipped game to produce it: decompiling the executable, reading the game's data packages and the Jai type information they carry, and comparing the results against real save files. No one at Thekla was involved, and nothing here comes from the developers.
>
> **It can be wrong.** The rules were read out of compiled code and checked against a handful of saves, not taken from any source. Some details are inferred rather than confirmed, and a game update can change any of them. Points we know are uncertain are marked "(inferred)", and the open questions are in [Unconfirmed](UNCONFIRMED.md). Everything else may still contain mistakes. Treat it as a best effort, not a reference.
>
> This is an unofficial fan project, not affiliated with or endorsed by Thekla.

## Files

| File | What it covers |
|---|---|
| [WORLD.md](WORLD.md) | The game folder, levels, level sets and saves, and the overworld: its coordinates, ground layers, screens and rooms, wrapping and map rooms. |
| [ENTITIES.md](ENTITIES.md) | The overworld's entity types, the existence groups that make entities appear and vanish together, and the collectibles. |
| [MOVEMENT.md](MOVEMENT.md) | How a move resolves (support, falling, water, pushing and pulling) and every mechanic that moves things: gates, rocks, skipping stones, monsters, beams, mirrors, rovers, lilies, rivers, elevators, pads and Spawners. |
| [SKILLS.md](SKILLS.md) | The hero's inputs: skills, wardrobes, a direction press, TELEPORT and PULL, CHARM, TRANSMUTE and the other skills, winning, and the move flags. |
| [PROGRESSION.md](PROGRESSION.md) | The game's progression rules: Level_Entry unlocking (Freezers, Signs, towers), the campaign status fields, achievements and ranks, the endings, campaigns and level sets, the in-game progress displays, treasures and gold rooms, and the overworld level data. |
| [STATE.md](STATE.md) | What a save keeps of a level and how it is read: the undo history, the overworld state from the save, fog of war and areas. |
| [VIEWER.md](VIEWER.md) | The viewer's own model built on the game's rules: the walk, level states, roles, unlock plans, goals and their roles, level areas, the page and the spoiler rules. The game does none of those; they are how the viewer approximates what the player can reach. |
| [SAVES.md](SAVES.md) | Byte layouts of the save files, `settings.menu_state`, `Status.sokoban_status` and the `<level>.history` undo files, with every version the game reads. Types are in [Notation](#notation). |
| [GAMEDATA.md](GAMEDATA.md) | Byte layouts of the game's own data: the packages and `.entities` levels, the grid computed at load, the render assets (vertex paint, meshes, textures, materials, water), localisation and display names, and the Jai type information the schema is read from. Types are in [Notation](#notation). |
| [DATAFILES.md](DATAFILES.md) | The schema of every data file the viewer is built from (`schema.json`, `levels.json`, `level_areas.json`, `fog.json`, `map.json`, `world.json`, `progress.json`, `walk.json`) and the map images. |
| [UNCONFIRMED.md](UNCONFIRMED.md) | Open questions: what was not traced or confirmed in the game, and what the viewer's model does not explain yet. |

## Conventions

- Names are the game's own: type, field and enum names from its Jai type information (exported to
  `data/schema.json`), plus its strings and its level and resource names. A common name is added where it helps:
  Beamcaster (`Promesst_Light`). A `Freezer` keeps its game name, and the viewer shows it as a cage (model A,
  `GAME_OVER_Freezer_A`) or a gate (model B, `GAME_OVER_Freezer_B`). The [Glossary](#glossary) lists them.
- Statements are about the overworld unless stated.
- Positions are overworld squares unless a section says otherwise. [Positions and cells](WORLD.md#positions-and-cells)
  explains the coordinate systems.
- Status is the campaign status file `Status.sokoban_status`
  ([Status.sokoban_status (campaign status)](SAVES.md#statussokoban_status-campaign-status)). `level_states[name]` is
  its per-level `Level_State_Flags` table, keyed by `level_name`.
- Every fact was read in the current game executable (Windows x64, the only build), the shipped data or the two
  reference saves, unless it says "(inferred)". The **default save** is a late-game campaign (its folder is named
  `default`); the **fresh save** is a second campaign, early in the game.
- Byte offsets are offsets inside file formats or type-info records, never addresses in the game's executable.
- Cross-references are links to headings by name. Headings carry no numbers.

## Notation

- All values in the files are little-endian.
- `str16` = u16 length + UTF-8 bytes. `str64` = s64 length + bytes.
- `Pid` = u32 entity id, `namespace << 20 | serial`, written `#ns-serial`. Namespace 0 is global, 1023 holds entities
  spawned at runtime, the rest are per level.
- *Apollo time* is Jai `Apollo_Time`: a signed 128-bit count of femtoseconds, stored as two s64 (low, high).
  Wall clock: `FILETIME = (apollo - ((-630480 << 64) + 0xAE1758526CFC8000)) / 10^8`.

## Glossary

| Game term | Type, field or value |
|---|---|
| hero, Guy | `Guy`; the active one is named by Pid in each undo record |
| level, star on the map | `Level_Entry` (`level_name` = the level file) |
| Freezer, cage, gate | `Freezer` (open = `unfrozen`); the viewer shows it as a cage (model A, `GAME_OVER_Freezer_A`) or a gate (model B, `GAME_OVER_Freezer_B`) |
| gate, barrier | `Gate` (open = `open`), driven by `Switch`es of the same `flavor`, or by Monsters (`is_monster_gate`) |
| button | `Switch` |
| rock, boulder, crystal, stone | `Rock`; crystal = a TRANSMUTE product (`transmuted_from_entity_type`); stone = `properties` SKIPPABLE |
| beamcaster | `Promesst_Light`; its beam's colour is `color` (`Promesst_Power`) |
| gem, socket | `Gem`, `Gem_Slot` |
| rod, torc, prism | `Artifact` (`kind` PROMESST_1/2/3_WAND), held as `Guy.inventory_flags` WAND, TORC, PRISM |
| mirror, magic mirror | `Mirror` (`is_magic`, `is_vertical`, `is_vertical_downward`, `mirrorable`) |
| lily pad | `Lily` |
| rover | `Rover` (`forward`, `stalled`, `mirrorable`) |
| goblin, dragon | `Monster` with `constant_flags` GOBLIN (1) / DRAGON (2) |
| friendly dragon | `Friendly_Dragon` |
| wardrobe, outfit | `Wardrobe` (`skill_flags` or `inventory_flags`) |
| skill | `Guy.skill_flags` (`Skill_Flags`) |
| character | `Character_Index` (Sailor, Druid, Priestess, Thief, Warrior, Wizard, Bard, Promesst, Trader, Queen, `_ALT` variants) |
| teleporter pad | `Teleporter` (`teleporter_type` MINOR 0 / MAJOR 1) |
| map room, fast travel | the three miniature copies of the world above z 74.66, holding the MAJOR pads' twins |
| elevator | `Stairs` frame pair + `Elevator_Platform` |
| reset pad | `Activator` (mesh `GAME_OVER_Reset_A`) with up to 16 `Spawner`s |
| river | flow `Direction` bits in `Ocean_Map.ocean_values`; rewritten by `Flow_Updater` fronts |
| area | `Area_Pin` plus `Marker`s with `script_name` `local_area` |
| map scroll | `View_Giver` |
| voice log | `Voice_Log` |
| tower | `Tower` |
| dropdown level | `Level_Entry.dropdown`: a tower level that counts only for the tower's gold status |
| sign | `Sign`; some open Freezers by rank, tower or gold rooms ([Sign `rank_satisfied`](PROGRESSION.md#sign-rank_satisfied)) |
| rank | Status `rank` (`Character_Rank`, Visitor to Sokoban) |
| gold room | where a ground tower's MINOR pad leads: its `gold_room_endpoint` Teleporter in the ground antipode hub ([Treasures and gold rooms](PROGRESSION.md#treasures-and-gold-rooms)) |
| crossroads, antipode hub | the hub area of each layer (`area_g_crossroads`, `area_s_upper_crossroads`, `area_u_crossroads_low`), and the hubs half a period from them ([Endings](PROGRESSION.md#endings)) |
| treasure, plinth | `Treasure` (in level `skipping_stones`), `Treasure_Display` (on the overworld) |
| fog | `Fog_Of_War` (+ `Fog_Of_War_Z`, `Fog_Of_War_Clear`) |
| existence group | `Group` with `is_existence_group` |
| screen, room | a 19 × 13 block of squares within one ground layer (`Settings.squares_per_screen_x/y`) |
| layer | a ground layer: a z band of the one overworld grid ([The overworld: coordinates, layers, screens, wrapping](WORLD.md#the-overworld-coordinates-layers-screens-wrapping)) |
