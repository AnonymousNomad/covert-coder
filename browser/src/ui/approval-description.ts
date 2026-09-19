/** Redact credential fields in the review text only; never mutate the request. */
export function approvalDescription(value: unknown): string {
  return JSON.stringify(value, (key, item: unknown) => /^(?:api[_-]?key|key|token|access[_-]?token|refresh[_-]?token|secret|password|credential|proof|authorization|capability)$/i.test(key)
    ? '[REDACTED CREDENTIAL]'
    : item, 2);
}
