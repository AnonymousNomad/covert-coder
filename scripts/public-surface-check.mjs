import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md', 'THIRD_PARTY_NOTICES.md', 'docs/README.md', 'docs/GETTING_STARTED.md', 'docs/HARNESS_MODES.md', 'docs/assets/README.md', 'docs/assets/branding/README.md', 'docs/assets/screenshots/README.md', 'docs/evidence/final-cockpit-report.md', 'docs/evidence/final-cockpit-design.md'];
const broken = [];
let checked = 0;
for (const file of files) {
  const source = await readFile(path.join(root, file), 'utf8');
  const targets = [...source.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)].map(match => match[1]);
  targets.push(...[...source.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]));
  for (const target of targets) {
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const relative = decodeURIComponent(target.split('#')[0].split('?')[0]);
    try { await access(path.resolve(root, path.dirname(file), relative)); checked++; }
    catch { broken.push({ file, target }); }
  }
}
console.log(JSON.stringify({ files: files.length, checkedLocalPaths: checked, broken }, null, 2));
if (broken.length > 0) process.exitCode = 1;
