// Shared locations: the project root and its data/ folder, and the game and save folders.
//
// Game folder: --game, else $SOKO_GAME, else found in the Steam libraries (steam.ts), else the default Steam path.
// Saves: saves.ts.
import { existsSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import { savesDir } from '../saves.ts';
import { GAME_NAME, steamLibraries } from './steam.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

let gameFolder: string | null = null;

function findGame(): string {
    if (process.env.SOKO_GAME) return process.env.SOKO_GAME;
    let path = '';
    for (const library of steamLibraries()) {
        path = normalize(join(library, 'steamapps', 'common', GAME_NAME));
        if (existsSync(path) && statSync(path).isDirectory()) return path;
    }
    return path;
}

export function setGame(path: string | undefined): void {
    if (path) gameFolder = resolve(path);
}

// A path inside the game folder
export function game(...parts: string[]): string {
    gameFolder ??= findGame();
    return join(gameFolder, ...parts);
}

// A path inside the saves folder (campaigns are its subfolders, `default` by default)
export function saves(...parts: string[]): string {
    return join(savesDir(), ...parts);
}

// A path inside data/ (generated and dumped data)
export function data(...parts: string[]): string {
    return join(ROOT, 'data', ...parts);
}

type GameOption = { game: { type: 'string' } };
type CommandLine<Options extends ParseArgsOptionsConfig> = ReturnType<
    typeof parseArgs<{ options: GameOption & Options; allowPositionals: boolean }>
>;

// Parses the command line, with --game added to the options a script takes, and applies the game folder. The values
// have the types the options declare.
export function parseCommandLine<const Options extends ParseArgsOptionsConfig>(
    options?: Options,
    allowPositionals?: boolean,
): CommandLine<Options>;
export function parseCommandLine(options: ParseArgsOptionsConfig = {}, allowPositionals = false) {
    const { values, positionals } = parseArgs({
        options: { game: { type: 'string' }, ...options },
        allowPositionals,
    });
    setGame(values.game);
    return { values, positionals };
}
