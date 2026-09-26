// tests/arch/route-authority-coverage.test.ts
// Permanent Phase 2A invariant: every externally reachable TS route must have
// exactly one deliberate authority disposition:
//   PUBLIC | AUTHORITY_CONTROL | ENROLLED_CENTRAL | ENROLLED_DESCRIPTOR | EXPLICITLY_DISABLED
// There is no accidental sixth state, and overlapping dispositions fail.
//
// MIGRATION WAIVER: during Phase 2A, routes already accepted as
// READY-DESCRIPTOR or ARCHITECTURE-DECISION may be listed here while they await
// enrollment. The waiver is test-only bookkeeping: production never reads it,
// it grants no authority, it must shrink monotonically, and it must be empty
// before Phase 2A acceptance. A route cannot be both waived and dispositioned,
// and a new route cannot silently enter the waiver: the count is pinned and
// every entry must match a real route with zero runtime dispositions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRoutes } from '../../node/src/openapi.ts';
import { httpOperationKind } from '../../common/security/operation-policy.mjs';
import type { Route } from '../../node/src/server.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const PHASE2A_ACCEPTANCE_REQUESTED = false;
const EXPECTED_WAIVER_COUNT = 20;

type WaiverClassification = 'READY-DESCRIPTOR' | 'ARCHITECTURE-DECISION';
interface MigrationWaiverEntry { method: string; path: string; classification: WaiverClassification }

const MIGRATION_WAIVER: MigrationWaiverEntry[] = [
  { method: 'POST', path: '/api/dap/breakpoints', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/dap/configure', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/dap/continue', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/dap/disconnect', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/dap/launch', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/dap/request', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/dap/scopes', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/dap/stack', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/dap/start', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/dap/step', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/dap/stop', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/dap/variables', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/lsp/change', classification: 'READY-DESCRIPTOR' },
  { method: 'POST', path: '/api/lsp/close', classification: 'READY-DESCRIPTOR' },
  { method: 'POST', path: '/api/lsp/notify', classification: 'READY-DESCRIPTOR' },
  { method: 'POST', path: '/api/lsp/open', classification: 'READY-DESCRIPTOR' },
  { method: 'POST', path: '/api/lsp/request', classification: 'ARCHITECTURE-DECISION' },
  { method: 'POST', path: '/api/training/datasets/delete', classification: 'READY-DESCRIPTOR' },
  { method: 'POST', path: '/api/training/start', classification: 'READY-DESCRIPTOR' },
  { method: 'POST', path: '/api/training/stop', classification: 'READY-DESCRIPTOR' }
];

interface FacadeMap {
  routes: Array<{ method: string; path: string; match: 'exact' | 'prefix'; target: string; classification: string }>;
  upgrades?: Record<string, string>;
}

async function loadRouteSources(): Promise<Array<{ file: string; source: string }>> {
  const dir = path.join(repoRoot, 'node', 'src', 'routes');
  const files = (await fs.readdir(dir)).filter(file => file.endsWith('.ts'));
  const sources: Array<{ file: string; source: string }> = [];
  for (const file of files) sources.push({ file: `node/src/routes/${file}`, source: await fs.readFile(path.join(dir, file), 'utf8') });
  return sources;
}

function ownerOf(sources: Array<{ file: string; source: string }>, pathname: string): string {
  for (const { file, source } of sources) {
    if (source.includes(`'${pathname}'`) || source.includes(`"${pathname}"`)) return file;
  }
  return 'node/src/openapi.ts';
}

function facadeExposureOf(facade: FacadeMap, method: string, pathname: string): string {
  const exact = facade.routes.find(route => route.method === method && route.match === 'exact' && route.path === pathname);
  if (exact) return `exact:${exact.target}:${exact.classification}`;
  const prefix = facade.routes
    .filter(route => route.method === method && route.match === 'prefix' && pathname.startsWith(route.path))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (prefix) return `prefix:${prefix.target}:${prefix.classification}`;
  if (facade.upgrades?.[pathname]) return `upgrade:${facade.upgrades[pathname]}`;
  return 'direct-only';
}

