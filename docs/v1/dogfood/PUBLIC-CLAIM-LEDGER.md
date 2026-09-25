# PUBLIC CLAIM LEDGER — DOGFOOD WAVE 1

Rules: no claim may be published without a status and evidence. Draft material only; Public Ops
owns `DRAFT → REVIEW → APPROVED → PUBLISH → RECEIPT`. No marketing inflation. No product ranking.

| # | Candidate claim | Status | Evidence | Limitations | Approval |
|---|---|---|---|---|---|
| C-001 | Covert's accepted chat-Authority contract (local → `capability.execute`, external → `capability.external`, unknown target → deny before dispatch, stream/non-stream parity) passes its own frozen contract, security and worktree-preflight suites on the merged dogfood base. | MEASURED RESULT | `tests/arch/chat-authority-contract.test.ts` + `chat-authority-security.test.ts` + `worktree-preflight.test.ts` → 8/8 PASS on `d0d4e40` (this session) | Scope: this repository, this base, these suites. Not a claim about all routes or all builds. | NOT REVIEWED |
| C-002 | Covert's local runtime V1 was qualified for the exact configuration: Windows 11 admin context + Unsloth 2026.9.11 + Vulkan + GTX 1060 6 GB + `LFM2.5-2.6B-Q4_K_M` (sha256 `02a8b7e1…52ed`), with health/auth/load/unload/stream/tool/restart checks passing and owned shutdown verified. | MEASURED RESULT (external lane record) | `docs/design/local-runtime-lab/UNSLOTH-RUNTIME-QUALIFICATION-2026-09-24.md` + `evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json` | One machine, one artifact, one backend (Vulkan); no soak; no standard-user install; no otherwise-backend claims. | NOT REVIEWED |
| C-003 | Under the frozen Wave-1 task and model configuration, Covert produced verified outcomes vs environment Y (comparison results). | DO NOT PUBLISH (not yet measured) | — | Requires CMP runs. | NOT REVIEWED |

## Pre-registered flame guards (things this wave may NOT claim, per directive)

- No "better than <product>" claims, no overall winner, no speed leadership.
- No claim that Covert "makes models smarter" — D/E experiments showed representation effects, not
  model improvement.
- No use of Resident D/E/F research numbers in public material while the Resident program is parked
  and E was not accepted.

## Verified facts recorded this session (internal)

- Dogfood base merge `d0d4e40`; common base `dc0d30e`; authority contract `e41083d`; runtime close
  `e41aafa`; authority suites 8/8 PASS on the merged base.
- Model Manager lane (separate branch) and Resident park worktree untouched by this wave.
