/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        game: 'index.html',
        editor: 'editor.html',
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
