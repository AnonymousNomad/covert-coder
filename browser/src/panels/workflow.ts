// Slice 4 — Workflow stages presentation
// DESCRIBE → PLAN → APPROVE → BUILD → VERIFY → SHIP
// Presentation only. No execution authority. Each stage's "active" state
// is grounded in real backend evidence; when no evidence exists, the stage
// is shown as "unavailable" or "idle" — never simulated progression.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { TaskStatusResponseT } from '../../../common/contracts/tasks.ts';
import type { AuditReadResponseT } from '../../../common/contracts/audit.ts';

export interface PanelHandles {
  dispose(): void;
}

type Stage = 'describe' | 'plan' | 'approve' | 'build' | 'verify' | 'ship';
type StageStatus = 'unavailable' | 'idle' | 'active' | 'done' | 'failed' | 'stopped' | 'unknown';
type GitStatus = Awaited<ReturnType<typeof api.gitStatus>>;

interface StageState {
  id: Stage;
  label: string;
  status: StageStatus;
  evidence: string;
}

const STAGE_LABELS: Record<Stage, string> = {
  describe: 'DESCRIBE',
  plan: 'PLAN',
  approve: 'APPROVE',
  build: 'BUILD',
  verify: 'VERIFY',
  ship: 'SHIP'
};

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusClass(s: StageStatus): string {
  if (s === 'active') return 'wf-stage-active';
  if (s === 'done') return 'wf-stage-done';
  if (s === 'unavailable') return 'wf-stage-unavailable';
  if (s === 'failed' || s === 'stopped' || s === 'unknown') return 'wf-stage-unavailable';
  return 'wf-stage-idle';
}

type BuildStatus = Extract<StageStatus, 'active' | 'done' | 'failed' | 'stopped' | 'unknown'>;

function buildStatusForTask(status: string): BuildStatus {
  switch (status.toLowerCase()) {
    case 'running': return 'active';
    case 'exited':
    case 'completed':
    case 'success': return 'done';
    case 'failed': return 'failed';
    case 'stopped':
    case 'cancelled': return 'stopped';
    default: return 'unknown';
  }
}

export function deriveWorkflowState(
  tasks: TaskStatusResponseT | null,
  audit: AuditReadResponseT | null,
  git: GitStatus | null
): StageState[] {
  // DESCRIBE — no describe projection is wired to the frontend. Unavailable.
  const describe: StageState = {
    id: 'describe',
    label: STAGE_LABELS.describe,
    status: 'unavailable',
    evidence: 'Task intent can be entered in Resident. No current-task stage signal is available in this overview.'
  };

  // PLAN — no /api/plan endpoint. Unavailable.
  const plan: StageState = {
    id: 'plan',
    label: STAGE_LABELS.plan,
    status: 'unavailable',
    evidence: 'No current-task planning signal is exposed in this overview.'
  };

  // APPROVE — no approval endpoint exposed to the frontend.
  const approve: StageState = {
    id: 'approve',
    label: STAGE_LABELS.approve,
    status: 'unavailable',
    evidence: 'Operations use explicit approval dialogs. No aggregate pending-approval signal is exposed in this overview.'
  };

  // BUILD — backend evidence: /api/tasks/status with running jobs.
  const buildCounts: Record<BuildStatus, number> = { active: 0, done: 0, failed: 0, stopped: 0, unknown: 0 };
  if (tasks !== null) {
    for (const job of tasks.jobs) buildCounts[buildStatusForTask(job.status)] += 1;
  }
  let build: StageState;
  if (tasks === null) {
    build = { id: 'build', label: STAGE_LABELS.build, status: 'unavailable', evidence: '/api/tasks/status unavailable; cannot read build state.' };
  } else if (buildCounts.active > 0) {
    build = { id: 'build', label: STAGE_LABELS.build, status: 'active', evidence: `${buildCounts.active} task job${buildCounts.active === 1 ? '' : 's'} running per /api/tasks/status.` };
  } else if (buildCounts.failed > 0) {
    build = { id: 'build', label: STAGE_LABELS.build, status: 'failed', evidence: `${buildCounts.failed} task job${buildCounts.failed === 1 ? '' : 's'} failed per /api/tasks/status; investigate before verify.` };
  } else if (buildCounts.stopped > 0) {
    build = { id: 'build', label: STAGE_LABELS.build, status: 'stopped', evidence: `${buildCounts.stopped} task job${buildCounts.stopped === 1 ? '' : 's'} stopped or cancelled per /api/tasks/status.` };
  } else if (buildCounts.done > 0) {
    build = { id: 'build', label: STAGE_LABELS.build, status: 'done', evidence: `${buildCounts.done} task job${buildCounts.done === 1 ? '' : 's'} completed (clean exit) per /api/tasks/status.` };
  } else if (buildCounts.unknown > 0) {
    build = { id: 'build', label: STAGE_LABELS.build, status: 'unknown', evidence: `${buildCounts.unknown} task job${buildCounts.unknown === 1 ? '' : 's'} has an unrecognized status per /api/tasks/status.` };
  } else {
    build = { id: 'build', label: STAGE_LABELS.build, status: 'idle', evidence: 'No task history yet. Tasks appear here when /api/tasks/* endpoints emit job records.' };
  }

  // VERIFY — backend evidence: /api/audit/events?type=agent.verification with ok=true and scope-correlation (none today).
  // Per Checkpoint 0: topbar VERIFIED requires scope correlation (no current_session_id/bundle_id/workspace).
  // We surface here whether unscoped verification events exist, but never promote the stage to "active" on unscoped evidence alone.
  let verify: StageState;
  if (audit === null) {
    verify = { id: 'verify', label: STAGE_LABELS.verify, status: 'unavailable', evidence: '/api/audit/events unavailable.' };
  } else {
    const verifyingEvents = audit.events.filter(e => e.type === 'agent.verification');
    if (verifyingEvents.length === 0) {
      verify = { id: 'verify', label: STAGE_LABELS.verify, status: 'idle', evidence: 'No agent.verification events recorded yet on the audit bus.' };
    } else {
      // Honest: events exist, but until scope correlation is exposed, we cannot prove current-applicability.
      verify = { id: 'verify', label: STAGE_LABELS.verify, status: 'idle', evidence: `${verifyingEvents.length} agent.verification event(s) on the audit bus. Scope-correlation (current session/bundle/workspace) is not exposed to the frontend; see VERIFY panel for review.` };
    }
  }

  // SHIP — backend evidence: /api/git/status. Working-tree changes and
  // ahead-of-upstream commits are separate facts; neither is relabeled as the
  // other.
  let ship: StageState;
  if (git === null) {
    ship = { id: 'ship', label: STAGE_LABELS.ship, status: 'unavailable', evidence: '/api/git/status unavailable.' };
  } else {
    const facts: string[] = [];
    if (git.ahead > 0) facts.push(`${git.ahead} commit(s) ahead of upstream`);
    else facts.push('no commits ahead of upstream');
    if (git.changes.length > 0) facts.push(`${git.changes.length} working-tree change(s)`);
    else facts.push('working tree clean');
    if (git.behind > 0) facts.push(`${git.behind} commit(s) behind upstream`);
    if (git.changes.some(change => change.conflict)) facts.push('conflicts present');
    ship = {
      id: 'ship',
      label: STAGE_LABELS.ship,
      status: git.ahead > 0 || git.changes.some(change => change.conflict) ? 'active' : 'idle',
      evidence: `${facts.join(' · ')}. No automated ship endpoint; operator drives Git actions.`
    };
  }

  return [describe, plan, approve, build, verify, ship];
}

