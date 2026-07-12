import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative Pfade: deploybar via GitHub Pages oder simple Datei-Kopie (§2).
  base: './',
});
