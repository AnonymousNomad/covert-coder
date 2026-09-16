// Workflow artifact validators (Slice 5) — deterministic, READ-ONLY.
// Validates a WorkflowArtifactRef and the content file it points to: required
// fields and shape (per-type contracts in common/contracts/workflow-artifacts.ts),
// stage ownership, stale/invalid reference rejection, file existence, sha256
// integrity, upstream dependency presence, and the Veritas evidence reference
// required by RELEASE_EVIDENCE. This module has no write capability by
// construction: it imports no authority, no audit trail, no model client, and
// performs no filesystem writes. It never authors artifacts and never
// adjudicates Veritas verdicts — it only checks that references resolve.
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ZodType } from 'zod';
import { WorkflowArtifactRef } from '../../../common/contracts/workflow.ts';
import {
  DeploymentRecord,
  ExperienceBlueprint,
  ExperienceBrief,
  ImplementationBlueprint,
  InteractionPlan,
  ReleaseEvidence,
  VisualSystem,
  WORKFLOW_ARTIFACT_DEPENDENCIES,
  WORKFLOW_ARTIFACT_STAGE
} from '../../../common/contracts/workflow-artifacts.ts';
import type { WorkflowArtifactRefT, WorkflowArtifactTypeT, WorkflowStageT } from '../../../common/contracts/workflow.ts';

export interface ArtifactValidatorEntry {
  readonly stage: WorkflowStageT;
  readonly dependencies: readonly WorkflowArtifactTypeT[];
  readonly schema: ZodType;
  readonly description: string;
}

export const ARTIFACT_VALIDATORS: Readonly<Record<WorkflowArtifactTypeT, ArtifactValidatorEntry>> = Object.freeze({
  EXPERIENCE_BRIEF: Object.freeze({
    stage: WORKFLOW_ARTIFACT_STAGE.EXPERIENCE_BRIEF,
    dependencies: WORKFLOW_ARTIFACT_DEPENDENCIES.EXPERIENCE_BRIEF,
    schema: ExperienceBrief,
    description: 'Discovery brief: business objective, audiences, constraints, experience character'
  }),
  EXPERIENCE_BLUEPRINT: Object.freeze({
    stage: WORKFLOW_ARTIFACT_STAGE.EXPERIENCE_BLUEPRINT,
    dependencies: WORKFLOW_ARTIFACT_DEPENDENCIES.EXPERIENCE_BLUEPRINT,
    schema: ExperienceBlueprint,
    description: 'Architecture blueprint: section sequence, attention flow, CTA architecture'
  }),
  VISUAL_SYSTEM: Object.freeze({
    stage: WORKFLOW_ARTIFACT_STAGE.VISUAL_SYSTEM,
    dependencies: WORKFLOW_ARTIFACT_DEPENDENCIES.VISUAL_SYSTEM,
    schema: VisualSystem,
    description: 'Visual system: aesthetic thesis, typography, palette, spacing, material, component tone'
  }),
  INTERACTION_PLAN: Object.freeze({
    stage: WORKFLOW_ARTIFACT_STAGE.INTERACTION_PLAN,
    dependencies: WORKFLOW_ARTIFACT_DEPENDENCIES.INTERACTION_PLAN,
    schema: InteractionPlan,
    description: 'Interaction plan: scroll choreography, transitions, micro-interactions, reduced motion'
  }),
  IMPLEMENTATION_BLUEPRINT: Object.freeze({
    stage: WORKFLOW_ARTIFACT_STAGE.IMPLEMENTATION_BLUEPRINT,
    dependencies: WORKFLOW_ARTIFACT_DEPENDENCIES.IMPLEMENTATION_BLUEPRINT,
    schema: ImplementationBlueprint,
    description: 'Implementation blueprint: component tree, state ownership, boundaries, budgets'
  }),
  RELEASE_EVIDENCE: Object.freeze({
    stage: WORKFLOW_ARTIFACT_STAGE.RELEASE_EVIDENCE,
    dependencies: WORKFLOW_ARTIFACT_DEPENDENCIES.RELEASE_EVIDENCE,
    schema: ReleaseEvidence,
    description: 'Release evidence: passing QC sections, empty blockers, resolvable Veritas reference'
  }),
  DEPLOYMENT_RECORD: Object.freeze({
    stage: WORKFLOW_ARTIFACT_STAGE.DEPLOYMENT_RECORD,
    dependencies: WORKFLOW_ARTIFACT_DEPENDENCIES.DEPLOYMENT_RECORD,
    schema: DeploymentRecord,
    description: 'Deployment record: build identity, staging, execution, post-deployment checks'
  })
});

