// Finds a row of the progress data by name or pid; a row the data lacks fails the build with the caller's prefix
import type { Area, Freezer, ProgressLevel, Sign, Teleporter } from '../../src/types.ts';

function foundOrThrow(index: number, prefix: string, what: string): number {
    if (index < 0) throw new Error(`${prefix}: no ${what}`);
    return index;
}

export function levelByName(levels: ProgressLevel[], name: string, prefix: string): number {
    return foundOrThrow(
        levels.findIndex((level) => level.n === name),
        prefix,
        `level ${name}`,
    );
}

export function areaByName(areas: Area[], name: string, prefix: string): number {
    return foundOrThrow(
        areas.findIndex((area) => area.local_area_name === name),
        prefix,
        `area ${name}`,
    );
}

export function freezerByPid(freezers: Freezer[], pid: number, prefix: string): number {
    return foundOrThrow(
        freezers.findIndex((freezer) => freezer.pid === pid),
        prefix,
        `Freezer ${pid}`,
    );
}

export function signByPid(signs: Sign[], pid: number, prefix: string): number {
    return foundOrThrow(
        signs.findIndex((sign) => sign.pid === pid),
        prefix,
        `Sign ${pid}`,
    );
}

export function padByPid(teleporters: Teleporter[], pid: number, prefix: string): number {
    return foundOrThrow(
        teleporters.findIndex((pad) => pad.pid === pid),
        prefix,
        `pad ${pid}`,
    );
}
