import { BoundaryError, record, identifier, text, snapshotBinding, parseBoundedJson, freeze, refuse } from './record-guards.mjs';

const list = (value, normalize, key = x => x) => {
  if (!Array.isArray(value) || value.length > 32) refuse('INVALID_TRANSFER');
  const result = value.map(normalize);
  if (new Set(result.map(key)).size !== result.length) refuse('INVALID_TRANSFER');
  return result;
};
const optionalList = (value, normalize, key) => value === undefined ? [] : list(value, normalize, key);
const geometry = (value, min, max) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) refuse('INVALID_TRANSFER');
  return value;
};

export function parseEnvironmentProfile(raw) {
  try {
    const value = record(parseBoundedJson(raw, 65536),
      ['version', 'id', 'title', 'layout', 'applications', 'tools', 'terminals', 'modelRoles', 'workflowRefs', 'shortcuts'],
      ['version', 'id', 'title']);
    if (value.version !== 1) refuse('INVALID_TRANSFER');
    const title = text(value.title).trim();
    if (!title) refuse('INVALID_TRANSFER');
    let layout = { version: 1, windows: [] };
    if (value.layout !== undefined) {
      record(value.layout, ['version', 'windows']);
      if (value.layout.version !== 1) refuse('INVALID_TRANSFER');
      layout = { version: 1, windows: list(value.layout.windows, window => {
        record(window, ['instanceId', 'appRef', 'x', 'y', 'width', 'height', 'minimized'], ['instanceId', 'appRef', 'x', 'y', 'width', 'height']);
        if (window.minimized !== undefined && typeof window.minimized !== 'boolean') refuse('INVALID_TRANSFER');
        return { instanceId: identifier(window.instanceId), appRef: identifier(window.appRef),
          x: geometry(window.x, -32768, 32768), y: geometry(window.y, -32768, 32768),
          width: geometry(window.width, 100, 8192), height: geometry(window.height, 100, 8192),
          ...(window.minimized === undefined ? {} : { minimized: window.minimized }) };
      }, x => x.instanceId) };
    }
    return freeze({
      version: 1, id: identifier(value.id), title, layout,
      applications: optionalList(value.applications, identifier),
      tools: optionalList(value.tools, identifier),
      terminals: optionalList(value.terminals, terminal => {
        record(terminal, ['id', 'profileRef', 'cwdRef']);
        return { id: identifier(terminal.id), profileRef: identifier(terminal.profileRef), cwdRef: identifier(terminal.cwdRef) };
      }, x => x.id),
      modelRoles: optionalList(value.modelRoles, role => {
        record(role, ['role', 'modelRef', 'routeRef'], ['role', 'modelRef']);
        return { role: identifier(role.role), modelRef: identifier(role.modelRef),
          ...(role.routeRef === undefined ? {} : { routeRef: identifier(role.routeRef) }) };
      }, x => x.role),
      workflowRefs: optionalList(value.workflowRefs, identifier),
      shortcuts: optionalList(value.shortcuts, shortcut => {
        record(shortcut, ['id', 'commandRef']);
        return { id: identifier(shortcut.id), commandRef: identifier(shortcut.commandRef) };
      }, x => x.id),
    });
  } catch (error) {
    throw new BoundaryError(error instanceof BoundaryError && error.code === 'TRANSFER_TOO_LARGE' ? 'PROFILE_TOO_LARGE' : 'INVALID_PROFILE');
  }
}

// This computes declarations, not readiness or permission. Adoption remains a
// separate canonical project transaction after inspection and operator action.
export function inspectEnvironmentProfile(raw, { binding, lookupCapability } = {}) {
  const profile = parseEnvironmentProfile(raw);
  let project;
  try { project = snapshotBinding(binding); }
  catch { throw new BoundaryError('INVALID_PROFILE'); }
  if (!project) throw new BoundaryError('PROJECT_REQUIRED');
  if (lookupCapability !== undefined && typeof lookupCapability !== 'function') throw new TypeError('Read-only capability lookup required');
  const refs = new Map();
  const add = (kind, id) => refs.set(kind + ':' + id, { kind, id });
  for (const id of profile.applications) add('application', id);
  for (const frame of profile.layout.windows) add('application', frame.appRef);
  for (const id of profile.tools) add('tool', id);
  for (const terminal of profile.terminals) { add('terminal-profile', terminal.profileRef); add('directory', terminal.cwdRef); }
  for (const role of profile.modelRoles) { add('model', role.modelRef); if (role.routeRef) add('route', role.routeRef); }
  for (const id of profile.workflowRefs) add('workflow', id);
  for (const shortcut of profile.shortcuts) add('command', shortcut.commandRef);
  const references = [...refs.values()].map(ref => {
    let presence = 'UNKNOWN';
    let revision;
    if (lookupCapability) {
      try {
        const fact = record(lookupCapability(freeze({ ...ref, project })), ['presence', 'revision'], ['presence']);
        if (!['PRESENT', 'MISSING', 'UNKNOWN'].includes(fact.presence)) refuse('INVALID_TRANSFER');
        presence = fact.presence;
        if (fact.revision !== undefined) revision = identifier(fact.revision);
      } catch { presence = 'UNKNOWN'; revision = undefined; }
    }
    return { ...ref, presence, ...(revision === undefined ? {} : { revision }) };
  });
  const select = presence => references.filter(x => x.presence === presence).map(({ kind, id }) => ({ kind, id }));
  return freeze({ profile, project, activation: 'DISABLED', references, missing: select('MISSING'), unknown: select('UNKNOWN') });
}
