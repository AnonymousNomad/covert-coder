// Harness Operating Modes — ONE harness, many loadouts.
//
// A mode composes EXISTING registries; it never duplicates them:
//   workflow_bundles  -> the validator-backed stage contract (common/contracts/workflow.ts)
//   skill_bundles     -> skills/registry.json categories
//   sop_bundles       -> harness/sops.json roles + task_classes
//   authority refs    -> common/security/operation-policy.mjs kinds
//   verification refs -> harness/veritas.mjs + harness/gates.mjs
// Status is a truth claim: AVAILABLE means the work can run today through the
// existing Covert surfaces; PARTIAL means some loadout exists but a required
// integration does not; EXPERIMENTAL means methodology/policy structure only;
// PLANNED means definition-only. Required integrations that do not exist yet
// are listed there and are NEVER claimed as working adapters.
import {
  ComposedHarnessMode,
  HarnessModeDefinition,
  HARNESS_MODE_SCHEMA_VERSION
} from '../common/contracts/harness-modes.ts';

export class ModeLookupError extends Error {
  constructor(modeId) {
    super(`unknown harness mode: ${modeId}`);
    this.name = 'ModeLookupError';
    this.code = 'NOT_FOUND';
  }
}

export class ModeConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModeConflictError';
    this.code = 'CONFLICT';
  }
}

const STAGE_WORKFLOW = Object.freeze({ id: 'covert-workflow-stages', version: '1' });

function bundle(id, version = '1') {
  return Object.freeze({ id, version });
}

