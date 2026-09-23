// Canonical Worker/Model Provenance Ledger + Mission Receipt projection.
// Append-only JSONL under .aide/provenance/ledger.jsonl. Records are strict
// observations (validated by the contract, which rejects unknown fields and
// therefore chain-of-thought). The receipt aggregates runs + canonical worker
// handoffs for one mission and NEVER fabricates: absent truth reports
// 'not_recorded' plus an explicit limitation.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  ProvenanceRun,
  type MissionReceiptResponseT,
  type ProvenanceListResponseT,
  type ProvenanceRunT
} from '../../../common/contracts/provenance.ts';

export interface ProvenanceLedgerOptions {
  workspace: string;
  now?: () => Date;
}

export function createProvenanceLedger(options: ProvenanceLedgerOptions) {
  const ledgerPath = path.join(options.workspace, '.aide', 'provenance', 'ledger.jsonl');
  const handoffsDir = path.join(options.workspace, '.aide', 'worker-handoffs');
  const now = options.now ?? (() => new Date());

  const readAll = async (): Promise<{ runs: ProvenanceRunT[]; corrupt: number }> => {
    let raw: string;
    try {
      raw = await fs.readFile(ledgerPath, 'utf8');
    } catch {
      return { runs: [], corrupt: 0 };
    }
    const runs: ProvenanceRunT[] = [];
    let corrupt = 0;
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      try {
        runs.push(ProvenanceRun.parse(JSON.parse(trimmed)) as ProvenanceRunT);
      } catch {
        corrupt += 1;
      }
    }
    return { runs, corrupt };
  };

  const record = async (input: unknown): Promise<ProvenanceRunT> => {
    // Strict parse: unknown fields (including any transcript/CoT attempt) throw.
    const run = ProvenanceRun.parse(input) as ProvenanceRunT;
    await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
    await fs.appendFile(ledgerPath, `${JSON.stringify(run)}\n`, 'utf8');
    return run;
  };

  const list = async (limit = 100): Promise<ProvenanceListResponseT> => {
    const { runs, corrupt } = await readAll();
    return { runs: runs.slice().reverse().slice(0, limit), total: runs.length, corrupt_lines: corrupt };
  };

  const get = async (runId: string): Promise<ProvenanceRunT | null> => {
    const { runs } = await readAll();
    for (let index = runs.length - 1; index >= 0; index -= 1) {
      const candidate = runs[index];
      if (candidate !== undefined && candidate.run_id === runId) return candidate;
    }
    return null;
  };

  const receipt = async (missionId: string): Promise<MissionReceiptResponseT> => {
    const { runs } = await readAll();
    const missionRuns = runs.filter(run => run.task_id === missionId || run.run_id === missionId);
    const handoffs: MissionReceiptResponseT['handoffs'] = [];
    try {
      for (const name of await fs.readdir(handoffsDir)) {
        if (!name.endsWith('.json')) continue;
        try {
          const envelope = JSON.parse(await fs.readFile(path.join(handoffsDir, name), 'utf8')) as Record<string, unknown>;
          if (envelope?.task_id !== missionId) continue;
          const from = envelope.from as { worker?: unknown } | undefined;
          const to = envelope.to as { worker?: unknown } | undefined;
          handoffs.push({
            handoff_id: String(envelope.handoff_id ?? ''),
            from: String(from?.worker ?? ''),
            to: String(to?.worker ?? ''),
            state: String(envelope.state ?? ''),
            objective: String(envelope.objective ?? '').slice(0, 2000)
          });
        } catch {
          // Corrupt handoff files are skipped; the receipt never fabricates.
        }
      }
    } catch {
      // No handoffs directory yet.
    }
    const states = [...new Set(missionRuns.map(run => run.verification_state))];
    const verification = missionRuns.length === 0 ? 'not_recorded' : states.length === 1 ? (states[0] ?? 'not_recorded') : states.join(',');
    const limitations: string[] = [];
    if (missionRuns.length === 0) limitations.push('no provenance runs recorded for this mission');
    if (missionRuns.length > 0 && !states.includes('verified')) limitations.push('no run reached verified state; committed process exit is not test evidence');
    if (handoffs.length === 0) limitations.push('no canonical worker handoffs recorded for this mission');
    const evidenceRefs = [...new Set(missionRuns.flatMap(run => [run.evidence_file, run.trajectory_file].filter((ref): ref is string => ref !== null && ref.length > 0)))];
    const verified = states.includes('verified');
    return {
      mission_id: missionId,
      workspace: options.workspace,
      recorded_at: now().toISOString(),
      runs: missionRuns.slice(-200),
      handoffs: handoffs.slice(0, 50),
      verification,
      supported_conclusion: verified ? `mission completed with verified evidence across ${missionRuns.length} run(s)` : null,
      limitations,
      evidence_refs: evidenceRefs.slice(0, 50)
    };
  };

  return { record, list, get, receipt, ledgerPath };
}