export function renderWorkflowStrip(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const strip = el('div', 'wf-strip');
  parent.appendChild(strip);

  let alive = true;
  const intervals: number[] = [];

  function paint(stageStates: StageState[]): void {
    strip.innerHTML = '';
    const header = el('header', 'wf-strip-header');
    header.appendChild(el('h3', 'wf-strip-title', 'WORKFLOW'));
    header.appendChild(el('span', 'wf-strip-subtitle', 'DESCRIBE \u2192 PLAN \u2192 APPROVE \u2192 BUILD \u2192 VERIFY \u2192 SHIP'));
    strip.appendChild(header);
    const stageRow = el('div', 'wf-stages');
    for (let i = 0; i < stageStates.length; i++) {
      const s = stageStates[i];
      if (s === undefined) continue;
      const stage = el('div', `wf-stage ${statusClass(s.status)}`);
      const num = el('span', 'wf-stage-num', `${i + 1}`);
      const name = el('span', 'wf-stage-name', s.label);
      const meta = el('span', 'wf-stage-meta', s.status.toUpperCase());
      stage.appendChild(num);
      stage.appendChild(name);
      stage.appendChild(meta);
      const evidence = el('div', 'wf-stage-evidence', s.evidence);
      stage.appendChild(evidence);
      stageRow.appendChild(stage);
      if (i < stageStates.length - 1) {
        const sep = el('div', 'wf-stage-sep', '\u2192');
        stageRow.appendChild(sep);
      }
    }
    strip.appendChild(stageRow);
  }

  async function refresh(): Promise<void> {
    if (!alive) return;
    let tasks: TaskStatusResponseT | null = null;
    let audit: AuditReadResponseT | null = null;
    let git: GitStatus | null = null;
    try {
      const [tasksResult, auditResult, gitResult] = await Promise.allSettled([
        api.tasksStatus().catch(() => null),
        api.auditRead({ type: 'agent.verification', limit: 30 }).catch(() => null),
        api.gitStatus().catch(() => null)
      ]);
      if (tasksResult.status === 'fulfilled') tasks = tasksResult.value;
      if (auditResult.status === 'fulfilled') audit = auditResult.value;
      if (gitResult.status === 'fulfilled') git = gitResult.value;
    } catch {
      // best-effort
    }
    if (!alive) return;
    paint(deriveWorkflowState(tasks, audit, git));
  }

  void refresh();
  intervals.push(window.setInterval(() => { void refresh(); }, 8000));

  return {
    dispose() {
      alive = false;
      for (const i of intervals) window.clearInterval(i);
      parent.innerHTML = '';
    }
  };
}
