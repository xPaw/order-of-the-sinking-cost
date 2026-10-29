# Data scripts

Run the scripts with the npm scripts below. Generated data lands in `data/` (not committed, apart from
`data/schema.json`); the built page is `dist/index.html` with its script, stylesheet, source map and images in `dist/assets/`, each named with a
hash of its content. The page source is in `src/`. The map images are `src/assets/map-<layer>.avif` and the marker icons
are in `src/assets/icons/`. `public/_headers` gives the files in `assets/` a cache lifetime of a year.

`npm install` sets up Vite+. Then `npm run build` builds the page, `npm run dev` serves it with live reload, `npm test`
runs the tests, `npm run typecheck` type-checks the TypeScript modules, `npm run lint` lints and `npm run fmt` formats
(`npm run fmt:check` only checks). The scripts import the page's TypeScript modules directly, which needs Node 24 (its
built-in type stripping).

Game folder: `--game DIR`, else `$SOKO_GAME`, else the Steam install (the registry on Windows; `~/.steam/steam`,
`~/.local/share/Steam` or the Flatpak's on Linux, and every library in its `libraryfolders.vdf`). Saves: `$SOKO_SAVES`,
else `%USERPROFILE%\Saved Games\Order of the Sinking Star` on Windows, or that folder in the Proton prefix
(`steamapps/compatdata/499170/pfx/drive_c/users/steamuser/`) of the first Steam library that has it on Linux.

## Pipeline, in run order

| # | Script | Reads | Writes | npm script |
|---|---|---|---|---|
| 1 | the schema exporter (not in this repository) | `sinking_star.exe` in IDA, entity type list | `data/schema.json` | see below |
| 2 | `build-levels.ts` | `data/levels.package` (game), `data/schema.json` | `data/levels.json`, `data/level_entities/` | `npm run data:levels` |
| 3 | `build-areas.ts` | `data/levels.package` (game), `data/strings/en.localization` (game) | `data/level_areas.json` | `npm run data:areas` |
| 4 | `build-fog.ts` | `data/levels.package` (game), `data/schema.json` | `data/fog.json` | `npm run data:fog` |
| 5 | `build-world.ts` | `data/levels.package` (game), `data/schema.json` | `data/world.json` | `npm run data:world` |
| 6 | `build-map.ts` | `data/levels.json`, game `data/levels.package` | `data/map.json` | `npm run data:map` |
| 7 | `build-progress.ts` | `data/levels.json`, `data/level_areas.json`, `data/fog.json`, `data/map.json`, `data/world.json`, game `data/levels.package` | `data/progress.json` | `npm run data:progress` |
| 8 | `build-walk.ts` | `data/progress.json` (hashes `data/world.json` too) | `data/walk.json` | `npm run data:walk` |
| 9 | `vite.config.ts` | `src/`, `public/_headers`, `data/schema.json`, `data/progress.json`, `data/walk.json` | `dist/index.html`, `dist/_headers`, `dist/assets/` | `npm run build` |

`build-icons.ts` stands alone, like the map images: `npm run icons` renders the marker icons from the game's 3D models
into `src/assets/icons/` (committed, not part of `npm run data`). It reads the game's render assets, the overworld
entities in `data/levels.package` and `data/schema.json`, and needs ImageMagick (`magick`, with AVIF support) on the
PATH or in WSL to write the AVIFs. `--only <name,...>` renders some icons, `--png <dir>` writes PNG previews to a folder
instead (no ImageMagick needed, `src/assets/icons/` untouched) and `--size <px>` sets the preview size. See
[The marker icons](../docs/DATAFILES.md#the-marker-icons).

`npm run data` runs steps 2 to 8 in order. `build-fog.ts` also takes a campaign folder and then prints a report on
that save: `npm run data:fog -- "<campaign folder>"`.

Step 1 is needed only when the game binary changes. The exporter runs in IDA on the game binary and is not part of this
repository ([Reading the schema out of the binary](../docs/GAMEDATA.md#reading-the-schema-out-of-the-binary)); it
takes the entity type list that `node scripts\build-levels.ts --types-json <file>` writes.

The save and diff-blob readers are the page's own modules (`src/reader.ts`, `src/status-file.ts`,
`src/history-file.ts`, `src/blob.ts`), and so is the walk model (`src/walk/`, `staticRoles()` in
`src/model/static-roles.ts`). `build-walk.ts` stores what the walk gives on the level data alone, the static roles and
the map's floor heights, in `data/walk.json`. Nothing it imports may import `walk.json`, so a fresh `npm run data` can
write it.

## Output

Every output is deterministic, so a regeneration changes only what the game files or the scripts changed. The zlib
streams in `world.json` and `progress.json` differ between zlib implementations, so compare them inflated.

## Checks and tools

- `npm test`: the tests in `tests/`. The ones on a real save read the `default` campaign of the folder `$SOKO_SAVES`
  names (read-only) and are skipped when it is not set. `tests/walk-data.test.ts` fails when `data/walk.json` is stale; run
  `npm run data:walk` after a change to the walk.
- `npm run docs:check`: every link in `docs/*.md` reaches a file and a heading, no page has two headings with the same
  anchor, and nothing cites a section by number.
- `npm run deploy`: builds the page and uploads `dist/` to Cloudflare Workers as static assets, served at
  `https://sinkingstar.xpaw.me/` (`wrangler.jsonc`). It needs Wrangler logged in to the account that holds the
  `xpaw.me` zone.
- `npm run dev`: serves the page at `http://127.0.0.1:8765/`, with `/saves/` mapped read-only onto the saves
  folder; the map images and icons are served from `src/assets/`.
- `npm run dump:model -- <campaign|save folder|--demo> <out.json>`: everything the page's model computes for a save, as
  stable JSON. Compare dumps from before and after a refactor that should not change behaviour.
- `node scripts/walk-fingerprint.ts <input> <outFile>`: a canonical fingerprint of everything the walk computes for one
  input: the reached cells, the pockets, leads and `from` lists, the pad linkage, the level states, way-in gates, next
  steps and plans. `<input>` is a campaign folder or the name of a campaign in the saves folder, `--fresh` (a new
  campaign walked from its start), `--no-history` (the level data alone, every pad on) or `--static-roles`. The file
  holds a short hash per field and the field's value; two runs on the same input give the same bytes. `node
  scripts/walk-fingerprint.ts --diff <a> <b>` names the fields that differ and where, and exits 1 when there are any.
  Write a fingerprint before and after a change to the walk that should alter no answer and diff them.
  `tests/walk-exact.test.ts` does the same for the fresh campaign and two small changes of it against hashes in
  `tests/walk-exact.expected.json`; regenerate them with `UPDATE_WALK_EXPECTED=1 npx vp test run
  tests/walk-exact.test.ts` after an intended change of the walk or new game data.
