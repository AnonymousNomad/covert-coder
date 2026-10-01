// Readiness belongs to the latest completed run, never to the rendered page.
export const REQUIRED_SETUP_CHECKS = ['daemon', 'hardware', 'model registry', 'workflow runtime', 'evidence bus'] as const;
export type ValidationStatus = 'NOT_RUN' | 'RUNNING' | 'PASSED' | 'FAILED' | 'UNAVAILABLE';
export interface SetupCheck { label: string; status: 'PASSED' | 'FAILED' | 'UNAVAILABLE'; detail: string; }
export interface SetupValidation { run: number; status: ValidationStatus; checks: SetupCheck[]; }

export function setupValidationReady(state: SetupValidation): boolean {
  return state.status === 'PASSED' && REQUIRED_SETUP_CHECKS.every(label => {
    const matches = state.checks.filter(check => check.label === label);
    return matches.length === 1 && matches[0]?.status === 'PASSED';
  });
}

export function createSetupValidation() {
  let state: SetupValidation = { run: 0, status: 'NOT_RUN', checks: [] };
  return {
    snapshot(): SetupValidation { return { ...state, checks: state.checks.map(check => ({ ...check })) }; },
    invalidate(): void { state = { run: state.run + 1, status: 'NOT_RUN', checks: [] }; },
    begin(): number { state = { run: state.run + 1, status: 'RUNNING', checks: [] }; return state.run; },
    complete(run: number, checks: SetupCheck[]): boolean {
      if (run !== state.run || state.status !== 'RUNNING') return false;
      const required = REQUIRED_SETUP_CHECKS.map(label => checks.filter(check => check.label === label));
      const status = required.some(matches => matches.some(check => check.status === 'FAILED')) ? 'FAILED'
        : required.some(matches => matches.length !== 1 || matches[0]?.status !== 'PASSED') ? 'UNAVAILABLE' : 'PASSED';
      state = { run, status, checks: checks.map(check => ({ ...check })) };
      return true;
    },
  };
}
