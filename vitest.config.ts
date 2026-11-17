import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'vitest-jwt-secret-that-is-at-least-32-chars',
      JWT_EXPIRES_IN: '1h',
      MONGO_URI: 'mongodb://127.0.0.1:27017/note_taker_test',
      CORS_ORIGIN: 'http://localhost:5174',
    },
  },
});
