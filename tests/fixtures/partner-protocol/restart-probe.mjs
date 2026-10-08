import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createExecutionAuthority } from '../../../node/src/services/execution-authority.mjs';

const workspace = process.env.PARTNER_TEST_WORKSPACE;
const fingerprint = process.env.PARTNER_TEST_FINGERPRINT;
const deviceId = process.env.PARTNER_TEST_DEVICE_ID;
const authority = createExecutionAuthority({ workspace, record: async () => ({ persisted: true }) });

try {
  await authority.partner.initialize(fingerprint);
  await authority.partner.requireScope(deviceId, 'system.read');
  process.stdout.write('ACTIVE\n');
  process.exitCode = 2;
} catch (error) {
  if (error?.code !== 'FORBIDDEN') {
    process.stderr.write('Partner state could not be reconciled\n');
    process.exitCode = 3;
  } else {
    const statePath = path.join(workspace, '.aide', 'platform-authority', 'partner-devices.json');
    const state = JSON.parse(await readFile(statePath, 'utf8'));
    const device = state.devices.find(entry => entry.device_id === deviceId);
    if (device?.state !== 'REVOKED' || !device.revoked_at || !device.last_seen_at) {
      process.stderr.write('Durable revocation or last-seen state is missing\n');
      process.exitCode = 4;
    } else process.stdout.write('REVOKED_WITH_LAST_SEEN\n');
  }
} finally {
  authority.control.close();
}
