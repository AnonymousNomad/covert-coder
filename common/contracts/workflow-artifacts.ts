import { z } from 'zod';
import type { WorkflowArtifactTypeT, WorkflowStageT } from './workflow.ts';

// Workflow artifact CONTENT contracts (Slice 5). These schemas encode the
// required fields and shape of each Experience Engineering artifact type as
// defined by the ex-* stage skills' OUTPUT CONTRACT sections, with AIDE
// runtime extensions where the machine gate requires them (RELEASE_EVIDENCE
// carries a veritas_evidence reference; QC pass conditions are literal).
// Content is authored externally (operator/session), so unknown extra fields
// are tolerated (default zod strip); required fields and shapes are strict.
// Validators live in node/src/services/workflow-validators.ts and are
// read-only: they never author content, call models, or touch authority.

const NonEmpty = z.string().min(1);

// ── EXPERIENCE_BRIEF (DISCOVERY — ex-strat-client-brief-extraction) ────────

const AudienceSegment = z.object({
  role: NonEmpty,
  context: NonEmpty,
  desired_outcome: NonEmpty,
  emotional_state: NonEmpty.optional(),
  conversion_path: NonEmpty.optional()
});

export const ExperienceBrief = z.object({
  brief_id: NonEmpty.optional(),
  business_objective: z.object({
    primary: NonEmpty,
    measurable_goal: NonEmpty,
    time_horizon: NonEmpty.optional()
  }),
  audience_segments: z.array(AudienceSegment).min(1),
  anti_audience: NonEmpty,
  constraints: z.object({
    platform: NonEmpty,
    performance: NonEmpty,
    accessibility: NonEmpty,
    legal_compliance: NonEmpty,
    budget: NonEmpty.optional(),
    timeline: NonEmpty.optional()
  }),
  exclusions: z.array(NonEmpty),
  experience_character: z.object({
    feeling: NonEmpty,
    atmosphere: NonEmpty,
    interaction_character: NonEmpty,
    analogies: z.array(NonEmpty).optional(),
    grounded_descriptors: z.array(NonEmpty).min(1)
  }),
  required_capabilities: z.array(NonEmpty).min(1),
  open_questions: z.array(NonEmpty).optional(),
  assumptions: z.array(NonEmpty).optional()
});
export type ExperienceBriefT = z.infer<typeof ExperienceBrief>;

// ── EXPERIENCE_BLUEPRINT (ARCHITECTURE — ex-arch-immersive-landing-architecture)

const BlueprintSection = z.object({
  id: NonEmpty,
  type: z.enum(['hero', 'narrative', 'evidence', 'feature', 'testimonial', 'cta', 'footer', 'nav', 'custom']),
  purpose: NonEmpty,
  attention_role: z.enum(['peak', 'valley', 'transition', 'anchor']),
  preceding_context: NonEmpty,
  content_requirements: z.object({
    headline: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    media: z.string().nullable().optional(),
    cta: z.string().nullable().optional(),
    social_proof: z.string().nullable().optional()
  }).optional(),
  mobile_behavior: z.object({
    order: z.number().int().nonnegative(),
    visibility: z.enum(['full', 'condensed', 'collapsed', 'hidden']),
    mobile_notes: z.string().optional()
  })
});

export const ExperienceBlueprint = z.object({
  blueprint_id: NonEmpty.optional(),
  brief_ref: NonEmpty,
  page_character: NonEmpty,
  conversion_path: NonEmpty,
  sections: z.array(BlueprintSection).min(1),
  attention_flow: z.object({
    peaks: z.array(z.string()),
    valleys: z.array(z.string()),
    primary_cta_position: NonEmpty
  }),
  cta_architecture: z.object({
    primary: z.object({ text: NonEmpty, section: NonEmpty, motivation_context: NonEmpty }),
    secondary: z.array(z.object({ text: NonEmpty, section: NonEmpty, purpose: NonEmpty })).optional()
  }),
  mobile_hierarchy_notes: NonEmpty,
  section_count: z.number().int().positive().optional(),
  architecture_confidence: z.enum(['high', 'medium', 'low'])
});
export type ExperienceBlueprintT = z.infer<typeof ExperienceBlueprint>;

// ── VISUAL_SYSTEM (DESIGN — ex-vis-premium-aesthetic-language) ─────────────