test('every externally reachable TS route has exactly one deliberate authority disposition', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-route-authority-'));
  try {
    const routes = await buildRoutes(workspace, 'route-authority-coverage');
    const facade = JSON.parse(await fs.readFile(path.join(repoRoot, 'common', 'facade-route-map.json'), 'utf8')) as FacadeMap;
    const sources = await loadRouteSources();

    const problems: string[] = [];
    const rawOwnership: Record<string, number> = { PUBLIC: 0, AUTHORITY_CONTROL: 0, ENROLLED_CENTRAL: 0, ENROLLED_DESCRIPTOR: 0 };
    const finalDispositions: Record<string, number> = { PUBLIC: 0, AUTHORITY_CONTROL: 0, ENROLLED_CENTRAL: 0, ENROLLED_DESCRIPTOR: 0, 'MIGRATION-WAIVED': 0, CONFLICTING: 0, UNCLASSIFIED: 0 };

    const waiverKeys = new Set<string>();
    for (const entry of MIGRATION_WAIVER) {
      const key = `${entry.method} ${entry.path}`;
      if (waiverKeys.has(key)) problems.push(`WAIVER DUPLICATE ${key}`);
      waiverKeys.add(key);
    }

    const describeRoute = (route: Route): string =>
      `route=${route.method} ${route.path} owner=${ownerOf(sources, route.path)} facade=${facadeExposureOf(facade, route.method, route.path)} flags=raw:${Boolean(route.raw)},stream:${Boolean(route.stream)}`;

    const realKeys = new Set<string>();
    for (const route of routes) {
      const key = `${route.method} ${route.path}`;
      realKeys.add(key);

      const isPublic = route.method === 'GET' && route.path === '/api/health';
      const isControl = Boolean(route.authorityMode);
      const centralKind = httpOperationKind(route.method, route.path);
      const isCentral = centralKind !== null;
      const isDescriptor = Boolean(route.describeOperation);

      const detected: string[] = [];
      if (isPublic) detected.push('PUBLIC');
      if (isControl) detected.push(`AUTHORITY_CONTROL(${route.authorityMode})`);
      if (isCentral) detected.push(`ENROLLED_CENTRAL(${centralKind})`);
      if (isDescriptor) detected.push('ENROLLED_DESCRIPTOR');
      if (isPublic) rawOwnership.PUBLIC = (rawOwnership.PUBLIC ?? 0) + 1;
      if (isControl) rawOwnership.AUTHORITY_CONTROL = (rawOwnership.AUTHORITY_CONTROL ?? 0) + 1;
      if (isCentral) rawOwnership.ENROLLED_CENTRAL = (rawOwnership.ENROLLED_CENTRAL ?? 0) + 1;
      if (isDescriptor) rawOwnership.ENROLLED_DESCRIPTOR = (rawOwnership.ENROLLED_DESCRIPTOR ?? 0) + 1;

      const waived = waiverKeys.has(key);
      if (detected.length > 1) {
        finalDispositions.CONFLICTING = (finalDispositions.CONFLICTING ?? 0) + 1;
        problems.push(`CONFLICTING (exactly one owner required) ${describeRoute(route)} detected=[${detected.join(' + ')}]`);
      } else if (detected.length === 1) {
        if (waived) {
          finalDispositions.CONFLICTING = (finalDispositions.CONFLICTING ?? 0) + 1;
          problems.push(`WAIVED BUT DISPOSED (remove it from the migration waiver) ${describeRoute(route)} disposition=${detected[0]}`);
        } else {
          const primary = detected[0]!.split('(')[0]!;
          finalDispositions[primary] = (finalDispositions[primary] ?? 0) + 1;
        }
      } else if (waived) {
        finalDispositions['MIGRATION-WAIVED'] = (finalDispositions['MIGRATION-WAIVED'] ?? 0) + 1;
      } else {
        finalDispositions.UNCLASSIFIED = (finalDispositions.UNCLASSIFIED ?? 0) + 1;
        problems.push(`UNCLASSIFIED (no authority disposition, not in migration waiver) ${describeRoute(route)} detected=[]`);
      }
    }

    for (const entry of MIGRATION_WAIVER) {
      const key = `${entry.method} ${entry.path}`;
      if (!realKeys.has(key)) problems.push(`WAIVER STALE (no real route) ${key} classification=${entry.classification}`);
    }

    if (MIGRATION_WAIVER.length !== EXPECTED_WAIVER_COUNT) {
      problems.push(`WAIVER COUNT CHANGED expected=${EXPECTED_WAIVER_COUNT} actual=${MIGRATION_WAIVER.length} (update the pinned count deliberately)`);
    }
    if (PHASE2A_ACCEPTANCE_REQUESTED && MIGRATION_WAIVER.length > 0) {
      problems.push(`PHASE2A ACCEPTANCE BLOCKED: migration waiver still holds ${MIGRATION_WAIVER.length} routes`);
    }

    // Raw routes remain part of Authority accounting and public OpenAPI when
    // they are externally callable.
    for (const route of routes.filter(candidate => candidate.raw)) {
      if (httpOperationKind(route.method, route.path) === null && !route.authorityMode) {
        problems.push(`RAW ROUTE WITHOUT CENTRAL ENROLLMENT ${describeRoute(route)}`);
      }
    }

    // The facade route map is method-aware. Every typed registration must have
    // exactly one matching public TS entry; no prefix-only map may enroll extra
    // methods or expose a route that lacks Authority accounting.
    for (const route of routes) {
      const matching = facade.routes.filter(entry => entry.method === route.method && (
        entry.match === 'exact' ? entry.path === route.path : route.path.startsWith(entry.path)
      ));
      if (matching.length !== 1 || matching[0]?.target !== 'ts' || matching[0]?.classification !== 'PUBLIC_TYPED') {
        problems.push(`FACADE_TYPED_OWNERSHIP ${route.method} ${route.path} matches=${matching.length} target=${matching[0]?.target ?? 'NONE'} classification=${matching[0]?.classification ?? 'NONE'}`);
      }
    }
    for (const entry of facade.routes.filter(candidate => candidate.target === 'ts')) {
      const accounted = routes.some(route => route.method === entry.method && (
        entry.match === 'exact' ? route.path === entry.path : route.path.startsWith(entry.path)
      ));
      if (!accounted) problems.push(`FACADE_TS_UNACCOUNTED ${entry.method} ${entry.match} ${entry.path}`);
    }

    console.log(JSON.stringify({ routes: routes.length, rawOwnership, finalDispositions, waiver: MIGRATION_WAIVER.length }));
    assert.deepEqual(problems, [], `route authority coverage violations:\n${problems.join('\n')}`);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
