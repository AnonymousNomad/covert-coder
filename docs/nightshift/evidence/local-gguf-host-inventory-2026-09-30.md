# Local GGUF host inventory and static preflight — 2026-09-30

## Scope and method

- Covert repository: `E:\covert-nightshift-integration`, convergence branch `nightshift/production-convergence-20260926`, source HEAD at capture `c139aaae5695ed8a7e46ee1f34ba9c3eb762c8f4`.
- Bounded host scope: recursive `*.gguf` inventory under `E:\models` only. This is not a whole-machine model scan.
- Found **13 files**, totaling **35,866,683,072 bytes** (about **33.39 GiB**).
- Calculated SHA-256 for each complete file before parsing its header. Then used Covert's existing bounded `probeGguf` parser, which reads header metadata and does not load model weights.
- All 13 files parsed as GGUF v3. Their hashes identify the bytes observed on this host; except where explicitly matched below, they are not vendor signatures or proof of source provenance.
- No model file was moved, imported, registered, changed, loaded, or executed. No provider egress occurred.

## Inventory

`License metadata` is the value reported inside the GGUF header. It is not an independent license review. `Importer preflight` compares only the parsed architecture and embedded chat-template presence against Covert's current import checks (`llama`, `qwen2`, or `lfm2`, and a non-null embedded template). `Compatible-format` means only that this current parser gate accepts the header. `CONFIGURATION_REQUIRED` and `TEMPLATE_UNVERIFIED` describe Covert integration work still needed; they do not mean the model itself is unusable.

| Relative path under `E:\models` | Bytes | SHA-256 | GGUF architecture | License metadata | Embedded template | Current Covert importer preflight |
|---|---:|---|---|---|---|---|
| `house-model/lfm25_gguf/LFM2.5-2.6B-Q4_K_M.gguf` | 1,674,455,040 | `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed` | `lfm2` | `other` | yes | `Compatible-format` |
| `lfm2.5-1.2b-instruct/LFM2.5-1.2B-Instruct-Q8_0.gguf` | 1,246,253,888 | `f6b981dcb86917fa463f78a362320bd5e2dc45445df147287eedb85e5a30d26a` | `lfm2` | `other` | yes | `Compatible-format` |
| `lfm2.5-2.6b-qad-q4_0/LFM2.5-2.6B-QAD-Q4_0.gguf` | 1,593,894,944 | `a247afd6414918eac8e520a9e6137dc271235461ecbe1180462221d5b8d40b03` | `lfm2` | `other` | yes | `Compatible-format` |
| `lfm2.5-thinking/LFM2.5-1.2B-Thinking-Q4_K_M.gguf` | 730,895,360 | `7223a2202405b02e8e1e6c5baa543c43dc98c1d9741a5c2a0ee1583212e1231b` | `lfm2` | `other` | yes | `Compatible-format` |
| `mini-coder-4b-Q8/mini-coder-4b-q4_k_m.gguf` | 2,497,276,672 | `74ffd7563c0b776596d83f088ab19f2670769d8ddbc5963879c6fc33a8c2ccf3` | `qwen3` | `mit` | no | `CONFIGURATION_REQUIRED`; `TEMPLATE_UNVERIFIED` |
| `mini-coder-4b-Q8/mini-coder-4b-q8_0.gguf` | 4,280,401,152 | `dafc64ed744b77addac388835d6f1671358e100317311447161ffa92e20bb039` | `qwen3` | `mit` | no | `CONFIGURATION_REQUIRED`; `TEMPLATE_UNVERIFIED` |
| `north-mini-code/North-Mini-Code-1.0-UD-Q2_K_XL.gguf` | 10,480,001,120 | `3d4687064b2309d79094481ca638b8556d5fa1b720b54d9a3b09cea2f8130ef5` | `cohere2moe` | `apache-2.0` | yes | `CONFIGURATION_REQUIRED` (architecture adapter absent) |
| `Phi-3-mini-4k-instruct-Q4_K_M.gguf` | 2,393,231,360 | `b4d86e76b7e386f5e280500ffcbdfab0f9977c3c8b71191915756bfe0f9ef816` | `phi3` | absent | yes | `CONFIGURATION_REQUIRED` (architecture adapter absent) |
| `Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf` | 1,929,903,360 | `58c3aaf5a98c9ecc326896aa14fe1ff821dea45ecf1c300ca14c1577fa49ae07` | `qwen2` | `other` | yes | `Compatible-format` |
| `qwen3-4b-thinking-coder/Qwen3-4B-MiniMax-M2.1-Coder.q4_k_m.gguf` | 2,497,280,768 | `d08fbe47a9d1d9f369135a04e6c5a523c12c0330d651fca313a0f3bc8576c6ba` | `qwen3` | `apache-2.0` | yes | `CONFIGURATION_REQUIRED` (architecture adapter absent) |
| `qwen3.5-4b-gguf/Qwen3.5-4B-Q5_K_M.gguf` | 3,143,656,608 | `8814232b85594dcd46c50e5b8b29324a7efe9e746edbe8a3d1df3d3fce7aad39` | `qwen35` | `apache-2.0` | yes | `CONFIGURATION_REQUIRED` (architecture adapter absent) |
| `qwen3.5-4b/Qwen_Qwen3.5-4B-Q4_K_M.gguf` | 3,013,027,808 | `13c16f426047e2de38cd075bdade4a7bcbc8c774384876f677740cda65f8a983` | `qwen35` | `apache-2.0` | yes | `CONFIGURATION_REQUIRED` (architecture adapter absent) |
| `smollm2-360m-instruct-q8_0.gguf` | 386,404,992 | `48ab3034d0dd401fbc721eb1df3217902fee7dab9078992d66431f09b7750201` | `llama` | `apache-2.0` | yes | `Compatible-format` |