const PaletteEntry = z.object({
  value: NonEmpty,
  purpose: NonEmpty,
  on_background: NonEmpty,
  contrast_ratio: z.number()
});

export const VisualSystem = z.object({
  system_id: NonEmpty.optional(),
  blueprint_ref: NonEmpty,
  aesthetic_thesis: z.object({
    intent: NonEmpty,
    temperature: z.enum(['warm', 'cool', 'neutral']),
    density: z.enum(['dense', 'moderate', 'spacious']),
    grounding: z.enum(['grounded', 'balanced', 'elevated']),
    intimacy: z.enum(['intimate', 'moderate', 'expansive']),
    references: z.array(NonEmpty).min(1)
  }),
  typography: z.object({
    typeface_personality: z.enum(['humanist', 'geometric', 'neo-grotesque', 'transitional', 'display']),
    primary_family: NonEmpty,
    secondary_family: NonEmpty.optional(),
    scale_ratio: z.number().positive(),
    sizes: z.object({
      display: NonEmpty,
      h1: NonEmpty,
      h2: NonEmpty,
      h3: NonEmpty,
      body: NonEmpty,
      caption: NonEmpty
    }),
    line_heights: z.object({ display: z.number().positive(), heading: z.number().positive(), body: z.number().positive() }).optional(),
    hierarchy_rules: NonEmpty.optional()
  }),
  palette: z.object({
    primary: PaletteEntry,
    secondary: PaletteEntry,
    accent: PaletteEntry,
    neutral: PaletteEntry,
    surface: PaletteEntry,
    harmony_logic: NonEmpty
  }),
  spacing: z.object({
    base_unit: NonEmpty,
    scale: z.array(NonEmpty).min(1),
    section_padding: NonEmpty.optional(),
    component_gap: NonEmpty.optional(),
    inline_spacing: NonEmpty.optional(),
    rhythm_rules: NonEmpty.optional()
  }),
  material_lighting: z.object({
    material_quality: z.enum(['matte', 'glass', 'metallic', 'organic', 'paper', 'custom']),
    elevation_expression: NonEmpty,
    lighting_character: z.enum(['directional', 'ambient', 'dramatic', 'soft', 'natural']),
    layering_rules: NonEmpty
  }),
  component_tone: z.object({
    button_personality: NonEmpty,
    card_personality: NonEmpty,
    input_personality: NonEmpty,
    navigation_personality: NonEmpty
  })
});
export type VisualSystemT = z.infer<typeof VisualSystem>;

// ── INTERACTION_PLAN (DESIGN — ex-int-motion-choreography) ─────────────────

export const InteractionPlan = z.object({
  interaction_id: NonEmpty.optional(),
  blueprint_ref: NonEmpty,
  visual_system_ref: NonEmpty,
  scroll_choreography: z.array(z.object({
    section_ref: NonEmpty,
    animation_type: z.enum(['reveal', 'transition', 'emphasize', 'rest']),
    trigger: z.enum(['scroll-linked', 'scroll-triggered', 'time-based']),
    direction: NonEmpty,
    duration_ms: z.number().positive(),
    easing: NonEmpty,
    purpose: NonEmpty
  })),
  transitions: z.object({
    vocabulary: z.array(NonEmpty).min(1),
    speed_mapping: z.object({ fast_ms: z.number().positive(), medium_ms: z.number().positive(), slow_ms: z.number().positive() }),
    easing_semantics: NonEmpty
  }),
  micro_interactions: z.array(z.object({
    element: NonEmpty,
    states: z.object({
      hover: NonEmpty,
      focus: NonEmpty,
      active: NonEmpty,
      success: NonEmpty,
      error: NonEmpty
    }),
    duration_ms: z.number().positive(),
    purpose: NonEmpty
  })),
  reduced_motion: z.object({
    strategy: z.enum(['instant-state', 'opacity-only', 'omitted', 'custom']),
    fallback_description: NonEmpty,
    content_hierarchy_preserved: z.boolean()
  }),
  performance_constraints: z.object({
    max_concurrent_animations: z.number().int().positive(),
    max_duration_ms: z.number().positive().optional(),
    prohibited_properties: z.array(NonEmpty),
    compositing_only: z.boolean().optional(),
    target_fps: z.number().int().positive()
  })
});
export type InteractionPlanT = z.infer<typeof InteractionPlan>;

