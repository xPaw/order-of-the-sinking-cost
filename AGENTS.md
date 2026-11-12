# Working on this repository

Rules for anyone changing the viewer, human or agent. How the game and the viewer work is in
[docs/readme.md](docs/readme.md).

## Reach and the level table

- The page decides which levels are reached from the curated level table, `scripts/lib/level-table.ts`; it runs no
  walk. Fill a reachability gap by fixing a table row, never by adding walk mechanics. The walk runs only at build time
  and in tests.
- The maintainer's in-game report beats the model: fix the row, never argue from the model. A level whose cage, gate
  or rock opens something on the only path to a goal is required. Rows come from the maintainer's account, player
  histories or level data, never from third-party solutions.
- A gate the maintainer names as `gate=<pid>` becomes its opener in the table: the level, or the Sign for a Sign-only
  Freezer (look it up in `data/progress.json`). The table has no Freezer needs. A Freezer with two openers inside an
  either-or becomes two groups.
- Every sky drop goes through a hole: `drop` on the row. A level reached past a dropped level or a Freezer, with no hole
  of its own, uses `needs` without `drop`. A drop that only moves an object on the way is not the level's `drop`.
- Enter a need on the earliest level the game requires before it, and let the chain carry it, unless it covers only the
  last stretch (a Cage between the two levels, a remote unlock).
- Keep needs as named, even when one implies another. A row comes after the rows it needs within its `// Section`; a
  loop is always wrong. `needs: []` only for levels reachable from the start. Needs may name levels, Signs and Rocks to
  smash (`{rock: pid}`).
- A pushable with no reset Spawner can still move; never prune pushes by reset coverage.
- After a table edit, run each of these in order:

```
npm run data:progress
npm run data:walk
npm run data:cells
npx vp test --reporter=default
```

## The page

- Nothing under fog may show: names, counts, totals, layers, labels or mechanic names in tooltips. Spoilers in the page
  source are fine; only what the page shows must be spoiler-free.
- Endings use their Steam achievement names, each listed only once the one before it is earned. A gold room is known
  only once visited. Treasures are not a goal; their count sits in "Find on the map".
- Every label is the game's own word (its localization strings) or the Steam achievement name, never an internal
  entity, field or file name. Where the game has no word, use a plain descriptive one. Raw level ids are fine, but
  with No spoilers on, an unsolved level's id is hidden until it is clicked.
- The default list is what is left for the goal. The goals ladder runs the three endings, towers, achievements, then
  Completionist; the first unfinished goal is active.
- The map wraps like the game. The wheel zooms with easing, the trackpad pans and pinches. The closest zoom shows one
  game screen; the farthest is about the in-game TAB map. Escape resets the view; there is no fit or reset button.
- Area labels are drawn at their anchor whenever it is on screen; never clamp or move them.
- Ice cages and ice gates share one marker. No wardrobes or doors on the map. Icons are rendered from the game's own
  models (`npm run icons`).
- Desktop only, 1024 px and wider. The sidebar's panels shrink and scroll inside; the sidebar itself does not scroll.
- The page loads nothing external: no CDNs, system fonts only. Game files and copyrighted assets stay out, apart from
  the captured map images and the rendered icons.
- Frames must stay inside the display's refresh rate on click, pan, zoom and scroll. Measure the worst case (spoilers
  shown, Completionist, every overlay on) with matched before/after traces. Precompute at build time; never hide slow
  work behind deferral.

## Code

- TypeScript in the Google TypeScript style, written plainly. One reader per file format, shared by the page and the
  scripts.
- Never write to the game's save folder or install folder; the one exception is a map capture, which may let the game
  write its screenshots and patch the exe (restored by verifying the game files). Tests never read a real save; they
  build campaigns in code. No pipeline step may need a player's saves.
- To check the maintainer's save, copy `Status.sokoban_status` and `overworld.history` from the `default` campaign into
  `<scratch folder>/default/` in one step and read that copy (`SOKO_SAVES=<scratch folder>`); the live save changes during play. Re-read a
  file that fails to parse; it may be mid-write.

## Talking about the game

- Ask the maintainer only about places their save has reached (check its fog first).
- Name every place by its closest level and area, never by coordinates. Chat has no spoiler rules; only the page does.

## Docs

- docs/ describes the game in its own terms (Jai type and field names, enums) and holds enough to rebuild the viewer's
  map and logic. Research only what a viewer feature needs.
- Short and evergreen: no counts that go stale, no history, no verification notes. An uncertain point carries an inline
  "(inferred)" or "(not checked)".
- Doc files are lowercase. `npm run docs:check` checks the links; `npm run fmt` formats the markdown.

## Repository

- Only `data/schema.json` and `data/wikitactics.txt` are committed from `data/`; everything else there is generated or
  local.
- The one third-party link is WikiTactics, with `data/wikitactics.txt` copied from joric/ootss.
- Deploy (`npm run deploy`) only when the maintainer says so.
