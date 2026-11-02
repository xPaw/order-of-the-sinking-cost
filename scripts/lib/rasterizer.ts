// A small software renderer for the icons: an orthographic three-quarter view of a mesh, supersampled, lit by a key,
// a fill and a rim light, with a dark outline and a soft drop shadow, on a transparent background.
import type { Lod, Mesh, TriangleList } from './mesh.ts';
import type { Color, Shading } from './materials.ts';
import type { Vector } from './math.ts';

type DrawMode = Shading['kind'];

interface CameraAxes {
    toEye: Vector;
    right: Vector;
    up: Vector;
}

interface Lighting {
    key: Vector;
    fill: Vector;
    rim: Vector;
}

interface Framing {
    centerX: number;
    centerY: number;
    scale: number;
}

const SUPERSAMPLE = 4;
const GLASS_OPACITY = 0.4;
const GLOW_STRENGTH = 0.8;
const OUTLINE_COLOR: Color = [0.012, 0.01, 0.02];
const OUTLINE_OPACITY = 0.85;
const SHADOW_OFFSET_PIXELS = 1.6;
const SHADOW_BLUR_PIXELS = 2.2;
const SHADOW_OPACITY = 0.38;
const EXPOSURE = 1.35;
const AMBIENT = 0.42;
const KEY_STRENGTH = 0.8;
const FILL_STRENGTH = 0.28;
const RIM_STRENGTH = 0.35;

