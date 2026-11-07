import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Keep the SDK's import.meta.url-relative WASM asset resolvable in development.
  optimizeDeps: { exclude: ['@kohaku-eth/railgun'] },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
