import type { Panel } from '../store/state.ts';

export type DesktopAppId = Panel;
export type LayoutId = 'CODING' | 'DEBUGGING' | 'MODEL_WORK' | 'VERIFICATION' | 'MINIMAL' | 'CUSTOM';
export type SnapState = 'none' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'maximized';

/** Desktop geometry is normalized to the desktop work area (0..1). */
export interface NormalizedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopWindowState {
  appId: DesktopAppId;
  /** Presentation identity only; never a terminal session or Authority principal. */
  instanceId?: string;
  bounds: NormalizedBounds;
  zIndex: number;
  minimized: boolean;
  snap: SnapState;
  restoreBounds: NormalizedBounds | null;
}

export interface DesktopLayoutState {
  version: 1;
  selectedLayout: LayoutId;
  startupLayout: LayoutId;
  windows: DesktopWindowState[];
  customWindows: DesktopWindowState[] | null;
}

export interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const MAX_INSTANCES_PER_APP = 8;

export function windowInstanceId(window: DesktopWindowState): string {
  return window.instanceId ?? window.appId;
}
