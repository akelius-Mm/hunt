import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Phaser alone is about 1.2 MB minified.
  build: { chunkSizeWarningLimit: 2000 },
});
