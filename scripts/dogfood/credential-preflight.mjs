// Dogfood preflight: verify the qualification-time DPAPI credential can be read
// READ-ONLY by this Windows account, with zero secret exposure.
// Prints only: file presence, retrievable boolean, length class, leak checks.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { CredentialStore } from '../../node/src/services/credentials.ts';

const QUALIFICATION_ROOT = process.env.DOGFOOD_QUALIFICATION_ROOT ?? 'E:\\Unsloth-Studio-runtime-lab-RT27\\qualification\\c1168c1b97852fba8a329e15380389375a9eade0';
const CREDENTIAL_ID = 'unsloth-local-runtime';
const EVIDENCE_PATH = path.resolve('docs', 'v1', 'dogfood', 'evidence', 'CREDENTIAL-PREFLIGHT.json');

const result = {
  schema: 'dogfood-credential-preflight-v1',
  at: new Date().toISOString(),
  qualification_root: '<redacted-local-path-class>',
  credential_id: CREDENTIAL_ID,
  store_file_present: false,
  retrievable: false,
  value_length_class: null,
  plaintext_in_store_file: null,
  value_in_report: false,
  exfiltration_checks: {}
};

const storeFile = path.join(QUALIFICATION_ROOT, '.aide', 'credentials.dpapi');
try {
  const stat = await fs.stat(storeFile);
  result.store_file_present = stat.isFile();
} catch { result.store_file_present = false; }

let secret = null;
try {
  const store = new CredentialStore(QUALIFICATION_ROOT);
  secret = await store.get(CREDENTIAL_ID);
  result.retrievable = typeof secret === 'string' && secret.trim().length > 0;
  result.value_length_class = secret ? `${Math.floor(secret.length / 16) * 16}-${Math.floor(secret.length / 16) * 16 + 15}` : null;
} catch (error) {
  result.error = String(error instanceof Error ? error.message : error).slice(0, 120);
}

if (secret) {
  // Leak check 1: DPAPI blob must not contain the plaintext secret.
  try {
    const raw = await fs.readFile(storeFile, 'utf8');
    result.plaintext_in_store_file = raw.includes(secret);
  } catch { result.plaintext_in_store_file = null; }
  // Leak check 2: the serialized report must not contain it.
  const serialized = JSON.stringify(result);
  result.exfiltration_checks.report_contains_secret = serialized.includes(secret);
  result.exfiltration_checks.secret_printed = false;
} else {
  result.exfiltration_checks.report_contains_secret = false;
  result.exfiltration_checks.secret_printed = false;
}

await fs.mkdir(path.dirname(EVIDENCE_PATH), { recursive: true });
await fs.writeFile(EVIDENCE_PATH, JSON.stringify(result, null, 2));
console.log(JSON.stringify({
  store_file_present: result.store_file_present,
  retrievable: result.retrievable,
  value_length_class: result.value_length_class,
  plaintext_in_store_file: result.plaintext_in_store_file,
  report_contains_secret: result.exfiltration_checks.report_contains_secret,
  error: result.error ?? null
}));
