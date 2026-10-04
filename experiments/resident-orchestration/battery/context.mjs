// Benchmark-leakage defense helpers (MISSION 8) + message composition.
// Evaluation truth (task.expect) must NEVER enter the candidate context.
// buildTaskMessage accepts ONLY the prompt string — it cannot leak expectations
// by construction; the test asserts this against the frozen battery.
export function buildTaskMessage(baseContext, sopLine, prompt) {
  return `${baseContext}\n${sopLine}\n\n[TASK]\n${String(prompt)}`;
}
