import crypto from 'node:crypto';
import path from 'node:path';

const READ_COMMANDS = new Set(['status.read', 'resident.read', 'verification.read', 'notifications.read', 'workers.read']);
const MUTATING_COMMANDS = new Set(['workflow.start', 'workflow.pause', 'workflow.stop', 'approval.submit']);

function stableId(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 16);
}

function limited(value, max = 300) {
  return String(value ?? '').slice(0, max);
}

function safeStatus(value, fallback = 'unknown') {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function createRemoteBridgeService({ workspace, resident, workflow, tasks, notifications, modelRuntime, clock = () => Date.now() } = {}) {
  const workspaceRoot = path.resolve(workspace ?? process.cwd());
  const workstationId = `ws-${stableId(workspaceRoot)}`;
  const workstationName = path.basename(workspaceRoot) || 'Covert Workstation';

  async function snapshot() {
    const [summary, workflowState, taskState, modelState, notificationState] = await Promise.all([
      resident?.summary?.().catch(() => null) ?? Promise.resolve(null),
      workflow?.load?.().catch(() => null) ?? Promise.resolve(null),
      tasks?.status?.().catch(() => ({ jobs: [] })) ?? Promise.resolve({ jobs: [] }),
      modelRuntime?.status?.().catch(() => ({ models: [] })) ?? Promise.resolve({ models: [] }),
      Promise.resolve(notifications?.list?.() ?? { notifications: [] })
    ]);
    const models = Array.isArray(modelState?.models) ? modelState.models : [];
    const jobs = Array.isArray(taskState?.jobs) ? taskState.jobs : [];
    const notificationList = Array.isArray(notificationState?.notifications) ? notificationState.notifications : [];
    const workflowEntry = workflowState && typeof workflowState === 'object'
      ? {
        id: typeof workflowState.workflow_id === 'string' ? workflowState.workflow_id : null,
        stage: safeStatus(workflowState.stage, 'unknown'),
        status: safeStatus(workflowState.stage, 'idle') === 'unknown' ? 'idle' : 'active',
        updated_at: typeof workflowState.updated_at === 'string' ? Date.parse(workflowState.updated_at) : null
      }
      : null;
    const activity = notificationList.slice(-20).reverse().map(item => ({ kind: item.source, title: limited(item.title, 180), occurred_at: Number(item.created_at) || clock() }));
    const residentMessage = summary?.recommendation ?? summary?.status ?? 'Resident state is unavailable.';
    return {
      generated_at: clock(),
      workstation: { id: workstationId, name: workstationName, version: null },
      connection: { state: 'local-only', transport: 'loopback', authenticated: true, last_seen: clock(), detail: 'Bounded projection from the authenticated Workstation control plane.' },
      current_project: summary ? { name: workstationName, reference: `workspace:${workstationId}`, source_sha: null } : null,
      workflow: workflowEntry,
      jobs: jobs.slice(-100).map(job => ({ id: String(job.job_id), label: limited(job.label, 160), status: safeStatus(job.status), started_at: Number(job.startedAt) || 0, ended_at: job.endedAt === null || job.endedAt === undefined ? null : Number(job.endedAt) })),
      workers: models.slice(0, 64).map(model => ({ id: String(model.id ?? 'model'), role: 'model', status: safeStatus(model.status), provider: typeof model.provider === 'string' ? model.provider : null, model: typeof model.name === 'string' ? model.name : null })),
      approvals: [],
      verification: {
        status: summary ? (summary.status === 'ready' ? 'OBSERVED' : 'ATTENTION') : 'UNAVAILABLE',
        summary: summary ? limited(summary.recommendation ?? 'Resident summary observed.', 300) : 'Resident summary unavailable.',
        evidence_refs: []
      },
      activity,
      notifications: notificationList.slice(-100),
      resident: { message: limited(residentMessage, 2000), generated_at: clock() }
    };
  }

  function capabilities() {
    return {
      capabilities: [
        { id: 'status.read', kind: 'read', risk: 'low', available: true, confirmation_required: false },
        { id: 'resident.read', kind: 'read', risk: 'low', available: true, confirmation_required: false },
        { id: 'verification.read', kind: 'read', risk: 'low', available: true, confirmation_required: false },
        { id: 'notifications.read', kind: 'read', risk: 'low', available: true, confirmation_required: false },
        { id: 'workers.read', kind: 'read', risk: 'low', available: true, confirmation_required: false },
        { id: 'workflow.start', kind: 'mutate', risk: 'medium', available: false, confirmation_required: true },
        { id: 'workflow.pause', kind: 'mutate', risk: 'medium', available: false, confirmation_required: true },
        { id: 'workflow.stop', kind: 'mutate', risk: 'high', available: false, confirmation_required: true },
        { id: 'approval.submit', kind: 'mutate', risk: 'high', available: false, confirmation_required: true }
      ],
      custom_hotword_available: false,
      push_to_talk_available: true
    };
  }

  async function command({ command, confirmation = false }) {
    if (READ_COMMANDS.has(command)) {
      return { accepted: true, requires_confirmation: false, risk: 'low', reason: 'Read-only command served from the shared Remote Bridge projection.', snapshot: await snapshot() };
    }
    if (!MUTATING_COMMANDS.has(command)) {
      return { accepted: false, requires_confirmation: false, risk: 'high', reason: 'Unknown command rejected by the bounded command contract.', snapshot: null };
    }
    if (confirmation !== true) {
      return { accepted: false, requires_confirmation: true, risk: command === 'workflow.stop' || command === 'approval.submit' ? 'high' : 'medium', reason: 'Mutating command requires the normal operator confirmation and Execution Authority path.', snapshot: null };
    }
    return { accepted: false, requires_confirmation: true, risk: command === 'workflow.stop' || command === 'approval.submit' ? 'high' : 'medium', reason: 'The bounded Edge mutation adapter is not connected in this foundation slice; no mutation was attempted.', snapshot: null };
  }

  return Object.freeze({ snapshot, capabilities, command });
}
