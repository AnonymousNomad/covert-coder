import { MAX_INSTANCES_PER_APP, windowInstanceId } from './types.ts';
import { APP_BY_ID, APP_REGISTRY } from './app-registry.ts';
import type { DesktopAppId, DesktopLayoutState, DesktopWindowState, LayoutId, NormalizedBounds, PixelBounds, SnapState } from './types.ts';

export const DESKTOP_LAYOUT_STORAGE_KEY = 'covert.desktop.layout.v1';
const LAYOUT_IDS: readonly LayoutId[] = ['WORKSTATION', 'CODING', 'DEBUGGING', 'MODEL_WORK', 'VERIFICATION', 'MINIMAL', 'CUSTOM'];
const SNAP_STATES: readonly SnapState[] = ['none', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'maximized'];

interface PresetWindow {
  appId: DesktopAppId;
  instanceId?: string;
  bounds: NormalizedBounds;
}

const PRESETS: Record<Exclude<LayoutId, 'CUSTOM'>, readonly PresetWindow[]> = {
  WORKSTATION: [
    { appId: 'editor', bounds: { x: 0.02, y: 0.03, width: 0.60, height: 0.61 } },
    { appId: 'terminal', bounds: { x: 0.02, y: 0.63, width: 0.32, height: 0.34 } },
    { appId: 'terminal', instanceId: 'terminal:2', bounds: { x: 0.36, y: 0.63, width: 0.32, height: 0.34 } },
    { appId: 'resources', bounds: { x: 0.65, y: 0.03, width: 0.33, height: 0.27 } },
    { appId: 'cipher-laptop', bounds: { x: 0.60, y: 0.35, width: 0.38, height: 0.62 } }
  ],
  CODING: [
    { appId: 'editor', bounds: { x: 0.02, y: 0.025, width: 0.96, height: 0.55 } },
    { appId: 'terminal', bounds: { x: 0.02, y: 0.60, width: 0.47, height: 0.39 } },
    { appId: 'terminal', instanceId: 'terminal:2', bounds: { x: 0.51, y: 0.60, width: 0.47, height: 0.39 } }
  ],
  DEBUGGING: [
    { appId: 'editor', bounds: { x: 0.02, y: 0.03, width: 0.56, height: 0.91 } },
    { appId: 'terminal', bounds: { x: 0.59, y: 0.03, width: 0.39, height: 0.43 } },
    { appId: 'verification', bounds: { x: 0.59, y: 0.50, width: 0.39, height: 0.44 } }
  ],
  MODEL_WORK: [
    { appId: 'models', bounds: { x: 0.02, y: 0.03, width: 0.62, height: 0.91 } },
    { appId: 'terminal', bounds: { x: 0.66, y: 0.40, width: 0.32, height: 0.54 } }
  ],
  VERIFICATION: [
    { appId: 'verification', bounds: { x: 0.02, y: 0.03, width: 0.62, height: 0.91 } },
    { appId: 'editor', bounds: { x: 0.66, y: 0.03, width: 0.32, height: 0.91 } }
  ],
  MINIMAL: [
    { appId: 'editor', bounds: { x: 0.05, y: 0.04, width: 0.90, height: 0.90 } }
  ]
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LoadedLayout {
  state: DesktopLayoutState;
  recovered: boolean;
}

function copyBounds(bounds: NormalizedBounds): NormalizedBounds {
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

function windowState(appId: DesktopAppId, bounds: NormalizedBounds, zIndex: number, instanceId = appId as string): DesktopWindowState {
  return { appId, instanceId, bounds: copyBounds(bounds), zIndex, minimized: false, snap: 'none', restoreBounds: null };
}

export function createPresetWindows(layoutId: Exclude<LayoutId, 'CUSTOM'>): DesktopWindowState[] {
  return PRESETS[layoutId]
    .filter(window => APP_BY_ID.get(window.appId)?.maturity === 'AVAILABLE')
    .map((window, index) => windowState(window.appId, window.bounds, index + 1, window.instanceId));
}

export function createDefaultLayoutState(layoutId: Exclude<LayoutId, 'CUSTOM'> = 'WORKSTATION'): DesktopLayoutState {
  return { version: 1, selectedLayout: layoutId, startupLayout: layoutId, windows: createPresetWindows(layoutId), customWindows: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validBounds(value: unknown): value is NormalizedBounds {
  if (!isRecord(value)) return false;
  const { x, y, width, height } = value;
  return isFiniteNumber(x) && isFiniteNumber(y) && isFiniteNumber(width) && isFiniteNumber(height)
    && x >= 0 && y >= 0 && width >= 0.16 && height >= 0.14
    && x <= 1 && y <= 1 && width <= 1 && height <= 1
    && x + width <= 1.001 && y + height <= 1.001;
}

export function validInstanceId(appId: DesktopAppId, instanceId: unknown): instanceId is string {
  if (instanceId === appId) return true;
  const manifest = APP_BY_ID.get(appId);
  if (!manifest || manifest.singleton || typeof instanceId !== 'string') return false;
  return Array.from({ length: MAX_INSTANCES_PER_APP - 1 }, (_, index) => `${appId}:${index + 2}`).includes(instanceId);
}

function validWindow(value: unknown): value is DesktopWindowState {
  if (!isRecord(value)) return false;
  const keys = ['appId', 'instanceId', 'bounds', 'zIndex', 'minimized', 'snap', 'restoreBounds'];
  if (Object.keys(value).some(key => !keys.includes(key))) return false;
  if (value.instanceId !== undefined && !validInstanceId(value.appId as DesktopAppId, value.instanceId)) return false;
  return typeof value.appId === 'string'
    && APP_BY_ID.has(value.appId as DesktopAppId)
    && APP_BY_ID.get(value.appId as DesktopAppId)?.maturity === 'AVAILABLE'
    && validBounds(value.bounds)
    && Number.isInteger(value.zIndex) && (value.zIndex as number) > 0
    && typeof value.minimized === 'boolean'
    && typeof value.snap === 'string' && SNAP_STATES.includes(value.snap as SnapState)
    && (value.restoreBounds === null || validBounds(value.restoreBounds));
}

function validWindows(value: unknown): value is DesktopWindowState[] {
  if (!Array.isArray(value) || value.length > APP_REGISTRY.length + MAX_INSTANCES_PER_APP - 1) return false;
  const ids = new Set<string>();
  for (const entry of value) {
    if (!validWindow(entry) || ids.has(windowInstanceId(entry))) return false;
    ids.add(windowInstanceId(entry));
  }
  return true;
}

export function decodeLayoutState(input: unknown): DesktopLayoutState | null {
  if (!isRecord(input) || input.version !== 1) return null;
  if (typeof input.selectedLayout !== 'string' || !LAYOUT_IDS.includes(input.selectedLayout as LayoutId)) return null;
  if (typeof input.startupLayout !== 'string' || !LAYOUT_IDS.includes(input.startupLayout as LayoutId)) return null;
  if (!validWindows(input.windows)) return null;
  if (input.customWindows !== null && !validWindows(input.customWindows)) return null;
  return {
    version: 1,
    selectedLayout: input.selectedLayout as LayoutId,
    startupLayout: input.startupLayout as LayoutId,
    windows: input.windows.map(window => ({ ...window, instanceId: windowInstanceId(window), bounds: copyBounds(window.bounds), restoreBounds: window.restoreBounds ? copyBounds(window.restoreBounds) : null })),
    customWindows: input.customWindows === null ? null : input.customWindows.map(window => ({ ...window, instanceId: windowInstanceId(window), bounds: copyBounds(window.bounds), restoreBounds: window.restoreBounds ? copyBounds(window.restoreBounds) : null }))
  };
}

export function loadLayoutState(storage: StorageLike | null): LoadedLayout {
  if (!storage) return { state: createDefaultLayoutState(), recovered: false };
  try {
    const raw = storage.getItem(DESKTOP_LAYOUT_STORAGE_KEY);
    if (raw === null) return { state: createDefaultLayoutState(), recovered: false };
    const decoded = decodeLayoutState(JSON.parse(raw) as unknown);
    return decoded === null
      ? { state: createDefaultLayoutState(), recovered: true }
      : { state: decoded, recovered: false };
  } catch {
    return { state: createDefaultLayoutState(), recovered: true };
  }
}

export function persistLayoutState(storage: StorageLike | null, state: DesktopLayoutState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(DESKTOP_LAYOUT_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
/** Enforce app minima within the real work area; never hide controls behind the dock. */
export function windowPixelBounds(bounds: NormalizedBounds, viewport: { width: number; height: number }, minimum: { width: number; height: number }): PixelBounds {
  const width = Math.min(viewport.width, Math.max(bounds.width * viewport.width, minimum.width));
  const height = Math.min(viewport.height, Math.max(bounds.height * viewport.height, minimum.height));
  return {
    x: Math.max(0, Math.min(bounds.x * viewport.width, viewport.width - width)),
    y: Math.max(0, Math.min(bounds.y * viewport.height, viewport.height - height)),
    width,
    height
  };
}
