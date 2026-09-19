import { z } from 'zod';
import path from 'node:path';
import type { Route } from '../server.ts';
import { RouteError } from '../server.ts';
import { createPerformanceLedger } from '../services/performance-ledger.ts';
import { derivePassports } from '../services/model-passport.ts';
import { recommendModels } from '../services/model-recommendation.ts';
import {
  PerformanceEventQuery,
  PerformanceQueryResponse,
  PassportsResponse,
  ModelPassport,
  RecommendationRequest,
  RecommendationResponse
} from '../../../common/contracts/performance.ts';
import { listModes, composeModes, ModeLookupError, ModeConflictError } from '../../../harness/modes.mjs';
import { ModeListResponse, ComposedModeResponse } from '../../../common/contracts/harness-modes.ts';

// Harness Lab query surface — read-only, side-effect free. The ledger is the
// source of truth; passports and recommendations are DERIVED per request so a
// stale cached projection can never masquerade as current evidence.
const PassportQuery = z.object({ id: z.string().min(1) }).strict();
const ModeQuery = z.object({ primary: z.string().min(1), specializations: z.string().optional() }).strict();
const PassportResponse = z.object({ passport: ModelPassport }).strict();

export function routesForHarnessLab({ workspace }: { workspace: string }): Route[] {
  const root = path.join(workspace, '.aide', 'harness-lab');
  const ledger = createPerformanceLedger({ root });

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
      handler: async () => {
        const { events } = await ledger.read();
        return { generated_at: new Date().toISOString(), passports: derivePassports(events) };
      }
    },
    {
      method: 'GET',
      path: '/api/harness-lab/passport',
      query: PassportQuery,
      response: PassportResponse,
      handler: async ({ query }) => {
        const { id } = query as z.infer<typeof PassportQuery>;
        const { events } = await ledger.read();
        const passports = derivePassports(events);
        const matches = passports.filter(passport => passport.performance_identity === id || passport.identity.model_id === id);
        if (matches.length === 0) throw new RouteError('NOT_FOUND', `no passport evidence for ${id}`);
        const latest = [...matches].sort((a, b) => (a.evidence.last_event_at ?? '').localeCompare(b.evidence.last_event_at ?? '')).reverse()[0]!;
        return { passport: latest };
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
        const { events } = await ledger.read();
        const passports = derivePassports(events);
        return recommendModels({ request: body as z.infer<typeof RecommendationRequest>, passports });
      }
    }
  ];
}

export function harnessLabRoot(workspace: string): string {
  return path.join(workspace, '.aide', 'harness-lab');
}
