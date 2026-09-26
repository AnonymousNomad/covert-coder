import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRoutes, generateOpenApi } from '../../node/src/openapi.ts';
import { httpOperationKind, legacyOperation } from '../../common/security/operation-policy.mjs';
import { launchSupervisedStack } from '../helpers/supervised-stack.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspace = path.resolve(os.tmpdir(), 'aide-route-drift-gate');

type RouteIdentity = { method: string; path: string; match: 'exact' | 'prefix' };
type FacadeEntry = RouteIdentity & {
  target: 'ts' | 'legacy' | 'deny';
  classification: 'PUBLIC_TYPED' | 'LEGACY_COMPATIBILITY' | 'OUT_OF_V1';
  owner?: string;
  reason?: string;
  rawResponse?: boolean;
};
type RouteOwnershipDecisions = {
  typedMismatchDecisions: Array<{
    decision: string;
    method: string;
    path: string;
    legacyHandler: { requestShape?: string };
  }>;
  legacyOnlyDecisions: unknown[];
  legacyPrefixes: Array<{ sourcePrefixKind: string; disposition: string }>;
  counts: { internalRouteExclusions: number };
  internalRouteExclusions: unknown[];
  rawRoute: { classification: string };
  migrationWaivers: Array<{ stillRequired: boolean }>;
  c4_02Handoff: { status: string; modifiedHere: boolean };
};

function operationKeys(document: { paths: Record<string, Record<string, unknown>> }): string[] {
  return Object.entries(document.paths).flatMap(([pathname, methods]) =>
    Object.keys(methods).map(method => `${method.toUpperCase()} ${pathname}`)
  ).sort();
}

function manifestCapabilities(body: Record<string, unknown>): unknown[] | undefined {
  const data = body.data;
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const capabilities = (data as Record<string, unknown>).capabilities;
  return Array.isArray(capabilities) ? capabilities : undefined;
}

function typedMatches(entry: RouteIdentity, route: { method: string; path: string; prefix?: boolean }): boolean {
  return entry.method === route.method && (entry.match === 'exact'
    ? entry.path === route.path
    : route.path.startsWith(entry.path));
}

