export declare const TAXONOMY: readonly string[];
export interface FailureEvidence {
  kind?: string;
  detail?: string;
  systemCausesExcluded?: boolean;
}
export interface FailureClassification {
  class: string;
  note: string;
  evidence: string;
}
export function classifyFailure(evidence?: FailureEvidence): FailureClassification;
