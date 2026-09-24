import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtureRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(fixtureRoot, '../../..');

export default defineConfig({
  root: fixtureRoot,
  publicDir: false,
  server: {
    host: '127.0.0.1',
    port: 4188,
    strictPort: true,
    fs: { allow: [repoRoot] }
  }
});
