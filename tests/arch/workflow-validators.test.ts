// tests/arch/workflow-validators.test.ts
// Slice 5 verification: artifact validators are deterministic and read-only.
// They accept well-formed artifacts whose files exist with matching sha256 and
// whose upstream dependencies are present, and they reject malformed content,
// checksum mismatches, wrong stage ownership, stale references, missing
// dependencies, unresolvable Veritas evidence references, and path escapes.
// The final test proves validation never mutates the workspace (including the
// workflow state file).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { ARTIFACT_VALIDATORS, validateArtifactRef } from '../../node/src/services/workflow-validators.ts';
import type { WorkflowArtifactRefT, WorkflowArtifactTypeT } from '../../common/contracts/workflow.ts';

const TS = '2026-09-15T00:00:00.000Z';
const workspaces: string[] = [];

after(async () => {
  for (const workspace of workspaces) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await fs.rm(workspace, { recursive: true, force: true });
        break;
      } catch (error) {
        if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }
});

async function setup(): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'aide-workflow-validators-'));
  workspaces.push(workspace);
  return workspace;
}

async function writeFileRef(workspace: string, rel: string, raw: string, type: WorkflowArtifactTypeT, overrides: Partial<WorkflowArtifactRefT> = {}): Promise<WorkflowArtifactRefT> {
  const target = overrides.path ?? rel;
  const absolute = path.join(workspace, target);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, raw, 'utf8');
  return {
    artifact_id: randomUUID(),
    artifact_type: type,
    stage: ARTIFACT_VALIDATORS[type].stage,
    path: target,
    sha256: createHash('sha256').update(Buffer.from(raw, 'utf8')).digest('hex'),
    created_at: TS,
    verification_status: 'validated',
    ...overrides
  };
}

async function writeArtifact(workspace: string, type: WorkflowArtifactTypeT, content: Record<string, unknown>, overrides: Partial<WorkflowArtifactRefT> = {}): Promise<WorkflowArtifactRefT> {
  const rel = overrides.path ?? `docs/experience/${type.toLowerCase()}-${randomUUID()}.json`;
  return writeFileRef(workspace, rel, JSON.stringify(content, null, 2), type, overrides);
}

