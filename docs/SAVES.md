# Save files

Byte layouts of the save files, `settings.menu_state`, `Status.sokoban_status` and the `<level>.history` undo files,
with every version the game reads. Types are in [Notation](README.md#notation).

## Files and versions

The saves live in `%USERPROFILE%\Saved Games\Order of the Sinking Star\`.

| File | Written | Read | Changes between versions |
|---|---|---|---|
| `settings.menu_state` | 9 | | the reader gates each field on the file's version (the "Since" column below) |
| `Unsynced_Settings.menu_state` | no longer | | a stale version 4 file; the game does not write it |
| `<campaign>/Status.sokoban_status` | 33 | 5..33 | the version table below |
| `<campaign>/<level>.history` | 73 | 70, 72, 73 | none in this build: the loader checks the version, then reads all three the same way; nothing else reads the version. Rejected: ≤ 69, 71, ≥ 74 |
| `data-common/<level>.entities` (in `levels.package`) | 7 | | versions ≤ 6 have no type table |

The game saves on a save thread. It writes `_temp_<name>`, then replaces the target, up to 11 tries. Winning a level
marks its save request VICTORY. On exit, a level whose `special_level` is not OVERWORLD or INTRO (so NONE, END1 and
HEROES_CAGE_DISAPPEAR) queues the removal of its own `<level>.history` (`File_Save_Reason.VICTORY`), and the save
thread deletes it ("Successfully removed file '%' due to %."). `overworld.history`, `intro.history` and Status are
never removed.

A solved level that is entered again and left without winning keeps a `.history` again: one GAP record, next 2, with
the hero at the level's start if no move was made.

On quit the main loop stops when its quit flag is set. The shutdown then stops audio, signals the campaign save thread
and waits for it ("Save thread stopped."). The save thread empties its whole queue before it obeys the stop flag.
Nothing after the loop queues a new save, so quitting writes what earlier frames queued and nothing new.

## settings.menu_state

`u32 version`, then fields in the order they were added. The reader stops at the file's version.

| Since | Type | Field |
|---|---|---|
| 1 | f32, f32 | music volume, sfx volume (0..1) |
| 1 | s8 | render resolution (`Render_Resolution`) |
| 3 | u8 | graphics mode (`Graphics_Mode`) |
| 4 | u8, u8 | fullscreen, window maximized |
| 4 | 4 × s32 | window rect |
| 5 | f32, f32 | voice volume, overall volume |
| 5 | u16, u8 | text language (`Language`), language explicitly chosen |
| 6 | u8, u8, s64, u8 | subtitles, vsync, target frame rate (0 = unlimited), unknown flag |
| 7 | s64, u32 | vsync interval divisor, unknown |
| 8 | s64 | MSAA mode (`Msaa_Mode`) |
| 9 | u16, u8 | voice language, voice language explicitly chosen |

## Status.sokoban_status (campaign status)

Version 33:

| Type | Field |
|---|---|
| u32 | version (33; the reader takes 5..33) |
| u32 | reserved, 0 |
| s64 × 2 | last saved, Apollo time |
| u8 | rank (`Character_Rank` 0..5: Visitor, Egressant, Pusher, Arranger, Intrepid, Sokoban); it only goes up |
| s64 × 2 | play time, Apollo time duration |
| s64 | achievements: bit `n` = `Achievement` value `n`; bit 0 is set too |
| u32 | Skipping Stones treasures: bit = `Treasure.treasure_index` (the overworld displays show the popcount) |
| 10 × u32 | gameplay counters ([Status.sokoban_status fields](PROGRESSION.md#statussokoban_status-fields)); written and saved, never read |
| s64 | artifacts: bit = `Artifact.kind`, only kinds 3-6 (unobtainable; always 0) |
| u32 | current area pin: the Pid of the Area_Pin whose `local_area` box holds the hero. Recomputed every frame; 0 inside levels |
| s32 × 3 | levels solved, tower levels solved, towers activated (refreshed on overworld passes) |
| u8, u8 | overhead-map area-names toggle; overworld reached (switches the menu between "lobby" and "overworld") |
| (v23..31 only) u8 + 32 × u8 | legacy data |
| str16 | current level |
| str16 | the level shown behind the main menu |
| u32 n, n × (str16 level, u8 `Level_State_Flags`) | per-level state: SOLVED 1, PARTIALLY_SOLVED 2, ENTERED 4 (never set), TOWER_UNLOCK_SIGNALLED 8. A level gets an entry, flags 0, when it is first loaded |
| u32 n, n × (str16, s64, str16) | string table, legacy (only loaded and saved) |
| u32 n, n × Pid | opened Freezers (`Freezer`) on the overworld |
| u32 n, n × Pid | opened Freezers in other levels |

The level state and opened Freezers can lag a level win: the history may already show the hero where a win opened a
Freezer while Status lacks both (seen in play, cause unconfirmed). The next Status written holds them.

Older files leave fields out or carry legacy ones. A field the file lacks keeps its default: 0 or empty, and 1 for
overworld reached.

| Versions | Difference from the table above |
|---|---|
| < 30 | no reserved u32 |
| < 12 | no last saved |
| < 19 | no rank, play time, achievements, treasures; < 22 no achievements; < 27 no treasures |
| ≤ 25 | a legacy u32 after the first two counters |
| < 8 | 8 counters: counters 6 and 7 missing |
| < 13 | no artifacts; < 9 no current area pin; < 11 no levels solved |
| < 19 | no tower levels solved; < 20 no towers activated (v19 has tower levels solved only) |
| < 16 | no area-names toggle; < 24 no overworld reached |
| 17..20 | after the area-names toggle: legacy u32, u32 (8 bytes), plus a u8 in v18..20 (9 bytes) |
| ≤ 24 | a legacy str16 before the current level |
| < 33 | no menu level string: only the current level |
| < 10 | no string table; 14..27 a legacy `u32 n, n × str16` list after it |
| 6..14 | a legacy `u32 n, n × str16` list after the string table, or after the level list when there is no string table |
| < 7 | no opened Freezers lists; < 29 no list for other levels |

Which levels unlock what, and what counts toward towers and 100%, is in
[Level_Entry unlocking and state](PROGRESSION.md#level_entry-unlocking-and-state) and
[Achievements and ranks](PROGRESSION.md#achievements-and-ranks).

## `<level>.history` (undo state)

Each level keeps its own undo history. On the overworld it is the only record of entity state: fog, pins,
teleporters, rocks, voice logs, existence. [Overworld state from the save](STATE.md#overworld-state-from-the-save)
says how the viewer reads the overworld state from it.

### Header

```
u32  version                      written 73; read 70, 72, 73
u32  Settings.level_data_version  a mismatch resets the level: "World state has been reset, because we changed this level."
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
starts at move 1 or later. Its hero position is (0, 0, 0) on the overworld, but some levels store a real cell there.

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

| Action_Type | Payload |
|---|---|
| 1 CHANGE | Pid, s64 type index, str64 entity diff blob (old and new values) |
| 2 CREATION_OR_DESTRUCTION | Pid, s64 type index, str64 entity diff blob (new values only: the fields that differ from the type's defaults), u8 destroyed. 1: the record destroyed the entity, and the blob is the entity as it was. 0: the record created it, and the blob is the new entity; a position axis missing from the blob is 0. Entities made during play have Pids in namespace 1023 (pid >> 20) |
| 3 OCEAN_CHANGE | Pid, u32 index, u8 old, u8 new (10 bytes with the type) |
| 4 SCRAPE_CHANGE | s16 x, y, z, u8 old, u8 new, u8 axis |

An Activator reset destroys an entity and clones it again under the same Pid: one record holds the destroyed action,
then the created one. The later action is the entity's state.

The **rover timer** is the level's countdown to the next Rover step, in seconds. It starts at
`Settings.time_per_rover_update` (type default 0.6, the overworld 1.0; 0.25 in a level without a Settings entity). It
runs down in real time while the level has Rovers; at 0 every Rover steps and the period is added back. A level without
Rovers keeps the start value in every record. Undo and load set the level's time and rover timer from the newest record.

### Record flags, icon and character

`flags` is the record's own `Flags` enum (u16, a plain enum, not `enum_flags`):

| Flag | Meaning |
|---|---|
| CHECKPOINT 1 | `!` in the debug dump. A checkpoint fired: the hero reached a `Checkpoint` entity, or a scripted endgame point (the `end1` level, a Judge end3 state). With a move still open the checkpoint sets history flags bit 0, and the move's own record gets CHECKPOINT. Otherwise the checkpoint commits a record of its own with icon RESET. Thinning never merges past a CHECKPOINT |
| GAP 2 | pending changes committed without a player move. The save does this right before it writes the history, and two other non-move callers do too. Undo skips GAP records |
| CARRY 4 | a turn where the active hero only rode a lily or a rover, without a player commit. The record's hero is the rider |
| RESET_POINT 8 | set on the newest record when the level is restarted. The restart commits pending changes first |

`icon` is an `Action_Icon` (u8): UNKNOWN 0, WALK 1, PUSH 2, PULL 3, CHARM 4, TRANSMUTE 5, TELEPORT 6, SMASH 7, MIRROR 8,
WAND 9, TORC 10, PRISM 11, TREASURE 12, CHOP_TREE 13, PRESS_BUTTON 14, RELEASE_BUTTON 15, GOBLIN_KILL 16, DRAGON_KILL 17,
TAKE_GEM 18, DROP_GEM 19, RIDE_ON_LILY 20, FALL 21, RESET 22, START 23, RIDE_ON_ROVER 24.

`character` is a `Character_Index` (u8): NONE 0, SAILOR 1, DRUID 2, PRIESTESS 3, THIEF 4, WARRIOR 5, WIZARD 6, BARD 7,
PROMESST 8, TRADER 9, QUEEN 10, then the `_ALT` variants 11..17.

A move record takes the icon of its highest-priority move. First one wins a tie.

| Move_Type in the transaction | Icon |
|---|---|
| TELEPORT | TELEPORT 6 |
| INVENTORY_TAKE | TAKE_GEM 18 |
| INVENTORY_DROP | DROP_GEM 19 |
| PULLED | PULL 3 |
| PUSHED | PUSH 2 |
| CONTROLLER_PROC | WALK 1 |
| none of these | 0, character 0 |

The character is that move's Guy (the manipulator for take and drop), mapped from its character name (`castaway` →
SAILOR, `cleric` → PRIESTESS, `moonman` → PROMESST, ...). It is 0 when the entity is not a Guy. Records that are not
moves: START 23 (level start), RESET 22 (a checkpoint record of its own), RIDE_ON_LILY 20 or RIDE_ON_ROVER 24 (CARRY),
0 (GAP, restart, the commit before an undo); their character is 0.

Icon 24 appears in merged (mip ≥ 1) overworld records, where the largest icon of the merged moves wins. Overworld
records never carry CHECKPOINT; `intro` and puzzle levels do (a puzzle level's history can hold many).

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
skipped (the exact rules are under [Jai type information](GAMEDATA.md#jai-type-information)). Members carry version notes
(`@v14`, `@v1-24`). The index list for a given type version holds only the members whose first version is `<=` that
version, which keeps old files readable. A flattened leaf counts from its top-level member's first version (`Undoable_Entity_Data.scale.x` from v14,
the member `scale`); notes on nested members are ignored. The last version of a range does not drop a member from the
list.

Declaration order is not version order. `Rock` declares `speed_mod` (from v29), then `properties` (v28), then
`move_theta` (v15): in a version 32 blob `properties` is the type's field 1, in a version 28 blob field 0. `Mirror`
declares `is_magic`, `is_vertical`, `is_vertical_downward`, `mirrorable`, in that order.

Values: plain data (ints, floats, bools, enums, fixed arrays and structs of them) as raw bytes of the member size.
Strings and resource pointers (`*Triangle_Mesh`, `*Material`, `*Texture`, by name) as str64. Dynamic arrays as s64
count + elements, each element plain data or a resource name as above.

`data/schema.json` holds the index lists for `Undoable_Entity_Data` and every entity type.

### Move_Transaction and Single_Move

A record's Move_Transactions are the multi-turn movers still open when it was committed: lily, rover and falling
transactions (flags `IS_LILY_TRANSACTION`, `IS_ROVER_TRANSACTION`). The hero's own step is never among them, so the only path data in a history is each record's hero position.

Both are metadata-serialized. Each struct is written as its u16 `VERSION` constant, then each serializable leaf member
whose version range contains that version: plain data raw, dynamic arrays as s64 count + elements (struct elements
recurse, each with its own u16 version). Version notes on a parent struct are not inherited by its flattened members,
so deprecated nested members (`XXX_deprecated_visual_error`, `XXX_deprecated_charm_setup`) are still written.

- `Move_Transaction` (v3): f64 close_time, f64 commit_time, u32 transaction_id, f32 duration, f32 elapsed, u32 flags,
  s8 lily_transaction_group_index (v3+), s64 n × Single_Move.
- `Single_Move` (v8; u16 version, then 145 bytes at every version, then the array): Pid entity_id, Pid manipulator_id,
  `Move_Info` (u8 move_type, Vector3 delta, start_position, target, f32 duration, Pid target_mobile_supporter_id, Pid
  supported_by_id, u32 flags, u16 teleport_values, u8 post_teleport_rectification, f32
  theta_cancelled_when_pushed_rate, Vector3 distance_cancelled_when_pushed_rate, f32 time_cancelled_when_pushed), f32
  duration_until_physical_move, Vector3 visual_start, visual_end, XXX_deprecated_visual_error, u64 flags, f32
  theta_at_start, f32 turning_theta_target, Pid charm walking_support, u8 charm movement_rate, s64 n × 80-byte
  deprecated Move_Info.

### Thinning

The history keeps 8 mip levels (1 in editor mode). The level init table gives levels 0-6 capacity 400 and level 7
capacity 99999.

**Commit** (end of a turn). A new record goes onto level 0: `first` = next move index (both counters then go up by
1), `span` = 1, the flags passed in, the hero Pid, `time`, the rover timer and the hero position rounded to the grid.
The game asserts that `first` is the previous level-0 record's `first` + 1. `uncondensed` goes up by 1, then level 0
is condensed. GAP commits skip the condense.

**Condense(k)**, while level k+1 exists and `uncondensed(k)` ≥ 25:
1. Take the oldest uncondensed record, i0 = count − uncondensed.
2. Merge records i0..i0+24 into one. Stop early at the first CHECKPOINT record, which is merged too; the merged record
   then has CHECKPOINT.
3. `uncondensed(k)` −= the number merged. If i0 was 0, `index_in_next(k)` = count(k+1).
4. Append the merged record to level k+1, add 1 to `uncondensed(k+1)` and condense level k+1.

Then **forget(k)**, on every level but the top one. to_forget = count − capacity. If to_forget ≥ 26 (`factor(k+1)` +
1): take the end move (`first` + `span`) of level k+1's record `index_in_next(k)`, find the record i < to_forget whose
`first` equals it, and drop records 0..i−1 (normally 25). `index_in_next(k)` then goes up by 1 (−1 past the end), and
level k−1's `index_in_next` goes down by i. A level settles at 401..425 records. GAP commits can push it a little past
425. Level 7 is never trimmed.

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

Entity actions come in hash order, then ocean changes, then scrape changes.

**Undo** takes the newest record: the last record of the lowest non-empty level, else the level-start record. It
applies its actions backwards and frees it. If that level's `uncondensed` goes negative, the coarser record that covers
it is deleted too, up the levels; its finer records become uncondensed and merge again later with new boundaries. When
level 0 is empty, one undo reverts a whole 25-move record. The undo handler first commits what is pending (CHECKPOINT
if the history flag is set, else a GAP), then pops GAP records. Undo never reverts a CHANGE on a `Fog_Of_War` in play
(only in the editor or forwards), so fog stays cleared on screen ([Fog of war](STATE.md#fog-of-war)).

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
  deletes coarse records. A kept position is a cell the hero stood on; a cell that is not kept was only possibly
  visited.
- **Fog cleared during an undone move** is not in the file: undo leaves the fog cleared on screen but frees the record
  that held the CHANGE, and nothing records it again. After a reload the region is FILLED again unless a later move
  cleared it or a hero stands in it: every frame, the game clears the fog region under each hero on the current layer.
