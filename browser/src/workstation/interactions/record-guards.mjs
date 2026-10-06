// Presentation input validation only. Canonical owners enforce all access.
export class BoundaryError extends Error {
  constructor(code) { super(code); this.name = 'BoundaryError'; this.code = code; }
}
export const refuse = code => { throw new BoundaryError(code); };
export function record(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) refuse('INVALID_TRANSFER');
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string' || !allowed.includes(key)) || required.some(key => !Object.hasOwn(value, key))) refuse('INVALID_TRANSFER');
  if (Object.values(Object.getOwnPropertyDescriptors(value)).some(d => !Object.hasOwn(d, 'value'))) refuse('INVALID_TRANSFER');
  return value;
}
export function identifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) refuse('INVALID_TRANSFER');
  return value;
}
export function text(value, max = 128) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) refuse('INVALID_TRANSFER');
  return value;
}
export function integer(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) refuse('INVALID_TRANSFER');
  return value;
}
export function snapshotBinding(value) {
  if (value === null) return null;
  record(value, ['projectId', 'rootGeneration']);
  return Object.freeze({ projectId: identifier(value.projectId), rootGeneration: integer(value.rootGeneration) });
}
export function sameBinding(a, b) {
  return a === null ? b === null : !!b && a.projectId === b.projectId && a.rootGeneration === b.rootGeneration;
}
export function parseBoundedJson(raw, maxBytes = 8192) {
  if (typeof raw !== 'string') refuse('INVALID_TRANSFER');
  if (raw.length > maxBytes || new TextEncoder().encode(raw).byteLength > maxBytes) refuse('TRANSFER_TOO_LARGE');
  try { return JSON.parse(raw); } catch { refuse('INVALID_TRANSFER'); }
}
export function freeze(value) {
  if (value && typeof value === 'object') { for (const v of Object.values(value)) freeze(v); Object.freeze(value); }
  return value;
}
