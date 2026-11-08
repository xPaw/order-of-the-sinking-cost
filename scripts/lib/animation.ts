// Reader for the first frame of the game's sampled animations (data/animation.package, data-common/<clip>.anim)
import { Archive } from './archive.ts';
import type { Mesh, MeshNode } from './mesh.ts';
import * as paths from './paths.ts';

const PARENTS_AT = 74;
const RECORD_SIZE = 44;
const NO_PARENT = 0xffff;
const CENTIMETRE = 0.01;

const POSITION_CONSTANT = 1;
const ROTATION_CONSTANT = 2;
const ROTATION_IDENTITY = 16;

// A 4x4 matrix in column-major order
export type Matrix = Float64Array;

export interface Bone {
    name: string;
    parent: number;
    translation: [number, number, number];
    rotation: [number, number, number, number];
}

export interface Skeleton {
    bones: Bone[];
}

function identity(): Matrix {
    const matrix = new Float64Array(16);
    matrix[0] = 1;
    matrix[5] = 1;
    matrix[10] = 1;
    matrix[15] = 1;
    return matrix;
}

function multiply(a: Matrix, b: Matrix): Matrix {
    const result = new Float64Array(16);
    for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
            let sum = 0;
            for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
            result[column * 4 + row] = sum;
        }
    }
    return result;
}

// Rotation by the bone's quaternion, then the translation
function localMatrix(bone: Bone): Matrix {
    const [x, y, z, w] = bone.rotation;
    const length = Math.hypot(x, y, z, w) || 1;
    const qx = x / length;
    const qy = y / length;
    const qz = z / length;
    const qw = w / length;
    const rotation = [
        [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw)],
        [2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw)],
        [2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)],
    ];
    const matrix = identity();
    for (let row = 0; row < 3; row++) {
        for (let column = 0; column < 3; column++) matrix[column * 4 + row] = rotation[row][column];
        matrix[12 + row] = bone.translation[row];
    }
    return matrix;
}

// The skeleton of a clip with every bone's local transform at frame 0, translations in centimetres
export function readFirstFrame(clipName: string): Skeleton {
    const archive = new Archive(paths.game('data', 'animation.package'));
    const file = archive.read(`data-common/${clipName}.anim`);
    archive.close();
    const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
    if (file.toString('latin1', 0, 4) !== 'Anim') throw new Error(`${clipName}: not an animation`);
    const boneCount = view.getUint32(10, true);

    // the records, like the curves after the names, start on a 4-byte boundary
    const recordsAt = (PARENTS_AT + 2 * boneCount + 3) & ~3;
    let namesAt = recordsAt + RECORD_SIZE * boneCount;
    const names: string[] = [];
    for (let bone = 0; bone < boneCount; bone++) {
        const length = file[namesAt];
        names.push(file.toString('latin1', namesAt + 1, namesAt + 1 + length));
        namesAt += length + 2;
    }
    const curvesAt = (namesAt + 3) & ~3;

    const bones: Bone[] = [];
    for (let index = 0; index < boneCount; index++) {
        const at = recordsAt + RECORD_SIZE * index;
        const flags = view.getUint32(at, true);
        let cursor = curvesAt + view.getUint32(at + 4, true);
        const float = (offset: number) => view.getFloat32(at + offset, true);
        const parent = view.getUint16(PARENTS_AT + 2 * index, true);

        const translation: [number, number, number] = [float(24), float(28), float(32)];
        if ((flags & POSITION_CONSTANT) === 0) {
            for (let axis = 0; axis < 3; axis++) {
                const t = view.getUint16(cursor, true) / 65535;
                cursor += 2;
                translation[axis] = t * float(12 + 4 * axis) + (1 - t) * float(24 + 4 * axis);
            }
        }

        let rotation: [number, number, number, number] = [0, 0, 0, 1];
        const hasRotation =
            (flags & (ROTATION_CONSTANT | ROTATION_IDENTITY)) !== (ROTATION_CONSTANT | ROTATION_IDENTITY);
        if (hasRotation) {
            const component = (k: number) => view.getInt16(cursor + 2 * k, true) / 32767;
            rotation = [component(0), component(1), component(2), component(3)];
            cursor += 8;
        }

        bones.push({ name: names[index], parent: parent === NO_PARENT ? -1 : parent, translation, rotation });
    }
    return { bones };
}

// The world matrix of every bone; parents precede their children
export function worldMatrices(skeleton: Skeleton): Matrix[] {
    const worlds: Matrix[] = [];
    for (const bone of skeleton.bones) {
        const local = localMatrix(bone);
        worlds.push(bone.parent < 0 ? local : multiply(worlds[bone.parent], local));
    }
    return worlds;
}

// The matrix taking a mesh position in metres into its node's space in centimetres
function inverseBind(node: MeshNode): Matrix {
    const matrix = new Float64Array(16);
    const scale = node.inverseBind[15];
    for (let k = 0; k < 16; k++) matrix[k] = node.inverseBind[k] / scale;
    return matrix;
}

// Linear blend skinning: the mesh positions in metres and its normals moved from the bind pose to the pose
export function skinMesh(mesh: Mesh, pose: Matrix[]): { positions: Float32Array; normals: Float32Array } {
    const skin = mesh.skin;
    if (skin === null) throw new Error(`${mesh.name} is not skinned`);
    const positions = new Float32Array(mesh.vertexCount * 3);
    const normals = new Float32Array(mesh.vertexCount * 3);
    const skinning = mesh.nodes.map((node, bone) => multiply(pose[bone], inverseBind(node)));
    for (let vertex = 0; vertex < mesh.vertexCount; vertex++) {
        const at = vertex * 3;
        const x = mesh.positions[at];
        const y = mesh.positions[at + 1];
        const z = mesh.positions[at + 2];
        const nx = mesh.normals[at];
        const ny = mesh.normals[at + 1];
        const nz = mesh.normals[at + 2];
        const position = [0, 0, 0];
        const normal = [0, 0, 0];
        for (let slot = 0; slot < 4; slot++) {
            const weight = skin[vertex * 20 + 12 + slot] / 255;
            if (weight === 0) continue;
            const m = skinning[skin[vertex * 20 + 16 + slot]];
            for (let axis = 0; axis < 3; axis++) {
                position[axis] += weight * (m[axis] * x + m[4 + axis] * y + m[8 + axis] * z + m[12 + axis]);
                normal[axis] += weight * (m[axis] * nx + m[4 + axis] * ny + m[8 + axis] * nz);
            }
        }
        const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;
        for (let axis = 0; axis < 3; axis++) {
            positions[at + axis] = position[axis] * CENTIMETRE;
            normals[at + axis] = normal[axis] / length;
        }
    }
    return { positions, normals };
}
