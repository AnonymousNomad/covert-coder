import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function runDpapi(mode, data) {
  // Keep the payload out of process arguments and command text. The typed
  // credential service uses this same environment-variable transport because
  // PowerShell's command-line parsing can otherwise corrupt or expose payloads.
  const b64Payload = mode === 'protect' ? Buffer.from(data, 'utf8').toString('base64') : data;
  const script =
    mode === 'protect'
      ? 'Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String($env:AIDE_DPAPI_IN); $e=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Convert]::ToBase64String($e)'
      : 'Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String($env:AIDE_DPAPI_IN); $d=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Text.Encoding]::UTF8.GetString($d)';
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
      env: { ...process.env, AIDE_DPAPI_IN: b64Payload }
    }
  );
  const output = typeof result.stdout === 'string' ? result.stdout.trim() : '';
  if (result.error || result.status !== 0 || !output) throw new Error(`dpapi ${mode} failed`);
  return output;
}

export function createSecretStore(options = {}) {
  const secretsPath = options.secretsPath;
  const protect = options.protect ?? (plaintext => runDpapi('protect', plaintext));
  const unprotect = options.unprotect ?? (cipher => runDpapi('unprotect', cipher));
  const allowPlaintext = process.env.AIDE_ALLOW_PLAINTEXT_SECRETS === '1';

  function readAll() {
    try {
      const raw = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
      return typeof raw === 'object' && raw ? raw : {};
    } catch {
      return {};
    }
  }

  function writeAll(map) {
    fs.mkdirSync(path.dirname(secretsPath), { recursive: true });
    const tmp = `${secretsPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(map, null, 1), 'utf8');
    fs.renameSync(tmp, secretsPath);
  }

  function setKey(providerId, apiKey) {
    if (!protect || !unprotect) throw Object.assign(new Error('secret storage unavailable'), { code: 'NOT_SUPPORTED' });
    let stored;
    try {
      stored = protect(apiKey);
    } catch (error) {
      if (!allowPlaintext) throw Object.assign(new Error(`dpapi unavailable and plaintext forbidden: ${error.message}`), { code: 'NOT_SUPPORTED' });
      stored = `plain:${apiKey}`;
    }
    const map = readAll();
    map[providerId] = stored;
    writeAll(map);
  }

  function getKey(providerId) {
    const entry = readAll()[providerId];
    if (!entry) return null;
    if (entry.startsWith('plain:')) return entry.slice(6);
    try {
      return unprotect(entry);
    } catch {
      return null;
    }
  }

  function deleteKey(providerId) {
    const map = readAll();
    if (!(providerId in map)) return false;
    delete map[providerId];
    writeAll(map);
    return true;
  }

  function listProviderIds() {
    return Object.keys(readAll());
  }

  return { setKey, getKey, deleteKey, listProviderIds };
}
