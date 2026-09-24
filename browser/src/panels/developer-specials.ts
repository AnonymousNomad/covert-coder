import type { ModelManagerDeveloperSpecialT } from '../../../common/contracts/model-manager.ts';

export const DEVELOPER_SPECIALS = [
  {
    kind: 'developer-special', source: 'DEVELOPER_SPECIALS — James Ferrell', id: 'high-volume', name: 'High-volume engineering workflow', category: 'HIGH_VOLUME_ENGINEERING',
    purpose: 'Move substantial engineering work through focused responsibilities without creating unnecessary agents.',
    roles: ['PLANNER', 'IMPLEMENTER', 'REVIEWER'], model_ids: [], providers: [], placement: 'UNSPECIFIED', artifact: null,
    summary: 'Separate planning, implementation, and independent review only when the work benefits from distinct responsibilities.',
    why_used: 'Clear role boundaries can reduce repeated context reconstruction on sustained work.',
    cost_notes: 'Exact provider and cost profile are not configured; this recipe makes no price claim.',
    context_notes: 'Pass the bounded task, verified state, unresolved obligations, and acceptance criteria between roles.',
    known_limitations: ['Model membership is not yet tied to accepted qualification evidence.'], last_reviewed: '2026-09-24'
  },
  {
    kind: 'developer-special', source: 'DEVELOPER_SPECIALS — James Ferrell', id: 'low-cost', name: 'Low-cost development workflow', category: 'LOW_COST_DEVELOPMENT',
    purpose: 'Use role evidence and task difficulty to decide when to stay with a lower-cost option or escalate.',
    roles: ['IMPLEMENTER', 'REVIEWER'], model_ids: [], providers: [], placement: 'UNSPECIFIED', artifact: null,
    summary: 'Start with the least expensive available intelligence that has evidence for the required role; escalate only when the task or evidence calls for it.',
    why_used: 'Provider price alone does not establish that more expensive intelligence is necessary for a given role.',
    cost_notes: 'Actual charges are determined by the selected provider and account.',
    context_notes: 'Keep the acceptance contract fixed when changing models.',
    known_limitations: ['No cost measurements are attached to this recipe yet.'], last_reviewed: '2026-09-24'
  },
  {
    kind: 'developer-special', source: 'DEVELOPER_SPECIALS — James Ferrell', id: 'local-first', name: 'Local-first workflow', category: 'LOCAL_FIRST',
    purpose: 'Prefer local execution when the required artifact, runtime, resource estimate, and role evidence are suitable.',
    roles: ['IMPLEMENTER', 'UTILITY'], model_ids: [], providers: [], placement: 'LOCAL', artifact: null,
    summary: 'Prefer an available local model when its resource fit and role evidence satisfy the task.',
    why_used: 'Local execution can keep eligible work available without a provider connection.',
    cost_notes: 'No provider usage charge is implied; device electricity and hardware costs are outside this estimate.',
    context_notes: 'Confirm the local model/runtime state before starting; the Model Manager estimate is not Resource Admission.',
    known_limitations: ['Local qualification and runtime availability vary by artifact and machine.'], last_reviewed: '2026-09-24'
  },
  {
    kind: 'developer-special', source: 'DEVELOPER_SPECIALS — James Ferrell', id: 'planning', name: 'Planning when justified', category: 'PLANNING',
    purpose: 'Introduce a distinct planning role only when it helps satisfy complex or multi-stage obligations.',
    roles: ['PLANNER'], model_ids: [], providers: [], placement: 'UNSPECIFIED', artifact: null,
    summary: 'Use a planning role when task complexity warrants a separate plan; do not add a planner to every small change.',
    why_used: 'A separate plan can help surface dependencies before mutations begin on complex work.',
    cost_notes: 'An extra model call may add latency or provider cost.',
    context_notes: 'The plan remains subordinate to the task acceptance contract and Authority.',
    known_limitations: ['No evidence supports enabling this for every task.'], last_reviewed: '2026-09-24'
  },
  {
    kind: 'developer-special', source: 'DEVELOPER_SPECIALS — James Ferrell', id: 'independent-review', name: 'Independent review workflow', category: 'INDEPENDENT_REVIEW',
    purpose: 'Use an independent reviewer when change risk or acceptance obligations justify it.',
    roles: ['REVIEWER'], model_ids: [], providers: [], placement: 'UNSPECIFIED', artifact: null,
    summary: 'Use a distinct reviewer when the change risk or acceptance contract justifies another pass.',
    why_used: 'A separate pass can identify defects the implementer did not notice.',
    cost_notes: 'Review consumes additional time and possibly provider usage.',
    context_notes: 'Give the reviewer the diff, requirements, evidence, and unresolved questions—not an unsupported completion claim.',
    known_limitations: ['Review is not a substitute for deterministic tests or Veritas.'], last_reviewed: '2026-09-24'
  },
  {
    kind: 'developer-special', source: 'DEVELOPER_SPECIALS — James Ferrell', id: 'offline', name: 'Offline work workflow', category: 'OFFLINE_WORK',
    purpose: 'Constrain available intelligence to installed local models and avoid provider egress.',
    roles: ['IMPLEMENTER', 'REVIEWER', 'UTILITY'], model_ids: [], providers: [], placement: 'LOCAL', artifact: null,
    summary: 'Constrain the candidate set to installed local intelligence and keep provider egress out of the workflow.',
    why_used: 'Offline work preserves operation when network access is unavailable or disallowed.',
    cost_notes: 'No cloud-provider usage charge; local resource costs still apply.',
    context_notes: 'Verify required artifacts and runtime are present before disconnecting.',
    known_limitations: ['Only models already installed and compatible with the current runtime can be used.'], last_reviewed: '2026-09-24'
  }
] satisfies ModelManagerDeveloperSpecialT[];
