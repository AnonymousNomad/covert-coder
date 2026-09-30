export const MODEL_ACCESS_CHANGED_EVENT = 'covert:model-access-changed';

export function announceModelAccessChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MODEL_ACCESS_CHANGED_EVENT));
}
