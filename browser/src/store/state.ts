import type { HealthResponseT } from '../../../common/contracts/health.ts';
import type { WorkspaceListResponseT } from '../../../common/contracts/workspace.ts';
import type { SessionFileT } from '../../../common/contracts/session.ts';

export type Activity = 'editor' | 'learn' | 'map' | 'exp' | 'run';

export type Panel =
  | 'command-center'
  | 'resident'
  | 'projects'
  | 'editor'
  | 'terminal'
  | 'models'
  | 'skills'
  | 'memory'
  | 'verification'
  | 'security'
  | 'extensions'
  | 'settings';

export type BottomTab =
  | 'workspace'
  | 'files'
  | 'terminal'
  | 'tests'
  | 'output'
  | 'system-map'
  | 'problems'
  | 'tasks'
  | 'verify'
  | 'audit';

export type Maturity = 'AVAILABLE' | 'EXPERIMENTAL' | 'DEGRADED' | 'DISABLED';

export type VerificationState = 'UNVERIFIED' | 'VERIFIED' | 'DEGRADED' | 'FAILED';

export type HarnessState = 'UNKNOWN' | 'STANDBY' | 'ENABLED' | 'ON';

export type NetworkState =
  | 'UNKNOWN'
  | 'LOCAL_ONLY'
  | 'CREDENTIAL_MISSING'
  | 'REMOTE_CONFIGURED';

export interface TopbarState {
  engineLabel: string;
  engineReady: boolean;
  verification: VerificationState;
  harness: HarnessState;
  cloud: NetworkState;
}

export interface AppState {
  booted: boolean;
  activity: Activity;
  health: HealthResponseT | null;
  workspace: WorkspaceListResponseT | null;
  session: SessionFileT;
  error: { code: string; message: string } | null;

  panel: Panel;
  bottomTab: BottomTab;
  dockOpen: boolean;
  bottomStripOpen: boolean;
  topbar: TopbarState;
}

export const INITIAL_STATE: AppState = {
  booted: false,
  activity: 'editor',
  health: null,
  workspace: null,
  session: { version: 1, tabs: [] },
  error: null,

  panel: 'command-center',
  bottomTab: 'workspace',
  dockOpen: true,
  bottomStripOpen: true,
  topbar: {
    engineLabel: 'NO MODEL READY',
    engineReady: false,
    verification: 'UNVERIFIED',
    harness: 'STANDBY',
    cloud: 'LOCAL_ONLY'
  }
};
