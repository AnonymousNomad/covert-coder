import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname, '../../browser'),
  base: '/',
  preview: {
    host: '127.0.0.1',
    port: 4174,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4878', changeOrigin: false },
      '/ws': { target: 'ws://127.0.0.1:4878', ws: true, changeOrigin: false }
    }
  }
});
