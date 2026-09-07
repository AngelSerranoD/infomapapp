/*
 * InfoMap
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 *
 * Obra original de Ángel Serrano Domínguez <angelsd7704@gmail.com>.
 * Prohibida su copia, modificación o distribución sin autorización expresa
 * y por escrito del autor. Véase el archivo LICENSE.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import './styles/sheet.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// El service worker solo se registra en la versión compilada: en desarrollo
// estorba más que ayuda porque sirve ficheros viejos.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* sin service worker la app sigue funcionando, solo pierde el modo sin conexión */
    });
  });
}
