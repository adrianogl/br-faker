import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

export default defineConfig({
  // Each entry is a separate context Chrome loads on its own: the service
  // worker, the injected content script, and the two extension pages. They
  // cannot share chunks, so the core is inlined into each.
  entry: {
    background: 'src/background.ts',
    content: 'src/content.ts',
    floating: 'src/floating.ts',
    picker: 'src/picker.ts',
    popup: 'src/popup.ts',
    options: 'src/options.ts',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'chrome114',
  splitting: false,
  noExternal: [/.*/],
  clean: true,
  sourcemap: false,
  minify: true,
  esbuildOptions(options) {
    options.alias = {
      '@br-faker/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    };
  },
});
