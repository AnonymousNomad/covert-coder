---
name: covert-real-model-harness-pilot
description: Govern preflight, setup, controlled execution, and evidence preservation for real local-model harness pilots. Use before model-backed benchmark comparisons, especially scaffold-on versus scaffold-off runs.
---

# Covert real-model harness pilot

## Required sequence

1. Pin the repository, branch, HEAD, dirty files, model artifact, runtime, and runner revision.
2. Confirm the task battery, grader, sampling configuration, and immutable evidence destination.
3. Check the presence of the local Unsloth credential through its approved store; record only a boolean. Never print, copy, or place a token in logs.
4. If the credential is absent, mark the pilot BLOCKED before launching a runtime or loading a model.
5. Measure free physical RAM, free commit, VRAM, GPU use/temperature, and runtime/listener ownership.
6. Require at least 7.25 GiB free RAM and 6.25 GiB free commit throughout the run; account for measured runtime-start cost before admission.
7. Start only the selected supported runtime after auth and resource checks. Re-measure after startup and before model load.
8. Confirm exact model SHA-256, quantization, context fit, sampling settings, and source fingerprints before the first request.
9. Run the fixed paired design with balanced randomized order; change only the scaffold condition.
10. Preserve each raw prompt, response, hash, score, failure, timing, token count, and resource sample without overwrite.

## Safe credential-presence check

- On Windows, invoke a checked script file or tested project command; do not pass inline JavaScript through nested PowerShell `node -e` quoting.
- Emit only a presence boolean; never print the secret, credential file, environment values, or child-process output.
- Remove temporary checker files after use.

## Stop conditions

- Missing credential, HTTP 401/403, unknown listener ownership, or model identity/hash mismatch.
- RAM, commit, or VRAM below the admitted floor at startup or during the experiment.
- Runner, grader, evidence, ordering, or runtime defect.
- The grader executes raw model-generated code without an OS-isolated worker. `node:vm` and Node's Permission Model are not security boundaries for malicious code.
- Any unexplained failure or interruption.

Stop the affected run, record BLOCKED or INVALID with evidence, and do not retry until the cause is understood and the gate is re-established. Never convert an incomplete run into a comparative result.

## Ownership and reporting

Use the adapter's verified ownership for cleanup. Stop only the owned runtime and verify its processes and port are gone; leave user applications untouched.

Report per-task paired results before any aggregate. State the exact model, runtime, configuration, runner, battery, completion count, failures, and limits. Do not infer general model intelligence or cross-harness superiority from one pilot.