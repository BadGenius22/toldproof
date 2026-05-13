import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // Ensure the test runner sees the Web Crypto API globally; Node 24 has it
    // but Vitest's setup sometimes needs the explicit hint.
    globals: false,
  },
});
