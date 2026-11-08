// Decoder for the game's textures (data-pc/*.texture, format in docs/GAMEDATA.md, Render assets): the largest mip as
// 8-bit RGBA, with a box-filtered mip chain for sampling.
import { existsSync } from 'node:fs';
import { dataPcPath, readAsset } from './mesh.ts';

const FORMAT_BC1 = 0;
const FORMAT_BC3 = 1;
const FORMAT_BC4 = 2;
const FORMAT_RGBA8 = 5;
const ROW_PITCH_ALIGNMENT = 256;

const SRGB_TO_LINEAR = new Float32Array(256);
for (let value = 0; value < 256; value++) {
    const encoded = value / 255;
    if (encoded <= 0.04045) {
        SRGB_TO_LINEAR[value] = encoded / 12.92;
    } else {
        SRGB_TO_LINEAR[value] = Math.pow((encoded + 0.055) / 1.055, 2.4);
    }
}

// A decoded mip level: 8-bit RGBA rows
interface MipLevel {
    width: number;
    height: number;
    pixels: Uint8ClampedArray;
}

function unpack565(value: number): number[] {
    const red = (value >> 11) & 31;
    const green = (value >> 5) & 63;
    const blue = value & 31;
    return [(red * 255) / 31, (green * 255) / 63, (blue * 255) / 31];
}

function writeColorBlock(
    bytes: Uint8Array,
    offset: number,
    pixels: Uint8ClampedArray,
    width: number,
    blockX: number,
    blockY: number,
): void {
    const value0 = bytes[offset] | (bytes[offset + 1] << 8);
    const value1 = bytes[offset + 2] | (bytes[offset + 3] << 8);
    const color0 = unpack565(value0);
    const color1 = unpack565(value1);
    const palette = [color0, color1];
    if (value0 > value1) {
        palette.push(color0.map((channel, k) => (2 * channel + color1[k]) / 3));
        palette.push(color0.map((channel, k) => (channel + 2 * color1[k]) / 3));
    } else {
        palette.push(color0.map((channel, k) => (channel + color1[k]) / 2));
        palette.push([0, 0, 0]);
    }
    for (let row = 0; row < 4; row++) {
        const bits = bytes[offset + 4 + row];
        for (let column = 0; column < 4; column++) {
            const selected = palette[(bits >> (column * 2)) & 3];
            const target = ((blockY * 4 + row) * width + blockX * 4 + column) * 4;
            pixels[target] = selected[0];
            pixels[target + 1] = selected[1];
            pixels[target + 2] = selected[2];
            pixels[target + 3] = 255;
        }
    }
}

// An 8-byte BC4 block: two end points and sixteen 3-bit indices; `channel` is the pixel byte it writes
function writeAlphaBlock(
    bytes: Uint8Array,
    offset: number,
    pixels: Uint8ClampedArray,
    width: number,
    blockX: number,
    blockY: number,
    channel: number,
): void {
    const end0 = bytes[offset];
    const end1 = bytes[offset + 1];
    const palette = [end0, end1];
    if (end0 > end1) {
        for (let step = 1; step <= 6; step++) palette.push(((7 - step) * end0 + step * end1) / 7);
    } else {
        for (let step = 1; step <= 4; step++) palette.push(((5 - step) * end0 + step * end1) / 5);
        palette.push(0, 255);
    }
    let bits = 0n;
    for (let k = 0; k < 6; k++) bits |= BigInt(bytes[offset + 2 + k]) << BigInt(8 * k);
    for (let texel = 0; texel < 16; texel++) {
        const index = Number((bits >> BigInt(3 * texel)) & 7n);
        const x = blockX * 4 + (texel % 4);
        const y = blockY * 4 + Math.floor(texel / 4);
        pixels[(y * width + x) * 4 + channel] = palette[index];
    }
}

function decodeBlocks(body: Uint8Array, format: number, width: number, height: number): MipLevel {
    const paddedWidth = Math.ceil(width / 4) * 4;
    const paddedHeight = Math.ceil(height / 4) * 4;
    const pixels = new Uint8ClampedArray(paddedWidth * paddedHeight * 4);
    const blocksWide = paddedWidth / 4;
    const blocksHigh = paddedHeight / 4;
    let blockSize = 16;
    if (format === FORMAT_BC1 || format === FORMAT_BC4) blockSize = 8;
    const rowPitch = Math.ceil((blocksWide * blockSize) / ROW_PITCH_ALIGNMENT) * ROW_PITCH_ALIGNMENT;
    for (let blockY = 0; blockY < blocksHigh; blockY++) {
        for (let blockX = 0; blockX < blocksWide; blockX++) {
            const offset = blockY * rowPitch + blockX * blockSize;
            if (format === FORMAT_BC1) {
                writeColorBlock(body, offset, pixels, paddedWidth, blockX, blockY);
            } else if (format === FORMAT_BC3) {
                writeColorBlock(body, offset + 8, pixels, paddedWidth, blockX, blockY);
                writeAlphaBlock(body, offset, pixels, paddedWidth, blockX, blockY, 3);
            } else {
                writeAlphaBlock(body, offset, pixels, paddedWidth, blockX, blockY, 0);
            }
        }
    }
    if (format === FORMAT_BC4) {
        for (let at = 0; at < pixels.length; at += 4) {
            pixels[at + 1] = pixels[at];
            pixels[at + 2] = pixels[at];
            pixels[at + 3] = 255;
        }
    }
    return { width: paddedWidth, height: paddedHeight, pixels };
}

