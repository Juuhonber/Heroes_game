import { defineConfig } from 'vitest/config';

// Ratatestit ajavat täydellisen haun jokaiselle radalle; ne kestävät sekunteja.
export default defineConfig({
  test: {
    testTimeout: 120_000,
  },
});
