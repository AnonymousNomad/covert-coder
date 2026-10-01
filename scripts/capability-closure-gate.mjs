// Additive closure section in the existing wiring ledger. This release gate
// cannot substitute for CI, dogfood, packaged acceptance or Authority evidence.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CapabilityClosure, evaluateCapabilityClosure } from '../common/contracts/capability-closure.ts';

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = path.resolve(import.meta.dirname, '..');
    const ledger = JSON.parse(readFileSync(path.join(root, 'artifacts/integration-certification/capability-ledger.json'), 'utf8'));
    const closure = CapabilityClosure.parse(ledger.closure);
    if (process.argv.includes('--validate')) {
      console.log(JSON.stringify({ state: 'SCHEMA_VALID', records: closure.records.length, coverage: closure.coverage, release_acceptance_evaluated: false }));
    } else {
      const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
      const result = evaluateCapabilityClosure(closure, { branch: git(['branch', '--show-current']), sha: git(['rev-parse', 'HEAD']), hasFile: file => existsSync(path.join(root, file)) });
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.state === 'BLOCKED' ? 1 : 0;
    }
  } catch {
    console.error('CAPABILITY_CLOSURE_INVALID: ledger or candidate evidence unavailable');
    process.exitCode = 1;
  }
}
