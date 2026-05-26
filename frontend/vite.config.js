import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // ── PRODUCTION FIX: forward /socket.io requests to backend during dev ──
    // Prevents CORS issues when testing the production build locally.
    proxy: {
      '/socket.io': {
        target:  'http://localhost:3001',
        ws:       true,
        changeOrigin: true,
      },
    },
  },
  build: {
    // ── PRODUCTION FIX: generate source maps for easier debugging ──────────
    sourcemap: true,
  },
});
