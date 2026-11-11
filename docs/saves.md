# Save files

Byte layouts of the files in a campaign folder: `Status.sokoban_status` and the `<level>.history` undo files, with
every version the game reads. Types are in [Notation](readme.md#notation).

## Files and versions

The saves live in `%USERPROFILE%\Saved Games\Order of the Sinking Star\`. On Linux the game runs under Proton, and the
same folder is in the game's prefix:
`<library>/steamapps/compatdata/499170/pfx/drive_c/users/steamuser/Saved Games/Order of the Sinking Star/`, where
`<library>` is the Steam library that holds the game: `~/.local/share/Steam` by default, or
`~/.var/app/com.valvesoftware.Steam/.local/share/Steam` with the Flatpak of Steam.

| File                               | Written | Read       |
| ---------------------------------- | ------- | ---------- |
| `<campaign>/Status.sokoban_status` | 33      | 5..33      |
| `<campaign>/<level>.history`       | 73      | 70, 72, 73 |

The game saves on a save thread. It writes `_temp_<name>`, then replaces the target. On exit, a level whose
`special_level` is not OVERWORLD or INTRO (so NONE, END1 and HEROES_CAGE_DISAPPEAR) that was won has its
`<level>.history` removed. `overworld.history`, `intro.history` and Status are never removed. A solved level that is
entered again and left without winning keeps a `.history` again: one GAP record, next 2, with the hero at the level's
start if no move was made.

Quitting writes what earlier frames queued and nothing new.

## Status.sokoban_status (campaign status)

Version 33:

| Type                                             | Field                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| u32                                              | version (33)                                                                                                                                |
| u32                                              | reserved, 0                                                                                                                                 |
| s64 × 2                                          | last saved, Apollo time                                                                                                                     |
| u8                                               | rank (`Character_Rank` 0..5: Visitor, Egressant, Pusher, Arranger, Intrepid, Sokoban)                                                       |
| s64 × 2                                          | play time, Apollo time duration                                                                                                             |
| s64                                              | achievements: bit `n` = `Achievement` value `n`; bit 0 is set too                                                                           |
| u32                                              | Skipping Stones treasures: bit = `Treasure.treasure_index` (the overworld displays show the popcount)                                       |
| 10 × u32                                         | gameplay counters ([Status.sokoban_status fields](progression.md#statussokoban_status-fields))                                              |
| s64                                              | artifacts: bit = `Artifact.kind`                                                                                                            |
| u32                                              | current area pin: the Pid of the Area_Pin whose `local_area` box holds the hero; 0 inside levels                                            |
| s32 × 3                                          | levels solved, tower levels solved, towers activated (refreshed on overworld passes)                                                        |
| u8, u8                                           | overhead-map area-names toggle; overworld reached (switches the menu between "lobby" and "overworld")                                       |
| (v23..31 only) u8 + 32 × u8                      | legacy data                                                                                                                                 |
| str16                                            | current level                                                                                                                               |
| str16                                            | the level shown behind the main menu                                                                                                        |
| u32 n, n × (str16 level, u8 `Level_State_Flags`) | per-level state: SOLVED 1, PARTIALLY_SOLVED 2, ENTERED 4, TOWER_UNLOCK_SIGNALLED 8. A level gets an entry, flags 0, when it is first loaded |
| u32 n, n × (str16, s64, str16)                   | string table, legacy                                                                                                                        |
| u32 n, n × Pid                                   | opened Freezers (`Freezer`) on the overworld                                                                                                |
| u32 n, n × Pid                                   | opened Freezers in other levels                                                                                                             |

The level state and opened Freezers can lag a level win: the history may show the hero where a win opened a Freezer
while Status lacks both. The next Status written holds them.

Older files leave fields out or carry legacy ones. A field the file lacks keeps its default: 0 or empty, and 1 for
overworld reached.

The version table is in `parseStatus()` in `src/status-file.ts`, which reads every version from 5 to 33.

Which levels unlock what, and what counts toward towers and 100%, is in
[Level_Entry unlocking and state](progression.md#level_entry-unlocking-and-state) and
[Achievements and ranks](progression.md#achievements-and-ranks).

## `<level>.history` (undo state)

Each level keeps its own undo history. On the overworld it is the only record of entity state: fog, pins,
teleporters, rocks, voice logs, existence. [Overworld state from the save](state.md#overworld-state-from-the-save)
says how the viewer reads the overworld state from it.

### Header

```
u32  version                      written 73; read 70, 72, 73
u32  Settings.level_data_version  a mismatch resets the level
s64  BASE_ENTITY_VERSION          25
s64  n; n × { str64 entity type name; s64 type version }
                                  the type index used below is the position in this table;
                                  the reader takes the old name Volumetric_Fog as Fog
u32  history flags                bit 0: the next committed record is a CHECKPOINT
s64  next move index
s64  move counter, undone moves included
u32  0
u8   n (8); n × undo mip level
undo record                       the level-start record
u32  active hero Pid
u32  next pid serial, namespace 0
u32  next pid serial, namespace 1023
u32  next pid serial, level namespace
```

The **level-start record** is committed with icon START when the history is created, then moved out of mip level 0
into this slot. It has first move 0, span 1, time 0 and no actions. A restart undoes back to it. Every kept record
starts at move 1 or later. Its hero position is (0, 0, 0) on the overworld.

### Undo mip level

```
u16 factor (1 for level 0, 25 above)   u32 capacity (400; 99999 on level 7)
s32 uncondensed count                  s32 index_in_next_that_lines_up (-1 = none)
s64 n; n × undo record
```

Level 0 holds one record per committed turn. A record of level k spans 25^k moves, or fewer when its block ended at a
CHECKPOINT. The levels overlap: a level's oldest records, all but the last `uncondensed`, are also held in condensed
form by the next level. `index_in_next_that_lines_up` is the record of the next level that starts where this level's
first record starts. Thinning is below.

### Undo record

```
s64 first move index        u32 move span            u32 active hero Pid
u16 flags (Flags)           u8 icon (Action_Icon)    u8 character (Character_Index)
f64 time (seconds into the level)                    f32 rover timer
s32 × 3 hero grid position after the move
u32 n; n × Move_Transaction           (metadata-serialized, below)
s8  n (< 128; max 8); n × lily movement group { f32; u8; u32 c, c × 12 bytes; u32 c, c × 16 bytes }
u32 n; n × action { u8 Action_Type; ... }
```

| Action_Type               | Payload                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 CHANGE                  | Pid, s64 type index, str64 entity diff blob (old and new values)                                                                                                                                                                                                                                                                                                                |
| 2 CREATION_OR_DESTRUCTION | Pid, s64 type index, str64 entity diff blob (new values only: the fields that differ from the type's defaults), u8 destroyed. 1: the record destroyed the entity, and the blob is the entity as it was. 0: the record created it, and the blob is the new entity; a position axis missing from the blob is 0. Entities made during play have Pids in namespace 1023 (pid >> 20) |
| 3 OCEAN_CHANGE            | Pid, u32 index, u8 old, u8 new (10 bytes with the type)                                                                                                                                                                                                                                                                                                                         |
| 4 SCRAPE_CHANGE           | s16 x, y, z, u8 old, u8 new, u8 axis                                                                                                                                                                                                                                                                                                                                            |

An Activator reset destroys an entity and clones it again under the same Pid: one record holds the destroyed action,
then the created one. The later action is the entity's state.

The **rover timer** is the level's countdown to the next Rover step, in seconds. It starts at
`Settings.time_per_rover_update` (type default 0.6, the overworld 1.0; 0.25 in a level without a Settings entity). It
runs down in real time while the level has Rovers; at 0 every Rover steps and the period is added back. A level without
Rovers keeps the start value in every record. Undo and load set the level's time and rover timer from the newest record.

### Record flags, icon and character

`flags` is the record's own `Flags` enum (u16, a plain enum, not `enum_flags`):

| Flag          | Meaning                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHECKPOINT 1  | `!` in the debug dump. A checkpoint fired: the hero reached a `Checkpoint` entity, or a scripted endgame point (the `end1` level, a Judge end3 state). With a move still open the checkpoint sets history flags bit 0, and the move's own record gets CHECKPOINT. Otherwise the checkpoint commits a record of its own with icon RESET. Thinning never merges past a CHECKPOINT |
| GAP 2         | pending changes committed without a player move, such as right before the history is written. Undo skips GAP records                                                                                                                                                                                                                                                            |
| CARRY 4       | a turn where the active hero only rode a lily or a rover, without a player commit. The record's hero is the rider                                                                                                                                                                                                                                                               |
| RESET_POINT 8 | set on the newest record when the level is restarted. The restart commits pending changes first                                                                                                                                                                                                                                                                                 |

`icon` is an `Action_Icon` (u8): UNKNOWN 0, WALK 1, PUSH 2, PULL 3, CHARM 4, TRANSMUTE 5, TELEPORT 6, SMASH 7, MIRROR 8,
WAND 9, TORC 10, PRISM 11, TREASURE 12, CHOP_TREE 13, PRESS_BUTTON 14, RELEASE_BUTTON 15, GOBLIN_KILL 16, DRAGON_KILL 17,
TAKE_GEM 18, DROP_GEM 19, RIDE_ON_LILY 20, FALL 21, RESET 22, START 23, RIDE_ON_ROVER 24.

`character` is a `Character_Index` (u8): NONE 0, SAILOR 1, DRUID 2, PRIESTESS 3, THIEF 4, WARRIOR 5, WIZARD 6, BARD 7,
PROMESST 8, TRADER 9, QUEEN 10, then the `_ALT` variants 11..17.

A move record takes the icon of its highest-priority move. First one wins a tie.

| Move_Type in the transaction | Icon           |
| ---------------------------- | -------------- |
| TELEPORT                     | TELEPORT 6     |
| INVENTORY_TAKE               | TAKE_GEM 18    |
| INVENTORY_DROP               | DROP_GEM 19    |
| PULLED                       | PULL 3         |
| PUSHED                       | PUSH 2         |
| CONTROLLER_PROC              | WALK 1         |
| none of these                | 0, character 0 |

The character is that move's Guy (the manipulator for take and drop), mapped from its character name (`castaway` →
SAILOR, `cleric` → PRIESTESS, `moonman` → PROMESST, ...). It is 0 when the entity is not a Guy. Records that are not
moves: START 23 (level start), RESET 22 (a checkpoint record of its own), RIDE_ON_LILY 20 or RIDE_ON_ROVER 24 (CARRY),
0 (GAP, restart, the commit before an undo); their character is 0.

Overworld records never carry CHECKPOINT; `intro` and puzzle levels do.

### Entity diff blob

```
u16 base version (BASE_ENTITY_VERSION)  u16 entity type version
repeat until end:
  u16 field: index & 0xFFF; any of the top 4 bits set (the writer uses 0x1000) = a field of the entity type,
      none = a field of Undoable_Entity_Data
  [old value]  (CHANGE only)
  new value
  u8  0xFD
```

Field indices number every serializable leaf member of the struct in declaration order. Nested structs flatten into
their leaves (`position.x`, `position.y`, ...). `#NoSerialize` members and the `using entity: Entity` base are
skipped (the exact rules are under [Jai type information](gamedata.md#jai-type-information)). Members carry version notes
(`@v14`, `@v1-24`). The index list for a given type version holds only the members whose first version is `<=` that
version, which keeps old files readable. A flattened leaf counts from its top-level member's first version (`Undoable_Entity_Data.scale.x` from v14,
the member `scale`); notes on nested members are ignored. The last version of a range does not drop a member from the
list.

Declaration order is not version order. `Rock` declares `speed_mod` (from v29), then `properties` (v28), then
`move_theta` (v15): in a version 32 blob `properties` is the type's field 1, in a version 28 blob field 0.

Values: plain data (ints, floats, bools, enums, fixed arrays and structs of them) as raw bytes of the member size.
Strings and resource pointers (`*Triangle_Mesh`, `*Material`, `*Texture`, by name) as str64. Dynamic arrays as s64
count + elements, each element plain data or a resource name (str64).

`data/schema.json` holds the index lists for `Undoable_Entity_Data` and every entity type.

### Move_Transaction and Single_Move

A record's Move_Transactions are the multi-turn movers still open when it was committed: lily, rover and falling
transactions (flags `IS_LILY_TRANSACTION`, `IS_ROVER_TRANSACTION`). The hero's own step is never among them, so the only path data in a history is each record's hero position.

Both are metadata-serialized. Each struct is written as its u16 `VERSION` constant, then each serializable leaf member
whose version range contains that version: plain data raw, dynamic arrays as s64 count + elements (struct elements
recurse, each with its own u16 version). Version notes on a parent struct are not inherited by its flattened members,
so deprecated nested members (`XXX_deprecated_visual_error`, `XXX_deprecated_charm_setup`) are still written.

- `Move_Transaction` (v3): f64 close_time, f64 commit_time, u32 transaction_id, f32 duration, f32 elapsed, u32 flags,
  s8 lily_transaction_group_index, s64 n × Single_Move.
- `Single_Move` (v8): u16 version, then 145 bytes at every version, then s64 n × 80-byte deprecated Move_Info.

### Thinning

The history keeps 8 mip levels (1 in editor mode). The level init table gives levels 0-6 capacity 400 and level 7
capacity 99999.

**Commit** (end of a turn). A new record goes onto level 0 with `first` = next move index, `span` = 1 and the hero
position rounded to the grid; `uncondensed` goes up by 1, then level 0 is condensed (not for GAP commits).

**Condense(k)**, while level k+1 exists and `uncondensed(k)` ≥ 25: merge the oldest 25 uncondensed records of level k
into one (stopping early after the first CHECKPOINT record, which makes the merged record a CHECKPOINT), append it to
level k+1 and condense level k+1.

**Forget(k)**, on every level but the top one: when a level holds 26 or more records past its capacity, drop its oldest
25 records (those the next level covers). A level settles at 401..425 records. Level 7 is never trimmed.

**Merge** keeps:

- `first` of the oldest record, `span` = the sum;
- from the newest record: the hero Pid, hero position, `time`, the rover timer, the character, the Move_Transactions
  and lily groups;
- the icon = the largest icon in the range; flags 0, or CHECKPOINT;
- one action per entity (from whether it existed before the block and exists after it):
    - existed and exists: a CHANGE with the first old and the last new value of every field touched in the block,
      emitted only when some field changed;
    - existed and gone: a destroyed record with the old values;
    - new and exists: a created record with the new values;
    - created and destroyed inside the block: nothing;
- one OCEAN_CHANGE per touched (Pid, index) and one SCRAPE_CHANGE per touched (x, y, z, axis), with the first old and
  the last new value, emitted even when they are equal.

**Undo** takes the newest record: the last record of the lowest non-empty level, else the level-start record, applies
its actions backwards and frees it; a coarser record that covers it is deleted too. Undo never reverts a CHANGE on a
`Fog_Of_War` in play, so fog stays cleared on screen ([Fog of war](state.md#fog-of-war)).

**Load** replays the coarsest non-empty level forward in full, then each finer level from the record whose `first`
equals the end move of the coarser level's last record.

### Reading the current state

- **Record key** = end move, `first` + `span`. The newest value of a field is the `new` value in the record with the
  largest end move. A merged record and the finer record that ends at the same move hold the same end state, so a tie
  between levels can go either way. The level-start record is the oldest. A field with no action holds its level-data
  value.
- **Hero position**: the s32 × 3 of the newest record with a non-zero span and a non-zero position.
- **What survives**: the newest 401..425 moves keep one hero position each. Older moves keep only the position at the
  end of each block (every 25, 625, 15625 moves). Every 25 commits drop 25 per-move positions at once, and an undo
  deletes coarse records. A kept position is a cell the hero stood on.
- **Fog cleared during an undone move** is not in the file. After a reload the region is FILLED again unless a later
  move cleared it or a hero stands in it: every frame, the game clears the fog region under each hero on the current layer.