// ── IMPLEMENTATION_BLUEPRINT (IMPLEMENTATION — ex-fnt-component-composition)

export const ImplementationBlueprint = z.object({
  implementation_id: NonEmpty.optional(),
  blueprint_ref: NonEmpty,
  visual_system_ref: NonEmpty,
  platform: NonEmpty,
  component_tree: z.object({
    root: NonEmpty,
    components: z.array(z.object({
      name: NonEmpty,
      section_ref: NonEmpty,
      type: z.enum(['layout', 'presentation', 'interactive', 'container']),
      children: z.array(NonEmpty).optional(),
      props_interface: z.string().optional(),
      render_contract: z.string().optional()
    })).min(1),
    depth: z.number().int().positive().optional()
  }),
  state_ownership: z.array(z.object({
    state_key: NonEmpty,
    owner: NonEmpty,
    readers: z.array(NonEmpty).optional(),
    update_triggers: z.array(NonEmpty).optional(),
    scope: z.enum(['local', 'shared', 'global'])
  })),
  client_server_boundary: z.object({
    server_rendered: z.array(NonEmpty).optional(),
    client_hydrated: z.array(NonEmpty).optional(),
    static_assets: z.array(NonEmpty).optional(),
    boundary_rationale: NonEmpty
  }),
  asset_strategy: z.object({
    images: z.object({ format: NonEmpty, loading: z.enum(['eager', 'lazy', 'preload']), sizing: z.enum(['responsive', 'fixed', 'art-directed']) }),
    fonts: z.object({ format: NonEmpty, loading: NonEmpty, display: z.enum(['swap', 'block', 'fallback']) }),
    scripts: z.object({ type: NonEmpty, loading: z.enum(['eager', 'defer', 'async']), critical: z.boolean() }),
    styles: z.object({ type: NonEmpty, loading: NonEmpty, critical: z.boolean() })
  }),
  performance_budget: z.object({
    lcp_ms: z.number().positive(),
    cls: z.number().nonnegative(),
    fid_ms: z.number().positive().optional(),
    bundle_size_kb: z.number().positive(),
    total_weight_kb: z.number().positive().optional()
  })
});
export type ImplementationBlueprintT = z.infer<typeof ImplementationBlueprint>;

// ── RELEASE_EVIDENCE (VALIDATION — ex-qc-production-readiness-checklist) ───
// AIDE runtime extension: the content must reference the Veritas verification
// record it rests on (session_id resolves to .aide/verifications/<id>.json).
// The validator checks the reference resolves; verdict adjudication remains
// Veritas/operator-owned. QC pass conditions are literal so the machine gate
// cannot accept a blocked or conditional release.

const QcFinding = z.object({ severity: NonEmpty }).passthrough();

export const ReleaseEvidence = z.object({
  qc_id: NonEmpty.optional(),
  implementation_ref: NonEmpty,
  scope: NonEmpty,
  accessibility: z.object({
    status: z.literal('pass'),
    wcag_level: NonEmpty.optional(),
    findings: z.array(QcFinding),
    semantic_html: z.string().optional(),
    keyboard_navigation: z.string().optional(),
    color_contrast: z.string().optional(),
    alt_text: z.string().optional(),
    reduced_motion: z.string().optional()
  }),
  responsive: z.object({
    status: z.literal('pass'),
    breakpoints_tested: z.array(z.number()).min(1),
    findings: z.array(QcFinding)
  }),
  performance: z.object({
    status: z.literal('pass'),
    lcp_ms: z.number().optional(),
    cls: z.number().optional(),
    fid_ms: z.number().optional(),
    bundle_size_kb: z.number().optional(),
    total_weight_kb: z.number().optional(),
    budget_compliance: z.literal('pass')
  }),
  browser: z.object({
    status: z.literal('pass'),
    browsers_tested: z.array(NonEmpty).min(1),
    findings: z.array(QcFinding)
  }),
  security: z.object({
    status: z.literal('pass'),
    https: z.string().optional(),
    csp: z.string().optional(),
    mixed_content: z.string().optional(),
    exposed_secrets: z.string().optional(),
    findings: z.array(QcFinding)
  }),
  blockers: z.array(z.record(z.string(), z.unknown())).max(0),
  overall_status: z.literal('ready'),
  qc_reviewer: NonEmpty,
  veritas_evidence: z.object({ session_id: NonEmpty.max(128) })
});
export type ReleaseEvidenceT = z.infer<typeof ReleaseEvidence>;

