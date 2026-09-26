import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const [mode, pidFile] = process.argv.slice(2);
if (mode === 'normal') {
  process.stdout.write('PACKAGING_FIXTURE_NORMAL\n');
  process.exit(0);
} else if (mode === 'crash') {
  process.exit(23);
} else if (mode === 'child-hang') {
  if (pidFile) await writeFile(pidFile, String(process.pid), 'utf8');
  setInterval(() => {}, 1000);
} else if (mode === 'tree-hang') {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'child-hang', pidFile], {
    shell: false,
    windowsHide: true,
    stdio: 'ignore'
  });
  if (pidFile) await writeFile(pidFile + '.parent', String(process.pid), 'utf8');
  child.on('error', () => process.exit(24));
  setInterval(() => {}, 1000);
} else if (mode === 'hang') {
  setInterval(() => {}, 1000);
} else {
  process.stderr.write('unknown fixture mode\n');
  process.exit(2);
}
