import { z } from 'zod';

export const SetupAnswers = z.strictObject({
  workType: z.string().min(1).max(120), secondaryWork: z.string().min(1).max(120),
  mode: z.enum(['LOCAL_FIRST', 'HYBRID', 'CLOUD']),
  providers: z.array(z.string().min(1).max(120)).max(20),
  projectLocations: z.string().max(2000), localModelUse: z.string().max(120),
  approvalStrictness: z.string().max(120), integrations: z.array(z.string().max(120)).max(20),
  importantWorkflows: z.string().max(2000),
});
export type Answers = z.infer<typeof SetupAnswers>;
export const SetupProfile = z.strictObject({
  version: z.literal(2), answers: SetupAnswers, planName: z.string().max(250),
  selectedModelId: z.string().max(240).nullable(),
  stage: z.number().int().min(0).max(11), completedAt: z.string().datetime().nullable(),
});
export type SetupProfileT = z.infer<typeof SetupProfile>;

export function parseSetupProfile(content: string): SetupProfileT | null {
  try {
    const raw: unknown = JSON.parse(content);
    const current = SetupProfile.safeParse(raw);
    if (current.success) return current.data;
    const legacy = SetupProfile.omit({ stage: true }).extend({ version: z.literal(1) }).safeParse(raw);
    if (legacy.success) return { ...legacy.data, version: 2, stage: 10 };
  } catch { /* Unreadable preferences never establish readiness. */ }
  return null;
}

export function setupPreferenceSignature(answers: Answers, selectedModelId: string | null): string {
  return JSON.stringify({ answers, selectedModelId });
}

export function setupChoiceDispositions(saved: boolean) {
  const status = saved ? 'SAVED AS PREFERENCE' : 'DEFERRED';
  return [
    { choice: 'Primary / secondary work', status, detail: 'Used to recommend a role/workbench; no workbench installation is performed.' },
    { choice: 'Model preference', status, detail: 'Does not change routing or egress consent. Configure Model Access separately.' },
    { choice: 'Providers', status, detail: 'No account connection or authentication is performed.' },
    { choice: 'Project locations', status, detail: 'No repository or context is imported.' },
    { choice: 'Local model use / recommendation', status, detail: 'No download, qualification, role assignment or runtime start is performed.' },
    { choice: 'Approval strictness', status, detail: 'Does not change Authority policy; planned modes remain deferred.' },
    { choice: 'Integrations', status, detail: 'No integration is connected. Discord remains deferred.' },
    { choice: 'Recurring workflows', status, detail: 'Does not create or enable a workflow or skill.' },
  ];
}