// ── DEPLOYMENT_RECORD (DEPLOYMENT — ex-dply-static-hosting-deploy) ─────────
// Deployment pass conditions are literal: staging intent confirmed, post
// deployment verification all true, and the deployed artifact hash must equal
// the recorded build identity hash.

export const DeploymentRecord = z.object({
  deployment_id: NonEmpty.optional(),
  qc_ref: NonEmpty,
  build_identity: z.object({
    source_commit: NonEmpty,
    build_timestamp: NonEmpty,
    build_tool: NonEmpty.optional(),
    build_config: NonEmpty.optional(),
    artifact_hash: NonEmpty
  }),
  staging_verification: z.object({
    staging_url: NonEmpty,
    verification_timestamp: NonEmpty.optional(),
    qc_subset_results: NonEmpty.optional(),
    staging_matches_production_intent: z.literal(true)
  }),
  hosting_configuration: z.object({
    platform: NonEmpty,
    domain: NonEmpty,
    ssl: NonEmpty.optional(),
    headers: z.record(z.string(), z.string()).optional(),
    redirects: z.array(z.string()).optional(),
    error_pages: NonEmpty.optional()
  }),
  deployment_execution: z.object({
    method: NonEmpty,
    timestamp: NonEmpty,
    target: NonEmpty.optional(),
    artifact_hash: NonEmpty
  }),
  post_deployment_verification: z.object({
    verification_timestamp: NonEmpty.optional(),
    url_loads: z.literal(true),
    assets_resolve: z.literal(true),
    ssl_valid: z.literal(true),
    critical_paths_pass: z.literal(true),
    hash_matches_build: z.literal(true)
  }),
  rollback_strategy: z.object({
    method: NonEmpty,
    estimated_time: NonEmpty,
    data_state_preserved: NonEmpty.optional()
  }),
  monitoring: z.object({
    uptime_monitoring: NonEmpty,
    error_tracking: NonEmpty.optional(),
    performance_monitoring: NonEmpty.optional(),
    alert_thresholds: NonEmpty
  })
}).superRefine((value, ctx) => {
  if (value.deployment_execution.artifact_hash !== value.build_identity.artifact_hash) {
    ctx.addIssue({ code: 'custom', path: ['deployment_execution', 'artifact_hash'], message: 'deployed artifact hash must match build identity hash' });
  }
});
export type DeploymentRecordT = z.infer<typeof DeploymentRecord>;

// ── Registry data: producing stage + upstream dependencies per type ────────

export const WORKFLOW_ARTIFACT_STAGE: Readonly<Record<WorkflowArtifactTypeT, WorkflowStageT>> = Object.freeze({
  EXPERIENCE_BRIEF: 'DISCOVERY',
  EXPERIENCE_BLUEPRINT: 'ARCHITECTURE',
  VISUAL_SYSTEM: 'DESIGN',
  INTERACTION_PLAN: 'DESIGN',
  IMPLEMENTATION_BLUEPRINT: 'IMPLEMENTATION',
  RELEASE_EVIDENCE: 'VALIDATION',
  DEPLOYMENT_RECORD: 'DEPLOYMENT'
});

export const WORKFLOW_ARTIFACT_DEPENDENCIES: Readonly<Record<WorkflowArtifactTypeT, readonly WorkflowArtifactTypeT[]>> = Object.freeze({
  EXPERIENCE_BRIEF: Object.freeze([]),
  EXPERIENCE_BLUEPRINT: Object.freeze(['EXPERIENCE_BRIEF'] as const),
  VISUAL_SYSTEM: Object.freeze(['EXPERIENCE_BLUEPRINT'] as const),
  INTERACTION_PLAN: Object.freeze(['EXPERIENCE_BLUEPRINT', 'VISUAL_SYSTEM'] as const),
  IMPLEMENTATION_BLUEPRINT: Object.freeze(['VISUAL_SYSTEM', 'INTERACTION_PLAN'] as const),
  RELEASE_EVIDENCE: Object.freeze(['IMPLEMENTATION_BLUEPRINT'] as const),
  DEPLOYMENT_RECORD: Object.freeze(['RELEASE_EVIDENCE'] as const)
});
