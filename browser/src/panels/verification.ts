// Slice 3 — VERIFICATION panel
// Aggregates verification evidence from existing endpoints. Read-only.
// No scope-correlation enforcement happens here (the events have no workspace
// field); this surface surfaces them for human review without claiming
// "VERIFIED" on the topbar.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { AuditEventT } from '../../../common/contracts/audit.ts';
import type { ResidentPushSummaryT } from '../../../common/contracts/resident.ts';

export interface PanelHandles {
  dispose(): void;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function severityClass(sev: string): string {
  if (sev === 'error') return 'err';
  if (sev === 'warn') return 'warn';
  return 'dim';
}

export function createVerificationPanel(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content verification-panel');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'VERIFICATION'));
  header.appendChild(el('span', 'panel-maturity', 'DEGRADED'));
  root.appendChild(header);
  const intro = el('div', 'panel-intro', 'Veritas owns verification. A completed task is a claim; recorded evidence must support a verdict for the current scope.');
  root.appendChild(intro);
  const chain = el('section', 'verification-chain');
  for (const [label, detail] of [
    ['CLAIM', 'What the task or agent says happened.'],
    ['EVIDENCE', 'Recorded checks, results, and provenance.'],
    ['VERDICT', 'NEEDS EVIDENCE · current-scope correlation is not exposed.']
  ]) {
    const step = el('div', 'verification-chain-step');
    step.append(el('h3', '', label), el('p', '', detail)); chain.appendChild(step);
  }
  root.appendChild(chain);
  const body = el('div', 'verification-body');
  root.appendChild(body);
  parent.appendChild(root);

  let alive = true;

  function renderPosture(push: ResidentPushSummaryT | null): HTMLElement {
    const section = el('section', 'verification-posture');
    section.appendChild(el('h3', 'verification-section-title', 'CURRENT POSTURE'));
    if (push === null) {
      section.appendChild(el('div', 'verification-empty', 'Resident push endpoint unavailable.'));
      return section;
    }
    const verdict = el('div', `verification-verdict ${push.verdict === 'ATTENTION_REQUIRED' ? 'warn' : 'dim'}`);
    verdict.appendChild(el('span', 'verification-verdict-label', `RESIDENT WORKSPACE POSTURE: ${push.verdict}`));
    if (push.reasons.length > 0) {
      const reasons = el('ul', 'verification-reasons');
      for (const reason of push.reasons) {
        reasons.appendChild(el('li', 'verification-reason', reason));
      }
      verdict.appendChild(reasons);
    }
    section.appendChild(verdict);
    if (push.verdict === 'ATTENTION_REQUIRED') {
      const riskyList = push.risky_changes.slice(0, 5);
      if (riskyList.length > 0) {
        const risky = el('div', 'verification-risky');
        risky.appendChild(el('h4', 'verification-risky-title', 'RISKY CHANGES'));
        const ul = el('ul', 'verification-risky-list');
        for (const r of riskyList) ul.appendChild(el('li', 'verification-risky-item', r));
        risky.appendChild(ul);
        section.appendChild(risky);
      }
    }
    return section;
  }

  function renderAuditEvents(events: AuditEventT[] | null): HTMLElement {
    const section = el('section', 'verification-audit');
    section.appendChild(el('h3', 'verification-section-title', events === null ? 'RECENT AGENT.VERIFICATION EVENTS' : `RECENT AGENT.VERIFICATION EVENTS (${events.length})`));
    if (events === null) {
      section.appendChild(el('div', 'verification-empty', 'Audit history unavailable · GET /api/audit/events failed. Current scope remains UNVERIFIED.'));
      return section;
    }
    if (events.length === 0) {
      section.appendChild(el('div', 'verification-empty', 'No agent.verification events recorded.'));
      return section;
    }
    const list = el('div', 'verification-event-list');
    for (const ev of events.slice(0, 30)) {
      const card = el('div', 'verification-event-card');
      const head = el('div', 'verification-event-head');
      head.appendChild(el('span', 'verification-event-type', ev.type));
      head.appendChild(el('span', 'verification-event-time', ev.at ?? ev.ts ?? '\u2014'));
      if (ev.ok !== undefined) {
        head.appendChild(el('span', `verification-event-ok ${ev.ok ? 'dim' : 'err'}`, ev.ok ? 'RECORDED PASS · UNSCOPED' : 'RECORDED FAILURE'));
      }
      card.appendChild(head);
      const meta = el('div', 'verification-event-meta');
      const pieces: string[] = [];
      if (ev.session_id !== undefined) pieces.push(`session=${ev.session_id.slice(0, 12)}`);
      if (ev.bundle_id !== undefined) pieces.push(`bundle=${ev.bundle_id.slice(0, 12)}`);
      if (ev.parent_session_id !== undefined) pieces.push(`parent=${ev.parent_session_id.slice(0, 12)}`);
      if (ev.task !== undefined) pieces.push(`task=${ev.task}`);
      if (ev.tool !== undefined) pieces.push(`tool=${ev.tool}`);
      if (ev.role !== undefined) pieces.push(`role=${ev.role}`);
      if (pieces.length > 0) {
        meta.textContent = pieces.join(' \u00b7 ');
        card.appendChild(meta);
      }
      if (ev.summary !== undefined) {
        card.appendChild(el('div', 'verification-event-summary', ev.summary));
      }
      if (ev.error !== undefined && ev.error !== null && ev.error.length > 0) {
        card.appendChild(el('div', `verification-event-error ${severityClass('error')}`, `error: ${ev.error}`));
      }
      list.appendChild(card);
    }
    section.appendChild(list);
    section.appendChild(el('div', 'verification-scope-note', 'Scope correlation: each event carries session_id/bundle_id but no workspace field. Whether the event applies to the current UI scope is unproven. These events are shown here for review, not promoted to topbar VERIFIED.'));
    return section;
  }

  async function refresh(): Promise<void> {
    if (!alive) return;
    body.innerHTML = '<div class="panel-loading">Loading verification posture and audit bus\u2026</div>';
    let push: ResidentPushSummaryT | null = null;
    const [pushResult, auditResult] = await Promise.allSettled([
      api.residentPush(),
      api.auditRead({ type: 'agent.verification', limit: 30 })
    ]);
    if (pushResult.status === 'fulfilled') push = pushResult.value.push;
    const audit = auditResult.status === 'fulfilled' ? auditResult.value : null;
    if (!alive) return;
    body.innerHTML = '';
    body.appendChild(renderPosture(push));
    body.appendChild(renderAuditEvents(audit?.events ?? null));
  }

  void refresh();
  const interval = window.setInterval(() => { void refresh(); }, 8000);

  return {
    dispose() {
      alive = false;
      window.clearInterval(interval);
      parent.innerHTML = '';
    }
  };
}