function decodeRgba(body: Uint8Array, width: number, height: number): MipLevel {
    const pixels = new Uint8ClampedArray(width * height * 4);
    const rowPitch = Math.ceil((width * 4) / ROW_PITCH_ALIGNMENT) * ROW_PITCH_ALIGNMENT;
    for (let y = 0; y < height; y++) {
        pixels.set(body.subarray(y * rowPitch, y * rowPitch + width * 4), y * width * 4);
    }
    return { width, height, pixels };
}

function halve(level: MipLevel): MipLevel {
    const width = Math.max(1, level.width >> 1);
    const height = Math.max(1, level.height >> 1);
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const x0 = Math.min(level.width - 1, x * 2);
            const x1 = Math.min(level.width - 1, x * 2 + 1);
            const y0 = Math.min(level.height - 1, y * 2);
            const y1 = Math.min(level.height - 1, y * 2 + 1);
            for (let channel = 0; channel < 4; channel++) {
                const sum =
                    level.pixels[(y0 * level.width + x0) * 4 + channel] +
                    level.pixels[(y0 * level.width + x1) * 4 + channel] +
                    level.pixels[(y1 * level.width + x0) * 4 + channel] +
                    level.pixels[(y1 * level.width + x1) * 4 + channel];
                pixels[(y * width + x) * 4 + channel] = sum / 4;
            }
        }
    }
    return { width, height, pixels };
}

export class Texture {
    levels: MipLevel[];
    width: number;
    height: number;

    constructor(base: MipLevel) {
        this.levels = [base];
        this.width = base.width;
        this.height = base.height;
    }

    level(index: number): MipLevel {
        while (this.levels.length <= index) {
            const last = this.levels[this.levels.length - 1];
            if (last.width === 1 && last.height === 1) return last;
            this.levels.push(halve(last));
        }
        return this.levels[index];
    }

    // The texel at (u, v), wrapping, from the mip whose texels are about `footprint` (in uv units) wide; writes
    // [r, g, b, a] bytes into `out`. v = 0 is the last row of the image.
    texel(u: number, v: number, footprint: number, out: number[]): void {
        const texelsAcross = footprint * Math.max(this.width, this.height);
        const lod = Math.floor(Math.log2(Math.max(texelsAcross, 1)));
        const level = this.level(lod);
        const x = Math.min(level.width - 1, Math.floor((u - Math.floor(u)) * level.width));
        const row = Math.floor((1 - (v - Math.floor(v))) * level.height);
        const y = Math.min(level.height - 1, row);
        const at = (y * level.width + x) * 4;
        out[0] = level.pixels[at];
        out[1] = level.pixels[at + 1];
        out[2] = level.pixels[at + 2];
        out[3] = level.pixels[at + 3];
    }
}

export class Textures {
    cache: Map<string, Texture | null>;

    constructor() {
        this.cache = new Map();
    }

    // The texture, or null for 'white', a missing file and a format that is not decoded
    get(name: string): Texture | null {
        const cached = this.cache.get(name);
        if (cached !== undefined) return cached;
        let texture: Texture | null = null;
        const path = dataPcPath(name, 'texture');
        if (name !== 'white' && existsSync(path)) texture = this.decode(path);
        this.cache.set(name, texture);
        return texture;
    }

    decode(path: string): Texture | null {
        const { header, body } = readAsset(path);
        const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
        const width = view.getUint16(12, true);
        const height = view.getUint16(14, true);
        const format = header[20];
        if (format === FORMAT_BC1 || format === FORMAT_BC3 || format === FORMAT_BC4) {
            return new Texture(decodeBlocks(body, format, width, height));
        }
        if (format === FORMAT_RGBA8) return new Texture(decodeRgba(body, width, height));
        return null;
    }
}

export function srgbToLinear(byte: number): number {
    return SRGB_TO_LINEAR[Math.round(byte)];
}
