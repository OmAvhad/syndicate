import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    server: {
      deps: {
        inline: ['@kohaku-eth/plugins', '@kohaku-eth/railgun', '@kohaku-eth/provider'],
      },
    },
  },
});
