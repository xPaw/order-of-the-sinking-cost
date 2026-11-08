// The game's materials (data/materials.package, format in docs/GAMEDATA.md, Render assets) turned into a colour
// function per material, for the icon renderer. Lighting, normal maps and reflections are not modelled.
import * as paths from './paths.ts';
import { Archive } from './archive.ts';
import { srgbToLinear, type Textures } from './textures.ts';

export type Color = [r: number, g: number, b: number];

type MaterialValue = string | number | boolean | number[];

// The keys of a material file. The keys the shading reads are listed; any other key is held under its name.
interface MaterialKeys {
    [key: string]: MaterialValue | undefined;
    parent?: string;
    shader?: string;
    swap_entity_colors?: boolean;
    tint_color_A?: MaterialValue;
    tint_color_B?: MaterialValue;
    tint_color?: MaterialValue;
    use_tint_mask?: boolean;
    tint_mask_tex?: string;
    tint_mask_channel?: number;
    DIFFR_A?: string;
    DIFFR_B?: string;
    DIFFR_tex?: string;
    color_map?: string;
    relative_to_ec?: boolean;
    color_modulate?: MaterialValue;
    color_core?: MaterialValue;
    COLOR_tex?: string;
    base_color?: MaterialValue;
    mask?: number;
}

// The entity a material is drawn on: its tint colours and runtime colour, and whether glowing materials are left out
export interface ShadingEntity {
    tintA: Color;
    tintB: Color;
    effectColor: Color | null;
    noGlow: boolean;
    accessoryMask: number | null;
}

// How one triangle list is drawn
export interface Shading {
    kind: 'solid' | 'glow' | 'glass';
    color: (u: number, v: number, paint: number, footprint: number) => Color;
}

const WHITE: Color = [1, 1, 1];
const ADDITIVE_SHADERS = new Set(['additive', 'unlit_additive']);
const BLENDED_SHADERS = new Set(['blended2', 'freezer', 'ground_general']);

function parseValue(text: string): MaterialValue {
    if (text.startsWith('"')) return text.slice(1, -1);
    if (text.startsWith('(')) return text.slice(1, -1).trim().split(/\s+/).map(Number);
    if (text === 'true') return true;
    if (text === 'false') return false;
    return Number(text);
}

function baseName(path: string): string {
    const fileName = path.split('/').pop() ?? path;
    return fileName.replace(/\.material$/, '');
}

function rgbOf(value: MaterialValue | undefined, fallback: Color): Color {
    if (!Array.isArray(value)) return fallback;
    return [value[0], value[1], value[2]];
}

