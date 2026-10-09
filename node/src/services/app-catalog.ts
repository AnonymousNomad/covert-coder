import { createHash, randomUUID } from 'node:crypto';
import { PackageDeclaration, PackageManifest, AppDeclaration, AppManifest, InstalledAppRecord, AppInstance, AppCatalogQuery, AppCatalogResponse, type PackageManifestT, type AppManifestT, type AppCatalogResponseT } from '../../../common/contracts/platform-app.ts';
import type { ProjectAddressT } from '../../../common/contracts/project.ts';
import type { ProjectSeat } from './project-seat.ts';
import { httpOperationKind, OPERATION_POLICY } from '../../../common/security/operation-policy.mjs';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical((value as Record<string, unknown>)[key])).join(',') + '}';
  return JSON.stringify(value);
}
const digest = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export function sealPackageManifest(value: unknown): PackageManifestT {
  const declaration = PackageDeclaration.parse(value);
  return freeze(PackageManifest.parse({ ...declaration, manifest_digest: digest(declaration) }));
}
function sealApp(value: unknown): AppManifestT {
  const declaration = AppDeclaration.parse(value);
  return freeze(AppManifest.parse({ ...declaration, manifest_digest: digest(declaration) }));
}
export class AppCatalogError extends Error {
  readonly reason: string;
  constructor(reason: string) { super(reason); this.reason = reason; this.name = 'AppCatalogError'; }
}

// Identity consistency only; never a grant, Admission decision, or permission
// to launch. A disabled installation may have inspectable historical instances.
export function validateAppInstanceBinding(instanceValue: unknown, installedValue: unknown, manifestValue: unknown, project: ProjectAddressT): void {
  const instance = AppInstance.parse(instanceValue), installed = InstalledAppRecord.parse(installedValue), manifest = AppManifest.parse(manifestValue);
  const { manifest_digest: declaredDigest, ...declaration } = manifest;
  if (digest(declaration) !== declaredDigest || instance.app_id !== manifest.app_id || installed.app_id !== manifest.app_id || instance.installation_id !== installed.installation_id || instance.installation_revision !== installed.revision || instance.package_manifest_digest !== installed.package_manifest_digest || instance.package_manifest_digest !== manifest.package_manifest_digest || instance.app_manifest_digest !== installed.app_manifest_digest || instance.app_manifest_digest !== manifest.manifest_digest || instance.project.project_id !== project.project_id || instance.project.checkout_id !== project.checkout_id) throw new AppCatalogError('APP_BINDING_CHANGED');
}