## Reconciliation with Covert state

- The local SmolLM2 360M file's SHA-256 exactly matches the expected digest in `models/manifest.json`. That pack is marked `optional-pack`; exact bytes and header compatibility do not mean it was selected, imported, loaded, or qualified.
- The manifest's Qwen2.5-Coder 0.5B and 1.5B file-backed packs were not found in this bounded `E:\models` inventory, and the canonical checkout contains no `models/*.gguf` files. The present 3B Qwen2.5 file is a different identity and must not substitute for either target.
- The existing imported Model Access record `lfm2.5-2.6b-q4_k_m-02a8b7e1` has the same full digest as the host file. The source checkpoint's Model Access projection exposed it as `LOCAL_IMPORT` / `INSTALLED`, with expected digest present, observed digest absent, qualification `REQUIRES_PREFLIGHT`, and readiness `SETUP_REQUIRED`. Its persisted artifact record is not proof of a serving route or inference.
- The LFM2.5 2.6B Q4_K_M first row is an exact content match to `LiquidAI/LFM2.5-2.6B-GGUF` at current source revision `e7caca5d835a3901a8e0d63e94009429bafafdfc`: the upstream file has the same 1,674,455,040-byte size and LFS SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`. The historical acquisition revision/date is not recoverable from local records.
- That upstream repository labels the license `other` and supplies `LFM Open License v1.0`; its terms include commercial-use restrictions. This is provenance evidence, not legal advice or an approval to redistribute. For the other 12 host artifacts, adjacent `LICENSE`, `README`, `NOTICE`, `COPYING`, or manifest provenance was not found; their exact source revision and distribution rights remain **UNKNOWN**.
- The exact LFM artifact has a pre-existing V1 Runtime Passport in `docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json`. That older evidence qualifies only its frozen Windows Administrator + Unsloth `2026.9.11` + Vulkan + GTX 1060 Mobile profile. This inventory/runtime-closure work did not repeat that qualification. The imported record's requested `context_tokens=32768` does not prove the effective served context; the Passport records effective context as unknown.

## Qualification and release status

| Gate | Result |
|---|---|
| Full-file SHA-256 and exact byte size | **Observed for 13/13 host files** |
| Covert GGUF header parser | **Passed for 13/13; all version 3** |
| Current architecture/template import preflight | **6 compatible-format; 5 `CONFIGURATION_REQUIRED`; 2 `CONFIGURATION_REQUIRED` plus `TEMPLATE_UNVERIFIED`** |
| Upstream identity and license | **1/13 exact current upstream content match** (LFM2.5 2.6B Q4_K_M; acquisition revision unknown); remaining 12 remain **UNKNOWN** |
| Hardware fit/runtime evidence | **Existing exact-scope Passport only for the LFM2.5 artifact**; no runtime was started in this inventory or closure run. Other 12 have no runtime evidence here. |
| Role qualification from this inventory pass | **None newly established.** The prior LFM Passport does not establish coding, Resident, planning, review, or other role qualification. |

The inventory-time read-only host sample recorded `6,079,884 KiB` free physical memory (about `5.80 GiB`); free commit was not measured in that snapshot. The later full sample below supersedes it for current host state. No model runtime was started.

### Fresh runtime-blocker baseline — 2026-09-30T02:15:46Z

- Physical memory: `5.233 GiB` free of `15.92 GiB` total, below the `6.5 GiB` start floor by about `1.27 GiB`.
- Windows commit: `11.0 GiB` free of `26.28 GiB` limit, above the `5.0 GiB` floor. `Get-Counter` and `Win32_OperatingSystem.FreeVirtualMemory` differed by about 14 MiB in a follow-up read; both remained well above the floor.
- Pagefiles: managed paging is disabled; `C:\pagefile.sys` allocation 7,664 MiB and `E:\pagefile.sys` 2,944 MiB, both active. No pagefile change is indicated by this sample.
- Process ownership: no process command line matched the Covert checkout; no Covert-owned Node/browser/test/runtime/debug process tree or model server was found. The 758 MiB working-set OpenCode process is parented by an interactive `cmd.exe` terminal and has no Covert path marker; it was left untouched. Edge, ChatGPT, WSL service, and OS/user applications were not terminated.
- WSL: no running distro; no `vmmemWSL` process.
- No Covert runtime listener appeared in the listener inventory. The exact workspace and Unsloth runtime ledger/lease state is still to be reconciled before attempting any start.

**Current result:** physical-memory admission is blocked by external/user/OS workload; no Covert-owned cleanup candidate was identified. Commit admission passes. Runtime start remains prohibited until a new immediate preflight meets all profile floors and ownership checks.

### Post-Veritas resource recheck — 2026-09-30T04:25:02Z

- After the full Veritas run closed, the canonical `admitLocalRuntimeStart()` probe returned `REFUSE_RESOURCE`: free physical memory `6,056 MiB` vs. the unchanged `6,656 MiB` floor (short by `600 MiB`); free commit `11,001 MiB` vs. `5,120 MiB`; free VRAM `5,191 MiB` vs. `4,608 MiB`; GPU utilization `7%` vs. `<50%`.
- A companion host sample at `04:21:37Z` reported `6,083 MiB` free physical, `10,993 MiB` free commit, and a `26,915 MiB` commit limit. Pagefiles were active (`C:\pagefile.sys` allocation `7,664 MiB`, current use `2,782 MiB`; `E:\pagefile.sys` allocation `2,944 MiB`, current use `1,670 MiB`). Automatic pagefile management was false. Commit remains over `10 GiB` above the required floor; no pagefile change is indicated by the observed commit pressure.
- No model runtime process or listener remained on ports `18888`, `58697`, `8080`, or `8104`; no WSL distro was running. The only large identifiable non-Covert processes were interactive ChatGPT/Codex, OpenCode, Windows Defender, TextInputHost, Edge, and Explorer. They were left untouched.
- Post-test process census showed no Covert-owned test/debug/model child or local model server. The Veritas-owned test processes exited before this sample; the existing Node processes were Codex tool-host children without Covert/test markers.

**Updated result:** the start gate still refuses on physical RAM alone. Commit, VRAM, and GPU load pass; pagefile/commit is not the cause. Safe headroom requires the owner to close or pause enough interactive user workload and then request a fresh preflight. No unrelated process was terminated.

### Final full-check / Veritas recheck — 2026-09-30T05:07Z

After the full repository check and Veritas completed, no Covert checkout command line, model-runtime listener (`18888`, `58697`, `8080`, `8104`), running WSL distribution, or Covert-owned test/debug/runtime process remained. The latest Windows sample reported 16,307 MiB total / 4,207 MiB free physical, commit limit/used/free 26,915 / 17,828 / 9,087 MiB, and active pagefiles (C: 7,664 MiB allocated / 2,879 MiB current; E: 2,944 / 1,690 MiB). The direct canonical admission probe at `05:07:00Z` measured 4,599 MiB free physical, 9,155 MiB free commit, 5,198 MiB free VRAM, and 6% GPU utilization; it refused on the 6,656 MiB physical floor alone. Windows CIM free physical and Node `os.freemem()` differed by 392 MiB, but both were below the floor. The top observed working sets belonged to interactive/user and Windows processes; none was terminated. This confirms no persistent Covert test/runtime process explains the current physical shortfall.

Model packs remain opt-in. This snapshot adds no model to Covert's registry and does not change Model Manager or Model Access. Once an exact model has provenance, license clearance, hardware admission, and required runtime/quality evidence, expose that qualification through the existing Model Access owners. Do not silently substitute a different local model for a missing manifest target.

## Next dependency

1. Keep live OpenCode execution `UNKNOWN` until the owner-managed auth path and existing spend ceiling are supplied and verified without reading credential contents.
2. Keep local model execution gated until Resource Admission passes the physical-memory, commit, process, lease, and projected-demand checks.
3. Before retrying, close the profile-persistence gap: the generic `.profile.json` sidecar is not consumed by the canonical Unsloth adapter. Wire model-specific settings through the existing Model Manager/Runtime Broker profile owner, and keep unmeasured values `UNKNOWN`; do not invent thread, batch, mmap/mlock, stop-string, or layer-allocation settings.
4. For any selected local candidate, bind its immutable source revision/license and exact digest before runtime tests; preserve `CONFIGURATION_REQUIRED` / `TEMPLATE_UNVERIFIED` without turning importer limits into model rejection.
