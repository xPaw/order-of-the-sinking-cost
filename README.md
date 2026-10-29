# Order of the Sinking Cost

An unofficial, spoiler-free progress viewer for *Order of the Sinking Star*. Point it at your save folder and it tells
you what is left to do, what to play next and how to get there, without showing anything you haven't uncovered yet.

> **This project is 100% AI-made.** Claude (Anthropic), working in Claude Code, wrote every line of code and every doc.
> It also did all the reverse engineering, purely from the shipped game, with no source code or official documentation:
> - it decompiled the game binary in IDA to work out the save and data formats, the progression rules and mechanics
>   like dragon fire;
> - it checked each finding against real save files.
>
> A human directed, reviewed and tested the work, but wrote none of it. Expect the occasional confidently wrong guess
> about game mechanics; reports are welcome.

## What it shows

Open the viewer at [sinkingstar.xpaw.me](https://sinkingstar.xpaw.me/), then drag your save folder onto the page or
use **Open save folder**. The folder is `%USERPROFILE%\Saved Games\Order of the Sinking Star`. On Linux the game runs
under Proton, and the folder is in its prefix, by default
`~/.local/share/Steam/steamapps/compatdata/499170/pfx/drive_c/users/steamuser/Saved Games/Order of the Sinking Star`.
With the Flatpak of Steam, `~/.local/share/Steam` is `~/.var/app/com.valvesoftware.Steam/.local/share/Steam`, and a game
in another Steam library has its prefix in that library's `steamapps/compatdata`.

- **Goals**: a ladder of what is left: the three endings in order, then the achievements (the towers
  among them) and Completionist, each with a count ("23 left", "3 / 16"). The first goal not done is the current one, and the list
  starts on it.
- **The list**: the levels the selected goal still needs. Playable ones come first, then the ones you can't reach yet,
  then the locked ones, ranked by what they open toward the goal and then by distance from your hero. Each says what it
  leads to, such as "opens ice cage Heroes and Mirrors" or "unlocks greenhouse". Levels that are only one of several
  routes and not on the cheapest one fold away under "N more on other routes". Chips narrow it by state, tower and
  area.
- **Unlock paths**: click anything locked (a level, tower, ice cage, ice gate or sign) and it shows the numbered chain
  of levels to solve first, on the map and in the panel.
- **Reasons**: a level you can't reach says why, for example "behind ice cage · Heroes and Mirrors",
  "may need Mirrors", "needs the way up to High", "from High" or "no known route".
- **Map**: the overworld's ground, sky and underworld, with your fog of war, your hero and the current level. It
  shows the list's levels, by state or by their role for the goal (Required, One of several, Optional), and what is
  left for the goal: towers, ice cages and gates with the signs that open them, teleporters, gold rooms, voice logs,
  map scrolls and treasures.
- **Sidebar**: the goals ladder, with the Antipode towers and teleporters toward Endgame and the sky towers toward Endgame High; ice cages and gates, teleporters, voice logs and treasures to find; progress per area; and stats the game tracks (rank, play time and more).
- **Live**: with a live folder it re-reads the save every few seconds while you play, so you can keep it on a second
  screen.

**Spoilers:** with No spoilers on, which is the default, nothing under your fog of war appears anywhere. That covers
names, counts, totals, area labels, layers, tower names and achievements, as well as the mechanics named in tooltips.
The fog comes from your own save, exactly as the game reveals it.

Everything runs locally in your browser. Your save is only read, never uploaded or changed. The page contains no game
files: only data derived from the game, such as level names, requirements and a top-down map.

## How it works

- **Your save:**
  - `Status.sokoban_status` gives each level's solved/entered flags, your rank, the ice cages and gates opened, the
    achievements and the level you're in.
  - `overworld.history` is the game's undo log. Replaying it gives the overworld's current state (gates, rocks,
    lilies, water, monsters, your skill) and every position your hero has stood on.
- **Level state:** each level is solved, partly solved, entered, unlocked, not reachable yet or locked. The unlock
  rules (level requirements, "any of" requirements, ice cages and gates, signs that need a rank, tower or gold rooms,
  dropdowns, towers) come from the game's level data and were checked against the game's own code.
- **Required or Optional:** first decided once, at build time, by walking the world from a new game's start and
  opening the ice cages and gates it meets, round by round. A level is marked Optional only when the walk proves you
  can finish without it. When in doubt, it stays Required. Per goal, a level is then Required when every route to the
  goal needs it, One of several when only some do, and Optional when none does.
- **Reachability:** a flood fill over the overworld's 3D grid. It models:
  - walls and floors, rocks at their current places, lilies (on a river, along the whole loop they drift), fences;
  - gates driven by switches, once rocks or other objects can be pushed onto every switch, and ice cages and gates;
  - water surfaces, where a hero drowns unless something holds the hero up at the surface;
  - elevators, and teleporters you have discovered;
  - falls from sky ledges into the places below them, so a level reached only that way says it needs the sky;
  - dragon fire and goblin attacks, which hold a hero with the Protection skill (from wardrobes) over water.

  It starts from everywhere your hero has stood, every level you've entered, every activated area pin and every
  discovered teleporter. Anywhere you've been counts as reachable, however you got there.
- **Goals and unlock paths:** a search over the AND/OR graph of levels, ice cages and gates, signs, towers, gold rooms
  and ranks gives every unlock path; each goal's levels and roles are read off it. Requirements can form loops, and the
  search handles them.

The details are in [docs/](docs/):
- [WORLD.md](docs/WORLD.md), [ENTITIES.md](docs/ENTITIES.md), [MOVEMENT.md](docs/MOVEMENT.md) and
  [SKILLS.md](docs/SKILLS.md): how the game is put together;
- [PROGRESSION.md](docs/PROGRESSION.md) and [STATE.md](docs/STATE.md): progression and the saved state;
- [VIEWER.md](docs/VIEWER.md): reachability and the viewer's model;
- [SAVES.md](docs/SAVES.md), [GAMEDATA.md](docs/GAMEDATA.md) and [DATAFILES.md](docs/DATAFILES.md): the save and data
  formats;
- [UNCONFIRMED.md](docs/UNCONFIRMED.md): open questions.

## Limitations

- **Reachability is approximate.** The model walks, falls, takes elevators and pads, opens ice cages, ice gates and
  switch gates, and follows a few planned tricks: a rock pushed into water as a bridge, a skipping stone the Wizard
  swaps onto (riding a lily too), a magic mirror alone in its room, and the Beamcaster powers a hero standing in a beam
  uses (walking through walls, jumps, double steps, squeezing past fences, opening a gate). It leaves out:
  - **Pushing for real:** a push is checked one cell deep, but the pushed thing stays where it is. No pushing rows,
    pulling, charming, transmuting or swapping with a dragon.
  - **Mirrors turning things:** fire, beams and the Wizard's line stop at a mirror instead of turning, so no beam
    lifts. Magic mirrors work only alone in their room.
  - **Moving things:** a lily on a river counts as everywhere on its loop at once, so timing is not checked; rovers,
    goblins that move, rivers that change course, gates shutting on whatever stands in them.
  - **The endings' way in:** the first way into the sky and into the underworld are not known in full. The plans
    assume the sky after rank 1 and the underworld after the sky, and take the endgame rooms' gates from the level
    data.

  A level the model can't reach shows under "Not reachable yet" with its reason; that doesn't mean it is impossible.
  Required levels are listed whatever the model thinks of them.
- **Required leans Required:** if the model misses a route, a level looks Required rather than Optional. It errs the
  other way only where the model walks somewhere the game doesn't allow. A tower needs only some of its levels, so its
  levels read "One of several".
- **Live updates:**
  - In Chrome and Edge, a folder opened with the picker or dragged onto the page stays live.
  - Inside an embedded page the folder picker is blocked, so drag the folder onto the page instead.
  - In Firefox and Safari a save loads as a one-time snapshot; reopen it to update.
- **Game updates:** an update that changes the save formats or the level data
  needs the data pipeline re-run, and possibly reader changes.
- **Names:** level names are the game's internal ones. Area names come from the game's English text.
- **Desktop only:** it works in small desktop windows (down to about 820 px wide) and with trackpads and touch, but it
  isn't laid out for phones.

## Building

The page is built from `src/` with [Vite+](https://viteplus.dev/), installed locally, into `dist/`:
`index.html` with its script, stylesheet and images in `assets/`. It needs data generated from your own
copy of the game with `npm run data`, and the map images in `src/assets/`. See
[scripts/README.md](scripts/README.md) for the pipeline and for `npm run dev`, `npm run build`, `npm test`,
`npm run typecheck`, `npm run lint` and `npm run deploy`.

## License

[MIT](LICENSE)
