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
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const expectedBranch = process.env.AIDE_EXPECTED_BRANCH?.trim();
const expectedHead = process.env.AIDE_EXPECTED_HEAD?.trim();
const findings = [];
if (entries.length > 0) findings.push('worktree is dirty');
if (expectedBranch && branch !== expectedBranch) findings.push(`branch mismatch expected=${expectedBranch} actual=${branch || '(detached)'}`);
if (expectedHead && head.toLowerCase() !== expectedHead.toLowerCase()) findings.push(`HEAD mismatch expected=${expectedHead} actual=${head}`);
const report = [
  'AIDE clean-worktree and qualification identity check',
  `clean=${entries.length === 0}`,
  `branch=${branch || '(detached)'}`,
  `head=${head}`,
  ...(expectedBranch ? [`expected_branch=${expectedBranch}`] : []),
  ...(expectedHead ? [`expected_head=${expectedHead}`] : []),
  ...(entries.length === 0 ? ['(clean)'] : entries)
].join('\n') + '\n';

if (process.env.AIDE_CI_WORKTREE_REPORT) {
  await writeFile(process.env.AIDE_CI_WORKTREE_REPORT, report, 'utf8');
}
process.stdout.write(report);
if (findings.length > 0) {
  console.error(`Worktree preflight failed: ${findings.join('; ')}.`);
  process.exitCode = 1;
}
