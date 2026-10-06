export const CIPHER_MODES = ['ask', 'plan', 'act'] as const;

export type CipherMode = typeof CIPHER_MODES[number];

export const DEFAULT_CIPHER_MODE: CipherMode = 'ask';

export type CipherDispatch =
  | { path: 'chat'; mode: 'ask' }
  | { path: 'agent'; mode: 'plan'; role: 'planner' }
  | { path: 'agent'; mode: 'act'; role: 'coder' };

// This is a presentation-to-existing-service mapping only. It grants no
// execution authority and does not resolve a model; Model Access does that.
export function resolveCipherDispatch(mode: CipherMode): CipherDispatch {
  if (mode === 'ask') return { path: 'chat', mode: 'ask' };
  if (mode === 'plan') return { path: 'agent', mode: 'plan', role: 'planner' };
  return { path: 'agent', mode: 'act', role: 'coder' };
}
