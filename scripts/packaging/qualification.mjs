import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  generateArtifactManifest,
  inspectBranding,
  inspectIdentity,
  inspectVersionConsistency,
  verifyArtifactManifest
} from './lib/qualification.mjs';

function options(argv) {
  const result = { positional: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (part.startsWith('--')) {
      const key = part.slice(2);
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('missing value for --' + key);
      result[key] = value;
      index += 1;
    } else result.positional.push(part);
  }
  return result;
}

async function writeResult(result, outputPath) {
  const text = JSON.stringify(result, null, 2) + '\n';
  if (outputPath) await fs.writeFile(path.resolve(outputPath), text, 'utf8');
  process.stdout.write(text);
}

async function main() {
  const parsed = options(process.argv.slice(2));
  const [command] = parsed.positional;
  const root = path.resolve(parsed.root ?? process.cwd());
  if (command === 'identity') return writeResult(await inspectIdentity(root), parsed.out);
  if (command === 'version') {
    const result = await inspectVersionConsistency(root);
    await writeResult(result, parsed.out);
    if (result.status !== 'PASS') process.exitCode = 1;
    return;
  }
  if (command === 'branding') {
    const result = await inspectBranding(root);
    await writeResult(result, parsed.out);
    if (result.status.startsWith('FAIL')) process.exitCode = 1;
    return;
  }
  if (command === 'manifest-create') {
    if (!parsed.dir || !parsed.out) throw new Error('manifest-create requires --dir and --out');
    const inputDirectory = await fs.realpath(parsed.dir);
    const outputPath = path.resolve(parsed.out);
    if (outputPath === inputDirectory || outputPath.startsWith(inputDirectory + path.sep)) {
      throw new Error('manifest output must be outside the artifact directory');
    }
    const manifest = await generateArtifactManifest({
      directory: inputDirectory,
      sourceSha: parsed['source-sha'] ?? null,
      buildVersion: parsed['build-version'] ?? null,
      productIdentity: parsed['product-identity'] ?? null,
      buildTimestamp: parsed['build-timestamp'] ?? null
    });
    return writeResult(manifest, outputPath);
  }
  if (command === 'manifest-verify') {
    if (!parsed.dir || !parsed.manifest) throw new Error('manifest-verify requires --dir and --manifest');
    const manifest = JSON.parse(await fs.readFile(path.resolve(parsed.manifest), 'utf8'));
    const result = await verifyArtifactManifest(manifest, parsed.dir);
    await writeResult(result, parsed.out);
    if (result.status !== 'PASS') process.exitCode = 1;
    return;
  }
  throw new Error('command must be identity, version, branding, manifest-create, or manifest-verify');
}

main().catch(error => {
  process.stderr.write(String(error?.message ?? error) + '\n');
  process.exitCode = 2;
});
