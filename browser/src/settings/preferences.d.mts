export type PreferenceScope = 'global' | 'workspace' | 'role' | 'mission';
export type ThemeId = 'covert' | 'matrix';
export type PreferenceValue = string | boolean;
export interface AppearancePreferences {
  theme: ThemeId;
  textScale: 'normal' | 'large';
  density: 'standard' | 'compact';
  reducedMotion: boolean;
  effects: 'normal' | 'reduced' | 'off';
  telemetryVisible: boolean;
}
export interface SettingDefinition {
  id: string;
  label: string;
  description: string;
  category: string;
  type: 'choice' | 'boolean';
  default: PreferenceValue;
  scopes: Array<'global' | 'workspace'>;
  experimental: boolean;
  requiresRestart: boolean;
}
export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  tokenSet: string;
}
export const PREFERENCE_STORAGE_KEY: string;
export const DEFAULT_PREFERENCES: Readonly<AppearancePreferences>;
export const SETTING_DEFINITIONS: readonly SettingDefinition[];
export const THEME_REGISTRY: readonly ThemeDefinition[];
export class PreferenceStore {
  constructor(storage: { getItem(key: string): string | null; setItem(key: string, value: string): void } | null, key?: string);
  load(): { status: string; writable: boolean; issues: string[] };
  getStatus(): { status: string; writable: boolean; issues: string[] };
  getEffective(workspaceKey?: string | null): AppearancePreferences;
  getEditableValue(id: string, scope?: 'global' | 'workspace', workspaceKey?: string | null): PreferenceValue | undefined;
  getSource(id: string, workspaceKey?: string | null): 'workspace' | 'global' | 'default' | 'unsupported';
  hasWorkspaceOverride(id: string, workspaceKey: string | null): boolean;
  isModified(id: string, workspaceKey?: string | null): boolean;
  set(id: string, value: PreferenceValue, scope?: 'global' | 'workspace', workspaceKey?: string | null): { ok: boolean; persisted: boolean; reason?: string };
  reset(scope?: 'global' | 'workspace', workspaceKey?: string | null): { ok: boolean; persisted: boolean; reason?: string };
  resetSettings(ids: string[], scope?: 'global' | 'workspace', workspaceKey?: string | null): { ok: boolean; persisted: boolean; reason?: string };
}
export function createBrowserPreferenceStore(): PreferenceStore;
export function applyAppearance(preferences: AppearancePreferences, root?: HTMLElement): void;
