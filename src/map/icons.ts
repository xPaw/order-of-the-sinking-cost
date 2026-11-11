// The icons of the map's markers and sidebar rows: the rendered images in src/assets/icons/, and the
// shapes that mark a level's role (viewer.md "Level states (viewer)", "Level roles (viewer)" and "The page (viewer)")
import type { Area } from '../types.ts';
import type { TowerProgress } from '../model/towers.ts';
import {
    areaEmblemName,
    EMBLEM_ICON_NAMES,
    goldBadgeName,
    TOWER_BADGE_NAMES,
    towerBadgeName,
    type EmblemIconName,
    type TowerBadgeName,
} from './emblems.ts';
import { LEVEL_ICON_NAMES } from './level-icons.ts';
import type { OverlayKind } from './map-html.ts';

/** A level's role for a goal: on every route to it, on some of its routes, or not needed for it. */
export type Role = keyof typeof ROLES;

export type ShapeName = 'tri' | 'square' | 'circle';

/** The images the map draws for its marks. */
const ICON_NAMES = [
    'ice-cage',
    'ice-gate',
    'sign',
    'teleporter',
    'pad',
    'gold-room',
    'voice-log',
    'map-scroll',
    'area-pin',
    'treasure',
    'treasure-taken',
    'hero',
    ...LEVEL_ICON_NAMES,
    ...EMBLEM_ICON_NAMES,
    ...TOWER_BADGE_NAMES,
] as const;

/** The rendered images, by file name without the extension. */
export type IconName = (typeof ICON_NAMES)[number];

const ICON_FILE_URLS = import.meta.glob('../assets/icons/*.avif', { query: '?url', import: 'default', eager: true });

/** The URL of each image in src/assets/icons/, relative to the page, by file name without the extension. */
export const ICON_URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(ICON_FILE_URLS)) {
    const name = path.slice(path.lastIndexOf('/') + 1, -'.avif'.length);
    if (typeof url === 'string') ICON_URLS[name] = url;
}

for (const name of ICON_NAMES) {
    if (!(name in ICON_URLS)) throw new Error(`no image for the icon ${name}`);
}

/** Role shapes: SVG paths around (0, 0) at a radius. */
export const SHAPES: Record<ShapeName, { path: (radius: number) => string }> = {
    tri: {
        path: (radius) => `M0 ${-radius * 1.2}L${radius * 1.1} ${radius * 0.8}L${-radius * 1.1} ${radius * 0.8}Z`,
    },
    square: {
        path: (radius) => `M${-radius * 0.9} ${-radius * 0.9}h${radius * 1.8}v${radius * 1.8}h${-radius * 1.8}Z`,
    },
    circle: {
        path: (radius) =>
            `M${-radius} 0a${radius} ${radius} 0 1 0 ${2 * radius} 0a${radius} ${radius} 0 1 0 ${-2 * radius} 0Z`,
    },
};

export const ROLE_SHAPES: Record<Role, ShapeName> = { req: 'tri', one: 'square', optional: 'circle' };

/** An icon as an image in the sidebar and the lists, larger than the small shape icons. */
export const iconHtml = (name: IconName, extraClass = ''): string => {
    let className = 'ico';
    if (extraClass) className += ' ' + extraClass;
    return `<img class="${className}" src="${ICON_URLS[name]}" alt="" width="128" height="128" draggable="false">`;
};

/** An emblem or badge as an image; without one, an empty mark of the same size so names stay aligned. */
function emblemHtml(name: EmblemIconName | TowerBadgeName | null): string {
    if (name) return iconHtml(name, 'emb');
    return '<span class="ico emb emb-none" aria-hidden="true"></span>';
}

/** The emblem of an area, the placeholder for an area with none. */
export const areaEmblemHtml = (area: Pick<Area, 'image'>): string => emblemHtml(areaEmblemName(area));

