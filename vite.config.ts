import { createReadStream, realpathSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite-plus';
import { FOG_TYPE, LATEST_TYPES, PAGE_ENUMS } from './src/schema-types.ts';
import type { Schema, SchemaField } from './src/types.ts';
import { savesDir } from './scripts/saves.ts';

const ROOT = import.meta.dirname;
const DIST = resolve(ROOT, 'dist');

// On the dev server /saves/<campaign>/<file> reads the game's save folder: GET and HEAD only, and anything that resolves
// outside the folder (backslashes, drive letters, ..) is not found
function saves(): Plugin {
    return {
        name: 'soko:saves',
        configureServer(server) {
            server.middlewares.use('/saves', (req, res) => {
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    res.statusCode = 405;
                    res.setHeader('Allow', 'GET, HEAD');
                    res.end();
                    return;
                }
                let full: string | null = null;
                try {
                    const base = realpathSync.native(savesDir());
                    const rel = decodeURIComponent(new URL(req.url ?? '', 'http://x').pathname);
                    const p = realpathSync.native(resolve(base, ...rel.split('/').filter(Boolean)));
                    if ((p === base || p.startsWith(base + sep)) && statSync(p).isFile()) full = p;
                } catch {}
                if (!full) {
                    res.statusCode = 404;
                    res.end();
                    return;
                }
                res.setHeader('Content-Type', 'application/octet-stream');
                res.setHeader('Content-Length', String(statSync(full).size));
                res.setHeader('Cache-Control', 'no-store');
                if (req.method === 'HEAD') res.end();
                else createReadStream(full).pipe(res);
            });
        },
    };
}

// The page decodes only the entity types and reads only the enums of src/schema-types.ts, and only the field keys
// of src/blob.ts; the schema's other types and enums, field notes, addresses and sizes are for the docs and scripts
interface PageField {
    n: string;
    v: SchemaField['v'];
    k: SchemaField['k'];
    sz?: number;
    t: string;
    e?: PageField;
}

interface PageType {
    version: number;
    fields?: PageField[];
    missing?: boolean;
}

function schemaForPage(): Plugin {
    const pageTypes = new Set([...LATEST_TYPES, FOG_TYPE]);
    const pageEnums = new Set(PAGE_ENUMS);

    function pageField(field: SchemaField): PageField {
        const kept: PageField = { n: field.n, v: field.v, k: field.k, t: field.t };
        if (field.sz !== undefined) kept.sz = field.sz;
        if (field.e) kept.e = pageField(field.e);
        return kept;
    }

    return {
        name: 'soko:schema',
        enforce: 'pre',
        transform(code, id) {
            if (!id.replace(/\\/g, '/').endsWith('/data/schema.json')) return null;
            const schema: Schema = JSON.parse(code);
            const types: Record<string, PageType> = {};
            for (const [name, type] of Object.entries(schema.types)) {
                if (!pageTypes.has(name)) continue;
                const pageType: PageType = { version: type.version };
                if (type.fields) pageType.fields = type.fields.map(pageField);
                if (type.missing) pageType.missing = type.missing;
                types[name] = pageType;
            }
            const enums: Schema['enums'] = {};
            for (const [name, schemaEnum] of Object.entries(schema.enums)) {
                if (pageEnums.has(name)) enums[name] = schemaEnum;
            }
            const base = { name: schema.base.name, fields: schema.base.fields.map(pageField) };
            return { code: JSON.stringify({ base, types, enums }), map: null };
        },
    };
}

// The source maps leave out the contents of the JSON data files
function scriptMap(): Plugin {
    return {
        name: 'soko:script-map',
        apply: 'build',
        enforce: 'post',
        generateBundle(_options, bundle) {
            for (const output of Object.values(bundle)) {
                if (output.type !== 'chunk' || !output.map) continue;

                const map = output.map;
                const sourcesContent = map.sourcesContent.map((content, index) => {
                    if (map.sources[index].endsWith('.json')) return null;
                    return content;
                });
                Object.assign(map, { sourcesContent });

                const file = bundle[`${output.fileName}.map`];
                if (file && file.type === 'asset') file.source = JSON.stringify(map);
            }
        },
    };
}

// The source map lists the sources relative to the repository, with forward slashes
function repoRelativeSource(source: string, mapPath: string): string {
    const absolute = resolve(dirname(mapPath), source);
    return relative(ROOT, absolute).replace(/\\/g, '/');
}

// /levels/ is a static page of every level by area, built from the level data; an empty list fails the build
function levelsPage(): Plugin {
    return {
        name: 'soko:levels-page',
        apply: 'build',
        async generateBundle() {
            const { levelSections, levelsPageHtml } = await import('./scripts/lib/levels-page.ts');
            const sections = levelSections();
            if (sections.length === 0) this.error('no levels for the levels page: run npm run data');
            this.emitFile({ type: 'asset', fileName: 'levels/index.html', source: levelsPageHtml(sections) });
        },
    };
}

export default defineConfig({
    root: resolve(ROOT, 'src'),
    base: './',
    publicDir: resolve(ROOT, 'public'),
    plugins: [saves(), schemaForPage(), scriptMap(), levelsPage()],
    json: { namedExports: false, stringify: true },
    server: { host: '127.0.0.1', port: 8765, strictPort: true },
    build: {
        outDir: DIST,
        emptyOutDir: true,
        // the script is minified in rolldownOptions below, keeping its names
        minify: false,
        cssMinify: true,
        // the icons and map images stay files, which get a hash in their names; the thumbnails are inlined by their import
        assetsInlineLimit: 0,
        sourcemap: true,
        modulePreload: { polyfill: false },
        reportCompressedSize: false,
        rolldownOptions: {
            input: resolve(ROOT, 'src/index.html'),
            output: {
                format: 'es',
                minify: { compress: true, mangle: false, codegen: { removeWhitespace: true } },
                sourcemapPathTransform: repoRelativeSource,
            },
        },
    },
    test: {
        root: ROOT,
        include: ['tests/**/*.test.{js,ts}'],
        testTimeout: 120000,
        // Node warns on the first read of its localStorage; the tests run with storage unavailable
        execArgv: ['--no-webstorage'],
    },
    fmt: {
        printWidth: 120,
        singleQuote: true,
        semi: true,
        tabWidth: 4,
        useTabs: false,
        endOfLine: 'lf',
        ignorePatterns: ['data/**', '**/*.json', 'dist/**', 'node_modules/**', 'scripts/lib/level-table.ts'],
    },
    lint: {
        ignorePatterns: ['data/**', 'dist/**', 'node_modules/**'],
        options: { typeAware: true, typeCheck: true },
        categories: { correctness: 'error', suspicious: 'error' },
        rules: {
            'no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                },
            ],
            eqeqeq: ['error', 'always', { null: 'ignore' }],
            'no-shadow': 'error',
            // helpers stay next to the code that uses them
            'unicorn/consistent-function-scoping': 'off',
        },
    },
});
