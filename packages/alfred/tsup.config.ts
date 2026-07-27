import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

// The workspace link points at TypeScript source, so every build inlines the
// core rather than resolving a published package.
const alias = {
  '@br-faker/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
};

export default defineConfig([
  // The development CLI, used to exercise generators without going via Alfred.
  {
    entry: ['src/cli.ts', 'src/bin.ts'],
    format: ['esm'],
    target: 'node20',
    clean: true,
    sourcemap: true,
    esbuildOptions(options) {
      options.alias = alias;
    },
  },
  // Alfred: a single file with everything inlined, so the workflow runs with
  // no node_modules beside it and no global install.
  {
    entry: { 'br-faker': 'src/alfred-bin.ts' },
    outDir: 'dist/workflow',
    format: ['cjs'],
    target: 'node20',
    noExternal: [/.*/],
    clean: false,
    sourcemap: false,
    minify: true,
    esbuildOptions(options) {
      options.alias = alias;
    },
  },
]);
