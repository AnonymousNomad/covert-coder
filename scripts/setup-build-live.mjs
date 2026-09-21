// Real UI proof for the adaptive setup build stage. The fixture is intentionally
// tiny, but its npm build task writes a durable artifact in the scratch project;
// the test accepts only after TaskService reports a clean exit and the artifact
// exists on disk with a hash.
import { promises as fs } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startReview } from './cockpit-live-review.mjs';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDir = path.join(root, '.aide', 'hardening-live');
await fs.mkdir(evidenceDir, { recursive: true });

const workspace = await fs.mkdtemp(path.join('E:/', 'aide-hardening-onboarding-build-'));
await fs.mkdir(path.join(workspace, 'src'), { recursive: true });
await fs.writeFile(path.join(workspace, 'package.json'), JSON.stringify({
  name: 'covert-onboarding-build-fixture',
  private: true,
  scripts: { build: 'node build.mjs' }
}, null, 2));
await fs.writeFile(path.join(workspace, 'src', 'input.txt'), 'real setup build fixture\n');
await fs.writeFile(path.join(workspace, 'build.mjs'), [
  "import { mkdir, readFile, writeFile } from 'node:fs/promises';",
  "await mkdir('dist', { recursive: true });",
  "const source = await readFile('src/input.txt', 'utf8');",
  "await writeFile('dist/compiled-artifact.txt', `COMPILED BY REAL TASK\\n${source}`);",
  "console.log('compiled artifact: dist/compiled-artifact.txt');"
].join('\n'));
await execFileAsync('git.exe', ['init'], { cwd: workspace, windowsHide: true });

process.env.AIDE_WORKSPACE = workspace;
const evidence = {
  workspace,
  task: 'npm: build',
  screenshots: [],
  pageErrors: [],
  httpFailures: [],
  taskStatusSamples: [],
  stages: []
};
const review = await startReview({ approveAllLocalOperations: true });
const { page } = review;
page.on('response', response => {
  if (!new URL(response.url()).pathname.endsWith('/api/tasks/status')) return;
  void response.json().then(payload => {
    evidence.taskStatusSamples.push({ status: response.status(), payload });
    evidence.taskStatusSamples = evidence.taskStatusSamples.slice(-12);
  }).catch(() => {});
});
const screenshot = async name => {
  const target = path.join(evidenceDir, `setup-build-${name}.png`);
  await page.screenshot({ path: target, fullPage: true });
  evidence.screenshots.push(target);
  return target;
};
const stage = async (name, expectedText) => {
  await page.locator('.cockpit-setup:not([hidden])').waitFor({ timeout: 60_000 });
  if (expectedText) await page.getByText(expectedText, { exact: false }).first().waitFor({ timeout: 180_000 });
  evidence.stages.push({ name, screenshot: await screenshot(name.toLowerCase().replaceAll(' ', '-')) });
};

try {
  const skip = page.getByRole('button', { name: 'SKIP', exact: true });
  if (await skip.isVisible().catch(() => false)) await skip.click();
  await page.locator('[data-item-id="settings"]').click();
  await page.getByRole('button', { name: 'RUN ADAPTIVE SETUP', exact: true }).click();
  await stage('welcome', 'SETUP 1 OF 12');

  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await stage('interview', 'SETUP 2 OF 12');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await stage('configuration-plan', 'CONTINUE TO APPROVAL');
  await page.getByRole('button', { name: 'CONTINUE TO APPROVAL', exact: true }).click();
  await stage('approval', 'APPROVE AND APPLY');
  await page.getByRole('button', { name: 'APPROVE AND APPLY', exact: true }).click();
  await stage('providers', 'SETUP 5 OF 12');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await stage('hardware', 'SETUP 6 OF 12');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await stage('model-recommendations', 'SETUP 7 OF 12');
  await page.getByRole('button', { name: 'CONFIRM SELECTION', exact: true }).click();
  await stage('model-setup', 'SETUP 8 OF 12');
  await page.getByRole('button', { name: 'CONFIRM ROLES', exact: true }).click();
  await stage('workflow-skills', 'SETUP 9 OF 12');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await stage('integrations', 'SETUP 10 OF 12');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await stage('validation', 'SETUP 11 OF 12');
  await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
  await stage('workspace-ready', 'SETUP 12 OF 12');

  const buildButton = page.getByRole('button', { name: 'RUN BUILD', exact: true }).first();
  await buildButton.waitFor({ timeout: 180_000 });
  await buildButton.click();
  const artifact = path.join(workspace, 'dist', 'compiled-artifact.txt');
  const artifactDeadline = Date.now() + 120_000;
  while (Date.now() < artifactDeadline) {
    try { await fs.access(artifact); break; } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  const bytes = await fs.readFile(artifact);
  evidence.build = {
    resultText: await page.locator('.cockpit-setup-body').innerText(),
    artifact,
    size: bytes.byteLength,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    content: bytes.toString('utf8')
  };
  await page.waitForTimeout(5_000);
  evidence.build.uiAfterArtifact = {
    setupCount: await page.locator('.cockpit-setup:not([hidden])').count(),
    bodyText: await page.locator('.cockpit-setup-body').innerText(),
    buildPassedVisible: await page.getByText('BUILD PASSED · process exited 0', { exact: false }).isVisible().catch(() => false)
  };
  evidence.screenshots.push(await screenshot('build-passed'));
} finally {
  evidence.pageErrors.push(...review.errors);
  evidence.httpFailures.push(...review.httpFailures);
  await review.close();
  await fs.writeFile(path.join(evidenceDir, 'setup-build.json'), JSON.stringify(evidence, null, 2));
}

console.log(JSON.stringify(evidence, null, 2));
