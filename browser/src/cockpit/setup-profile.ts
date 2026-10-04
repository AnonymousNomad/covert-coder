import { z } from 'zod';
import type { WorkbenchDetailResponseT } from '../../../common/contracts/workbench.ts';

export type SetupChoiceStatus = 'REQUESTED' | 'PLANNED' | 'APPLIED' | 'VERIFIED' | 'DEFERRED' | 'UNAVAILABLE' | 'FAILED';
export type SetupChoiceDisposition = { status: SetupChoiceStatus; detail: string };
export type SetupChoiceOverrides = Partial<Record<'workProfile' | 'providers', SetupChoiceDisposition>>;

export const SETUP_PROVIDER_OPTIONS = [
  'OpenAI / compatible',
  'Anthropic / Claude',
  'Hugging Face',
  'OpenCode Go (managed connection)',
  'Local only',
] as const;

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

export function setupWorkbenchDisposition(expectedId: string, detail: WorkbenchDetailResponseT | null): SetupChoiceDisposition {
  const workbench = detail?.workbench;
  if (workbench === undefined) return { status: 'UNAVAILABLE', detail: 'Canonical workbench state could not be read.' };
  if (workbench.id !== expectedId) return { status: 'FAILED', detail: 'Readback returned a different workbench identity; no profile is verified.' };
  if (!workbench.installed) return { status: 'PLANNED', detail: `${workbench.name} is not installed.` };
  if (!workbench.validated) return { status: 'FAILED', detail: `${workbench.name} is installed but its bundle validation has unresolved issues.` };
  const enabledPlugins = workbench.plugins.filter(plugin => plugin.enabled).length;
  const enabledSkills = workbench.skills.filter(skill => skill.enabled).length;
  const trustedServers = workbench.mcp_servers.filter(server => server.trusted).length;
  const dormant = !workbench.enabled && enabledPlugins === 0 && enabledSkills === 0 && trustedServers === 0;
  const detailText = dormant
    ? `${workbench.name} is installed and validated. Plugins/skills remain disabled and MCP servers untrusted until separately approved; no models were downloaded or started.`
    : `${workbench.name} is installed and validated. Existing state: bundle enabled=${workbench.enabled}, ${enabledPlugins} plugins enabled, ${enabledSkills} skills enabled, ${trustedServers} MCP servers trusted; onboarding did not change those settings.`;
  return { status: 'VERIFIED', detail: detailText };
}

export function setupChoiceDispositions(saved: boolean, overrides: SetupChoiceOverrides = {}) {
  const pending = saved ? 'PLANNED' as const : 'DEFERRED' as const;
  return [
    { choice: 'Primary / secondary work', ...(overrides.workProfile ?? { status: pending, detail: 'The role/workbench choice is recorded; applying its validated bundle is a separate Authority-approved action.' }) },
    { choice: 'Model preference', status: pending, detail: 'The preference and recommendations are recorded. They do not change model routing or egress consent.' },
    { choice: 'Providers', ...(overrides.providers ?? { status: pending, detail: 'Use the inline canonical provider/account controls. Key storage, authentication, model discovery and route availability remain separate evidence states.' }) },
    { choice: 'Project locations', status: 'DEFERRED' as const, detail: 'RECORDED / NOT YET ACTIVE — this runtime has no multi-root project registration operation; no entered path is probed, crawled or imported.' },
    { choice: 'Local model use / recommendation', status: pending, detail: 'Recommendations are advisory. No download, qualification, role assignment or runtime start is performed here.' },
    { choice: 'Approval strictness', status: 'DEFERRED' as const, detail: 'Authority policy is unchanged. Only the current strict approval policy is supported.' },
    { choice: 'Integrations', status: 'DEFERRED' as const, detail: 'Telegram setup remains in its canonical settings surface; GitHub means local Git operations only; Discord is unavailable.' },
    { choice: 'Recurring workflows', status: 'DEFERRED' as const, detail: 'RECORDED / NOT YET ACTIVE — free-form text is not converted into an automation or enabled skill, and the saved profile is not currently injected into Resident context.' },
  ];
}
