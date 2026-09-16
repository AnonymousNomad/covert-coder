import { readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.CI !== 'true' && process.env.GITHUB_ACTIONS !== 'true') {
  console.log('AIDE CI cleanup skipped outside CI.');
  process.exit(0);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['browser/dist', 'artifacts/veritas.md'];
if (process.env.AIDE_CI_DESKTOP === '1') {
  targets.push('desktop/frontend', 'desktop/resources', 'desktop/target');
}
const removed = [];
const failures = [];

for (const relative of targets) {
  try {
    await rm(path.join(root, relative), { recursive: true, force: true });
    removed.push(relative);
  } catch (error) {
    failures.push(`${relative}: ${error.message}`);
  }
}

try {
  const tempRoot = os.tmpdir();
  const entries = await readdir(tempRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.name.startsWith('aide-')) continue;
    try {
      await rm(path.join(tempRoot, entry.name), { recursive: true, force: true });
      removed.push(path.join(tempRoot, entry.name));
    } catch (error) {
      failures.push(`${path.join(tempRoot, entry.name)}: ${error.message}`);
    }
  }
} catch (error) {
  failures.push(`temp scan: ${error.message}`);
}

const report = [
  'AIDE CI fixture cleanup',
  `removed=${removed.length}`,
  ...removed.map(item => `REMOVED ${item}`),
  ...failures.map(item => `FAILED ${item}`)
].join('\n') + '\n';
if (process.env.AIDE_CI_CLEANUP_REPORT) {
  await writeFile(process.env.AIDE_CI_CLEANUP_REPORT, report, 'utf8');
}
process.stdout.write(report);
if (failures.length > 0) process.exitCode = 1;
