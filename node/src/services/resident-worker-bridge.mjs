// node/src/services/resident-worker-bridge.mjs
//
// RESIDENT → WORKER BRIDGE — the smallest real contract for Resident to request
// stronger cognition. Reuses existing pieces: harness/sops.json role contracts,
// the canonical Arsenal projection for worker selection, and the local
// OpenAI-compatible engines for execution. Workers are PROPOSAL-ONLY: they
// never write files, never execute commands, never receive executable
// authority; the caller applies accepted proposals to an authorized target.
// No second orchestration system is created here.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const SOPS_FILE = path.join(REPO_ROOT, 'harness', 'sops.json');

// Resident-facing role -> preferred canonical model roles (from models/manifest).
const ROLE_PREFERENCES = Object.freeze({
  planner: ['reason', 'planning', 'research', 'build'],
  coder: ['build', 'coder', 'fast'],
  reviewer: ['verify', 'reviewer', 'chat'],
  specialist: ['research', 'reason', 'chat']
});
// Resident-facing role -> harness/sops.json role contract.
const ROLE_CONTRACT = Object.freeze({ planner: 'reason', coder: 'build', reviewer: 'verify', specialist: 'reason' });

export async function loadRoleContracts() {
  const raw = JSON.parse(await fs.readFile(SOPS_FILE, 'utf8'));
  return raw.roles ?? {};
}

export function selectWorker(projection, role) {
  if (!projection || !Array.isArray(projection.descriptors)) return null;
  const preferred = ROLE_PREFERENCES[role];
  if (!preferred) return null;
  const candidates = projection.descriptors
    .filter(d => d.kind === 'MODEL' && d.availability === 'READY' && Array.isArray(d.roles))
    .map(d => ({ id: d.id, roles: d.roles, overlap: d.roles.filter(r => preferred.includes(r)).length }))
    .filter(c => c.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || (a.id < b.id ? -1 : 1));
  return candidates.length > 0 ? candidates[0] : null;
}

export function buildWorkerAssignment({
  objective, workflowStage, requestedRole, task, constraints = [], canonicalProjectState = null,
  requiredSkills = [], requiredEvidence = [], authorityRequirements = 'proposal-only', returnContract = 'text-or-code-block',
  scratchTarget = null, executionEvidence = null
}) {
  for (const [field, value] of Object.entries({ objective, workflowStage, requestedRole, task })) {
    if (typeof value !== 'string' || value.trim() === '') throw new Error('worker assignment requires ' + field);
  }
  if (authorityRequirements !== 'proposal-only') throw new Error('workers are proposal-only; executable authority is not delegable');
  return {
    objective,
    workflow_stage: workflowStage,
    requested_role: requestedRole,
    task,
    constraints,
    canonical_project_state: canonicalProjectState,
    required_skills: requiredSkills,
    required_evidence: requiredEvidence,
    authority_requirements: authorityRequirements,
    return_contract: returnContract,
    ...(scratchTarget ? { target: scratchTarget } : {}),
    ...(executionEvidence ? { execution_evidence: executionEvidence } : {}),
    delegation: 'resident-to-worker; proposal-only; no execution authority'
  };
}

export async function runWorker({ assignment, endpoint, modelId, roleContracts, maxTokens = 512, temperature = 0.1 }) {
  const contractRole = ROLE_CONTRACT[assignment.requested_role] ?? 'reason';
  const contract = roleContracts?.[contractRole] ?? {};
  const lines = [
    `[WORKER ROLE CONTRACT — ${assignment.requested_role} (${contractRole})]`,
    `must: ${(contract.must ?? []).join(', ')}`,
    `must_not: ${(contract.must_not ?? []).join(', ')}`,
    'You are a worker receiving a bounded assignment from the Resident. You propose only; you never execute, never write files, never claim tests passed.'
  ];
  if (assignment.requested_role === 'reviewer') {
    // REVIEW-01 repair: a reviewer verdict is never derived from the coder's
    // claim. It must be derived from the assignment's execution_evidence.
    lines.push(
      'REVIEWER LAW: the coder\'s own claim is not evidence.',
      'A verdict of PASS requires citing execution_evidence entries that show every required check passing.',
      'If execution_evidence is missing, or any required check failed, the verdict must be FAIL or NEEDS-EVIDENCE with the failing entry named.',
      'Do not restate or quote the assignment. Respond with the verdict line first, then at most three reasons.'
    );
  }
  const system = lines.join('\n');
  const user = '[ASSIGNMENT]\n' + JSON.stringify(assignment, null, 2);
  const started = Date.now();
  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }], max_tokens: maxTokens, temperature, top_k: 50, repeat_penalty: 1.05 }),
    signal: AbortSignal.timeout(180000)
  });
  const body = await response.json();
  return { text: body?.choices?.[0]?.message?.content ?? '', system, user, latency_ms: Date.now() - started, modelId };
}

export function extractCode(text) {
  const fenced = /```[a-z]*\n([\s\S]*?)```/i.exec(String(text ?? ''));
  return fenced ? fenced[1].trim() : null;
}

export function methodologyFirewall(residentText, workerText) {
  const resident = String(residentText ?? '');
  const worker = String(workerText ?? '');
  return {
    worker_context_has_resident_sops: /resident\.[a-z-]+/.test(worker),
    resident_context_has_worker_contract: /\[WORKER ROLE CONTRACT/.test(resident) || /\b(coder|planner|reviewer)\./.test(resident),
    clean: !/resident\.[a-z-]+/.test(worker) && !(/\[WORKER ROLE CONTRACT/.test(resident) || /\b(coder|planner|reviewer)\./.test(resident))
  };
}
