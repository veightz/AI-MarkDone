import { defineConfig } from 'vite';
import { resolve } from 'path';
import { escapeUtf8JavaScriptNoncharacters } from './config/extension/utf8JavaScript';

export default defineConfig({
    base: './',
    esbuild: {
        charset: 'utf8',
    },
    plugins: [escapeUtf8JavaScriptNoncharacters()],
    define: {
    },
    build: {
        modulePreload: {
            polyfill: false,
        },
        rollupOptions: {
            preserveEntrySignatures: 'exports-only',
            input: {
                reader: resolve(__dirname, 'src/runtimes/reader/entry.ts'),
                'content-features': resolve(__dirname, 'src/runtimes/content/contentFeatures.ts'),
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'content-feature-chunks/[name]-[hash].js',
                // Merge small shared helpers without merging independent lazy feature entries.
                experimentalMinChunkSize: 128_000,
                format: 'es',
            },
        },
        outDir: 'dist-firefox',
        emptyOutDir: false,
        minify: 'esbuild',
        sourcemap: false,
        target: 'esnext',
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            'vfile-location': resolve(__dirname, './src/utils/markdown/vfile-location-shim.ts'),
        },
    },
});
