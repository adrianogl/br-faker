import { defineConfig } from 'tsup';

export default defineConfig([
  // Library plus the development CLI, resolving deps from node_modules.
  {
    entry: ['src/index.ts', 'src/cli.ts', 'src/bin.ts'],
    format: ['esm'],
    target: 'node20',
    dts: { entry: 'src/index.ts' },
    clean: true,
    sourcemap: true,
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
  },
]);
