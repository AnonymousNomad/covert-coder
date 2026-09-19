export interface BatteryTask {
  id: string;
  class: string;
  executor: 'chat';
  prompt: string;
  max_tokens?: number;
  checks: Array<Record<string, unknown> & { type: string }>;
}

export interface BatteryFile {
  schema_version: string;
  suite_id: string;
  suite_version: string;
  tasks: BatteryTask[];
}

export interface BatteryCheckResult {
  name: string;
  type: string;
  passed: boolean;
  detail: string;
}

export interface BatteryEvaluation {
  task_id: string;
  task_class: string;
  passed: boolean;
  checks: BatteryCheckResult[];
  checks_passed: number;
  checks_failed: number;
  executed_commands: number;
  tests_passed: number;
  tests_failed: number;
  failure_class: 'no_completion' | 'verification_failed' | 'unresolved' | null;
}

export type BatteryRunNode = (entry: string, cwd: string, timeoutMs: number) => Promise<{ code: number; stdout: string; stderr: string }>;

export class BatteryDefinitionError extends Error {}

export const LAB_DIR: string;

export function loadBattery(options?: { file?: string }): Promise<BatteryFile>;
export function extractFenced(text: string, marker: string, language?: string | null): string | null;
export function evaluateTask(input: {
  task: BatteryTask;
  responseText: string;
  scratchDir: string;
  runNode?: BatteryRunNode;
  fixturesDir?: string;
}): Promise<BatteryEvaluation>;