function dot(a: Vector, b: Vector): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vector, b: Vector): Vector {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(vector: Vector): Vector {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function combine(terms: [factor: number, vector: Vector][]): Vector {
    const sum: Vector = [0, 0, 0];
    for (const [factor, vector] of terms) {
        sum[0] += factor * vector[0];
        sum[1] += factor * vector[1];
        sum[2] += factor * vector[2];
    }
    return sum;
}

// The camera axes in world space (z up): the camera sits south of the target for azimuth 0 and turns east with it
function cameraAxes(azimuthDegrees: number, elevationDegrees: number): CameraAxes {
    const azimuth = (azimuthDegrees * Math.PI) / 180;
    const elevation = (elevationDegrees * Math.PI) / 180;
    const toEye: Vector = [
        Math.cos(elevation) * Math.sin(azimuth),
        -Math.cos(elevation) * Math.cos(azimuth),
        Math.sin(elevation),
    ];
    const right: Vector = [Math.cos(azimuth), Math.sin(azimuth), 0];
    const up = cross(toEye, right);
    return { toEye, right, up };
}

function lightingFor(axes: CameraAxes): Lighting {
    const { toEye, right, up } = axes;
    return {
        key: normalize(
            combine([
                [-0.55, right],
                [0.65, up],
                [0.55, toEye],
            ]),
        ),
        fill: normalize(
            combine([
                [0.75, right],
                [0.1, up],
                [0.45, toEye],
            ]),
        ),
        rim: normalize(
            combine([
                [-0.2, right],
                [0.55, up],
                [-0.8, toEye],
            ]),
        ),
    };
}

// Draws the triangles of `lists` into the buffers; `mode` is 'solid', 'glass' or 'glow'
class Canvas {
    full: number;
    mesh: Mesh;
    positions: Float32Array;
    normals: Float32Array;
    paint: Uint8Array;
    axes: CameraAxes;
    light: Lighting;
    depth: Float32Array;
    color: Float32Array;
    alpha: Float32Array;
    glow: Float32Array;
    glowCovered: Uint8Array;
    screen: Float32Array;

    constructor(
        size: number,
        mesh: Mesh,
        positions: Float32Array,
        normals: Float32Array,
        paint: Uint8Array,
        axes: CameraAxes,
        framing: Framing,
    ) {
        this.full = size * SUPERSAMPLE;
        this.mesh = mesh;
        this.positions = positions;
        this.normals = normals;
        this.paint = paint;
        this.axes = axes;
        this.light = lightingFor(axes);
        this.depth = new Float32Array(this.full * this.full).fill(-Infinity);
        this.color = new Float32Array(this.full * this.full * 3);
        this.alpha = new Float32Array(this.full * this.full);
        this.glow = new Float32Array(this.full * this.full * 3);
        this.glowCovered = new Uint8Array(this.full * this.full);
        this.screen = new Float32Array(mesh.vertexCount * 3);
        for (let vertex = 0; vertex < mesh.vertexCount; vertex++) {
            const point: Vector = [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]];
            this.screen[vertex * 3] = (dot(point, axes.right) - framing.centerX) * framing.scale + this.full / 2;
            this.screen[vertex * 3 + 1] = this.full / 2 - (dot(point, axes.up) - framing.centerY) * framing.scale;
            this.screen[vertex * 3 + 2] = dot(point, axes.toEye);
        }
    }

    lit(albedo: Color, normal: Vector): Color {
        const { key, fill, rim } = this.light;
        const keyAmount = Math.max(0, dot(normal, key));
        const fillAmount = Math.max(0, dot(normal, fill));
        const facing = Math.max(0, dot(normal, this.axes.toEye));
        const rimAmount = Math.pow(1 - facing, 3) * Math.max(0, 0.4 + dot(normal, rim));
        const hemisphere = AMBIENT + 0.12 * normal[2];
        const light = hemisphere + KEY_STRENGTH * keyAmount + FILL_STRENGTH * fillAmount;
        const lighten = (channel: number) =>
            EXPOSURE * (channel * light + channel * RIM_STRENGTH * rimAmount + 0.04 * rimAmount);
        return [lighten(albedo[0]), lighten(albedo[1]), lighten(albedo[2])];
    }

    drawList(list: TriangleList, lod: Lod, shading: Shading, mode: DrawMode): void {
        const { indices } = lod;
        const { screen, mesh, normals, full } = this;
        for (let k = list.first; k < list.first + list.count; k += 3) {
            const ia = indices[k];
            const ib = indices[k + 1];
            const ic = indices[k + 2];
            const ax = screen[ia * 3];
            const ay = screen[ia * 3 + 1];
            const bx = screen[ib * 3];
            const by = screen[ib * 3 + 1];
            const cx = screen[ic * 3];
            const cy = screen[ic * 3 + 1];
            // image y points down, so a counter-clockwise front face has a negative area
            const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
            if (area >= 0) continue;

            const uvArea = Math.abs(
                (mesh.uvs[ib * 2] - mesh.uvs[ia * 2]) * (mesh.uvs[ic * 2 + 1] - mesh.uvs[ia * 2 + 1]) -
                    (mesh.uvs[ib * 2 + 1] - mesh.uvs[ia * 2 + 1]) * (mesh.uvs[ic * 2] - mesh.uvs[ia * 2]),
            );
            const footprint = Math.sqrt(uvArea / -area) * SUPERSAMPLE;

            const left = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
            const right = Math.min(full - 1, Math.ceil(Math.max(ax, bx, cx)));
            const top = Math.max(0, Math.floor(Math.min(ay, by, cy)));
            const bottom = Math.min(full - 1, Math.ceil(Math.max(ay, by, cy)));
            for (let y = top; y <= bottom; y++) {
                for (let x = left; x <= right; x++) {
                    const px = x + 0.5;
                    const py = y + 0.5;
                    const weightA = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / area;
                    const weightB = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / area;
                    const weightC = 1 - weightA - weightB;
                    if (weightA < 0 || weightB < 0 || weightC < 0) continue;
                    const z =
                        weightA * screen[ia * 3 + 2] + weightB * screen[ib * 3 + 2] + weightC * screen[ic * 3 + 2];
                    const pixel = y * full + x;
                    if (z <= this.depth[pixel]) continue;
                    if (mode !== 'glow') this.depth[pixel] = z;

                    const u = weightA * mesh.uvs[ia * 2] + weightB * mesh.uvs[ib * 2] + weightC * mesh.uvs[ic * 2];
                    const v =
                        weightA * mesh.uvs[ia * 2 + 1] +
                        weightB * mesh.uvs[ib * 2 + 1] +
                        weightC * mesh.uvs[ic * 2 + 1];
                    const paint =
                        (weightA * this.paint[ia * 4] + weightB * this.paint[ib * 4] + weightC * this.paint[ic * 4]) /
                        255;
                    const albedo = shading.color(u, v, paint, footprint);
                    if (mode === 'glow') {
                        this.addGlow(pixel, albedo);
                        continue;
                    }
                    const normal = normalize([
                        weightA * normals[ia * 3] + weightB * normals[ib * 3] + weightC * normals[ic * 3],
                        weightA * normals[ia * 3 + 1] + weightB * normals[ib * 3 + 1] + weightC * normals[ic * 3 + 1],
                        weightA * normals[ia * 3 + 2] + weightB * normals[ib * 3 + 2] + weightC * normals[ic * 3 + 2],
                    ]);
                    const shaded = this.lit(albedo, normal);
                    if (mode === 'glass') {
                        this.blend(pixel, shaded, GLASS_OPACITY);
                    } else {
                        this.color[pixel * 3] = shaded[0];
                        this.color[pixel * 3 + 1] = shaded[1];
                        this.color[pixel * 3 + 2] = shaded[2];
                        this.alpha[pixel] = 1;
                    }
                }
            }
        }
    }

    // Premultiplied colour over the pixel
    blend(pixel: number, color: Color, opacity: number): void {
        for (let channel = 0; channel < 3; channel++) {
            const below = this.color[pixel * 3 + channel];
            this.color[pixel * 3 + channel] = below * (1 - opacity) + color[channel] * opacity;
        }
        this.alpha[pixel] += (1 - this.alpha[pixel]) * opacity;
    }

    // Overlapping glow layers do not add up: a pixel keeps the brightest of them
    addGlow(pixel: number, color: Color): void {
        for (let channel = 0; channel < 3; channel++) {
            this.glow[pixel * 3 + channel] = Math.max(this.glow[pixel * 3 + channel], color[channel]);
        }
        this.glowCovered[pixel] = 1;
    }

    applyGlow(): void {
        for (let pixel = 0; pixel < this.alpha.length; pixel++) {
            if (!this.glowCovered[pixel]) continue;
            const glow: Color = [this.glow[pixel * 3], this.glow[pixel * 3 + 1], this.glow[pixel * 3 + 2]];
            this.blend(pixel, glow, GLOW_STRENGTH);
        }
    }
}

// Where the drawn triangles fall on the screen: the centre and the scale that fits them into `inner` pixels
function frameOf(positions: Float32Array, lists: TriangleList[], lod: Lod, axes: CameraAxes, inner: number): Framing {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const list of lists) {
        for (let k = list.first; k < list.first + list.count; k++) {
            const vertex = lod.indices[k];
            const point: Vector = [positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]];
            const x = dot(point, axes.right);
            const y = dot(point, axes.up);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
        }
    }
    const extent = Math.max(maxX - minX, maxY - minY);
    return { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, scale: (inner * SUPERSAMPLE) / extent };
}

