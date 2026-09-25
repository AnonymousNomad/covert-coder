// Operator settings: backed preferences plus links/read-only views owned by
// their existing subsystems. This surface never grants authority or rewrites
// model, runtime, qualification, evidence, or admission truth.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';
import { createProvidersPanel } from '../providers/providers.ts';
import { createByokPanel } from '../byok/byok.ts';
import { createConnectionsPanel } from '../connections/connections.ts';
import { authorityPresentation } from '../services/authority.ts';
import { createSystemHealthSurface, type SystemHealthHandles } from './SystemHealthSurface.ts';
import { applyAppearance, SETTING_DEFINITIONS, THEME_REGISTRY, type PreferenceStore, type SettingDefinition } from '../settings/preferences.mjs';

export interface SettingsSurfaceHandles {
  dispose(): void;
}

interface Category {
  id: string;
  label: string;
  status: string;
  description: string;
}

const CATEGORIES: Category[] = [
  { id: 'appearance', label: 'Appearance & accessibility', status: 'IMPLEMENTED', description: 'Theme, text size, motion, effects' },
  { id: 'layout', label: 'Layout & resources', status: 'PARTIAL', description: 'Density, telemetry visibility, panel placement' },
  { id: 'health', label: 'System health', status: 'READ-ONLY', description: 'Core, model, provider, hardware status' },
  { id: 'models', label: 'Models, Resident & runtime', status: 'READ-ONLY', description: 'Availability, Resident, qualification, runtime owner' },
  { id: 'providers', label: 'Providers & credentials', status: 'IMPLEMENTED', description: 'Provider state, BYOK, credential management' },
  { id: 'integrations', label: 'Integrations / MCP', status: 'PARTIAL', description: 'Connection registry and capabilities' },
  { id: 'permissions', label: 'Permissions & approvals', status: 'READ-ONLY', description: 'Authority session and approval ownership' },
  { id: 'workspace', label: 'Workspace trust', status: 'HANDOFF REQUIRED', description: 'Workspace trust policy and restricted mode' },
  { id: 'execution', label: 'Tools, terminal, sandbox & scratch', status: 'PARTIAL', description: 'Existing terminal, attempt isolation, temporary workspace' },
  { id: 'privacy', label: 'Network & privacy', status: 'PARTIAL', description: 'Local-only, provider egress, diagnostics' },
  { id: 'evidence', label: 'Evidence & data retention', status: 'READ-ONLY', description: 'Verification, memory, accepted evidence, cleanup' },
  { id: 'git-instructions', label: 'Git & project instructions', status: 'HANDOFF REQUIRED', description: 'Repository state, remote mutation, project guidance' },
  { id: 'notifications', label: 'Notifications', status: 'PARTIAL', description: 'Approval, mission, verification, resource events' },
  { id: 'keybindings', label: 'Keybindings', status: 'NOT IMPLEMENTED', description: 'Command palette and operator shortcuts' },
  { id: 'diagnostics', label: 'Diagnostics & updates', status: 'PARTIAL', description: 'Local health checks, updater, rollback' },
  { id: 'advanced', label: 'Advanced / developer', status: 'NOT IMPLEMENTED', description: 'Verbose logging, experimental controls, internal diagnostics' }
];

const FILTERS = [
  { id: 'modified', label: 'Modified' },
  { id: 'workspace-overrides', label: 'Workspace overrides' },
  { id: 'experimental', label: 'Experimental' },
  { id: 'restart', label: 'Restart required' }
] as const;

const APPEARANCE_SETTING_IDS = [
  'appearance.theme',
  'appearance.textScale',
  'appearance.effects',
  'accessibility.reducedMotion'
];

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function workspaceKey(store: Store<AppState>): string | null {
  const workspace = store.get().health?.workspace;
  return typeof workspace === 'string' && workspace.trim().length > 0 ? workspace : null;
}

function createSettingRow(definition: SettingDefinition, description: string, control: HTMLElement): HTMLElement {
  const row = el('div', 'cockpit-setting-row');
  row.dataset.settingId = definition.id;
  row.dataset.category = definition.category.toLowerCase();
  row.dataset.experimental = String(definition.experimental);
  row.dataset.restart = String(definition.requiresRestart);
  control.setAttribute('aria-label', definition.label);
  const copy = el('div', 'cockpit-setting-copy');
  copy.append(el('strong', 'cockpit-setting-label', definition.label), el('p', 'cockpit-setting-description', description));
  const source = el('span', 'cockpit-setting-source', 'DEFAULT');
  source.dataset.settingSource = definition.id;
  copy.appendChild(source);
  row.append(copy, control);
  return row;
}