function multiply(a: Color, b: Color): Color {
    return [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
}

function mix(a: Color, b: Color, weight: number): Color {
    return [a[0] + (b[0] - a[0]) * weight, a[1] + (b[1] - a[1]) * weight, a[2] + (b[2] - a[2]) * weight];
}

// The largest channel scaled to 1: the hue of a colour whose brightness is an intensity
export function normalized(color: Color): Color {
    const largest = Math.max(color[0], color[1], color[2], 1e-6);
    return [color[0] / largest, color[1] / largest, color[2] / largest];
}

export class Materials {
    textures: Textures;
    archive: Archive;
    paths: Map<string, string>;
    cache: Map<string, MaterialKeys>;
    scratch: number[];

    constructor(textures: Textures) {
        this.textures = textures;
        this.archive = new Archive(paths.game('data', 'materials.package'));
        this.paths = new Map();
        for (const name of this.archive.files.keys()) this.paths.set(baseName(name), name);
        this.cache = new Map();
        this.scratch = [0, 0, 0, 0];
    }

    close(): void {
        this.archive.close();
    }

    // The keys of a material with its parents' keys it does not set; {} for an unknown name
    get(name: string): MaterialKeys {
        const cached = this.cache.get(name);
        if (cached !== undefined) return cached;
        const path = this.paths.get(name);
        let keys: MaterialKeys = {};
        if (path) {
            for (const line of this.archive.read(path).toString('utf8').split(/\r?\n/)) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const space = trimmed.indexOf(' ');
                if (space < 0) continue;
                keys[trimmed.slice(0, space)] = parseValue(trimmed.slice(space + 1).trim());
            }
            if (keys.parent) keys = { ...this.get(baseName(keys.parent)), ...keys };
        }
        this.cache.set(name, keys);
        return keys;
    }

    // The mask value of a tint mask texture at (u, v): its channel `channel` (0 = red) as 0..1
    maskAt(textureName: string, channel: number, u: number, v: number, footprint: number): number {
        const texture = this.textures.get(textureName);
        if (!texture) return 1;
        texture.texel(u, v, footprint, this.scratch);
        return this.scratch[channel] / 255;
    }

    colorAt(textureName: string, u: number, v: number, footprint: number): Color {
        const texture = this.textures.get(textureName);
        if (!texture) return WHITE;
        texture.texel(u, v, footprint, this.scratch);
        return [srgbToLinear(this.scratch[0]), srgbToLinear(this.scratch[1]), srgbToLinear(this.scratch[2])];
    }

    alphaAt(textureName: string, u: number, v: number, footprint: number): number {
        const texture = this.textures.get(textureName);
        if (!texture) return 1;
        texture.texel(u, v, footprint, this.scratch);
        return this.scratch[3] / 255;
    }

    // How one triangle list is drawn, or null to leave it out. A solid colour is the albedo; a glow is emitted light, not
    // lit; glass is a translucent solid. The entity's tintA and tintB are its tint colours and effectColor its runtime
    // colour, or null.
    shading(materialName: string, entity: ShadingEntity): Shading | null {
        const material = this.get(materialName);
        const shader = material.shader ?? '';
        const glows = ADDITIVE_SHADERS.has(shader) || shader === 'crystal_general';
        if (glows && entity.noGlow) return null;
        if (material.mask !== undefined && entity.accessoryMask !== null) {
            if ((material.mask & entity.accessoryMask) === 0) return null;
        }
        if (ADDITIVE_SHADERS.has(shader)) return this.glowShading(material, entity);
        if (shader === 'crystal_general') return this.glassShading(material, entity);
        if (shader === 'guy') return this.characterShading(material);
        if (shader === 'dragon_iridescent_scales') return this.dragonScalesShading(material);
        if (shader === 'dragon_iridescent_solid') return this.dragonSolidShading(material);

        let ownA = entity.tintA;
        let ownB = entity.tintB;
        if (material.swap_entity_colors) {
            ownA = entity.tintB;
            ownB = entity.tintA;
        }
        const tintA = rgbOf(material.tint_color_A, WHITE);
        const tintB = rgbOf(material.tint_color_B, WHITE);
        const useMask = material.use_tint_mask === true;
        const maskTexture = material.tint_mask_tex ?? 'white';
        const maskChannel = material.tint_mask_channel ?? 0;
        const maskOf = (u: number, v: number, footprint: number): number => {
            if (!useMask) return 1;
            return this.maskAt(maskTexture, maskChannel, u, v, footprint);
        };

        if (BLENDED_SHADERS.has(shader)) {
            const layerA = material.DIFFR_A ?? 'white';
            const layerB = material.DIFFR_B ?? 'white';
            return {
                kind: 'solid',
                color: (u, v, paint, footprint) => {
                    const mask = maskOf(u, v, footprint);
                    const entityA = mix(WHITE, ownA, mask);
                    const entityB = mix(WHITE, ownB, mask);
                    const colorA = multiply(multiply(this.colorAt(layerA, u, v, footprint), tintA), entityA);
                    const colorB = multiply(multiply(this.colorAt(layerB, u, v, footprint), tintB), entityB);
                    return mix(colorA, colorB, paint);
                },
            };
        }

        if (material.relative_to_ec === true && entity.effectColor && (material.DIFFR_tex ?? 'white') === 'white') {
            const hue = normalized(entity.effectColor);
            return { kind: 'glow', color: () => hue };
        }

        let textureName = material.DIFFR_tex ?? 'white';
        if (material.color_map !== undefined) textureName = material.color_map;
        return {
            kind: 'solid',
            color: (u, v, paint, footprint) => {
                const mask = maskOf(u, v, footprint);
                const entityColor = mix(WHITE, ownA, mask);
                return multiply(multiply(this.colorAt(textureName, u, v, footprint), tintA), entityColor);
            },
        };
    }

    // A character is its palette texture times color_modulate; the entity's colours only pick palette entries in-game
    characterShading(material: MaterialKeys): Shading {
        const palette = material.color_map ?? 'white';
        const modulate = rgbOf(material.color_modulate, WHITE);
        return {
            kind: 'solid',
            color: (u, v, paint, footprint) => multiply(this.colorAt(palette, u, v, footprint), modulate),
        };
    }

    // The scales of an iridescent dragon: the COLOR_tex texture. The sheen (cell_color, division_color, hue shift) is not
    // modelled.
    dragonScalesShading(material: MaterialKeys): Shading {
        const texture = material.COLOR_tex ?? 'white';
        return {
            kind: 'solid',
            color: (u, v, paint, footprint) => this.colorAt(texture, u, v, footprint),
        };
    }

    // The untextured parts of an iridescent dragon: the hue of base_color, whose brightness is an intensity
    dragonSolidShading(material: MaterialKeys): Shading {
        const hue = normalized(rgbOf(material.base_color, WHITE));
        return { kind: 'solid', color: () => hue };
    }

    glowShading(material: MaterialKeys, entity: ShadingEntity): Shading {
        let hue = normalized(rgbOf(material.tint_color, WHITE));
        if (entity.effectColor) hue = normalized(entity.effectColor);
        return { kind: 'glow', color: () => hue };
    }

    glassShading(material: MaterialKeys, entity: ShadingEntity): Shading {
        let core = rgbOf(material.color_core, WHITE);
        if (entity.effectColor) core = normalized(entity.effectColor);
        return { kind: 'glass', color: () => core };
    }
}
