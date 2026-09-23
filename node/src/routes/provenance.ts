// Provenance ledger + Mission Receipt routes. All reads are declared centrally
// as capability.read; the ledger itself only appends observations from the
// agent loop finalize path (never from route traffic).
import type { Route } from '../server.ts';
import { RouteError } from '../server.ts';
import {
  ProvenanceGetQuery,
  ProvenanceGetResponse,
  ProvenanceListResponse,
  MissionReceiptQuery,
  MissionReceiptResponse
} from '../../../common/contracts/provenance.ts';
import type { createProvenanceLedger } from '../services/provenance-ledger.ts';

type Service = ReturnType<typeof createProvenanceLedger>;

export function routesForProvenance(service: Service): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/provenance/runs',
      response: ProvenanceListResponse,
      handler: async () => await service.list(100)
    },
    {
      method: 'GET',
      path: '/api/provenance/run',
      query: ProvenanceGetQuery,
      response: ProvenanceGetResponse,
      handler: async ({ query }) => {
        const run = await service.get(String(query.id));
        if (run === null) throw new RouteError('NOT_FOUND', `run ${String(query.id)} not found`);
        return { run };
      }
    },
    {
      method: 'GET',
      path: '/api/mission/receipt',
      query: MissionReceiptQuery,
      response: MissionReceiptResponse,
      handler: async ({ query }) => await service.receipt(String(query.id))
    }
  ];
}
