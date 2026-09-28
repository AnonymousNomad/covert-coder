---
name: failure-veritas-compile-timeout
description: Diagnose Veritas compile failures caused by its child-command timeout being shorter than a passing full repository check on the supported Windows machine.
---

# Veritas compile budget must fit the real check

## Failure observed

`harness/checks.mjs` invoked `npm run check` with a fixed 600,000 ms timeout. The exact command exited 0 when run directly and completed in 642,054 ms, so Veritas classified a passing compiler/architecture gate as `compile: fail` solely because its child deadline was shorter than observed runtime.

## Procedure

1. Preserve the Veritas result and inspect `COMMAND_TIMEOUTS` in `harness/checks.mjs`.
2. Run the exact failed command directly with live output. Distinguish a nonzero exit from a wrapper timeout; never infer pass or failure from the wrapper label alone.
3. If the direct command exits 0 after the wrapper deadline, raise only the relevant deterministic timeout with measured headroom. Do not modify the check itself or weaken its assertions.
4. Re-run the full Veritas command and require every included check to pass. Keep the evidence report and identify any independent failing test suite separately.

## Guardrails

- Keep the timeout finite and below the outer tool/CI budget.
- Do not silently convert timeout into success or drop the compile check.
- Record observed duration, configured limit, exact command, and final exit status.