export interface ArtifactValidationContext {
  workspace: string;
  refs?: readonly WorkflowArtifactRefT[];
  verificationsDir?: string;
}

export interface ArtifactValidationResult {
  result: 'satisfied' | 'unsatisfied';
  failed: string[];
}

const VERITAS_EVIDENCE_DIR = path.join('.aide', 'verifications');

export async function validateArtifactRef(ref: WorkflowArtifactRefT, context: ArtifactValidationContext): Promise<ArtifactValidationResult> {
  const failed: string[] = [];
  const parsedRef = WorkflowArtifactRef.safeParse(ref);
  if (!parsedRef.success) {
    return {
      result: 'unsatisfied',
      failed: parsedRef.error.issues.slice(0, 4).map(issue => `ref_invalid:${issue.path.join('.') || '$'}`)
    };
  }
  const artifact = parsedRef.data;
  const entry = ARTIFACT_VALIDATORS[artifact.artifact_type];
  if (artifact.stage !== entry.stage) failed.push(`wrong_stage:${artifact.artifact_type}`);
  if (artifact.verification_status === 'stale') failed.push(`stale:${artifact.artifact_type}`);
  if (artifact.verification_status === 'invalid') failed.push(`invalid:${artifact.artifact_type}`);

  for (const dependency of entry.dependencies) {
    const expectedStage = ARTIFACT_VALIDATORS[dependency].stage;
    const candidates = (context.refs ?? []).filter(candidate => candidate.artifact_type === dependency);
    const match = candidates.find(candidate => candidate.stage === expectedStage) ?? candidates[0];
    if (match === undefined) {
      failed.push(`missing_dependency:${dependency}`);
      continue;
    }
    if (match.stage !== expectedStage) {
      failed.push(`wrong_stage_dependency:${dependency}`);
      continue;
    }
    if (match.verification_status === 'stale') failed.push(`stale_dependency:${dependency}`);
    else if (match.verification_status === 'invalid') failed.push(`invalid_dependency:${dependency}`);
    else if (match.verification_status !== 'validated') failed.push(`unvalidated_dependency:${dependency}`);
  }

  let content: unknown;
  let contentParsed = false;
  const absolute = path.resolve(context.workspace, artifact.path);
  const relative = path.relative(context.workspace, absolute);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    failed.push('path_escape');
  } else {
    let raw: Buffer | null = null;
    try {
      raw = await fs.readFile(absolute);
    } catch (error) {
      failed.push((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'file_missing' : 'file_unreadable');
    }
    if (raw !== null) {
      const digest = createHash('sha256').update(raw).digest('hex');
      if (digest !== artifact.sha256) failed.push('checksum_mismatch');
      else {
        try {
          content = JSON.parse(raw.toString('utf8'));
          contentParsed = true;
        } catch {
          failed.push('content_not_json');
        }
        if (contentParsed) {
          const parsedContent = entry.schema.safeParse(content);
          if (!parsedContent.success) {
            failed.push(...parsedContent.error.issues.slice(0, 4).map(issue => `content_invalid:${issue.path.join('.') || '$'}`));
          }
        }
      }
    }
  }

  if (artifact.artifact_type === 'RELEASE_EVIDENCE' && contentParsed && content !== null && typeof content === 'object') {
    const evidence = (content as { veritas_evidence?: { session_id?: unknown } }).veritas_evidence;
    const sessionId = evidence?.session_id;
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      failed.push('veritas_evidence_missing');
    } else if (!/^[A-Za-z0-9._-]{1,128}$/.test(sessionId)) {
      failed.push('veritas_evidence_invalid');
    } else {
      const verificationsDir = context.verificationsDir ?? VERITAS_EVIDENCE_DIR;
      const evidencePath = path.resolve(context.workspace, verificationsDir, `${sessionId}.verification.json`);
      const evidenceRelative = path.relative(context.workspace, evidencePath);
      if (evidenceRelative.startsWith('..') || path.isAbsolute(evidenceRelative)) {
        failed.push('veritas_evidence_invalid');
      } else {
        try {
          const record = JSON.parse(await fs.readFile(evidencePath, 'utf8')) as { session_id?: unknown } | null;
          if (record === null || typeof record !== 'object' || record.session_id !== sessionId) failed.push('veritas_evidence_invalid');
        } catch (error) {
          failed.push((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'veritas_evidence_missing' : 'veritas_evidence_invalid');
        }
      }
    }
  }

  return { result: failed.length === 0 ? 'satisfied' : 'unsatisfied', failed };
}

