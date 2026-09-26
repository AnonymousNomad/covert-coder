import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildRoutes, generateOpenApi } from '../../node/src/openapi.ts';

// The notifications wiring demands an absolute workspace; use a real absolute
// path on every platform (the generated document is path-independent).
const WORKSPACE = path.resolve(tmpdir(), 'aide-openapi-drift');

test('openapi.json is up to date (run npm run contracts to regenerate)', async () => {
  const routes = await buildRoutes(WORKSPACE, '0.1.0');
  const generated = JSON.stringify(generateOpenApi(routes, { title: 'AIDE Arch Daemon API', version: '0.1.0' }), null, 2) + '\n';
  const committed = await readFile(new URL('../../common/openapi.json', import.meta.url), 'utf8');
  assert.equal(generated, committed, 'drift detected: regenerate with npm run contracts');
});

test('openapi.json documents every registered public operation', async () => {
  const routes = await buildRoutes(WORKSPACE, '0.1.0');
  const doc = generateOpenApi(routes, { title: 'AIDE Arch Daemon API', version: '0.1.0' }) as { paths: Record<string, unknown> };
  const rawRoutes = routes.filter(route => route.raw);
  assert.deepEqual(rawRoutes.map(route => `${route.method} ${route.path}`), ['GET /api/openapi.json'], 'the raw OpenAPI discovery endpoint is public, not an internal exclusion');
  for (const route of routes) {
    assert.ok(Object.hasOwn(doc.paths, route.path), `route ${route.method} ${route.path} missing from openapi.json`);
    const operation = (doc.paths[route.path] as Record<string, unknown>)[route.method.toLowerCase()];
    assert.ok(operation !== undefined, `method ${route.method} missing for ${route.path}`);
  }
  assert.ok(Object.keys(doc.paths).includes('/api/health'));
  assert.ok(Object.keys(doc.paths).includes('/api/search'));
});
