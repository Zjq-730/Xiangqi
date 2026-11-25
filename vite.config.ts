import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pikafishVitePlugin } from './server/pikafishBridge';
import { roomVitePlugin } from './server/roomBridge';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), pikafishVitePlugin(rootDir), roomVitePlugin()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/deepseek/, ''),
      },
    },
  },
});
