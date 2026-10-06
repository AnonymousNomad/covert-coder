import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(desktop, '..');
const frontend = path.join(root, 'browser', 'dist');
const resources = path.join(desktop, 'resources');
const config = JSON.parse(await readFile(path.join(desktop, 'tauri.conf.json'), 'utf8'));
const expectedProductName = 'Covert Coder';
const stableIdentifier = 'org.ferrellsyntheticintelligence.aide';
if (config.productName !== expectedProductName) throw new Error('desktop productName must remain ' + expectedProductName);
if (config.bundle?.targets !== 'nsis') throw new Error('desktop bundle target must be NSIS Setup.exe');
if (config.identifier !== stableIdentifier) {
  throw new Error('desktop identifier changed from ' + stableIdentifier + '; review WebView data-directory migration before changing it');
}
if (config.app?.windows?.[0]?.title !== expectedProductName) throw new Error('desktop window title must match ' + expectedProductName);
if (!Array.isArray(config.bundle?.icon) || config.bundle.icon.length === 0) throw new Error('desktop bundle must declare platform icon assets');
for (const icon of config.bundle.icon) await access(path.resolve(desktop, icon));
if (config.build?.frontendDist !== '../browser/dist') throw new Error(`Tauri frontendDist is not canonical: ${config.build?.frontendDist}`);

const index = await readFile(path.join(frontend, 'index.html'), 'utf8');
if (!index.includes('<div id="app"></div>') || !index.includes('type="module"')) throw new Error('browser/dist does not contain the typed frontend entrypoint');
if (/src=["'](?:\.\/)?app\.js["']/.test(index)) throw new Error('browser/dist unexpectedly selects the legacy app.js frontend');
const assetFiles = await readdir(path.join(frontend, 'assets'));
if (!assetFiles.some(file => file.endsWith('.js'))) throw new Error('typed frontend JavaScript asset missing');
if (!assetFiles.some(file => file.endsWith('.css'))) throw new Error('typed frontend CSS asset missing');

const nodePtyPrebuild = path.join(resources, 'node_modules', 'node-pty', 'prebuilds', `${process.platform}-${process.arch}`);
const required = [
  path.join(resources, 'academy', 'courses', 'python-foundations.json'),
  path.join(resources, 'plugins', 'README.md'),
  path.join(resources, 'tasks', 'manifest.json'),
  path.join(resources, 'daemon', 'server.mjs'),
  path.join(resources, 'node', 'src', 'server.ts'),
  path.join(resources, 'common', 'facade-route-map.json'),
  path.join(resources, 'scripts', 'facade.mjs'),
  path.join(resources, 'stack-launcher.mjs'),
  path.join(resources, 'models', 'manifest.json'),
  path.join(resources, 'languages', 'manifest.json'),
  path.join(resources, 'debuggers', 'manifest.json'),
  path.join(resources, 'training', 'manifest.json'),
  path.join(resources, 'plugins', 'presets.json'),
  path.join(resources, 'grammar', 'sr-proposal.gbnf'),
  path.join(resources, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node'),
  path.join(resources, 'node_modules', 'zod', 'package.json'),
  path.join(resources, 'node_modules', 'ws', 'package.json'),
  path.join(resources, 'node_modules', 'typescript', 'package.json'),
  path.join(resources, 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs'),
  path.join(resources, 'node_modules', 'node-pty', 'package.json'),
  path.join(nodePtyPrebuild, process.platform === 'win32' ? 'conpty.node' : 'pty.node')
];
if (process.platform === 'win32') {
  required.push(
    path.join(nodePtyPrebuild, 'pty.node'),
    path.join(nodePtyPrebuild, 'winpty-agent.exe'),
    path.join(nodePtyPrebuild, 'winpty.dll'),
    path.join(nodePtyPrebuild, 'conpty', 'conpty.dll'),
    path.join(nodePtyPrebuild, 'conpty', 'OpenConsole.exe')
  );
}
for (const file of required) await access(file);

const sourceLauncher = await readFile(path.join(desktop, 'stack-launcher.mjs'));
const stagedLauncher = await readFile(path.join(resources, 'stack-launcher.mjs'));
if (!sourceLauncher.equals(stagedLauncher)) throw new Error('staged stack launcher differs from its tracked source authority');

async function collectFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(file));
    else files.push(file);
  }
  return files;
}
const packagedFiles = await collectFiles(resources);
const forbiddenWeights = packagedFiles.filter(file => ['.gguf', '.safetensors', '.bin'].includes(path.extname(file).toLowerCase()));
if (forbiddenWeights.length) throw new Error('model weights were staged into immutable resources: ' + forbiddenWeights.join(', '));
const forbiddenDevelopmentFiles = packagedFiles.filter(file => {
  const name = path.basename(file);
  return /\.(?:map|pdb)$/i.test(name) || /^test[-.]|\.test\./i.test(name);
});
if (forbiddenDevelopmentFiles.length) {
  throw new Error('development-only test/debug files were staged into immutable resources: ' + forbiddenDevelopmentFiles.join(', '));
}
const nodePtyRoot = path.join(resources, 'node_modules', 'node-pty');
const nodePtyRuntimeLibPrefix = `lib${path.sep}`;
const nodePtySelectedPrebuildPrefix = path.join('prebuilds', `${process.platform}-${process.arch}`) + path.sep;
const forbiddenNodePtyFiles = packagedFiles.filter(file => {
  const relative = path.relative(nodePtyRoot, file);
  const isNodePtyFile = relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  if (!isNodePtyFile) return false;
  return relative !== 'package.json' &&
    !relative.startsWith(nodePtyRuntimeLibPrefix) &&
    !relative.startsWith(nodePtySelectedPrebuildPrefix);
});
if (forbiddenNodePtyFiles.length) {
  throw new Error('unexpected node-pty files or architectures were staged into immutable resources: ' + forbiddenNodePtyFiles.join(', '));
}
const packagedNames = packagedFiles.map(file => path.basename(file).toLowerCase());
if (packagedNames.some(name => name === 'llama-server' || name === 'llama-server.exe' || name.startsWith('ggml-'))) {
  throw new Error('model runtime binaries were staged into immutable resources');
}
console.log('desktop resources verified (typed frontend; per-user writable state at launch; model weights and model runtime external)');
