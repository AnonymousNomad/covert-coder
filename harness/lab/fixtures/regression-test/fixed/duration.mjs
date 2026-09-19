// Fixed reference module (regression-test benchmark fixture).
export function parseDuration(text) {
  const match = /^(\d+)(ms|s|m)$/.exec(String(text).trim());
  if (!match) throw new Error('invalid duration');
  const value = Number(match[1]);
  if (match[2] === 'ms') return value;
  if (match[2] === 's') return value * 1000;
  return value * 60000;
}
