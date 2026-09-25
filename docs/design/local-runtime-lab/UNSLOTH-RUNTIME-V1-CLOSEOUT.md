# Covert Local Runtime V1 Closeout

Status: **BLOCKED — current machine resource start gate is below the qualified profile guardrail.**

This closeout record resumes from the accepted RT23 runtime profile without replacing its historical Passport. The canonical V1 runtime remains Unsloth 2026.9.11 on native Windows 11 Administrator with Vulkan and the official Liquid Q4_K_M artifact. This status does not reopen runtime selection.

## Current preflight

At the latest preflight, `2026-09-25T13:39:43Z`, the shell was Administrator. No Unsloth, llama-server, Ollama, LM Studio, Resident, or DeepSeek process name match was observed, and the reserved runtime ports were free. The read-only adapter snapshot at `2026-09-25T13:38:45Z` reported Unsloth 2026.9.11, `STOPPED`, ownership `UNKNOWN`, no PID, and no loaded model. No credentials were read and no runtime was started.

The runner's start gate requires at least 6.5 GiB free RAM, 5 GiB free Windows commit, 4,608 MiB free VRAM, GPU utilization below 50%, Administrator context, and no runtime process. The measured Node free RAM was 5,802,319,872 bytes (5.404 GiB); free commit was 4,618,084,352 bytes (4.301 GiB); free VRAM was 5,199 MiB; utilization was 28%. RAM and commit are below their thresholds, so live qualification did not start. See `evidence/RT-V1-CURRENT-RESOURCE-GATE.json`.

## Completed safely in this checkpoint

- The installed Unsloth version and GGUF-only profile were reconciled without starting the server: version and install manifest both match 2026.9.11; action was `NO_DESTRUCTIVE_REINSTALL_REQUIRED`; no credential was read.
- The canonical install runbook SHA-256 is `8912571540C57A4147AAF061C9B4BA51DBAEA355C5F2D2F85E4B2F610386A4B2`. The read-only reconciler SHA-256 is `2950FA0516CEAE3410496224E314C4BECCB47CE70AAB169AE245553C717EC8FD`.
- The official artifact was re-hashed without loading it: 1,674,455,040 bytes, SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`.
- Runtime/authority/output validation tests passed 37/37; the Node TypeScript check passed; qualification scripts passed syntax checks.
- A current stopped-state adapter snapshot and sanitized Model Manager / Operator Control fixtures are provided in `evidence/`.
- Selected raw historical traces and the failed resource preflight are inventoried by path, size, hash, and provenance in `evidence/RT-V1-PREQUALIFICATION-EVIDENCE-MANIFEST.json`.

## V1 capability state

- Native strict structured output: **NOT SUPPORTED — COVERT VALIDATION REQUIRED**. Covert's strict validator is deterministic and fail-closed; a malformed result is routed to `NEEDS_REVIEW` with no accepted value and no retry. The prior native strict-schema response was empty/invalid.
- Tool calling: **PARTIAL**. A prior model response produced schema-valid tool arguments, but the complete live Covert execution loop has not been qualified. Runtime repair attribution remains `UNKNOWN`; raw pre-repair output is unavailable in the prior trace.
- Installation reconciliation, prior exact-profile health/auth/lifecycle/inference, and prior restart evidence remain historical evidence. They do not replace the missing closeout soak or new live tool execution case.

## Remaining acceptance gates

The exact remaining blocker is the current safe start gate: free RAM and free commit are below the configured minimum. Therefore this checkpoint does not claim a live tool execution loop, malformed live-call rejection, closeout soak, final V1 Passport, or final V1 acceptance. Do not lower the thresholds, load the model under this snapshot, or treat a lower-load historical run as the missing soak.

When a fresh snapshot clears every start threshold with practical headroom, use the existing qualification runner in its frozen 30-minute profile. Re-hash the official artifact immediately before that run. Preserve the explicit `COVERT_OWNED` lifecycle, exercise the harmless valid and malformed tool cases, run the soak, shut down through the adapter, then issue a new configuration-specific Passport and update the two sanitized handoffs. The prior Passport remains unchanged history.

## Current verdict

**COVERT LOCAL RUNTIME V1 BLOCKED — free RAM (5.404 GiB) and Windows commit (4.301 GiB) are below the qualified runtime start thresholds (6.5 GiB and 5 GiB).**
