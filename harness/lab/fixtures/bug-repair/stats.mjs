// Fixture module with a deliberate off-by-one defect in average().
// The benchmark prompt inlines this exact source; check.mjs is the objective
// verifier that must pass once the model returns a corrected full file.
export function average(values) {
  let total = 0;
  for (const value of values) total += value;
  return total / (values.length - 1);
}

export function max(values) {
  let best = values[0];
  for (const value of values) if (value > best) best = value;
  return best;
}
