// tests/arch/workflow-fixtures.ts
// Shared real-file fixtures for the workflow service tests (Slices 4-6):
// valid artifact content per type (mirroring the ex-* OUTPUT CONTRACTs), a
// writer that returns a WorkflowArtifactRef whose sha256 matches the bytes on
// disk, and the Veritas verification record writer used by the release
// evidence tests.
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { ARTIFACT_VALIDATORS } from '../../node/src/services/workflow-validators.ts';
import type { WorkflowArtifactRefT, WorkflowArtifactTypeT } from '../../common/contracts/workflow.ts';

export const TS = '2026-09-15T00:00:00.000Z';

export async function writeArtifact(workspace: string, type: WorkflowArtifactTypeT, content: Record<string, unknown>, overrides: Partial<WorkflowArtifactRefT> = {}): Promise<WorkflowArtifactRefT> {
  const target = overrides.path ?? `docs/experience/${type.toLowerCase()}-${randomUUID()}.json`;
  const raw = JSON.stringify(content, null, 2);
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

export async function writeVerification(workspace: string, sessionId: string, record: Record<string, unknown> = {}): Promise<void> {
  const dir = path.join(workspace, '.aide', 'verifications');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${sessionId}.verification.json`), JSON.stringify({ session_id: sessionId, ...record }, null, 2), 'utf8');
}

const paletteEntry = () => ({ value: '#111111', purpose: 'body text', on_background: '#ffffff', contrast_ratio: 12.6 });

export const briefContent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
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

const deploymentContent = (): Record<string, unknown> => ({
  qc_ref: 'qc-1',
  build_identity: { source_commit: 'abc123', build_timestamp: TS, artifact_hash: 'build-hash-1' },
  staging_verification: { staging_url: 'https://staging.example.com', staging_matches_production_intent: true },
  hosting_configuration: { platform: 'netlify', domain: 'example.com' },
  deployment_execution: { method: 'cli', timestamp: TS, artifact_hash: 'build-hash-1' },
  post_deployment_verification: { url_loads: true, assets_resolve: true, ssl_valid: true, critical_paths_pass: true, hash_matches_build: true },
  rollback_strategy: { method: 'redeploy previous build', estimated_time: '2 minutes' },
  monitoring: { uptime_monitoring: 'provider checks every minute', alert_thresholds: 'any 5xx' }
});

export function validContentFor(type: WorkflowArtifactTypeT, sessionId = ''): Record<string, unknown> {
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
