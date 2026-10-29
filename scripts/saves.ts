// The game's save folder: $SOKO_SAVES, else %USERPROFILE%\Saved Games\Order of the Sinking Star on Windows; elsewhere
// the same folder in the Proton prefix of the first Steam library that has one
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { APP_ID, GAME_NAME, steamLibraries } from './lib/steam.ts';

function protonSaves(): string | null {
    for (const library of steamLibraries()) {
        const user = join(library, 'steamapps', 'compatdata', APP_ID, 'pfx', 'drive_c', 'users', 'steamuser');
        const path = join(user, 'Saved Games', GAME_NAME);
        if (existsSync(path)) return path;
    }
    return null;
}

export const savesDir = () =>
    process.env.SOKO_SAVES ||
    (process.platform !== 'win32' && protonSaves()) ||
    join(homedir(), 'Saved Games', GAME_NAME);