function dilate(mask: Float32Array, full: number, radius: number): Float32Array {
    const offsets: [number, number][] = [];
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy <= radius * radius) offsets.push([dx, dy]);
        }
    }
    const result = new Float32Array(full * full);
    for (let y = 0; y < full; y++) {
        for (let x = 0; x < full; x++) {
            let covered = 0;
            for (const [dx, dy] of offsets) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= full || ny >= full) continue;
                if (mask[ny * full + nx] > covered) covered = mask[ny * full + nx];
            }
            result[y * full + x] = covered;
        }
    }
    return result;
}

function boxBlur(values: Float32Array, full: number, radius: number): Float32Array {
    const horizontal = new Float32Array(full * full);
    const result = new Float32Array(full * full);
    const width = radius * 2 + 1;
    for (let y = 0; y < full; y++) {
        for (let x = 0; x < full; x++) {
            let sum = 0;
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                if (nx >= 0 && nx < full) sum += values[y * full + nx];
            }
            horizontal[y * full + x] = sum / width;
        }
    }
    for (let y = 0; y < full; y++) {
        for (let x = 0; x < full; x++) {
            let sum = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                const ny = y + dy;
                if (ny >= 0 && ny < full) sum += horizontal[ny * full + x];
            }
            result[y * full + x] = sum / width;
        }
    }
    return result;
}

function shifted(values: Float32Array, full: number, shiftY: number): Float32Array {
    const result = new Float32Array(full * full);
    for (let y = 0; y < full; y++) {
        const source = y - shiftY;
        if (source < 0 || source >= full) continue;
        result.set(values.subarray(source * full, source * full + full), y * full);
    }
    return result;
}

function toSrgbByte(linear: number): number {
    const clamped = Math.min(1, Math.max(0, linear));
    let encoded = 12.92 * clamped;
    if (clamped > 0.0031308) encoded = 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(encoded * 255);
}

