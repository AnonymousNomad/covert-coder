export interface WorktreePreflightInput {
  status: string;
  branch: string;
  head: string;
  expectedBranch?: string | undefined;
  expectedHead?: string | undefined;
}

export interface WorktreePreflightResult {
  ok: boolean;
  findings: string[];
}

export function evaluateWorktreePreflight(input: WorktreePreflightInput): WorktreePreflightResult;