test('route ownership is generated from typed registrations and public OpenAPI, with no duplicate or shadowed operation', async () => {
  const routes = await buildRoutes(workspace, 'route-drift-gate');
  const generated = generateOpenApi(routes, { title: 'AIDE Arch Daemon API', version: '0.1.0' }) as { paths: Record<string, Record<string, unknown>> };
  const committed = JSON.parse(await readFile(path.join(repoRoot, 'common', 'openapi.json'), 'utf8')) as typeof generated;
  const map = JSON.parse(await readFile(path.join(repoRoot, 'common', 'facade-route-map.json'), 'utf8')) as {
    schema: string;
    routes: FacadeEntry[];
    upgrades: Record<string, string>;
    legacySourceAudit: Array<{ method: string; path: string; matcher: string; disposition: string }>;
  };
  const exceptions = JSON.parse(await readFile(path.join(repoRoot, 'common', 'facade-route-exceptions.json'), 'utf8')) as { routes: FacadeEntry[] };
  const frozenReproduction = JSON.parse(await readFile(path.join(repoRoot, 'docs', 'v1', 'routes', 'C1-02-ROUTE-DRIFT.json'), 'utf8')) as {
    classification: {
      typedRegistrationsMappedToLegacy: Array<{ method: string; path: string }>;
      legacyMethodPathOperationsMappedToTsWithoutTypedMatch: Array<string>;
    };
  };

  assert.deepEqual(operationKeys(committed), operationKeys(generated), 'OpenAPI operations must equal runtime typed registrations');
  assert.equal(map.schema, 'covert.facade-route-map.v2');

  const typedOperations = routes.map(route => ({
    method: route.method,
    path: route.path,
    match: route.prefix ? 'prefix' as const : 'exact' as const,
    rawResponse: Boolean(route.raw)
  }));
  const typedKeys = typedOperations.map(route => `${route.method} ${route.path}`);
  assert.equal(new Set(typedKeys).size, typedKeys.length, 'typed server has duplicate method/path registrations');
  assert.equal(routes.find(route => route.method === 'GET' && route.path === '/api/file')?.prefix, undefined,
    'file read is a query-based root operation, not a path-prefix API');
  assert.equal(routes.find(route => route.method === 'GET' && route.path === '/api/search')?.prefix, undefined,
    'search is a query-based root operation, not a path-prefix API');

  const publicEntries = map.routes.filter(route => route.classification === 'PUBLIC_TYPED');
  assert.deepEqual(
    publicEntries.map(({ method, path: routePath, match, rawResponse }) => ({ method, path: routePath, match, rawResponse: Boolean(rawResponse) }))
      .sort((a, b) => `${a.method} ${a.path} ${a.match}`.localeCompare(`${b.method} ${b.path} ${b.match}`)),
    typedOperations.sort((a, b) => `${a.method} ${a.path} ${a.match}`.localeCompare(`${b.method} ${b.path} ${b.match}`)),
    'every runtime registration, including raw public routes, has one method-aware facade owner'
  );

  const identities = map.routes.map(route => `${route.method} ${route.match} ${route.path}`);
  assert.equal(new Set(identities).size, identities.length, 'facade route map contains duplicate operations');
  const exceptionSort = (a: FacadeEntry, b: FacadeEntry) => `${a.method} ${a.path} ${a.match}`.localeCompare(`${b.method} ${b.path} ${b.match}`);
  assert.deepEqual(
    map.routes.filter(route => route.classification !== 'PUBLIC_TYPED').sort(exceptionSort),
    [...exceptions.routes].sort(exceptionSort),
    'every non-typed facade entry must come from the explicit reviewed exception manifest'
  );

  for (const route of routes) {
    const matching = map.routes.filter(entry => typedMatches(entry, route));
    assert.equal(matching.length, 1, `${route.method} ${route.path} has ${matching.length} facade owners`);
    assert.equal(matching[0]?.target, 'ts', `${route.method} ${route.path} does not dispatch to canonical typed owner`);
    assert.equal(matching[0]?.classification, 'PUBLIC_TYPED');
  }

  for (let index = 0; index < routes.length; index++) {
    const route = routes[index]!;
    const priorShadow = routes.slice(0, index).find(candidate => candidate.method === route.method &&
      (candidate.prefix ? route.path.startsWith(candidate.path) : route.path === candidate.path));
    assert.equal(priorShadow, undefined, `registration-order shadow: ${priorShadow?.method} ${priorShadow?.path} hides ${route.method} ${route.path}`);
  }

  const allowedLegacyDispositions = new Set([
    'TYPED_CANONICAL_OWNER', 'LEGACY_COMPATIBILITY', 'OUT_OF_V1',
    'INTERNAL_BACKEND_HEALTH', 'FACADE_CORS_PRELIGHT'
  ]);
  for (const branch of map.legacySourceAudit) {
    assert.ok(allowedLegacyDispositions.has(branch.disposition), `unclassified legacy branch ${branch.method} ${branch.path}`);
    if (branch.disposition === 'TYPED_CANONICAL_OWNER') {
      assert.ok(routes.some(route => route.method === branch.method && (route.prefix ? branch.path.startsWith(route.path) : route.path === branch.path)),
        `legacy source branch has no typed owner: ${branch.method} ${branch.path}`);
    }
    if (branch.disposition === 'LEGACY_COMPATIBILITY' || branch.disposition === 'OUT_OF_V1') {
      assert.ok(exceptions.routes.some(entry => entry.method === branch.method && (entry.match === 'exact'
        ? entry.path === branch.path
        : branch.path.startsWith(entry.path))), `legacy branch lacks an explicit disposition: ${branch.method} ${branch.path}`);
    }
  }

  assert.ok(map.routes.some(route => route.method === 'GET' && route.path === '/api/openapi.json' && route.rawResponse === true),
    'the public raw OpenAPI route must be documented and facade-owned');
  assert.equal(map.upgrades['/ws'], 'ts', 'WebSocket ownership remains an explicit upgrade mapping');

  for (const priorMismatch of frozenReproduction.classification.typedRegistrationsMappedToLegacy) {
    const owners = map.routes.filter(route => route.method === priorMismatch.method && route.path === priorMismatch.path);
    assert.equal(owners.length, 1, `reproduced typed route lost its unique facade entry: ${priorMismatch.method} ${priorMismatch.path}`);
    assert.equal(owners[0]?.target, 'ts', `reproduced typed route is not returned to the canonical typed owner: ${priorMismatch.method} ${priorMismatch.path}`);
  }
  const legacyOnlyDecisions = new Map([
    ['GET /api/models', 'deny'],
    ['GET /api/git/diff', 'deny'],
    ['GET /api/git/log', 'deny'],
    ['POST /api/providers/chat', 'deny'],
    ['POST /api/workflow/apply', 'deny'],
    ['POST /api/workflow/plan', 'deny'],
    ['POST /api/handoff/propose', 'deny'],
    ['POST /api/handoff/continue', 'deny']
  ]);
  for (const operation of frozenReproduction.classification.legacyMethodPathOperationsMappedToTsWithoutTypedMatch) {
    const route = map.routes.find(entry => `${entry.method} ${entry.path}` === operation);
    assert.ok(route, `legacy-only baseline operation has no current disposition: ${operation}`);
    assert.equal(route.target, legacyOnlyDecisions.get(operation), `legacy-only operation disposition changed: ${operation}`);
  }
});

