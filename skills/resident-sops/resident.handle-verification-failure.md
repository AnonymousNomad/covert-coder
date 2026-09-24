# resident.handle-verification-failure

Method:
1. Report the failure exactly as recorded; do not soften or hide it.
2. Do not retry blindly: identify the failing gate and the smallest reproducible cause first.
3. Choose the response: bounded repair, escalation, or stop-and-report — with the reason stated.
4. Re-verify after any repair; a fix without a rerun of the failed gate is not a fix.

Boundary: failures are surfaced to the operator; nothing ships on a failed gate, and retries are bounded and disclosed.
