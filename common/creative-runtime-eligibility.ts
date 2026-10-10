import {
  CreationStudioShot,
  type CreationStudioShotT
} from './contracts/creation-studio.ts';
import {
  CreativeRuntimeEligibility,
  CreativeRuntimeEvidence,
  CreativeRuntimeRequirement,
  type CreativeRuntimeBlockerT,
  type CreativeRuntimeEligibilityStateT,
  type CreativeRuntimeEligibilityT,
  type CreativeRuntimeEvidenceT,
  type CreativeRuntimeRequirementT
} from './contracts/creative-runtime.ts';

export function buildCreativeRuntimeRequirement(input: CreationStudioShotT): CreativeRuntimeRequirementT {
  const shot = CreationStudioShot.parse(input);
  const video = shot.assignments.find(assignment => assignment.capability === 'VIDEO') ?? null;
  return CreativeRuntimeRequirement.parse({
    schema: 'covert.creation-studio.runtime-requirement.v1',
    shot_id: shot.shot_id,
    required_capability: 'VIDEO_I2V',
    execution_class: 'LOCAL',
    adapter: 'COMFYUI',
    requested_model_id: video?.model_id ?? null,
    assignment_state: video?.state ?? 'UNASSIGNED'
  });
}

function deriveBlockers(
  requirement: CreativeRuntimeRequirementT,
  evidence: CreativeRuntimeEvidenceT
): CreativeRuntimeBlockerT[] {
  const blockers: CreativeRuntimeBlockerT[] = [];

  if (!evidence.runtime.installed) blockers.push('RUNTIME_NOT_INSTALLED');
  else if (!evidence.runtime.ready) blockers.push('RUNTIME_NOT_READY');

  if (requirement.assignment_state === 'UNAVAILABLE') blockers.push('MODEL_ASSIGNMENT_UNAVAILABLE');
  if (requirement.requested_model_id === null || requirement.assignment_state === 'UNASSIGNED') {
    blockers.push('MODEL_NOT_SELECTED');
  } else if (evidence.model.model_id !== requirement.requested_model_id) {
    blockers.push('MODEL_IDENTITY_MISMATCH');
  } else if (!evidence.model.available) {
    blockers.push('MODEL_NOT_AVAILABLE');
  }

  if (evidence.hardware.eligible === null) blockers.push('HARDWARE_ELIGIBILITY_UNKNOWN');
  else if (!evidence.hardware.eligible) blockers.push('HARDWARE_BLOCKED');

  if (!evidence.execution.connected) blockers.push('EXECUTION_NOT_CONNECTED');

  if (evidence.execution.admission_decision === null) blockers.push('ADMISSION_NOT_EVALUATED');
  else if (evidence.execution.admission_decision === 'QUEUE') blockers.push('ADMISSION_QUEUED');
  else if (evidence.execution.admission_decision === 'REFUSE_RESOURCE') blockers.push('RESOURCE_ADMISSION_REFUSED');

  return blockers;
}

function primaryState(blockers: readonly CreativeRuntimeBlockerT[]): CreativeRuntimeEligibilityStateT {
  if (blockers.includes('RUNTIME_NOT_INSTALLED')) return 'RUNTIME_NOT_INSTALLED';
  if (blockers.includes('RUNTIME_NOT_READY')) return 'LOCAL_RENDER_UNAVAILABLE';
  if (blockers.includes('MODEL_NOT_SELECTED') ||
      blockers.includes('MODEL_ASSIGNMENT_UNAVAILABLE') ||
      blockers.includes('MODEL_IDENTITY_MISMATCH') ||
      blockers.includes('MODEL_NOT_AVAILABLE')) return 'MODEL_NOT_AVAILABLE';
  if (blockers.includes('HARDWARE_BLOCKED') ||
      blockers.includes('RESOURCE_ADMISSION_REFUSED')) return 'HARDWARE_BLOCKED';
  if (blockers.length > 0) return 'GATED';
  return 'READY';
}

export function evaluateCreativeRuntimeEligibility(
  requirementInput: CreativeRuntimeRequirementT,
  evidenceInput: CreativeRuntimeEvidenceT
): CreativeRuntimeEligibilityT {
  const requirement = CreativeRuntimeRequirement.parse(requirementInput);
  const evidence = CreativeRuntimeEvidence.parse(evidenceInput);
  const blockers = deriveBlockers(requirement, evidence);

  return CreativeRuntimeEligibility.parse({
    schema: 'covert.creation-studio.runtime-eligibility.v1',
    requirement,
    state: primaryState(blockers),
    blockers,
    execution_attempted: false,
    cloud_fallback: false
  });
}