test('committed facade ownership and legacy dispositions are reproducible from current owners', () => {
  const result = spawnSync(process.execPath, ['scripts/build-facade-map.mjs', '--check'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true
  });
  assert.equal(result.error, undefined, result.error?.message ?? 'facade map check failed to spawn');
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /method-aware facade route map is up to date/);
});

test('C1-02 per-operation decisions and compatibility evidence are reproducible', async () => {
  const result = spawnSync(process.execPath, ['scripts/build-c1-02-route-ownership-decisions.mjs', '--check'], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true
  });
  assert.equal(result.error, undefined, result.error?.message ?? 'route ownership decision check failed to spawn');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const decisions = JSON.parse(await readFile(path.join(repoRoot, 'docs', 'v1', 'routes', 'C1-02-ROUTE-OWNERSHIP-DECISIONS.json'), 'utf8')) as RouteOwnershipDecisions;
  assert.equal(decisions.typedMismatchDecisions.length, 35);
  assert.equal(decisions.legacyOnlyDecisions.length, 14);
  assert.ok(decisions.typedMismatchDecisions.every(item => item.decision === 'MOVE FACADE TO TYPED'));
  assert.equal(decisions.typedMismatchDecisions.find(item => item.method === 'POST' && item.path === '/api/training/start')?.legacyHandler.requestShape, '{id, approved:true}');
  assert.equal(decisions.legacyPrefixes.length, 9);
  assert.ok(decisions.legacyPrefixes.every(item => ['QUERY_VARIANT_PREFIX', 'PATH_PREFIX'].includes(item.sourcePrefixKind) && item.disposition));
  assert.equal(decisions.counts.internalRouteExclusions, 0);
  assert.deepEqual(decisions.internalRouteExclusions, []);
  assert.equal(decisions.rawRoute.classification, 'PUBLIC API');
  assert.equal(decisions.migrationWaivers.length, 20);
  assert.ok(decisions.migrationWaivers.every(item => item.stillRequired));
  assert.equal(decisions.c4_02Handoff.status, 'BLOCKED — V1 BLOCKER');
  assert.equal(decisions.c4_02Handoff.modifiedHere, false);
});

test('legacy diagnostics adapter has exact read Authority and refuses its query mutation form', () => {
  assert.equal(httpOperationKind('GET', '/api/diagnostics'), 'capability.read');
  const read = legacyOperation('fixture-workspace', { method: 'GET', path: '/api/diagnostics', task_id: 'route-drift-read' });
  assert.equal(read.kind, 'capability.read');
  assert.throws(
    () => legacyOperation('fixture-workspace', { method: 'GET', path: '/api/diagnostics?clear=file%3A%2F%2F%2Fworkspace%2Ftest.ts', task_id: 'route-drift-clear' }),
    /read-only compatibility adapter/
  );
});

