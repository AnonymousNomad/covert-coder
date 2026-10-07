import type { Maturity, Panel } from '../store/state.ts';
import type { DesktopAppId, NormalizedBounds } from './types.ts';

export interface CovertAppManifest {
  id: DesktopAppId;
  title: string;
  icon: string;
  /** Existing surface owner; the shell only chooses where it is presented. */
  component: Panel;
  singleton: boolean;
  defaultBounds: NormalizedBounds;
  minWidth: number;
  minHeight: number;
  persistWindowState: boolean;
  keyboardShortcut?: string;
  /** Pinned in the sparse workstation launcher. Other apps remain available through the command palette. */
  launcher: boolean;
  maturity: Maturity;
}

export const APP_REGISTRY: readonly CovertAppManifest[] = [
  { id: 'editor', title: 'Editor', icon: '⌂', component: 'editor', singleton: true, defaultBounds: { x: 0.03, y: 0.04, width: 0.64, height: 0.70 }, minWidth: 520, minHeight: 320, persistWindowState: true, keyboardShortcut: 'Alt+1', launcher: true, maturity: 'AVAILABLE' },
  { id: 'terminal', title: 'Terminal', icon: '>_', component: 'terminal', singleton: false, defaultBounds: { x: 0.33, y: 0.48, width: 0.63, height: 0.46 }, minWidth: 460, minHeight: 240, persistWindowState: true, keyboardShortcut: 'Alt+2', launcher: true, maturity: 'AVAILABLE' },
  { id: 'resident', title: 'Cipher Console', icon: '◈', component: 'resident', singleton: true, defaultBounds: { x: 0.69, y: 0.08, width: 0.29, height: 0.78 }, minWidth: 320, minHeight: 340, persistWindowState: true, keyboardShortcut: 'Alt+3', launcher: false, maturity: 'AVAILABLE' },
  { id: 'projects', title: 'Projects', icon: '▤', component: 'projects', singleton: true, defaultBounds: { x: 0.10, y: 0.10, width: 0.56, height: 0.72 }, minWidth: 440, minHeight: 300, persistWindowState: true, keyboardShortcut: 'Alt+4', launcher: true, maturity: 'AVAILABLE' },
  { id: 'command-center', title: 'Operations', icon: '⌁', component: 'command-center', singleton: true, defaultBounds: { x: 0.08, y: 0.08, width: 0.78, height: 0.76 }, minWidth: 520, minHeight: 360, persistWindowState: true, keyboardShortcut: 'Alt+5', launcher: false, maturity: 'AVAILABLE' },
  { id: 'models', title: 'Models', icon: '⬡', component: 'models', singleton: true, defaultBounds: { x: 0.10, y: 0.08, width: 0.78, height: 0.78 }, minWidth: 520, minHeight: 360, persistWindowState: true, keyboardShortcut: 'Alt+6', launcher: true, maturity: 'AVAILABLE' },
  { id: 'verification', title: 'Evidence', icon: '✓', component: 'verification', singleton: true, defaultBounds: { x: 0.14, y: 0.10, width: 0.72, height: 0.76 }, minWidth: 520, minHeight: 340, persistWindowState: true, keyboardShortcut: 'Alt+7', launcher: true, maturity: 'AVAILABLE' },
  { id: 'skills', title: 'Skills', icon: '⌘', component: 'skills', singleton: true, defaultBounds: { x: 0.16, y: 0.12, width: 0.66, height: 0.72 }, minWidth: 440, minHeight: 300, persistWindowState: true, launcher: false, maturity: 'AVAILABLE' },
  { id: 'memory', title: 'Memory / Context', icon: '◉', component: 'memory', singleton: true, defaultBounds: { x: 0.18, y: 0.10, width: 0.64, height: 0.76 }, minWidth: 440, minHeight: 320, persistWindowState: true, launcher: false, maturity: 'AVAILABLE' },
  { id: 'security', title: 'Security', icon: '⛨', component: 'security', singleton: true, defaultBounds: { x: 0.18, y: 0.12, width: 0.64, height: 0.72 }, minWidth: 440, minHeight: 320, persistWindowState: true, launcher: false, maturity: 'AVAILABLE' },
  { id: 'settings', title: 'Settings', icon: '⚙', component: 'settings', singleton: true, defaultBounds: { x: 0.22, y: 0.12, width: 0.56, height: 0.72 }, minWidth: 420, minHeight: 320, persistWindowState: true, keyboardShortcut: 'Alt+0', launcher: true, maturity: 'AVAILABLE' },
  { id: 'cipher-laptop', title: 'Cipher Laptop', icon: '▣', component: 'cipher-laptop', singleton: true, defaultBounds: { x: 0.18, y: 0.14, width: 0.70, height: 0.64 }, minWidth: 460, minHeight: 300, persistWindowState: true, keyboardShortcut: 'Alt+9', launcher: true, maturity: 'AVAILABLE' },
  { id: 'connections', title: 'Connections', icon: '⇄', component: 'connections', singleton: true, defaultBounds: { x: 0.20, y: 0.10, width: 0.58, height: 0.74 }, minWidth: 440, minHeight: 320, persistWindowState: true, launcher: true, maturity: 'AVAILABLE' },
  { id: 'resources', title: 'Resource Monitor', icon: '%', component: 'resources', singleton: true, defaultBounds: { x: 0.36, y: 0.12, width: 0.60, height: 0.58 }, minWidth: 440, minHeight: 260, persistWindowState: true, keyboardShortcut: 'Alt+8', launcher: true, maturity: 'AVAILABLE' },
  { id: 'extensions', title: 'Extensions', icon: '⊞', component: 'extensions', singleton: true, defaultBounds: { x: 0.22, y: 0.14, width: 0.56, height: 0.70 }, minWidth: 420, minHeight: 300, persistWindowState: true, launcher: false, maturity: 'DISABLED' }
];

export const APP_BY_ID: ReadonlyMap<DesktopAppId, CovertAppManifest> = new Map(APP_REGISTRY.map(app => [app.id, app]));

export function appManifest(id: DesktopAppId): CovertAppManifest {
  const manifest = APP_BY_ID.get(id);
  if (!manifest) throw new Error(`Unknown desktop application: ${id}`);
  return manifest;
}
