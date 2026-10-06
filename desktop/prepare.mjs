import { access, cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(desktop, '..');
const resources = path.join(desktop, 'resources');
const frontend = path.join(root, 'browser', 'dist');
const resourceDirectories = [
  'common',
  'node',
  'workbenches',
  'community',
  'languages',
  'debuggers',
  'training',
  'academy',
  'blueprint',
  'plugins',
  'tasks',
  'session',
  'artifacts',
  'providers',
  'harness',
  'grammar',
  'daemon'
];
const runtimePackages = ['zod', 'ws', 'typescript', 'typescript-language-server'];
const weightExtensions = new Set(['.gguf', '.safetensors', '.bin']);

function isDevelopmentArtifact(name) {
  return /\.(?:map|pdb)$/i.test(name) || /^test[-.]|\.test\./i.test(name);
}

async function copyTree(source, target) {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (isDevelopmentArtifact(entry.name)) continue;
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyTree(sourcePath, targetPath);
      continue;
    }
    if (entry.name.endsWith('.corrupt')) continue;
    if (weightExtensions.has(path.extname(entry.name).toLowerCase())) continue;
    await cp(sourcePath, targetPath);
  }
}

async function exists(filePath) {
  return await access(filePath).then(() => true).catch(() => false);
}

if (!(await exists(path.join(frontend, 'index.html')))) {
  throw new Error(`typed frontend build missing at ${frontend}; run npm run build:frontend`);
}

await rm(resources, { recursive: true, force: true });
await mkdir(resources, { recursive: true });
for (const directory of resourceDirectories) await copyTree(path.join(root, directory), path.join(resources, directory));
await mkdir(path.join(resources, 'scripts'), { recursive: true });
await cp(path.join(root, 'scripts', 'facade.mjs'), path.join(resources, 'scripts', 'facade.mjs'));
await cp(path.join(desktop, 'stack-launcher.mjs'), path.join(resources, 'stack-launcher.mjs'));

const nodeModulesTarget = path.join(resources, 'node_modules');
await mkdir(nodeModulesTarget, { recursive: true });
const stagedVersions = [];
for (const packageName of runtimePackages) {
  const source = path.join(root, 'node_modules', packageName);
  if (!(await exists(source))) throw new Error(`desktop stack dependency ${packageName} missing from node_modules; run npm install`);
  await copyTree(source, path.join(nodeModulesTarget, packageName));
  const version = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8')).version;
  stagedVersions.push(`${packageName}@${version}`);
}
const nodePtySource = path.join(root, 'node_modules', 'node-pty');
const nodePtyTarget = path.join(nodeModulesTarget, 'node-pty');
const nodePtyPrebuildName = `${process.platform}-${process.arch}`;
const nodePtyPrebuildSource = path.join(nodePtySource, 'prebuilds', nodePtyPrebuildName);
if (!(await exists(nodePtySource))) throw new Error('desktop stack dependency node-pty missing from node_modules; run npm install');
if (!(await exists(nodePtyPrebuildSource))) {
  throw new Error(`node-pty prebuilt assets missing for ${nodePtyPrebuildName}; install a package with the matching prebuild`);
}
await mkdir(nodePtyTarget, { recursive: true });
await cp(path.join(nodePtySource, 'package.json'), path.join(nodePtyTarget, 'package.json'));
const keepNodePtyRuntimeFile = sourcePath => !isDevelopmentArtifact(path.basename(sourcePath));
await cp(path.join(nodePtySource, 'lib'), path.join(nodePtyTarget, 'lib'), {
  recursive: true,
  filter: keepNodePtyRuntimeFile
});
await cp(
  nodePtyPrebuildSource,
  path.join(nodePtyTarget, 'prebuilds', nodePtyPrebuildName),
  { recursive: true, filter: sourcePath => !/\.(?:map|pdb)$/i.test(sourcePath) }
);
const nodePtyVersion = JSON.parse(await readFile(path.join(nodePtySource, 'package.json'), 'utf8')).version;
stagedVersions.push(`node-pty@${nodePtyVersion} (${nodePtyPrebuildName})`);
console.log(`staged stack dependencies (${stagedVersions.join(', ')})`);

const modelSource = path.join(root, 'models');
const runtimeModelDir = path.join(resources, 'models');
await mkdir(runtimeModelDir, { recursive: true });
await cp(path.join(modelSource, 'manifest.json'), path.join(runtimeModelDir, 'manifest.json'));

const engineTarget = path.join(resources, 'runtime');
await mkdir(engineTarget, { recursive: true });
await cp(process.execPath, path.join(engineTarget, process.platform === 'win32' ? 'node.exe' : 'node'));

console.log(`canonical typed frontend remains at ${frontend}`);
console.log('model weights and model runtime remain external to application resources');
console.log(`prepared desktop resources at ${resources}`);
