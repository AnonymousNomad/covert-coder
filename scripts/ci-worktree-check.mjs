import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
  cwd: root,
  encoding: 'utf8'
});
const entries = status.trim() === '' ? [] : status.trimEnd().split(/\r?\n/);
const report = [
  'AIDE CI generated-file/worktree check',
  `clean=${entries.length === 0}`,
  ...(entries.length === 0 ? ['(clean)'] : entries)
].join('\n') + '\n';

if (process.env.AIDE_CI_WORKTREE_REPORT) {
  await writeFile(process.env.AIDE_CI_WORKTREE_REPORT, report, 'utf8');
}
process.stdout.write(report);
if (entries.length > 0) {
  console.error('CI worktree check failed: tests or build steps modified tracked/untracked repository files.');
  process.exitCode = 1;
}
