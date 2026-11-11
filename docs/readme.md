# Docs

How _Order of the Sinking Star_ works: its files, its rules and the logic the save viewer builds on. These pages are
meant to be enough to rebuild the viewer's map and progress logic with nothing else but the game and a save.

> [!WARNING]
> **Everything here was written by AI**, reverse engineered from the shipped game and checked against real saves. It can be wrong; points known to be uncertain are marked "(inferred)". Nothing here comes from the developers, and this unofficial fan project is not affiliated with Thekla.

## Files

| File                             | What it covers                                                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [world.md](world.md)             | The game folder, levels and saves, and the overworld: coordinates, ground layers, screens, wrapping, map rooms.                               |
| [entities.md](entities.md)       | Entity types, existence groups and collectibles.                                                                                              |
| [movement.md](movement.md)       | How a move resolves, and every mechanic that moves things.                                                                                    |
| [skills.md](skills.md)           | The hero's inputs: skills, wardrobes, TELEPORT, PULL, CHARM, TRANSMUTE, winning, move flags.                                                  |
| [progression.md](progression.md) | Level_Entry unlocking, the status fields, achievements, ranks, endings, treasures and gold rooms, the overworld level data.                   |
| [state.md](state.md)             | What a save keeps of a level: the undo history, overworld state, fog of war and areas.                                                        |
| [viewer.md](viewer.md)           | The viewer's own model: the walk, level states, roles, unlock plans, goals, level areas, the page and the spoiler rules.                      |
| [saves.md](saves.md)             | Byte layouts of the save files. Types are in [Notation](#notation).                                                                           |
| [gamedata.md](gamedata.md)       | Byte layouts of the game's data: packages, levels, render assets, localisation, the Jai type information. Types are in [Notation](#notation). |
| [datafiles.md](datafiles.md)     | The schema of every data file the viewer is built from, and the map images and marker icons.                                                  |

Reading order: this page, then world, movement, entities and skills for the game, progression and state for unlocking and saves, viewer for the viewer's model, and the byte-layout docs as reference.

## Conventions

- Names are the game's own: type, field and enum names from its Jai type information (exported to
  `data/schema.json`), plus its strings and its level and resource names. A common name is added where it helps:
  Beamcaster (`Promesst_Light`). A `Freezer` keeps its game name, and the viewer shows it as a cage (model A,
  `GAME_OVER_Freezer_A`) or a gate (model B, `GAME_OVER_Freezer_B`). The [Glossary](#glossary) lists them.
- Statements are about the overworld unless stated.
- Positions are overworld squares unless a section says otherwise. [Positions and cells](world.md#positions-and-cells)
  explains the coordinate systems.
- Status is the campaign status file `Status.sokoban_status`
  ([Status.sokoban_status (campaign status)](saves.md#statussokoban_status-campaign-status)). `level_states[name]` is
  its per-level `Level_State_Flags` table, keyed by `level_name`.
- Every fact was read in the game executable, the shipped data or reference saves, unless it says "(inferred)". The "default save" is a late-game reference campaign.
- Byte offsets are offsets inside file formats or type-info records, never addresses in the game's executable.
- Cross-references are links to headings by name.

## Notation

- All values in the files are little-endian.
- `str16` = u16 length + UTF-8 bytes. `str64` = s64 length + bytes.
- `Pid` = u32 entity id, `namespace << 20 | serial`, written `#ns-serial`. Namespace 0 is global, 1023 holds entities
  spawned at runtime, the rest are per level.
- _Apollo time_ is Jai `Apollo_Time`: a signed 128-bit count of femtoseconds, stored as two s64 (low, high).
  Wall clock: `FILETIME = (apollo - ((-630480 << 64) + 0xAE1758526CFC8000)) / 10^8`.

## Glossary

| Game term                     | Type, field or value                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| hero, Guy                     | `Guy`; the active one is named by Pid in each undo record                                                                                                                      |
| level, star on the map        | `Level_Entry` (`level_name` = the level file)                                                                                                                                  |
| Freezer, cage, gate           | `Freezer` (open = `unfrozen`); the viewer shows it as a cage (model A, `GAME_OVER_Freezer_A`) or a gate (model B, `GAME_OVER_Freezer_B`)                                       |
| gate, barrier                 | `Gate` (open = `open`), driven by `Switch`es of the same `flavor`, or by Monsters (`is_monster_gate`)                                                                          |
| button                        | `Switch`                                                                                                                                                                       |
| rock, boulder, crystal, stone | `Rock`; crystal = a TRANSMUTE product (`transmuted_from_entity_type`); stone = `properties` SKIPPABLE                                                                          |
| beamcaster                    | `Promesst_Light`; its beam's colour is `color` (`Promesst_Power`)                                                                                                              |
| gem, socket                   | `Gem`, `Gem_Slot`                                                                                                                                                              |
| rod, torc, prism              | `Artifact` (`kind` PROMESST_1/2/3_WAND), held as `Guy.inventory_flags` WAND, TORC, PRISM                                                                                       |
| mirror, magic mirror          | `Mirror` (`is_magic`, `is_vertical`, `is_vertical_downward`, `mirrorable`)                                                                                                     |
| lily pad                      | `Lily`                                                                                                                                                                         |
| rover                         | `Rover` (`forward`, `stalled`, `mirrorable`)                                                                                                                                   |
| goblin, dragon                | `Monster` with `constant_flags` GOBLIN (1) / DRAGON (2)                                                                                                                        |
| friendly dragon               | `Friendly_Dragon`                                                                                                                                                              |
| wardrobe, outfit              | `Wardrobe` (`skill_flags` or `inventory_flags`)                                                                                                                                |
| skill                         | `Guy.skill_flags` (`Skill_Flags`)                                                                                                                                              |
| character                     | `Character_Index` (Sailor, Druid, Priestess, Thief, Warrior, Wizard, Bard, Promesst, Trader, Queen, `_ALT` variants)                                                           |
| teleporter pad                | `Teleporter` (`teleporter_type` MINOR 0 / MAJOR 1)                                                                                                                             |
| map room, fast travel         | the three miniature copies of the world above z 74.66, holding the MAJOR pads' twins                                                                                           |
| elevator                      | `Stairs` frame pair + `Elevator_Platform`                                                                                                                                      |
| reset pad                     | `Activator` (mesh `GAME_OVER_Reset_A`) with up to 16 `Spawner`s                                                                                                                |
| river                         | flow `Direction` bits in `Ocean_Map.ocean_values`; rewritten by `Flow_Updater` fronts                                                                                          |
| area                          | `Area_Pin` plus `Marker`s with `script_name` `local_area`                                                                                                                      |
| map scroll                    | `View_Giver`                                                                                                                                                                   |
| voice log                     | `Voice_Log`                                                                                                                                                                    |
| tower                         | `Tower`                                                                                                                                                                        |
| dropdown level                | `Level_Entry.dropdown`: a tower level that counts only for the tower's gold status                                                                                             |
| sign                          | `Sign`; some open Freezers by rank, tower or gold rooms ([Sign `rank_satisfied`](progression.md#sign-rank_satisfied))                                                          |
| rank                          | Status `rank` (`Character_Rank`, Visitor to Sokoban)                                                                                                                           |
| gold room                     | where a ground tower's MINOR pad leads: its `gold_room_endpoint` Teleporter in the ground antipode hub ([Treasures and gold rooms](progression.md#treasures-and-gold-rooms))   |
| crossroads, antipode hub      | the hub area of each layer (`area_g_crossroads`, `area_s_upper_crossroads`, `area_u_crossroads_low`), and the hubs half a period from them ([Endings](progression.md#endings)) |
| treasure, plinth              | `Treasure` (in level `skipping_stones`), `Treasure_Display` (on the overworld)                                                                                                 |
| fog                           | `Fog_Of_War` (+ `Fog_Of_War_Z`, `Fog_Of_War_Clear`)                                                                                                                            |
| existence group               | `Group` with `is_existence_group`                                                                                                                                              |
| screen, room                  | a 19 × 13 block of squares within one ground layer (`Settings.squares_per_screen_x/y`)                                                                                         |
| layer                         | a ground layer: a z band of the one overworld grid ([The overworld: coordinates, layers, screens, wrapping](world.md#the-overworld-coordinates-layers-screens-wrapping))       |
