import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 90000,
    hookTimeout: 90000,
    server: {
      deps: {
        inline: ['@kohaku-eth/plugins', '@kohaku-eth/railgun', '@kohaku-eth/provider'],
      },
    },
  },
});
