// Private working records are canonical owner state, never generic project files.
// This is a direct file-capability boundary, not OS/process sandbox containment.
export function isPrivatePlatformStatePath(relativePath, platform = process.platform) {
  const parts = String(relativePath).replaceAll('\\', '/').split('/');
  const normalized = parts.map(part => platform === 'win32' ? part.replace(/[ .]+$/g, '').toLowerCase() : part).join('/');
  return normalized === '.aide/cipher-laptop' || normalized.startsWith('.aide/cipher-laptop/');
}
