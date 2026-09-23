// Sovereignty / egress manifest service. Classifies capabilities and projects
// the REAL egress journal (.aide/egress/journal.jsonl) through a strict
// whitelist: only ts/action/provider_id ever leave this module. Consent comes
// from the canonical BYOK consent switch; provider ids come from the real
// secret store (enrolled providers), never from a fabricated list.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { EgressCapabilityT, EgressManifestResponseT } from '../../../common/contracts/egress.ts';

export interface EgressManifestOptions {
  workspace: string;
  consentEnabled: () => boolean;
  providerIds: () => string[];
  now?: () => Date;
}

const DOCTRINE = 'Local by default. Connected by choice.';

export function createEgressManifest(options: EgressManifestOptions) {
  const journalPath = path.join(options.workspace, '.aide', 'egress', 'journal.jsonl');
  const now = options.now ?? (() => new Date());

  const capabilities = (): EgressCapabilityT[] => {
    const consent = options.consentEnabled() ? 'opted_in' : 'not_configured';
    const rows: EgressCapabilityT[] = [
      { id: 'local_model_runtime', classification: 'PACKAGED_LOCAL', detail: 'local llama.cpp engines serve bundled GGUF models; no network', egress_host: null, consent: 'local_only' },
      { id: 'workspace_index', classification: 'PACKAGED_LOCAL', detail: 'workspace indexing and hybrid search run in-process', egress_host: null, consent: 'local_only' },
      { id: 'editor_shell_tasks', classification: 'PACKAGED_LOCAL', detail: 'editor, terminal, tasks, git execute locally', egress_host: null, consent: 'local_only' },
      { id: 'os_binaries', classification: 'OS_PROVIDED', detail: 'git and ripgrep from the operating system', egress_host: null, consent: 'local_only' },
      { id: 'model_acquisition', classification: 'OPTIONAL_EXTERNAL', detail: 'model downloads happen only on explicit user action', egress_host: 'huggingface.co', consent: consent === 'opted_in' ? 'opted_in' : 'not_configured' }
    ];
    for (const providerId of options.providerIds()) {
      rows.push({
        id: `provider:${providerId}`,
        classification: 'OPTIONAL_EXTERNAL',
        detail: 'external provider reachable only when consent is enabled and a role routes to it',
        egress_host: null,
        consent
      });
    }
    return rows;
  };

  const recent = async (): Promise<EgressManifestResponseT['recent_external_activity']> => {
    let raw: string;
    try {
      raw = await fs.readFile(journalPath, 'utf8');
    } catch {
      return { events: 0, last_at: null, providers: [] };
    }
    const rows = raw.split('\n').filter(line => line.trim().length > 0);
    let lastAt: string | null = null;
    const providers = new Set<string>();
    let events = 0;
    for (const line of rows.slice(-200)) {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        events += 1;
        const ts = typeof parsed.ts === 'string' ? parsed.ts : null;
        if (ts !== null) lastAt = ts;
        const provider = parsed.provider_id ?? parsed.delegated_provider ?? parsed.action;
        if (typeof provider === 'string' && provider.length > 0) providers.add(provider.slice(0, 120));
      } catch {
        // Corrupt rows are skipped; the manifest never guesses.
      }
    }
    return { events, last_at: lastAt, providers: [...providers].slice(0, 16) };
  };

  const snapshot = async (): Promise<EgressManifestResponseT> => ({
    doctrine: DOCTRINE,
    capabilities: capabilities(),
    recent_external_activity: await recent(),
    generated_at: now().toISOString()
  });

  return { snapshot, journalPath };
}
