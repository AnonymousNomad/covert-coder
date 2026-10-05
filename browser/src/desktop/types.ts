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
