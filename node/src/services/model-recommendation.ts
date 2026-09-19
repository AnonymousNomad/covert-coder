import {
  type ModelPassportT,
  type RecommendationRequestT,
  type RecommendationResponseT,
  type RecommendationCandidateT
} from '../../../common/contracts/performance.ts';

// Read-only evidence recommendation. Answers "which models have evidence for
// this kind of task" from PASSports only — it never routes production
// workloads, never tunes parameters, and never labels a model "best". When no
// passport clears the requested evidence bar, the candidate list is empty and
// the notes say so.
export function recommendModels(input: { request: RecommendationRequestT; passports: ModelPassportT[]; generatedAt?: string }): RecommendationResponseT {
  const { request, passports } = input;
  const notes: string[] = [
    'read-only evidence surface: production routing is unchanged and no model is ranked as universally best'
  ];
  const candidates: RecommendationCandidateT[] = [];

  for (const passport of passports) {
    const taskObservation = passport.by_task_class.find(observation => observation.task_class === request.task_class) ?? null;
    const taskSampleSize = taskObservation?.sample_size ?? 0;
    const reasons: string[] = [];
    let qualified = true;

    if (passport.evidence_class === 'QUALIFICATION_FAILED') {
      qualified = false;
      reasons.push(`qualification failed (${passport.qualification.failure_class ?? 'unknown'}): configuration excluded from qualified candidates`);
    }
    if (request.local_only && passport.identity.provider !== 'local') {
      qualified = false;
      reasons.push(`provider ${passport.identity.provider} is not local`);
    }
    if (passport.evidence.sample_size < request.min_samples) {
      qualified = false;
      reasons.push(`sample size ${passport.evidence.sample_size} < required ${request.min_samples}`);
    }
    if (taskObservation === null) {
      qualified = false;
      reasons.push(`no observed evidence for task class "${request.task_class}"`);
    }
    if (request.evidence_threshold === 'observed' && passport.evidence.sample_size < 1) {
      qualified = false;
      reasons.push('threshold "observed" requires at least one event');
    }
    if (request.evidence_threshold === 'moderate' && !(passport.evidence.sample_size >= 3 && (passport.evidence.evidence_confidence === 'MODERATE' || passport.evidence.evidence_confidence === 'HIGH'))) {
      qualified = false;
      reasons.push('threshold "moderate" requires at least three events');
    }
    if (request.mode_id !== null && !passport.evidence.mode_ids.includes(request.mode_id)) {
      qualified = false;
      reasons.push(`no evidence recorded under mode "${request.mode_id}"`);
    }
    if (qualified) reasons.push(`observed ${taskSampleSize} ${request.task_class} task(s); ${passport.evidence.evidence_confidence} confidence`);

    candidates.push({
      model_id: passport.identity.model_id,
      performance_identity: passport.performance_identity,
      qualified,
      sample_size: passport.evidence.sample_size,
      completion_rate: passport.outcome.completion_rate,
      median_duration_ms: passport.execution.median_duration_ms,
      evidence_confidence: passport.evidence.evidence_confidence,
      reason: reasons.join('; ')
    });
  }

  candidates.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    if (b.sample_size !== a.sample_size) return b.sample_size - a.sample_size;
    const completionDelta = (b.completion_rate ?? -1) - (a.completion_rate ?? -1);
    if (completionDelta !== 0) return completionDelta;
    return (a.median_duration_ms ?? Number.MAX_SAFE_INTEGER) - (b.median_duration_ms ?? Number.MAX_SAFE_INTEGER);
  });

  const qualifiedCount = candidates.filter(candidate => candidate.qualified).length;
  if (passports.length === 0) notes.push('no passports exist yet: run the Harness Lab battery to collect evidence');
  else if (qualifiedCount === 0) notes.push('INSUFFICIENT DATA: no model clears the requested evidence threshold');

  return {
    generated_at: input.generatedAt ?? new Date().toISOString(),
    task_class: request.task_class,
    mode_id: request.mode_id,
    candidates,
    notes
  };
}
