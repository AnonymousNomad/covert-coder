import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type {
  ResidentSummaryResponseT,
  ResidentPushSummaryResponseT,
  ResidentDecisionsResponseT,
  ResidentSummaryT,
  ResidentPushSummaryT,
  ResidentDecisionT
} from '../../../common/contracts/resident.ts';

export interface ResidentDockHandles {
  root: HTMLElement;
  body: HTMLElement;
  setOpen(open: boolean): void;
  refresh(): Promise<void>;
}

export function createResidentDock(parent: HTMLElement, store: Store<AppState>): ResidentDockHandles {
  parent.innerHTML = `
    <aside class="dock" id="dock" role="complementary" aria-label="Resident assistant">
      <header class="dock-header">
        <span class="dock-title">RESIDENT</span>
        <span class="dock-maturity" id="dock-maturity">LOADING</span>
        <span class="dock-spacer"></span>
        <button class="dock-refresh" type="button" id="dock-refresh" title="Refresh resident" aria-label="Refresh resident">\u21bb</button>
        <button class="dock-toggle" type="button" title="Toggle dock" aria-label="Toggle dock">\u00d7</button>
      </header>
      <div class="dock-body" id="dock-body">
        <div class="dock-loading">Probing workspace\u2026</div>
      </div>
    </aside>
  `;

  const root = parent.querySelector<HTMLElement>('.dock');
  const body = parent.querySelector<HTMLElement>('#dock-body');
  if (root === null || body === null) throw new Error('resident-dock mount failed');
  const maturity = parent.querySelector<HTMLElement>('#dock-maturity');
  if (maturity === null) throw new Error('resident-dock maturity mount failed');

  const dockRoot: HTMLElement = root;
  const dockBody: HTMLElement = body;
  const dockMaturity: HTMLElement = maturity;

  const refreshBtn = parent.querySelector<HTMLButtonElement>('#dock-refresh');
  if (refreshBtn !== null) {
    refreshBtn.addEventListener('click', () => { void refresh(); });
  }
  const toggleBtn = parent.querySelector<HTMLButtonElement>('.dock-toggle');
  if (toggleBtn !== null) {
    toggleBtn.addEventListener('click', () => {
      const isHidden = dockRoot.classList.toggle('hidden');
      store.set(prev => ({ ...prev, dockOpen: !isHidden }));
    });
  }

  function navigateToPanel(panel: AppState['panel']): void {
    store.set(prev => ({ ...prev, panel }));
  }


  function setOpen(open: boolean): void {
    dockRoot.classList.toggle('hidden', !open);
  }

  async function loadSummary(): Promise<ResidentSummaryResponseT['summary'] | null> {
    try {
      const res = await api.residentSummary();
      return res.summary;
    } catch {
      return null;
    }
  }

  async function loadPush(): Promise<ResidentPushSummaryResponseT['push'] | null> {
    try {
      const res = await api.residentPush();
      return res.push;
    } catch {
      return null;
    }
  }

  async function loadDecisions(): Promise<ResidentDecisionsResponseT['decisions'] | null> {
    try {
      const res = await api.residentDecisions(10);
      return res.decisions;
    } catch {
      return null;
    }
  }

  async function refresh(): Promise<void> {
    dockBody.innerHTML = '<div class="dock-loading">Probing workspace\u2026</div>';
    dockMaturity.textContent = 'LOADING';
    dockMaturity.className = 'dock-maturity';
    const [summary, push, decisions] = await Promise.all([loadSummary(), loadPush(), loadDecisions()]);
    render({ summary, push, decisions });
  }

  function unavailableNote_(endpoint: string): HTMLElement {
    const note = document.createElement('div');
    note.className = 'dock-section-unavailable';
    note.textContent = `Endpoint unavailable: ${endpoint}`;
    return note;
  }

  function render(state: { summary: ResidentSummaryT | null; push: ResidentPushSummaryT | null; decisions: ResidentDecisionT[] | null }): void {
    const { summary, push, decisions } = state;
    dockBody.innerHTML = '';

    if (summary === null && push === null && decisions === null) {
      dockMaturity.textContent = 'UNREACHABLE';
      dockMaturity.className = 'dock-maturity err';
      const empty = document.createElement('div');
      empty.className = 'dock-empty';
      empty.textContent = 'Resident surfaces unavailable \u2014 daemon did not return any of /api/resident/{summary,push-summary,decisions}.';
      dockBody.appendChild(empty);
      return;
    }

    if (push !== null) {
      const verdictRow = document.createElement('div');
      verdictRow.className = 'dock-verdict ' + (push.verdict === 'READY' ? 'ok' : 'warn');
      const verdictLabel = document.createElement('span');
      verdictLabel.className = 'dock-verdict-label';
      verdictLabel.textContent = 'PUSH VERDICT: ' + push.verdict;
      verdictRow.appendChild(verdictLabel);
      if (push.reasons.length > 0) {
        const reasonsList = document.createElement('ul');
        reasonsList.className = 'dock-verdict-reasons';
        for (const reason of push.reasons) {
          const li = document.createElement('li');
          li.textContent = reason;
          reasonsList.appendChild(li);
        }
        verdictRow.appendChild(reasonsList);
      }
      dockBody.appendChild(verdictRow);
      dockMaturity.textContent = push.verdict;
      dockMaturity.className = 'dock-maturity ' + (push.verdict === 'READY' ? 'ok' : 'warn');
    } else {
      dockMaturity.textContent = 'NO VERDICT';
      dockMaturity.className = 'dock-maturity dim';
      const sec = document.createElement('section');
      sec.className = 'dock-section';
      const h = document.createElement('h4');
      h.textContent = 'PUSH VERDICT';
      sec.appendChild(h);
      sec.appendChild(unavailableNote_('GET /api/resident/push-summary'));
      dockBody.appendChild(sec);
    }

    if (summary !== null) {
      const section = section_('PROJECT', [
        kv('Type', summary.projectType),
        kv('Workspace', summary.workspace),
        kv('Node', summary.nodeVersion),
        kv('Test script', summary.hasTestScript ? 'present' : 'absent'),
        kv('LSP', summary.lsp.available ? 'available' : 'unavailable'),
        kv('Model', summary.model.runtime_available ? (summary.model.ready_count > 0 ? `${summary.model.ready_count} ready` : 'engine ready, no artifact') : 'unavailable')
      ]);
      dockBody.appendChild(section);

      const gitSection = section_('GIT', [
        kv('Repo', summary.git.git_repo ? `${summary.git.branch ?? 'detached'} (${summary.git.clean ? 'clean' : `${summary.git.changes} changes`})` : 'not a repo'),
        kv('Upstream', summary.git.upstream ?? '\u2014'),
        kv('Ahead/Behind', `${summary.git.ahead}/${summary.git.behind}`)
      ]);
      dockBody.appendChild(gitSection);

      const depsSection = section_('DEPS', [
        kv('Manifest', summary.deps.has_manifest ? `${summary.deps.dependencies} runtime / ${summary.deps.dev_dependencies} dev` : 'absent'),
        kv('Lockfile', summary.deps.has_lockfile ? 'committed' : 'absent')
      ]);
      dockBody.appendChild(depsSection);

      const actionables = summary.conditions.filter(c => c.severity !== 'info');
      if (actionables.length > 0) {
        const condSection = document.createElement('section');
        condSection.className = 'dock-section';
        const condTitle = document.createElement('h4');
        condTitle.textContent = `CONDITIONS (${actionables.length})`;
        condSection.appendChild(condTitle);
        for (const c of actionables) {
          const row = document.createElement('div');
          row.className = 'dock-condition ' + c.severity;
          const sev = document.createElement('span');
          sev.className = 'dock-cond-sev';
          sev.textContent = c.severity.toUpperCase();
          row.appendChild(sev);
          const body = document.createElement('div');
          body.className = 'dock-cond-body';
          const msg = document.createElement('div');
          msg.className = 'dock-cond-msg';
          msg.textContent = c.message;
          body.appendChild(msg);
          const reco = document.createElement('div');
          reco.className = 'dock-cond-reco';
          reco.textContent = '\u2192 ' + c.recommendation;
          body.appendChild(reco);
          row.appendChild(body);
          condSection.appendChild(row);
        }
        dockBody.appendChild(condSection);
      }

      const recommendationSection = section_('RECOMMENDATION', [paragraph(summary.recommendation)]);
      dockBody.appendChild(recommendationSection);
    } else {
      const sec = document.createElement('section');
      sec.className = 'dock-section';
      const h = document.createElement('h4');
      h.textContent = 'PROJECT';
      sec.appendChild(h);
      sec.appendChild(unavailableNote_('GET /api/resident/summary'));
      dockBody.appendChild(sec);
    }

    if (decisions !== null && decisions.length > 0) {
      const decSection = document.createElement('section');
      decSection.className = 'dock-section';
      const title = document.createElement('h4');
      title.textContent = `RECENT DECISIONS (${decisions.length})`;
      decSection.appendChild(title);
      for (const d of decisions) {
        const row = document.createElement('div');
        row.className = 'dock-decision ' + d.severity;
        const sev = document.createElement('span');
        sev.className = 'dock-dec-sev';
        sev.textContent = d.severity.toUpperCase();
        row.appendChild(sev);
        const body = document.createElement('div');
        body.className = 'dock-dec-body';
        const msg = document.createElement('div');
        msg.textContent = d.message;
        body.appendChild(msg);
        if (d.recommendation.length > 0) {
          const reco = document.createElement('div');
          reco.className = 'dock-dec-reco';
          reco.textContent = '\u2192 ' + d.recommendation;
          body.appendChild(reco);
        }
        row.appendChild(body);
        decSection.appendChild(row);
      }
      dockBody.appendChild(decSection);
    } else if (decisions !== null && decisions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dock-empty';
      empty.textContent = 'No recent resident decisions.';
      dockBody.appendChild(empty);
    } else {
      const sec = document.createElement('section');
      sec.className = 'dock-section';
      const h = document.createElement('h4');
      h.textContent = 'RECENT DECISIONS';
      sec.appendChild(h);
      sec.appendChild(unavailableNote_('GET /api/resident/decisions'));
      dockBody.appendChild(sec);
    }

    // Slice 5 — Navigation bridge: link Resident surface to other panels.
    // The Resident dock is descriptive only; navigation buttons dispatch
    // pure store updates (no execution authority attached).
    const navSection = document.createElement('section');
    navSection.className = 'dock-section dock-nav';
    const navHeader = document.createElement('h4');
    navHeader.textContent = 'OPEN';
    navSection.appendChild(navHeader);
    const navList = document.createElement('div');
    navList.className = 'dock-nav-list';
    const navTargets: { label: string; panel: AppState['panel'] }[] = [
      { label: 'COMMAND CENTER', panel: 'command-center' },
      { label: 'MODELS', panel: 'models' },
      { label: 'TERMINAL', panel: 'terminal' },
      { label: 'VERIFICATION', panel: 'verification' },
      { label: 'PROJECTS', panel: 'projects' },
      { label: 'EDITOR', panel: 'editor' }
    ];
    for (const t of navTargets) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dock-nav-btn';
      btn.textContent = t.label;
      btn.addEventListener('click', () => navigateToPanel(t.panel));
      navList.appendChild(btn);
    }
    navSection.appendChild(navList);
    dockBody.appendChild(navSection);
  }

  return { root: dockRoot, body: dockBody, setOpen, refresh };
}

function section_(title: string, rows: HTMLElement[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'dock-section';
  const h = document.createElement('h4');
  h.textContent = title;
  section.appendChild(h);
  for (const row of rows) section.appendChild(row);
  return section;
}

function kv(key: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'dock-kv';
  const k = document.createElement('span');
  k.className = 'dock-kv-key';
  k.textContent = key;
  const v = document.createElement('span');
  v.className = 'dock-kv-value';
  v.textContent = value;
  row.appendChild(k);
  row.appendChild(v);
  return row;
}

function paragraph(text: string): HTMLElement {
  const p = document.createElement('div');
  p.className = 'dock-paragraph';
  p.textContent = text;
  return p;
}
