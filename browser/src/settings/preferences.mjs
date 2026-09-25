/**
 * Browser-local operator preferences. This deliberately owns presentation-only
 * state; runtime, qualification, permission, and evidence truth stay with their
 * existing services.
 */

export const PREFERENCE_STORAGE_KEY = 'covert.operator-preferences.v1';

export const DEFAULT_PREFERENCES = Object.freeze({
  theme: 'covert',
  textScale: 'normal',
  density: 'standard',
  reducedMotion: false,
  effects: 'normal',
  telemetryVisible: true
});

export const THEME_REGISTRY = Object.freeze([
  { id: 'covert', label: 'DEFAULT COVERT', description: 'Existing dark engineering palette.', tokenSet: 'base' },
  { id: 'matrix', label: 'MATRIX', description: 'Binary field, signal-green tokens, reduced visual noise.', tokenSet: 'matrix' }
]);

export const SETTING_DEFINITIONS = Object.freeze([
  { id: 'appearance.theme', label: 'Theme', description: 'Choose the default Covert palette or the Matrix treatment.', category: 'Appearance', type: 'choice', default: 'covert', scopes: ['global', 'workspace'], experimental: false, requiresRestart: false },
  { id: 'appearance.textScale', label: 'Editor and terminal text size', description: 'Adjust code and terminal text without changing project content.', category: 'Appearance', type: 'choice', default: 'normal', scopes: ['global', 'workspace'], experimental: false, requiresRestart: false },
  { id: 'appearance.effects', label: 'Ambient effects', description: 'Control decorative background effects and glow intensity.', category: 'Appearance', type: 'choice', default: 'normal', scopes: ['global', 'workspace'], experimental: false, requiresRestart: false },
  { id: 'accessibility.reducedMotion', label: 'Reduce motion', description: 'Disable decorative motion while preserving all work surfaces.', category: 'Accessibility', type: 'boolean', default: false, scopes: ['global', 'workspace'], experimental: false, requiresRestart: false },
  { id: 'layout.density', label: 'Interface density', description: 'Use standard or compact spacing in the operator shell.', category: 'Layout', type: 'choice', default: 'standard', scopes: ['global', 'workspace'], experimental: false, requiresRestart: false },
  { id: 'layout.telemetryVisible', label: 'Show resource telemetry', description: 'Show the existing hardware snapshot in the intelligence rail.', category: 'Layout', type: 'boolean', default: true, scopes: ['global', 'workspace'], experimental: false, requiresRestart: false }
]);

const VALIDATORS = Object.freeze({
  'appearance.theme': value => THEME_REGISTRY.some(theme => theme.id === value),
  'appearance.textScale': value => value === 'normal' || value === 'large',
  'appearance.effects': value => value === 'normal' || value === 'reduced' || value === 'off',
  'accessibility.reducedMotion': value => typeof value === 'boolean',
  'layout.density': value => value === 'standard' || value === 'compact',
  'layout.telemetryVisible': value => typeof value === 'boolean'
});