export const MODE_DEFINITIONS = Object.freeze([
  {
    schema_version: HARNESS_MODE_SCHEMA_VERSION,
    mode_id: 'software-engineering',
    display_name: 'Software Engineering',
    domain: 'software-engineering',
    version: '1.0',
    status: 'AVAILABLE',
    workflow_bundles: [STAGE_WORKFLOW],
    skill_bundles: [bundle('skills-category:aide-core'), bundle('skills-category:architecture'), bundle('skills-category:discipline')],
    sop_bundles: [bundle('sop:requirements-and-plan'), bundle('sop:minimal-patch'), bundle('sop:adversarial-review'), bundle('sop:safe-execution')],
    tool_classes: ['filesystem.read', 'filesystem.write', 'search', 'terminal.exec', 'git', 'lsp', 'dap', 'tests', 'tasks'],
    model_roles: { plan: 'plan', act: 'act', utility: 'utility' },
    routing_requirements: { local_default: true, required_capabilities: ['chat', 'code'] },
    authority_policy_refs: ['capability.read', 'capability.write', 'capability.execute', 'workspace.write', 'terminal.run', 'git.mutate', 'tasks.run'],
    network_policy_refs: ['offline-default', 'egress-journal'],
    filesystem_policy_refs: ['workspace-containment', 'model-dir-containment'],
    verification_contract_refs: ['harness/veritas.mjs:evaluateExecution', 'harness/gates.mjs:scoreCandidate', 'task-class:code-change'],
    checklists: ['plan-before-edit', 'diff-review', 'tests-or-typecheck', 'no-claim-without-evidence'],
    stop_conditions: ['gate-failed', 'approval-denied', 'verification-not-passed'],
    prohibited_effects: ['silent-destructive-write', 'unapproved-network-egress'],
    resource_policy: { max_context_tokens: 8192, max_parallel_jobs: 2 },
    context_policy: { max_input_tokens: 7680, reserve_output_tokens: 512 },
    required_integrations: [],
    optional_integrations: ['lsp', 'dap', 'ripgrep', 'git'],
    notes: [
      'Strongest current mode: agent loop, tools, authority gates, terminal, git, LSP/DAP, and Veritas all ship today.'
    ]
  },
  {
    schema_version: HARNESS_MODE_SCHEMA_VERSION,
    mode_id: 'web-production',
    display_name: 'Web Production',
    domain: 'web-production',
    version: '1.0',
    status: 'PARTIAL',
    workflow_bundles: [STAGE_WORKFLOW],
    skill_bundles: [bundle('skills-category:web-builder'), bundle('skills-category:architecture')],
    sop_bundles: [bundle('sop:requirements-and-plan'), bundle('sop:minimal-patch'), bundle('sop:adversarial-review')],
    tool_classes: ['filesystem.read', 'filesystem.write', 'search', 'terminal.exec', 'build.vite'],
    model_roles: { plan: 'plan', act: 'act', utility: 'utility' },
    routing_requirements: { local_default: true, required_capabilities: ['chat', 'code'] },
    authority_policy_refs: ['capability.read', 'capability.write', 'capability.execute', 'workspace.write', 'terminal.run'],
    network_policy_refs: ['offline-default', 'egress-journal'],
    filesystem_policy_refs: ['workspace-containment'],
    verification_contract_refs: ['harness/veritas.mjs:evaluateExecution', 'browser-build-gate'],
    checklists: ['responsive-check', 'a11y-check', 'build-gate'],
    stop_conditions: ['build-failed', 'gate-failed', 'approval-denied'],
    prohibited_effects: ['silent-destructive-write', 'unapproved-network-egress'],
    resource_policy: { max_context_tokens: 8192, max_parallel_jobs: 2 },
    context_policy: { max_input_tokens: 7680, reserve_output_tokens: 512 },
    required_integrations: [],
    optional_integrations: ['browser-preview', 'shopify-cli', 'playwright'],
    notes: [
      'Web skill packs and the Vite build gate ship today; browser preview and storefront tooling are not integrated adapters yet, so the mode is PARTIAL rather than a claimed working pipeline.'
    ]
  },
  {
    schema_version: HARNESS_MODE_SCHEMA_VERSION,
    mode_id: 'cybersecurity',
    display_name: 'Cybersecurity (defensive)',
    domain: 'cybersecurity',
    version: '1.0',
    status: 'EXPERIMENTAL',
    workflow_bundles: [STAGE_WORKFLOW],
    skill_bundles: [bundle('skills-category:discipline'), bundle('skills-category:architecture')],
    sop_bundles: [bundle('sop:requirements-and-plan'), bundle('sop:adversarial-review'), bundle('sop:provenance-record')],
    tool_classes: [],
    model_roles: { plan: 'plan', act: 'act', utility: 'utility' },
    routing_requirements: { local_default: true, required_capabilities: ['chat'] },
    authority_policy_refs: ['capability.read', 'capability.write', 'capability.execute'],
    network_policy_refs: ['offline-default', 'egress-journal'],
    filesystem_policy_refs: ['workspace-containment'],
    verification_contract_refs: ['task-class:security-or-publish', 'independent-review-required'],
    checklists: ['authorized-target-scope-declared', 'rules-of-engagement-recorded', 'allowed-tool-classes-explicit', 'evidence-retention-defined', 'retest-required'],
    stop_conditions: ['target-outside-declared-scope', 'missing-rules-of-engagement', 'approval-denied'],
    prohibited_effects: [
      'offensive-automation',
      'credential-capture',
      'network-exploitation',
      'destructive-scan-against-unauthorized-target',
      'data-exfiltration'
    ],
    resource_policy: { max_context_tokens: 8192, max_parallel_jobs: 1 },
    context_policy: { max_input_tokens: 7680, reserve_output_tokens: 512 },
    required_integrations: ['semgrep', 'trivy', 'gitleaks'],
    optional_integrations: ['nmap', 'tshark', 'owasp-zap', 'nuclei', 'sbom-tooling'],
    notes: [
      'METHODOLOGY AND POLICY STRUCTURE ONLY. This campaign builds no offensive automation and no scanner adapters exist in the repo yet; the mode exists so authorized-scope, rules-of-engagement, evidence and retest requirements have a typed home.'
    ]
  },
  {
    schema_version: HARNESS_MODE_SCHEMA_VERSION,
    mode_id: 'machine-learning',
    display_name: 'Machine Learning',
    domain: 'machine-learning',
    version: '1.0',
    status: 'PARTIAL',
    workflow_bundles: [STAGE_WORKFLOW],
    skill_bundles: [bundle('skills-category:training-pipeline'), bundle('skills-category:training-ecosystem'), bundle('skills-category:post-training')],
    sop_bundles: [bundle('sop:requirements-and-plan'), bundle('sop:adversarial-review'), bundle('sop:provenance-record')],
    tool_classes: ['filesystem.read', 'filesystem.write', 'terminal.exec', 'tasks', 'training.job'],
    model_roles: { plan: 'plan', act: 'act', utility: 'utility' },
    routing_requirements: { local_default: true, required_capabilities: ['chat'] },
    authority_policy_refs: ['capability.read', 'capability.write', 'capability.execute', 'tasks.run'],
    network_policy_refs: ['offline-default', 'egress-journal'],
    filesystem_policy_refs: ['workspace-containment', 'model-dir-containment'],
    verification_contract_refs: ['eval-gates', 'train-serve-consistency'],
    checklists: ['hardware-fit-checked', 'dataset-provenance-recorded', 'gate-before-promotion'],
    stop_conditions: ['gate-failed', 'hardware-insufficient', 'approval-denied'],
    prohibited_effects: ['unverified-model-promotion', 'dataset-contamination'],
    resource_policy: { max_context_tokens: 4096, max_parallel_jobs: 1 },
    context_policy: { max_input_tokens: 3584, reserve_output_tokens: 512 },
    required_integrations: [],
    optional_integrations: ['python-training-venv', 'llama-server', 'gtx-1060-fp32'],
    notes: [
      'Training routes, job manager, and eval/export gates ship today; this workbench owns no training datasets itself and hardware is capped at 6GB Pascal FP32, so status is PARTIAL.'
    ]
  },
  {
    schema_version: HARNESS_MODE_SCHEMA_VERSION,
    mode_id: 'business-operations',
    display_name: 'Business Operations',
    domain: 'business-operations',
    version: '1.0',
    status: 'PLANNED',
    workflow_bundles: [STAGE_WORKFLOW],
    skill_bundles: [],
    sop_bundles: [bundle('sop:requirements-and-plan'), bundle('sop:safe-execution')],
    tool_classes: ['filesystem.read', 'filesystem.write'],
    model_roles: { plan: 'plan', act: 'act', utility: 'utility' },
    routing_requirements: { local_default: true, required_capabilities: ['chat'] },
    authority_policy_refs: ['capability.read', 'capability.write'],
    network_policy_refs: ['offline-default', 'egress-journal'],
    filesystem_policy_refs: ['workspace-containment'],
    verification_contract_refs: ['task-class:payment-or-identity'],
    checklists: ['human-approval-recorded'],
    stop_conditions: ['approval-denied'],
    prohibited_effects: ['payment-custody', 'identity-data-exfiltration'],
    resource_policy: { max_context_tokens: 4096, max_parallel_jobs: 1 },
    context_policy: { max_input_tokens: 3584, reserve_output_tokens: 512 },
    required_integrations: ['billing-provider', 'crm'],
    optional_integrations: ['spreadsheet-import'],
    notes: ['Definition only: no operational integrations exist in this repo.']
  },
  {
    schema_version: HARNESS_MODE_SCHEMA_VERSION,
    mode_id: 'research',
    display_name: 'Research',
    domain: 'research',
    version: '1.0',
    status: 'PARTIAL',
    workflow_bundles: [STAGE_WORKFLOW],
    skill_bundles: [bundle('skills-category:general')],
    sop_bundles: [bundle('sop:requirements-and-plan'), bundle('sop:provenance-record')],
    tool_classes: ['filesystem.read', 'search', 'index.retrieval'],
    model_roles: { plan: 'plan', act: 'act', utility: 'utility' },
    routing_requirements: { local_default: true, required_capabilities: ['chat'] },
    authority_policy_refs: ['capability.read'],
    network_policy_refs: ['offline-default', 'egress-journal'],
    filesystem_policy_refs: ['workspace-containment'],
    verification_contract_refs: ['citation-or-explicit-uncertainty'],
    checklists: ['source-recorded', 'uncertainty-labeled'],
    stop_conditions: ['unsourced-claim'],
    prohibited_effects: ['fabricated-citation'],
    resource_policy: { max_context_tokens: 8192, max_parallel_jobs: 2 },
    context_policy: { max_input_tokens: 7680, reserve_output_tokens: 512 },
    required_integrations: [],
    optional_integrations: ['paper-download', 'pdf-extraction'],
    notes: [
      'Offline workspace indexing/retrieval ships today; external literature tooling (paper download/PDF extraction) is not integrated.'
    ]
  }
]);

