import { type Route, RouteError } from '../server.ts';
import {
  TerminalProviderListResponse,
  TerminalSessionListResponse,
  TerminalSessionOpenRequest,
  TerminalSessionOpenResponse,
  TerminalSessionStopRequest,
  TerminalSessionStopResponse
} from '../../../common/contracts/terminal.ts';
import type { TerminalSessionService } from '../services/terminal-sessions.ts';

// Session routes. The create and stop operations are central execute-kind and
// therefore go through operator approval (X-AIDE-Operation) exactly like every
// other mutating capability; the handler — and the PTY spawn inside it — runs
// ONLY inside authority.execute. Session ids are opaque handles, not authority,
// and stop verifies ownership against the authenticated actor.

export function routesForTerminalSessions(service: TerminalSessionService): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/terminal/providers',
      response: TerminalProviderListResponse,
      handler: async () => ({ providers: await service.providers() })
    },
    {
      method: 'GET',
      path: '/api/terminal/sessions',
      response: TerminalSessionListResponse,
      handler: () => ({ sessions: service.list() })
    },
    {
      method: 'POST',
      path: '/api/terminal/sessions',
      body: TerminalSessionOpenRequest,
      response: TerminalSessionOpenResponse,
      handler: async ({ body, actor }) => {
        const input = body as { provider: string; shell: string | null; cwd: string | null; cols: number; rows: number };
        const result = await service.open({ owner: actor!.id, ...input });
        if ('error' in result) throw new RouteError('NOT_READY', result.error);
        return result;
      }
    },
    {
      method: 'POST',
      path: '/api/terminal/sessions/stop',
      body: TerminalSessionStopRequest,
      response: TerminalSessionStopResponse,
      handler: ({ body, actor }) => {
        const input = body as { sessionId: string };
        const result = service.stop(actor!.id, input.sessionId);
        if ('error' in result) {
          if (result.error === 'unknown session') throw new RouteError('NOT_FOUND', result.error);
          throw new RouteError('FORBIDDEN', result.error);
        }
        return result;
      }
    }
  ];
}