// ── Veritas evidence inspection (Slice 6 gate pipeline step) ──────────────
// Resolves the verification record referenced by a RELEASE_EVIDENCE artifact
// and reports whether it indicates execution failure. The artifact validator
// owns the structural check (record exists, parses, session matches); this
// reader consumes the record's verdict fields so the gate can block on known
// failures. Verdict adjudication remains Veritas/operator-owned: the gate
// blocks on explicit failure/error/abort indicators only.

export interface VeritasEvidenceInspection {
  found: boolean;
  session_id: string | null;
  failed: boolean;
  status: string | null;
}

export async function inspectVeritasEvidence(workspace: string, artifactRef: WorkflowArtifactRefT, options: { verificationsDir?: string } = {}): Promise<VeritasEvidenceInspection> {
  const none: VeritasEvidenceInspection = { found: false, session_id: null, failed: false, status: null };
  const artifactPath = path.resolve(workspace, artifactRef.path);
  const artifactRelative = path.relative(workspace, artifactPath);
  if (artifactRelative === '' || artifactRelative.startsWith('..') || path.isAbsolute(artifactRelative)) return none;
  let content: unknown;
  try {
    content = JSON.parse(await fs.readFile(artifactPath, 'utf8'));
  } catch {
    return none;
  }
  const sessionId = (content as { veritas_evidence?: { session_id?: unknown } } | null)?.veritas_evidence?.session_id;
  if (typeof sessionId !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(sessionId)) return none;
  const verificationsDir = options.verificationsDir ?? VERITAS_EVIDENCE_DIR;
  const evidencePath = path.resolve(workspace, verificationsDir, `${sessionId}.verification.json`);
  const evidenceRelative = path.relative(workspace, evidencePath);
  if (evidenceRelative.startsWith('..') || path.isAbsolute(evidenceRelative)) return none;
  try {
    const record = JSON.parse(await fs.readFile(evidencePath, 'utf8')) as {
      outcome?: unknown;
      verification?: { execution?: unknown; state?: unknown } | null;
      verdict?: { status?: unknown } | null;
    } | null;
    if (record === null || typeof record !== 'object') return none;
    const execution = record.verification?.execution;
    const state = record.verification?.state;
    const verdictStatus = record.verdict?.status;
    const outcome = record.outcome;
    const failed = execution === 'failed' || execution === 'aborted'
      || state === 'failed' || state === 'errored'
      || verdictStatus === 'failed' || verdictStatus === 'errored'
      || outcome === 'error' || outcome === 'aborted';
    const status = typeof state === 'string' ? state
      : typeof verdictStatus === 'string' ? verdictStatus
      : typeof outcome === 'string' ? outcome
      : null;
    return { found: true, session_id: sessionId, failed, status };
  } catch {
    return none;
  }
}
