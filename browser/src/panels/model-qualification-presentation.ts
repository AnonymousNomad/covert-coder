import type { ModelManagerResponseT } from '../../../common/contracts/model-access.ts';

type ManagedModel = ModelManagerResponseT['models'][number];
type ManagedArtifact = ModelManagerResponseT['artifacts'][number];

export type ModelQualificationPresentation = {
  artifact_presence: string;
  integrity: 'ARTIFACT_VERIFIED' | 'INTEGRITY_NOT_VERIFIED' | 'INTEGRITY_FAILED' | 'NOT_APPLICABLE';
  model_invalid: 'MODEL INVALID' | null;
  qualification: string;
  qualification_evidence: string;
  preflight: 'NOT_EVALUATED' | 'PREFLIGHT_CLEAR' | 'QUALIFICATION_BLOCKED';
  reason_codes: string[];
  blockers: string[];
  explanation: string | null;
};

function blockerText(code: string): string {
  if (code === 'STORAGE_UNSAFE') return 'its storage device is unsafe to read';
  if (code === 'RESOURCE_FLOOR_NOT_MET') return 'available memory is below the runtime requirement';
  return 'qualification preflight blocked';
}

export function presentModelQualification(
  model: ManagedModel,
  artifacts: ManagedArtifact[]
): ModelQualificationPresentation {
  const modelArtifacts = artifacts.filter(artifact => model.artifact_ids.includes(artifact.id));
  const localArtifactPresent = modelArtifacts.some(artifact =>
    artifact.availability === 'DISCOVERED' || artifact.availability === 'INSTALLED'
  );
  const artifactPresence = localArtifactPresent ? 'ARTIFACT PRESENT'
    : modelArtifacts.length > 0 || model.availability === 'UNAVAILABLE' ? 'MODEL UNAVAILABLE'
      : 'NO LOCAL ARTIFACT';
  const hashStatuses = modelArtifacts.map(artifact => artifact.hash_status);
  const integrity = hashStatuses.includes('MISMATCH') ? 'INTEGRITY_FAILED'
    : hashStatuses.includes('VERIFIED') ? 'ARTIFACT_VERIFIED'
      : modelArtifacts.length > 0 ? 'INTEGRITY_NOT_VERIFIED' : 'NOT_APPLICABLE';
  const modelInvalid = hashStatuses.includes('MISMATCH') ? 'MODEL INVALID' : null;
  const blockers = model.qualification_gate.state === 'QUALIFICATION_BLOCKED'
    ? model.qualification_gate.reasons.map(blockerText)
    : [];
  const reasonCodes = model.qualification_gate.state === 'QUALIFICATION_BLOCKED'
    ? [...model.qualification_gate.reasons]
    : [];
  const qualification = model.qualification_gate.state === 'QUALIFICATION_BLOCKED'
    ? 'QUALIFICATION BLOCKED'
    : model.identity.qualification.state;
  const explanation = blockers.length === 0 ? null
    : localArtifactPresent
      ? 'The model artifact is present, but qualification cannot safely continue because ' + blockers.join(' and ') + '.'
      : 'Qualification cannot safely continue because ' + blockers.join(' and ') + '.';
  return {
    artifact_presence: artifactPresence,
    integrity,
    model_invalid: modelInvalid,
    qualification,
    qualification_evidence: model.identity.qualification.state,
    preflight: model.qualification_gate.state,
    reason_codes: reasonCodes,
    blockers,
    explanation
  };
}
