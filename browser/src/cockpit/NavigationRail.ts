// Phase 1 — Left navigation rail.
// 12 items per directive. Each item has icon, title, description, active neon.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';

export interface NavigationRailHandles {
  root: HTMLElement;
}

interface NavItem {
  id: Panel;
  icon: string;
  label: string;
  description: string;
}

const ITEMS: NavItem[] = [
  { id: 'command-center', icon: '\u25ce', label: 'COMMAND CENTER', description: 'Operator overview' },
  { id: 'resident', icon: '\u29bf', label: 'RESIDENT', description: 'Local / Remote' },
  { id: 'projects', icon: '\u25a4', label: 'PROJECTS', description: 'Workbenches' },
  { id: 'editor', icon: '\u2261', label: 'EDITOR', description: 'Source surface' },
  { id: 'terminal', icon: '\u2766', label: 'TERMINAL', description: 'Process IO' },
  { id: 'models', icon: '\u25c8', label: 'MODELS', description: 'Loaded lineup' },
  { id: 'skills', icon: '\u2756', label: 'SKILLS', description: 'Procedural surface' },
  { id: 'memory', icon: '\u29c7', label: 'MEMORY', description: 'Helix state' },
  { id: 'verification', icon: '\u2713', label: 'VERIFICATION', description: 'Gate evidence' },
  { id: 'security', icon: '\u25cb', label: 'SECURITY', description: 'Capability state' },
  { id: 'extensions', icon: '\u29c9', label: 'EXTENSIONS', description: 'Local add-ons' },
  { id: 'settings', icon: '\u2699', label: 'SETTINGS', description: 'Operator config' }
];

export function createNavigationRail(parent: HTMLElement, store: Store<AppState>): NavigationRailHandles {
  parent.innerHTML = '';
  const root = document.createElement('nav');
  root.className = 'cockpit-rail';
  root.setAttribute('aria-label', 'Workspace navigation');

  for (const item of ITEMS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cockpit-rail-item';
    btn.dataset.itemId = item.id;
    btn.title = `${item.label} \u2014 ${item.description}`;
    btn.setAttribute('aria-label', `${item.label}: ${item.description}`);

    const icon = document.createElement('span');
    icon.className = 'cockpit-rail-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.icon;

    const label = document.createElement('span');
    label.className = 'cockpit-rail-label';
    label.textContent = item.label;

    const desc = document.createElement('span');
    desc.className = 'cockpit-rail-desc';
    desc.textContent = item.description;

    btn.appendChild(icon);
    btn.appendChild(label);
    btn.appendChild(desc);

    btn.addEventListener('click', () => {
      store.set((prev) => ({ ...prev, panel: item.id }));
    });

    root.appendChild(btn);
  }

  parent.appendChild(root);

  const unbind = store.subscribe((state) => {
    root.querySelectorAll<HTMLElement>('.cockpit-rail-item').forEach((b) => {
      const isActive = b.dataset.itemId === state.panel;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  });

  window.addEventListener('unload', () => unbind());

  return { root };
}
