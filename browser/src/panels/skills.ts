// Slice 3 — SKILLS panel
// Honest-empty placeholder. No /api/skills route exists in the facade
// route map; skills intelligence is a known backend gap.
// This panel never invents or fabricates skill content.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';

export interface PanelHandles {
  dispose(): void;
}

export function createSkillsPanel(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'panel-content skills-panel';
  root.innerHTML = `
    <header class="panel-header">
      <h2 class="panel-title">SKILLS</h2>
      <span class="panel-maturity">PARTIAL</span>
    </header>
    <section class="panel-empty">
      <div class="panel-empty-glyph" aria-hidden="true">\u2756</div>
      <h3>Skill Intelligence &amp; workflows</h3>
      <p>Methods, constraints, and verification expectations belong to the active workflow. The skill registry is not exposed to this cockpit yet; selection and activation are unavailable.</p>
      <p class="panel-empty-detail">Harness Modes use one canonical Covert Harness. Domain workflows can define tools, SOPs, constraints, verification rules, and model roles. Dynamic mode loading is not exposed by this build.</p>
    </section>
    <section class="skills-workflow"><h3>WORKFLOW EVIDENCE</h3><p class="panel-loading">Reading the active workflow…</p></section>
  `;
  parent.appendChild(root);

  let alive = true;
  const workflow = root.querySelector<HTMLElement>('.skills-workflow')!;
  void api.workflowState().then(state => {
    if (!alive) return;
    workflow.replaceChildren();
    const title = document.createElement('h3'); title.textContent = `WORKFLOW · ${state.stage}`;
    const detail = document.createElement('p'); detail.textContent = `${state.project_id} · revision ${state.revision} · updated ${state.updated_at}`;
    workflow.append(title, detail);
    for (const artifact of state.artifacts) {
      const row = document.createElement('p');
      row.textContent = `${artifact.artifact_type} · ${artifact.verification_status.toUpperCase()} · ${artifact.path}`;
      workflow.appendChild(row);
    }
    if (!state.artifacts.length) { const empty = document.createElement('p'); empty.textContent = 'No artifact references recorded for this workflow.'; workflow.appendChild(empty); }
  }).catch(() => { if (alive) workflow.textContent = 'WORKFLOW UNAVAILABLE · no active workflow evidence could be retrieved. No execution or verification is implied.'; });

  return {
    dispose() {
      alive = false;
      parent.innerHTML = '';
    }
  };
}
