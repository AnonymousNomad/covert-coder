# Covert Local Runtime V1 Support Contract

Status: frozen for the V1 qualification profile. Final run evidence and the configuration-specific passport are recorded in `UNSLOTH-RUNTIME-V1-CLOSEOUT.md` and `evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json`.

## Supported profile

| Field | V1 support |
|---|---|
| OS | Native Windows 11, build 26220 as qualified |
| Execution context | Administrator; operator-authorized |
| Runtime | External Unsloth 2026.9.11 |
| Serving backend | Vulkan |
| GPU | ASUS ROG Strix GL703GM GTX 1060 Mobile 6 GB, compute capability 6.1, driver 582.28 |
| Model | Official `LFM2.5-2.6B-Q4_K_M.gguf` |
| SHA-256 | `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed` |
| Size | `1,674,455,040` bytes |
| Local API | Loopback only, `127.0.0.1:18888` |

The saved qualification proves this exact combination only. The product default is Unsloth. Direct llama.cpp remains an explicit, journaled recovery/reference adapter; no silent fallback is allowed. Other runtime adapters are a developer extension point, not a V1 picker or qualification target.

## Explicitly outside V1 qualification

Standard-user installation, Unsloth AUTO, CUDA, CPU inference, WSL, other operating systems, other GPUs, other artifacts, and other Unsloth versions. These exclusions do not block the frozen V1 profile.

## Runtime state and qualification

Consumers must keep these states separate:

- installed and version matched;
- runtime healthy or stopped;
- artifact available;
- model loaded;
- runtime profile qualified;
- exact artifact qualified.

`health=STOPPED` after clean shutdown is not a failed qualification. A stored qualification remains valid only for its recorded Unsloth version, OS/execution profile, Vulkan backend, GPU/driver profile, model SHA-256, context/generation profile, and evidence set. A material identity change stales the Passport and requires requalification before promotion.

Ownership is `COVERT_OWNED`, `USER_OWNED`, `FOREIGN`, or `UNKNOWN`. Covert may operate a process it started and continues to verify as owned. User-owned lifecycle needs operator action. Foreign and unknown runtimes are never adopted or terminated. A port collision is not evidence of ownership.

On host restart: rediscover the runtime; treat old PID/port data as stale; start only when the configured port is free and the installation identity matches; authenticate; verify health; hash the requested artifact; load only on request; check model identity; then report availability. If Unsloth is unavailable, surface the failure. Direct llama.cpp recovery requires an explicit operator action and a durable fallback event.

## V1 capabilities

The final values from the qualification runner supersede the historical RT23 capability classifications:

- Chat completion: supported for the frozen profile; endpoint contract remains partial outside it.
- Streaming and cancellation: classify from the V1 live run; do not generalize beyond the tested request shape.
- Tool execution: Covert validates one named call and schema, then passes it through Execution Authority. Invalid JSON, traversal, wrong tool, or schema mismatch is rejected before execution. Runtime repair attribution remains `UNKNOWN` unless raw pre-repair output is exposed.
- Native strict structured output: `NOT SUPPORTED — COVERT VALIDATION REQUIRED`. Covert's `RuntimeBroker.inferStructured` removes native response-format dependence, validates the complete JSON value against the supplied strict schema, and returns either `ACCEPTED` or `NEEDS_REVIEW`. It does not repair, coerce, or retry. `NEEDS_REVIEW` carries no accepted value.
- Runtime-native resource metrics and loaded byte count remain `UNKNOWN` unless directly exposed. Host RAM, Windows commit, and VRAM measurements are separate, sourced observations.

## Resource guidance for this machine

Prior accepted observations for the exact profile were 5.67 GiB minimum free physical RAM, 3.04 GiB minimum free Windows commit, 2,517 MiB peak total GPU memory use, and 1,774 MiB increase from idle. Those are observed samples, not universal limits.

For a new interactive load on this machine, use these conservative preflight recommendations: at least 6.5 GiB free RAM, 5 GiB free Windows commit, and 4.5 GiB free VRAM; GPU utilization below 50%; no foreign model runtime; and a free, dedicated loopback port. During a run, stop qualification if free RAM falls below 5.25 GiB, free commit below 2.75 GiB, or free VRAM below 3 GiB. These guardrails are specific operational margins around observed behavior, not claims about all GTX 1060 systems.

## Updates and removal

- Qualified version: `2026.9.11`.
- Automatic upgrade: disabled/not used.
- Any Unsloth, backend, driver, model hash, or material runtime profile change stales the Passport.
- Covert does not bundle Unsloth Studio or CLI components. The V1 install is external/user-managed.
- The Unsloth source license identifies core `unsloth/*`, tests, and scripts as Apache-2.0, while `studio/*` and optional `unsloth_cli/*` are AGPLv3. Covert's V1 distribution does not copy or redistribute those components. This records the observed license boundary; it is not a broader legal opinion. See [upstream license](https://github.com/unslothai/unsloth/blob/main/LICENSE).
- Stop only through verified ownership/lifecycle. For removal, inspect the then-current upstream Windows uninstaller and confirm its target paths before running it; do not run an unreviewed recursive cleanup. Preserve the GGUF, Runtime Passport/evidence, and Covert DPAPI credential slot unless separately and deliberately removed through their own owner. Verify no Unsloth process/listener remains and that Covert reports `NOT_INSTALLED`; Covert does not silently switch runtimes.

## Public-safe wording candidate (not published here)

> **Local inference included in the architecture.** Covert standardizes on Unsloth as its local inference backend, giving the system a consistent model-management and serving layer while retaining an open runtime boundary for developers who require custom infrastructure.
>
> You should not need to choose and assemble an inference server just to start using local intelligence with Covert.

## References

- [V1 installation and reconciliation runbook](UNSLOTH-V1-INSTALL-RUNBOOK.md)
- [Runtime Broker candidate contract](RUNTIME-BROKER-CANDIDATE.md)
- [Historical RT23 qualification](UNSLOTH-RUNTIME-QUALIFICATION-2026-09-24.md)
- [Official Unsloth Windows installer instructions](https://github.com/unslothai/unsloth/blob/main/README.md)
- [Official Unsloth Windows uninstaller](https://raw.githubusercontent.com/unslothai/unsloth/main/scripts/uninstall.ps1)
