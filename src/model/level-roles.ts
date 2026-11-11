// Level roles (viewer.md "Level roles (viewer)"): the static roles stored in data/walk.json
import { STATIC_ROLES } from '../walk-data.ts';
import type { StoredRoles } from '../walk-data.ts';

export const ROLE: StoredRoles | null = STATIC_ROLES;

/** Required / Optional by kind ('l' level, 'g' Freezer) and index; null without static roles. */
export function roleOf(kind: 'l' | 'g', index: number): 'req' | 'optional' | null {
    if (!ROLE) return null;
    if (ROLE.need[kind][index]) return 'req';
    return 'optional';
}
