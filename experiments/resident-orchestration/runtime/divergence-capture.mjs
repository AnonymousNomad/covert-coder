// Decisive divergence capture: what does the Covert path actually SEND?
// Builds the canonical composer (skills + awareness providers, as openapi wires
// them), composes the parity message, dumps the composed messages, then sends
// them to a direct engine with the EXACT runtime args.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createChatContextComposer } from '../../../node/src/services/chat-context.ts';
import { createSkillsLoader } from '../../../node/src/services/skills-loader.mjs';
import { createResidentAwarenessProvider } from '../../../node/src/services/resident-awareness-provider.mjs';

const REPO = 'E:\\aide-sovereign-workbench';
const PROJECT = 'E:\\pip_temp\\opencode\\resident-orch-project';
const ENGINE = 'E:\\llama-cpp\\llama-server.exe';
const MODEL = path.join(REPO, 'models', 'LFM2.5-2.6B-QAD-Q4_0.gguf');
const OUT = path.join(REPO, 'experiments', 'resident-orchestration', 'results', 'ACCOUNTING-VS-COVERT-PARITY.json');
const PORT = 8195;

const parityMessage = [
  '[CANONICAL PROJECT STATE]',
  'objective: make the version parser obey its test contract (all tests green).',
  'workflow_stage: IMPLEMENTATION',
  'git_branch: main',
  'changed_files: src/version.mjs',
  'available_worker_models: liquid-dogfood-merged-q8_0, qwen2.5-coder-1.5b-instruct-q4_k_m',
  'relevant_procedures: resident.handle-verification-failure',
  '',
  '[TASK]',
  'Which git branch is the current project on? One line.'
].join('\n');

const report = { schema: 'accounting-vs-covert-parity-v1', at: new Date().toISOString(), composed: null, direct_engine: null };
const approx = t => Math.ceil(String(t ?? '').length / 4);

// 1. Compose exactly as the Covert path does.
try {
  const awareness = createResidentAwarenessProvider({ workspace: PROJECT, repoRoot: REPO, enabled: true, projection: null });
  const skills = await createSkillsLoader({ skillsRoot: REPO });
  const composer = createChatContextComposer({
    workspace: PROJECT,
    runtime: { refreshServedContext: async () => ({}), getEffectiveContext: () => 2048 },
    providers: { skills: t => skills.provider ? skills.provider(t) : null, awareness: awareness.provider }
  });
  const composed = await composer.compose({ modelId: 'lfm2.5-2.6b-qad-q4_0', messages: [{ role: 'user', content: parityMessage }] });
  report.composed = {
    message_count: composed.messages.length,
    roles: composed.messages.map(m => ({ role: m.role, tokens_approx: approx(m.content), head: String(m.content).replace(/\s+/g, ' ').slice(0, 140), tail: String(m.content).replace(/\s+/g, ' ').slice(-140) })),
    total_tokens_approx: composed.messages.reduce((s, m) => s + approx(m.content), 0),
    harness: composed.harness ?? null
  };
} catch (error) {
  report.composed = { error: String(error && error.message ? error.message : error).slice(0, 200) };
}

// 2. Send the COMPOSED messages to a direct engine with the exact runtime args.
if (report.composed && Array.isArray(report.composed.roles) && !report.composed.error) {
  // Rebuild the exact message array for the engine call.
  const awareness = createResidentAwarenessProvider({ workspace: PROJECT, repoRoot: REPO, enabled: true, projection: null });
  const skills = await createSkillsLoader({ skillsRoot: REPO });
  const composer = createChatContextComposer({
    workspace: PROJECT,
    runtime: { refreshServedContext: async () => ({}), getEffectiveContext: () => 2048 },
    providers: { skills: t => skills.provider ? skills.provider(t) : null, awareness: awareness.provider }
  });
  const composed = await composer.compose({ modelId: 'lfm2.5-2.6b-qad-q4_0', messages: [{ role: 'user', content: parityMessage }] });

  const child = spawn(ENGINE, ['-m', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '--ctx-size', '2048', '--threads', '4', '--parallel', '1', '--no-warmup', '--prio', '-1', '--jinja', '--temperature', '0.1', '--top-k', '50', '--repeat-penalty', '1.1', '-ngl', '0'], { cwd: path.dirname(ENGINE), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let ready = false;
  for (let i = 0; i < 240; i += 1) { try { const r = await fetch(`http://127.0.0.1:${PORT}/v1/models`, { signal: AbortSignal.timeout(3000) }); if (r.ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 1000)); }
  report.direct_engine = { ready };
  if (ready) {
    const started = Date.now();
    const r = await fetch(`http://127.0.0.1:${PORT}/v1/chat/completions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: composed.messages.map(m => ({ role: m.role, content: m.content })), max_tokens: 1536 }),
      signal: AbortSignal.timeout(900000)
    });
    const body = await r.json().catch(() => null);
    const choice = body?.choices?.[0] ?? {};
    const message = choice.message ?? {};
    report.direct_engine = {
      ...report.direct_engine,
      finish_reason: choice.finish_reason ?? null,
      reasoning_chars: String(message.reasoning_content ?? '').length,
      content_chars: String(message.content ?? '').length,
      content_head: String(message.content ?? '').replace(/\s+/g, ' ').slice(0, 200),
      usage: body?.usage ?? null,
      latency_ms: Date.now() - started
    };
    console.log('[divergence] composed-through-engine:', JSON.stringify(report.direct_engine).slice(0, 300));
  }
  try { execFileSync('taskkill', ['/PID', String(child.pid), '/F', '/T'], { timeout: 15000 }); } catch {}
}

await fs.writeFile(OUT, JSON.stringify(report, null, 2), 'utf8');
console.log('[divergence] written', OUT);
console.log('[divergence] composed:', report.composed.error ? report.composed.error : JSON.stringify(report.composed.roles).slice(0, 300));
