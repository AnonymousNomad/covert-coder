// Settings surface — existing provider and BYOK configuration panels.
// Credentials/configuration are not runtime execution evidence.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { createProvidersPanel } from '../providers/providers.ts';
import { createByokPanel } from '../byok/byok.ts';
import { createConnectionsPanel } from '../connections/connections.ts';

export interface SettingsSurfaceHandles {
  dispose(): void;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createSettingsSurface(parent: HTMLElement, _store: Store<AppState>, opts: { onToast: (code: string, message: string) => void; onReopenWalkthrough?: () => void; onRunSetup?: () => void }): SettingsSurfaceHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content cockpit-settings-surface');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'SETTINGS'));
  header.appendChild(el('span', 'panel-maturity', 'AVAILABLE'));
  root.appendChild(header);
  root.appendChild(el('p', 'panel-intro', 'Provider and BYOK configuration surfaces are available. Stored credentials/configuration do not prove active remote execution; runtime route evidence remains in MODELS.'));

  if (opts.onReopenWalkthrough !== undefined) {
    const walkthroughSection = el('section', 'cockpit-settings-section');
    walkthroughSection.appendChild(el('h3', 'cockpit-settings-section-title', 'WALKTHROUGH'));
    const reopen = el('button', 'cockpit-settings-action', 'REOPEN WALKTHROUGH') as HTMLButtonElement;
    reopen.type = 'button';
    const reopenHandler = (): void => opts.onReopenWalkthrough!();
    reopen.addEventListener('click', reopenHandler);
    walkthroughSection.appendChild(reopen);
    if (opts.onRunSetup !== undefined) {
      const runSetup = el('button', 'cockpit-settings-action', 'RUN ADAPTIVE SETUP') as HTMLButtonElement;
      runSetup.type = 'button';
      runSetup.addEventListener('click', () => opts.onRunSetup!());
      walkthroughSection.appendChild(runSetup);
    }
    root.appendChild(walkthroughSection);
  }

  const providersMount = el('section', 'cockpit-settings-section');
  providersMount.appendChild(el('h3', 'cockpit-settings-section-title', 'SECURITY'));
  providersMount.appendChild(el('h4', 'cockpit-settings-subtitle', 'SECRETS'));
  providersMount.appendChild(el('p', 'panel-intro', 'Stored credentials are encrypted at rest by the daemon and are never re-displayed. ADD / REPLACE / REMOVE / TEST CONNECTION run through the same operator pairing owner that authorizes every other write; there is no separate credential store.'));
  const byokMount = el('section', 'cockpit-settings-section');
  const connectionsMount = el('section', 'cockpit-settings-section');
  connectionsMount.appendChild(el('h3', 'cockpit-settings-section-title', 'CONNECTIONS'));
  connectionsMount.appendChild(el('h4', 'cockpit-settings-subtitle', 'UNIFIED PROVIDER VIEW'));
  connectionsMount.appendChild(el('p', 'panel-intro', 'One canonical read over subscription runtimes, API-key providers, the local runtime, and catalog access. States are local evidence only: stored keys and installed CLIs are shown as configured, never as live connections.'));
  root.append(providersMount, byokMount, connectionsMount);
  parent.appendChild(root);

  createProvidersPanel(providersMount, opts);
  createByokPanel(byokMount, { onToast: opts.onToast });
  createConnectionsPanel(connectionsMount, { onToast: opts.onToast });

  return {
    dispose() {
      parent.innerHTML = '';
    }
  };
}