const PREFERENCE_FIELDS = Object.freeze({
  'appearance.theme': 'theme',
  'appearance.textScale': 'textScale',
  'appearance.effects': 'effects',
  'accessibility.reducedMotion': 'reducedMotion',
  'layout.density': 'density',
  'layout.telemetryVisible': 'telemetryVisible'
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function emptySnapshot() {
  return { version: 1, global: {}, workspaces: {}, unknownGlobal: {}, unknownWorkspaces: {} };
}

function parseScope(raw, known, unknown, issues, scopeName) {
  if (!isRecord(raw)) {
    if (raw !== undefined) issues.push(`${scopeName}: expected an object`);
    return;
  }
  for (const [id, value] of Object.entries(raw)) {
    const field = PREFERENCE_FIELDS[id];
    if (field === undefined) {
      unknown[id] = value;
      continue;
    }
    if (!VALIDATORS[id](value)) {
      unknown[id] = value;
      issues.push(`${scopeName}.${id}: invalid value preserved; default used`);
      continue;
    }
    known[field] = value;
  }
}

function serialize(snapshot) {
  const global = { ...snapshot.unknownGlobal };
  for (const [id, field] of Object.entries(PREFERENCE_FIELDS)) {
    if (Object.hasOwn(snapshot.global, field)) global[id] = snapshot.global[field];
  }
  const workspaces = {};
  const keys = new Set([...Object.keys(snapshot.unknownWorkspaces), ...Object.keys(snapshot.workspaces)]);
  for (const key of keys) {
    const values = { ...(snapshot.unknownWorkspaces[key] ?? {}) };
    for (const [id, field] of Object.entries(PREFERENCE_FIELDS)) {
      if (Object.hasOwn(snapshot.workspaces[key] ?? {}, field)) values[id] = snapshot.workspaces[key][field];
    }
    workspaces[key] = values;
  }
  return JSON.stringify({ version: 1, global, workspaces });
}

/**
 * @param {{getItem(key:string):string|null,setItem(key:string,value:string):void}|null} storage
 * @param {string} [key]
 */
export class PreferenceStore {
  constructor(storage, key = PREFERENCE_STORAGE_KEY) {
    this.storage = storage;
    this.key = key;
    this.snapshot = emptySnapshot();
    this.status = 'not-loaded';
    this.issues = [];
    this.writable = storage !== null;
  }

  load() {
    this.snapshot = emptySnapshot();
    this.issues = [];
    if (this.storage === null) {
      this.status = 'unavailable';
      this.writable = false;
      return this.getStatus();
    }
    let raw;
    try { raw = this.storage.getItem(this.key); }
    catch {
      this.status = 'unavailable';
      this.writable = false;
      this.issues.push('Preference storage could not be read');
      return this.getStatus();
    }
    if (raw === null) {
      this.status = 'empty';
      this.writable = true;
      return this.getStatus();
    }
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch {
      this.status = 'invalid';
      this.writable = false;
      this.issues.push('Stored preference data is malformed; it was not overwritten');
      return this.getStatus();
    }
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.global) || !isRecord(parsed.workspaces)) {
      this.status = 'unsupported';
      this.writable = false;
      this.issues.push('Stored preference schema is unsupported; it was not overwritten');
      return this.getStatus();
    }
    parseScope(parsed.global, this.snapshot.global, this.snapshot.unknownGlobal, this.issues, 'global');
    for (const [workspace, values] of Object.entries(parsed.workspaces)) {
      if (!isRecord(values)) {
        this.issues.push(`workspace override ${workspace}: expected an object`);
        this.snapshot.unknownWorkspaces[workspace] = { __preserved_invalid_scope: values };
        continue;
      }
      this.snapshot.workspaces[workspace] = {};
      this.snapshot.unknownWorkspaces[workspace] = {};
      parseScope(values, this.snapshot.workspaces[workspace], this.snapshot.unknownWorkspaces[workspace], this.issues, `workspace.${workspace}`);
    }
    this.status = this.issues.length === 0 ? 'loaded' : 'recovered';
    this.writable = true;
    return this.getStatus();
  }

  getStatus() {
    return { status: this.status, writable: this.writable, issues: [...this.issues] };
  }

  getEffective(workspaceKey = null) {
    const result = { ...DEFAULT_PREFERENCES, ...this.snapshot.global };
    if (typeof workspaceKey === 'string' && workspaceKey.length > 0) {
      Object.assign(result, this.snapshot.workspaces[workspaceKey] ?? {});
    }
    return result;
  }

  getEditableValue(id, scope = 'global', workspaceKey = null) {
    const field = PREFERENCE_FIELDS[id];
    if (field === undefined) return undefined;
    if (scope === 'workspace') {
      if (typeof workspaceKey !== 'string' || workspaceKey.length === 0) return undefined;
      const workspace = this.snapshot.workspaces[workspaceKey] ?? {};
      if (Object.hasOwn(workspace, field)) return workspace[field];
    }
    if (scope !== 'global' && scope !== 'workspace') return undefined;
    if (Object.hasOwn(this.snapshot.global, field)) return this.snapshot.global[field];
    return DEFAULT_PREFERENCES[field];
  }

  getSource(id, workspaceKey = null) {
    const field = PREFERENCE_FIELDS[id];
    if (field === undefined) return 'unsupported';
    if (workspaceKey && Object.hasOwn(this.snapshot.workspaces[workspaceKey] ?? {}, field)) return 'workspace';
    if (Object.hasOwn(this.snapshot.global, field)) return 'global';
    return 'default';
  }

  hasWorkspaceOverride(id, workspaceKey) {
    const field = PREFERENCE_FIELDS[id];
    return Boolean(field && workspaceKey && Object.hasOwn(this.snapshot.workspaces[workspaceKey] ?? {}, field));
  }

  isModified(id, workspaceKey = null) {
    const definition = SETTING_DEFINITIONS.find(item => item.id === id);
    const field = PREFERENCE_FIELDS[id];
    if (definition === undefined || field === undefined) return false;
    return this.getEffective(workspaceKey)[field] !== definition.default;
  }

  set(id, value, scope = 'global', workspaceKey = null) {
    const definition = SETTING_DEFINITIONS.find(item => item.id === id);
    const field = PREFERENCE_FIELDS[id];
    if (definition === undefined || field === undefined || !VALIDATORS[id](value)) return { ok: false, persisted: false, reason: 'INVALID_SETTING' };
    if (!definition.scopes.includes(scope)) return { ok: false, persisted: false, reason: 'UNSUPPORTED_SCOPE' };
    if (scope === 'workspace' && (!workspaceKey || typeof workspaceKey !== 'string')) return { ok: false, persisted: false, reason: 'WORKSPACE_REQUIRED' };
    if (!this.writable) return { ok: false, persisted: false, reason: 'STORAGE_NOT_WRITABLE' };
    if (scope === 'global') this.snapshot.global[field] = value;
    else {
      this.snapshot.workspaces[workspaceKey] ??= {};
      this.snapshot.workspaces[workspaceKey][field] = value;
    }
    try {
      this.storage.setItem(this.key, serialize(this.snapshot));
      this.status = 'loaded';
      return { ok: true, persisted: true };
    } catch {
      this.status = 'volatile';
      this.issues.push('Preference applied for this session but could not be persisted');
      return { ok: true, persisted: false, reason: 'STORAGE_WRITE_FAILED' };
    }
  }

  reset(scope = 'global', workspaceKey = null) {
    if (!['global', 'workspace'].includes(scope)) return { ok: false, persisted: false, reason: 'UNSUPPORTED_SCOPE' };
    if (scope === 'workspace' && !workspaceKey) return { ok: false, persisted: false, reason: 'WORKSPACE_REQUIRED' };
    if (!this.writable) return { ok: false, persisted: false, reason: 'STORAGE_NOT_WRITABLE' };
    if (scope === 'global') this.snapshot.global = {};
    else this.snapshot.workspaces[workspaceKey] = {};
    try {
      this.storage.setItem(this.key, serialize(this.snapshot));
      this.status = 'loaded';
      return { ok: true, persisted: true };
    } catch {
      this.status = 'volatile';
      return { ok: true, persisted: false, reason: 'STORAGE_WRITE_FAILED' };
    }
  }

  resetSettings(ids, scope = 'global', workspaceKey = null) {
    if (!Array.isArray(ids) || ids.length === 0) return { ok: false, persisted: false, reason: 'SETTING_IDS_REQUIRED' };
    if (!['global', 'workspace'].includes(scope)) return { ok: false, persisted: false, reason: 'UNSUPPORTED_SCOPE' };
    if (scope === 'workspace' && !workspaceKey) return { ok: false, persisted: false, reason: 'WORKSPACE_REQUIRED' };
    if (!this.writable) return { ok: false, persisted: false, reason: 'STORAGE_NOT_WRITABLE' };
    const fields = ids.map(id => PREFERENCE_FIELDS[id]);
    if (fields.some(field => field === undefined)) return { ok: false, persisted: false, reason: 'INVALID_SETTING' };
    const destination = scope === 'global' ? this.snapshot.global : (this.snapshot.workspaces[workspaceKey] ??= {});
    for (const field of fields) delete destination[field];
    try {
      this.storage.setItem(this.key, serialize(this.snapshot));
      this.status = 'loaded';
      return { ok: true, persisted: true };
    } catch {
      this.status = 'volatile';
      return { ok: true, persisted: false, reason: 'STORAGE_WRITE_FAILED' };
    }
  }
}

export function createBrowserPreferenceStore() {
  try { return new PreferenceStore(window.localStorage); }
  catch { return new PreferenceStore(null); }
}

export function applyAppearance(preferences, root = document.documentElement) {
  let changed = false;
  const setData = (key, value) => {
    if (root.dataset[key] !== value) {
      root.dataset[key] = value;
      changed = true;
    }
  };
  const theme = preferences.theme === 'matrix' ? 'matrix' : undefined;
  if (theme === undefined) {
    if (root.dataset.covertTheme !== undefined) {
      delete root.dataset.covertTheme;
      changed = true;
    }
  } else setData('covertTheme', theme);
  setData('covertDensity', preferences.density);
  setData('covertMotion', preferences.reducedMotion ? 'reduced' : 'system');
  setData('covertEffects', preferences.effects);
  setData('covertTelemetry', preferences.telemetryVisible ? 'visible' : 'hidden');
  const textScale = preferences.textScale === 'large' ? '1.12' : '1';
  if (root.style.getPropertyValue('--ck-text-scale') !== textScale) {
    root.style.setProperty('--ck-text-scale', textScale);
    changed = true;
  }
  if (changed && typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent('covert:appearancechange', { detail: { ...preferences } }));
  }
}
