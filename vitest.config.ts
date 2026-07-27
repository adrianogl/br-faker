import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@br-faker/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    // The extension's DOM tests need a document; everything else is plain Node.
    environmentMatchGlobs: [['packages/extension/**', 'jsdom']],
    include: ['packages/*/test/**/*.test.ts'],
  },
});
