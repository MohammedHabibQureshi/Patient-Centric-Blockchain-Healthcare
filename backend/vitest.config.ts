import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
    setupFiles: [],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});