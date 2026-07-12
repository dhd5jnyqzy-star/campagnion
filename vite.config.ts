import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // PWA (§2/M5): Vollbild-Installation über Safari ("Zum Home-Bildschirm"),
    // Precache aller Build-Assets → Boot ohne Netz. Achtung: Service Worker
    // brauchen einen Secure Context (https oder localhost) — beim http-LAN-
    // Test bleibt die App normal lauffähig, nur ohne Offline-Cache.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Campagnion',
        short_name: 'Campagnion',
        description: 'Offline-first GM-Tool für D&D-Kampagnen',
        lang: 'de',
        theme_color: '#0f1115',
        background_color: '#0f1115',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  // Relative Pfade: deploybar via GitHub Pages oder simple Datei-Kopie (§2).
  base: './',
});