const STATUS_RANK = Object.freeze({ PLANNED: 0, EXPERIMENTAL: 1, PARTIAL: 2, AVAILABLE: 3 });

export function listModes() {
  return MODE_DEFINITIONS.map(mode => buildMode(mode));
}

export function getMode(modeId) {
  const raw = MODE_DEFINITIONS.find(mode => mode.mode_id === modeId);
  if (raw === undefined) throw new ModeLookupError(modeId);
  return buildMode(raw);
}

function buildMode(raw) {
  const parsed = HarnessModeDefinition.safeParse(raw);
  if (!parsed.success) throw new ModeConflictError(`mode definition invalid: ${raw?.mode_id ?? 'unknown'} (${parsed.error.issues[0]?.message ?? 'schema'})`);
  return Object.freeze(parsed.data);
}

function unionRefs(lists) {
  const seen = new Map();
  for (const list of lists) {
    for (const ref of list) {
      const existing = seen.get(ref.id);
      if (existing !== undefined && existing.version !== ref.version) {
        throw new ModeConflictError(`bundle ${ref.id} declared with conflicting versions ${existing.version} and ${ref.version}`);
      }
      if (existing === undefined) seen.set(ref.id, ref);
    }
  }
  return [...seen.values()];
}

function unionStrings(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const value of list) {
      if (!seen.has(value)) { seen.add(value); out.push(value); }
    }
  }
  return out;
}

