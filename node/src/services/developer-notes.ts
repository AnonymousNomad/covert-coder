// node/src/services/developer-notes.ts
// DEVELOPER NOTES — James Ferrell. A distinct content source. NEVER rendered as
// a System Advisory, never as qualification evidence. Deterministic triggers
// with dismissal/session suppression (no nagging).
export const NOTE_CATEGORIES = ['CONTEXT', 'MODELS', 'COST', 'LOCAL_AI', 'WORKFLOW', 'VERIFICATION', 'DEBUGGING'] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export interface DeveloperNote {
  kind: 'developer-note';
  source: 'DEVELOPER_NOTES — James Ferrell';
  note_id: string;
  title: string;
  body: string;
  category: NoteCategory;
  trigger: string | null;
  priority: number;
  dismissible: true;
  active: true;
}

export const SEED_NOTES: DeveloperNote[] = [
  {
    kind: 'developer-note', source: 'DEVELOPER_NOTES — James Ferrell', note_id: 'dn-context-checkpoint',
    title: 'Checkpoint instead of stuffing context', category: 'CONTEXT', trigger: 'context_pressure', priority: 1, dismissible: true, active: true,
    body: 'When a session becomes overloaded, checkpoint verified project state instead of continually stuffing more historical conversation into context.'
  },
  {
    kind: 'developer-note', source: 'DEVELOPER_NOTES — James Ferrell', note_id: 'dn-cost-least',
    title: 'Least expensive model that passes', category: 'COST', trigger: 'expensive_model_for_routine_task', priority: 2, dismissible: true, active: true,
    body: 'Use the least expensive model that reliably passes the task. Expensive models should not be assumed necessary before verification demonstrates that need.'
  },
  {
    kind: 'developer-note', source: 'DEVELOPER_NOTES — James Ferrell', note_id: 'dn-workflow-separation',
    title: 'Separate planning, implementation, review', category: 'WORKFLOW', trigger: null, priority: 3, dismissible: true, active: true,
    body: 'Separating planning, implementation, and independent review can be more reliable than asking one model to own every responsibility.'
  },
  {
    kind: 'developer-note', source: 'DEVELOPER_NOTES — James Ferrell', note_id: 'dn-local-quant',
    title: 'Smallest quant is not automatically best', category: 'LOCAL_AI', trigger: 'resource_pressure', priority: 2, dismissible: true, active: true,
    body: 'The smallest quant that loads is not automatically the best quant for the job. Preserve enough model capability for the role.'
  },
  {
    kind: 'developer-note', source: 'DEVELOPER_NOTES — James Ferrell', note_id: 'dn-verification-not-claims',
    title: 'Completion reports are not verification', category: 'VERIFICATION', trigger: 'unverified_selection', priority: 1, dismissible: true, active: true,
    body: 'Model-reported completion is not verification. Wait for canonical evidence before treating work as done.'
  },
  {
    kind: 'developer-note', source: 'DEVELOPER_NOTES — James Ferrell', note_id: 'dn-unqualified-selection',
    title: 'Qualification is role-specific', category: 'MODELS', trigger: 'unqualified_model_selected', priority: 2, dismissible: true, active: true,
    body: 'A model installed on this machine has not earned any role yet. Check the qualification state for the role you are about to use.'
  }
];

export interface NoteSignals {
  context_pressure?: boolean;
  expensive_model_for_routine_task?: boolean;
  resource_pressure?: boolean;
  unqualified_model_selected?: boolean;
  unverified_selection?: boolean;
}

export function notesForSignals(signals: NoteSignals, state: { dismissed: Set<string> }): DeveloperNote[] {
  return SEED_NOTES.filter(note => {
    if (!note.active) return false;
    if (state.dismissed.has(note.note_id)) return false;
    if (note.trigger === null) return false; // non-triggered notes appear only in the notes panel, not contextually
    return Boolean(signals[note.trigger as keyof NoteSignals]);
  });
}
