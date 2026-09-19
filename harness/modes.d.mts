export class ModeLookupError extends Error {
  readonly code: 'NOT_FOUND';
  constructor(modeId: string);
}

export class ModeConflictError extends Error {
  readonly code: 'CONFLICT';
  constructor(message: string);
}

export const MODE_DEFINITIONS: ReadonlyArray<import('../common/contracts/harness-modes.ts').HarnessModeDefinitionT>;

export function listModes(): import('../common/contracts/harness-modes.ts').HarnessModeDefinitionT[];
export function getMode(modeId: string): import('../common/contracts/harness-modes.ts').HarnessModeDefinitionT;
export function composeModes(input?: { primary: string; specializations?: string[] }): import('../common/contracts/harness-modes.ts').ComposedHarnessModeT;
export function composeModeDefinitions(definitions: unknown[]): import('../common/contracts/harness-modes.ts').ComposedHarnessModeT;
export function compositionNeverLoosens(input?: { primary: string; specializations?: string[] }):
  | { ok: true; composed: import('../common/contracts/harness-modes.ts').ComposedHarnessModeT }
  | { ok: false; reason: string };
