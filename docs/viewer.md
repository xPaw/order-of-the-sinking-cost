# The viewer's model

The viewer's own model built on the game's rules: the walk, level states, roles, unlock plans, goals, level areas, the
page and the spoiler rules. The game does none of those; they are how the viewer approximates what the player can
reach.

## The walk model (viewer)

The viewer's own approximation of where the hero can go: `walker()`, data from `data/world.json` and
`data/progress.json` ([Derived data files](datafiles.md#derived-data-files)). It runs at build time only: what the walk
gives on the level data alone (the static roles and the map's floor heights) is stored in `data/walk.json`
([data/walk.json](datafiles.md#datawalkjson)) and the room answers in `data/rooms.json`, which the page does not load.
The page runs no walk: the level table decides which levels are reached ([Reached levels and ways in](#reached-levels-and-ways-in)).
The walk is fitted to the game's rules but is not the game's walk code; its simplifications are listed at the end of this section.

### Level geometry and the walker

`walker()` builds its grid in two parts.

- The level geometry (`levelGeometry()`, `src/walk/geometry.ts`) is everything the grid takes from the level data alone. It is built once per program run from `data/progress.json` and `data/world.json` (through `src/world-data.ts`) and is plain data: the grid's size, corner and fast-travel box; the static solid voxels and beam stops, one byte per cell; the Wall_Sets' voxel cells and the existence Groups; the cell of each list of entities, parallel to the level data's lists; the Ocean_Maps per column, the river flow sides, the pads' reveal lists and their map-room twins.
- The walker adds what a save decides: which entities exist ([Existence](#existence)), where Rocks, movables, Monsters and Lilies stand, Switch and Gate state, closed Freezers, pad states, the beams and everything built from those (fire, pad linkage, hops, skip lanes, trigger indexes, mechanics). It never writes to the geometry, so any number of walkers share one. `walker()` takes a geometry as its last argument; a program that swaps the level data (the tests do) gets a new one.

### Cells

- One cell per integer (i, j, z), i, j = grid indices (`round(x) − corner`), z from −79 up to the top of the world.json z range (z bytes there are z + `zoff`); a position outside that range has no cell. Neighbours wrap: below z 75 inside 190 × 156; at z ≥ 75 (the map rooms) inside the fast-travel box (`grid.ft`: corner (35, 104), size (50, 36)). A position at z ≥ 75 is wrapped into the box first.
- Each cell has bits: SOLID, SUPPORT (holds up the cell above), FLOOR (holds the hero in its own cell), GATE (a shut Gate), ROCK, MONSTER, MOVABLE, BEAMSTOP; and beside them fence sides (one bit per side), FIRE (attacked), THRU (a THROUGH beam's wall cell), BEAM (a THROUGH beam cell).
- Filled from:
    - Wall_Set voxels: SOLID | SUPPORT. Group members only while they exist ([Existence](#existence)).
    - Rocks at their latest positions: SUPPORT | ROCK, plus BEAMSTOP unless the Rock's latest `properties` (else level data) hold MIRRORABLE. Rocks the save created (TRANSMUTE crystals) are added at their latest position; destroyed ones left out.
    - Fences with `blocking` and `is_floor`: FLOOR. Other blocking Fences: the side bit (0 E, 1 N, 2 W, 3 S) on their cell.
    - Trees (while they exist, created ones too), Signs of FULL_GAME, Treasure_Displays, Judges: SOLID | SUPPORT | BEAMSTOP.
    - Movables (Gem, Promesst_Light, Mirror, Rover, Friendly_Dragon) at their latest positions: MOVABLE, plus BEAMSTOP unless it is a `mirrorable` Rover (listed in `world.mirrorable`).
    - Eggs: BEAMSTOP (none on the overworld).
    - Lilies, while they exist (`exists`, Groups as in [Existence](#existence)): FLOOR at their level-data cell and their latest cell.
    - Lily drifts: a Lily whose latest cell is a river square is at every cell of its drift at once, and each holds the hero ([Lilies](movement.md#lilies)). The drift follows the river's flow from the latest cell, coasting on in its last direction over still water. It enters a cell with water within 0.5 of z that is not blocked and holds no pushable or beam stop (but for its latest cell, where what stands there rides along), and ends at a blocked step or when a cell and heading repeat (at most 4 (W + H) steps). An absent Lily drifts nowhere.
    - Kicked Lilies: a Lily whose level-data cell is off the rivers and whose latest cell is a river square was kicked; the side of its first recorded `moving_direction` is the way. If the ride from the start on that side ([Skip lanes and the TELEPORT swap](#skip-lanes-and-the-teleport-swap)) comes to the latest cell, every ride cell holds the hero too. Otherwise nothing is added.
    - Living Monsters (latest position, `dead_t` = 0): MONSTER.
    - Shut Gates: GATE | SUPPORT; once a flood opens it (a switch press or an OPEN beam, [Moves](#moves)) it holds up nothing. A switch gate follows its flavor's existing Switches: open = (all latest `pressed`) xor `notted`. A monster gate and a gate whose flavor has no Switch keep their latest stored `open`, but for the monster Gates a flood opens. An open notted Gate a flood's press shuts blocks its cell and holds up the cell above.
    - Elevator frames of linked elevators: FLOOR on both frame cells.
    - Closed Freezers (`frozen`): not entered.
- Water per column: the Ocean_Maps with water there (level data, plus every map whose latest OCEAN_CHANGE sets bit 0 at the square), sorted by map z, highest first. `waterAt(column, z)` = the surface of the first existing map in z's ground layer with map z ≤ z + 2.1.

### Existence

An entity is left out (the game's cell lookup skips it) when:

- its latest CREATION_OR_DESTRUCTION destroyed it;
- its latest `entity_flags` hold EXISTS_FOR_COSMETIC_TRANSITION_PURPOSES_ONLY, NOT_SNAPPED_TO_GRID (no Door is modelled) or PLAYABLE_IN_PRELUDE (the overworld has no prelude);
- it is a direct member of existence Group G and G's state differs from its default: then the Group decides. G's state = its latest `exists`, else `exists_by_default`;
- else by its latest `entity_flags`: IN_EXISTENCE_GROUP without CURRENTLY_EXISTS;
- else by the level data's default (`world.json` gives a Group member its Group's `exists_by_default`).

`withGroups(G…)` makes Groups exist for one walk the game's way ([Existence groups](entities.md#existence-groups)): each Group, then its existence subgroups up to depth 21, skipping a subgroup an existing Group unexists and stopping at a Group that already exists. Members' cell writes are undone after the walk. Only a horizontal THROUGH light the Groups power casts its beam inside it ([Beams](#beams)); fire, other beams, pads, Wardrobes, elevators and switch latches are not re-derived.

### Support and open cells

- Supported (`supported`) when any of: SOLID in the cell itself ([Support](movement.md#support); such a cell is entered only as a THRU cell along a THROUGH beam); FLOOR in the cell; a cell of a Lily's drift ([Cells](#cells)); a cell over a Rover's track under water ([Moves](#moves)); in a pocket flood, a cell of a skip lane's ride of more than the landing cell ([Skip lanes and the TELEPORT swap](#skip-lanes-and-the-teleport-swap)); a notted Gate the flood has shut in the cell below; a closed Freezer in the cell below (in a pocket flood only a fall lands on one, [Reached levels and ways in](#reached-levels-and-ways-in)); SUPPORT in the cell below, unless that is a Gate the flood has opened; a living Monster (not one pushed to its death) or a Gem, Promesst_Light, Rover, Friendly_Dragon or vertical Mirror in the cell below (a flat Mirror holds up nothing); a bridged water cell ([Moves](#moves)), in a pocket flood every rock bridge's water cell; a powered DOUBLE beam cell over water with z within 0.6 of the surface; else the implicit ground floor, ground layer only: z ≤ 0 on a dry column, z < 0 in water. The map rooms have no implicit floor: a fall that starts in a map room lands inside that room's layer or nowhere.
- The walk does not model the column mask ([Support](movement.md#support)); on the overworld the Annihilator makes every column count as inside.
- Blocked: SOLID or GATE, unless the cell is a THROUGH beam's wall cell (THRU); a GATE without SOLID also passes when a switch press has opened it or a hero in an OPEN beam has bumped it open ([Moves](#moves)). An open notted Gate that a switch press has shut is blocked. A closed Freezer is always blocked.
- Open = not blocked and supported.
- `land(k)`: the cell itself if open, else the cell above (except for an Area_Pin or a kept hero position: not above), else the cell below.

### Attacks

- A living existing goblin attacks its own cell, its 4 neighbours and the cells above and below. A Fence on the edge to a neighbour spares it (a floor Fence, for the cells above and below), unless the goblin stands in a SQUEEZE beam; a cell with SOLID is spared unless the goblin stands in a THROUGH beam. Gates and Monsters shield nothing. The attacks are cast once the beams are. A Rock's cell is attacked ([Goblins, dragons and PROTECTION](movement.md#goblins-dragons-and-protection)).
- A living existing dragon fires from its latest cell along its facing (latest `theta_target` rounded to 90°, else its level-data side), one cell at a time, at most W + H steps, until it returns to its cell, crosses a Wardrobe door edge, or meets SOLID, SUPPORT, GATE, MONSTER, MOVABLE or a closed Freezer. Each cell before the stop is attacked. Mirrors stop the fire (no reflections).
- A Monster that only a Group makes exist blocks its cell; its attacks are left out.

### Beams

- Room power, the game's rule ([Promesst beams and powers](movement.md#promesst-beams-and-powers)). A room is a 19 × 13 screen of the ground, underworld or sky layer, or a whole map-room layer. Its lights are powered when it has at least one existing Gem_Slot and every existing one is filled: an existing free Gem stands in its cell (latest `attached_to_entity_id` 0, else not held in the level data), or its latest `flags` (else the level data's) hold BEAM_POWERED. The saved `powered` is not read.
- Every existing Promesst_Light at its latest cell, not in a closed Freezer's cell, is a lit cell. A powered one casts a beam from its cell along its facing (latest `theta_target` rounded to 90°, else its level-data side), or up or down for `vertical_up` / `vertical_down`, at most W + H steps, until it returns to its light, meets GATE or BEAMSTOP, or a closed Freezer. Solid voxels never stop it, so a vertical beam leaves its layer: one that starts below the map rooms climbs no higher than z 74; one going down runs to the bottom of the grid. Mirrors stop it.
- Horizontal THROUGH beam cells get BEAM; their SOLID cells get THRU (walkable).
- A beam is at infinity when its next cell would leave the level volume (below or above the grid, or, from below the map rooms, into them); only vertical beams do.
- Per beam cell: ENDPOINT beams (horizontal only) record their side, their cells in order (the light's own cell left out), the cell's place and whether the beam is at infinity; DOUBLE beams count; ALTER, SQUEEZE and OPEN mark. Vertical beams count and mark too.
- A horizontal THROUGH light unpowered only because an existence Group keeps it, or a Gem_Slot or Gem of its room, from existing casts its beam inside `withGroups` for that Group ([Existence](#existence)).

### Moves

The flood, pockets and leads described from here on are a build and test model that writes `data/walk.json`; the page does not run them.

Six layers per cell: 0 = the default skill or another one with a push (the hero pushes), 1 = PROTECTION, 2 =
TELEPORT (from a TELEPORT Wardrobe's door), 3 = TRANSMUTE (from a TRANSMUTE Wardrobe's door), 4 = no push skill (from
the door of a Wardrobe with no push skill, such as PULL), 5 = MULTIPUSH (the hero pushes as in layer 0 and keeps his push
through a door with no push skill). Wherever this page reads layer 0 as the layer that pushes, layer 5 counts as well. A
flood pops a cell k with layer p and
tries the four sides:

1. OPEN: a hero at k in an OPEN beam and in no ALTER beam opens the shut Gate in the neighbour cell, if that cell has no SOLID, is not a closed Freezer and has no fence on the edge (unless SQUEEZE is at k). It stays open for the flood ([Gates, switches and buttons](movement.md#gates-switches-and-buttons)).
2. Destination n: with an ENDPOINT beam at k along that axis, the beam's last cell when moving with it, its first when moving against; with ALTER also, the midpoint of the way there. A move along a beam at infinity has no destination ([Promesst beams and powers](movement.md#promesst-beams-and-powers)). Without an ENDPOINT beam, the neighbour repeated 2^d times for d DOUBLE beams at k (3^d with ALTER). n = k is skipped. Where a flood's pushes laid optional powers at k ([Beams moved by pushes](#beams-moved-by-pushes)), the sides are tried again with them added.
3. A fence on the edge refuses the step, unless SQUEEZE is at k.
4. If n holds ROCK, MONSTER or MOVABLE: refused in layers 1 to 4. Else the cell b beyond n must not be k, not be blocked, hold no other pushable and have no fence between n and b (one push; no chains, MULTIPUSH or PULL). A THRU cell b takes only a Monster, a MIRRORABLE Rock or a mirrorable movable standing in a BEAM cell n. The pushed thing is not moved in the model.
5. If n is blocked: refused; a closed Freezer there joins the walk's front, unless its cell is also SOLID or GATE.
6. A THRU cell is entered only from a BEAM cell.
7. The new layer: leaving k through a Wardrobe door sets the layer of its skill (PROTECTION 1, TELEPORT 2, TRANSMUTE 3 and MULTIPUSH 5 from layer 0 or 4, SINGLE_PUSH 0 from layer 4, CHARM and inventory Wardrobes keep it, another skill from layer 0 gives 4, else it keeps the layer); entering n through any skill Wardrobe's door gives 0. A Wardrobe that gives the Rod gives the flood the Rod.
8. Fall from n down with no height limit: stop at a blocked cell; an attacked cell (FIRE) takes the hero only in layer 1 and ends the fall either way; a cell more than 0.1 under a water surface ends it; the first open cell is reached. A fall that starts in a map room ends with no landing where it would leave that room's layer. A pocket flood keeps every fall inside its layer.

After the four sides:

9. TELEPORT swaps from k, layer 2 only. Along each side, at k's z, the line wraps and crosses water and air. It steps by the hero's powered move from k as step 2 gives it, and tests only the cells at multiples of that distance. It ends at the first target (an existing Rock, a living Monster, a movable other than a Mirror, or a Mirror met on its back or a closed side): the hero lands in its cell, then falls as in step 8, in layer 2. A Mirror's open sides come from its `theta_target` (`world.mirror_facings`) ([Mirrors turning fire and beams](movement.md#mirrors-turning-fire-and-beams)). It ends with no swap at a solid voxel (none for a hero in a BEAM cell), a Tree, Sign, Treasure_Display or Judge, a shut Gate, a closed Freezer, a Mirror met on an open side (the turn is not modelled), a Wardrobe door edge, or back at k. The target lands in k (Swapped targets, below). The swap is tried before step 1.
10. Magic-mirror hops from k, also in walks on foot: each landing cell of k ([Magic-mirror hops](#magic-mirror-hops)) that is not blocked and holds no solid voxel, reached by the fall of step 8, in the current layer; for a cell between two facing Mirrors, both landings.
11. Travel from k (skipped by walks "on foot"):

- an elevator frame cell reaches the far frame cell if it is not blocked (`world.elevators` mask: bit 1 bottom to top, bit 2 top to bottom; the mask depends on how many of the platform's Rocks still stand in their level-data column);
- an enabled pad in k or the cell below: a MINOR pad reaches its target pad's landing cell, or for a Marker target (`to`) the first open cell of a search down from the Marker inside its ground layer; a blocked cell, a THRU cell not entered from a BEAM cell, or water deeper than 0.1 ends it with no landing; an attacked cell ends it, with the hero there in layer 1 only. A trip enables the target pad for the rest of the flood ([Teleporter pads and fast travel](movement.md#teleporter-pads-and-fast-travel));
- a discovered, enabled, existing MAJOR pad reaches every other such MAJOR pad. A hero in another layer reaches only the pads whose twin a walk on foot from the source pad's twin joins without a map-room Wardrobe ([Wardrobes](skills.md#wardrobes));
- an enabled MAJOR pad also reaches the world pads its discovery reveals ([Pads revealed through the map rooms](#pads-revealed-through-the-map-rooms)).
  Every pad's trip keeps the layer. A pad frozen in a closed Freezer leads nowhere and a trip to it leaves the hero where he is; it seeds no walk ([Reached levels and ways in](#reached-levels-and-ways-in)).

When the queue drains, the flood tries the searches below in turn while the queue stays empty, and goes on while one adds cells. No push is made from an attacked cell. Each walker indexes the searches by the cells that fire them (`triggerIndex`). Pocket floods make only the bridges their own cells reach.

- Rock bridges (`world.bridges`, rows of [rock or Gem, push cell, water cell]): a non-SKIPPABLE Rock or a spare Gem at its level-data cell, pushed in a straight line from a standable push cell over supported, fence-free cells into a water cell (surface within 0.6 of z) with nothing at z − 1, bridges once: the water cell becomes supported and the walk resumes beside it. A Gem is spare when it is free and its room does not need it for its open Gem_Slots ([Beams moved by pushes](#beams-moved-by-pushes)). A bridge is one-way; a pocket flood treats every bridge's water cell as holding the hero from the start ([Objects in water](movement.md#objects-in-water)).
- Rocks a Spawner puts back (`world.rock_spawns`): once a hero reaches an existing Activator that runs the Spawner, a Rock the save left anywhere but at its Spawner's cell stands there again, as one more Rock that may turn, with its straight bridges ([Activators and Spawners](movement.md#activators-and-spawners)). Skipping stones are not put back.
- Rocks that turn: a Rock or spare Gem the hero reached a cell beside is pushed on one cell at a time, nearest first, from layer-0 cells, over at most 2048 positions. In water level with its height it sinks and the water cell above its resting cell holds the hero. It bridges once, at the nearest such cell that joins reached ground to unreached standable ground. The sunk Rock is not placed.
- Skipping stones ([Skip lanes and the TELEPORT swap](#skip-lanes-and-the-teleport-swap)) are pushed over the same positions. In level water one skips on and rests on the first cell that holds it, or sinks in place in the last water cell when a fence, a blocked cell or a pushable lies ahead ([Skipping stones](movement.md#skipping-stones)). One that would sink in a river cell is left out.
- Rocks that sink side by side: a gap of two or three water cells closes if that many Rocks sink one after another; a chain that does not join new ground sinks nothing.
- Rovers that sink (`world.rover_facings`): a Rover in water drives along its axis and turns round at the ends of its track ([Rovers](movement.md#rovers)). The track is the run of cells at the hero's height through the cell over its resting cell, each with water level with that height, no Fence across the step, no solid, shut or frozen cell, and nothing solid, no Rock and no movable under it. Every cell of the track holds the hero (`rideCells`). A Rover on dry land is pushed like a turning Rock and sinks once where its track joins new ground.
- Magic Mirrors that turn: a pushable flat Mirror below the map rooms that rides no Lily is pushed like a Rock. Every position other than its own cell is a place it hops from ([Magic-mirror hops](#magic-mirror-hops)). On a sunk Rover's track it stands in every cell of the track.

- CHARM launches: a hero holding CHARM ([CHARM](skills.md#charm)), noted when a flood steps out of a CHARM Wardrobe in layer 0 or when the save's hero holds it, launches a MIRRORABLE skipping stone from its cell and from each cell it lands on. He stands in a layer-0 cell within 2 cells of the stone along each axis and steps one cell in the launch direction; the cell ahead holds no pushable and no Fence on the edge. The stone skips on as a pushed one does. A Switch on an islet with no standable cell beside it counts as reached. A stone in a closed Freezer that a search would launch makes the Freezer a lead.
- Rod launches: a hero who left a Rod Wardrobe (`world.rod`) holds the Rod until the flood ends; a pocket flood never holds it ([TRANSMUTE and the other skills](skills.md#transmute-and-the-other-skills)). The Rod launches the object ahead of him along his facing to the next cell that is not solid and holds no Tree, closed Gate or closed Freezer; Fences, Wardrobe doors and water do not stop it. It is a way onto a cell in the Switch search (hero behind the object, in any layer). No chains. It also launches a Gem toward its Gem_Slot, but no Rock toward water or off a beam.
- Crystals: a hero in layer 3 turns the Tree or dragon he bumps into a crystal Rock in place ([TRANSMUTE and the other skills](skills.md#transmute-and-the-other-skills)). A Tree's cell is then not solid and holds a pushable Rock. A dragon's fire stops and it counts as gone for its room's monster Gate.
- Monster Gates: a shut, non-notted monster Gate opens once the walk has got rid of every living Monster of its room (a 19 × 13 screen of its layer) ([Gates, switches and buttons](movement.md#gates-switches-and-buttons)). A Monster is pushed like a Rock; it is gone when the push ends in water ([Water](movement.md#water)), or at a cell the fire of another living dragon runs through or beside a living goblin, unless a Fence parts them ([Goblins, dragons and PROTECTION](movement.md#goblins-dragons-and-protection)). A pushed dragon breathes from its new cell. The walk never pushes a goblin.
- Swapped targets: a TELEPORT swap lands the target in the cell the hero left ([TELEPORT and PULL](skills.md#teleport-and-pull)); in the grid it stays in its own cell. A layer-2 swap from k to t is noted (never in a pocket flood) when it matters: k is a Switch not pressed or a Gem_Slot a Gem turns onto and t is an object that search accepts; t is a Rock the walk may push into water (k is a further place to push it from); or t is a Rock that stops a beam and is swapped away from a cell off every beam, so the beam runs on.
- Switch presses: a Switch is pressed only by objects on it ([Gates, switches and buttons](movement.md#gates-switches-and-buttons)); the hero alone opens nothing, except the Gate lifts and a magic-mirror hop off a Switch. One latch per flavor: a press opens the flavor's shut gates and shuts its open notted gates together. A flavor is pressed once the walk reaches every unpressed existing Switch of it and can bring a separate object onto each. While the flood holds the Rod it need not reach a Switch a launch can land on (one beside a solid cell, a shut Gate, a closed Freezer, or with a Fence on an edge). A Switch under water is never reached; the object search alone decides it. Flavors go in the order of their first gate in `world.gates`. A Switch already pressed in the save needs nothing.
    - Objects: a Rock, a living Monster or a movable at its latest cell, not a Friendly_Dragon. One object rests on one Switch per flood.
    - The search walks back from the Switch, nearest first, over at most 2048 states. An object is pushed one cell at a time by a layer-0 hero behind it; a cell holds it by FLOOR, SUPPORT below (even an opened Gate's), a closed Freezer below, a shut notted Gate below, a bridged water cell, or the implicit ground floor. Walls, shut Gates and closed Freezers stop it.
    - The ways onto a cell: a push onto it; a push off a ledge with a fall of at most 8 cells through open air (water stops the fall 2 below its surface and cancels the step, [Falling](movement.md#falling)); a Rock sinking to the surface − 1 of water it falls into ([Objects in water](movement.md#objects-in-water)); a skip of a skipping stone; a CHARM or Rod launch.
- Gate lifts: a shut switch gate beside an unpressed Switch of its flavor at the same z closes upward and lifts a hero who steps off the Switch into it onto the cell above ([Gates, switches and buttons](movement.md#gates-switches-and-buttons)), once the walk reached the Switch and can bring a separate object onto every other unpressed Switch of the flavor. Not when a Fence parts the cells, the Gate is frozen or the cell above is blocked.

### Beams moved by pushes

Three pushes change the beams ([Promesst beams and powers](movement.md#promesst-beams-and-powers)). The flood makes
them when its queue drains and the hero has reached a push cell in layer 0, or one lies in the reached cells a flood
stays out of while a closed Freezer is opened for it (a lead). What they change lasts until the flood ends.

- A Gem onto a Gem_Slot: a free existing Gem pushed in a straight line, inside its screen room, onto an existing slot
  that is not filled. Each cell it enters is not blocked, holds no other pushable and holds it up, and the hero can
  stand behind it. The slot then counts as filled, so its room may be powered; the Gem's old cell stops no beam.
- A Gem onto a Gem_Slot with turns: the same Gem and slot by any pushes, found by the walk back from the slot that the Switch search makes ([Moves](#moves)), only for a slot of a room with a Promesst_Light and as many free Gems as open slots. A layer-2 hero in the slot's cell also brings the Gem by a swap.
- A Promesst_Light along a line: an existing light pushed in a straight line inside its screen room. Each cell it gets to is a spot: once its room is powered and the spot is not a closed Freezer's cell, the light casts its beam from there. The light's old cell stops no beam.
- A Rock that stops a beam: a non-MIRRORABLE Rock in the cell after a beam's last cell, pushed one cell from a cell the hero reaches (off the beam's line first, else on along a horizontal beam) onto a cell that holds it and that no beam with a power the walk lays runs through (a SMASH, STRONG or GEM beam lays none). The longer beam replaces the shorter one and the Rock may be pushed again where it ends. When no push moves it, a layer-2 hero swaps it away ([Moves](#moves)).

A beam a push makes or lengthens is laid as at the start ([Beams](#beams)), but its ENDPOINT, DOUBLE and ALTER powers are optional ([Moves](#moves)). A beam wholly inside the cells a pocket or lead flood stays out of is not laid. When a beam changes, the reached cells in and beside it are walked again.

### Magic-mirror hops

ACTIVATE swaps every target of a room's magic Mirrors with its mirage, all or nothing
([Magic mirrors](movement.md#magic-mirrors)). The walk models two cases that need no other target: a hero on one
open arm of a flat magic Mirror that no other magic Mirror of its room spoils lands on the cell as far down the other
arm, and a hero between two magic Mirrors of such a room that face each other is cloned onto both ([Hops between two
facing Mirrors](#hops-between-two-facing-mirrors), below).

- Mirrors: `world.magic_mirrors`, existing, at their latest cells, not in a closed Freezer's cell. A Mirror is used when it is flat, below the map rooms and both arms lie on grid axes. Another magic Mirror of its room (a 19 × 13 screen in its ground layer) spoils a hop off an arm cell when it is vertical or has an arm off the grid axes, when a ray along one of its arms finds a target, or when such a ray passes the arm cell (the hero there is its target too). A Mirror whose rays find no target and pass no hop cell spoils nothing.
- A ray along an arm runs at most max(100, W, H) cells. It stops at SOLID, a shut Gate (also one the flood opens later), a closed Freezer's cell, or a Rock or movable a beam does not pass. It finds a target at a Monster, a MIRRORABLE Rock or a `mirrorable` Rover.
- For each arm cell at d cells out (past no Fence, stop or target of its own arm), the hero lands d cells out on the other arm; d must be less than that arm's first target, stop and Fence. A hop is one-way.
- A hop off a Switch not pressed: he holds the Switch down while he ACTIVATEs ([Gates, switches and buttons](movement.md#gates-switches-and-buttons)). When he holds its flavor alone and every other Switch of it is pressed or holds an object the walk brings there, the rays are laid with the flavor's gates as a press leaves them; he lands where the gates as the flood has them leave the landing free. These hops are tried before any flavor is pressed.
- A Mirror on a Lily's cell hops too, only while the Lily stays where the save left it (`driftHops`).
- A Mirror the walk pushes ([Moves](#moves)) hops from its new cell off the arm cells no other magic Mirror of that room spoils, with Gates as the save left them; the hops of the cell it left stay. The hero hops only from an arm cell in the Mirror's room.
- A Mirror on a sunk Rover's track is in every track cell; no hop is taken off a track cell, but off a track end a Rock fills.

#### Hops between two facing Mirrors

Two magic Mirrors reflecting the hero to different mirages clone him: a copy appears at each landing ([Magic mirrors](movement.md#magic-mirrors)). The walk models two flat Mirrors of a room, riding no Lily, below the map rooms, whose arms face each other along one grid line, with no other magic Mirror spoiling the hop ([Magic-mirror hops](#magic-mirror-hops)):

- The gap between them holds no target, stop or Fence.
- A hero d cells from the first Mirror, e = gap − d from the second, lands d cells down the first Mirror's other arm and e cells down the second's. Each other arm must be clear nearer than the cell he reflects to.
- All or nothing: both landings must be free.
- The walk goes on from each landing in the layer of the arm cell, as independent heroes.
- A pocket flood also steps from a landing back to its arm cell. Single hops stay one-way.

A hop that lands in water holds the hero only where a Rock or stone has sunk in that cell ([Moves](#moves)); the cell counts as joined to reached ground when the hop's arm cell is reached in layer 0.

### Skip lanes and the TELEPORT swap

A TELEPORT hero swaps with the first target on his line, at any distance and over water
([TELEPORT and PULL](skills.md#teleport-and-pull)); the walk does this in layer 2 ([Moves](#moves)). A skipping stone
carries him across water this way: it is pushed into the water, skips to a cell that holds it, and the hero swaps onto
it from a line cell. The stone is pushed before he takes TELEPORT, and it may land on a Lily and ride it. The walk lays
these out as lanes once per walker.

- Stones: the SKIPPABLE Rocks (`world.skippable`) that exist, at their latest cells, whose latest `properties` still
  hold SKIPPABLE and not FLIPPING_TARGET, and that are not more than 0.1 under a water surface.
- Pushes: from its cell the stone is pushed over dry cells, one cell at a time, from a push cell behind it that is
  standable and not blocked (the cell the stone started in is one once it has left), with no fence on either edge, into
  a cell that is not blocked and holds no pushable. A cell that holds it (FLOOR, SUPPORT below, or the dry implicit
  ground floor) is a new place for the stone, all of them, nearest first. A cell with water level with the stone (a
  surface in [z − 0.5, z + 0.5)) is a launch: [side, push cell, first water cell].
- Skips: from the first water cell the stone goes on one cell at a time, at most W + H. It can stop on each cell of a
  Lily's drift ([Cells](#cells)) it crosses, the launch timed for the Lily to be there, and lands on the first other
  cell that holds it: each of those is a landing. It is lost at a fence on the edge, a blocked cell, a pushable, or a
  cell without level water.
- The ride ([Lilies](movement.md#lilies)): a landing cell that holds an existing Lily (at its level-data or latest
  cell, or on its drift) starts one. The stone kicks the Lily along its own heading, and from the next step on it drifts as in [Cells](#cells). The
  ride is the landing cell plus every cell the Lily enters; without a Lily it is the landing cell alone.
- Freezers on the Lily: lanes are laid with the closed Freezers in a Lily's cell or the cell above it open. A lane lists the Freezers in a column of its ride or of the home of a Lily it rides, and the stone's own Freezer if closed, and is taken only while all are open; a flood that meets a lane with one closed adds it to its front.
- Kicks ([Lilies](movement.md#lilies)): each cell a skipping stone hops out of (the first water cell and each cell on as far as a hop goes) kicks the Lily whose latest cell is beside it, away from the lane. That Lily drifts as a ride does. Its cells hold the hero once the flood has reached the launch's push cell in layer 0 and the stone is not frozen. A Lily already on a river is not kicked.
- Respawns ([Activators and Spawners](movement.md#activators-and-spawners)): a Spawner that respawns a Lily in a river cell (`world.lily_spawns`) puts it on the drift from that cell. Its cells hold the hero once the flood has reached an existing Activator that runs the Spawner, in layer 0. The Lily the save left stays. A Spawner off a river changes nothing.
- The line: from each ride cell in each direction, until a blocked cell, a pushable, a Wardrobe door edge or the start cell (at most W + H). Open cells on it not more than 0.1 under a surface are where the hero can stand to swap; those after a cell he can't stand in are past a gap. A cell held up only by the Lily under the landing is no line cell.
- One lane per ride cell the hero swaps into. He rides to the end of the ride, or, when his line cell lies further along the ride, to the cell just before it. A lane's line cells are those whose ride ends at the same cell.
- The swap, when the queue drains: the stone is not frozen, the launch push cell and a cell next to the stone are reached in layer 0, and a line cell of the lane is reached in layer 2. Then every cell of the lane's ride is reached in layer 2. Lanes go in one pass in order. A TELEPORT hero can't push ([Pushing and pulling](movement.md#pushing-and-pulling)), so the stone goes first.
- A pocket flood walks a lane backwards only: reaching any cell of the ride, it reaches the launch push cell and the line cells past a gap, in layer 0. It holds the hero on every ride cell of a ride of more than the landing cell.
- A skill Wardrobe's door-in on the way to the line resets the skill, so such a walk is no lane. Pushes are single ([Routes that need these mechanics](movement.md#routes-that-need-these-mechanics)) and launches are from dry-land push cells only.

### Room answers

The walk's searches for Rocks, Switch objects, Gems and Monsters push one object at a time and take the hero's push
cells from the cells the flood reached ([Moves](#moves)), with caps on the cells they visit. The build searches every
screen room of the level data exhaustively instead, with all its objects moving, and `data/rooms.json` stores what
it finds (`searchRooms()`, `src/walk/room-search.ts`; [data/rooms.json](datafiles.md#dataroomsjson)). A walker uses the
answer of a room whose save leaves it as the level data has it, and runs the same search on its own grid for every other
room that holds an object (`searchTouchedRooms()`); only the inputs differ.

- A room is a 4-connected set of cells in one z and one screen (19 × 13 squares) where the hero stands or an object
  rests, cut at Fences, Gates (shut or not, so the room does not depend on a Gate's state) and closed Freezers,
  water-level cells nothing holds up, Lily, drifting-Lily and bridge cells, the map rooms, and, below the ground, cells
  only the implicit floor holds up. What holds up a cell is the ground, so a room is cut with the objects out of the
  grid. Only rooms with an object are searched.
- Freezers: each room is searched with every Freezer closed, and, with up to three Freezers around it, again for every other combination open. An open Freezer's square is ground that holds up nothing above it ([Support and open cells](#support-and-open-cells)). The rooms on the far side of an open Freezer join the room, so the answer is for the merged room; attacked cells are worked out again with the Freezers open ([Goblins, dragons and PROTECTION](movement.md#goblins-dragons-and-protection)). With more Freezers than that, only the all-closed answer is kept. A walker picks the answer matching its save's Freezers.
- The objects are the room's Rocks, skipping stones, Gems, Promesst_Lights, Mirrors, Rovers, Friendly_Dragons and Monsters; the other rooms' objects stand still. The hero walks over the room's cells and its halo (the cells beside it) that he stands in; his starts are the pieces of ground reaching into the halo (up to six), each searched alone and together. A start is used once the walk reached its cell in layer 0. Pushes are the walk's own ([Moves](#moves)); an object that leaves the room is not followed.
- An answer holds, per start: for each Rock the water cells it sinks in; for each Switch the objects that stand on it; for each Gem_Slot the Gems that stand on it; and the Monsters that die. Each fact is reachable alone, not always together.
- A room with no start, nothing to tell or more than 200 000 positions is stored with no entries (`rooms.capped`) and keeps the walk's searches. A room a walker searches has a cap of 20 000 positions.

A walker uses a room's answer when the save leaves the room as the level data has it: every entity in or beside it is where and as the level data has it, the Monsters whose attacks cross it too, no created Rock or Tree stands in it, none of its Groups, Wall_Sets or Ocean_Maps differs, and the Freezers around it are in a state the answer holds. It searches every other room that holds an object on its own grid.

The answers are asked before the walk's own searches and add to them (turning Rocks, Switch objects, Gems for slots, dying Monsters). TELEPORT swaps, skips, CHARM, objects that leave a room and Gates and Freezers the flood opens stay with the walk's searches.

### Pads revealed through the map rooms

- `reveals(T)`: discovering pad i discovers its `target_id`, then its `also_discover`, each with its own chain (a pad already in the set ends it), then its `also_discover2` alone. Of those, the world-layer pads (layers 0-2) other than i are its reveals.
- A revealed pad q counts for MAJOR pad i only when q exists and a walk on foot (no pads, no elevators) joins i's twin (its `target`) to some twin targeting q, with the Groups of the four pads (`g` own Group, `ag` = `also_exist_this_group_id`) made to exist (`withGroups`). Twins are not asked to exist: discovery makes them. Twins in different ground layers are never joined: a walk on foot never changes ground layer (a step keeps z, a fall from the fast-travel box stays in its layer, and a walk from the world never reaches the fast-travel box), so a map-room pad, whose `target` lies in the world, reveals nothing, and the walk is not run for it. The walk from i's twin ends as soon as it reaches the twin it looks for.

### Reached levels and ways in

The page decides reach from the level table alone ([Level needs and pad routes](#level-needs-and-pad-routes)) and runs
no flood.

- Door reached (`P.doorReached`): a level's door is reachable when the save entered the level, or its needs hold (a need on a level of its own `req` counts once that level is reached), and it is not frozen in a closed Freezer. A level with no needs counts as reached. Without a history (`P.reachKnown` false) every open level reads "Not entered".
- Behind (`P.behind`): per level whose door is not reached, the closed Freezers to act on next. A need level stands for the Freezer it opens (the nearest by wrapped x/y distance if several, none if it opens none). The walk back along the unmet needs through the levels whose door is not reached keeps the closed Freezers whose opener level's door is reached; with none, the closed Freezers it meets first. A group with a solved need adds none.
- Leads (`P.leads`): per closed Freezer, the levels whose door is not reached with an unmet need that stands for it.
- `inner(gate, level)`: a closed gate is no way in when what it still needs is the level itself or levels whose own requirements need it. For an OR gate with several options: every remaining option is such a level and it has no Sign.
- Levels needing level L (`levelsNeedingLevel`): walking back along `unlocked_by`, every unsolved level still waiting on its requirements that requires L or such a level (an AND level through any one requirement, an OR level with several options only when every option is such). A gate waiting on them waits on L: a cycle, no way in.
- Way in (`P.wayIn`): per blocked level, the closed Freezers it sits behind, minus the `inner` ones. In the endgame areas the level table's gates stand in or fill in ([Endgame way-in gates](#endgame-way-in-gates)). Last, gates behind themselves are dropped ([Next steps](#next-steps)).
- Why (per blocked level): its way-in gates. With no gate and no access mark it reads "no known route", or "from High" when the level data enters it from the sky (`drop`) and fog shows the sky; under fog as for a hidden layer ([The spoiler model (viewer)](#the-spoiler-model-viewer)). A level behind only closed gates it unlocks itself, all shown, reads "only behind a cage it unlocks" (or "cages", "gates").
- Access (`P.access`): a blocked level on a layer holding no level with a reached door (the sky or the underworld) is marked with that layer; one the level data enters from the sky (`drop`) is marked with the sky while no sky level has a reached door ([The requirement graph](#the-requirement-graph)).
- Signs (`P.signFaced`): faced when every Freezer it sits behind from the start (`bg.s` in the static roles) is open ([Sign `rank_satisfied`](progression.md#sign-rank_satisfied)); a Sign the build walk never reaches is not faced. A Sign not faced takes those Freezers as its way in (`P.signWayIn`), less one that waits on the Sign, and its layer as access (`P.signAccess`) when no level there has a reached door.

### What the walk leaves out

The walk models one push of one cell per move and takes the level data's targets as the save leaves them. It leaves out:

- reflections by plain Mirrors (each ends at the Mirror) and Mirror turns of ENDPOINT jumps;
- Rocks, Mirrors and Monsters a push or swap has moved (a moved object is not placed in its new cell);
- MULTIPUSH rows, PULL moves, SWAP_WITH_DRAGON, stacked skills and the Torc;
- SMASH and STRONG beams, vertical THROUGH and ENDPOINT beams, and lights moved before being powered;
- Rover timers, river redirects, ocean resets, Activator respawns other than Lilies on a river and Rocks, elevator cargo changes, a second reset after a Rock sank, a Spawner whose cell is blocked;
- crushes by a closing Gate and Gate lifts other than a step off a Switch;
- Monsters that walk by themselves or are charmed;
- `FastTravelEnableGroup` Markers and the map rooms' implicit floor;
- the four sky Ways to the hub quarters and the endgame areas: the pad routes and endgame way-in gates stand in ([Level needs and pad routes](#level-needs-and-pad-routes), [Endgame way-in gates](#endgame-way-in-gates)).

## Level states (viewer)

Per overworld level, first match wins:

| State                | When                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| solved               | Status flags & SOLVED                                                                                                                                                   |
| partial              | flags & PARTIALLY_SOLVED                                                                                                                                                |
| visited (Entered)    | any Status entry                                                                                                                                                        |
| locked               | not enabled in the level data (`enabled_t_target` 0) and its unlock gate is not met ([Level_Entry unlocking and state](progression.md#level_entry-unlocking-and-state)) |
| unlocked (Reachable) | the level's door is reached, or there is no history                                                                                                                     |
| blocked              | the level's door is not reached                                                                                                                                         |

Freezers are open when listed in Status list A or satisfied now
([Level_Entry unlocking and state](progression.md#level_entry-unlocking-and-state)). Without a history file there is no reach and
"unlocked" reads "Not entered".

## Level roles (viewer)

A level is **Optional** only when it is provably not needed for any goal (it then counts only for Completionist). Every
other level is **Required**, including the ones whose use the model can't see. Goals are the tower levels that are not
dropdowns and the levels with an `achievement`. An achievement level is always Required. A tower needs N of its M
normal levels, so a tower level is Required as one of several, unless the tower needs every normal level or something
Required needs that level. Dropdowns are not goals (they only give gold), so a dropdown is Optional unless something
Required needs it.

Needs, from the goals:

- a level with table `needs` ([Level needs and pad routes](#level-needs-and-pad-routes)) needs the levels of its groups, a group of one level as that level and a group of several as "one of"; any other level needs its `unlocked_by` levels (none for a level enabled in the level data). With an OR gate of more than one option, every option is needed, but only as "one of", and so is everything they need in turn;
- a level or Freezer needs the Freezers it sits behind. Behind several Freezers = any one of them, so they are needed as "one of". A level frozen in a Freezer sits behind that Freezer alone, even where the walk reaches the squares next to it;
- a Freezer needs its `unlocked_by` levels (Sign rules are not levels), and a Freezer is needed by itself unless it is provably a shortcut (below).

So a non-goal level is Optional when everything it opens is optional: every level that needs it is
Optional and every Freezer that lists it is a shortcut with nothing Required behind it. A level that opens nothing is
Optional.

"Provable" means the walk ([The walk model (viewer)](#the-walk-model-viewer)) shows it on the level data alone: no history (everything at its data state), seeded with the hero and the Area_Pins of a new game (`data/fog.json` `start`), every Freezer closed, level unlocks ignored, no pad discovered. Then rounds: the closed Freezers on the edge of the reached cells (in Pid order) open together. A level or Freezer first reached in a round is behind the Freezers of that round whose opening alone reaches it (all of them when only opening them together does).
A Freezer is a **shortcut** when the walk reaches it, opening it reaches no cell not reached without it, and the walk goes through it to a reached cell on the opposite side. Every other Freezer is needed: one the walk never reaches, one that alone opens new cells ("one of" when several of the round open the same cells), and a dead end, pit or step up whose far side the walk never sees. Most gates come out needed, which errs towards Required.

These are the static roles: `staticRoles()`, run by `scripts/build-walk.ts` and stored in `data/walk.json` (`need`, and `bg`: the Freezers each Freezer and Sign sits behind). They feed the Signs' ways in (`bg.s`, [Reached levels and ways in](#reached-levels-and-ways-in)) and the Next steps label ([Next steps](#next-steps)), and stand in for the roles of a goal that has none. The lists and the map go by the selected goal's roles ([Goal roles (viewer)](#goal-roles-viewer)).

## Unlock plans and next steps (viewer)

A plan is what is still to do before a level, Freezer, sign or tower opens, walked back to the levels playable now.
`planAll(P)` works out every plan at once; `unlockPlan(P, root)` reads one off as nodes and edges.
An edge [a, b] means a comes before b. Solved levels and open Freezers have empty plans.

### The requirement graph

A requirement is met (nothing to do), a step (a node of the plans) or a part (an option list with no step of its own).
It needs all its parts (AND), the cheapest one (OR), or the cheapest k of them (k of n). Steps: levels (l), Freezers
(g), signs (s), towers (t), gold rooms (p), the way onto a layer (a), the rank markers ASCEND and DESCEND (e) and the
known sky Ways (w).

- Level, solved: met. Playable now (entered, partly solved or reachable): a step with no parts, a front.
- Level, locked: its unsolved requirements, all of them, or for an OR gate of more than one the cheapest of them; and
  the closed Freezer it is frozen in.
- Level, not reachable: the cheapest of its way-in gates (`P.wayIn`). With none and an access mark (`P.access`): the way onto that layer. With none of them it is a step of its own (below). A level that also asks for the endgame table's gates (`P.wayInAll`, the end2 room's levels) needs all of them together, besides the cheapest of the rest. A level with unmet needs in the data ([Level needs and pad routes](#level-needs-and-pad-routes)) asks for all of them together in place of the way-in gates, and gets no access step.
- Way (w), a sky Way, a pad route with an area ([Level needs and pad routes](#level-needs-and-pad-routes)): met once its tower's hub quarter is reached: the hub Sign is read (`P.signRead`) or faced (`P.signFaced`), or the hub pad (`teleporter_id`, a MAJOR pad) is discovered. Else a step that needs what its route needs (all groups, an OR inside a group of several); met needs ask for nothing.
- Freezer, open: met. Closed: its unmet levels and signs, all of them, or for an OR gate of several the cheapest. An OR gate with one of them met is a step with no parts: it opens at the next overworld load.
- Sign: the step is reading it; met once read (`rank_satisfied` in the history, `P.signRead`) or when it asks for nothing. A tower sign whose tower is not active needs its tower; a rank sign whose rank is not reached rank r; the gold-room sign the cheapest k of the gold rooms still to find, k = 4 − the rooms found. A sky tower's hub Sign also needs that tower's Way. A sign whose rule holds, which is unread and has a reached cell beside it, is a step of its own, worded "Read the sign · `rule`" ([The page's words](#the-pages-words)). A sign with no reached cell beside it also needs the cheapest of its way-in gates (`P.signWayIn`); when none has a plan (a cycle) the way adds no step. With no such gate, a sign on a layer the walk reaches nowhere (`P.signAccess`) needs the way onto that layer. Tower status signs are never read: their step is met with the tower active.
- Gold room: met once its `gold_room_endpoint` pad is discovered; else a step after its tower: the step onto the tower's MINOR pad ([Endgame](progression.md#endgame)).
- Rank r, a part: the cheapest source of r or more: the ENDGAME levels (1, 3, 5), ASCEND (2) and DESCEND (4) ([Achievements and ranks](progression.md#achievements-and-ranks)). Met when the rank is r already.
- ASCEND and DESCEND are steps after the way onto their layer, the sky and the underworld; met at their rank.
- The way onto the sky comes after rank 1 (the lift's pieces wait in rank-1 Freezers). The way into the underworld comes after the sky ([Endings](progression.md#endings)). Each is a step of its own, met once the walk reaches a cell on its layer. A level waits on it only through its access mark. DESCEND counts for rank 3, so it can serve a rank-3 gate.
- Tower, active: met. Else the cheapest k of its unsolved normal levels, k = the levels it still needs.

### Planning

- A plan's weight is its number of steps, then the levels in it the walk cannot reach.
- Requirements settle cheapest first. One is offered a plan only from parts already settled: an AND once all of them
  have, an OR with its first settled part, a k of n with its first k. So a plan never runs through itself. Ties go to
  the part settled first.
- Its plan is the union of its parts' steps, plus itself when it is a step. A plan is never cheaper than a part of it,
  which keeps the order.
- A requirement left unsettled has no plan: its parts run in a cycle, or it has none. When nothing is left to settle,
  each unsettled level that may be a step of its own becomes one, and settling goes on from it. That repeats until
  none is left.
- `unlockPlan` lists a plan's steps in settling order. Each step gets an edge from the first steps of the parts it took
  (through parts with no step of their own).

### Endgame way-in gates

The walk does not find its way into the endgame areas. `data/progress.json` `endgame_way_ins`
([data/progress.json](datafiles.md#dataprogressjson)) gives their way-in gates, built from the gate unlockers and
positions ([Endings](progression.md#endings)):

- `end1`: the gold-room Sign's gates, in place of the walk's.
- The end2 room's levels: the four Freezers ringing the sky hub elevator under the room, one per sky tower
  ([Second Endgame](progression.md#second-endgame)), all four needed together (an AND), besides the room's own way in.
  Where there is none, the four are the way in. Gates already open are left out.
- `all_together_now`: every gate the set's other levels open, all needed together (an AND).
- The `endgame3` levels: one chain in set order, in place of the walk's. A level sits behind the gates opened only by
  levels before it in the set (the latest of those), leaving out a gate whose levels need the level itself. The first
  room has none, so it needs the way into the underworld.

A row that stands in for the walk's gates also drops the levels by a revealing pad and the Towers whose pad leads in.

### Level needs and pad routes

The hand-written level table (`scripts/lib/level-table.ts`) says what each level needs to be reached, and lists the
routes to pads. Both are in `data/progress.json` ([data/progress.json](datafiles.md#dataprogressjson)): the needs and
the sky entry on each level, and `pad_routes`.

Needs are all of the groups, one need of a group. A need is a level solved or a Sign read. A group with no need is one nobody knows yet; nothing meets it. No group needs
nothing; a level with `needs` of no groups is reached from the start. A level enabled in the level data needs no unlock,
so its row lists none.

A level with `needs` is decided by them: it is reachable when they hold and not reachable otherwise, except that a level
the save solved or entered stays reached. A level frozen in a closed Freezer is reached only once it opens
([Reached levels and ways in](#reached-levels-and-ways-in)). `drop` marks a blocked level entered from the sky, worded
as for the sky.

A pad route has `to`, the pad or the cell of another overworld entity (a Sign, a Level_Entry) where the hero lands once
its needs hold, and, for a sky Way only, `area` (the Way area) and `tower` (the sky tower whose hub quarter it leads
to). In the graph ([The requirement graph](#the-requirement-graph)) a sky Way row whose needs are not met gives the Way
step, which the tower's hub Sign needs; a target that is another entity gets no step.

Names are level names, area names and entity ids; the build resolves them to indices and a missing one fails the build,
and so does a level the table lacks or lists twice.

The four sky Ways are pad routes: one per sky tower, each leading on foot to the quarter of the sky hub where that
tower's Sign and hub pad stand ([Second Endgame](progression.md#second-endgame)), with the hub pad as its target.

| Way              | Tower                | Quarter |
| ---------------- | -------------------- | ------- |
| The Heroic Way   | High Heroes          | south   |
| The Mirror Way   | High Mirrors         | west    |
| The Skipping Way | High Skipping Stones | north   |
| The Beam Way     | High Beamcasters     | east    |

The page words a Way, as a plan step and as a stage of Endgame High ([Goals (viewer)](#goals-viewer)), by its area's
name (the plan step with a link that frames the area on the map) and, while the area is not named, "Way to the High
Mirrors sign" with the tower's name ([The spoiler model (viewer)](#the-spoiler-model-viewer)).

Every level, Freezer, Sign and tower panel ends with the table route (a tower's is that of its unsolved required levels). The map draws the chain of needs left back to the Crossroads pad of the layer as straight lines between its stops: solid gold for a need not met, dotted gold for one met, nothing behind a met need or under fog. What a panel unlocks is dashed blue. A need of a High or Low level ends at the pad of the level's layer; a need of a ground level on another layer runs to the pad of its layer and on from the ground pad.

A table row's `needs` lists the levels that unlock it in the game data (one group each, or one group of alternatives) and then what play adds. The panel lists the play-added groups under "Also needs". A row with a `drop` is entered by a drop through that hole; its needs end at the hole, which carries an arrow on the map.

The chain follows each group's shown option the save meets, else the first shown, through the levels that unlock a level (except one the level data enables). A Freezer's panel starts from the levels and Signs that open it. A tower Sign or the gold-room Sign goes on to its towers (all of them for the gold-room Sign, without their levels). It ends at an entry with no needs or a tower, joined by a line to the pad, or stops at a level nothing unlocks, any other Sign, a Freezer nothing opens or a level already on the chain. The panel marks the stops in one broken-route box and links the level table file.

### Next steps

Next steps (`nextSteps`, `P.needed`) say what each unsolved level opens; the goals' lists are sorted by them
([Goals (viewer)](#goals-viewer)). They are worked out once, for no goal in particular. The things still to do: every
tower not activated, every unsolved level whose achievement is not earned, every locked or blocked level, every
closed Freezer (not a Judge's). Every playable or unreachable level in the plan of one of those is a next step. Per
next step:

- the towers whose levels' plans hold it, with the levels each still needs;
- the levels and gates whose plans hold it, the ones after it;
- the next ending not earned yet, when that ending's level's plan holds it.

Order (`orderNextSteps`): playable, then unreachable, then locked; then the steps toward the next ending; then by the
tower brought closest to done; then by more levels and gates after it that the goal needs (Required or Required as
one of several by the goal's roles, by the static roles for a goal without roles); then by distance from the hero's
latest position, wrapped in x and y, levels on his layer first (no tiebreak without a history). Towers, levels and
gates under fog don't count.

Label (`goalOf`, what a level leads to under Completionist): "Toward Endgame" (the ending's name, [The page's words](#the-pages-words)), with the
tower brought closest to done: "Toward Endgame · Antipode HxM · 3 to go". An ending is named only while its achievement
may show ([The spoiler model (viewer)](#the-spoiler-model-viewer)); else the label is the tower, then the achievement
of the level or of a level after it that is not earned, then the first Required level or Freezer after it
("Required `name` +2", "Required cage · `area` +2" or "Required gate · `area` +2"), then "Required level"
when the level itself is Required, else nothing. Required here is the static role Required, not Required as one of
several. The label names no tower, level or gate under fog.

Gates behind themselves (`gatesBehindThemselves`): a way-in gate is dropped from `P.wayIn` when its own requirements
can be met only from behind it, through any chain of gates and levels. The graph is the requirement graph over levels and Freezers (a doorway needs one of its ways through it, each of which needs all of its gates). A gate can need itself only inside a strongly connected component (Tarjan). Within it, "can't be met without this gate" spreads back from the gate to a node that needs all of a list holding a held node, or one of a list inside the component with every member held. The gate is behind itself when what it needs is held that way. This generalises `inner()`. A way through a doorway that holds a gate behind itself is dropped, and a doorway with no way through left is dropped from `P.wayIn`.

A way-in gate is ruled out when its unsolved requirements need the level itself: `inner()` in [Reached levels and ways
in](#reached-levels-and-ways-in).

## Goals (viewer)

The goals ladder: what the page counts down and lists. `goalLadder()` builds it per save without
fog; `goalsView()` adds the labels, counts and lists with fog applied.

- Order: the three endings in rank order (Endgame, Endgame High, Endgame Low), Achievements (one child per achievement other than COMPLETIONIST), Completionist. Endgame has one child per ground tower, the towers with an Antipode teleporter, whose visits its Sign counts ([Endgame](progression.md#endgame)); Endgame High and Endgame Low an ordered list of stages each. The other towers are listed by their TOWER_* achievements. Completionist's children in the sidebar are the areas ([The page](#the-page-viewer)); they are not goals.
- Done: an ending or achievement child when its achievement is earned or its tower activated; a stage by its own rule; a ground tower under Endgame once its Antipode teleporter is visited (its `gold_room_endpoint` pad discovered); Achievements when every child is; Completionist when COMPLETIONIST is earned or no level is left unsolved. The active goal is the first not done; among the children, the first not done in order.
- Targets, the requirements ([The requirement graph](#the-requirement-graph)) a goal asks for: an ending its ENDGAME level; a tower its tower; a ground tower under Endgame its gold room (which waits on the tower, then the step onto its pad); an achievement its tower's, its unsolved levels, or its rank marker (ASCEND, DESCEND); Achievements their children's; Completionist every unsolved level. A goal done asks for nothing. Endgame's targets leave its children out. Endgame High and Low also ask for what their undone stages ask for, so their lists hold the stages' levels even while a stage is under fog.
- Progress: an ending, its plan steps left that fog does not hide, its own level counted; Endgame, until its Sign has the teleporters it needs, the Antipode teleporters visited of 4, then its plan steps left; a tower, its solved normal levels of the number it needs; a ground tower under Endgame the same, and once activated its next step, the step onto its pad; an achievement, its tower's count, its levels solved, or 0 / 1; Achievements, the children done of those shown; Completionist, the levels solved of those not under fog. `fogged`: more is under fog.
- Endgame's children: those whose gold room is on its cheapest plan (the cheapest four still needed), or visited, come first (`onPlan`). When the plan runs through no gold room while the Sign still needs some (a save without a walk), every child counts as on the plan.
- Endgame High's and Endgame Low's children are their stages, a hand-written table (`ending_stages` in `data/progress.json`, [data/progress.json](datafiles.md#dataprogressjson)). A stage has a name (an area, a level, a tower or a sky Way), a done rule and, for an area the game may leave unnamed, the pads whose discovery shows it. Rules: an achievement earned; a tower active; Freezers open; a level solved; one of some pads discovered; all of several rules (the stage counts those done). A stage asks for what its rule does, so a tower stage's plan is the tower's levels and a Way stage's plan runs from the Way's entry levels through the Way and the hub Sign to the hub Freezer. A done stage stays listed with its done mark; the order is fixed and no stage is `onPlan`.
    - Endgame High, in order: the sky crossroads (ASCEND earned); the four sky towers (tower active); the four Ways in the towers' order (hub Freezer open), named by their areas ([Level needs and pad routes](#level-needs-and-pad-routes)); the sky hub (`all_together_now` solved; shown also once one of the four hub pads is discovered).
    - Endgame Low, in order: the underworld crossroads (DESCEND earned); the six Low towers in their achievements' order (tower active); the underworld hub (its MAJOR pad discovered); Exit Low, one stage for the eight end3 rooms, counted "n / 8" and done when every room is (its exit Freezer open; the pipeline room's five Freezers and `end3_pipeline_aesthetics` solved; the environment art room when `environment_art_objects` is solved) ([Final Endgame](progression.md#final-endgame)).

    A stage with an area is listed once the area is named (or a `seen` pad is discovered), a stage with a level once the level is not under fog, a tower once it is not hidden ([The spoiler model (viewer)](#the-spoiler-model-viewer)); `fogged` says one is left out.

- Labels: an ending by its name, a tower by its tower name, an achievement and Completionist by the achievement's name ([The page's words](#the-pages-words)). With spoilers hidden an ending is listed only once every ending before it is earned.

A goal's levels (`goalLevels`): the unsolved levels not under fog that serve it. An ending's are the levels its roles mark ([Goal roles (viewer)](#goal-roles-viewer)); a tower's (and a ground tower's under Endgame) are its unsolved normal levels and the levels in their plans; an achievement's are the levels in its targets' plans; Achievements gathers its unfinished children's; Completionist takes every level. Each level carries:

- its group: playable now (entered, partly solved or reachable), not reachable (blocked) or locked;
- its role for the goal;
- `onPlan`: it lies on the cheapest plan of one of the goal's targets (every level, for Completionist);
- `leadsTo`: the nearest thing not under fog on its chain toward the goal (the `from` links of the goal roles): a tower ("Antipode HxM · 3 to go"), a Freezer ("opens cage" or "opens gate", and its area, else "at x, y"), a level ("unlocks `name`" when that level lists the one before it in `unlocked_by`, else "opens the way to `name`") or a rank marker; else the goal's label. At the nearest OR on its chain where it is one of several, " · one of N routes" follows (N counts the routes not under fog; " · one of several routes" when fewer than 2 show). Under Completionist it is the Next steps label ([Next steps](#next-steps)).

They are listed in the Next steps order. `goalLevelsFogged(goal)`: whether fog hides an unsolved level that serves the goal. `goalSolved(goal)`: the solved levels not under fog in the goal's scope. The page shows the goal picked, else the active one, else the last.

## Goal roles (viewer)

A level's or Freezer's role for one goal (`goalRoles()` and `roleFor()`): Required (on every route
to the goal's targets), Required as one of several (on some routes), or Optional (on none). It is marked over the
requirement graph of the plans, which already holds the static roles' gates (through `P.wayIn`), the gold-room k of n,
rank Signs, access steps and the endgame way-ins, so every goal's roles come from the one static roles pass.

- Marking starts at the targets, Required, and runs breadth first. An AND passes its strength to every part.
- An OR or k of n passes it to its routes: its parts, but for those whose plan runs back through the requirement
  asking for them (that requirement itself when it is a step, else the steps that have it as a part). So a rank's
  ASCEND, which needs the way onto the sky, which needs that rank, is no route to it. A part with no plan (it waits in
  a cycle of requirements) is a route: the way-in gates of a level a goal needs get a role whether or not a plan finds
  the way through them.
- An OR with one route, or a k of n with no more routes than k, passes its strength to them in full. Otherwise each
  route is one of several, and the parts every route needs (when every route is an AND) get its strength in full.
- Met requirements need nothing, and an OR or k of n with a part met needs nothing more.
- `from`: the requirement that marked each one first, nearest the targets; `weakAt`: the OR or k of n nearest it
  where its chain became one of several.
- A TOWER_* achievement takes its tower's roles, an ENDGAME one its ending's. Achievements marks over all
  its children, fog or not; only its children and levels are filtered by fog.

A list for a goal without roles uses the static roles ([Level roles (viewer)](#level-roles-viewer)).

## The page (viewer)

The page names a Freezer by its model: model A (`GAME_OVER_Freezer_A`, the pod) is a cage, model B
(`GAME_OVER_Freezer_B`, the doorway, `doorway` in `progress.json`) a gate. Panel titles, chips, map tooltips and
the why and leads-to lines use the Freezer's own word. A list of Freezers says "cages" or "gates" when they are all one model, and "cages and gates" when they mix. A closed cage whose cell holds exactly one kind of object (`holds` in `progress.json`) shows a small icon of it on its mark once the map is zoomed in; an open cage shows only that icon and still takes clicks (one the list filter or the Cages switch hides takes none). Once zoomed in, every other object of the shown layer (`objects` in `progress.json`) is drawn as an image one square wide under the marks, at its start position; an object under fog with spoilers hidden draws nothing.

The page has three columns: the sidebar (300 px), the map and the results list, and needs a window 1024 px wide. Before a save is opened a slim bar holds a one-line message, the save folder's path (a click copies it; on Linux the path in Steam's Proton prefix) and one button that opens or reconnects the save folder (or picks a snapshot where the browser has no folder picker).

The sidebar never scrolls; its sections share its height as an accordion (a chevron after a name marks what folds). From the top:

- The header: the brand, the campaign name (a menu of the campaigns and "Open another folder…"), the live dot and reload button (a save read once says "snapshot"), the rank and play time, the percent solved, the No spoilers switch and the hero line (a click centres the map on the hero, or shows the level on the map in a level).
- Goals: Completionist folds open to the areas, each with its solved count over its levels not under fog; with areas on several layers they sit under foldable layer subheads. An area whose pin is under fog is not listed. Picking an area picks Completionist and lists that area's levels, the map framing it. One goal's list is open at a time.
- Find on the map (open by default, its state remembered).
- The save's Stats (with spoilers hidden, only the counters above 0).

Find on the map has a row per kind of mark: cages, gates, signs, teleporters, Antipode pads, warp pads, voice logs, map scrolls, area pins and treasures. A row is left out when its total is 0 and shows what is found of what is not under fog, with the per-layer split. An ending and its stages count only the ending's layer ("Overworld finds", "High finds" or "Low finds"); other goals count every layer.

- An Antipode pad is the MINOR pad a ground or low tower's `teleporter_id` names, drawn with the gold pad icon; the tower's marker stands on it and belongs to its row. A high tower's pad is a MAJOR pad elsewhere, so a high tower keeps its marker in no row. The row also owns the gold rooms' Antipode endpoints (a gold rim once visited); its switch shows or hides both and its count stays about the towers' pads.
- A warp pad is any other MINOR world pad, drawn with the plain pad icon, found once discovered itself.
- An area pin is found once activated and named by its area only then.
- The Signs row counts the signs that open Freezers (rank, tower and gold-room signs, not tower status signs) not under fog. A sign counts when read ([Sign `rank_satisfied`](progression.md#sign-rank_satisfied)); a save without a history has none read. An unread sign is ready when its rule holds (worked out from the rank, towers and gold rooms found). The row reads "read / shown" and " · N to read" while some are ready; on the map a ready sign has its own mark.

A last row, Map uncovered, is a count only: the cleared screens of the layers' primary fog over all their screens (open sea clears too). The other rows have two buttons: the icon shows or hides that kind on the map (remembered in the browser; a hidden kind's row is dimmed), and the name lists the kind's items in the results column, the ones still to do first, each with its icon, its layer when not the map's, its area (outside every area box, the nearest level's area after "≈"; or its tower), the nearest level not under fog ("near <level>") and its state, the done ones behind a Done chip. The heading reads "Voice logs · 3 left"; Back returns to the goal's levels. Only marks not under fog are listed. An item centres the map on its mark and opens its panel where its kind has one (gates, signs, towers for Antipode pads and gold rooms); otherwise the mark is selected on the map (white rim).

The map's buttons float over the map: the layer switch (Overworld | High | Low; only the layers the fog has uncovered; a campaign opens on the hero's layer; a switch happens once the layer's image is decoded), the Reachable switch and the zoom pill. A framed view keeps clear of them.

The Reachable switch washes the cells of each level the save can reach and dims the rest of the layer. A level's cells are its patch: the cells nearest to its door by walking ([data/level-cells.json](datafiles.md#datalevel-cellsjson)). A level is reachable when its door is reached ([Reached levels and ways in](#reached-levels-and-ways-in)). One the save entered or solved is washed more strongly. A soft line runs along the edge of the washed cells. The overlay reads no walk at run time, and the fog clears by the history alone.

Working out a save (a save opened, a change the live folder brings, a campaign picked for the first time) shows a note at the centre of the map, "Working out your save…" or, for a change to the campaign shown, "Updating…", and the live dot turns to a hollow ring. One read of the folder runs at a time; a change made meanwhile waits for the next read. A redraw that reuses earlier progress shows no note.

The map is SVG. The layer's terrain is a repeating CSS background of html elements under the marks' svg, so panning and zooming do not decode the image again and the wrap on both axes needs no copies (`src/map/layer-images.ts`). The overlay is drawn as real elements in the first copy of the map and again in each other copy the view reaches (`src/map/mark-pool.ts`). A layer's image is decoded when first shown, with its one-pixel-per-square thumbnail until then; a move to another layer starts its zoom once the image is decoded. Zoomed in past one image pixel per screen pixel the image is drawn as blocks.

The details of a level, gate, sign or tower open in the results column in place of the list. Back and Escape return to the list, which keeps its scroll position, search and chips; a panel opened from a kind's list returns to that list. Escape resets the map's view when no panel is open. A panel's Previous link goes to the panel it was opened from. A level's chip carries its pad icon; a gate's chip names the Freezer and its place (the area it stands in while shown, else "near" the closest level not under fog, never coordinates). A panel lists no level under fog and counts none.

- Goals: one row per goal ([Goals (viewer)](#goals-viewer)): a mark (a gold check when done, ◆ on the active goal, ○ to do), the name and the count; only the active goal has a progress bar. An ending reads "23 left", or "under fog" when nothing is left to show; Endgame reads "1 / 4" (the Antipode teleporters visited of its Sign's need) until the need is met; the rest read "3 / 16". A trailing `+` says more is under fog. Endgame, Endgame High and Achievements have a chevron that opens their children inline. Picking a tower also sets the tower chip and frames the tower on the map. A ground tower activated whose teleporter is not visited reads "teleporter"; one off Endgame's cheapest plan has a muted name. Treasures are not a goal ([Treasures and gold rooms](progression.md#treasures-and-gold-rooms)).
- The pick is kept per campaign. Picking the active top-level goal stores none, so the default follows progress.

The list shows the picked goal's levels (`goalLevels`, plus `goalSolved` while Solved is on), on every layer; a row names its layer only when it is not the map's.

- Heading: "`goal` · N left" with a "To do | Solved | All" toggle. All lists every level not under fog, on every layer and in any state, by name, with the heading "N levels"; the chips still narrow it. Picking a goal returns to To do.
- Chips: the tower and area chips, each removable.
- Search: while the box has text, the list holds every level not under fog, by name, whatever the goal, toggle and chips say; the heading reads "N levels". The map shows those levels alone. Clearing the box returns to the goal's list.
- "More levels under fog" closes the list while fog hides an unsolved level that serves the goal (`goalLevelsFogged`), or, in a search or under All, any level; never under Solved.
- Groups (To do), each with its count: Play now, Not reachable yet, Locked; Solved lists the solved. Within a group the levels Required as one of several and off the goal's cheapest plans go last.
- Cages your rank opens (To do, below the level groups, for the ending being worked toward only): the closed cages of the rank Signs whose rank the save has reached, none that fog hides or whose Sign it hides; those with a Promesst_Light or a Mirror first, each by layer and place. A row clicks to the cage on the map; one whose Sign is unread adds "read its Sign". The group is not counted in "N left", does not change the active goal, and is left out with a search, a chip or the Solved or All toggle on.
- A row: the level's pad icon ([The map's marks](#the-maps-marks)), role dot, name, what it leads to and its area. The tooltip adds the state, role and why.
- Empty list: "No levels match"; "No solved levels yet."; "`goal` is done."; "Nothing to show yet; more is under fog."; "No levels left for `goal`."
- WikiTactics (from a level's panel): opens the level's WikiTactics page in a new tab, for a level `wikitactics.txt` lists ([data/wikitactics.txt](datafiles.md#derived-data-files)).

The map draws the list's levels. Playable levels on the goal's cheapest plans are drawn above the others, the level the save is in on top. Overlays show what is left for the goal: open Freezers, Freezers Optional for the goal, read signs and found pads, gold rooms, voice logs, map scrolls and treasures are left out unless Solved or All is on. Under Completionist every closed Freezer outside the fog is drawn. A level's or gate's panel names its role for the goal ("One of several for Endgame"), none for a solved level. The floor heights the changed water is compared with come from `data/walk.json` ([data/walk.json](datafiles.md#datawalkjson)).

### The map's marks

Every mark is a rendered image from the page's `assets/` folder ([The marker icons](datafiles.md#the-marker-icons)), drawn as an image element in the pools of `src/map/mark-pool.ts`, so a mark changes by an attribute alone. A mark keeps one size in squares and grows and shrinks with the map, but never spans fewer than about 10 screen pixels: a mark unit is the larger of 0.09 squares and 0.7 pixels.

Every mark, a level's pad included, is its icon on the same dark disc with a thin light rim. The disc is 16 mark units across, the icon fills it but for a margin of one unit, and the rim is one unit wide. A level's disc is 16 units too, 20 for a big marker and 22 for the selected level.

- An overlay mark (cage, gate, sign, teleporter, Antipode pad, warp pad, Antipode teleporter, voice log, map scroll, area pin, treasure) has a rim colour of its own. The disc takes the pointer, shows the tooltip and, for gates, signs and gold rooms, opens the panel. A done or used mark has a grey rim and a dimmed icon (an open cage or gate, a read sign, a heard voice log, a taken map scroll, an activated pin, an acquired treasure shown as an empty plinth, a visited gold room with a gold rim); an undiscovered teleporter, Antipode pad or warp pad is dimmed too. A sign ready to read has an amber rim. The selection's marks have a white rim and glow.
- A tower with a pad is drawn as the Antipode pad's mark and belongs to the Antipode pads row; a tower without one is a diamond.
- A level is its entry pad on a disc with a neutral rim: locked, available or solved. The available pad glows in the colour of the level's group (the level's `glow` in `data/progress.json`); locked and solved pads have no hue. A tower level's pad is a larger shape in the same three states. A level entered but not solved, or open but not reachable yet (dimmed), is the available pad. A level in the picked goal that is not solved has a badge at the pad's lower edge: Required (triangle), One of several (square) or Optional (circle). The selected level has a ring, the levels of its chain a gold or white one, and the others dim while there is a selection. The level the save is in has a pulsing ring.
- A level on the entrance of a closed Freezer has the cage or gate drawn over its pad, and the Freezer's own mark is left out while that level is drawn.
- The hero is the hero icon, also used in the sidebar and list rows.
- Every area name the page prints carries the area's emblem, the game's own, left of the name; an area with none (the hubs and endgame areas) gets a faint empty diamond. A tower's name carries the game's badge for its worlds, the gold one once all its dropdowns are solved; a tower of three or more worlds gets the empty diamond. The map's area labels are plain text and fade out at the closest zoom and two steps out from it.

### The page's words

The page names things as the game and Steam do; where neither has a name it uses a plain word, never an internal
type or enum name ([Localisation and display names](gamedata.md#localisation-and-display-names)).

| Thing                  | The page says                                                                                                                                     | From                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Areas                  | "The Antipode", "Antipode High", "Antipode Low", "Crossroads High", ...                                                                           | the English localization's `area_*` text, read by the data build (`display` in `data/progress.json`)                          |
| Ranks                  | Visitor, Egressant, Pusher, Arranger, Intrepid, Sokoban                                                                                           | the localization's `rank_*` text                                                                                              |
| Achievements           | "Antipode HxM", "High Mirrors", "Low SxB", "Gold HxB", "Ascend", "Endgame High", "Completionist", "Beamcasters", ...                              | Steam's English achievement names, a table by the `Achievement` value name                                                    |
| Endings                | "Endgame", "Endgame High", "Endgame Low"                                                                                                          | the names of their achievements                                                                                               |
| Worlds                 | Heroes, Mirror Isles, Skipping Stones, Beamcasters; a pair by its letters joined by x ("HxB", B for Beamcasters)                                  | Steam's achievement names; an area the localization calls "The Mirror Isles" is "Mirror Isles"                                |
| Towers                 | "Antipode HxM", "High Heroes", "Low HxM"                                                                                                          | Steam's name of the tower's achievement; "tower" is the plain word for the kind, since the game has none                      |
| Levels                 | `simplify_skipping`                                                                                                                               | the level name: levels have no display names                                                                                  |
| Level sets, voice logs | not named: a voice log is "Voice log"                                                                                                             | the level data's names are internal and some name a layer or an ending                                                        |
| Layers                 | Overworld, High, Low; in a sentence "from High", "the way up to High", "the way down to Low"                                                      | plain words: the game only qualifies places as "High" and "Low"                                                               |
| Gold rooms             | "Antipode teleporter"                                                                                                                             | a ground tower's pad and its endpoint in The Antipode; Steam's descriptions call the pad "the HxM teleporter to the Antipode" |
| Reading a sign         | "Read the sign", "Ready to read"                                                                                                                  | plain words: the game has no name for the act                                                                                 |
| The rest               | gate, teleporter, voice log, map scroll, area pin, treasure, sign, dropdown, Antipode pad (the pads that lead to and from the Antipode), warp pad | plain words; "Teleporters" is also the game's                                                                                 |

With spoilers hidden, the rules in [The spoiler model (viewer)](#the-spoiler-model-viewer) decide whether a thing is
named at all.

## Level areas (viewer)

The game stores no level → area link ([Areas](state.md#areas)). The data build (`npm run data:areas`) applies the game's
current-area rule at each Level_Entry's position, with every pin counted as activated: `data/level_areas.json`, and per
level `area` in `data/progress.json`.

- Boxes: Markers with `script_name` `local_area`, a target that is an Area_Pin, not a point marker, non-zero extents. A point is inside when, after moving x and y to the copy nearest the box (period 190 × 156, or the fast-travel box for boxes at z ≥ the threshold 74.66) and rotating by the inverse orientation, |local / scale| − extent ≤ 0 on every axis.
- The containing box with the strictly lowest `float_parameter` wins; on a tie the first in package record order, which is the game's Marker array order ([Areas](state.md#areas)).
- Some entries lie in boxes of more than one area (the cross-area overlaps and the ties above). In the game their named area depends on which pins are activated. They carry `overlap`: every area box holding them, with its `float_parameter`, in record order. The viewer names each by the save's activated pins (`levelAreaOf`): the box with the lowest `float_parameter` among those whose pin is activated, the first on a tie; with none of them activated, the area from the all-pins rule above.
- Some entries are outside every box. The game names no area for them; the fallback below (`nearest_*`) is the viewer's own grouping.
- A level outside every box gets a fallback: the box with the smallest outside distance (max over axes), then the lower `float_parameter`, then record order.
- The pins `area_g_crossroads`, `area_u_antipode_low`, `area_g_heroes_together`, `area_s_beam_way`, `area_g_exit`, `area_s_skipping_way` and `area_s_heroes_way` have no level.
- The game's own grouping is the level set ([Levels, level sets and saves](world.md#levels-level-sets-and-saves)), not the area. Level sets cross areas by design.

## The spoiler model (viewer)

With "No spoilers" on (the default), nothing under fog shows: no names, counts, totals, layers, labels or mechanic
names. Fog is the game's own ([Fog of war](state.md#fog-of-war)), read from the save.

- A level is hidden unless it is solved, the level the save is in, revealed by the viewer (a click on its fog chip, for the visit), or not under fog: its Level_Entry's fog region on its layer is cleared and it is outside every FILLED fog box. Without fog data only entered and solved levels count as uncovered.
- A tower is hidden while not activated and its position is under fog. A tower status sign of a hidden tower is hidden.
- An area is named only while its pin is activated (the game names an area only then). A level shows its area only while that area is shown. A Freezer is named by the area it stands in (by the box rule over activated pins), else by "near" the closest level not under fog.
- Totals (Freezers, MAJOR pads, gold rooms, treasures, voice logs, map scrolls, signs) list only things not under fog, or already found (gold rooms only once visited). Per-layer splits ("Overworld a / b · High c / d") cover only the layers the fog has uncovered.
- A sign in a plan follows the same fog rule as the sign on the map: its step is left out of the plan's steps and counts
  while the sign is under fog.
- The map covers fogged squares with opaque rectangles in the fog colour over the layer image, and leaves them out of the Reachable overlay, so nothing the fog hides shows. A FILLED fog box is drawn over its whole footprint, though it hides only its own heights: a mark uncovered below it, such as the sky hub's under the room above it, is drawn over the fog with a dark halo, like a mark revealed inside fog.
- An unearned achievement is hidden when what earns it is hidden: all its levels are hidden, its tower is hidden, or its layer has no cleared fog (ASCEND: the sky; DESCEND: the underworld). The sidebar and the plans share this rule.
- Endings go by their achievements' names ("Endgame", "Endgame High", "Endgame Low"). An ending's achievement is hidden by the endings' order alone: it is shown (in the ladder and the achievements) only once every ending before it is earned, so the ladder never counts the endings ahead.
- A rank sign names its rank only while the achievement that gives that rank (an ending, ASCEND or DESCEND) is shown; otherwise it asks for "A higher rank".
- Gold rooms are known only once visited: until then a gold room's endpoint is a pad like any other, so the totals, the map's gold-room rings and the plan steps leave unvisited ones out. One exception: an activated ground tower under Endgame names the step onto its own pad ("Antipode teleporter · Antipode HxM"), since Steam's description of that tower's achievement names that teleporter.
- A totals row whose remaining things are all under fog says "None left outside the fog", which doesn't say whether the fog holds any.
- Goals ([Goals (viewer)](#goals-viewer)): every count is over what fog leaves (an ending's plan steps, the towers and achievements not hidden, the levels not under fog), and a count with more under fog carries a `+`. Endgame lists the ground towers not hidden; its Antipode teleporter count is the visited ones (known, as the totals know them) of the Sign's need, shown only while that Sign is not under fog, else its plan steps. A goal with nothing to show says "Nothing to show yet; more is under fog." No `leadsTo` names a fogged level, gate, tower or hidden achievement, and its route count leaves out the routes under fog.
- A sky Way ([Level needs and pad routes](#level-needs-and-pad-routes)), as a plan step and as a stage of Endgame High, shows with the tower it leads to, so it is left out while that tower is under fog, and listed once the tower is, although its Sign may still be under fog. It names its area while the area is named (the same rule as the Completionist area list; the plan step links to it on the map); else it reads "Way to the High Mirrors sign", with the tower's name. The stages of Endgame High and Endgame Low that are areas or levels follow the area and level rules above, and Endgame Low is listed only once Endgame High is earned.
- Plan steps without a chip of their own: a gold room shows only once visited; the way onto a layer only once that layer has cleared fog; ASCEND and DESCEND only while their achievement is not hidden. A level's "why" names a layer only once it has cleared fog; else it reads "not reachable from where you have been".
- The page source may hold spoilers: only what the page shows must be spoiler-free.
