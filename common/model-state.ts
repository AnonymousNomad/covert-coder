export type ModelDisplayState = 'AVAILABLE' | 'STARTABLE' | 'STARTING' | 'RUNNING' | 'READY' | 'DEGRADED' | 'STOPPED' | 'FAILED';

export interface ModelStateEvidence {
  status?: string;
  runtime_available?: boolean;
  artifact_available?: boolean;
}

/**
 * `/api/models/status` reports `ready` when an artifact can be started;
 * `/api/models/routes` reports `ready` only after an endpoint probe succeeds.
 */
export function modelDisplayState(model: ModelStateEvidence, routeStatus?: string): ModelDisplayState {
  if (model.status === 'stopped') return 'STOPPED';
  if (model.status === 'error') return 'FAILED';
  if (routeStatus === 'ready') return 'READY';
  if (model.runtime_available !== true || model.artifact_available !== true) return 'DEGRADED';
  if (routeStatus === 'starting' || model.status === 'starting') return 'STARTING';
  if (model.status === 'running') return 'RUNNING';
  if (model.status === 'ready') return 'STARTABLE';
  return 'AVAILABLE';
}

export function modelIsActive(state: ModelDisplayState): boolean {
  return state === 'RUNNING' || state === 'READY';
}

export function modelIsVerifiedReady(state: ModelDisplayState): boolean {
  return state === 'READY';
}
