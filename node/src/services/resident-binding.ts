import {
  CANONICAL_RESIDENT_FAMILY,
  CANONICAL_RESIDENT_ID,
  RESIDENT_BINDING_SCHEMA,
  ResidentBinding,
  type ResidentBindingT
} from '../../../common/contracts/resident-binding.ts';

// Resident binding projection. It reads canonical inventory and runtime state
// and derives one binding verdict; it never writes and never holds state, so
// a UI reload cannot change the binding and a pinned worker model cannot
// masquerade as the Resident.

export interface ResidentCandidate {
  canonical_id: string;
  display_name: string;
  family: string | null;
  availability: 'UNAVAILABLE' | 'DISCOVERED' | 'AVAILABLE' | 'INSTALLED' | 'CONNECTED' | 'LOADABLE';
  artifact_available: boolean;
  runtime_ready: boolean;
}

export interface ResidentRuntimeObservation {
  runtime_state: 'RUNNING' | 'LOADABLE' | 'NOT_LOADABLE' | 'UNKNOWN';
  verified_at: string | null;
}

export interface ResidentBindingOptions {
  listCandidates: () => Promise<ResidentCandidate[]>;
  observeRuntime?: (modelId: string) => Promise<ResidentRuntimeObservation>;
  executionNode?: string;
}

export function isResidentCandidate(candidate: ResidentCandidate): boolean {
  const family = (candidate.family ?? '').toLowerCase();
  const id = candidate.canonical_id.toLowerCase();
  return family === CANONICAL_RESIDENT_FAMILY || family === 'lfm2' || id.includes('liquid');
}

export function deriveResidentBinding(
  candidates: ResidentCandidate[],
  runtime: ResidentRuntimeObservation | null,
  executionNode: string,
  now: string
): ResidentBindingT {
  const residents = candidates.filter(isResidentCandidate);
  if (residents.length === 0) {
    return ResidentBinding.parse({
      schema: RESIDENT_BINDING_SCHEMA,
      resident_id: CANONICAL_RESIDENT_ID,
      resident_model_id: null,
      resident_model_family: null,
      binding_state: 'UNBOUND',
      availability_state: 'UNAVAILABLE',
      runtime_state: 'UNKNOWN',
      execution_node: executionNode,
      degraded_reason: 'resident_model_not_registered',
      last_verified_at: now
    });
  }
  if (residents.length > 1) {
    return ResidentBinding.parse({
      schema: RESIDENT_BINDING_SCHEMA,
      resident_id: CANONICAL_RESIDENT_ID,
      resident_model_id: null,
      resident_model_family: CANONICAL_RESIDENT_FAMILY,
      binding_state: 'DEGRADED',
      availability_state: 'UNKNOWN',
      runtime_state: 'UNKNOWN',
      execution_node: executionNode,
      degraded_reason: 'multiple_resident_candidates',
      last_verified_at: now
    });
  }
  const candidate = residents[0]!;
  const runtimeState = runtime?.runtime_state ?? 'UNKNOWN';
  const available = candidate.artifact_available && candidate.availability !== 'UNAVAILABLE';
  let bindingState: ResidentBindingT['binding_state'] = 'BOUND';
  let degradedReason: ResidentBindingT['degraded_reason'] = null;
  if (!candidate.artifact_available) {
    bindingState = 'DEGRADED';
    degradedReason = 'resident_model_artifact_unavailable';
  } else if (runtimeState === 'NOT_LOADABLE') {
    bindingState = 'DEGRADED';
    degradedReason = 'resident_runtime_unavailable';
  } else if (runtimeState === 'UNKNOWN') {
    bindingState = 'DEGRADED';
    degradedReason = 'resident_runtime_unverified';
  }
  return ResidentBinding.parse({
    schema: RESIDENT_BINDING_SCHEMA,
    resident_id: CANONICAL_RESIDENT_ID,
    resident_model_id: candidate.canonical_id,
    resident_model_family: candidate.family,
    binding_state: bindingState,
    availability_state: available ? 'AVAILABLE' : 'UNAVAILABLE',
    runtime_state: runtimeState,
    execution_node: executionNode,
    degraded_reason: degradedReason,
    last_verified_at: runtime?.verified_at ?? now
  });
}

export function createResidentBinding(options: ResidentBindingOptions) {
  const executionNode = options.executionNode ?? 'local-windows';
  async function read(): Promise<ResidentBindingT> {
    const candidates = await options.listCandidates();
    const residents = candidates.filter(isResidentCandidate);
    let runtime: ResidentRuntimeObservation | null = null;
    if (residents.length === 1 && options.observeRuntime !== undefined) {
      runtime = await options.observeRuntime(residents[0]!.canonical_id).catch(() => null);
    }
    return deriveResidentBinding(candidates, runtime, executionNode, new Date().toISOString());
  }
  return { read };
}

export type ResidentBindingService = ReturnType<typeof createResidentBinding>;
