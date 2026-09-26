// Settings navigation over the existing provider, BYOK, routing, security,
// workspace, and onboarding owners. This surface does not own credentials or
// introduce a second connection registry.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';
import { createProvidersPanel } from '../providers/providers.ts';
import { createByokPanel } from '../byok/byok.ts';
import { createConnectionsPanel } from '../connections/connections.ts';

export interface SettingsSurfaceHandles {
  dispose(): void;
  openSection(section: SettingsSection): void;
}

export type SettingsSection = 'providers' | 'setup' | 'security' | 'workspace';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createSettingsSurface(
  parent: HTMLElement,
  _store: Store<AppState>,
  opts: {
    onToast: (code: string, message: string) => void;
    onReopenWalkthrough?: () => void;
    onRunSetup?: () => void;
    onNavigate?: (panel: Panel) => void;
  }
): SettingsSurfaceHandles {
  parent.replaceChildren();
  const root = el('div', 'panel-content cockpit-settings-surface');
  const header = el('header', 'panel-header');
  header.append(el('h2', 'panel-title', 'SETTINGS'), el('span', 'panel-maturity', 'CONFIGURATION'));
  root.appendChild(header);
  root.appendChild(el('p', 'panel-intro', 'Provider connections, routing, security guidance, and setup are grouped here. Each action writes through the existing owning service.'));

  const nav = el('nav', 'cockpit-settings-nav');
  nav.setAttribute('aria-label', 'Settings sections');
  const content = el('div', 'cockpit-settings-content');
  const sections = new Map<SettingsSection, HTMLElement>();
  const navButtons = new Map<SettingsSection, HTMLButtonElement>();

  const definitions: Array<{ id: SettingsSection; label: string }> = [
    { id: 'providers', label: 'INTELLIGENCE · PROVIDERS' },
    { id: 'setup', label: 'SETUP & ONBOARDING' },
    { id: 'security', label: 'SECURITY & PERMISSIONS' },
    { id: 'workspace', label: 'WORKSPACE' }
  ];

  function selectSection(id: SettingsSection): void {
    for (const [sectionId, panel] of sections) {
      const selected = sectionId === id;
      panel.hidden = !selected;
      navButtons.get(sectionId)?.setAttribute('aria-current', selected ? 'page' : 'false');
    }
  }

  for (const definition of definitions) {
    const button = el('button', 'cockpit-settings-nav-item', definition.label) as HTMLButtonElement;
    button.type = 'button';
    button.addEventListener('click', () => selectSection(definition.id));
    nav.appendChild(button);
    navButtons.set(definition.id, button);
    const section = el('section', 'cockpit-settings-section');
    section.dataset.settingsSection = definition.id;
    section.setAttribute('aria-label', definition.label);
    sections.set(definition.id, section);
    content.appendChild(section);
  }

  root.append(nav, content);
  parent.appendChild(root);

  const providersSection = sections.get('providers')!;
  providersSection.appendChild(el('h3', 'cockpit-settings-section-title', 'INTELLIGENCE → PROVIDERS'));
  providersSection.appendChild(el('p', 'panel-intro', 'Review connection state, configure an available API-key method, and set explicit role routes. Subscription credentials stay with their official client. A stored key is not shown as a verified live connection.'));

  const connectionOverview = el('div', 'cockpit-settings-provider-overview');
  providersSection.appendChild(connectionOverview);
  createConnectionsPanel(connectionOverview, { onToast: opts.onToast });

  const apiProviderSection = el('section', 'cockpit-settings-provider-config');
  apiProviderSection.appendChild(el('h4', 'cockpit-settings-subtitle', 'PROVIDER API CONNECTIONS'));
  apiProviderSection.appendChild(el('p', 'panel-intro', 'Use a provider method listed here. API access can have separate usage billing from a chat subscription. Credentials are stored by the existing daemon credential service and are never redisplayed.'));
  const apiProviderMount = el('div', 'cockpit-settings-panel-mount');
  apiProviderSection.appendChild(apiProviderMount);
  providersSection.appendChild(apiProviderSection);
  createProvidersPanel(apiProviderMount, opts);

  const byokSection = el('section', 'cockpit-settings-provider-config');
  byokSection.appendChild(el('h4', 'cockpit-settings-subtitle', 'CUSTOM API ADAPTERS & ROLE ROUTING'));
  byokSection.appendChild(el('p', 'panel-intro', 'Advanced OpenAI-compatible or Anthropic-message endpoints use the existing encrypted credential and role-routing services. Covert does not copy credentials from another application.'));
  const byokMount = el('div', 'cockpit-settings-panel-mount');
  byokSection.appendChild(byokMount);
  providersSection.appendChild(byokSection);
  createByokPanel(byokMount, { onToast: opts.onToast });

  const setupSection = sections.get('setup')!;
  setupSection.appendChild(el('h3', 'cockpit-settings-section-title', 'SETUP & ONBOARDING'));
  setupSection.appendChild(el('p', 'panel-intro', 'Run setup again to review the current machine, connections, and role routing. Existing application settings are preserved; restarting the wizard resets progress only.'));
  if (opts.onRunSetup !== undefined) {
    const run = el('button', 'cockpit-settings-action cockpit-settings-primary', 'RUN SETUP WIZARD') as HTMLButtonElement;
    run.type = 'button';
    run.addEventListener('click', () => opts.onRunSetup!());
    setupSection.appendChild(run);
  }
  if (opts.onReopenWalkthrough !== undefined) {
    const tour = el('button', 'cockpit-settings-action', 'OPEN PRODUCT TOUR') as HTMLButtonElement;
    tour.type = 'button';
    tour.addEventListener('click', () => opts.onReopenWalkthrough!());
    setupSection.appendChild(tour);
  }

  const securitySection = sections.get('security')!;
  securitySection.appendChild(el('h3', 'cockpit-settings-section-title', 'SECURITY & PERMISSIONS'));
  securitySection.appendChild(el('p', 'panel-intro', 'Files, terminal, Git, desktop, network, and provider calls have separate capability boundaries. Workspace selection does not grant trust. A system-wide Local-Only guarantee remains unqualified while release gate C4-02 is open.'));
  const securityButton = el('button', 'cockpit-settings-action', 'OPEN SECURITY STATUS') as HTMLButtonElement;
  securityButton.type = 'button';
  securityButton.addEventListener('click', () => opts.onNavigate?.('security'));
  securitySection.appendChild(securityButton);

  const workspaceSection = sections.get('workspace')!;
  workspaceSection.appendChild(el('h3', 'cockpit-settings-section-title', 'WORKSPACE'));
  workspaceSection.appendChild(el('p', 'panel-intro', 'Open or change the active project from Projects. Trust and execution permissions remain separate decisions.'));
  const projectsButton = el('button', 'cockpit-settings-action', 'OPEN PROJECTS') as HTMLButtonElement;
  projectsButton.type = 'button';
  projectsButton.addEventListener('click', () => opts.onNavigate?.('projects'));
  workspaceSection.appendChild(projectsButton);

  selectSection('providers');

  return {
    openSection: selectSection,
    dispose() {
      parent.replaceChildren();
    }
  };
}
