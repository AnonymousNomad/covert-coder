// Focused start-probe: reproduces the smollm3 409 and prints the exact
// server-side envelope + in-memory stack logs for classification.
import path from 'node:path';
import { launchSupervisedStack } from '../../tests/helpers/supervised-stack.mjs';
import { approveWithRetry, PROJECT_DIR } from '../resident-orchestration/lib.mjs';

const REPO = 'E:\\aide-sovereign-workbench';
const stack = await launchSupervisedStack({ workspace: PROJECT_DIR, env: { AIDE_MODEL_DIR: path.join(REPO, 'models'), AIDE_CLOSED_LOOP: 'false' } });
try {
  const reg = await approveWithRetry(stack, { adapter: 'ts', method: 'POST', path: '/api/models/register', body: { filename: 'SmolLM3-Q4_K_M.gguf', quant_label: 'q8_0' } });
  console.log('[probe] register', reg.status, JSON.stringify(reg.body?.data ?? reg.body).slice(0, 400));
  const id = reg.body?.data?.id;
  const start = await approveWithRetry(stack, { adapter: 'ts', method: 'POST', path: '/api/models/start', body: { id } });
  console.log('[probe] start', start.status, JSON.stringify(start.body).slice(0, 1200));
  const status = await stack.json('facade', 'GET', '/api/models/status');
  const mine = (status.body?.data?.models ?? []).find(m => m.id === id);
  console.log('[probe] status', status.status, JSON.stringify(mine ?? null).slice(0, 400));
  console.log('[probe] engine log files:');
  const { promises: fs } = await import('node:fs');
  for (const name of await fs.readdir(path.join(PROJECT_DIR, '.aide', 'logs')).catch(() => [])) {
    if (name.includes('smollm3')) {
      const body = await fs.readFile(path.join(PROJECT_DIR, '.aide', 'logs', name), 'utf8');
      console.log(`--- ${name} ---\n${body.slice(-1500)}`);
    }
  }
  console.log('[probe] stack logs tail:');
  console.log(stack.logs.join('').slice(-3000));
} finally {
  await stack.close();
}
