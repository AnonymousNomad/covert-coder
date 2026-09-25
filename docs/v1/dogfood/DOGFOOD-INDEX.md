# COVERT DOGFOOD / COMPETITIVE VALIDATION — WAVE 1 INDEX

Status: **WAVE 1 IN PROGRESS** (foundation frozen; missions not yet run)
Owner: DeepSeek · Date opened: 2026-09-25

## Environment (verified this session)

| Item | Value |
|---|---|
| Dogfood worktree | `E:\aide-covert-dogfood-v1` |
| Branch | `research/covert-dogfood-v1` |
| Base | `research/local-runtime-bakeoff` @ `e41aafa` (runtime V1 close) + merge `fix/authority-chat-contract-v1` @ `e41083d` |
| Merge commit | `d0d4e40` ("Merge branch 'fix/authority-chat-contract-v1' into research/covert-dogfood-v1") — merge clean, exit 0 |
| Common base | `dc0d30e` (certified core; both accepted branches derive from it) |
| Authority contract checkpoint | `e41083dab6a5a23e625a824527d11a2ba7623303` |
| Runtime checkpoint | `e41aafa1b723d14981af8882f44a0de782170076` |
| Runtime Passport | `docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json` (passport SHA `921af210…` per directive; verify at run time) |
| Model artifact | `LFM2.5-2.6B-Q4_K_M.gguf` — 1,674,455,040 B · sha256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed` (models/ junctioned from the main checkout; hash reverify required before each load) |
| node_modules | junctioned to the main checkout (no install duplication) |

**Verification already performed on this base:** `tests/arch/chat-authority-contract.test.ts` +
`chat-authority-security.test.ts` + `worktree-preflight.test.ts` → **8/8 PASS** (accepted
Authority chat contract works on the merged base).

## Qualified runtime (recovered recipe; credential provisioning pending)

- Install root: `E:\Unsloth-Studio-runtime-lab-RT27` · CLI wrapper `bin\unsloth.cmd` ·
  managed python `unsloth_studio\Scripts\python.exe` · port **18888** (API-only, loopback).
- Adapter: `node/src/services/unsloth-runtime-adapter.ts` (`UnslothRuntimeAdapter`,
  credential id `unsloth-local-runtime`); broker: `RuntimeBroker` in `runtime-adapter.ts`.
- Launch pattern (from `scripts/qualification/unsloth-runtime-v1-closeout.mjs`):
  `UNSLOTH_STUDIO_HOME=<installRoot>`; `new UnslothRuntimeAdapter({ workspace, cliPath, port: 18888,
  credentialStore })`; `new RuntimeBroker(adapter, null, workspace)`; bearer credential from
  `CredentialStore` at `<workspace>/.aide/credentials.dpapi` (DPAPI).
- **OPEN (next action):** re-provision/read the bearer credential workspace used at
  qualification (the runtime-lab worktree has no `.aide`; the DPAPI file lived in the
  qualification-time workspace). Bearer is required: unauthenticated `/v1/models` = 401.
- Frozen runtime generation profile: ctx 2048 · normal max_tokens 512 · temperature 0 ·
  GPU layers -1 · flash attention on (qualification record).
- Resource gates from the qualification runner (must pass before load): administrator context,
  free RAM ≥ 6.5 GiB, free commit ≥ 5 GiB, free VRAM ≥ 4608 MiB, GPU utilization < 50%.

## Wave 1 plan (bounded, per directive)

```text
DF-M000  read-only defect analysis on a disposable project      (PENDING)
DF-M001  bounded write: fix + test + verify lifecycle           (PENDING)
DF-M002  controlled failure / recovery                          (PENDING)
DF-M003  structured handoff mid-work                            (PENDING)
DF-M004  Covert-on-Covert low-risk repair (only if 0–3 safe)    (PENDING)
CMP-001..CMP-003+  controlled comparisons (Covert vs 3 products) (PENDING)
```

## First-run preflight checklist (must all hold before DF-M000)

1. Runtime credential workspace resolved; bearer verified (401 without, 200 with).
2. Resource gates pass (values recorded); no foreign engine running.
3. Model artifact hash recomputed == `02a8b7e1…52ed`.
4. Authority route target-aware chat verified live (local → `capability.execute`; unknown → deny
   before dispatch; stream/non-stream parity).
5. Disposable fixture project created OUTSIDE the repo (e.g. `E:\pip_temp\opencode\dogfood-fixture-a`)
   with a real bounded defect; no file writes to the Covert repo during Mission 0.
6. Evidence capture paths under `docs/v1/dogfood/evidence/` + `.aide/` attempt logs.

## Hard boundaries observed

- `E:\aide-sovereign-workbench-resident-resume` (Resident park) — untouched.
- `E:\aide-desktop-control-v1`, `E:\aide-model-manager` — untouched.
- H4: NOT AUTHORIZED. Public Ops: DRAFT only; no publication from this wave.

---

## RESUME STATE — 2026-09-25 (checkpoint A: preflight)

- **Credential preflight: PASS (path A read-only reuse).** Qualification-time store located at
  `E:\Unsloth-Studio-runtime-lab-RT27\qualification\c1168c1b97852fba8a329e15380389375a9eade0\.aide\credentials.dpapi`;
  `CredentialStore('unsloth-local-runtime')` retrieves a non-empty bearer; DPAPI blob contains no
  plaintext; no secret in report. Evidence: `docs/v1/dogfood/evidence/CREDENTIAL-PREFLIGHT.json`.
- **Host preflight: 6/7 gates PASS** — administrator PASS · commit free 11.64 GiB PASS · VRAM free
  5430 MiB PASS · GPU util 25% PASS · no existing runtime PASS · port 18888 free PASS ·
  **free RAM 3.64 GiB FAIL (gate ≥6.5 GiB)**. Evidence: `docs/v1/dogfood/evidence/HOST-PREFLIGHT.json`.
- **`DOGFOOD WAVE 1 BLOCKED — frozen start gate unmet`**: free RAM is held by the operator
  environment (OpenCode ~1.7 GB, codex ~1.1 GB, msedge ~0.7 GB, system services) — foreign/user
  processes, none dogfood-owned. Gate is NOT lowered and no process was terminated.
- **Exact resume:** when the machine is idle, rerun `node scripts/dogfood/preflight.mjs`; on
  `pass:true` proceed to boot the qualified runtime (Unsloth adapter, port 18888, credentialStore =
  the qualification root above), load `LFM2.5-2.6B-Q4_K_M.gguf` with hash recompute, verify
  401/200 auth + health + identity, freeze DF-M000 input, and run missions in order.
