// The objects of the world and the name of the icon that shows each, and which of them a Cage (Freezer) holds.
// build-progress.ts writes the names to its data and build-icons.ts renders them, so both take them from here.
import type { Position, Schema, World } from '../../src/types.ts';
import { modulo } from './math.ts';

/** One kind of object in a cell: its icon name, the pid of a placed entity of that look, its entity type and the cell's world position. */
export interface HeldObject {
    name: string;
    pid: number;
    type: string;
    p: Position;
}

/** A Cage: its pid and world position. */
export interface Cage {
    pid: number;
    p: Position;
}

const MOVABLE_TYPES = ['Gem', 'Promesst_Light', 'Mirror', 'Rover', 'Friendly_Dragon'];
const MOVABLE_NAMES = ['gem', 'light', 'mirror', 'rover', 'friendly-dragon'];
const SIDE_NAMES = ['east', 'north', 'west', 'south'];

// The icon name of a Promesst_Light: its colour and the direction of its beam, none off the grid axes
function lightName(color: string, side: number, up: number, down: number): string | null {
    if (up) return `held-light-${color}-up`;
    if (down) return `held-light-${color}-down`;
    if (side < 0) return null;
    return `held-light-${color}-${SIDE_NAMES[side]}`;
}

// The held objects by cell "i,j,z": every existing Rock, movable, Monster, Wardrobe, Tree and Lily
function objectsByCell(world: World, schema: Schema): Map<string, Map<string, HeldObject>> {
    const colorNames = new Map<number, string>();
    for (const [name, value] of schema.enums.Promesst_Power.values) colorNames.set(value, name.toLowerCase());
    const facings = new Map(world.mirror_facings.map(([pid, turns, shape]) => [pid, { turns, shape }]));
    const magic = new Set(world.magic_mirrors.map((row) => row[0]));
    const lights = new Map(world.lights.map((row) => [row[0], row]));
    const skippable = new Set(world.skippable);
    const mirrorable = new Set(world.mirrorable);

    const [cornerX, cornerY] = world.grid.corner;
    const byCell = new Map<string, Map<string, HeldObject>>();
    const add = (
        i: number,
        j: number,
        z: number,
        exists: number | undefined,
        held: Omit<HeldObject, 'p'> | null,
    ): void => {
        if (exists === 0 || held === null) return;

        const key = `${i},${j},${z}`;
        const objects = byCell.get(key) ?? new Map<string, HeldObject>();
        if (!objects.has(held.name)) objects.set(held.name, { ...held, p: [cornerX + i, cornerY + j, z] });
        byCell.set(key, objects);
    };

    for (const [pid, i, j, z, exists] of world.rocks) {
        if (skippable.has(pid)) add(i, j, z, exists, { name: 'held-skipping-stone', pid, type: 'Rock' });
        else if (mirrorable.has(pid)) add(i, j, z, exists, { name: 'held-crystal', pid, type: 'Rock' });
        else add(i, j, z, exists, { name: 'held-rock', pid, type: 'Rock' });
    }
    for (const [pid, i, j, z, kind, exists] of world.movables) {
        const type = MOVABLE_TYPES[kind];
        let name: string | null = null;
        if (kind === 1) {
            const light = lights.get(pid);
            const color = light ? colorNames.get(light[8]) : undefined;
            if (light && color) name = lightName(color, light[4], light[5], light[6]);
        } else if (kind === 2) {
            const facing = facings.get(pid);
            if (facing) {
                name = `held-mirror-${facing.turns}-${facing.shape}`;
                if (magic.has(pid)) name += '-magic';
            }
        } else if (type) {
            name = `held-${MOVABLE_NAMES[kind]}`;
        }
        if (name && type) add(i, j, z, exists, { name, pid, type });
    }
    for (const [pid, i, j, z, kind, exists] of world.monsters) {
        if (kind === -1) add(i, j, z, exists, { name: 'held-goblin', pid, type: 'Monster' });
        else if (kind >= 0) add(i, j, z, exists, { name: 'held-dragon', pid, type: 'Monster' });
    }
    for (const [pid, i, j, z, , , exists] of world.wardrobes) {
        add(i, j, z, exists, { name: 'held-wardrobe', pid, type: 'Wardrobe' });
    }
    for (const [pid, i, j, z, exists] of world.trees) add(i, j, z, exists, { name: 'held-tree', pid, type: 'Tree' });
    for (const [pid, i, j, z, exists] of world.lilies) add(i, j, z, exists, { name: 'held-lily', pid, type: 'Lily' });
    return byCell;
}

/** Every existing object that has an icon, in any cell. */
export function allHeldObjects(world: World, schema: Schema): HeldObject[] {
    const objects: HeldObject[] = [];
    for (const cell of objectsByCell(world, schema).values()) objects.push(...cell.values());
    return objects;
}

/**
 * The object each Cage holds, by the Cage's pid: the one kind of existing object in its cell. A cell with several kinds
 * or none, or an object that has no icon, gets no entry.
 */
export function heldByCages(cages: Cage[], world: World, schema: Schema): Map<number, HeldObject> {
    const byCell = objectsByCell(world, schema);
    const held = new Map<number, HeldObject>();
    for (const cage of cages) {
        const objects = byCell.get(cellKey(cage.p, world));
        if (objects?.size === 1) held.set(cage.pid, [...objects.values()][0]);
    }
    return held;
}

/** The key "i,j,z" of the grid cell a world position lies in, wrapped onto the grid. */
export function cellKey(p: Position, world: World): string {
    const [cornerX, cornerY] = world.grid.corner;
    const [width, height] = world.grid.size;
    const i = modulo(Math.round(p[0]) - cornerX, width);
    const j = modulo(Math.round(p[1]) - cornerY, height);
    return `${i},${j},${Math.round(p[2])}`;
}
