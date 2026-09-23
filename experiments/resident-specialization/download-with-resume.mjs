// Resumable direct downloader for candidate artifacts (HF resolve URLs).
// Chunked range requests with stall detection; resume from a .part file.
// Usage: node download-with-resume.mjs <url> <destPath> [expectedBytes]
import { promises as fs, createWriteStream, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const [url, dest] = process.argv.slice(2);
if (!url || !dest) throw new Error('usage: node download-with-resume.mjs <url> <dest>');
const CHUNK = 8 * 1024 * 1024;
const STALL_MS = 45000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let total = 0;
{
  const head = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if (!head.ok) throw new Error(`HEAD failed: ${head.status}`);
  total = Number(head.headers.get('content-length') ?? 0);
}
const part = `${dest}.part`;
let offset = 0;
if (existsSync(part)) offset = (await fs.stat(part)).size;
console.log(`[dl] ${path.basename(dest)} total=${total} resume_from=${offset}`);

let attempt = 0;
while (offset < total) {
  attempt += 1;
  if (attempt > 400) throw new Error('too many attempts');
  const controller = new AbortController();
  const stall = setTimeout(() => controller.abort(new Error('stall')), STALL_MS);
  try {
    const response = await fetch(url, { headers: { range: `bytes=${offset}-${Math.min(offset + CHUNK - 1, total - 1)}` }, redirect: 'follow', signal: controller.signal });
    if (!response.ok && response.status !== 206) throw new Error(`range failed: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    clearTimeout(stall);
    await fs.appendFile(part, buffer);
    offset += buffer.length;
    if (attempt % 2 === 0 || offset === total) console.log(`[dl] ${(offset / 2 ** 20).toFixed(1)}/${(total / 2 ** 20).toFixed(1)} MiB`);
  } catch (error) {
    clearTimeout(stall);
    console.log(`[dl] chunk attempt ${attempt} failed (${String(error.name ?? error).slice(0, 40)}); retrying from ${(offset / 2 ** 20).toFixed(1)} MiB`);
    await sleep(3000);
  }
}
await fs.rename(part, dest);
const hash = createHash('sha256');
hash.update(await fs.readFile(dest));
console.log(`[dl] DONE ${path.basename(dest)} bytes=${(await fs.stat(dest)).size} sha256=${hash.digest('hex')}`);
