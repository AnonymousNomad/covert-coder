import { APP_BY_ID } from './app-registry.ts';
import { createDefaultLayoutState, decodeLayoutState, validInstanceId, persistLayoutState, type StorageLike } from './layout.ts';
import { MAX_INSTANCES_PER_APP, windowInstanceId } from './types.ts';
import type { DesktopAppId, DesktopLayoutState, DesktopWindowState, LayoutId, NormalizedBounds, SnapState } from './types.ts';

export type SnapTarget = Exclude<SnapState, 'none' | 'maximized'>;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function copyBounds(bounds: NormalizedBounds): NormalizedBounds {
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

function normalizeBounds(bounds: NormalizedBounds): NormalizedBounds {
  const width = clamp(bounds.width, 0.16, 1);
  const height = clamp(bounds.height, 0.14, 1);
  return {
    x: clamp(bounds.x, 0, 1 - width),
    y: clamp(bounds.y, 0, 1 - height),
    width,
    height
  };
}

function snapBounds(target: SnapTarget): NormalizedBounds {
  switch (target) {
    case 'left': return { x: 0, y: 0, width: 0.5, height: 1 };
    case 'right': return { x: 0.5, y: 0, width: 0.5, height: 1 };
    case 'top-left': return { x: 0, y: 0, width: 0.5, height: 0.5 };
    case 'top-right': return { x: 0.5, y: 0, width: 0.5, height: 0.5 };
    case 'bottom-left': return { x: 0, y: 0.5, width: 0.5, height: 0.5 };
    case 'bottom-right': return { x: 0.5, y: 0.5, width: 0.5, height: 0.5 };
  }
}

export class WindowManager {
  private state: DesktopLayoutState;
  private readonly storage: StorageLike | null;
  private readonly listeners = new Set<(state: DesktopLayoutState) => void>();

  constructor(
    initial: DesktopLayoutState = createDefaultLayoutState(),
    storage: StorageLike | null = null
  ) {
    this.state = decodeLayoutState(initial) ?? createDefaultLayoutState();
    this.storage = storage;
  }

  snapshot(): DesktopLayoutState {
    return {
      ...this.state,
      windows: this.state.windows.map(window => ({ ...window, bounds: copyBounds(window.bounds), restoreBounds: window.restoreBounds ? copyBounds(window.restoreBounds) : null })),
      customWindows: this.state.customWindows?.map(window => ({ ...window, bounds: copyBounds(window.bounds), restoreBounds: window.restoreBounds ? copyBounds(window.restoreBounds) : null })) ?? null
    };
  }

  subscribe(listener: (state: DesktopLayoutState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  open(appId: DesktopAppId, instanceId = appId as string): boolean {
    const manifest = APP_BY_ID.get(appId);
    if (!manifest || manifest.maturity !== 'AVAILABLE' || !validInstanceId(appId, instanceId)) return false;
    const current = this.state.windows.find(window => windowInstanceId(window) === instanceId);
    if (current) {
      this.commit({
        ...this.state,
        windows: this.state.windows.map(window => windowInstanceId(window) === instanceId ? { ...window, minimized: false, zIndex: this.nextZ() } : window)
      });
      return true;
    }
    const zIndex = this.nextZ();
    const window: DesktopWindowState = {
      appId,
      instanceId,
      bounds: copyBounds(manifest.defaultBounds),
      zIndex,
      minimized: false,
      snap: 'none',
      restoreBounds: null
    };
    this.commit({ ...this.state, windows: [...this.state.windows, window] });
    return true;
  }

  openNew(appId: DesktopAppId): string | null {
    const manifest = APP_BY_ID.get(appId);
    if (!manifest || manifest.maturity !== 'AVAILABLE') return null;
    if (manifest.singleton) return this.open(appId) ? appId : null;
    for (let index = 1; index <= MAX_INSTANCES_PER_APP; index++) {
      const instanceId = index === 1 ? appId : `${appId}:${index}`;
      if (!this.state.windows.some(window => windowInstanceId(window) === instanceId)) {
        return this.open(appId, instanceId) ? instanceId : null;
      }
    }
    return null;
  }

  focus(instanceId: string): void {
    if (!this.state.windows.some(window => windowInstanceId(window) === instanceId)) return;
    this.commit({
      ...this.state,
      windows: this.state.windows.map(window => windowInstanceId(window) === instanceId ? { ...window, minimized: false, zIndex: this.nextZ() } : window)
    });
  }

  close(instanceId: string): void {
    if (!this.state.windows.some(window => windowInstanceId(window) === instanceId)) return;
    this.commit({ ...this.state, windows: this.state.windows.filter(window => windowInstanceId(window) !== instanceId) });
  }

  minimize(instanceId: string): void {
    this.patchWindow(instanceId, window => ({ ...window, minimized: true }));
  }

  restore(instanceId: string): void {
    this.patchWindow(instanceId, window => ({ ...window, minimized: false, zIndex: this.nextZ() }));
  }

  toggleMaximize(instanceId: string): void {
    this.patchWindow(instanceId, window => window.snap === 'maximized' && window.restoreBounds
      ? { ...window, bounds: window.restoreBounds, restoreBounds: null, snap: 'none', minimized: false, zIndex: this.nextZ() }
      : { ...window, restoreBounds: copyBounds(window.bounds), bounds: { x: 0, y: 0, width: 1, height: 1 }, snap: 'maximized', minimized: false, zIndex: this.nextZ() });
  }

  snap(instanceId: string, target: SnapTarget): void {
    this.patchWindow(instanceId, window => ({ ...window, bounds: snapBounds(target), snap: target, restoreBounds: null, minimized: false, zIndex: this.nextZ() }));
  }

  setBounds(instanceId: string, bounds: NormalizedBounds): void {
    if (![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) return;
    this.patchWindow(instanceId, window => ({ ...window, bounds: normalizeBounds(bounds), snap: 'none', restoreBounds: null }));
  }

  selectLayout(layoutId: Exclude<LayoutId, 'CUSTOM'>): void {
    const startupLayout = this.state.startupLayout;
    this.commit({ ...createDefaultLayoutState(layoutId), startupLayout });
  }

  saveLayout(): void {
    const windows = this.state.windows.map(window => ({ ...window, bounds: normalizeBounds(window.bounds), restoreBounds: window.restoreBounds ? normalizeBounds(window.restoreBounds) : null }));
    this.commit({ ...this.state, selectedLayout: 'CUSTOM', windows, customWindows: windows.map(window => ({ ...window })) });
  }

  setStartupLayout(): void {
    this.commit({ ...this.state, startupLayout: this.state.selectedLayout, customWindows: this.state.selectedLayout === 'CUSTOM' ? this.state.windows.map(window => ({ ...window })) : this.state.customWindows });
  }

  restoreStartupLayout(): void {
    const layout = this.state.startupLayout;
    if (layout === 'CUSTOM') {
      const custom = this.state.customWindows;
      if (custom) this.commit({ ...this.state, selectedLayout: 'CUSTOM', windows: custom.map(window => ({ ...window })) });
      else this.selectLayout('WORKSTATION');
      return;
    }
    this.selectLayout(layout);
  }

  resetLayout(): void {
    const startupLayout = this.state.startupLayout;
    this.commit({ ...createDefaultLayoutState('WORKSTATION'), startupLayout });
  }

  private patchWindow(instanceId: string, update: (window: DesktopWindowState) => DesktopWindowState): void {
    if (!this.state.windows.some(window => windowInstanceId(window) === instanceId)) return;
    this.commit({ ...this.state, windows: this.state.windows.map(window => windowInstanceId(window) === instanceId ? update(window) : window) });
  }

  private nextZ(): number {
    return Math.max(0, ...this.state.windows.map(window => window.zIndex)) + 1;
  }

  private commit(next: DesktopLayoutState): void {
    this.state = next;
    persistLayoutState(this.storage, this.state);
    const snapshot = this.snapshot();
    for (const listener of this.listeners) listener(snapshot);
  }
}
