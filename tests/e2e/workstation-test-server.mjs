import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ArchServer } from '../../node/src/server.ts';
import { TerminalSessionService } from '../../node/src/services/terminal-sessions.ts';
import { buildRoutes } from '../../node/src/openapi.ts';

const workspaceValue = process.env.AIDE_WORKSTATION_E2E_WORKSPACE;
const proofFileValue = process.env.AIDE_WORKSTATION_E2E_PAIRING_PROOF;
const origin = process.env.AIDE_WORKSTATION_E2E_ORIGIN ?? '';
const port = Number(process.env.AIDE_WORKSTATION_E2E_PORT ?? 4878);
if (!workspaceValue || !proofFileValue || !origin || !Number.isInteger(port) || port < 1) throw new Error('workstation E2E fixture configuration is incomplete');
const workspace = path.resolve(workspaceValue);
const proofFile = path.resolve(proofFileValue);

await fs.mkdir(path.join(workspace, '.aide', 'logs'), { recursive: true });
await fs.writeFile(path.join(workspace, 'fixture.ts'), 'export const value = "base";\n', 'utf8');
await fs.writeFile(path.join(workspace, '.aide', 'session.json'), JSON.stringify({
  version: 1,
  activeTab: 'file:///fixture.ts',
  tabs: [{ uri: 'file:///fixture.ts' }]
}), 'utf8');

const server = new ArchServer(workspace, path.join(workspace, '.aide', 'logs', 'workstation-e2e.log'));
const terminalSessions = new TerminalSessionService({
  defaultCwd: workspace,
  onEvent: (event, owner) => server.events.publish('terminal', event, identity => identity?.id === owner)
});
server.registerControlHandler((message, context) => terminalSessions.handleControl(message, context.identity));
let modelTurn = 0;
const routes = await buildRoutes(workspace, 'workstation-e2e', {
  authority: server.authority,
  events: server.events,
  terminalSessions,
  agentChatFn: async () => {
    modelTurn++;
    if (modelTurn === 1) return '<write_file><path>fixture.ts</path><content>export const value = "agent edit";\n</content></write_file>';
    return '<attempt_completion><result>fixture mutation completed</result></attempt_completion>';
  }
});
for (const route of routes) server.route(route);

// The browser still pairs through the canonical one-use Authority route. This
// fixture proof is scoped to the test origin and stays in the OS temp directory.
const proof = server.authority.control.createPairing(origin);
await fs.writeFile(proofFile, proof, { encoding: 'utf8', mode: 0o600 });
for (const suffix of ['terminal-refresh', 'dual-terminals', 'dual-restart', 'utilities', 'wsl', 'laptop', 'laptop-restart']) {
  await fs.writeFile(`${proofFile}.${suffix}`, server.authority.control.createPairing(origin), { encoding: 'utf8', mode: 0o600 });
}

const listener = await server.listen(port);
listener.on('error', error => {
  server.logger.error('workstation e2e fixture listener failed', { message: error.message });
  process.exitCode = 1;
});
process.stdout.write('workstation E2E fixture ready\n');
let stopping = false;
const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  terminalSessions.stopAll(); // Only sessions created by this isolated fixture.
  server.events.close();
  await new Promise(resolve => listener.close(resolve));
};
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
