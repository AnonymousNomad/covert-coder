# Historical Unsloth Runtime Qualification — RT23

> Historical snapshot retained as evidence. Its `PARTIAL` tool and structured-output classifications and its absence of long-run soak are superseded by the V1 closeout record when that record is frozen. This history is not to be edited into current V1 state.

## Verdict

**UNSLOTH RUNTIME ACCEPTED** for the exact native Windows 11 Administrator + Unsloth 2026.9.11 + Vulkan + Liquid GGUF configuration recorded in the [Runtime Passport](evidence/UNSLOTH-RUNTIME-PASSPORT.json).

This does not qualify standard-user installation, AUTO/CUDA/CPU inference, other Unsloth versions, other models, or long-run soak behavior. It makes no cross-backend speed claim.

## Installation and authentication

- Execution context: Windows 11 Home Insider Preview, build 26220, operator-authorized Administrator session. Standard-user installation was not qualified.
- External installation root: E:\Unsloth-Studio-runtime-lab-RT27.
- CLI: E:\Unsloth-Studio-runtime-lab-RT27\bin\unsloth.exe.
- Studio home and caches are isolated under the custom E: runtime root. The process was started API-only on 127.0.0.1:18888 and shut down by its owning adapter; no runtime process remained after shutdown. Windows logon autostart configuration was not separately inspected.
- Version: 2026.9.11.
- The official Windows installation mechanism was used. The exact successful bootstrap script hash was not retained; the earlier 5C6F... hash belongs to a failed staged attempt and is not attributed to this install.
- Bearer authentication passed twice: unauthenticated /v1/models returned 401; authenticated /v1/models returned 200. Two clean shutdown/restart cycles freed the listener and exited the owned launcher. Credential values are absent from all committed evidence.
- Unsloth Studio and CLI remain external user-installed components. No Studio or CLI source was copied, vendored, or bundled. Upstream currently marks its core paths Apache-2.0 and Studio/optional CLI paths AGPLv3; bundling requires a separate compliance decision. See the [upstream license](https://github.com/unslothai/unsloth/blob/main/LICENSE) and [Studio AGPL license](https://github.com/unslothai/unsloth/blob/main/studio/LICENSE.AGPL-3.0).

## GTX 1060 and artifact identity

The installed Unsloth prebuilt marker identifies the llama.cpp backend as Vulkan, release b11160-mix-a6922cc, source commit a3c12db9dfc9a5bdf93df199ec370e9faf117c69, archive SHA-256 67e4cb8f2f52cfba8ea3f21f63db09b87b64b477ae926f629f65ea453b7a3c4d. The verified binary reported llama-server 0.5.0-dev, build 11160, and listed Vulkan0 as NVIDIA GeForce GTX 1060 (6245 MiB visible, 5463 MiB free).

The Windows host reports a GTX 1060 Mobile 6 GB, driver 582.28, and compute capability 6.1. Vulkan loaded and served the model. The installed marker says backend_request=vulkan and has_usable_nvidia=false. AUTO selection was not run; neither CUDA nor CPU inference was tested. This is a Vulkan qualification only and makes no claim that CUDA is supported or unsupported.

The only model artifact used was LFM2.5-2.6B-Q4_K_M.gguf, 1,674,455,040 bytes, SHA-256 02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed. The runner recomputed the hash immediately before each load. The Broker associated the requested local artifact hash with the runtime-reported model; it did not infer artifact identity from the display name.

## Live results

| Check | Result | Evidence |
|---|---|---|
| Discover/version | PASS | CLI discovered; version 2026.9.11 |
| Health/auth | PASS | Two startup/auth/shutdown cycles; 401 without Bearer and 200 with Bearer |
| Device/backend | PASS | Vulkan device list identified GTX 1060; model load used the Vulkan bundle |
| Load/model identity | PASS | Healthy loaded status and exact requested artifact hash |
| Unload/reload | PASS | Unload and same-artifact reload succeeded |
| Non-stream inference | PASS | Five sequential requests; each returned visible text and finish_reason=stop |
| Streaming | PASS | Visible content streamed; TTFT 7.610 s; total 7.979 s |
| Tool call | SUPPORTED FOR THE FROZEN CASE | Correct function and schema-valid arguments; tool was not executed |
| Tool repair attribution | UNKNOWN | Raw pre-repair output unavailable; runtime-adjusted call was valid; no repair claim |
| Structured output | PARTIAL | Strict JSON Schema request returned HTTP 200, but content was empty and schema validation failed |
| Client interruption | PASS | Request interrupted; subsequent health remained HEALTHY |
| Broker cancellation | PASS | Request interrupted; subsequent health remained HEALTHY |
| Failed request recovery | PASS | Invalid request returned 400; next valid request returned visible text |
| Restart/reload | PASS | Owned server stopped, restarted, and loaded the same hash |
| Owned shutdown | PASS | Final status STOPPED; listener and runtime processes absent |
| Long-run soak | NOT RUN | A 30-second loaded hold and repeated sequential requests passed; no extended soak is claimed |

### Frozen generation profile

- Context: 2048 tokens.
- Normal generation: max_tokens=512, temperature=0.
- Prompt: “In one short sentence, explain why a deterministic test suite is useful.”
- Server launch configuration observed: GPU layers -1, context 2048, threads 2, parallel 4, flash attention on, metrics enabled. No explicit batch-size or KV-cache type was captured; those values remain default/unknown.
- Warm-up plus five measured sequential non-stream requests ran before stream, tool, structured-output, cancellation, failure-recovery, reload, and restart checks.
- No direct llama.cpp fallback occurred.

### Performance and resource measurements

- Startup to health: 11.182 s.
- First model load round trip: 47.860 s total; load API round trip 15.137 s.
- Five measured non-stream request latencies: 8.866, 8.047, 8.217, 7.980, 8.139 s; median 8.139 s.
- The server reported 24 prompt tokens and 287 completion tokens per normal request. Median end-to-end completion-token throughput was 35.26 tokens/s. This includes total request latency and must not be read as native decode throughput.
- TTFT: 7.610 s to first visible streamed content. Prompt-processing throughput and backend-native generation throughput were unavailable in the response.
- Minimum free physical RAM: 5.67 GiB.
- Minimum free Windows commit: 3.04 GiB.
- Peak total GPU memory in use: 2,517 MiB, compared with 743 MiB idle before the run. Peak increase was about 1,774 MiB.
- Peak working set of one observed runtime process: 0.86 GiB. This is not the summed private/committed memory of the runtime tree.
- On-disk model artifact: 1.674 GB. Runtime-loaded model byte count was unavailable.
- Adapter metric fields remain null; the RAM, commit, and VRAM values above came from the host monitor.

## Ownership and fallback

The live launcher was Covert-owned. The adapter verified the listener as a descendant of its retained launcher and permitted load, unload, restart, and shutdown. Runtime processes and the managed port were absent after shutdown.

Deterministic tests cover USER_OWNED, FOREIGN, UNKNOWN, occupied-port refusal, explicit operator-authorized fallback, credential redaction, model identity, and qualification invalidation. No foreign process was adopted, queried, reused, or terminated during live qualification. A fallback event was not needed or recorded.

The current post-shutdown status is STOPPED. The sanitized Luna handoff fixture records the last live loaded observation separately from current runtime status; consumers must not treat a saved qualification as proof that a model is loaded now.

## Scope limits

- The normal Covert backend remains Unsloth. Direct llama.cpp is reference/recovery only.
- AUTO, CUDA, CPU, WSL, different-model hot switching, parallel-request behavior, and long-run soak remain unqualified.
- Responses API, Anthropic Messages, embeddings, vision, speculative decoding, and KV-cache controls remain UNKNOWN.
- The adapter's structured-output operation remains fail-closed. The direct Unsloth API test establishes only PARTIAL structured-output behavior for this frozen profile.
- Unsloth's advertised self-healing tool behavior remains a vendor claim here; raw pre-repair output was unavailable.
- Standard-user Windows installation was not tested. This acceptance is limited to the operator-authorized Administrator environment.

## Evidence files

- [Runtime Passport](evidence/UNSLOTH-RUNTIME-PASSPORT.json)
- [Luna #1 sanitized status fixture](evidence/LUNA-RUNTIME-STATUS-FIXTURE.json)
- [Deterministic test results](evidence/RT23-DETERMINISTIC-TEST-RESULTS.json)
- Historical research and methodology: [backend evaluation](LOCAL-RUNTIME-BACKEND-EVALUATION.md), [capability matrix](BACKEND-CAPABILITY-MATRIX.md), [benchmark method](RUNTIME-BENCHMARK-METHODOLOGY.md)

The detailed live-run stdout and host-monitor samples remain outside the repository under `E:\Unsloth-Studio-runtime-lab-RT27\qualification\c1168c1b97852fba8a329e15380389375a9eade0`. The final control trace is in the `00.stdout.jsonl` and `00.resources.jsonl` NTFS streams on `frozen-512-control-20260924T223433-05`; the committed report and Passport contain the summarized measurements.