test('representative facade probes reach the canonical owner and preserve explicit legacy compatibility', async () => {
  const probeWorkspace = await mkdtemp(path.join(os.tmpdir(), 'aide-c1-route-probes-'));
  const stack = await launchSupervisedStack({ workspace: probeWorkspace });
  try {
    const health = await stack.json('facade', 'GET', '/api/health', { envelope: false });
    assert.equal(health.status, 200);
    assert.equal(typeof health.body.version, 'string');
    assert.ok(Array.isArray(health.body.components));

    const trainingFacade = await stack.json('facade', 'GET', '/api/training/status', { envelope: false });
    const trainingTyped = await stack.json('ts', 'GET', '/api/training/status');
    const trainingLegacy = await stack.json('legacy', 'GET', '/api/training/status', { envelope: false });
    assert.equal(trainingFacade.status, 200);
    assert.deepEqual(trainingFacade.body, { state: 'idle' });
    assert.deepEqual(trainingTyped.body.data, trainingFacade.body);
    assert.equal(trainingLegacy.status, 200);
    assert.deepEqual(Object.keys(trainingLegacy.body).sort(), ['active', 'jobs', 'logs']);

    const egress = await stack.json('facade', 'GET', '/api/egress/manifest');
    const egressTyped = await stack.json('ts', 'GET', '/api/egress/manifest');
    assert.equal(egress.status, 200);
    assert.equal(egressTyped.status, 200);
    assert.equal(egress.body.ok, true);
    const facadeCapabilities = manifestCapabilities(egress.body);
    const typedCapabilities = manifestCapabilities(egressTyped.body);
    assert.ok(facadeCapabilities, 'facade envelope contains the manifest capability list');
    assert.ok(typedCapabilities, 'typed response contains the manifest capability list');
    assert.deepEqual(facadeCapabilities, typedCapabilities,
      'facade-selected typed owner preserves the direct typed manifest capability payload');

    const fileDescendant = await stack.json('facade', 'GET', '/api/file/extra?path=README.md', { envelope: false });
    assert.equal(fileDescendant.status, 404, 'undocumented file path descendants do not inherit the query-based file route');
    const searchDescendant = await stack.json('facade', 'GET', '/api/search/extra?q=fixture', { envelope: false });
    assert.equal(searchDescendant.status, 404, 'undocumented search path descendants do not inherit the query-based search route');
    const fileSimilarPrefix = await stack.json('facade', 'GET', '/api/filesecrets?path=README.md', { envelope: false });
    assert.equal(fileSimilarPrefix.status, 404, 'a path sharing the file route prefix is not a file operation');

    const diagnostics = await stack.json('facade', 'GET', '/api/diagnostics', { envelope: false });
    assert.equal(diagnostics.status, 200);
    assert.ok(Array.isArray(diagnostics.body.diagnostics));

    const clearDiagnostics = await stack.json('facade', 'GET', '/api/diagnostics?clear=file%3A%2F%2F%2Fworkspace%2Fprobe.ts', { envelope: false });
    assert.equal(clearDiagnostics.status, 409);
    assert.equal(Object.hasOwn(clearDiagnostics.body, 'cleared'), false, 'query mutation is denied before the legacy handler');

    const legacyWorkflow = await stack.json('facade', 'POST', '/api/workflow/plan', {
      body: { modelId: 'fixture', task: 'must not execute' }, envelope: false
    });
    assert.equal(legacyWorkflow.status, 404, 'development-only untyped workflow calls are outside the V1 facade');

    const openApi = await stack.request('facade', 'GET', '/api/openapi.json', { envelope: false });
    assert.equal(openApi.status, 200);
    const document = await openApi.json() as { openapi: string; paths: Record<string, unknown> };
    assert.equal(document.openapi, '3.0.3');
    assert.ok(document.paths['/api/openapi.json']);
  } finally {
    await stack.close();
    await rm(probeWorkspace, { recursive: true, force: true });
  }
});
