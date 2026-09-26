import fs from 'node:fs';
import path from 'node:path';

export const ROUTING_PREFERENCES = Object.freeze(['local-first', 'local-only', 'api-keys-with-approval']);
export const DEFAULT_ROUTING_PREFERENCE = 'local-first';

export class RoutingPreferenceError extends Error {
  constructor(message = 'workspace routing preference is unavailable or invalid') {
    super(message);
    this.name = 'RoutingPreferenceError';
    this.code = 'NOT_READY';
  }
}

function contained(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

// This reads the existing Provider Connections preference. Missing state keeps
// the established local-first default; malformed, linked, unreadable, or
// out-of-workspace state is UNKNOWN and therefore blocks external dispatch.
export function readRoutingPreference(workspace, preferencePath = undefined) {
  if (typeof workspace !== 'string' || workspace.length === 0) throw new RoutingPreferenceError();
  const root = path.resolve(workspace);
  const target = path.resolve(preferencePath ?? path.join(root, '.aide', 'routing-preference.json'));
  if (!contained(root, target)) throw new RoutingPreferenceError();

  let rootInfo;
  try { rootInfo = fs.lstatSync(root); }
  catch (error) {
    if (error?.code === 'ENOENT') throw new RoutingPreferenceError();
    throw new RoutingPreferenceError();
  }
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new RoutingPreferenceError();

  const parent = path.dirname(target);
  let parentInfo;
  try { parentInfo = fs.lstatSync(parent); }
  catch (error) {
    if (error?.code === 'ENOENT') return DEFAULT_ROUTING_PREFERENCE;
    throw new RoutingPreferenceError();
  }
  if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) throw new RoutingPreferenceError();

  let fileInfo;
  try { fileInfo = fs.lstatSync(target); }
  catch (error) {
    if (error?.code === 'ENOENT') return DEFAULT_ROUTING_PREFERENCE;
    throw new RoutingPreferenceError();
  }
  if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) throw new RoutingPreferenceError();

  try {
    const rootReal = fs.realpathSync(root);
    const parentReal = fs.realpathSync(parent);
    const targetReal = fs.realpathSync(target);
    if (!contained(rootReal, parentReal) || !contained(rootReal, targetReal)) throw new RoutingPreferenceError();
    const value = JSON.parse(fs.readFileSync(target, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        typeof value.preference !== 'string' || !ROUTING_PREFERENCES.includes(value.preference)) {
      throw new RoutingPreferenceError();
    }
    return value.preference;
  } catch (error) {
    if (error instanceof RoutingPreferenceError) throw error;
    throw new RoutingPreferenceError();
  }
}
