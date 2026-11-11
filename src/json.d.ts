// The data files the page imports, typed as docs/DATAFILES.md describes them

declare module '*/schema.json' {
    const schema: import('./types.ts').Schema;
    export default schema;
}

declare module '*/progress.json' {
    const progress: import('./types.ts').Progress;
    export default progress;
}

declare module '*/world.json' {
    const world: import('./types.ts').WorldFile;
    export default world;
}

declare module '*/walk.json' {
    const walk: import('./types.ts').WalkFile;
    export default walk;
}

declare module '*/level-cells.json' {
    const cells: Record<'underworld' | 'ground' | 'sky', string>;
    export default cells;
}

// Vite's import.meta.glob, as the page uses it: the default exports of the matched files, loaded with the page
interface ImportMeta {
    /** Vite's build mode flags; absent when a script runs the page's modules outside Vite. */
    readonly env?: { readonly DEV: boolean };
    glob(pattern: string, options: { query: string; import: 'default'; eager: true }): Record<string, string>;
}

declare module '*.txt?raw' {
    const text: string;
    export default text;
}
