import { promises as fsp } from 'node:fs';
import { accessSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(process.cwd());
const checks = [];
const pass = (name, detail) => checks.push({ name, detail, ok: true });
const warn = (name, detail) => checks.push({ name, detail, ok: true, warning: true });
const fail = (name, detail) => checks.push({ name, detail, ok: false });
const which = (name) => {
  const separator = process.platform === 'win32' ? ';' : ':';
  const exts = process.platform === 'win32' ? ['', '.exe', '.cmd'] : [''];
  for (const dir of (process.env.PATH || '').split(separator)) {
    for (const ext of exts) {
      const candidate = path.join(dir, name + ext);
      try { accessSync(candidate); return candidate; } catch { /* keep looking */ }
    }
  }
  return null;
};

if (Number(process.versions.node.split('.')[0]) >= 20) pass('Node.js', process.version); else fail('Node.js', 'Node 20 or newer is required');
for (const file of ['models/manifest.json', 'community/node-manifest.json', 'training/manifest.json']) {
  try { JSON.parse(await fsp.readFile(path.join(root, file), 'utf8')); pass(file, 'valid JSON'); } catch { fail(file, 'missing or invalid JSON'); }
}
try { await fsp.access(path.join(root, 'daemon/server.mjs')); pass('Local daemon', 'available'); } catch { fail('Local daemon', 'daemon/server.mjs missing'); }
const configured = process.env.AIDE_LLAMA_SERVER;
const llamaExe = `llama-server${process.platform === 'win32' ? '.exe' : ''}`;
// Mirrors the model runtime's resolution chain (env -> workspace runtime dir ->
// known local installs -> PATH) so the doctor never reports "no runtime" while
// the product can actually start models through auto-discovery.
const llamaCandidates = [
  configured,
  path.join(root, 'runtime', llamaExe),
  process.platform === 'win32' ? 'E:\\llama-cpp\\llama-server.exe' : null,
  process.platform === 'win32' ? 'E:\\llama-cpp-vulkan\\llama-server.exe' : null,
  which('llama-server'),
  which('llama.cpp')
].filter(Boolean);
const llamaFound = llamaCandidates.find(candidate => { try { accessSync(candidate); return true; } catch { return false; } }) ?? null;
if (llamaFound !== null) pass('llama.cpp', `runtime binary found: ${llamaFound}`);
else warn('llama.cpp', configured ? 'configured AIDE_LLAMA_SERVER was not found' : 'no llama-server found (checked AIDE_LLAMA_SERVER, ./runtime, known local installs, PATH); local models need one, chat still works through OpenAI-compatible providers');
const manifest = JSON.parse(await fsp.readFile(path.join(root, 'models/manifest.json'), 'utf8'));
const ready = manifest.models.filter(model => model.status === 'ready').length;
if (ready) pass('Model registry', `${ready} pack(s) declared ready`); else warn('Model registry', 'import at least one model pack');
const configuredModel = process.env.AIDE_MODEL_PATH;
const installedModels = (await fsp.readdir(path.resolve(process.env.AIDE_MODEL_DIR || path.join(root, 'models'))).catch(() => [])).filter(file => /\.(gguf|safetensors)$/i.test(file));
if (configuredModel) {
  try { accessSync(configuredModel); pass('Model artifact', configuredModel); } catch { warn('Model artifact', `AIDE_MODEL_PATH was not found: ${configuredModel}`); }
} else if (installedModels.length) pass('Model artifacts', `${installedModels.length} local weight file(s) found`);
else warn('Model artifacts', 'set AIDE_MODEL_PATH to a verified GGUF/Safetensors file before starting chat');
const git = which('git');
if (git) pass('Git', 'found on PATH'); else warn('Git', 'install Git so repository review and applying workflows are available');
const python = process.env.AIDE_PYTHON;
const debugpy = spawnSync(python || 'python', ['-c', 'import debugpy'], { encoding: 'utf8', timeout: 10000 });
if (debugpy.status === 0) pass('Python debugpy', python || 'python');
else warn('Python debugpy', python ? `AIDE_PYTHON (${python}) cannot import debugpy` : 'set AIDE_PYTHON to a Python environment with debugpy installed (pip install debugpy) to use the Python debugger');
console.log('\nCovert Coder Doctor\n');
for (const check of checks) console.log(`${check.ok ? (check.warning ? 'WARN' : 'OK') : 'FAIL'}  ${check.name}: ${check.detail}`);
const failures = checks.filter(check => !check.ok).length;
console.log(`\n${failures ? 'Preflight failed' : 'Preflight passed'}: ${checks.length - failures}/${checks.length} checks\n`);
if (failures) process.exitCode = 1;
