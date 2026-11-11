# Moves and skills

The hero's inputs: skills, wardrobes, a direction press, TELEPORT and PULL, CHARM, TRANSMUTE and the other skills,
winning, and the move flags.

`Guy.skill_flags` (`Skill_Flags`): MULTIPUSH 1, SINGLE_PUSH 2, PULL 4, TELEPORT 8, PROTECTION 16, TRANSMUTE 32, CHARM 64,
TAKE_GEMS 128, QUEEN 256, CHARM_VISUALLY_3D 512, SAILOR 1024, TRADER 2048. Each skill is an independent bit test.
`inventory_flags` (`Inventory_Flags`) hold the Promesst colours (bit 1 << `Promesst_Power`, bits 0–9) and items (WAND 0x400, TORC 0x800, PRISM 0x1000). The
overworld Guy's data `skill_flags` hold no PROTECTION.

## Wardrobes

- A Wardrobe's cell is walkable from every side. Only its door, the edge its +x axis points to, does anything. Other edges and vertical moves change nothing.
- At most one Wardrobe applies per move, the one being left first: in the source cell, the move's component along the door's facing (+x) above 0.1 is door-out; else in the target cell, below −0.1 is door-in.
- Door-out: `skill_flags = (skill_flags & ~SINGLE_PUSH) | Wardrobe.skill_flags`. An inventory-only Wardrobe adds its `inventory_flags` instead.
- Door-in: a skill Wardrobe resets the hero to QUEEN | SINGLE_PUSH (258), which drops CHARM and every other skill. An inventory Wardrobe clears `inventory_flags`, and a TAKE_GEMS hero's carried Gems are destroyed.
- So skills stack: leave one door, enter a second Wardrobe through its back or side, leave its door holding both.
- SINGLE_PUSH comes back only through a door-in reset, un-transmuting (the crystal Rock stores the Guy's skill and inventory and restores them), a Spawner-made Guy (`Spawner.skill_flags | QUEEN`) and the SAILOR Wardrobes.
- On the overworld only Wardrobe doors change the skill: pads, leaving a level, the wizard swap and the hero swap keep it. Fast travel is a pad, a walk through the map room and a pad, so it keeps the skill only when no Wardrobe door-in lies on that walk.
- Fire does not cross a Wardrobe door edge.

## A direction press

The game resolves a press in this order:

1. Beam powers shape the move: DOUBLE multiplies it, ENDPOINT turns a move along the beam into a jump ([Promesst beams and powers](movement.md#promesst-beams-and-powers)).
2. A hero inside a solid voxel, a Tree's cell or a frozen Freezer's cell, outside a THROUGH beam, only turns.
3. A hero with TELEPORT swaps if his line finds a target ([TELEPORT and PULL](#teleport-and-pull)).
4. An ENDPOINT jump happens if the landing passes the move check; otherwise the hero bumps.
5. A hero with CHARM makes a charm move ([CHARM](#charm)).
6. Otherwise the hero steps: the move check (blockers, recursive pushes, the Friendly_Dragon swap), then the water and ledge check ([Water](movement.md#water), [Falling](movement.md#falling)), then the push-strength check ([Pushing and pulling](movement.md#pushing-and-pulling)). Then the moves are added, then PULL ([TELEPORT and PULL](#teleport-and-pull)).
7. A failed step is a bump: a STATIONARY move that costs the turn and turns the hero. Each unmoved entry of its push list gets the SMASH or OPEN effect of its pusher ([Pushing and pulling](movement.md#pushing-and-pulling)). With TRANSMUTE he then transmutes what he bumped.

The move check's SMASH test runs only in move checks that don't collect pushes: the jump of step 4 and the charm move of
step 5. A step pushes a Rock or Rover ahead, and a SMASH hero smashes only when the push fails, through the bump of
step 7 ([Promesst beams and powers](movement.md#promesst-beams-and-powers)). A Gem is not a blocker for a TAKE_GEMS Guy.

Presses while busy:

- While the active hero's current transaction is a falling one, his queued press waits and runs when the fall ends. If his group has a TELEPORT Guy, the press runs at once, so the wizard can swap mid-fall.
- A press survives an ordinary fall of any length. Each fall step that beam powers turn into a TELEPORT move (a DOUBLE step, or the ENDPOINT jump down a vertical beam) counts, and on the 3rd all queued presses are dropped.
- A skip does not hold the player: a press made during a skip runs while the stone is SKIPPING.
- A Marker with `script_name` `wait_for_fall` makes a TELEPORT hero standing in its box wait while its `script_target_entity_id` is FALLING above him.

## TELEPORT and PULL

TELEPORT (Wizard) has no separate input. The swap is the move.

- The line runs from the hero's cell along the move vector only (the move vector after the beam powers), at his z, one move step at a time: every 2nd or 3^n-th cell in DOUBLE beams. It never looks backwards and has no special case for another hero. It is the dragon-fire tracer.
- Targets: a Guy, Rock, Gem, Promesst_Light, Monster, Friendly_Dragon or Rover that is not DEAD, at any distance, and a Mirror the line meets on its back or a closed side. The tracer returns every hit in the first cell that has one, in cell-list order (insertion order: appended on insert, swapped with the last on removal). There is no type priority, and every hit swaps: the wizard goes to that cell, and each hit gets a TELEPORT move to his old cell ("SwapTargetPerson", "SwapTargetRock"). So a Guy and the Gem he stands on both come to the wizard's cell. The line skips an entity with a pending move flagged DIE_BY_ROASTING or DIE_BY_GOBLIN_ATTACK.
- The hero lands exactly where the target was and the target where he was. No water check and no move check; each then falls, sinks or drowns by the normal rules. A Rock swapped into water sinks to surface − 1.
- The swap is one transaction: the hero and every hit get a TELEPORT move to each other's cell. Each moved entity settles after the move, so a swapped object that lands over nothing falls, with the usual water rules ([Falling](movement.md#falling), [Objects in water](movement.md#objects-in-water)). A Switch takes its pressed state from what stands on it now. The settle step runs the protection pass, the switch update, then the beam update, which retraces every light from the cells as they are after the write, so a Rock swapped onto a beam stops or turns it in the same update. A TELEPORT move gives its riders no SUPPORT move ([Lilies](movement.md#lilies)).
- A swap moves only the swapped things (the same holds for a pad and a mirror teleport). What stands on them stays in its cell and falls if nothing holds it up.
- A swap keeps the target's facing, so a swapped Promesst_Light casts in the same direction. Pushes and pulls keep it too.
- Blockers end the line with no swap: a solid voxel (except while the hero is in a THROUGH beam), a column outside the level ([Support](movement.md#support)), a Tree, a Sign, a closed Gate, a frozen Freezer, a Wardrobe door edge, the z range [`grid.corner.z`, `grid.corner.z` + `squares_z`], the grid edge in a level without wrapping. Water, air, Fences, Treasure_Display and Egg don't stop it. A Mirror met through an open side turns it. A Mirror that has already turned the line ends it with no swap.
- Wrapping: with `grid.wrapping` the line wraps around the level grid; above the upper-layer z (the map rooms) around the fast-travel box. It ends after one lap, back at the hero's own cell: then he is his own target and nothing moves.
- z band: a standing wizard swaps only with a hit at his own z. If nothing is hit there, z + 1 and then z + 2 are traced: a FALLING hit with a live transaction makes his press wait for it; any other hit, or none, gives a normal step. He never swaps with anything above him or below him, so a Rock in water (at surface − 1) can't be swapped from the surface.
- With no target the press is a normal step. He won't swap from inside a solid cell outside THROUGH; he walks.
- In an ENDPOINT beam (the press parallel to the beam where it hits him) the move vector is the whole jump to `endpoint_b` (or `endpoint_a` against the beam), so the line tests only the cell at the endpoint and then cells at multiples of that distance. Targets between him and the endpoint are skipped and stay. With a target at the endpoint he swaps with it; with none he lands on the endpoint. DOUBLE beams work the same with a vector of 2ⁿ or 3ⁿ.
- A FALLING wizard swaps with a hit at his z. With a hit only at z + 1 he swaps only when `Settings.allow_wizard_swap_from_below` is set (off on the overworld).
- A worked example, a skipping stone launched first and then swapped with: [Routes that need these mechanics](movement.md#routes-that-need-these-mechanics).

PULL (Thief), or STRONG + ALTER:

- Applies when the move is player input (CONTROLLER_PROC) and the hero's own step succeeded.
- The first non-DEAD Promesst_Light, Rock, Guy, Mirror, Friendly_Dragon, Rover or Monster in the cell behind him moves into his old cell as PULLED, if that move passes its move check and the thing is not stuck. A Gem there is pulled with the Guy holding it, else the Gem.
- A push and a pull can happen in one move. Sounds: `pull_block`, `pull_mirror`, `pull_gem`, `pull_monster`, `char_%_movedByOther`.
- The pull wraps with the same rule as the line and every other move target ([Wrapping](world.md#wrapping)).

## CHARM

- Each turn an active CHARM Guy (Bard) charms the other Guys, the Monsters, Friendly_Dragons, `mirrorable` Mirrors and MIRRORABLE Rocks within dx, dy, dz ∈ [−2, 2] (wrapped Chebyshev: the cube of ±2 cells around him). Plain Rocks and Rovers are never charmed. Dead entities, ones that don't exist and ones frozen in a Freezer's cell are skipped.
- On a Bard's own move, the charmed Guys, Rocks, Mirrors and Monsters take the same step, each with its own beam powers and move check. The move drops an entity farther than 2.1 from the Bard (wrapped Chebyshev, max(|dx|, |dy|, |dz|); above the upper-layer z it wraps in the fast-travel box), a FALLING one, a SKIPPING Rock and a stuck one (unless THROUGH). Friendly_Dragons are marked as charmed but never move.
- A charmed mover other than a Rock or Mirror turns to face its step (`Single_Move.flags` TURNING, `turning_theta_target` the step's angle), so charmed Guys and Monsters turn.
- A SKIPPING stone is dropped from the move, not moved: its skip is neither cancelled nor turned ([Skipping stones](movement.md#skipping-stones)).
- Order: the charmed list, with the Bard added if he is missing, sorted ascending by key = 1000·⌊dz + 0.5⌋ − trunc(50·(clamp(dot, −2, 2) + 1)). dz is the entity's z minus the Bard's; dot is its wrapped x/y offset from the Bard dotted with the normalised x/y move direction. So lower layers move first, and within a layer the one furthest ahead moves first. The Bard's own key is −50. Each entry, in sorted order, gets its beam powers and its move check against the moves already added. The Bard's entry is a CONTROLLER_PROC move, the others CHARMED.
- If the Bard can't move, nothing moves: he bumps ("go_state_blocked_no_obstacle"). When his water check fails, every charmed mover gets a STATIONARY move flagged BARD_MOVING_CANNOT_GO.
- Nothing in a charm move pushes. The move checks run with pushing off, so a Rock or Rover in the way that is not moving away gets a SMASH move if the mover has SMASH and no ALTER, goes on the push list, and the move fails ([Promesst beams and powers](movement.md#promesst-beams-and-powers)). The bump over the push list then gives each entry its pusher's SMASH or OPEN effect.
- An entity standing on another that moves in the same charm move follows that move and then makes its own step, so a Bard on a charmed crystal moves 2 cells while the crystal moves 1, and his water check is made at the 2-cell target. In open sea the crystal ends 1 cell behind, the check fails and the whole charm group is cancelled, so a crystal can't carry a Bard across open water.
- He rides exactly 1 cell when his own step is blocked, and goes 2 cells per step while a row of charmed crystals lies ahead (one more crystal per step).

## TRANSMUTE and the other skills

- TRANSMUTE (Druid): a hero who bumps a Tree, Monster, Guy, Friendly_Dragon or a mirrorable Rock, Rover or Mirror turns it into a crystal Rock in place (`transmuted_from_entity_type`, meshes `GAME_SOKO_Crystal_A` / `GAME_SOKO_Crystal_Dragon_A`). Bumping the crystal turns it back ("transmute_stone"), by its `transmuted_from_entity_type`: ROVER, MIRROR, MONSTER, GUY and FRIENDLY_DRAGON rebuild that type; TREE makes a Tree with the stashed mesh and tints; NONE also makes a Tree, with a random one of 5 tree meshes and one of 4 tint pairs. So a level-data crystal, which has no type, turns into a Tree. The new Tree keeps the crystal's position and its MIRRORED flag. Crystals are pushable rocks that fall like rocks: a Tree in water becomes a stepping stone just under the surface; a transmuted dragon breathes no fire. The save records each change as CREATION_OR_DESTRUCTION actions with runtime Pids (namespace 1023). Tree-root fences are created and destroyed with their tree.
- A hero walking into a Friendly_Dragon that follows him swaps places with it (`SWAP_WITH_DRAGON`).
- TAKE_GEMS: Gems don't block him and don't hold him up ([Support](movement.md#support)), so he walks or falls into a Gem's cell. There is no automatic pick-up. Taking and dropping is its own input, T ("TakeOrDrop", request TAKE_OR_DROP 5), queued like a press; the same input enters a level from a Level_Entry ([Winning and other inputs](#winning-and-other-inputs)). For each controlled Guy: if his cell holds a free Gem (`inventory_index` < 0), he takes the last free one in the cell list, an INVENTORY_TAKE (15) move. Otherwise, only if his cell holds a Gem_Slot, he drops the carried Gem with the highest `inventory_index`, an INVENTORY_DROP (16) move. With neither, nothing happens. A take counts in Status counter 0, a drop in counter 1 ([Status.sokoban_status fields](progression.md#statussokoban_status-fields)).
- A taken Gem gets `attached_to_entity_id` = the Guy and `inventory_index` = the highest carried + 1 (or 0), and leaves its grid cell. So no cell lookup sees it: a carried Gem presses no Switch, fills no Gem_Slot, supports and blocks nothing ([Gates, switches and buttons](movement.md#gates-switches-and-buttons)).
- QUEEN (on the default hero, 258), SAILOR, TRADER: identity flags. They pick the HUD marker, switch icons and voices; QUEEN has no move, switch or win effect except that Markers that clear non-prelude items spare QUEEN Guys.
- PROTECTION: [Goblins, dragons and PROTECTION](movement.md#goblins-dragons-and-protection). Push strength: [Pushing and pulling](movement.md#pushing-and-pulling). PROTECTION + MULTIPUSH pushes rows while protected; PROTECTION alone, or with PULL or TELEPORT, can't push.
- Items: on the overworld, 13 inventory-only Wardrobes give the Rod (`inventory_flags` WAND, 9 of them) or the Torc (TORC, 4). `Artifact` pickups (PROMESST_1/2/3_WAND, a Prism's `p3_wand_flags` colour bits) exist only in puzzle levels. Status counts wand, torc and prism uses (counters 5-7). ACTIVATE uses every held item, Prism, Torc and Rod in that order. The Rod and the Prism act on the cell ahead: one step along the hero's `theta_target`, snapped to the 4 sides and wrapped like any move.
    - Rod: the target is the first Rock, Gem, Monster, Rover, Promesst_Light, Guy, Artifact or Mirror (not dead) in the cell ahead; the use fails if that cell is solid or holds a Tree, a closed Gate or a frozen Freezer, or no such entity. A scan along the facing sends the target to the first cell past it that is not blocked (a solid voxel, a Tree, a closed Gate, a frozen Freezer, or the target of a move already in this use); blocked cells are jumped over. If the landing cell holds one of those types, that entity is launched the same way from there, with no weight, push strength or move check. If the scan leaves the grid of a level without wrapping, the use fails. Each moved entity gets a TELEPORT move.
    - Prism: acts on the first Promesst_Light in the cell ahead. Its `color` moves to the next `Promesst_Power` value, going up and wrapping after 9, whose colour bit (1 << value) the hero holds in `inventory_flags`: OPEN 0, THROUGH 1, SMASH 2, DOUBLE 3, STRONG 4, ENDPOINT 5, ALTER 7, GEM 8, SQUEEZE 9, skipping colours he doesn't hold (6 is XXX_DEPRECATED_EGG_HATCH).
    - Torc: every Promesst_Light whose beam hits the hero (any colour) gets a TURNING move to the hero's facing, snapped to the 4 sides; a light already facing within 45° of it is left alone. The beam then starts at the light in its new direction; it does not bend at the hero. The use fails only when no beam hits the hero.

## Winning and other inputs

- Win, checked in the level update after moves settle, not on input: every existing Guy stands, alive and not moving, on an exit Door (`special_door_type` NONE) whose `enabled_state` is ENABLED, and the number of Guys equals the number of exit Doors. A Guy or Door counts only when its PLAYABLE_IN_PRELUDE flag matches the Level_State `misc_flags` DOING_PRELUDE. Any exit Door that is BROKEN_SOFT or BROKEN_HARD makes the level unwinnable. A DEAD Guy, or a Guy on a Level_Entry instead, blocks the win. The win runs `handle_level_won`, which sets SOLVED.
- `special_door_type` END1_EXIT wins END1 levels; INTRO_FINAL_EXIT starts the intro ending. In OVERWORLD and INTRO worlds a single hero on a Door with `target_link` is sent on instead.
- The prelude: a level with `Settings.has_prelude` starts with DOING_PRELUDE set ([Existence groups](entities.md#existence-groups)). Winning it needs no input: `handle_level_won` starts a 0.5 s countdown, then the level waits 1.0 s and completes the prelude. With RETURN_TO_PRELUDE set the prelude restarts instead; with ESCAPE_FROM_PRELUDE the level ends normally.
- Completing the prelude, in order: every Group with `is_prelude_group` stops existing; each `clear_non_prelude_items` or `clear_non_prelude_items_inside_freezers` Marker destroys the items inside its box (heroes, Gems, Mirrors and Artifacts), except QUEEN Guys and items in a cell holding a `dont_clear_non_prelude_item_here` Marker; DOING_PRELUDE is cleared; every non-prelude entity except Particle_Source is re-checked for falling, so whatever the prelude floor held falls ([Falling](movement.md#falling)).
- ACTIVATE: if no GATE_OPEN or GATE_CLOSE move is pending, the magic-mirror activation runs ([Magic mirrors](movement.md#magic-mirrors), all or nothing). Then ACTIVATE joins the input queue as a request with no direction ([A move](movement.md#a-move)), like a press. When a mirror activation happened, the post-move processing runs first, and the request is queued only if that succeeds. It also fires an Activator in the hero's cell ([Activators and Spawners](movement.md#activators-and-spawners)).
- Entering a level: on the overworld a level is entered only by the TakeOrDrop action (T, [TRANSMUTE and the other skills](#transmute-and-the-other-skills)) while exactly one living controlled Guy stands on an enabled Level_Entry. Standing on the cell never enters by itself, so the hero and the things he pushes cross Level_Entry cells freely ([A move](movement.md#a-move)). An Artifact pickup path into a level exists only in puzzle levels.
- Hero switch: `status_flags` ACTIVE moves to another hero; nothing else moves; skipping stones keep going.
    - Roster: one entry per group: the Guys whose `turn_order_id` is their own `entity_id` (unset defaults to it). Guys sharing a `turn_order_id` move as one hero. Left out: Guys scheduled for destruction, in an existence group that doesn't currently exist, or on the wrong side of the prelude.
    - Order: by `Guy.turn_order`, ascending. An unset value (−1) becomes 100 × (`squares_y` − 1 − ⌊y + 0.5⌋) + ⌊x + 0.5⌋: reading order with north at the top.
    - The switch key takes the next entry, wrapping, that still has a living, existing Guy. With none, the hero stays.
    - Character hotkeys cycle the entries of one character and its _ALT (WARRIOR 11, THIEF 17, WIZARD 12, PRIESTESS 13, SAILOR 14, TRADER 15, PROMESST 16).
    - Auto switch: at turn end, if none of the active entry's Guys exist (a DEAD one still counts), the game takes the next entry with a living Guy.
- Undo steps back one record; reset puts every entity back in one record.

## Move flags

- `Move_Info.flags`: DISAPPEAR_AFTER_TELEPORT 1, TELEPORT_EMITTERS_ALREADY_HANDLED 2, STRONG_PUSH 4, MOVED_BY_MIRROR 8, UPDATE_SUPPORT_DESPITE_STATIONARY 0x10, SUPPORT_WILL_BE_LOST 0x20, TELEPORTING_FORWARD 0x40, DISAPPEAR_DUE_TO_LEAVING_THE_MAP 0x100, APPEAR_AFTER_TELEPORT 0x200, SKIPPING_ODD_PARITY_REBOUND 0x400, MERGE_WITH_MANIPULATOR 0x800, TRANSMUTE_CREATE 0x1000, TRANSMUTE_DESTROY 0x2000, DIAGONAL_LILY_PUSH 0x4000, BARD_MOVING_CANNOT_GO 0x8000, TELEPORT_FALL_STATIONARY_MOVE 0x10000, TELEPORT_FALL_WILL_BLOCK_PLAYER 0x20000. `Single_Move.flags` is a separate `Flags` enum.
- `Move_Transaction` flags: CLOSED 1, PHYSICALLY_MOVED 2, BLOCKING_PLAYER 4, PRE_CLOSED 8, DONE 0x10, DRIVEN_BY_A_CONTROLLER 0x20, IS_LILY_TRANSACTION 0x40, CAUSED_CHANGE 0x80, IS_FALLING_TRANSACTION 0x100, IS_ROVER_TRANSACTION 0x200, DO_NOT_RECORD_UNDO 0x400, PLAYER_TELEPORTING_OUT_OF_FALL 0x800 (the hero acts mid-fall), IS_MERGE_RESULT 0x1000, DRAGON_BREATH_BLOCKED 0x2000, BLOCKING_PLAYER_ONLY_UNTIL_PHYSICAL_MOVE 0x10000, IS_SKIPPING_TRANSACTION 0x20000.
- `Move_Type`: TELEPORT 1, STATIONARY 2, FALLING 3, ELEVATOR 4, CHARMED 5, PULLED 6, PUSHED 7, LINEAR_INTERPOLATION 8, SUPPORT 9, FOLLOWING 10, CONTROLLER_PROC 11, TRANSMUTE 14, INVENTORY_TAKE 15, INVENTORY_DROP 16, GATE_OPEN 17, GATE_CLOSE 18, LILY 19, SKIP 20, SMASH 21.
