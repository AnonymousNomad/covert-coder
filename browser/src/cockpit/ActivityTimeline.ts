// Phase 6 — Activity Timeline.
// Right intelligence panel. Reads /api/audit/events (recent) and
// /api/resident/decisions. No fake events. Honest empty when none exist.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import { productText } from '../ui/product-text.ts';
import type { AuditReadResponseT, AuditEventT } from '../../../common/contracts/audit.ts';
import type { ResidentDecisionsResponseT, ResidentDecisionT } from '../../../common/contracts/resident.ts';

export interface ActivityTimelineHandles {
  root: HTMLElement;
  refresh(): Promise<void>;
  dispose(): void;
}

interface TimelineEntry {
  ts: number | null;
  severity: string;
  source: string;
  message: string;
  tag: string;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function severityClass(sev: string): string {
  if (sev === 'error') return 'activity-sev-error';
  if (sev === 'warn' || sev === 'warning') return 'activity-sev-warn';
  if (sev === 'authority' || sev === 'approval') return 'activity-sev-authority';
  return 'activity-sev-info';
}

function mapAudit(ev: AuditEventT): TimelineEntry | null {
  const rawTimestamp = typeof ev.at === 'string' ? ev.at : typeof ev.ts === 'string' ? ev.ts : null;
  const parsedTimestamp = rawTimestamp === null ? null : Date.parse(rawTimestamp);
  const ts = parsedTimestamp === null || Number.isNaN(parsedTimestamp) ? null : parsedTimestamp;
  const msg = ev.summary ?? ev.action ?? ev.tool ?? ev.task ?? ev.role ?? ev.type;
  return {
    ts,
    severity: typeof ev.error === 'string' && ev.error.length > 0 ? 'error' : (ev.ok === false ? 'error' : (ev.ok === true ? 'ok' : 'info')),
    source: ev.tool ?? ev.task ?? ev.role ?? ev.source ?? 'audit',
    message: typeof msg === 'string' ? msg : ev.type,
    tag: ev.type
  };
}

function mapDecision(d: ResidentDecisionT): TimelineEntry {
  return {
    ts: d.ts,
    severity: d.severity,
    source: 'resident',
    message: productText(d.message),
    tag: 'decision'
  };
}

function fmtTime(ts: number | null): string {
  if (ts === null) return 'TIME UNKNOWN';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '\u2014';
  return d.toLocaleTimeString();
}

export function createActivityTimeline(parent: HTMLElement, _store: Store<AppState>): ActivityTimelineHandles {
  parent.innerHTML = '';
  const root = el('div', 'cockpit-activity');

  const header = el('header', 'cockpit-activity-header');
  header.appendChild(el('h2', 'cockpit-activity-title', 'RECENT ACTIVITY'));
  header.appendChild(el('span', 'cockpit-activity-subtitle', 'Audit bus + Resident decisions'));
  root.appendChild(header);

  const timeline = el('ol', 'cockpit-activity-timeline');
  root.appendChild(timeline);

  parent.appendChild(root);

  let alive = true;
  let refreshing = false;

  async function refresh(): Promise<void> {
    if (!alive || refreshing) return;
    refreshing = true;
    let audit: AuditReadResponseT | null = null;
    let decisions: ResidentDecisionsResponseT | null = null;
    try {
      [audit, decisions] = await Promise.all([
        api.auditRead({ limit: 30 }).catch(() => null),
        api.residentDecisions(10).catch(() => null)
      ]);
    } catch {
      audit = null;
      decisions = null;
    }
    refreshing = false;
    if (!alive) return;
    paint(audit, decisions);
  }

  function paint(audit: AuditReadResponseT | null, decisions: ResidentDecisionsResponseT | null): void {
    timeline.innerHTML = '';
    if (audit === null || decisions === null) timeline.appendChild(el('li', 'cockpit-activity-empty', `${audit === null ? 'Audit unavailable. ' : ''}${decisions === null ? 'Resident decisions unavailable. ' : ''}Activity may be incomplete.`));
    const entries: TimelineEntry[] = [];
    if (audit !== null) {
      for (const ev of audit.events) {
        const entry = mapAudit(ev);
        if (entry !== null) entries.push(entry);
      }
    }
    if (decisions !== null) {
      for (const d of decisions.decisions) entries.push(mapDecision(d));
    }
    if (entries.length === 0) {
      const empty = el('div', 'cockpit-activity-empty', audit === null || decisions === null ? 'No activity evidence retrieved.' : 'No recent activity. Audit bus and Resident decisions surface here as events accumulate.');
      timeline.appendChild(empty);
      return;
    }
    entries.sort((a, b) => (b.ts ?? Number.NEGATIVE_INFINITY) - (a.ts ?? Number.NEGATIVE_INFINITY));
    for (const e of entries.slice(0, 20)) {
      const li = document.createElement('li');
      li.className = `cockpit-activity-item ${severityClass(e.severity)}`;
      const time = el('span', 'cockpit-activity-time', fmtTime(e.ts));
      const tag = el('span', 'cockpit-activity-tag', e.tag);
      const src = el('span', 'cockpit-activity-source', e.source);
      const msg = el('span', 'cockpit-activity-msg', e.message);
      li.appendChild(time);
      li.appendChild(tag);
      li.appendChild(src);
      li.appendChild(msg);
      timeline.appendChild(li);
    }
  }

  void refresh();
  const interval = window.setInterval(() => { void refresh(); }, 6000);

  return {
    root,
    refresh,
    dispose() {
      alive = false;
      window.clearInterval(interval);
      parent.innerHTML = '';
    }
  };
}
