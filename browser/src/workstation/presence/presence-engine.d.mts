import type { ProjectBinding } from '../interactions/drop-intent.mjs';
export type CompanionFamily = 'scout' | 'rook' | 'mutt' | 'tinker';
export type MediaFact = 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
export type TaskFact = 'NONE' | 'RUNNING' | 'QUEUED' | 'WAITING_FOR_OPERATOR' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export interface OwnerFact { project: ProjectBinding | null; observedAt: number }
export interface PresenceFacts {
  resident?: OwnerFact & { residentId: string; binding: 'BOUND' | 'UNBOUND'; availability: 'AVAILABLE' | 'UNAVAILABLE' };
  task?: OwnerFact & { state: TaskFact; taskId?: string | null };
  media?: OwnerFact & { capture: MediaFact; output: MediaFact; remote: MediaFact };
  attention?: OwnerFact & { state: 'NONE' | 'WARNING' | 'UNKNOWN' };
}
export interface PresenceProjection {
  readonly resident: Readonly<{ id: string | null; binding: 'BOUND' | 'UNBOUND' | 'UNKNOWN'; availability: 'AVAILABLE' | 'UNAVAILABLE' | 'UNKNOWN' }>;
  readonly task: Readonly<{ state: TaskFact | 'UNKNOWN'; taskId: string | null }>;
  readonly capture: MediaFact; readonly output: MediaFact; readonly remote: MediaFact;
  readonly attention: 'NONE' | 'WARNING' | 'UNKNOWN';
  readonly status: 'UNKNOWN' | 'UNBOUND' | 'OFFLINE' | 'WARNING' | 'WAITING_FOR_OPERATOR' | 'WORKING' | 'LISTENING' | 'SPEAKING' | 'PROCESSING' | 'QUEUED' | 'IDLE';
}
export interface PresenceFrame extends PresenceProjection {
  readonly family: CompanionFamily; readonly personalityRef: string; readonly voiceRef: string | null;
  readonly visible: boolean; readonly motion: 'STATIC'; readonly reducedMotion: boolean; readonly assetStatus: 'UNQUALIFIED'; readonly pose: string;
}
export const COMPANION_FAMILIES: Readonly<Record<CompanionFamily, Readonly<{ title: string; idlePose: string; attentivePose: string; assetStatus: 'UNQUALIFIED' }>>>;
export function projectPresence(options: { binding: ProjectBinding | null; facts: PresenceFacts; now: number; freshForMs?: number }): PresenceProjection;
export function createPresenceEngine(options: {
  binding: ProjectBinding | null; render(frame: PresenceFrame): void;
  clock?(): number; schedule?(callback: () => void, delayMs: number): unknown; cancel?(handle: unknown): void;
  family?: CompanionFamily; reducedMotion?: boolean; freshForMs?: number;
}): Readonly<{ update(facts: PresenceFacts): void;
  setPresentation(value: { family?: CompanionFamily; personalityRef?: string; voiceRef?: string | null; reducedMotion?: boolean }): void;
  setVisible(visible: boolean): void; dispose(): void;
}>;
