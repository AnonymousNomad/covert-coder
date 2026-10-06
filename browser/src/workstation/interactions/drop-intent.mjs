import { BoundaryError, refuse, record, identifier, text, integer, snapshotBinding, sameBinding, parseBoundedJson, freeze } from './record-guards.mjs';

// Payload provenance is not authentication. No effect or grant API is exposed.
const routes = {
  project: { desktop: 'project.open.preview' },
  file: { editor: 'file.open.preview', cipher: 'context.attach.preview' },
  'model-artifact': { models: 'model.inspect.preview' },
  profile: { profiles: 'profile.apply.preview' },
  tool: { launcher: 'tool.inspect.preview' },
  application: { launcher: 'application.inspect.preview' },
};

export function parseDropIntent(transfer, target, currentBinding) {
  const project = snapshotBinding(currentBinding);
  record(transfer, ['mime', 'data', 'files'], ['mime']);
  if (transfer.mime === 'application/x-covert-file-hint') {
    record(transfer, ['mime', 'files']);
    if (!['editor', 'models'].includes(target)) refuse('UNSUPPORTED_DROP');
    if (!project) refuse('PROJECT_REQUIRED');
    if (!Array.isArray(transfer.files) || transfer.files.length !== 1) refuse('INVALID_TRANSFER');
    const descriptor = Object.getOwnPropertyDescriptor(transfer.files, '0');
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) refuse('INVALID_TRANSFER');
    const value = record(descriptor.value, ['name', 'size', 'type', 'lastModified']);
    const name = text(value.name, 255);
    if (!name || /[/\\]/.test(name)) refuse('INVALID_TRANSFER');
    return freeze({ version: 1, kind: 'external-file.inspect', project, activation: 'DISABLED',
      file: { name, size: integer(value.size), type: text(value.type, 128), lastModified: integer(value.lastModified) } });
  }
  if (transfer.mime !== 'application/vnd.covert.resource+json') refuse('UNSUPPORTED_DROP');
  record(transfer, ['mime', 'data']);
  const value = record(parseBoundedJson(transfer.data), ['version', 'kind', 'id', 'revision', 'project'], ['version', 'kind', 'id', 'revision']);
  if (value.version !== 1 || typeof value.kind !== 'string' || !Object.hasOwn(routes, value.kind)) refuse('INVALID_TRANSFER');
  const kind = Object.hasOwn(routes[value.kind], target) ? routes[value.kind][target] : null;
  if (!kind) refuse('UNSUPPORTED_DROP');
  if (value.kind === 'file' && !project) refuse('PROJECT_REQUIRED');
  if (value.kind === 'file' && !Object.hasOwn(value, 'project')) refuse('INVALID_TRANSFER');
  if (Object.hasOwn(value, 'project') && !sameBinding(snapshotBinding(value.project), project)) refuse('PROJECT_MISMATCH');
  return freeze({ version: 1, kind, project, activation: 'DISABLED',
    resource: { kind: value.kind, id: identifier(value.id), revision: identifier(value.revision) } });
}

export function createDropInspector({ getBinding, inspectResource, timeoutMs = 5000, maxPending = 8 }) {
  if (typeof getBinding !== 'function' || (inspectResource !== undefined && typeof inspectResource !== 'function')) throw new TypeError('Owner read callbacks required');
  integer(timeoutMs, 1, 30000); integer(maxPending, 1, 16);
  let epoch = 0;
  let disposed = false;
  const pending = new Set();
  const invalidate = () => { epoch++; for (const controller of pending) controller.abort(); };
  return Object.freeze({
    invalidate,
    dispose() { disposed = true; invalidate(); },
    async stage(transfer, target) {
      if (disposed) return freeze({ status: 'REFUSED', code: 'DISPOSED' });
      let intent;
      try { intent = parseDropIntent(transfer, target, getBinding()); }
      catch (error) { return freeze({ status: 'REFUSED', code: error instanceof BoundaryError ? error.code : 'INVALID_TRANSFER' }); }
      // Names/sizes are hints, not authenticated host file handles. The native
      // owner must register a scoped selection before any acquisition path.
      if (intent.kind === 'external-file.inspect') return freeze({ status: 'UNAVAILABLE', code: 'NATIVE_FILE_SELECTION_REQUIRED' });
      if (!inspectResource) return freeze({ status: 'UNAVAILABLE', code: 'OWNER_UNAVAILABLE' });
      if (pending.size >= maxPending) return freeze({ status: 'REFUSED', code: 'BUSY' });
      const generation = epoch;
      const controller = new AbortController();
      pending.add(controller);
      let timer;
      let abortListener;
      const cancelled = new Promise((_, reject) => {
        abortListener = () => reject(new BoundaryError('CANCELLED'));
        controller.signal.addEventListener('abort', abortListener, { once: true });
      });
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new BoundaryError('INSPECTION_TIMEOUT')), timeoutMs); });
      const ownerRead = Promise.resolve().then(() => {
        if (controller.signal.aborted || !sameBinding(intent.project, snapshotBinding(getBinding()))) return undefined;
        return inspectResource(intent, { signal: controller.signal });
      }).catch(() => { throw new BoundaryError('OWNER_UNAVAILABLE'); });
      // A timed-out/cancelled owner that ignores AbortSignal still occupies a slot.
      // We do not claim cancellation of its real work merely because we stopped waiting.
      ownerRead.then(() => pending.delete(controller), () => pending.delete(controller));
      try {
        const owner = await Promise.race([ownerRead, cancelled, timeout]);
        if (disposed || generation !== epoch) refuse('CANCELLED');
        if (!sameBinding(intent.project, snapshotBinding(getBinding()))) refuse('PROJECT_CHANGED');
        const value = record(owner, ['kind', 'id', 'revision', 'label']);
        const selected = intent.resource;
        if (!selected || value.kind !== selected.kind || value.id !== selected.id || value.revision !== selected.revision) refuse('RESOURCE_CHANGED');
        return freeze({ status: 'PREVIEW', activation: 'DISABLED', intent,
          preview: { label: text(value.label), ownerRevision: identifier(value.revision) } });
      } catch (error) {
        if (error instanceof BoundaryError && error.code === 'INSPECTION_TIMEOUT') controller.abort();
        return freeze({ status: 'REFUSED', code: error instanceof BoundaryError ? error.code : 'OWNER_UNAVAILABLE' });
      } finally {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', abortListener);
      }
    },
  });
}