function minKey(objects, key) {
  return Math.min(...objects.map(object => object[key]));
}

// Pure merge over already-validated definitions. Exported so conflict rules
// can be exercised directly (composeModes is the registry-backed entry point).
export function composeModeDefinitions(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) throw new ModeConflictError('at least one mode definition is required');
  const all = definitions.map(definition => buildMode(definition));
  const primaryMode = all[0];

  const roleKeys = ['plan', 'act', 'utility'];
  const modelRoles = {};
  for (const role of roleKeys) {
    const values = new Set(all.map(mode => mode.model_roles[role]));
    if (values.size > 1) {
      throw new ModeConflictError(`model role "${role}" has conflicting assignments: ${[...values].join(', ')}`);
    }
    modelRoles[role] = [...values][0];
  }

  const effective = {
    workflow_bundles: unionRefs(all.map(mode => mode.workflow_bundles)),
    skill_bundles: unionRefs(all.map(mode => mode.skill_bundles)),
    sop_bundles: unionRefs(all.map(mode => mode.sop_bundles)),
    tool_classes: unionStrings(all.map(mode => mode.tool_classes)),
    model_roles: modelRoles,
    routing_requirements: {
      local_default: all.some(mode => mode.routing_requirements.local_default),
      required_capabilities: unionStrings(all.map(mode => mode.routing_requirements.required_capabilities))
    },
    authority_policy_refs: unionStrings(all.map(mode => mode.authority_policy_refs)),
    network_policy_refs: unionStrings(all.map(mode => mode.network_policy_refs)),
    filesystem_policy_refs: unionStrings(all.map(mode => mode.filesystem_policy_refs)),
    verification_contract_refs: unionStrings(all.map(mode => mode.verification_contract_refs)),
    checklists: unionStrings(all.map(mode => mode.checklists)),
    stop_conditions: unionStrings(all.map(mode => mode.stop_conditions)),
    prohibited_effects: unionStrings(all.map(mode => mode.prohibited_effects)),
    resource_policy: {
      max_context_tokens: minKey(all.map(mode => mode.resource_policy), 'max_context_tokens'),
      max_parallel_jobs: minKey(all.map(mode => mode.resource_policy), 'max_parallel_jobs')
    },
    context_policy: {
      max_input_tokens: minKey(all.map(mode => mode.context_policy), 'max_input_tokens'),
      reserve_output_tokens: minKey(all.map(mode => mode.context_policy), 'reserve_output_tokens')
    },
    required_integrations: unionStrings(all.map(mode => mode.required_integrations)),
    optional_integrations: unionStrings(all.map(mode => mode.optional_integrations))
  };
  effective.optional_integrations = effective.optional_integrations.filter(integration => !effective.required_integrations.includes(integration));

  const status = all.map(mode => mode.status).reduce((worst, candidate) => STATUS_RANK[candidate] < STATUS_RANK[worst] ? candidate : worst, 'AVAILABLE');

  const composed = {
    schema_version: HARNESS_MODE_SCHEMA_VERSION,
    composed: true,
    primary_mode_id: primaryMode.mode_id,
    specialization_ids: all.slice(1).map(mode => mode.mode_id),
    status,
    effective,
    notes: [
      `composed from ${all.map(mode => mode.mode_id).join(' + ')}`,
      `status is the weakest component (${status}); composition can only narrow permissions, never loosen them`
    ]
  };
  const parsed = ComposedHarnessMode.safeParse(composed);
  if (!parsed.success) throw new ModeConflictError(`composed mode invalid: ${parsed.error.issues[0]?.message ?? 'schema'}`);
  return Object.freeze(parsed.data);
}

