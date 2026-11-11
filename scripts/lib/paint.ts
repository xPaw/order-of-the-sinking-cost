// Reader for the per-entity vertex paint of a level (data-common/<level>.all_paint_data, docs/gamedata.md)
import { readFileSync } from 'node:fs';
import type { Mesh } from './mesh.ts';
import * as paths from './paths.ts';

interface PaintArray {
    checksum: number;
    start: number;
    count: number;
}

export class PaintData {
    arrays: PaintArray[];
    file: Buffer;
    arrayOfPid: Map<number, number>;

    constructor(level: string) {
        const file = readFileSync(paths.game('data-common', `${level}.all_paint_data`));
        if (file.toString('latin1', 0, 4) !== 'allp') throw new Error(`${level}: not a paint file`);
        const entityCount = file.readUInt32LE(8);
        const arrayCount = file.readUInt32LE(12);
        this.arrays = [];
        let pos = 16;
        for (let index = 0; index < arrayCount; index++) {
            const checksum = file.readUInt32LE(pos);
            const count = file.readUInt32LE(pos + 4);
            this.arrays.push({ checksum, start: pos + 8, count });
            pos += 8 + count * 4;
        }
        this.file = file;
        this.arrayOfPid = new Map();
        for (let index = 0; index < entityCount; index++) {
            this.arrayOfPid.set(file.readUInt32LE(pos), file.readUInt32LE(pos + 4));
            pos += 8;
        }
    }

    // The RGBA bytes of an entity's paint for a mesh, or the mesh's own vertex colours when the entity has none that fit
    forMesh(pid: number, mesh: Mesh): Uint8Array {
        const index = this.arrayOfPid.get(pid);
        if (index === undefined) return mesh.colors;
        const paint = this.arrays[index];
        if (paint.checksum !== mesh.checksum || paint.count !== mesh.vertexCount) return mesh.colors;
        return this.file.subarray(paint.start, paint.start + paint.count * 4);
    }
}
