import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/web/src/app/**/*.test.ts'],
    coverage: { include: ['packages/**/*.ts'], exclude: ['**/*.test.ts'] },
  },
});
