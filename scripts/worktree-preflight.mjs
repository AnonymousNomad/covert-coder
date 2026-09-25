export function evaluateWorktreePreflight({ status, branch, head, expectedBranch, expectedHead }) {
  const findings = [];
  if (status !== '') findings.push('worktree is dirty');
  if (expectedBranch && branch !== expectedBranch) findings.push(`branch mismatch expected=${expectedBranch} actual=${branch || '(detached)'}`);
  if (expectedHead && head.toLowerCase() !== expectedHead.toLowerCase()) findings.push(`HEAD mismatch expected=${expectedHead} actual=${head}`);
  return { ok: findings.length === 0, findings };
}