// Deterministic composition. Loadouts accumulate (bundles/tools/checklists),
// constraints accumulate (policy refs/prohibited effects/stop conditions), and
// budgets tighten (min per numeric cap). A specialization can only narrow.
// Conflicts (same role mapped differently, or one bundle id with two versions)
// fail with ModeConflictError instead of silently picking a winner.
export function composeModes({ primary, specializations = [] } = {}) {
  const primaryMode = getMode(primary);
  const specializationModes = specializations.map(modeId => getMode(modeId));
  return composeModeDefinitions([primaryMode, ...specializationModes]);
}

// Invariant used by tests and future callers: every constraint present in an
// input mode must survive composition, and no budget may grow.
export function compositionNeverLoosens({ primary, specializations = [] } = {}) {
  const composed = composeModes({ primary, specializations });
  for (const modeId of [primary, ...specializations]) {
    const mode = getMode(modeId);
    for (const ref of [...mode.authority_policy_refs, ...mode.network_policy_refs, ...mode.filesystem_policy_refs, ...mode.stop_conditions, ...mode.prohibited_effects]) {
      const pool = [
        ...composed.effective.authority_policy_refs,
        ...composed.effective.network_policy_refs,
        ...composed.effective.filesystem_policy_refs,
        ...composed.effective.stop_conditions,
        ...composed.effective.prohibited_effects
      ];
      if (!pool.includes(ref)) return { ok: false, reason: `${modeId} constraint dropped: ${ref}` };
    }
    if (composed.effective.resource_policy.max_context_tokens > mode.resource_policy.max_context_tokens) return { ok: false, reason: `${modeId} resource budget grew` };
    if (composed.effective.context_policy.max_input_tokens > mode.context_policy.max_input_tokens) return { ok: false, reason: `${modeId} context budget grew` };
  }
  return { ok: true, composed };
}