const pkg = sealPackageManifest({
  schema: 'covert.package-manifest.v1', package_id: 'covert.system.workstation', version: '0.1.0-preflight',
  publisher: 'Covert', source_ref: 'covert:first-party-source', artifact_digest: null, artifact_state: 'UNATTESTED',
  compatibility: { contract_version: 1, hosts: ['windows', 'linux', 'darwin'] }
});
type Capability = AppManifestT['capabilities'][number];
function capability(id: string, owner: string, route: string, operation_kind: string, audiences: Capability['audiences'], method: Capability['method'] = 'GET'): Capability {
  const effect = OPERATION_POLICY[operation_kind];
  if (!effect) throw new AppCatalogError('OPERATION_POLICY_MISMATCH');
  return { id, owner, method, route, operation_kind, effect: effect.toUpperCase() as Capability['effect'], audiences };
}
// Compiled first-party inventory, NOT frontend APP_REGISTRY, an importer, an
// installed-app store or authorization truth. Routes refer to existing owners.
const inventory: Array<[string, string, string, string, Capability[]]> = [
  ['projects', 'projects', 'Projects', 'ProjectSeat', [capability('project.identity.read', 'ProjectSeat', '/api/projects/current', 'capability.read', ['OPERATOR', 'RESIDENT'])]],
  ['editor', 'editor', 'Editor', 'WorkspaceService', [capability('workspace.file.read', 'WorkspaceService', '/api/file', 'workspace.read', ['OPERATOR', 'RESIDENT', 'WORKER']), capability('workspace.file.write', 'WorkspaceService', '/api/file/write', 'workspace.write', ['OPERATOR', 'WORKER'], 'POST')]],
  ['terminal', 'terminal', 'Terminal', 'TerminalSessionService', [capability('terminal.sessions.read', 'TerminalSessionService', '/api/terminal/sessions', 'terminal.read', ['OPERATOR', 'RESIDENT']), capability('terminal.session.open', 'TerminalSessionService', '/api/terminal/sessions', 'terminal.session.start', ['OPERATOR', 'RESIDENT'], 'POST')]],
  ['cipher-laptop', 'cipher-laptop', "Cipher's Laptop", 'CipherLedger-Notebook', [
    capability('cipher.activity.read', 'CipherLedger', '/api/cipher/laptop/activity', 'capability.read', ['OPERATOR']),
    capability('cipher.notebook.read', 'CipherNotebook', '/api/cipher/laptop/notebook', 'capability.read', ['OPERATOR']),
    capability('cipher.notebook.write', 'CipherNotebook', '/api/cipher/laptop/notebook', 'capability.write', ['OPERATOR'], 'POST'),
    capability('cipher.project.read', 'ProjectSeat', '/api/projects/current', 'capability.read', ['OPERATOR']),
    capability('cipher.model-manager.read', 'ModelManagerView', '/api/models/manager', 'capability.read', ['OPERATOR']),
    capability('cipher.model-atlas.read', 'ModelAtlas', '/api/models/atlas', 'capability.read', ['OPERATOR']),
    capability('cipher.model-atlas-record.read', 'ModelAtlas', '/api/models/atlas/record', 'capability.read', ['OPERATOR']),
    capability('cipher.model-atlas-candidate.read', 'ModelAtlas', '/api/models/atlas/candidate', 'capability.read', ['OPERATOR']),
    capability('cipher.agent.start', 'AgentLoopService', '/api/agent/start', 'agent.start', ['OPERATOR'], 'POST'),
    capability('cipher.agent.status.read', 'AgentLoopService', '/api/agent/status', 'agent.read', ['OPERATOR']),
    capability('cipher.agent.decision', 'AgentLoopService', '/api/agent/decision', 'agent.decision', ['OPERATOR'], 'POST'),
    capability('cipher.agent.cancel', 'AgentLoopService', '/api/agent/cancel', 'agent.cancel', ['OPERATOR'], 'POST'),
    capability('cipher.mission-receipt.read', 'ProvenanceLedger', '/api/mission/receipt', 'capability.read', ['OPERATOR']),
    capability('cipher.provenance.read', 'ProvenanceLedger', '/api/provenance/runs', 'capability.read', ['OPERATOR'])
  ]],
  ['models', 'models', 'Models', 'ModelManagerView', [capability('models.manager.read', 'ModelManagerView', '/api/models/manager', 'capability.read', ['OPERATOR', 'RESIDENT']), capability('models.dossier.read', 'ModelAtlas', '/api/models/atlas', 'capability.read', ['OPERATOR', 'RESIDENT']), capability('models.dossier.record.read', 'ModelAtlas', '/api/models/atlas/record', 'capability.read', ['OPERATOR', 'RESIDENT']), capability('models.dossier.candidate.read', 'ModelAtlas', '/api/models/atlas/candidate', 'capability.read', ['OPERATOR', 'RESIDENT'])]],
  ['connections', 'connections', 'Connections', 'ProviderConnectionsService', [capability('connections.read', 'ProviderConnectionsService', '/api/connections', 'capability.read', ['OPERATOR'])]],
  ['resource-monitor', 'resources', 'Resource Monitor', 'HardwareService', [capability('resources.hardware.read', 'HardwareService', '/api/hardware/profile', 'capability.read', ['OPERATOR', 'RESIDENT'])]],
  ['evidence', 'verification', 'Evidence', 'ProvenanceLedger', [capability('evidence.provenance.read', 'ProvenanceLedger', '/api/provenance/runs', 'capability.read', ['OPERATOR', 'RESIDENT'])]],
  ['settings', 'settings', 'Settings', 'SettingsService', [capability('settings.read', 'SettingsService', '/api/settings', 'capability.read', ['OPERATOR'])]]
];
const manifests = freeze(inventory.map(([id, presentation, name, owner, capabilities]) => sealApp({
  schema: 'covert.app-manifest.v1', app_id: 'covert.app.' + id, package_id: pkg.package_id, package_manifest_digest: pkg.manifest_digest, version: pkg.version,
  display_name: name, presentation_id: presentation, canonical_state_owner: owner, scope: 'PROJECT_OPTIONAL', storage_namespace: 'apps/covert.app.' + id,
  contributions: ['window', 'launcher', 'resident-discovery'], required_capabilities: capabilities.map(c => c.id), optional_capabilities: [], capabilities,
  dependencies: { network_classes: id === 'connections' ? ['provider-egress'] : [], credential_classes: id === 'connections' ? ['connection-credential'] : [], external_runtimes: id === 'terminal' ? ['terminal-provider'] : [] },
  resources: { owner: 'ResourceAdmission', budget_state: 'NOT_EVALUATED', background: false },
  restore: { presentation: true, effects: false, background_restart: false }
})));
const catalogDigest = digest({ package: pkg, apps: manifests });
function select(selector: { app_id?: string; capability_id?: string }) {
  let selected = manifests;
  if (selector.app_id !== undefined) {
    selected = selected.filter(app => app.app_id === selector.app_id);
    if (!selected.length) throw new AppCatalogError('UNKNOWN_APP');
  }
  if (selector.capability_id !== undefined) {
    selected = selected.filter(app => app.capabilities.some(capability => capability.id === selector.capability_id));
    if (!selected.length) throw new AppCatalogError('UNKNOWN_CAPABILITY');
  }
  return selected;
}

