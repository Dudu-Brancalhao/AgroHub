import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * The API owns port 3000, so the dev server takes Vite's default 5173.
 *
 * Every request the client makes is relative (`/api/...`), and this proxy forwards it. That is
 * what keeps the browser on a single origin: the backend never calls `enableCors()`, so a
 * genuinely cross-origin dev setup would be blocked outright (research.md R-006).
 *
 * In production the built bundle and the API must sit behind one origin for the same reason,
 * with the static host falling back to index.html so a reloaded deep link does not 404.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },

  /**
   * `vite preview` serves the built bundle and does NOT inherit `server.proxy`, so without this
   * every `/api` call 404s against the static server — the built app would look broken for a
   * reason that has nothing to do with the build.
   */
  preview: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
