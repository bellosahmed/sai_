import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // Tests share one Postgres DB; run files sequentially to avoid cross-file races.
    fileParallelism: false,
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
