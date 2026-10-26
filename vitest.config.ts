import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['packages/**/*.spec.ts', 'apps/web/src/app/**/*.spec.ts'],
    coverage: { include: ['packages/**/*.ts'], exclude: ['**/*.spec.ts'] },
  },
});