export function createAppCatalog(seat: ProjectSeat | undefined, registeredRoutes?: ReadonlyArray<{ method: string; path: string; capabilityPolicy?: { owner: string; operation: string; available?: boolean }; describeOperation?: unknown }>) {
  const generation = randomUUID();
  const bindings = (manifest: AppManifestT) => manifest.capabilities.map(capability => {
    const binding = (state: 'ADDRESSABLE' | 'UNAVAILABLE' | 'UNOBSERVED', reason: AppCatalogResponseT['apps'][number]['capability_bindings'][number]['reason']) => ({ id: capability.id, state, reason });
    if (registeredRoutes === undefined) return binding('UNOBSERVED', 'ROUTE_OWNER_UNOBSERVED');
    const matches = registeredRoutes.filter(route => route.method === capability.method && route.path === capability.route);
    if (!matches.length) return binding('UNAVAILABLE', 'OWNER_ROUTE_UNAVAILABLE');
    if (matches.length !== 1) return binding('UNAVAILABLE', 'ROUTE_OWNER_AMBIGUOUS');
    const registered = matches[0]!, policy = registered.capabilityPolicy;
    if (!policy) return binding('UNOBSERVED', 'ROUTE_OWNER_UNOBSERVED');
    if (policy.owner !== capability.owner) return binding('UNAVAILABLE', 'OWNER_DECLARATION_MISMATCH');
    const central = httpOperationKind(registered.method, registered.path);
    if (policy.operation !== capability.operation_kind || OPERATION_POLICY[policy.operation]?.toUpperCase() !== capability.effect || (central !== null ? central !== policy.operation : typeof registered.describeOperation !== 'function')) return binding('UNAVAILABLE', 'OPERATION_POLICY_MISMATCH');
    if (policy.available === false) return binding('UNAVAILABLE', 'OWNER_UNAVAILABLE');
    return binding('ADDRESSABLE', 'ROUTE_REGISTERED');
  });
  const assertProject = async (project: ProjectAddressT) => {
    if (!seat) throw new AppCatalogError('PROJECT_OWNER_UNAVAILABLE');
    await seat.assertAddress(project);
  };
  return Object.freeze({
    read: async (address: ProjectAddressT, selector: { app_id?: string; capability_id?: string } = {}): Promise<AppCatalogResponseT> => {
      const query = AppCatalogQuery.parse({ ...address, ...selector });
      const project = { project_id: query.project_id, checkout_id: query.checkout_id };
      await assertProject(project);
      const selected = select({ ...(query.app_id !== undefined ? { app_id: query.app_id } : {}), ...(query.capability_id !== undefined ? { capability_id: query.capability_id } : {}) });
      const result = AppCatalogResponse.parse({ schema: 'covert.app-catalog.v1', generation, catalog_digest: catalogDigest, project, observed_at: new Date().toISOString(), freshness: 'SNAPSHOT', selection: { app_id: query.app_id ?? null, capability_id: query.capability_id ?? null }, package: pkg,
        apps: selected.map(manifest => ({ manifest, capability_bindings: bindings(manifest), installation_state: 'UNOBSERVED', grant_state: 'NOT_EVALUATED', admission_state: 'NOT_EVALUATED', execution_state: 'GATED', execution_reason: 'APP_PRINCIPAL_ENFORCEMENT_UNPROVEN' })), effect_replay: false });
      await assertProject(project);
      return freeze(result);
    },
    assertFresh: async (value: unknown): Promise<void> => {
      const snapshot = AppCatalogResponse.parse(value);
      if (snapshot.generation !== generation || snapshot.catalog_digest !== catalogDigest) throw new AppCatalogError('CATALOG_GENERATION_CHANGED');
      const expected = select({ ...(snapshot.selection.app_id !== null ? { app_id: snapshot.selection.app_id } : {}), ...(snapshot.selection.capability_id !== null ? { capability_id: snapshot.selection.capability_id } : {}) });
      if (digest(snapshot.package) !== digest(pkg) || digest(snapshot.apps.map(app => app.manifest)) !== digest(expected) || snapshot.apps.some(app => {
        const known = manifests.find(manifest => manifest.app_id === app.manifest.app_id);
        return !known || digest(app.manifest) !== digest(known) || digest(app.capability_bindings) !== digest(bindings(known));
      })) throw new AppCatalogError('CATALOG_CONTENT_CHANGED');
      await assertProject(snapshot.project);
    }
  });
}
export type AppCatalog = ReturnType<typeof createAppCatalog>;
