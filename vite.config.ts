/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    ...(command === 'build' ? [legacy()] : [])
  ],
  server: {
    sourcemapIgnoreList: () => false,
    watch: { usePolling: true, interval: 100 }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      external: [
        'better-sqlite3'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
}))
