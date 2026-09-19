// Buggy reference module (regression-test benchmark fixture).
// Defect: the 's' branch returns the raw number, so parseDuration('2s') === 2
// instead of 2000. A discriminating test must fail against this file.
export function parseDuration(text) {
  const match = /^(\d+)(ms|s|m)$/.exec(String(text).trim());
  if (!match) throw new Error('invalid duration');
  const value = Number(match[1]);
  if (match[2] === 'ms') return value;
  if (match[2] === 's') return value;
  return value * 60000;
}