async function writeVerification(workspace: string, sessionId: string): Promise<void> {
  const dir = path.join(workspace, '.aide', 'verifications');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${sessionId}.verification.json`), JSON.stringify({ session_id: sessionId }), 'utf8');
}

function dependencyRefs(type: WorkflowArtifactTypeT): WorkflowArtifactRefT[] {
  return ARTIFACT_VALIDATORS[type].dependencies.map(dependency => ({
    artifact_id: randomUUID(),
    artifact_type: dependency,
    stage: ARTIFACT_VALIDATORS[dependency].stage,
    path: `docs/experience/${dependency.toLowerCase()}-dep.json`,
    sha256: 'a'.repeat(64),
    created_at: TS,
    verification_status: 'validated'
  }));
}

const paletteEntry = () => ({ value: '#111111', purpose: 'body text', on_background: '#ffffff', contrast_ratio: 12.6 });

const briefContent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  business_objective: { primary: 'lead_generation', measurable_goal: '100 leads per month' },
  audience_segments: [{ role: 'founder', context: 'searching for a studio', desired_outcome: 'book a call' }],
  anti_audience: 'enterprise procurement teams',
  constraints: { platform: 'static-html', performance: 'LCP under 2s', accessibility: 'WCAG AA', legal_compliance: 'none known' },
  exclusions: ['no blog'],
  experience_character: { feeling: 'confident', atmosphere: 'calm studio', interaction_character: 'deliberate', grounded_descriptors: ['8px spacing grid'] },
  required_capabilities: ['contact form'],
  ...overrides
});

const blueprintContent = (): Record<string, unknown> => ({
  brief_ref: 'brief-1',
  page_character: 'a calm, confident studio introduction',
  conversion_path: 'hero -> proof -> book a call',
  sections: [{
    id: 'hero',
    type: 'hero',
    purpose: 'establish intent',
    attention_role: 'peak',
    preceding_context: 'arrived from search',
    mobile_behavior: { order: 1, visibility: 'full' }
  }],
  attention_flow: { peaks: ['hero'], valleys: [], primary_cta_position: 'hero' },
  cta_architecture: { primary: { text: 'Book a call', section: 'hero', motivation_context: 'clear offer' } },
  mobile_hierarchy_notes: 'hero CTA above the fold',
  architecture_confidence: 'high'
});

const visualContent = (): Record<string, unknown> => ({
  blueprint_ref: 'arch-1',
  aesthetic_thesis: { intent: 'warm minimalism', temperature: 'warm', density: 'spacious', grounding: 'grounded', intimacy: 'moderate', references: ['kinfolk editorial'] },
  typography: {
    typeface_personality: 'humanist',
    primary_family: 'Inter',
    scale_ratio: 1.25,
    sizes: { display: '3rem', h1: '2rem', h2: '1.5rem', h3: '1.25rem', body: '1rem', caption: '0.8rem' }
  },
  palette: { primary: paletteEntry(), secondary: paletteEntry(), accent: paletteEntry(), neutral: paletteEntry(), surface: paletteEntry(), harmony_logic: 'low-chroma warm neutrals' },
  spacing: { base_unit: '8px', scale: ['8px', '16px'] },
  material_lighting: { material_quality: 'matte', elevation_expression: 'soft shadow', lighting_character: 'soft', layering_rules: 'single elevation scale' },
  component_tone: { button_personality: 'quiet', card_personality: 'flat', input_personality: 'minimal', navigation_personality: 'sparse' }
});

const interactionContent = (): Record<string, unknown> => ({
  blueprint_ref: 'arch-1',
  visual_system_ref: 'vis-1',
  scroll_choreography: [],
  transitions: { vocabulary: ['fade'], speed_mapping: { fast_ms: 150, medium_ms: 300, slow_ms: 600 }, easing_semantics: 'ease-out for arrivals' },
  micro_interactions: [],
  reduced_motion: { strategy: 'instant-state', fallback_description: 'content appears immediately', content_hierarchy_preserved: true },
  performance_constraints: { max_concurrent_animations: 2, prohibited_properties: ['width'], target_fps: 60 }
});

const implementationContent = (): Record<string, unknown> => ({
  blueprint_ref: 'arch-1',
  visual_system_ref: 'vis-1',
  platform: 'static-html',
  component_tree: { root: 'Page', components: [{ name: 'Page', section_ref: 'hero', type: 'container' }] },
  state_ownership: [],
  client_server_boundary: { boundary_rationale: 'static hosting, no hydration' },
  asset_strategy: {
    images: { format: 'avif', loading: 'lazy', sizing: 'responsive' },
    fonts: { format: 'woff2', loading: 'preload', display: 'swap' },
    scripts: { type: 'module', loading: 'defer', critical: false },
    styles: { type: 'css', loading: 'critical-inline', critical: true }
  },
  performance_budget: { lcp_ms: 2500, cls: 0.1, bundle_size_kb: 50 }
});

const releaseContent = (sessionId: string): Record<string, unknown> => ({
  implementation_ref: 'impl-1',
  scope: 'full',
  accessibility: { status: 'pass', findings: [] },
  responsive: { status: 'pass', breakpoints_tested: [375, 1440], findings: [] },
  performance: { status: 'pass', budget_compliance: 'pass' },
  browser: { status: 'pass', browsers_tested: ['chrome-130'], findings: [] },
  security: { status: 'pass', findings: [] },
  blockers: [],
  overall_status: 'ready',
  qc_reviewer: 'operator',
  veritas_evidence: { session_id: sessionId }
});

const deploymentContent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  qc_ref: 'qc-1',
  build_identity: { source_commit: 'abc123', build_timestamp: TS, artifact_hash: 'build-hash-1' },
  staging_verification: { staging_url: 'https://staging.example.com', staging_matches_production_intent: true },
  hosting_configuration: { platform: 'netlify', domain: 'example.com' },
  deployment_execution: { method: 'cli', timestamp: TS, artifact_hash: 'build-hash-1' },
  post_deployment_verification: { url_loads: true, assets_resolve: true, ssl_valid: true, critical_paths_pass: true, hash_matches_build: true },
  rollback_strategy: { method: 'redeploy previous build', estimated_time: '2 minutes' },
  monitoring: { uptime_monitoring: 'provider checks every minute', alert_thresholds: 'any 5xx' },
  ...overrides
});

function contentFor(type: WorkflowArtifactTypeT, sessionId: string): Record<string, unknown> {
  switch (type) {
    case 'EXPERIENCE_BRIEF': return briefContent();
    case 'EXPERIENCE_BLUEPRINT': return blueprintContent();
    case 'VISUAL_SYSTEM': return visualContent();
    case 'INTERACTION_PLAN': return interactionContent();
    case 'IMPLEMENTATION_BLUEPRINT': return implementationContent();
    case 'RELEASE_EVIDENCE': return releaseContent(sessionId);
    case 'DEPLOYMENT_RECORD': return deploymentContent();
  }
}

async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out[path.relative(dir, full)] = createHash('sha256').update(await fs.readFile(full)).digest('hex');
    }
  }
  await walk(dir);
  return out;
}

test('the registry covers all seven artifact types with stage ownership and dependencies', () => {
  assert.deepEqual(
    Object.keys(ARTIFACT_VALIDATORS).sort(),
    ['DEPLOYMENT_RECORD', 'EXPERIENCE_BLUEPRINT', 'EXPERIENCE_BRIEF', 'IMPLEMENTATION_BLUEPRINT', 'INTERACTION_PLAN', 'RELEASE_EVIDENCE', 'VISUAL_SYSTEM']
  );
  assert.equal(ARTIFACT_VALIDATORS.EXPERIENCE_BRIEF.stage, 'DISCOVERY');
  assert.equal(ARTIFACT_VALIDATORS.EXPERIENCE_BLUEPRINT.stage, 'ARCHITECTURE');
  assert.equal(ARTIFACT_VALIDATORS.VISUAL_SYSTEM.stage, 'DESIGN');
  assert.equal(ARTIFACT_VALIDATORS.INTERACTION_PLAN.stage, 'DESIGN');
  assert.equal(ARTIFACT_VALIDATORS.IMPLEMENTATION_BLUEPRINT.stage, 'IMPLEMENTATION');
  assert.equal(ARTIFACT_VALIDATORS.RELEASE_EVIDENCE.stage, 'VALIDATION');
  assert.equal(ARTIFACT_VALIDATORS.DEPLOYMENT_RECORD.stage, 'DEPLOYMENT');
  assert.deepEqual(ARTIFACT_VALIDATORS.DEPLOYMENT_RECORD.dependencies, ['RELEASE_EVIDENCE']);
  assert.deepEqual(ARTIFACT_VALIDATORS.EXPERIENCE_BRIEF.dependencies, []);
});

test('every registered validator accepts a well-formed artifact', async () => {
  for (const type of Object.keys(ARTIFACT_VALIDATORS) as WorkflowArtifactTypeT[]) {
    const workspace = await setup();
    const sessionId = randomUUID();
    if (type === 'RELEASE_EVIDENCE') await writeVerification(workspace, sessionId);
    const ref = await writeArtifact(workspace, type, contentFor(type, sessionId));
    const outcome = await validateArtifactRef(ref, { workspace, refs: dependencyRefs(type) });
    assert.deepEqual(outcome, { result: 'satisfied', failed: [] }, type);
  }
});

test('malformed artifact content is rejected', async () => {
  const workspace = await setup();
  const missingField = briefContent();
  delete missingField.anti_audience;
  const malformed = await writeArtifact(workspace, 'EXPERIENCE_BRIEF', missingField);
  const outcome = await validateArtifactRef(malformed, { workspace });
  assert.equal(outcome.result, 'unsatisfied');
  assert.ok(outcome.failed.some(entry => entry.startsWith('content_invalid:')));
  const notJson = await writeFileRef(workspace, 'docs/broken.json', '{not json', 'EXPERIENCE_BRIEF');
  const outcome2 = await validateArtifactRef(notJson, { workspace });
  assert.deepEqual(outcome2.failed, ['content_not_json']);
});

test('checksum mismatch is rejected', async () => {
  const workspace = await setup();
  const ref = await writeArtifact(workspace, 'EXPERIENCE_BRIEF', briefContent(), { sha256: 'f'.repeat(64) });
  const outcome = await validateArtifactRef(ref, { workspace });
  assert.equal(outcome.result, 'unsatisfied');
  assert.ok(outcome.failed.includes('checksum_mismatch'));
});

test('wrong stage ownership is rejected', async () => {
  const workspace = await setup();
  const ref = await writeArtifact(workspace, 'VISUAL_SYSTEM', visualContent(), { stage: 'DISCOVERY' });
  const outcome = await validateArtifactRef(ref, { workspace, refs: dependencyRefs('VISUAL_SYSTEM') });
  assert.equal(outcome.result, 'unsatisfied');
  assert.ok(outcome.failed.includes('wrong_stage:VISUAL_SYSTEM'));
});

test('stale artifact references are rejected', async () => {
  const workspace = await setup();
  const ref = await writeArtifact(workspace, 'EXPERIENCE_BRIEF', briefContent(), { verification_status: 'stale' });
  const outcome = await validateArtifactRef(ref, { workspace });
  assert.equal(outcome.result, 'unsatisfied');
  assert.ok(outcome.failed.includes('stale:EXPERIENCE_BRIEF'));
});

test('missing and stale dependencies are rejected', async () => {
  const workspace = await setup();
  const ref = await writeArtifact(workspace, 'VISUAL_SYSTEM', visualContent());
  const missing = await validateArtifactRef(ref, { workspace, refs: [] });
  assert.equal(missing.result, 'unsatisfied');
  assert.ok(missing.failed.includes('missing_dependency:EXPERIENCE_BLUEPRINT'));
  const staleDeps = dependencyRefs('VISUAL_SYSTEM').map(dependency => ({ ...dependency, verification_status: 'stale' as const }));
  const stale = await validateArtifactRef(ref, { workspace, refs: staleDeps });
  assert.equal(stale.result, 'unsatisfied');
  assert.ok(stale.failed.includes('stale_dependency:EXPERIENCE_BLUEPRINT'));
  const ok = await validateArtifactRef(ref, { workspace, refs: dependencyRefs('VISUAL_SYSTEM') });
  assert.deepEqual(ok, { result: 'satisfied', failed: [] });
});

test('the Veritas evidence reference is required and must resolve', async () => {
  const workspace = await setup();
  const sessionId = randomUUID();
  const ref = await writeArtifact(workspace, 'RELEASE_EVIDENCE', releaseContent(sessionId));
  const missing = await validateArtifactRef(ref, { workspace, refs: dependencyRefs('RELEASE_EVIDENCE') });
  assert.equal(missing.result, 'unsatisfied');
  assert.ok(missing.failed.includes('veritas_evidence_missing'));
  await writeVerification(workspace, sessionId);
  const ok = await validateArtifactRef(ref, { workspace, refs: dependencyRefs('RELEASE_EVIDENCE') });
  assert.deepEqual(ok, { result: 'satisfied', failed: [] });
  const invalid = await writeArtifact(workspace, 'RELEASE_EVIDENCE', releaseContent('bad/id'));
  const invalidOutcome = await validateArtifactRef(invalid, { workspace, refs: dependencyRefs('RELEASE_EVIDENCE') });
  assert.ok(invalidOutcome.failed.includes('veritas_evidence_invalid'));
});

test('deployment records must match the deployed hash to the build identity', async () => {
  const workspace = await setup();
  const content = deploymentContent({ deployment_execution: { method: 'cli', timestamp: TS, artifact_hash: 'other-hash' } });
  const ref = await writeArtifact(workspace, 'DEPLOYMENT_RECORD', content);
  const outcome = await validateArtifactRef(ref, { workspace, refs: dependencyRefs('DEPLOYMENT_RECORD') });
  assert.equal(outcome.result, 'unsatisfied');
  assert.ok(outcome.failed.some(entry => entry.startsWith('content_invalid:')));
});

test('paths escaping the workspace are rejected', async () => {
  const workspace = await setup();
  const ref: WorkflowArtifactRefT = {
    artifact_id: randomUUID(),
    artifact_type: 'EXPERIENCE_BRIEF',
    stage: 'DISCOVERY',
    path: '../outside.json',
    sha256: 'a'.repeat(64),
    created_at: TS,
    verification_status: 'validated'
  };
  const outcome = await validateArtifactRef(ref, { workspace });
  assert.equal(outcome.result, 'unsatisfied');
  assert.ok(outcome.failed.includes('path_escape'));
});

test('validation never mutates workflow state or workspace files', async () => {
  const workspace = await setup();
  await fs.mkdir(path.join(workspace, '.aide', 'workflow'), { recursive: true });
  await fs.writeFile(path.join(workspace, '.aide', 'workflow', 'state.json'), JSON.stringify({ stage: 'DISCOVERY', revision: 0 }), 'utf8');
  const sessionId = randomUUID();
  await writeVerification(workspace, sessionId);
  const ref = await writeArtifact(workspace, 'EXPERIENCE_BRIEF', briefContent());
  const before = await snapshot(workspace);
  assert.equal((await validateArtifactRef(ref, { workspace })).result, 'satisfied');
  assert.equal((await validateArtifactRef({ ...ref, sha256: 'f'.repeat(64) }, { workspace })).result, 'unsatisfied');
  const after = await snapshot(workspace);
  assert.deepEqual(after, before);
});
