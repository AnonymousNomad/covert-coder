// Lifecycle probe — owned engine → shutdown → descendants gone; foreign untouched.
// Covers both paths: normal close, and partial-boot failure (the observed leak).
import { execFileSync } from 'node:child_process';
import { bootOrchestration, writeJson } from './lib.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function engines() {
  const out = execFileSync('powershell', ['-NoProfile', '-Command',
    "Get-CimInstance Win32_Process -Filter \"Name='llama-server.exe'\" | ForEach-Object { \"$($_.ProcessId)|$($_.CommandLine)\" }"
  ], { encoding: 'utf8' });
  return out.trim() === '' ? [] : out.trim().split(/\r?\n/).map(line => {
    const [pid, ...rest] = line.split('|');
    const cmd = rest.join('|');
    return { pid: Number(pid), cmd, mine: /aide-sovereign-workbench\\models/.test(cmd) && /--prio -1/.test(cmd) };
  });
}

const report = { started_at: new Date().toISOString(), foreign_before: engines().filter(e => !e.mine).map(e => e.pid), tests: [] };
console.log('[lifecycle] foreign engines before:', report.foreign_before.join(', ') || 'none');

// Test A — normal path: boot one model, close, all owned engines gone.
{
  const before = engines().filter(e => e.mine).map(e => e.pid);
  const orch = await bootOrchestration({ models: ['resident'] });
  const during = engines().filter(e => e.mine).map(e => e.pid);
  await orch.close();
  await sleep(8000);
  const after = engines().filter(e => e.mine).map(e => e.pid);
  report.tests.push({ test: 'normal-close', owned_before: before, owned_during: during, owned_after: after, pass: during.length > 0 && after.length === 0 });
  console.log('[lifecycle] normal-close during=' + during.length + ' after=' + after.length + ' -> ' + (during.length > 0 && after.length === 0 ? 'PASS' : 'FAIL'));
}

// Test B — partial-boot failure: a later model fails (RAM guard or missing
// artifact); the already-started engines must be reaped by the boot cleanup.
{
  const before = engines().filter(e => e.mine).map(e => e.pid);
  let outcome = 'booted';
  try {
    const orch = await bootOrchestration({ models: ['resident', 'planner', 'coder', 'reviewer', 'alt'] });
    await orch.close();
    outcome = 'booted-and-closed';
  } catch (error) {
    outcome = 'boot-failed: ' + String(error.message).slice(0, 120);
  }
  await sleep(8000);
  const after = engines().filter(e => e.mine).map(e => e.pid);
  report.tests.push({ test: 'partial-boot', outcome, owned_before: before, owned_after: after, pass: after.length === 0 });
  console.log('[lifecycle] partial-boot ' + outcome + ' after=' + after.length + ' -> ' + (after.length === 0 ? 'PASS' : 'FAIL'));
}

const foreignAfter = engines().filter(e => !e.mine).map(e => e.pid);
report.foreign_after = foreignAfter;
report.foreign_untouched = JSON.stringify(report.foreign_before) === JSON.stringify(foreignAfter);
report.finished_at = new Date().toISOString();
report.pass = report.tests.every(t => t.pass) && report.foreign_untouched;
await writeJson('lifecycle-probe.json', report);
console.log('[lifecycle] pass=' + report.pass + ' foreign_untouched=' + report.foreign_untouched);
