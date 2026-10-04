import type { ByokStatusResponseT } from '../../../common/contracts/byok.ts';
import type { ModelManagerResponseT } from '../../../common/contracts/model-access.ts';

// Readiness belongs to the latest completed run, never to the rendered page.
export const REQUIRED_SETUP_CHECKS = ['daemon', 'hardware', 'model registry', 'workflow runtime', 'evidence bus', 'onboarding choices', 'setup preferences', 'model access identity', 'provider identity'] as const;
export type ValidationStatus = 'NOT_RUN' | 'RUNNING' | 'PASSED' | 'FAILED' | 'UNAVAILABLE';
export interface SetupCheck { label: string; status: 'PASSED' | 'FAILED' | 'UNAVAILABLE'; detail: string; }
export interface SetupValidation { run: number; status: ValidationStatus; checks: SetupCheck[]; }

async function sha256(value: string): Promise<string> {
  if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.subtle === 'undefined') throw new Error('identity digest unavailable');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function byId<T extends { id: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

// The digest stays in setup-session memory only. Provider endpoints are hashed
// separately so a URL query/userinfo value is never copied into the snapshot.
export async function setupOperationalIdentityFingerprint(
  access: ModelManagerResponseT,
  byok: ByokStatusResponseT
): Promise<string> {
  const providerEndpoints = await Promise.all(byok.providers.map(provider => sha256(provider.base_url)));
  const identity = {
    runtime: access.runtime,
    models: access.models.map(model => ({
      identity: model.identity,
      artifact_ids: [...model.artifact_ids].sort(),
      availability: model.availability,
      compatibility: model.compatibility,
      readiness: model.readiness,
      recommended_roles: [...model.recommended_roles].sort(),
      execution_selected_roles: [...model.execution_selected_roles].sort()
    })).sort((left, right) => left.identity.canonical_id.localeCompare(right.identity.canonical_id)),
    artifacts: byId(access.artifacts),
    routes: access.routes.map(route => ({ ...route, selected_roles: [...route.selected_roles].sort() })).sort((left, right) => left.id.localeCompare(right.id)),
    credential_sources: byId(access.credential_sources),
    execution_adapters: byId(access.execution_adapters),
    connections: {
      preference: access.connections.preference,
      routed_roles: access.connections.routed_roles,
      connections: access.connections.connections.map(connection => ({
        id: connection.id,
        provider_id: connection.provider_id,
        kind: connection.kind,
        status: connection.status,
        capabilities: [...connection.capabilities].sort(),
        routing_available: connection.routing_available,
        access: {
          authentication_mode: connection.access.authentication_mode,
          authentication_configured: connection.access.authentication_configured,
          credential_source: connection.access.credential_source,
          health: connection.access.health,
          execution_adapters: [...connection.access.execution_adapters].sort(),
          model_refs: [...connection.access.model_refs].sort((left, right) => `${left.model_id}:${left.provider_model_id}`.localeCompare(`${right.model_id}:${right.provider_model_id}`)),
          external_egress_required: connection.access.external_egress_required,
          operator_setup_required: connection.access.operator_setup_required,
          setup_state: connection.access.setup_state
        }
      })).sort((left, right) => left.id.localeCompare(right.id))
    },
    providers: byok.providers.map((provider, index) => ({
      id: provider.id,
      api_type: provider.api_type,
      model_id: provider.model_id,
      endpoint_sha256: providerEndpoints[index],
      max_input_tokens: provider.max_input_tokens ?? null,
      tool_calling: provider.tool_calling,
      key_stored: provider.key_stored
    })).sort((left, right) => left.id.localeCompare(right.id)),
    provider_routing: byok.routing,
    provider_consent: byok.consent_enabled
  };
  return sha256(JSON.stringify(identity));
}

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
