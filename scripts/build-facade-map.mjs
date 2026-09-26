import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRoutes, generateOpenApi } from '../node/src/openapi.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_PATH = path.join(ROOT, 'common', 'facade-route-map.json');
const API_PATH = path.join(ROOT, 'common', 'openapi.json');
const EXCEPTIONS_PATH = path.join(ROOT, 'common', 'facade-route-exceptions.json');

function sourceLine(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

function canonicalPath(sourceLiteral) {
  return new URL(sourceLiteral, 'http://localhost').pathname;
}

export function extractLegacyBranches(source) {
  const branches = [];
  const exact = /request\.method\s*===\s*'([A-Z]+)'\s*&&\s*request\.url(?:\.split\('[^']*'\)\[0\])?\s*===\s*'([^']+)'/g;
  const prefix = /request\.method\s*===\s*'([A-Z]+)'\s*&&\s*request\.url\.startsWith\('([^']+)'\)/g;

  for (const match of source.matchAll(exact)) {
    branches.push({
      method: match[1],
      matcher: 'exact-url',
      sourceLiteral: match[2],
      path: canonicalPath(match[2]),
      sourceLine: sourceLine(source, match.index ?? 0)
    });
  }
  for (const match of source.matchAll(prefix)) {
    branches.push({
      method: match[1],
      matcher: 'url-prefix',
      sourceLiteral: match[2],
      path: canonicalPath(match[2]),
      sourceLine: sourceLine(source, match.index ?? 0)
    });
  }

  // The legacy server handles every OPTIONS request in this branch, not just
  // OPTIONS /health. The facade answers preflight locally and never dispatches
  // OPTIONS to either backend.
  const optionsWildcard = /request\.method\s*===\s*'OPTIONS'\s*\|\|/g;
  for (const match of source.matchAll(optionsWildcard)) {
    branches.push({
      method: 'OPTIONS',
      matcher: 'method-wildcard',
      sourceLiteral: '*',
      path: '*',
      sourceLine: sourceLine(source, match.index ?? 0)
    });
  }

  const unique = new Map();
  for (const branch of branches) {
    const key = `${branch.method}\0${branch.matcher}\0${branch.sourceLiteral}\0${branch.sourceLine}`;
    unique.set(key, branch);
  }
  return [...unique.values()].sort((a, b) =>
    a.method.localeCompare(b.method) || a.path.localeCompare(b.path) || a.matcher.localeCompare(b.matcher) || a.sourceLine - b.sourceLine
  );
}

function typedRouteMatches(route, method, pathname) {
  return route.method === method && (route.prefix ? pathname.startsWith(route.path) : pathname === route.path);
}

function entryCoversBranch(entry, branch) {
  if (entry.method !== branch.method) return false;
  if (branch.matcher === 'method-wildcard') return false;
  if (branch.matcher === 'url-prefix' && !branch.sourceLiteral.includes('?')) {
    return entry.match === 'prefix' && branch.path.startsWith(entry.path);
  }
  return entry.match === 'exact'
    ? entry.path === branch.path
    : branch.path.startsWith(entry.path);
}

function legacyBranchDisposition(branch, typedRoutes, exceptionRoutes) {
  if (branch.matcher === 'method-wildcard') {
    return {
      disposition: 'FACADE_CORS_PRELIGHT',
      owner: 'scripts/facade.mjs',
      reason: 'OPTIONS is answered by the facade before backend route selection.'
    };
  }
  if (branch.method === 'GET' && branch.path === '/health') {
    return {
      disposition: 'INTERNAL_BACKEND_HEALTH',
      owner: 'scripts/start.mjs',
      reason: 'The launcher probes the legacy backend directly at /health; this is not exposed through the browser facade.'
    };
  }
  const typed = typedRoutes.find(route => typedRouteMatches(route, branch.method, branch.path));
  if (typed) return { disposition: 'TYPED_CANONICAL_OWNER', owner: 'typed-server', reason: `Typed registration ${typed.method} ${typed.path} owns V1 behavior.` };
  const exception = exceptionRoutes.find(entry => entryCoversBranch(entry, branch));
  if (exception?.classification === 'LEGACY_COMPATIBILITY') {
    return { disposition: 'LEGACY_COMPATIBILITY', owner: exception.owner, reason: exception.reason };
  }
  if (exception?.classification === 'OUT_OF_V1') {
    return { disposition: 'OUT_OF_V1', owner: exception.owner, reason: exception.reason };
  }
  throw new Error(`unclassified legacy branch: ${branch.method} ${branch.sourceLiteral} at daemon/server.mjs:${branch.sourceLine}`);
}

function compareOpenApiRoutes(typedRoutes, openApiDocument) {
  const documented = new Set();
  for (const [pathname, operations] of Object.entries(openApiDocument.paths ?? {})) {
    for (const method of Object.keys(operations)) documented.add(`${method.toUpperCase()} ${pathname}`);
  }
  const typed = new Set(typedRoutes.map(route => `${route.method} ${route.path}`));
  const missingFromOpenApi = [...typed].filter(operation => !documented.has(operation));
  const missingFromTyped = [...documented].filter(operation => !typed.has(operation));
  if (missingFromOpenApi.length || missingFromTyped.length) {
    throw new Error(`OpenAPI/typed ownership mismatch: missingFromOpenApi=${missingFromOpenApi.join(',')} missingFromTyped=${missingFromTyped.join(',')}`);
  }
}

export function deriveFacadeRouteMap({ typedRoutes, openApiDocument, exceptions, legacySource }) {
  if (exceptions.schema !== 'covert.facade-route-exceptions.v1') throw new Error('unsupported facade route exceptions schema');
  compareOpenApiRoutes(typedRoutes, openApiDocument);

  const routes = typedRoutes.map(route => ({
    method: route.method,
    path: route.path,
    match: route.prefix ? 'prefix' : 'exact',
    target: 'ts',
    classification: 'PUBLIC_TYPED',
    owner: 'typed-server',
    rawResponse: Boolean(route.raw)
  }));
  const identities = new Set(routes.map(route => `${route.method} ${route.match} ${route.path}`));
  for (const exception of exceptions.routes) {
    const identity = `${exception.method} ${exception.match} ${exception.path}`;
    if (identities.has(identity)) throw new Error(`facade exception conflicts with typed registration: ${identity}`);
    if (typedRoutes.some(route => typedRouteMatches(route, exception.method, exception.path))) {
      throw new Error(`facade exception is shadowed by typed registration: ${identity}`);
    }
    identities.add(identity);
    routes.push(exception);
  }
  routes.sort((a, b) => a.method.localeCompare(b.method) || a.path.localeCompare(b.path) || a.match.localeCompare(b.match));

  const legacyBranches = extractLegacyBranches(legacySource);
  const expected = exceptions.legacySourceExpected;
  const counts = {
    exactUrl: legacyBranches.filter(branch => branch.matcher === 'exact-url').length,
    urlPrefix: legacyBranches.filter(branch => branch.matcher === 'url-prefix').length,
    methodWildcard: legacyBranches.filter(branch => branch.matcher === 'method-wildcard').length
  };
  if (JSON.stringify(counts) !== JSON.stringify(expected)) {
    throw new Error(`legacy source inventory changed; update its explicit disposition after review: expected=${JSON.stringify(expected)} actual=${JSON.stringify(counts)}`);
  }
  const legacySourceAudit = legacyBranches.map(branch => ({
    ...branch,
    ...legacyBranchDisposition(branch, typedRoutes, exceptions.routes)
  }));

  return {
    schema: 'covert.facade-route-map.v2',
    routes,
    upgrades: exceptions.upgrades,
    legacySourceAudit,
    generatedFrom: {
      typedOwner: 'node/src/openapi.ts buildRoutes()',
      publicContract: 'common/openapi.json',
      legacyExceptions: 'common/facade-route-exceptions.json'
    }
  };
}

export async function buildCurrentFacadeRouteMap() {
  const currentOpenApiText = await readFile(API_PATH, 'utf8');
  const currentOpenApi = JSON.parse(currentOpenApiText);
  const exceptions = JSON.parse(await readFile(EXCEPTIONS_PATH, 'utf8'));
  const legacySource = await readFile(path.join(ROOT, 'daemon', 'server.mjs'), 'utf8');
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'covert-facade-map-'));
  try {
    const typedRoutes = await buildRoutes(workspace, currentOpenApi.info.version);
    const generatedOpenApi = generateOpenApi(typedRoutes, currentOpenApi.info);
    if (`${JSON.stringify(generatedOpenApi, null, 2)}\n` !== currentOpenApiText) {
      throw new Error('common/openapi.json is stale; run npm run contracts before building the facade route map');
    }
    return deriveFacadeRouteMap({ typedRoutes, openApiDocument: currentOpenApi, exceptions, legacySource });
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

export async function main() {
  const generated = `${JSON.stringify(await buildCurrentFacadeRouteMap(), null, 2)}\n`;
  if (process.argv.includes('--check')) {
    const current = await readFile(MAP_PATH, 'utf8');
    if (current !== generated) throw new Error('facade route map drift detected; run node scripts/build-facade-map.mjs');
    console.log('method-aware facade route map is up to date');
    return;
  }
  await writeFile(MAP_PATH, generated, 'utf8');
  console.log(`written: ${MAP_PATH}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
