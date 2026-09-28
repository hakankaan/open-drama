import { defineConfig } from 'tsup';

// Bundles the API and the source-only contracts package; runtime dependencies stay external.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@open-drama/contracts'],
});