// Composites object over outline over shadow and averages SUPERSAMPLE x SUPERSAMPLE samples into one pixel
function resolve(canvas: Canvas, size: number, outlinePixels: number, withShadow: boolean): Uint8Array {
    const full = canvas.full;
    const coverage = new Float32Array(full * full);
    for (let pixel = 0; pixel < coverage.length; pixel++) coverage[pixel] = canvas.alpha[pixel] > 0 ? 1 : 0;
    const halo = dilate(coverage, full, Math.round(outlinePixels * SUPERSAMPLE));
    let shadow: Float32Array = new Float32Array(full * full);
    if (withShadow) {
        const offset = shifted(halo, full, Math.round(SHADOW_OFFSET_PIXELS * SUPERSAMPLE));
        shadow = boxBlur(offset, full, Math.round(SHADOW_BLUR_PIXELS * SUPERSAMPLE));
    }
    const output = new Uint8Array(size * size * 4);
    const samples = SUPERSAMPLE * SUPERSAMPLE;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let red = 0;
            let green = 0;
            let blue = 0;
            let alpha = 0;
            for (let sy = 0; sy < SUPERSAMPLE; sy++) {
                for (let sx = 0; sx < SUPERSAMPLE; sx++) {
                    const pixel = (y * SUPERSAMPLE + sy) * full + x * SUPERSAMPLE + sx;
                    const objectAlpha = canvas.alpha[pixel];
                    const outlineAlpha = halo[pixel] * OUTLINE_OPACITY;
                    const shadowAlpha = shadow[pixel] * SHADOW_OPACITY;
                    // premultiplied, from the bottom: shadow (black), outline, object
                    let sampleRed = OUTLINE_COLOR[0] * outlineAlpha;
                    let sampleGreen = OUTLINE_COLOR[1] * outlineAlpha;
                    let sampleBlue = OUTLINE_COLOR[2] * outlineAlpha;
                    let sampleAlpha = shadowAlpha * (1 - outlineAlpha) + outlineAlpha;
                    sampleRed = sampleRed * (1 - objectAlpha) + canvas.color[pixel * 3];
                    sampleGreen = sampleGreen * (1 - objectAlpha) + canvas.color[pixel * 3 + 1];
                    sampleBlue = sampleBlue * (1 - objectAlpha) + canvas.color[pixel * 3 + 2];
                    sampleAlpha = sampleAlpha * (1 - objectAlpha) + objectAlpha;
                    red += sampleRed;
                    green += sampleGreen;
                    blue += sampleBlue;
                    alpha += sampleAlpha;
                }
            }
            const target = (y * size + x) * 4;
            if (alpha > 0) {
                output[target] = toSrgbByte(red / alpha);
                output[target + 1] = toSrgbByte(green / alpha);
                output[target + 2] = toSrgbByte(blue / alpha);
            }
            output[target + 3] = Math.round((alpha / samples) * 255);
        }
    }
    return output;
}

// Renders one mesh.
//   mesh, positions and normals (the mesh's own, or posed), paint (vertex colours as RGBA bytes),
//   shadings: one per triangle list, { kind, color } or null to leave the list out,
//   view: { azimuth, elevation } in degrees, size: output pixels, margin: empty pixels around the object,
//   outline: the outline width in output pixels, shadow: whether to draw the drop shadow.
// Returns RGBA bytes, straight alpha.
export interface RenderOptions {
    mesh: Mesh;
    positions: Float32Array;
    normals?: Float32Array | null;
    paint: Uint8Array;
    shadings: (Shading | null)[];
    view: { azimuth: number; elevation: number };
    size: number;
    margin: number;
    outline: number;
    shadow: boolean;
}

export function renderMesh({
    mesh,
    positions,
    normals,
    paint,
    shadings,
    view,
    size,
    margin,
    outline,
    shadow,
}: RenderOptions): Uint8Array {
    const axes = cameraAxes(view.azimuth, view.elevation);
    const lod = mesh.lods[0];
    const drawn: { list: TriangleList; shading: Shading }[] = [];
    lod.lists.forEach((list, index) => {
        if (shadings[index]) drawn.push({ list, shading: shadings[index] });
    });
    const framing = frameOf(
        positions,
        drawn.map((entry) => entry.list),
        lod,
        axes,
        size - 2 * margin,
    );
    const canvas = new Canvas(size, mesh, positions, normals ?? mesh.normals, paint, axes, framing);
    const modes: DrawMode[] = ['solid', 'glow', 'glass'];
    for (const mode of modes) {
        for (const { list, shading } of drawn) {
            if (shading.kind === mode) canvas.drawList(list, lod, shading, mode);
        }
        if (mode === 'glow') canvas.applyGlow();
    }
    return resolve(canvas, size, outline, shadow);
}
