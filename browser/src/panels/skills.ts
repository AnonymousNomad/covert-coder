// Slice 3 — SKILLS panel
// Honest-empty placeholder. No /api/skills route exists in the facade
// route map; skills intelligence is a known backend gap.
// This panel never invents or fabricates skill content.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { showToast } from '../ui/toast.ts';

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
      <span class="panel-maturity">DEGRADED</span>
    </header>
    <section class="panel-empty">
      <div class="panel-empty-glyph" aria-hidden="true">\u2756</div>
      <h3>Not yet integrated</h3>
      <p>No <code>/api/skills</code> route exists in the facade map (<code>common/facade-route-map.json</code>). Skill intelligence is a backend gap. The frontend never fabricates skill content.</p>
      <p class="panel-empty-detail">Required backend surface: <code>GET /api/skills</code> with the skill registry. Until that exists, this surface reports its own absence.</p>
      <p class="panel-empty-action">To progress: enroll a <code>/api/skills</code> route via the same capability.descriptor path as the other migrated endpoints (see <code>common/contracts/skills.ts</code> if it materializes).</p>
    </section>
  `;
  parent.appendChild(root);

  root.addEventListener('click', () => {
    showToast(root, 'NOT_READY', 'Skills endpoint is not yet projected into the cockpit.');
  });

  return {
    dispose() {
      parent.innerHTML = '';
    }
  };
}
