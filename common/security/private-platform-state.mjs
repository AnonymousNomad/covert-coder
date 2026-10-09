// Private working records are canonical owner state, never generic project files.
// This is a direct file-capability boundary, not OS/process sandbox containment.
export function isPrivatePlatformStatePath(relativePath, platform = process.platform) {
  const parts = String(relativePath).replaceAll('\\', '/').split('/');
  const normalized = parts.map(part => platform === 'win32' ? part.split(':')[0].replace(/[ .]+$/g, '').toLowerCase() : part).join('/');
  return ['.aide/atlas', '.aide/cipher-laptop', '.aide/platform-projects', '.aide/platform-projects-enrollment.json'].some(root => normalized === root || normalized.startsWith(root + '/'));
}
