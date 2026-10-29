// The Steam libraries on this machine: the Steam root (the registry on Windows; ~/.steam/steam, ~/.local/share/Steam
// or the Flatpak's on Linux), every library its libraryfolders.vdf lists, then the default Windows path.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const GAME_NAME = 'Order of the Sinking Star';
export const APP_ID = '499170';
const DEFAULT_STEAM = 'C:\\Program Files (x86)\\Steam';

function steamRoots(): string[] {
    if (process.platform !== 'win32') {
        const home = homedir();
        return [
            join(home, '.steam', 'steam'),
            join(home, '.local', 'share', 'Steam'),
            join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
        ].filter((root) => existsSync(join(root, 'steamapps')));
    }
    try {
        const output = execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        const match = /SteamPath\s+REG_SZ\s+(.+)/.exec(output);
        if (match) return [match[1].trim()];
    } catch {
        // no Steam registry key (Steam is not installed)
    }
    return [];
}

export function steamLibraries(): string[] {
    const libraries: string[] = [];
    for (const steam of steamRoots()) {
        libraries.push(steam);
        const vdf = join(steam, 'steamapps', 'libraryfolders.vdf');
        if (existsSync(vdf)) {
            const text = readFileSync(vdf, 'utf8');
            for (const match of text.matchAll(/"path"\s+"([^"]+)"/g)) libraries.push(match[1].replaceAll('\\\\', '\\'));
        }
    }
    libraries.push(DEFAULT_STEAM);
    return libraries;
}
