// Read-only Model Atlas doctor. Reports store health; never repairs or deletes.
// Usage: node scripts/model-atlas-doctor.mjs --workspace <dir> [--evidence-root <dir>] [--json <path>]

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createModelAtlas } from '../node/src/services/model-atlas.ts';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
}

const workspaceArg = arg('--workspace');
if (workspaceArg === null) {
  console.error('usage: node scripts/model-atlas-doctor.mjs --workspace <dir> [--evidence-root <dir>] [--json <path>]');
  process.exit(2);
}
const workspace = path.resolve(workspaceArg);
const evidenceRootArg = arg('--evidence-root');
const jsonPath = arg('--json');

const evidenceResolver = evidenceRootArg === null ? undefined : (() => {
  const root = path.resolve(evidenceRootArg);
  return async ref => {
    if (typeof ref !== 'string' || ref.length === 0 || path.isAbsolute(ref)) return false;
    const resolved = path.resolve(root, ref);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return false;
    return fs.access(resolved).then(() => true).catch(() => false);
  };
})();

const atlas = createModelAtlas({ workspace });
const report = await atlas.audit(evidenceResolver === undefined ? {} : { evidenceResolver });

console.log('MODEL ATLAS DOCTOR — read-only');
console.log('workspace=' + workspace);
console.log('healthy=' + report.healthy);
console.log('records=' + report.totals.records + ' models=' + report.totals.models);
console.log('corrupt=' + report.totals.corrupt + ' integrity_mismatch=' + report.totals.integrity_mismatch + ' unverified=' + report.totals.unverified);
console.log('duplicate_evaluation_ids=' + report.duplicate_evaluation_ids.length);
console.log('dangling_recommendation_refs=' + report.dangling_recommendation_refs.length);
console.log('evidence_refs_checked=' + report.evidence_refs.checked + ' total=' + report.evidence_refs.total + ' dangling=' + report.evidence_refs.dangling);
console.log('unsupported_schema_files=' + report.unsupported_schema_files.length);
if (report.issues.length > 0) {
  for (const issue of report.issues) console.log('  issue: ' + issue.kind + ' ' + issue.file);
}
if (jsonPath !== null) {
  const target = path.resolve(jsonPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log('report=' + target);
}
process.exit(report.healthy ? 0 : 1);
