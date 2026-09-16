import type { Store } from '../store/store.ts';
import type { AppState, Panel, Maturity } from '../store/state.ts';

interface PanelSpec {
  id: Panel;
  label: string;
  glyph: string;
  maturity: Maturity;
}

export const PANELS: PanelSpec[] = [
  { id: 'command-center', label: 'COMMAND', glyph: '\u25cb', maturity: 'EXPERIMENTAL' },
  { id: 'resident', label: 'RESIDENT', glyph: '\u29bf', maturity: 'AVAILABLE' },
  { id: 'projects', label: 'PROJECTS', glyph: '\u25a4', maturity: 'AVAILABLE' },
  { id: 'editor', label: 'EDITOR', glyph: '\u2261', maturity: 'AVAILABLE' },
  { id: 'terminal', label: 'TERMINAL', glyph: '\u2766', maturity: 'EXPERIMENTAL' },
  { id: 'models', label: 'MODELS', glyph: '\u25c8', maturity: 'AVAILABLE' },
  { id: 'skills', label: 'SKILLS', glyph: '\u2756', maturity: 'DEGRADED' },
  { id: 'memory', label: 'MEMORY', glyph: '\u29c7', maturity: 'EXPERIMENTAL' },
  { id: 'verification', label: 'VERIFY', glyph: '\u2713', maturity: 'DEGRADED' },
  { id: 'security', label: 'SECURITY', glyph: '\u2756', maturity: 'EXPERIMENTAL' }
];

export interface ActivityBarHandles {
  root: HTMLElement;
}

export function createActivityBar(parent: HTMLElement, store: Store<AppState>): ActivityBarHandles {
  parent.innerHTML = '';
  parent.classList.add('activity-bar-v2');
  for (const panel of PANELS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'activity-item';
    button.dataset.panel = panel.id;
    button.dataset.maturity = panel.maturity;
    button.title = `${panel.label} \u00b7 ${panel.maturity}`;
    button.setAttribute('aria-label', `${panel.label} panel \u2014 ${panel.maturity}`);

    const glyph = document.createElement('span');
    glyph.className = 'activity-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = panel.glyph;

    const label = document.createElement('span');
    label.className = 'activity-label';
    label.textContent = panel.label;

    const maturity = document.createElement('span');
    maturity.className = 'activity-maturity';
    maturity.textContent = panel.maturity;

    button.appendChild(glyph);
    button.appendChild(label);
    button.appendChild(maturity);

    button.addEventListener('click', () => {
      store.set(prev => ({ ...prev, panel: prev.panel === panel.id ? 'editor' : panel.id }));
    });
    parent.appendChild(button);
  }

  const unbind = store.subscribe(state => {
    parent.querySelectorAll<HTMLElement>('button.activity-item').forEach(button => {
      button.classList.toggle('active', button.dataset.panel === state.panel);
    });
  });

  window.addEventListener('unload', () => unbind());

  return { root: parent };
}
