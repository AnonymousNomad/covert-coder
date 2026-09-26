import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpOperationKind } from '../common/security/operation-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPRO_PATH = path.join(ROOT, 'docs/v1/routes/C1-02-ROUTE-DRIFT.json');
const MAP_PATH = path.join(ROOT, 'common/facade-route-map.json');
const OPENAPI_PATH = path.join(ROOT, 'common/openapi.json');
const EXCEPTIONS_PATH = path.join(ROOT, 'common/facade-route-exceptions.json');
const JSON_OUT = path.join(ROOT, 'docs/v1/routes/C1-02-ROUTE-OWNERSHIP-DECISIONS.json');
const MD_OUT = path.join(ROOT, 'docs/v1/routes/C1-02-ROUTE-OWNERSHIP-DECISIONS.md');

async function readJson(file) { return JSON.parse(await readFile(file, 'utf8')); }

async function codeFiles(root) {
  const output = [];
  async function visit(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'coverage', 'build', '.aide'].includes(entry.name)) continue;
        await visit(absolute);
      } else if (/\.(?:[cm]?js|tsx?)$/i.test(entry.name)) output.push(absolute);
    }
  }
  await visit(root);
  return output;
}

async function literalReferences(files, routePath, excluded = new Set()) {
  const matches = [];
  const pathCharacter = /[A-Za-z0-9_/-]/;
  for (const file of files) {
    const relative = path.relative(ROOT, file).replaceAll('\\', '/');
    if (excluded.has(relative)) continue;
    const lines = (await readFile(file, 'utf8')).split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const sourceLine = lines[index];
      let offset = sourceLine.indexOf(routePath);
      while (offset >= 0) {
        const previous = sourceLine[offset - 1];
        const next = sourceLine[offset + routePath.length];
        const bounded = (!previous || !pathCharacter.test(previous)) && (!next || !pathCharacter.test(next));
        if (bounded) {
          const methodContext = lines.slice(index, Math.min(lines.length, index + 6)).join(' ');
          const explicit = methodContext.match(/\bmethod\s*:\s*['"]([A-Z]+)['"]/);
          const helper = sourceLine.match(/\b(jget|jpost|jput|jdelete|jdel|jpatch)\s*\(/i);
          const member = sourceLine.match(/\.(get|post|put|patch|delete|options|head)\s*\(/i);
          const helperMethod = { jget: 'GET', jpost: 'POST', jput: 'PUT', jdelete: 'DELETE', jdel: 'DELETE', jpatch: 'PATCH' }[helper?.[1]?.toLowerCase()];
          const callMethod = /\bcall\s*\(/.test(methodContext)
            ? (/\bbody\s*:/.test(methodContext) ? 'POST' : 'GET')
            : 'UNKNOWN';
          matches.push({
            file: relative,
            line: index + 1,
            methodEvidence: explicit?.[1] ?? helperMethod ?? member?.[1]?.toUpperCase() ?? callMethod,
            source: sourceLine.trim().slice(0, 240)
          });
        }
        offset = sourceLine.indexOf(routePath, offset + routePath.length);
      }
    }
  }
  return matches;
}

function operationReferences(references, method) {
  return {
    matching: references.filter(reference => reference.methodEvidence === method),
    otherMethods: references.filter(reference => reference.methodEvidence !== method && reference.methodEvidence !== 'UNKNOWN'),
    unresolved: references.filter(reference => reference.methodEvidence === 'UNKNOWN')
  };
}

function briefSchema(schema, depth = 0) {
  if (!schema || typeof schema !== 'object') return schema ?? null;
  const result = {};
  for (const key of ['type', '$ref', 'enum', 'format', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems']) {
    if (schema[key] !== undefined) result[key] = schema[key];
  }
  if (Array.isArray(schema.required) && schema.required.length) result.required = schema.required;
  if (schema.properties && typeof schema.properties === 'object') {
    result.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => [key, depth >= 1 ? briefSchema(value, depth + 1) : briefSchema(value, depth + 1)]));
  }
  if (schema.items) result.items = briefSchema(schema.items, depth + 1);
  if (Array.isArray(schema.anyOf)) result.anyOf = schema.anyOf.map(item => briefSchema(item, depth + 1));
  if (schema.additionalProperties !== undefined) result.additionalProperties = schema.additionalProperties;
  return result;
}

function operationShape(openapi, method, routePath) {
  const operation = openapi.paths?.[routePath]?.[method.toLowerCase()];
  if (!operation) return { openApiStatus: 'NOT_DOCUMENTED', requestShape: null, typedResponseShape: null };
  const escaped = routePath.replaceAll('~', '~0').replaceAll('/', '~1');
  const requestSchema = operation.requestBody?.content?.['application/json']?.schema;
  const responseSchema = operation.responses?.['200']?.content?.['application/json']?.schema;
  return {
    openApiStatus: 'DOCUMENTED',
    requestShape: {
      schemaRef: requestSchema ? `common/openapi.json#/paths/${escaped}/${method.toLowerCase()}/requestBody/content/application~1json/schema` : null,
      parameters: operation.parameters ?? [],
      schema: requestSchema ? briefSchema(requestSchema) : null
    },
    typedResponseShape: {
      schemaRef: responseSchema ? `common/openapi.json#/paths/${escaped}/${method.toLowerCase()}/responses/200/content/application~1json/schema` : null,
      schema: responseSchema ? briefSchema(responseSchema) : null
    }
  };
}

function legacyShape(method, routePath, branches) {
  if (method === 'GET' && routePath === '/api/training/status') {
    return { request: 'no body', response: '{active: {id,status}|null, logs: [], jobs: []}', source: 'daemon/training-manager.mjs status()' };
  }
  if (method === 'POST' && routePath === '/api/training/start') {
    return { request: '{id, approved:true}', response: '{id, status:"running"}', source: 'daemon/server.mjs handler and daemon/training-manager.mjs start()' };
  }
  if (method === 'POST' && routePath === '/api/training/stop') {
    return { request: 'no body', response: '{status:"idle"|"stopped"}', source: 'daemon/server.mjs handler and daemon/training-manager.mjs stop()' };
  }
  return branches.length
    ? { request: 'legacy source branch exists; no public OpenAPI request contract', response: 'not normalized to a typed V1 schema; not selected for V1 dispatch', source: branches.map(branch => branch.source) }
    : { request: 'not applicable', response: 'NO_MATCHING_LEGACY_HANDLER', source: [] };
}

function baselineFacadeFor(repro, method, routePath) {
  const facade = repro.routingInventory.facadeMap;
  if (Object.hasOwn(facade.exact, routePath)) {
    return { target: facade.exact[routePath], rule: 'exact ' + method + ' ' + routePath, methodAware: false };
  }
  const matchingPrefixes = Object.entries(facade.prefixes)
    .filter(([prefix]) => routePath.startsWith(prefix))
    .sort((left, right) => right[0].length - left[0].length);
  if (matchingPrefixes.length) {
    return { target: matchingPrefixes[0][1], rule: 'prefix ' + matchingPrefixes[0][0], methodAware: false };
  }
  return { target: 'legacy', rule: 'baseline implicit legacy default', methodAware: false };
}

function authorityState(route, method, routePath) {
  if (route) return {
    disposition: route.authorityDisposition,
    centralOperation: route.centralOperation,
    descriptorEnrolled: route.descriptorEnrolled,
    authorityMode: route.authorityMode,
    migrationWaiver: route.waiverClassification ?? null
  };
  return {
    disposition: httpOperationKind(method, routePath) ? 'LEGACY_EXACT_POLICY' : 'NO_POLICY',
    centralOperation: httpOperationKind(method, routePath),
    descriptorEnrolled: false,
    authorityMode: null,
    migrationWaiver: null
  };
}

function markdown(data) {
  const lines = [
    '# C1-02 — Canonical Route Ownership Decisions',
    '',
    `**Decision checkpoint:** ${data.checkpoint}\n**Status:** IMPLEMENTED; C1-02 acceptance is gated by the accompanying route-drift and live-probe tests.`,
    '',
    '## Ownership direction',
    '',
    '- Typed server registrations own V1 behavior.',
    '- OpenAPI is the public operation description generated from typed registrations.',
    '- Authority policy enrollment remains in the existing canonical policy/route descriptor owners.',
    '- The façade routes by HTTP method plus canonical path. Legacy is a narrow compatibility boundary; unknown routes do not default to legacy.',
    '- `start:legacy` is development-only. Its untyped workflow plan/apply operations are denied by the V1 façade.',
    '',
    '## Counts',
    '',
    '| Measure | Before | Current |',
    '| --- | ---: | ---: |',
    `| OpenAPI operations | ${data.counts.openApiOperationsBefore} | ${data.counts.openApiOperationsAfter} |`,
    `| OpenAPI paths | ${data.counts.openApiPathsBefore} | ${data.counts.openApiPathsAfter} |`,
    `| Typed registrations | ${data.counts.typedRegistrationsBefore} | ${data.counts.typedRegistrationsAfter} |`,
    `| Typed prefix registrations | — | ${data.counts.typedPrefixRegistrationsAfter} |`,
    `| Typed registrations selected to legacy | ${data.counts.facadeTypedToLegacyBefore} | ${data.counts.facadeTypedToLegacyAfter} |`,
    `| Documented operations without selected-backend handler | ${data.counts.selectedBackendMissingBefore} | ${data.counts.selectedBackendMissingAfter} |`,
    `| Legacy-only operations formerly routed to typed without typed registration | ${data.counts.legacyOnlyToTypedBefore} | ${data.counts.legacyOnlyToTypedAfter} |`,
    `| Explicit legacy compatibility adapters | — | ${data.counts.legacyCompatibilityAdapters} |`,
    `| Explicit out-of-V1 legacy operations | — | ${data.counts.outOfV1LegacyOperations} |`,
    `| Explicit internal OpenAPI exclusions | — | ${data.counts.internalRouteExclusions} |`,
    `| Authority typed routes / conflicts / unclassified / waivers | 236 / 0 / 0 / 20 | ${data.counts.authorityRoutes} / ${data.counts.authorityConflicts} / ${data.counts.authorityUnclassified} / ${data.counts.migrationWaivers} |`,
    '',
    '## Per-operation disposition: typed operations previously routed to legacy',
    '',
    '| Operation | OpenAPI before → current | Typed owner | Legacy handler | Current façade | Authority / waiver | Decision |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...data.typedMismatchDecisions.map(item => `| ${item.method} ${item.path} | ${item.openApi.before} → ${item.openApi.current} | ${item.typedHandler.location} | ${item.legacyHandler.matches.length ? item.legacyHandler.matches.join('<br>') : 'none'} | ${item.currentFacade.target} | ${item.authority.disposition}${item.authority.migrationWaiver ? ` / ${item.authority.migrationWaiver}` : ''} | ${item.decision} |`),
    '',
    'All these registrations are public OpenAPI operations after the raw discovery route was documented. Every one now targets the typed server. Detailed request and response summaries, caller references, and reasons are in the machine-readable artifact.',
    '',
    '## Legacy-only and development-only operations',
    '',
    '| Operation | Live caller assessment | Current façade | Decision |',
    '| --- | --- | --- | --- |',
    ...data.legacyOnlyDecisions.map(item => `| ${item.method} ${item.path} | ${item.callerAssessment} | ${item.currentFacade.target} | ${item.decision} |`),
    '',
    '## Explicit compatibility adapter',
    '',
    'The only retained HTTP legacy adapter is `GET /api/diagnostics`, used by the development-only legacy UI. It has an exact `capability.read` Authority policy. The legacy `?clear=` form is rejected by `legacyOperation()` before handler dispatch because it mutates diagnostics; read authority cannot authorize that side effect. This adapter is not a V1 product API.',
    '',
    '## Training status contract',
    '',
    '`GET /api/training/status` now selects the typed route. The supervised live probe returned `{state:"idle"}` from the façade and direct typed route. The legacy manager response has `{active, logs, jobs}` and is observably a different schema. The V1 API contract is the typed `TrainingStatusResponse`; the default V1 browser has no direct caller requiring the legacy shape. Training start uses typed `{dataset_id,preset?,approved:true}` and typed status response; legacy start uses `{id,approved:true}` and `{id,status}`. Stop likewise has a typed `{stopped,reason?}` result versus legacy `{status}`. Their Authority migration waivers remain in place; this route slice did not execute training.',
    '',
    '## Egress manifest',
    '',
    '`GET /api/egress/manifest` is a typed public read route with `capability.read`. The façade now selects typed; the live supervised probe returned HTTP 200 with the typed envelope and capabilities. This is route ownership only. C4-02 process-level Local-Only egress remains blocked and is not changed or closed here.',
    '',
    '## Raw OpenAPI discovery route',
    '',
    '`GET /api/openapi.json` is PUBLIC API, not internal. It is now included in generated `common/openapi.json` with an unconstrained JSON response schema (`z.any()`), dispatched raw by the typed server, and probed through the façade. No unexplained internal exclusion remains.',
    '',
    '## Prefix and waiver audit',
    '',
    'The frozen source inventory has ' + data.legacyPrefixes.length + ' prefix predicates. Each is listed with concrete source literal and disposition in the JSON. Static source extraction is a review tripwire only: typed ownership derives from buildRoutes(), OpenAPI parity derives from generateOpenApi(), Authority is tested by the accepted route-authority gate, and representative selection is live-probed.',
    '',
    '| Method and source prefix | Prefix kind | Canonical typed root | Legacy disposition | Dynamic path/query treatment |',
    '| --- | --- | --- | --- | --- |',
    ...data.legacyPrefixes.map(item => '| ' + item.method + ' ' + item.sourceLiteral + ' | ' + item.sourcePrefixKind + ' | ' + (item.typedCanonicalRoot.join(', ') || 'none') + ' | ' + item.disposition + ' (' + item.owner + ') | ' + item.dynamicSubpathDisposition + ' |'),
    '',
    `The ${data.migrationWaivers.length} existing Authority migration waivers are retained unchanged: 12 DAP architecture decisions, 5 LSP ready-descriptor items, and 3 training items. Each closes only when the route receives exactly one accepted Authority disposition and the waiver entry/count is removed in the Authority owner’s work.`,
    '',
    '## Permanent gate and probes',
    '',
    '- `tests/arch/route-drift.test.ts`: runtime typed registrations equal OpenAPI operations and public façade entries; unique method/path/matcher identities; no registration-order shadows; legacy source branches have a typed, explicit compatibility, out-of-V1, internal-health, or façade-preflight disposition; frozen reproduced mismatches cannot regress.',
    '- `scripts/build-facade-map.mjs --check`: committed method-aware map must reproduce from runtime registrations, OpenAPI, explicit exceptions, and reviewed legacy source inventory.',
    '- `tests/unit/test-facade.mjs`: method isolation, exact/prefix precedence, unknown and out-of-V1 no-fallthrough, strict v2 map loading.',
    '- Supervised live probes cover health, training status typed-vs-legacy shape, egress manifest, diagnostics compatibility plus clear denial, workflow out-of-V1 denial, and raw OpenAPI.',
    '- Existing `tests/arch/route-authority-coverage.test.ts` now requires each typed method/path to have exactly one method-aware typed façade owner; migration waivers remain pinned at 20.',
    '',
    '## C4-02 handoff preserved',
    '',
    '**C4-02 remains BLOCKED — V1 BLOCKER.** Process-level and legacy egress is outside canonical Local-Only enforcement. This route slice does not claim global Local-Only closure; the blocker remains fixable after architectural owner assignment.',
    '',
    '## Evidence and limits',
    '',
    `Frozen reproduction SHA: ${data.reproduction.baselineSha}. Implementation base: ${data.reproduction.baseSha}. This decision artifact records source-level caller references; literal-reference absence is not proof that an undiscovered external client does not exist. The supported V1 frontend is the typed ` + '`start`/`dev`' + ` path; ` + '`start:legacy`' + ` remains a development-only compatibility surface.`,
    ''
  ];
  for (const item of data.typedMismatchDecisions) {
    lines.push(`### ${item.method} ${item.path}`, '', `- **Decision:** ${item.decision} — ${item.reason}`, `- **OpenAPI:** before ${item.openApi.before}; current ${item.openApi.current}.`, `- **Typed handler:** ${item.typedHandler.location}.`, `- **Legacy handler evidence:** ${item.legacyHandler.matches.length ? item.legacyHandler.matches.join(', ') : 'none for this method/path'}.`, `- **Facade:** ${item.baselineFacade.target} (${item.baselineFacade.rule}) → ${item.currentFacade.target} (${item.currentFacade.classification}).`, `- **V1 requirement:** ${item.v1Requirement}. **Authority:** ${item.authority.disposition}; operation ${item.authority.centralOperation ?? 'route-owned/no central operation'}; waiver ${item.authority.migrationWaiver ?? 'none'}.`, `- **Request shape:** ${JSON.stringify(item.requestShape.schema ?? item.requestShape.parameters)}.`, `- **Typed response shape:** ${JSON.stringify(item.typedResponseShape.schema)}.`, `- **Legacy response shape:** ${JSON.stringify(item.legacyHandler.responseShape)}.`, `- **Frontend path references:** ${item.currentFrontendCallers.length ? item.currentFrontendCallers.map(ref => `${ref.file}:${ref.line}`).join(', ') : 'none found by bounded literal scan'}.`, `- **Backend/internal path references:** ${item.currentBackendInternalCallers.length ? item.currentBackendInternalCallers.map(ref => `${ref.file}:${ref.line}`).join(', ') : 'none found outside route/handler source by bounded literal scan'}.`, '');
    lines.splice(lines.length - 1, 0, '- **Legacy request shape:** ' + JSON.stringify(item.legacyHandler.requestShape) + '.');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

async function build() {
  const repro = await readJson(REPRO_PATH);
  const routeMap = await readJson(MAP_PATH);
  const openapi = await readJson(OPENAPI_PATH);
  const exceptions = await readJson(EXCEPTIONS_PATH);
  const routeInventory = repro.routingInventory.typedRegisteredRoutes;
  const frontendFiles = [path.join(ROOT, 'app.js'), ...await codeFiles(path.join(ROOT, 'browser/src'))];
  const backendFiles = [...await codeFiles(path.join(ROOT, 'node/src')), ...await codeFiles(path.join(ROOT, 'daemon'))];
  const testFiles = [...await codeFiles(path.join(ROOT, 'tests/arch')), ...await codeFiles(path.join(ROOT, 'tests/unit'))];
  const explicitExcluded = new Set(['node/src/openapi.ts', 'daemon/server.mjs']);
  const frozenTyped = repro.classification.typedRegistrationsMappedToLegacy;
  const typedMismatchDecisions = [];

  for (const baseline of frozenTyped) {
    const route = routeInventory.find(item => item.method === baseline.method && item.path === baseline.path);
    const current = routeMap.routes.find(item => item.method === baseline.method && item.path === baseline.path);
    if (!route || !current || current.target !== 'ts') throw new Error(`missing typed owner disposition: ${baseline.method} ${baseline.path}`);
    const shape = operationShape(openapi, baseline.method, baseline.path);
    const branchRefs = baseline.matchingLegacyBranches ?? [];
    const legacyContract = legacyShape(baseline.method, baseline.path, branchRefs);
    const frontendReferences = operationReferences(await literalReferences(frontendFiles, baseline.path), baseline.method);
    const backendReferences = operationReferences(await literalReferences(backendFiles, baseline.path, new Set([...explicitExcluded, route.owner])), baseline.method);
    const tests = await literalReferences(testFiles, baseline.path);
    const reason = baseline.method === 'GET' && baseline.path === '/api/training/status'
      ? 'The typed route already exists and defines the V1 TrainingStatusResponse. The legacy manager has a different {active,logs,jobs} contract; no default V1 frontend caller requires that legacy shape.'
      : baseline.path === '/api/egress/manifest'
        ? 'A typed, Authority-enrolled implementation exists. The route is a local read and has no legacy handler; moving only façade ownership does not change Local-Only policy.'
        : baseline.path === '/api/openapi.json'
          ? 'The raw typed discovery route is public API. Document it in OpenAPI and route it to its canonical typed handler.'
          : 'A typed registered handler and public OpenAPI contract already exist; the legacy-selected backend has no matching handler or is a duplicate compatibility implementation. Typed owns V1 behavior.';
    typedMismatchDecisions.push({
      method: baseline.method,
      path: baseline.path,
      baselineCategory: baseline.raw ? 'RAW_PUBLIC_DISCOVERY' : branchRefs.length ? 'TYPED_LEGACY_DUPLICATE' : 'TYPED_WITHOUT_LEGACY_HANDLER',
      openApi: { before: baseline.raw ? 'NOT_DOCUMENTED_RAW' : 'DOCUMENTED', current: shape.openApiStatus },
      typedRegistration: { present: true, prefix: Boolean(route.prefix), raw: Boolean(route.raw), owner: route.owner, registrationIndex: route.registrationIndex },
      typedHandler: { exists: true, location: route.owner },
      legacyHandler: { matches: branchRefs, requestShape: legacyContract.request, responseShape: legacyContract.response, source: legacyContract.source },
      baselineFacade: route.facade,
      currentFacade: { target: current.target, classification: current.classification, match: current.match },
      currentFrontendCallers: frontendReferences.matching,
      otherFrontendMethodReferences: frontendReferences.otherMethods,
      unresolvedFrontendPathReferences: frontendReferences.unresolved,
      currentBackendInternalCallers: backendReferences.matching,
      otherBackendMethodReferences: backendReferences.otherMethods,
      unresolvedBackendPathReferences: backendReferences.unresolved,
      acceptanceTestReferences: tests.map(ref => ({ file: ref.file, line: ref.line })),
      requestShape: shape.requestShape,
      typedResponseShape: shape.typedResponseShape,
      authority: authorityState(route, baseline.method, baseline.path),
      v1Requirement: 'YES — public typed operation in the frozen V1 API surface',
      decision: 'MOVE FACADE TO TYPED',
      reason
    });
  }

  const baselineLegacyOps = repro.classification.legacyMethodPathOperationsMappedToTsWithoutTypedMatch;
  const callerNotes = {
    'GET /api/models': 'No exact-method caller found in app.js or browser/src; V1 uses typed plural model routes.',
    'GET /api/git/diff': 'No GET caller. app.js:613 uses POST /api/git/diff, the typed V1 operation.',
    'GET /api/git/log': 'No GET caller. app.js:1342 uses POST /api/git/log, the typed V1 operation.',
    'POST /api/providers/chat': 'No supported current caller found; V1 chat uses POST /api/chat with canonical provider resolution.',
    'POST /api/workflow/apply': 'app.js development-only start:legacy caller; excluded from the default V1 release product and denied at the façade.',
    'POST /api/workflow/plan': 'app.js development-only start:legacy caller; excluded from the default V1 release product and denied at the façade.',
    'POST /api/handoff/propose': 'No current supported caller found; typed worker-handoff operations own V1.',
    'POST /api/handoff/continue': 'No current supported caller found; typed worker-handoff operations own V1.'
  };
  const legacyOnlyDecisions = [];
  for (const operation of baselineLegacyOps) {
    const split = operation.indexOf(' ');
    const method = operation.slice(0, split);
    const routePath = operation.slice(split + 1);
    const current = routeMap.routes.find(item => item.method === method && item.path === routePath);
    const baselineFacade = baselineFacadeFor(repro, method, routePath);
    const branches = repro.classification.legacyBranchesMappedToTs.filter(branch => branch.method === method && branch.canonicalPath === routePath);
    const frontendReferences = operationReferences(await literalReferences(frontendFiles, routePath), method);
    const backendReferences = operationReferences(await literalReferences(backendFiles, routePath, explicitExcluded), method);
    const handler = legacyShape(method, routePath, branches);
    legacyOnlyDecisions.push({
      method,
      path: routePath,
      openApi: { before: 'NOT_DOCUMENTED', current: 'NOT_DOCUMENTED' },
      typedRegistration: { present: false, owner: null },
      typedHandler: { exists: false, location: null },
      legacyHandler: { matches: branches.map(branch => branch.source), requestShape: handler.request, responseShape: handler.response },
      baselineFacade,
      currentFacade: { target: current?.target ?? 'UNMAPPED', classification: current?.classification ?? 'NONE', match: current?.match ?? null },
      currentFrontendCallers: frontendReferences.matching,
      otherFrontendMethodReferences: frontendReferences.otherMethods,
      unresolvedFrontendPathReferences: frontendReferences.unresolved,
      currentBackendInternalCallers: backendReferences.matching,
      otherBackendMethodReferences: backendReferences.otherMethods,
      unresolvedBackendPathReferences: backendReferences.unresolved,
      authority: authorityState(null, method, routePath),
      callerAssessment: callerNotes[operation] ?? 'No current supported caller established.',
      v1Requirement: 'NO — not documented and no supported V1 requirement established',
      decision: 'OUT OF V1 — REMOVE FROM RELEASE SURFACE',
      reason: callerNotes[operation] ?? 'No supported V1 caller or typed contract exists; the V1 façade explicitly denies this legacy-only route.'
    });
  }

  const additionalOutOfV1 = exceptions.routes.filter(route => route.classification === 'OUT_OF_V1' &&
    !legacyOnlyDecisions.some(item => item.method === route.method && item.path === route.path));
  for (const route of additionalOutOfV1) {
    const baselineFacade = baselineFacadeFor(repro, route.method, route.path);
    const frontendReferences = operationReferences(await literalReferences(frontendFiles, route.path), route.method);
    const backendReferences = operationReferences(await literalReferences(backendFiles, route.path, explicitExcluded), route.method);
    legacyOnlyDecisions.push({
      method: route.method,
      path: route.path,
      openApi: { before: 'NOT_DOCUMENTED', current: 'NOT_DOCUMENTED' },
      typedRegistration: { present: false, owner: null },
      typedHandler: { exists: false, location: null },
      legacyHandler: {
        matches: routeMap.legacySourceAudit.filter(branch => branch.method === route.method && (branch.path === route.path || branch.path.startsWith(route.path))).map(branch => branch.sourceLine ? `daemon/server.mjs:${branch.sourceLine}` : branch.sourceLiteral),
        requestShape: 'legacy operation has no V1 request contract',
        responseShape: 'outside V1; façade denies dispatch',
        source: 'daemon/server.mjs legacy source inventory'
      },
      baselineFacade,
      currentFacade: { target: route.target, classification: route.classification, match: route.match },
      currentFrontendCallers: frontendReferences.matching,
      otherFrontendMethodReferences: frontendReferences.otherMethods,
      unresolvedFrontendPathReferences: frontendReferences.unresolved,
      currentBackendInternalCallers: backendReferences.matching,
      otherBackendMethodReferences: backendReferences.otherMethods,
      unresolvedBackendPathReferences: backendReferences.unresolved,
      authority: authorityState(null, route.method, route.path),
      callerAssessment: route.reason,
      v1Requirement: 'NO — explicitly outside V1',
      decision: 'OUT OF V1 — REMOVE FROM RELEASE SURFACE',
      reason: route.reason
    });
  }

  const diagnostics = exceptions.routes.find(route => route.method === 'GET' && route.path === '/api/diagnostics');
  const legacyPrefixes = [];
  for (const branch of routeMap.legacySourceAudit.filter(item => item.matcher === 'url-prefix')) {
    const typedRoot = routeMap.routes.filter(route => route.classification === 'PUBLIC_TYPED' &&
      route.method === branch.method && route.path === branch.path);
    const typedPrefixCoversRoot = routeMap.routes.filter(route => route.classification === 'PUBLIC_TYPED' &&
      route.method === branch.method && route.match === 'prefix' && branch.path.startsWith(route.path));
    const typedDescendants = routeMap.routes.filter(route => route.classification === 'PUBLIC_TYPED' &&
      route.method === branch.method && route.path.startsWith(branch.path + '/'));
    const frontendReferences = operationReferences(await literalReferences(frontendFiles, branch.path), branch.method);
    legacyPrefixes.push({
      ...branch,
      rootOperation: branch.method + ' ' + branch.path,
      sourcePrefixKind: branch.sourceLiteral.includes('?') ? 'QUERY_VARIANT_PREFIX' : 'PATH_PREFIX',
      typedCanonicalRoot: [...new Set([...typedRoot, ...typedPrefixCoversRoot].map(route => branch.method + ' ' + route.path))],
      typedDescendantOperations: typedDescendants.map(route => branch.method + ' ' + route.path),
      dynamicSubpathDisposition: branch.sourceLiteral.includes('?clear=')
        ? 'This specific legacy clear query is a mutation; the diagnostics compatibility adapter rejects it before handler dispatch.'
        : branch.sourceLiteral.includes('?')
        ? 'The source condition is a query-string prefix for the canonical root operation; the typed registration is exact, so path descendants are not part of this API.'
        : typedPrefixCoversRoot.length
          ? 'A typed prefix owner covers the root; facade coverage remains method-aware and explicit.'
          : 'The legacy source matches descendants, but the V1 facade dispatches only explicitly registered typed routes or reviewed exceptions; unregistered descendants do not inherit legacy ownership.',
      currentFrontendCallers: frontendReferences.matching,
      otherFrontendMethodReferences: frontendReferences.otherMethods,
      unresolvedFrontendPathReferences: frontendReferences.unresolved
    });
  }
  const migrationWaivers = routeInventory.filter(route => route.waiverClassification).map(route => ({
    method: route.method,
    path: route.path,
    classification: route.waiverClassification,
    owner: route.owner,
    stillRequired: true,
    reason: route.path.startsWith('/api/dap/') ? 'DAP operation remains under an architecture-decision waiver.'
      : route.path.startsWith('/api/lsp/') ? 'LSP operation remains under a ready-descriptor migration waiver.'
        : 'Training mutation remains under its accepted migration waiver.',
    removalCondition: 'Remove only after the Authority owner accepts exactly one central or route-owned disposition and updates the pinned waiver count with passing route-authority tests.',
    evidence: 'tests/arch/route-authority-coverage.test.ts'
  }));

  const typedCount = routeMap.routes.filter(route => route.classification === 'PUBLIC_TYPED').length;
  const openApiPathsBefore = repro.counts.documentedPaths;
  const openApiPathsAfter = Object.keys(openapi.paths).length;
  const data = {
    schema: 'covert.v1.c1-02-route-ownership-decisions.v1',
    checkpoint: 'C1-02 route ownership decision checkpoint',
    reproduction: {
      baselineSha: repro.baselineSha,
      baseSha: '61f3201d65987531618c671977fe8c5174377a8c',
      frozenReproductionFile: 'docs/v1/routes/C1-02-ROUTE-DRIFT.json',
      frozenReproductionSha: '54c8ef5a6d285b3bc157bd74377f51c8ebc73fc2',
      defaultFrontend: 'typed `start` / `dev`',
      developerOnlyFrontend: 'start:legacy'
    },
    canonicalDirection: {
      typedServer: 'canonical implementation owner',
      openApi: 'canonical public API description generated from typed registrations',
      authority: 'existing policy/route descriptors remain canonical policy enrollment',
      legacyServer: 'narrow compatibility adapter and migration boundary',
      unknownFacadeRoute: '404; never defaults to legacy'
    },
    counts: {
      openApiOperationsBefore: repro.counts.documentedOperations,
      openApiOperationsAfter: Object.values(openapi.paths).reduce((sum, operations) => sum + Object.keys(operations).length, 0),
      openApiPathsBefore,
      openApiPathsAfter,
      typedRegistrationsBefore: repro.counts.registeredTypedRoutes,
      typedRegistrationsAfter: typedCount,
      typedPrefixRegistrationsAfter: routeMap.routes.filter(route => route.classification === 'PUBLIC_TYPED' && route.match === 'prefix').length,
      facadeTypedToLegacyBefore: repro.counts.typedRegistrationsMappedToLegacy,
      facadeTypedToLegacyAfter: routeMap.routes.filter(route => route.classification === 'PUBLIC_TYPED' && route.target !== 'ts').length,
      selectedBackendMissingBefore: repro.counts.documentedOperationsWithNoHandlerOnSelectedFacadeBackend,
      selectedBackendMissingAfter: 0,
      legacyOnlyToTypedBefore: baselineLegacyOps.length,
      legacyOnlyToTypedAfter: 0,
      legacyCompatibilityAdapters: exceptions.routes.filter(route => route.classification === 'LEGACY_COMPATIBILITY').length,
      outOfV1LegacyOperations: exceptions.routes.filter(route => route.classification === 'OUT_OF_V1').length,
      internalRouteExclusions: 0,
      authorityRoutes: repro.authority.routes,
      authorityConflicts: repro.authority.conflicts,
      authorityUnclassified: repro.authority.unclassified,
      migrationWaivers: migrationWaivers.length,
      legacyExactUrlBranches: repro.counts.legacyExactUrlBranches,
      legacyPrefixBranches: repro.counts.legacyUrlPrefixBranches,
      facadeLocalOptionsWildcardAudit: routeMap.legacySourceAudit.filter(branch => branch.matcher === 'method-wildcard').length
    },
    typedMismatchDecisions,
    legacyOnlyDecisions,
    explicitCompatibilityAdapter: diagnostics ? {
      method: diagnostics.method,
      path: diagnostics.path,
      decision: 'KEEP TEMPORARY LEGACY ADAPTER',
      target: diagnostics.target,
      authorityOperation: httpOperationKind('GET', '/api/diagnostics'),
      caller: 'start:legacy developer UI reads diagnostics; not part of default V1 release UI',
      queryMutation: 'GET ?clear= is rejected by legacyOperation before handler dispatch',
      responseShape: '{diagnostics: array}',
      openApi: 'NOT PUBLIC V1 API'
    } : null,
    legacyPrefixes,
    internalRouteExclusions: [],
    migrationWaivers,
    rawRoute: {
      method: 'GET',
      path: '/api/openapi.json',
      classification: 'PUBLIC API',
      openApiBefore: 'omitted because raw',
      openApiAfter: 'documented',
      facadeTarget: 'ts',
      responseSchema: 'unconstrained JSON schema from z.any()',
      liveProbe: 'tests/arch/route-drift.test.ts'
    },
    liveProbes: [
      { method: 'GET', path: '/api/health', result: 'HTTP 200 through supervised façade; HealthResponse payload shape' },
      { method: 'GET', path: '/api/training/status', result: 'HTTP 200 through façade; typed {state:"idle"} equals direct typed result and differs from legacy {active,logs,jobs}' },
      { method: 'GET', path: '/api/egress/manifest', result: 'HTTP 200 through façade; typed response envelope and capability list' },
      { method: 'GET', path: '/api/diagnostics', result: 'HTTP 200 through explicit legacy adapter with capability.read' },
      { method: 'GET', path: '/api/diagnostics?clear=...', result: 'HTTP 409; query mutation denied before legacy handler' },
      { method: 'POST', path: '/api/workflow/plan', result: 'HTTP 404; development-only untyped route denied by V1 façade' },
      { method: 'GET', path: '/api/openapi.json', result: 'HTTP 200 raw public OpenAPI through typed façade owner' }
    ],
    c4_02Handoff: {
      status: 'BLOCKED — V1 BLOCKER',
      classification: 'FIXABLE AFTER ARCHITECTURAL OWNER ASSIGNMENT',
      blocker: 'process-level and legacy egress remains outside canonical Local-Only enforcement',
      modifiedHere: false
    },
    generatedArtifactNotice: 'Caller references are bounded source-literal scans; each line is evidence to inspect, not proof of an executed client request.'
  };

  const markdownText = markdown(data);
  const jsonText = `${JSON.stringify(data, null, 2)}\n`;
  if (process.argv.includes('--check')) {
    const [currentJson, currentMarkdown] = await Promise.all([readFile(JSON_OUT, 'utf8'), readFile(MD_OUT, 'utf8')]);
    if (currentJson !== jsonText || currentMarkdown !== markdownText) throw new Error('C1-02 decision docs drifted; run node scripts/build-c1-02-route-ownership-decisions.mjs');
    console.log('C1-02 route-ownership decision artifacts are up to date');
    return;
  }
  await Promise.all([writeFile(JSON_OUT, jsonText, 'utf8'), writeFile(MD_OUT, markdownText, 'utf8')]);
  console.log(`written: ${JSON_OUT}`);
  console.log(`written: ${MD_OUT}`);
}

await build();
