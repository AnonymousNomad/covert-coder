// Resident intent-readiness service (Wave 5). Deterministic, canonical-state
// first: the gate consults what Covert already knows, asks the minimum useful
// clarification, records safe assumptions, and NEVER executes anything.
// Clarification establishes intent; Execution Authority remains the only
// source of permission.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  type ResidentIntentRequestT,
  type ResidentIntentResponseT,
  type ReadinessStatusT,
  type ReadinessTaskClassT
} from '../../../common/contracts/resident-intent.ts';

export class ResidentIntentError extends Error {
  readonly code: 'INVALID' | 'NOT_FOUND';
  constructor(code: 'INVALID' | 'NOT_FOUND', message: string) {
    super(message);
    this.code = code;
  }
}

type PendingRecord = {
  readiness_id: string;
  task: string;
  status: ReadinessStatusT;
  task_class: ReadinessTaskClassT;
  answers: Record<string, string>;
  created_at: string;
  updated_at: string;
};

type WorkflowProjection = {
  load(): Promise<{ project_id?: string; stage?: string } | null>;
};

export interface ResidentIntentServiceOptions {
  workspace: string;
  workflowService?: WorkflowProjection | null;
  now?: () => string;
}

const MAX_QUESTIONS = 3;

export function createResidentIntentService(options: ResidentIntentServiceOptions) {
  const workspace = options.workspace;
  const workflowService = options.workflowService ?? null;
  const now = options.now ?? (() => new Date().toISOString());
  const dir = path.join(workspace, '.aide', 'resident-intents');

  function recordPath(id: string): string {
    return path.join(dir, `${id}.json`);
  }

  async function readRecord(id: string): Promise<PendingRecord> {
    try {
      return JSON.parse(await fs.readFile(recordPath(id), 'utf8')) as PendingRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ResidentIntentError('NOT_FOUND', `pending intent ${id} not found`);
      throw new ResidentIntentError('INVALID', 'pending intent storage read failed');
    }
  }

  async function writeRecord(record: PendingRecord): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    const target = recordPath(record.readiness_id);
    const temp = `${target}.tmp`;
    const handle = await fs.open(temp, 'w');
    try {
      await handle.writeFile(JSON.stringify(record, null, 2), 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(temp, target);
  }

  async function listPending(): Promise<PendingRecord[]> {
    const entries = await fs.readdir(dir).catch(() => [] as string[]);
    const records: PendingRecord[] = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      try {
        const record = await readRecord(entry.slice(0, -'.json'.length));
        if (record.status === 'NEEDS_CLARIFICATION') records.push(record);
      } catch {
        // Corrupt pending records are ignored here; direct lookups report them.
      }
    }
    records.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    return records;
  }

  function readAutonomy(): 'supervised' | 'bounded' {
    return 'supervised';
  }

  async function readAutonomyFromPolicy(): Promise<'supervised' | 'bounded'> {
    try {
      const policy = JSON.parse(await fs.readFile(path.join(workspace, '.aide', 'resident-policy.json'), 'utf8')) as { autonomy?: string };
      return policy.autonomy === 'bounded' ? 'bounded' : 'supervised';
    } catch {
      return readAutonomy();
    }
  }

  type WorkspaceFacts = {
    hasManifest: boolean;
    hasTestScript: boolean;
    hasGit: boolean;
    manifestName: string | null;
  };

  async function readWorkspaceFacts(): Promise<WorkspaceFacts> {
    let manifestName: string | null = null;
    let hasTestScript = false;
    let hasManifest = false;
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(workspace, 'package.json'), 'utf8')) as { name?: string; scripts?: Record<string, string> };
      hasManifest = true;
      manifestName = typeof manifest.name === 'string' ? manifest.name : null;
      hasTestScript = typeof manifest.scripts?.test === 'string';
    } catch {
      hasManifest = false;
    }
    const hasGit = await fs.access(path.join(workspace, '.git')).then(() => true).catch(() => false);
    return { hasManifest, hasTestScript, hasGit, manifestName };
  }

  type Detection = {
    taskClass: ReadinessTaskClassT;
    destructive: boolean;
    destructiveSpecific: boolean;
    buildAppNoPlatform: boolean;
    pageNoStack: boolean;
    pronounOnly: boolean;
    unsupported: boolean;
    unsupportedReason: string | null;
  };

  function detect(task: string): Detection {
    const text = task.toLowerCase();
    const tokens = text.split(/[^a-z0-9._/-]+/).filter(Boolean);
    const destructive = /\b(delete|remove|drop|wipe|clean)\b/.test(text) && !/\bclean up the code\b/.test(text);
    const destructiveSpecific = /(staging|production|prod|development|dev|"|'|\/|\.[a-z]{2,4}\b)/.test(text);
    const platformMention = /\b(web|desktop|android|ios|mobile|api|service|cli|server)\b/.test(text);
    const buildAppNoPlatform = /\b(build|create|make)\b/.test(text) && /\b(app|application)\b/.test(text) && !platformMention;
    const pageNoStack = /\b(landing page|website|web page|webpage)\b/.test(text) && !/\b(html|react|vue|svelte|next|astro)\b/.test(text);
    const pronounOnly = tokens.length <= 5
      && /\b(it|this|that|them|those)\b/.test(text)
      && !/[\\/]/.test(task)
      && !/\.[a-z]{2,4}\b/.test(text)
      && tokens.length >= 1
      && !/\b(test|tests|review|docs?|refactor)\b/.test(text)
      && !buildAppNoPlatform && !destructive;
    const unsupported = /\b(publish|deploy|ship)\b/.test(text) && /\b(app store|play store|kubernetes|k8s|cloud|production)\b/.test(text);
    let taskClass: ReadinessTaskClassT = 'software-engineering';
    if (destructive) taskClass = 'destructive-targeted';
    else if (unsupported) taskClass = 'deployment';
    else if (buildAppNoPlatform || pageNoStack) taskClass = 'build-app';
    else if (/\b(test|tests|spec|specs)\b/.test(text)) taskClass = 'testing';
    else if (/\b(fix|bug|broken|broke|error|crash|failing|debug)\b/.test(text)) taskClass = 'debugging';
    else if (/\breview\b/.test(text)) taskClass = 'review';
    else if (/\brefactor|restructure\b/.test(text)) taskClass = 'refactoring';
    else if (/\b(docs?|readme|document)\b/.test(text)) taskClass = 'documentation';
    else if (/\b(research|investigate|compare)\b/.test(text)) taskClass = 'research';
    return { taskClass, destructive, destructiveSpecific, buildAppNoPlatform, pageNoStack, pronounOnly, unsupported, unsupportedReason: unsupported ? 'no deployment or store-publishing workflow is registered in this product' : null };
  }

  function evaluate(task: string, answers: Record<string, string>, autonomy: 'supervised' | 'bounded', facts: WorkspaceFacts, workflow: { project_id?: string; stage?: string } | null): Omit<ResidentIntentResponseT, 'readiness_id' | 'created_at' | 'updated_at' | 'resolution'> {
    const detection = detect(task);
    const known: string[] = [];
    const missing: string[] = [];
    const safe: string[] = [];
    const unsafe: string[] = [];
    const questions: Array<{ id: string; question: string; options: string[] }> = [];

    known.push(`active workspace: ${path.basename(workspace)}`);
    if (workflow && typeof workflow.project_id === 'string') known.push(`project: ${workflow.project_id}`);
    if (facts.hasManifest) known.push('project manifest present');
    if (facts.hasGit) known.push('git repository present');

    if (detection.unsupported) {
      return {
        status: 'BLOCKED',
        task,
        task_class: detection.taskClass,
        known_requirements: known,
        missing_requirements: [`supported workflow: ${detection.unsupportedReason ?? 'unavailable'}`],
        safe_assumptions: safe,
        unsafe_assumptions: unsafe,
        clarification_questions: [],
        workflow_hint: { project_id: workflow?.project_id ?? null, stage: workflow?.stage ?? null },
        risk_class: 'medium',
        authority_relevance: 'Blocked requests never reach Execution Authority; nothing is executed.',
        autonomy
      };
    }

    if (detection.buildAppNoPlatform && answers.platform === undefined) {
      missing.push('target platform');
      questions.push({ id: 'platform', question: 'What platform is this intended for: web, desktop, Android, or iOS?', options: ['web', 'desktop', 'Android', 'iOS'] });
    }
    if (detection.pageNoStack && answers.implementation === undefined) {
      if (autonomy === 'bounded') {
        unsafe.push('implementation: static HTML (reversible default recorded under bounded autonomy)');
        safe.push('implementation recorded: static HTML');
      } else {
        missing.push('implementation choice');
        questions.push({ id: 'implementation', question: 'Which implementation should I use for the page?', options: ['static HTML', 'React', 'Vue', 'Svelte'] });
      }
    }
    if (detection.destructive && !detection.destructiveSpecific && answers.target === undefined) {
      missing.push('destruction target / environment');
      questions.push({ id: 'target', question: 'Which target or environment should this affect, and is it reversible?', options: [] });
    }
    if (detection.pronounOnly && answers.target === undefined) {
      missing.push('task target');
      questions.push({ id: 'target', question: 'What should I work on, specifically?', options: [] });
    }

    // Non-material, canonical defaults are recorded, never asked.
    safe.push('worker mode: act (governed approvals still required)');
    if (detection.taskClass === 'testing') {
      if (facts.hasTestScript) safe.push(`test runner: canonical project test script`);
      else known.push('no project test script detected');
    }
    safe.push('workers: local-first unless provider egress consent is enabled');

    const risk: 'low' | 'medium' | 'high' = detection.destructive ? 'high'
      : detection.unsupported ? 'medium'
        : (detection.buildAppNoPlatform || detection.pageNoStack) ? 'medium' : 'low';

    const status: ReadinessStatusT = questions.length === 0 ? 'READY' : 'NEEDS_CLARIFICATION';
    const authorityRelevance = detection.destructive
      ? 'Execution Authority still requires an approved exact operation for each destructive action; this clarification grants no permission.'
      : 'No authority implications from readiness; normal governed approvals apply to execution.';

    return {
      status,
      task,
      task_class: detection.taskClass,
      known_requirements: known.slice(0, 16),
      missing_requirements: missing.slice(0, 16),
      safe_assumptions: safe.slice(0, 16),
      unsafe_assumptions: unsafe.slice(0, 16),
      clarification_questions: questions.slice(0, MAX_QUESTIONS),
      workflow_hint: { project_id: workflow?.project_id ?? null, stage: workflow?.stage ?? null },
      risk_class: risk,
      authority_relevance: authorityRelevance,
      autonomy
    };
  }

  async function assess(request: ResidentIntentRequestT): Promise<ResidentIntentResponseT> {
    const autonomy = await readAutonomyFromPolicy();
    const facts = await readWorkspaceFacts();
    let workflow: { project_id?: string; stage?: string } | null = null;
    if (workflowService !== null) {
      try {
        workflow = await workflowService.load();
      } catch {
        workflow = null;
      }
    }

    let pending: PendingRecord | null = null;
    if (request.pending_id !== undefined) {
      pending = await readRecord(request.pending_id);
    } else if (request.task === undefined && request.answers !== undefined) {
      const pendings = await listPending();
      if (pendings.length === 0) throw new ResidentIntentError('NOT_FOUND', 'no pending clarification to answer');
      if (pendings.length > 1) {
        // Ambiguous reply binding: ask which task instead of guessing. Options
        // favor the MOST RECENT pendings (users reply to their latest); when
        // more exist than fit, the reply can still carry the pending id.
        const recent = [...pendings].reverse().slice(0, 4).map(record => record.readiness_id);
        return {
          readiness_id: randomUUID(),
          status: 'NEEDS_CLARIFICATION',
          task: 'clarification reply binding',
          task_class: 'unknown',
          known_requirements: [],
          missing_requirements: ['pending task identity'],
          safe_assumptions: [],
          unsafe_assumptions: [],
          clarification_questions: [{ id: 'disambiguate_task', question: 'Multiple tasks are waiting for clarification; which one is this reply for?', options: recent }],
          workflow_hint: { project_id: workflow?.project_id ?? null, stage: workflow?.stage ?? null },
          risk_class: 'low',
          authority_relevance: 'No execution occurred; reply binding only.',
          autonomy,
          resolution: 'ambiguous-pending',
          created_at: now(),
          updated_at: now()
        };
      }
      pending = pendings[0]!;
    }

    if (pending === null && request.task === undefined) {
      throw new ResidentIntentError('INVALID', 'provide a task or reply to a pending clarification');
    }

    const task = pending !== null ? pending.task : request.task!;
    const answers: Record<string, string> = { ...(pending?.answers ?? {}), ...((request.answers ?? {}) as Record<string, string>) };
    const evaluation = evaluate(task, answers, autonomy, facts, workflow);
    const createdAt = pending?.created_at ?? now();
    const updatedAt = now();
    const resolvedNow = pending !== null && pending.status === 'NEEDS_CLARIFICATION' && evaluation.status === 'READY';
    const record: PendingRecord = {
      readiness_id: pending?.readiness_id ?? randomUUID(),
      task,
      status: evaluation.status,
      task_class: evaluation.task_class,
      answers,
      created_at: createdAt,
      updated_at: updatedAt
    };
    await writeRecord(record);
    return {
      readiness_id: record.readiness_id,
      ...evaluation,
      resolution: evaluation.status === 'BLOCKED' ? 'unsupported' : resolvedNow ? 'answered' : 'none',
      created_at: createdAt,
      updated_at: updatedAt
    };
  }

  return Object.freeze({ assess, listPending });
}
