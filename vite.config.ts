import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// base relativa: funziona su GitHub Pages (/<repo>/) e in locale.
// VITE_ARTIFACT=1: build senza service worker, impacchettata in un solo file da scripts/build-artifact.mjs.
const artifact = !!process.env.VITE_ARTIFACT;

export default defineConfig({
  base: './',
  build: artifact ? { outDir: 'dist-artifact', emptyOutDir: true } : undefined,
  plugins: [
    react(),
    !artifact && VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Zone Planner',
        short_name: 'Zona',
        description: 'Pasti a Zona per due: blocchi, bilanciamento, archivio alimenti.',
        lang: 'it',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#c9c7c0',
        theme_color: '#c9c7c0',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
