import path from 'node:path';
import { UnslothRuntimeAdapter } from '../../node/src/services/unsloth-runtime-adapter.ts';

const installRoot = path.resolve(process.env.COVERT_UNSLOTH_INSTALL_ROOT ?? 'E:\\Unsloth-Studio-runtime-lab-RT27');
delete process.env.AIDE_UNSLOTH_ENDPOINT;
const adapter = new UnslothRuntimeAdapter({
  workspace: process.cwd(),
  port: 18888,
  cliPath: path.join(installRoot, 'bin', 'unsloth.exe'),
  authTokenProvider: async () => null
});

await adapter.discover();
const status = await adapter.status();
const pass = status.version === '2026.9.11' && status.health === 'STOPPED' &&
  status.ownership === 'UNKNOWN' && status.pid === null && status.loaded_model === null && status.port === 18888;
if (!pass) process.exitCode = 1;
process.stdout.write(JSON.stringify({
  pass,
  credentials_read: false,
  runtime_started: false,
  status
}) + '\n');