/** The gold badge of a pair's gold achievement by its name; null for another achievement. */
export function goldBadgeHtml(achievement: string): string | null {
    const name = goldBadgeName(achievement);
    if (!name) return null;
    return emblemHtml(name);
}

/** An empty slot as wide as an emblem, for the rows of a list that has emblems on other rows. */
export const emblemSlotHtml = (): string => emblemHtml(null);

/** The badge of a tower from its worlds, gold once its dropdowns are solved; the placeholder for three or more worlds. */
export const towerEmblemHtml = (tower: Pick<TowerProgress, 't' | 'gold'>): string =>
    emblemHtml(towerBadgeName(tower.t, tower.gold));

/** Every small icon is drawn in the same 16 px box. */
const svgIcon = (path: string, fill: string, stroke: string, strokeWidth = 1): string => {
    const paint = `fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"`;
    const shape = `<path d="${path}" ${paint} stroke-linejoin="round" stroke-linecap="round"/>`;
    return `<svg class="ic" viewBox="-8 -8 16 16" aria-hidden="true">${shape}</svg>`;
};

const ICON_RADIUS = 5.5;

const ICON_STROKE = 'rgba(5, 10, 14, .75)';

const shapeIcon = (shape: ShapeName, color: string): string =>
    svgIcon(SHAPES[shape].path(ICON_RADIUS), color, ICON_STROKE);

export const checkIcon = svgIcon('M-4.5 0.5L-1.5 3.5L4.5 -3.5', 'none', 'var(--gold)', 2);

export const roleDot = (role: Role | null | undefined): string =>
    role ? shapeIcon(ROLE_SHAPES[role], ROLES[role][1]) : '';

/** Per role, its label and marker colour. */
export const ROLES = {
    req: ['Required', '#f08a5d'],
    one: ['One of several', '#c6d86a'],
    optional: ['Optional', '#b39ddb'],
} satisfies Record<string, [label: string, color: string]>;

// a role's badge as an image of its shape in its colour, in the 16 unit box the icons use
function roleBadgeUrl(role: Role): string {
    const shape = SHAPES[ROLE_SHAPES[role]].path(5);
    const paint = `fill="${ROLES[role][1]}" stroke="#0b1218" stroke-width="1.6" stroke-linejoin="round"`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 16 16"><path d="${shape}" ${paint}/></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/** The image the map draws as the badge of each role. */
export const ROLE_BADGE_URLS: Record<Role, string> = {
    req: roleBadgeUrl('req'),
    one: roleBadgeUrl('one'),
    optional: roleBadgeUrl('optional'),
};

const OVERLAY_ICON_NAMES: Record<Exclude<OverlayKind, 'reach'>, IconName> = {
    pods: 'ice-cage',
    doorways: 'ice-gate',
    signs: 'sign',
    tps: 'teleporter',
    towerPads: 'gold-room',
    minorPads: 'pad',
    logs: 'voice-log',
    maps: 'map-scroll',
    pins: 'area-pin',
    treasures: 'treasure',
};

const overlayIconEntries = Object.entries(OVERLAY_ICON_NAMES).map(([kind, name]) => [kind, iconHtml(name)]);

/** The icon of each kind of mark the map can show or hide, by overlay kind, for the sidebar's rows and the map's toolbar. */
export const OVERLAY_ICONS: Record<string, string> = {
    ...Object.fromEntries(overlayIconEntries),
    reach: svgIcon('M-5.5 -3.5h11v7h-11Z', 'var(--reach)', ICON_STROKE),
};

/** A cloud, for the fog. */
export const fogIcon = svgIcon(
    'M-6 4H4.5A2.5 2.5 0 0 0 4.5 -1A3.4 3.4 0 0 0 -2 -2A3.7 3.7 0 0 0 -6 4Z',
    '#c9d3de',
    ICON_STROKE,
);

/** The arrow of a heading or row that expands and collapses. */
export const CHEVRON = '<i class="chev" aria-hidden="true"></i>';

/** The hero's icon. */
export const heroIcon = iconHtml('hero');
