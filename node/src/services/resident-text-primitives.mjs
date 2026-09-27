// Shared deterministic lexical primitives for the Resident retrieval and envelope diagnostics.
const STOPWORDS = new Set(
  'about above after again against all also any are because been before being below between both but can could did does doing down during each few for from further had has have having her here hers herself him himself his how into its itself more most nor not off once only other our ours ourselves out over own same she should some such than that the their theirs them themselves then there these they this those through too under until very was were what when where which while who whom why will with would you your yours yourself yourselves and'.split(' ')
);

export function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9_/-]{3,}/g) || []).filter(token => !STOPWORDS.has(token));
}

export function bigrams(tokens) {
  const out = new Set();
  for (let i = 0; i + 1 < tokens.length; i += 1) out.add(`${tokens[i]} ${tokens[i + 1]}`);
  return out;
}
