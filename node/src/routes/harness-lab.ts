import { z } from 'zod';
import path from 'node:path';
import type { Route } from '../server.ts';
import { RouteError } from '../server.ts';
import { createPerformanceLedger } from '../services/performance-ledger.ts';
import { derivePassports } from '../services/model-passport.ts';
import { recommendModels } from '../services/model-recommendation.ts';
import { createQualificationStore, runQualificationProbe, QualificationError } from '../services/model-qualification.ts';
import type { ModelRuntime } from '../services/model-runtime.ts';
import {
  PerformanceEventQuery,
  PerformanceQueryResponse,
  PassportsResponse,
  ModelPassport,
  RecommendationRequest,
  RecommendationResponse,
  QualificationRecord,
  QualificationsResponse
} from '../../../common/contracts/performance.ts';
import { listModes, composeModes, ModeLookupError, ModeConflictError } from '../../../harness/modes.mjs';
import { ModeListResponse, ComposedModeResponse } from '../../../common/contracts/harness-modes.ts';

// Harness Lab query surface — reads are side-effect free; passports and
// recommendations are DERIVED per request so a stale cached projection can
// never masquerade as current evidence. Qualification is the only execution
// here: it runs a bounded functional probe through the SAME runtime the chat
// path uses, behind an approved exact operation that binds the model identity.
const PassportQuery = z.object({ id: z.string().min(1) }).strict();
const ModeQuery = z.object({ primary: z.string().min(1), specializations: z.string().optional() }).strict();
const PassportResponse = z.object({ passport: ModelPassport }).strict();
const QualifyRequest = z.object({ model_id: z.string().min(1), artifact_hash: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict();
const QualifyResponse = z.object({ record: QualificationRecord }).strict();

export function routesForHarnessLab({ workspace, modelRuntime }: { workspace: string; modelRuntime: ModelRuntime }): Route[] {
  // The operator's lab data root is the repo-level .aide/harness-lab. A stack
  // launched with a dedicated benchmark workspace can point the routes there
  // explicitly (AIDE_HARNESS_LAB_ROOT), so ledger/qualification data never
  // lands inside the throwaway benchmark workspace.
  const root = process.env.AIDE_HARNESS_LAB_ROOT ?? path.join(workspace, '.aide', 'harness-lab');
  const ledger = createPerformanceLedger({ root });
  const qualifications = createQualificationStore({ root });

  async function derivedPassports() {
    const [{ events }, records] = await Promise.all([ledger.read(), qualifications.read()]);
    return derivePassports(events, { qualifications: records });
  }

  return [
    {
      method: 'GET',
      path: '/api/harness-lab/events',
      query: PerformanceEventQuery,
      response: PerformanceQueryResponse,
      handler: async ({ query }) => {
        const result = await ledger.query(query as z.infer<typeof PerformanceEventQuery>);
        return {
          events: result.events,
          integrity: { ok: result.issues.length === 0, issues: result.issues },
          total_matched: result.total_matched,
          bounded: result.bounded
        };
      }
    },
    {
      method: 'GET',
      path: '/api/harness-lab/passports',
      response: PassportsResponse,
      handler: async () => ({ generated_at: new Date().toISOString(), passports: await derivedPassports() })
    },
    {
      method: 'GET',
      path: '/api/harness-lab/passport',
      query: PassportQuery,
      response: PassportResponse,
      handler: async ({ query }) => {
        const { id } = query as z.infer<typeof PassportQuery>;
        const passports = await derivedPassports();
        const matches = passports.filter(passport => passport.performance_identity === id || passport.identity.model_id === id);
        if (matches.length === 0) throw new RouteError('NOT_FOUND', `no passport evidence for ${id}`);
        const latest = [...matches].sort((a, b) => (a.evidence.last_event_at ?? '').localeCompare(b.evidence.last_event_at ?? '')).reverse()[0]!;
        return { passport: latest };
      }
    },
    {
      method: 'GET',
      path: '/api/harness-lab/qualifications',
      response: QualificationsResponse,
      handler: async () => ({ records: await qualifications.read() })
    },
    {
      method: 'POST',
      path: '/api/harness-lab/qualify',
      body: QualifyRequest,
      response: QualifyResponse,
      handler: async ({ body }) => {
        const request = body as z.infer<typeof QualifyRequest>;
        try {
          const record = await runQualificationProbe({
            runtime: modelRuntime,
            modelId: request.model_id,
            root,
            ...(request.artifact_hash !== undefined ? { artifactHash: request.artifact_hash } : {})
          });
          await qualifications.append(record);
          return { record };
        } catch (error) {
          if (error instanceof QualificationError) throw new RouteError(error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST', error.message);
          throw new RouteError('CHILD_FAILED', error instanceof Error ? error.message : 'qualification failed');
        }
      }
    },
    {
      method: 'GET',
      path: '/api/harness-lab/modes',
      response: ModeListResponse,
      handler: async () => ({ modes: listModes() })
    },
    {
      method: 'GET',
      path: '/api/harness-lab/mode',
      query: ModeQuery,
      response: ComposedModeResponse,
      handler: async ({ query }) => {
        const { primary, specializations } = query as z.infer<typeof ModeQuery>;
        const specializationIds = (specializations ?? '').split(',').map(value => value.trim()).filter(Boolean);
        try {
          return { modes: [composeModes({ primary, specializations: specializationIds })] };
        } catch (error) {
          if (error instanceof ModeLookupError) throw new RouteError('NOT_FOUND', error.message);
          if (error instanceof ModeConflictError) throw new RouteError('CONFLICT', error.message);
          throw error;
        }
      }
    },
    {
      method: 'POST',
      path: '/api/harness-lab/recommend',
      body: RecommendationRequest,
      response: RecommendationResponse,
      handler: async ({ body }) => {
        const passports = await derivedPassports();
        return recommendModels({ request: body as z.infer<typeof RecommendationRequest>, passports });
      }
    }
  ];
}

export function harnessLabRoot(workspace: string): string {
  return path.join(workspace, '.aide', 'harness-lab');
}