function openPanel(store: Store<AppState>, panel: Panel): void {
  store.set(previous => ({ ...previous, panel }));
}

export function createSettingsSurface(parent: HTMLElement, store: Store<AppState>, opts: {
  preferences: PreferenceStore;
  onToast: (code: string, message: string) => void;
  onReopenWalkthrough?: () => void;
  onRunSetup?: () => void;
}): SettingsSurfaceHandles {
  parent.replaceChildren();
  const root = el('div', 'panel-content cockpit-settings-surface');
  const header = el('header', 'panel-header');
  header.append(el('h2', 'panel-title', 'OPERATOR CONTROL'), el('span', 'panel-maturity', 'SETTINGS'));
  root.appendChild(header);
  root.appendChild(el('p', 'panel-intro', 'Configure real operator preferences; inspect canonical system state; follow the owning surface for permissions, models, evidence, and execution. No setting here grants authority.'));
  const persistenceStatus = el('p', 'cockpit-settings-storage-state');
  persistenceStatus.setAttribute('role', 'status');
  root.appendChild(persistenceStatus);

  const toolbar = el('div', 'cockpit-settings-toolbar');
  const searchLabel = el('label', 'cockpit-settings-search-label', 'SEARCH SETTINGS');
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'cockpit-settings-search';
  search.placeholder = 'Theme, provider, permission, scratch…';
  search.setAttribute('aria-label', 'Search settings and operator surfaces');
  searchLabel.appendChild(search);
  const scopeLabel = el('label', 'cockpit-settings-scope-label', 'PREFERENCE SCOPE');
  const scope = document.createElement('select');
  scope.className = 'cockpit-settings-scope';
  for (const [value, label] of [['global', 'GLOBAL'], ['workspace', 'WORKSPACE / PROJECT']] as const) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    scope.appendChild(option);
  }
  scopeLabel.appendChild(scope);
  toolbar.append(searchLabel, scopeLabel);
  const filterBar = el('div', 'cockpit-settings-filters');
  filterBar.setAttribute('aria-label', 'Filter settings');
  const filterButtons = new Map<string, HTMLButtonElement>();
  for (const filter of FILTERS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cockpit-settings-filter';
    button.textContent = filter.label;
    button.dataset.filter = filter.id;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      button.setAttribute('aria-pressed', button.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      applyFilters();
    });
    filterButtons.set(filter.id, button);
    filterBar.appendChild(button);
  }
  const workspaceNote = el('p', 'cockpit-settings-scope-note');
  root.append(toolbar, filterBar, workspaceNote);
  const layout = el('div', 'cockpit-settings-layout');
  const navigation = el('nav', 'cockpit-settings-nav');
  navigation.setAttribute('aria-label', 'Settings categories');
  const content = el('div', 'cockpit-settings-content');
  layout.append(navigation, content);
  root.appendChild(layout);
  parent.appendChild(root);

  const sections = new Map<string, HTMLElement>();
  const navButtons = new Map<string, HTMLButtonElement>();
  let active = 'appearance';
  let activeScope: 'global' | 'workspace' = 'global';
  let health: SystemHealthHandles | null = null;
  let healthMount: HTMLElement | null = null;

  function currentWorkspace(): string | null { return workspaceKey(store); }

  function updatePersistenceStatus(): void {
    const result = opts.preferences.getStatus();
    if (!result.writable) {
      persistenceStatus.textContent = `LOCAL PREFERENCES · READ-ONLY — ${result.status.toUpperCase()}; existing data was preserved${result.issues.length > 0 ? ` · ${result.issues.length} recovery note(s)` : ''}.`;
    } else if (result.status === 'volatile') {
      persistenceStatus.textContent = 'LOCAL PREFERENCES · SESSION ONLY — browser storage write failed; this change will not survive reload.';
    } else if (result.issues.length > 0) {
      persistenceStatus.textContent = `LOCAL PREFERENCES · RECOVERED — ${result.issues.length} compatibility/recovery note(s); preserved data was not silently discarded.`;
    } else if (result.writable) {
      persistenceStatus.textContent = 'LOCAL PREFERENCES · SAVED IN THIS BROWSER PROFILE WHEN CHANGED · NOT SYNCED';
    } else {
      persistenceStatus.textContent = `LOCAL PREFERENCES · READ-ONLY — ${result.status.toUpperCase()}; existing data was preserved.`;
    }
  }

  function prefValue(id: string): string | boolean | undefined {
    const definition = SETTING_DEFINITIONS.find(item => item.id === id);
    if (definition === undefined) return '';
    return opts.preferences.getEditableValue(id, activeScope, currentWorkspace());
  }

  function setPreference(id: string, value: string | boolean): void {
    const result = opts.preferences.set(id, value, activeScope, currentWorkspace());
    if (!result.ok) {
      opts.onToast('NOT_READY', result.reason === 'WORKSPACE_REQUIRED'
        ? 'Select an active workspace before setting a project override.'
        : result.reason === 'STORAGE_NOT_WRITABLE'
          ? 'Local preference storage is unavailable or read-only; nothing was changed.'
          : 'This preference cannot be changed in the selected scope.');
      updatePersistenceStatus();
      return;
    }
    applyAppearance(opts.preferences.getEffective(currentWorkspace()));
    opts.onToast(result.persisted ? 'OK' : 'NOT_READY', result.persisted ? 'Preference saved.' : 'Preference applied for this session only; local storage is unavailable.');
    updatePersistenceStatus();
    updateMetadata();
    applyFilters();
  }

  function preferenceControl(id: string): HTMLElement {
    const value = prefValue(id);
    if (id === 'appearance.theme') {
      const group = el('div', 'cockpit-theme-options');
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Covert theme');
      for (const theme of THEME_REGISTRY) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'cockpit-theme-option';
        button.dataset.theme = theme.id;
        button.setAttribute('aria-pressed', String(value === theme.id));
        button.setAttribute('aria-label', `${theme.label}: ${theme.description}`);
        button.append(el('strong', 'cockpit-theme-option-title', theme.label), el('span', 'cockpit-theme-option-description', theme.description));
        button.addEventListener('click', () => setPreference(id, theme.id));
        group.appendChild(button);
      }
      return group;
    }
    if (id === 'appearance.textScale' || id === 'appearance.effects' || id === 'layout.density') {
      const select = document.createElement('select');
      select.className = 'cockpit-setting-control';
      select.dataset.settingControl = id;
      const choices: Array<[string, string]> = id === 'appearance.textScale' ? [['normal', 'STANDARD'], ['large', 'LARGE']]
        : id === 'appearance.effects' ? [['normal', 'STANDARD'], ['reduced', 'REDUCED'], ['off', 'OFF']]
          : [['standard', 'STANDARD'], ['compact', 'COMPACT']];
      for (const [choice, label] of choices) {
        const option = document.createElement('option');
        option.value = choice;
        option.textContent = label;
        select.appendChild(option);
      }
      select.value = String(value);
      select.addEventListener('change', () => setPreference(id, select.value));
      return select;
    }
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'cockpit-setting-control cockpit-setting-checkbox';
    checkbox.dataset.settingControl = id;
    checkbox.checked = Boolean(value);
    checkbox.addEventListener('change', () => setPreference(id, checkbox.checked));
    return checkbox;
  }

  function prefRow(id: string, description: string): HTMLElement {
    const definition = SETTING_DEFINITIONS.find(item => item.id === id);
    if (definition === undefined) throw new Error(`setting definition missing: ${id}`);
    const row = createSettingRow(definition, description, preferenceControl(id));
    return row;
  }

  function createSection(category: Category): HTMLElement {
    const section = el('section', 'cockpit-settings-group');
    section.dataset.settingsCategory = category.id;
    section.dataset.search = `${category.label} ${category.description}`.toLowerCase();
    const sectionHeader = el('header', 'cockpit-settings-group-header');
    sectionHeader.append(el('h3', 'cockpit-settings-section-title', category.label.toUpperCase()), el('span', 'cockpit-settings-category-state', category.status));
    section.appendChild(sectionHeader);
    const body = el('div', 'cockpit-settings-group-body');
    section.appendChild(body);
    sections.set(category.id, section);
    content.appendChild(section);
    return body;
  }

  function addOwnerLink(parentNode: HTMLElement, label: string, detail: string, panel: Panel): void {
    parentNode.appendChild(el('p', 'cockpit-settings-detail', detail));
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cockpit-settings-action';
    button.textContent = label;
    button.addEventListener('click', () => openPanel(store, panel));
    parentNode.appendChild(button);
  }

  for (const category of CATEGORIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cockpit-settings-nav-item';
    button.dataset.category = category.id;
    button.append(el('span', 'cockpit-settings-nav-label', category.label), el('span', 'cockpit-settings-nav-state', category.status));
    button.title = category.description;
    button.setAttribute('aria-current', category.id === active ? 'page' : 'false');
    button.addEventListener('click', () => selectCategory(category.id));
    navigation.appendChild(button);
    navButtons.set(category.id, button);
    const body = createSection(category);

    if (category.id === 'appearance') {
      body.append(prefRow('appearance.theme', 'Theme changes apply immediately. Global and current-workspace preferences remain separate.'),
        prefRow('appearance.textScale', 'Scales editor and terminal text; other interface typography retains its established sizing.'),
        prefRow('appearance.effects', 'Controls ambient texture and glow without changing operational status.'),
        prefRow('accessibility.reducedMotion', 'Also respects the operating system reduced-motion preference.'));
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'cockpit-settings-action cockpit-settings-reset';
      reset.textContent = 'RESET APPEARANCE IN THIS SCOPE';
      reset.addEventListener('click', () => {
        const result = opts.preferences.resetSettings(APPEARANCE_SETTING_IDS, activeScope, currentWorkspace());
        if (!result.ok) {
          opts.onToast('NOT_READY', result.reason === 'STORAGE_NOT_WRITABLE' ? 'Local preference storage is unavailable or read-only; nothing was reset.' : 'The selected preference scope cannot be reset.');
          updatePersistenceStatus();
          return;
        }
        applyAppearance(opts.preferences.getEffective(currentWorkspace()));
        updateControls();
        updateMetadata();
        applyFilters();
        opts.onToast(result.persisted ? 'OK' : 'NOT_READY', result.persisted ? 'Appearance reset for this scope.' : 'Reset applies for this session only; storage is unavailable.');
        updatePersistenceStatus();
      });
      body.appendChild(reset);
    } else if (category.id === 'layout') {
      body.append(prefRow('layout.density', 'Compact spacing affects supported navigation and intelligence surfaces.'),
        prefRow('layout.telemetryVisible', 'Shows or hides the existing read-only hardware snapshot; it does not control resource admission.'));
      body.appendChild(el('p', 'cockpit-settings-detail', 'Dock placement and panel sizing are not configurable in this shell; no docking behavior is implied.'));
    } else if (category.id === 'health') {
      healthMount = el('div', 'cockpit-health-mount');
      body.appendChild(healthMount);
    } else if (category.id === 'models') {
      body.appendChild(el('p', 'cockpit-settings-detail', 'The existing model API supplies registered-model, artifact/runtime availability, and route state. It does not supply Capability Passport role qualification or the complete RuntimeAdapter identity/health contract. Availability and qualification remain distinct; this page creates no second registry.'));
      addOwnerLink(body, 'OPEN MODELS', 'Inspect only the model/artifact/runtime facts currently exposed by that surface.', 'models');
      body.appendChild(el('span', 'cockpit-settings-handoff', 'QUALIFICATION PASSPORT / ROLE STATE / RUNTIME PASSPORT · OWNER CONTRACT REQUIRED'));
    } else if (category.id === 'providers') {
      const credentials = el('section', 'cockpit-settings-subsection');
      credentials.append(el('h4', 'cockpit-settings-subtitle', 'PROVIDER CREDENTIALS'), el('p', 'cockpit-settings-detail', 'Credentials are never re-displayed; the existing encrypted provider owner handles add, replace, remove, and connection testing.'));
      const providersMount = el('div', 'cockpit-settings-provider-mount');
      credentials.appendChild(providersMount);
      const byokMount = el('div', 'cockpit-settings-byok-mount');
      const byok = el('section', 'cockpit-settings-subsection');
      byok.append(el('h4', 'cockpit-settings-subtitle', 'BRING YOUR OWN PROVIDER'));
      byok.appendChild(byokMount);
      body.append(credentials, byok);
      createProvidersPanel(providersMount, { onToast: opts.onToast });
      createByokPanel(byokMount, { onToast: opts.onToast });
    } else if (category.id === 'integrations') {
      body.appendChild(el('p', 'cockpit-settings-detail', 'Connection state is read from the existing provider registry. MCP role permissions and integration write qualification are not inferred here.'));
      const connectionsMount = el('div', 'cockpit-settings-connections-mount');
      body.appendChild(connectionsMount);
      createConnectionsPanel(connectionsMount, { onToast: opts.onToast });
    } else if (category.id === 'permissions') {
      const session = authorityPresentation();
      body.appendChild(el('p', 'cockpit-settings-detail', session.paired
        ? `Operator session paired until ${new Date(session.expiresAt!).toLocaleTimeString()}. Pairing is not approval for an operation.`
        : 'Operator session is unpaired or expired. No operation approval is implied.'));
      body.appendChild(el('p', 'cockpit-settings-detail', 'The owning Security surface explains exact-operation approval. Aggregate pending approvals and effective permission policies are not exposed here.'));
      addOwnerLink(body, 'OPEN SECURITY', 'Settings does not grant or broaden Authority.', 'security');
      body.appendChild(el('span', 'cockpit-settings-handoff', 'APPROVAL CENTER · HANDOFF REQUIRED'));
    } else if (category.id === 'workspace') {
      body.appendChild(el('p', 'cockpit-settings-detail', 'Workspace trust must feed the existing Authority and execution policy; this UI does not invent a parallel trust switch.'));
      body.appendChild(el('span', 'cockpit-settings-handoff', 'OWNER: WORKSPACE TRUST / AUTHORITY · CONTRACT REQUIRED'));
    } else if (category.id === 'execution') {
      body.appendChild(el('p', 'cockpit-settings-detail', 'Terminal capability is available in its existing operator-gated surface. Sandbox and scratch remain distinct: sandbox is an execution boundary; scratch is temporary non-canonical work state.'));
      addOwnerLink(body, 'OPEN TERMINAL', 'Process ownership and lifecycle remain with the terminal/process owner.', 'terminal');
      body.appendChild(el('span', 'cockpit-settings-handoff', 'SANDBOX / SCRATCH RETENTION · OWNER CONTRACT REQUIRED'));
    } else if (category.id === 'privacy') {
      body.appendChild(el('p', 'cockpit-settings-detail', `Current network posture: ${store.get().topbar.cloud}. Provider routing and BYOK egress are controlled in the canonical Connections and BYOK panels; this label does not change policy.`));
      const connectionsButton = document.createElement('button');
      connectionsButton.type = 'button';
      connectionsButton.className = 'cockpit-settings-action';
      connectionsButton.textContent = 'OPEN CONNECTIONS';
      connectionsButton.addEventListener('click', () => selectCategory('integrations'));
      body.appendChild(connectionsButton);
    } else if (category.id === 'evidence') {
      body.appendChild(el('p', 'cockpit-settings-detail', 'Verification results and memory have separate owning surfaces. Accepted evidence is not treated as cache or temporary scratch. This settings page exposes no destructive evidence cleanup control.'));
      addOwnerLink(body, 'OPEN VERIFICATION', 'Evidence acceptance remains owned by verification.', 'verification');
      body.appendChild(el('span', 'cockpit-settings-handoff', 'RETENTION / EXPORT / ACCEPTED EVIDENCE HEALTH · HANDOFF REQUIRED'));
    } else if (category.id === 'git-instructions') {
      body.appendChild(el('p', 'cockpit-settings-detail', 'Git status and remote-mutation policy remain with the Git and Authority owners. Project instructions remain with the canonical workspace/context mechanism; this screen does not duplicate or rewrite them.'));
      body.appendChild(el('span', 'cockpit-settings-handoff', 'GIT HEALTH / REMOTE POLICY / PROJECT INSTRUCTIONS · OWNER CONTRACT REQUIRED'));
    } else if (category.id === 'notifications') {
      body.appendChild(el('p', 'cockpit-settings-detail', 'The existing toast/status channel reports operator-facing events. Per-class notification preferences are not backed here, so no silent or cosmetic notification switches are shown.'));
      body.appendChild(el('span', 'cockpit-settings-handoff', 'NOTIFICATION POLICY / DELIVERY STATE · CONTRACT REQUIRED'));
    } else if (category.id === 'keybindings') {
      body.appendChild(el('p', 'cockpit-settings-detail', 'No keybinding registry or command palette contract is available in this surface. Shortcuts are not configurable here.'));
      body.appendChild(el('span', 'cockpit-settings-handoff', 'KEYBINDING REGISTRY / COMMAND PALETTE · NOT IMPLEMENTED'));
    } else if (category.id === 'diagnostics') {
      body.appendChild(el('p', 'cockpit-settings-detail', 'System Health refresh performs read-only local status requests. A full self-test, sanitized diagnostic bundle, updater, migration recovery, and rollback are not implemented here.'));
      addOwnerLink(body, 'OPEN COMMAND CENTER', 'Use the existing operational evidence surface for current project facts.', 'command-center');
      body.appendChild(el('span', 'cockpit-settings-handoff', 'SELF-TEST / BUNDLE / UPDATES / ROLLBACK · HANDOFF REQUIRED'));
      if (opts.onReopenWalkthrough !== undefined) {
        const reopen = document.createElement('button');
        reopen.type = 'button';
        reopen.className = 'cockpit-settings-action';
        reopen.textContent = 'REOPEN WALKTHROUGH';
        reopen.addEventListener('click', () => opts.onReopenWalkthrough?.());
        body.appendChild(reopen);
      }
      if (opts.onRunSetup !== undefined) {
        const setup = document.createElement('button');
        setup.type = 'button';
        setup.className = 'cockpit-settings-action';
        setup.textContent = 'RUN ADAPTIVE SETUP';
        setup.addEventListener('click', () => opts.onRunSetup?.());
        body.appendChild(setup);
      }
    } else if (category.id === 'advanced') {
      body.appendChild(el('p', 'cockpit-settings-detail', 'Verbose logging, experimental switches, and internal identifiers are not exposed as preferences without a backed implementation and safe data contract.'));
      body.appendChild(el('span', 'cockpit-settings-handoff', 'ADVANCED PREFERENCES · NOT IMPLEMENTED'));
    }
  }

  const noMatches = el('p', 'cockpit-settings-no-matches', 'No settings match these search and filter conditions.');
  noMatches.hidden = true;
  content.appendChild(noMatches);

  function selectCategory(id: string): void {
    if (!sections.has(id)) return;
    active = id;
    const hasWorkspace = currentWorkspace() !== null;
    if (!hasWorkspace && activeScope === 'workspace') {
      activeScope = 'global';
      scope.value = 'global';
    }
    for (const [categoryId, section] of sections) section.hidden = categoryId !== active;
    for (const [categoryId, button] of navButtons) button.setAttribute('aria-current', categoryId === active ? 'page' : 'false');
    if (active === 'health' && healthMount !== null) {
      if (health === null) health = createSystemHealthSurface(healthMount, store);
      else void health.refresh();
    }
    applyFilters();
  }

  function updateControls(): void {
    for (const control of root.querySelectorAll<HTMLSelectElement | HTMLInputElement>('[data-setting-control]')) {
      control.value = String(prefValue(control.dataset.settingControl ?? ''));
      if (control instanceof HTMLInputElement && control.type === 'checkbox') control.checked = Boolean(prefValue(control.dataset.settingControl ?? ''));
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('.cockpit-theme-option')) {
      button.setAttribute('aria-pressed', String(button.dataset.theme === prefValue('appearance.theme')));
    }
  }

  function updateMetadata(): void {
    const workspace = currentWorkspace();
    const hasWorkspace = workspace !== null;
    if (!hasWorkspace && activeScope === 'workspace') {
      activeScope = 'global';
      scope.value = 'global';
    }
    for (const row of root.querySelectorAll<HTMLElement>('[data-setting-id]')) {
      const id = row.dataset.settingId ?? '';
      const source = opts.preferences.getSource(id, workspace);
      const effectiveValue = workspace === null
        ? opts.preferences.getEditableValue(id, 'global')
        : opts.preferences.getEditableValue(id, 'workspace', workspace);
      const targetValue = opts.preferences.getEditableValue(id, activeScope, workspace);
      const targetSource = activeScope === 'workspace'
        ? opts.preferences.hasWorkspaceOverride(id, workspace) ? 'WORKSPACE VALUE' : 'INHERITED VALUE'
        : opts.preferences.getSource(id) === 'global' ? 'GLOBAL VALUE' : 'DEFAULT VALUE';
      const effectiveSource = source === 'workspace' ? 'WORKSPACE OVERRIDE' : source === 'global' ? 'GLOBAL' : source === 'default' ? 'DEFAULT' : 'UNAVAILABLE';
      const sourceNode = row.querySelector<HTMLElement>('[data-setting-source]');
      if (sourceNode) sourceNode.textContent = `${targetSource}: ${String(targetValue ?? 'UNAVAILABLE').toUpperCase()} · EFFECTIVE: ${String(effectiveValue ?? 'UNAVAILABLE').toUpperCase()} (${effectiveSource})`;
      row.dataset.modified = String(opts.preferences.isModified(id, workspace));
      row.dataset.workspaceOverride = String(opts.preferences.hasWorkspaceOverride(id, workspace));
    }
    const workspaceOption = scope.querySelector<HTMLOptionElement>('option[value="workspace"]');
    if (workspaceOption) workspaceOption.disabled = !hasWorkspace;
    workspaceNote.textContent = hasWorkspace
      ? `Workspace scope: ${workspace?.split(/[\\/]/).filter(Boolean).at(-1) ?? 'active project'} · global preferences remain unchanged.`
      : 'Workspace scope is unavailable until the local health state identifies an active workspace.';
  }

  function applyFilters(): void {
    const query = search.value.trim().toLowerCase();
    const workspace = currentWorkspace();
    const enabled = new Set([...filterButtons].filter(([, button]) => button.getAttribute('aria-pressed') === 'true').map(([id]) => id));
    let activeMatches = 0;
    for (const row of root.querySelectorAll<HTMLElement>('[data-setting-id]')) {
      const id = row.dataset.settingId ?? '';
      const definition = SETTING_DEFINITIONS.find(item => item.id === id);
      const queryMatch = query.length === 0 || row.textContent?.toLowerCase().includes(query) === true;
      const filterMatch = (!enabled.has('modified') || opts.preferences.isModified(id, workspace))
        && (!enabled.has('workspace-overrides') || (activeScope === 'workspace' && opts.preferences.hasWorkspaceOverride(id, workspace)))
        && (!enabled.has('experimental') || definition?.experimental === true)
        && (!enabled.has('restart') || definition?.requiresRestart === true);
      row.hidden = !queryMatch || !filterMatch;
      if (!row.hidden && row.closest<HTMLElement>('[data-settings-category]')?.dataset.settingsCategory === active) activeMatches += 1;
    }
    for (const [id, button] of navButtons) {
      const category = CATEGORIES.find(item => item.id === id)!;
      const queryMatch = query.length === 0 || `${category.label} ${category.description}`.toLowerCase().includes(query)
        || sections.get(id)?.textContent?.toLowerCase().includes(query) === true;
      button.hidden = !queryMatch;
    }
    const selectedSection = sections.get(active)!;
    const hasPreferenceRows = selectedSection.querySelectorAll('[data-setting-id]').length > 0;
    noMatches.hidden = !(hasPreferenceRows && activeMatches === 0);
    updateControls();
  }

  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    if (query.length > 0) {
      const first = CATEGORIES.find(category => `${category.label} ${category.description}`.toLowerCase().includes(query)
        || sections.get(category.id)?.textContent?.toLowerCase().includes(query) === true);
      if (first) {
        selectCategory(first.id);
        return;
      }
    }
    applyFilters();
  });
  scope.addEventListener('change', () => {
    activeScope = scope.value === 'workspace' ? 'workspace' : 'global';
    updateControls();
    updateMetadata();
    applyFilters();
  });
  const unbindStore = store.subscribe(() => {
    updateMetadata();
    if (active === 'privacy') {
      const detail = sections.get('privacy')?.querySelector<HTMLElement>('.cockpit-settings-detail');
      if (detail) detail.textContent = `Current network posture: ${store.get().topbar.cloud}. Provider routing and BYOK egress are controlled in the canonical Connections and BYOK panels; this label does not change policy.`;
    }
    applyFilters();
  });

  updateMetadata();
  updatePersistenceStatus();
  selectCategory('appearance');

  return {
    dispose() {
      unbindStore();
      health?.dispose();
      parent.replaceChildren();
    }
  };
}
