import { defineConfig } from 'vite';

export default defineConfig({
  root: 'site',
  base: '/stringbed/',
  publicDir: '../assets',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
