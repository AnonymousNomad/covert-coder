// Post-soak restart continuation — fresh stack, canonical reconstruction only,
// "Continue.", then a status check. Proves continuity after the overnight soak.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PROJECT_DIR, bootOrchestration, residentSay, reconstructProject, writeJson, readContainmentTail } from './lib.mjs';

const mission = { mission: 'post-soak-restart-continuation', started_at: new Date().toISOString() };
const continuityPath = path.join(PROJECT_DIR, '.aide', 'orch', 'continuity.jsonl');
const continuity = (await fs.readFile(continuityPath, 'utf8')).trim().split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
mission.continuity_entries_before = continuity.length;
mission.last_entry = continuity.at(-1) ?? null;

const containmentBefore = (await readContainmentTail(PROJECT_DIR, 0)).length;
const orch = await bootOrchestration({ models: ['resident'] });
try {
  const reconstruction = await reconstructProject(orch);
  mission.reconstruction = { stage: reconstruction.stage, objective: reconstruction.objective, branch: reconstruction.branch, changes: reconstruction.changes.map(c => c.path) };
  const cont = await residentSay(orch, 'Continue.\n\nCanonical state: ' + JSON.stringify({ stage: reconstruction.stage, objective: reconstruction.objective, continuity: mission.last_entry }) + '\nState the objective, what is verified, what failed, and the next step.', { maxTokens: 220 });
  mission.continue = cont.text.replace(/\s+/g, ' ');
  const status = await residentSay(orch, 'Where are we?', { maxTokens: 200 });
  mission.status = status.text.replace(/\s+/g, ' ');
  mission.containment = (await readContainmentTail(PROJECT_DIR, containmentBefore)).map(e => ({ disposition: e.disposition, triggers: e.triggers }));
  mission.transcript_replayed = false;
  mission.finished_at = new Date().toISOString();
  await writeJson('post-soak-restart-continuation.json', mission);
  console.log('[restart] continue:', mission.continue.slice(0, 160));
  console.log('[restart] status:', mission.status.slice(0, 160));
} catch (error) {
  mission.error = String(error && error.message ? error.message : error);
  await writeJson('post-soak-restart-continuation.json', mission);
  console.log('[restart] FAILED:', mission.error);
} finally {
  await orch.close().catch(() => {});
}
