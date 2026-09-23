/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Accesible desde el movil por la IP del PC, en la misma wifi.
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Leaflet cambia poco: en su propio trozo se cachea aparte de la app.
        manualChunks(id) {
          if (id.includes('node_modules/leaflet')) return 'leaflet';
          return undefined;
        },
      },
    },
  },
});
