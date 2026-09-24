// Model-neutral working-context projections (marathon §10/§12).
// Generic, deterministic, candidate-independent: restates the OPERATOR'S OWN
// requirements in structured form and marks retrieval availability from
// canonical sources. No exam-specific phrases; no expected answers; benefit every
// compatible Resident model. Activated by AIDE_SEAT_PROJECTIONS=1.

// A. Explicit material-obligation projection.
// Detects enumerated requirements in the operator's message generically:
// count phrases ("three things", "two steps"), inline numbered lists, and
// trailing interrogative clauses joined by "and".
export function projectObligations(userMessage) {
  const text = String(userMessage ?? '');
  const obligations = [];
  const counts = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  // Count phrases: "give me three things ... A, B, and C" / "N items only"
  for (const [word, n] of Object.entries(counts)) {
    const re = new RegExp(`\\b${word}\\s+(?:things?|steps?|items?|lines?|parts?|requirements?)\\b[^.]*:?\\s*(.+)`, 'i');
    const m = re.exec(text);
    if (m) {
      const tail = m[1];
      const parts = tail.split(/\s*(?:,|;|\band\b|\bthen\b)\s*/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 120);
      for (const p of parts.slice(0, n + 2)) obligations.push(p.replace(/[.!?]+$/, ''));
      break;
    }
  }
  // Imperative enumerations: "Give me X, Y, and Z." / "State A; B; and C."
  const imperative = /\b(?:give me|tell me|state|report|list|name|cover|include|provide)\b[^.!?]*?([^.!?]{6,300})/i.exec(text);
  if (imperative) {
    const clause = imperative[1];
    const parts = clause.split(/\s*(?:,|;|\band\b)\s*/).map(s => s.trim().replace(/^(?:the|a|an)\s+/i, '')).filter(s => s.length >= 3 && s.length <= 100 && !/^(and|or|then|only|briefly|shortly)$/i.test(s));
    if (parts.length >= 2) for (const p of parts) if (!obligations.includes(p)) obligations.push(p.replace(/[.!?]+$/, ''));
  }
  // Inline numbered requirements: "1) ... 2) ..." or "(1) ... (2) ..."
  const numbered = [...text.matchAll(/(?:^|\s)(?:\(?\d\)?[).:])\s*([^;.!?]{4,120})/g)].map(m => m[1].trim());
  for (const item of numbered) if (!obligations.includes(item)) obligations.push(item);
  // Trailing interrogative clauses: "..., and which role ...?" / "; what X ...?"
  const trailing = [...text.matchAll(/(?:,|;)\s*and\s+(which|what|who|when|where)\s+([^?]{4,120})\?/gi)].map(m => `${m[1]} ${m[2]}`.trim());
  for (const item of trailing) if (!obligations.some(o => o.includes(item))) obligations.push(item);
  if (obligations.length === 0) return null;
  return ['[REQUIRED OBLIGATIONS — every listed item must be satisfied or routed]', ...obligations.slice(0, 6).map((o, i) => `${i + 1}. ${o}`)].join('\n');
}

// B. Retrieval-availability projection.
// Marks, from canonical source classes, whether information is known,
// retrievable, ambiguous or not retrievable. Deterministic; no guesses.
export function projectRetrievalState({ hasSuppliedContext = true, repositoryAvailable = true, removedRecords = false } = {}) {
  const lines = ['[RETRIEVAL STATE]'];
  lines.push(`canonical project/session state: ${hasSuppliedContext ? 'KNOWN (supplied in this context)' : 'RETRIEVABLE (request retrieval)'}`);
  lines.push(`repository history and files: ${repositoryAvailable ? 'RETRIEVABLE (read operations are auto-approved)' : 'NOT_RETRIEVABLE (no repository in this workspace)'}`);
  lines.push('requests whose target is unclear: AMBIGUOUS (ask exactly one necessary question)');
  if (removedRecords) lines.push('records that were deleted or never recorded: NOT_RETRIEVABLE (do not reconstruct or invent)');
  lines.push('rule: use KNOWN state directly; retrieve RETRIEVABLE state before answering; never invent NOT_RETRIEVABLE state.');
  return lines.join('\n');
}
