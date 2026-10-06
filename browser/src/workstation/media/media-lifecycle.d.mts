export type MediaStopReason = 'operator' | 'buddy-off' | 'lock' | 'sleep' | 'restart' | 'project-switch' | 'dispose';
export interface OwnedMediaAdapter {
  stop(): unknown | Promise<unknown>;
  observe(): 'ACTIVE' | 'INACTIVE' | 'UNKNOWN' | Promise<'ACTIVE' | 'INACTIVE' | 'UNKNOWN'>;
}
export interface MediaPathOutcome {
  readonly status: 'STOPPED' | 'ACTIVE' | 'UNKNOWN' | 'NOT_CONFIGURED';
  readonly stopRequested: boolean; readonly stopOutcome: 'RETURNED' | 'FAILED' | 'TIMED_OUT' | 'NOT_CONFIGURED';
}
export interface MediaStopReport {
  readonly scope: 'OPTIONAL_MEDIA'; readonly reason: MediaStopReason; readonly status: 'STOPPED' | 'PARTIAL';
  readonly capture: MediaPathOutcome; readonly output: MediaPathOutcome;
  readonly projection: 'DELIVERED' | 'FAILED' | 'UNCONFIGURED';
}
export function createMediaLifecycle(options?: {
  capture?: OwnedMediaAdapter; output?: OwnedMediaAdapter; timeoutMs?: number;
  onState?(state: Readonly<{ scope: 'OPTIONAL_MEDIA'; reason: MediaStopReason; status: 'STOP_REQUESTED' }> | Omit<MediaStopReport, 'projection'>): void;
}): Readonly<{ stop(reason: MediaStopReason): Promise<MediaStopReport> }>;
