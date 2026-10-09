# Local Model Recovery and Resident Binding Recheck — 2026-10-09

## Disposition

- `LOCAL_MODEL_EVIDENCE_PRESERVED_AND_ACCEPTED_AS_CANONICAL_INPUT`
- Artifact copy: `ACQUISITION_BLOCKED_CAPACITY` for this bounded operation only.
- Resident Binding: production remains `DEGRADED / resident_role_qualification_unverified` until a canonical `CIPHER_RESIDENT` evaluator exists and current evidence is recorded.
- Overall storage state remains `RECOVERY_PARTIAL`; this record does not promote a project-wide storage blocker.

This record supplements `LOCAL-MODEL-EVIDENCE-INTAKE-2026-10-09.md`. It does not revise historical measurements or qualify the current artifact bytes, runtime, or Resident role.

## Source and branch

- Active candidate lane: `feat/model-intelligence-mi1b-reliability-20261005`
- Base HEAD before this bounded change: `7477b3555bd063634c7605e0e1618529469f2cbf`
- This remains an isolated candidate lane, not convergence. No evidence branch, convergence branch, PR #31, or PR #41 was changed.
- The evidence-only source branch remains frozen at `8b0220753848088416c67a743be4f299bbab91b7`; its exact-SHA CI failure remains `CI_RED_NOT_ATTRIBUTED_TO_LOCAL_MODEL_EVIDENCE_COMMIT`.

## Current storage measurement

At `2026-10-09 12:32:19 -05:00`, C: reported:

| Measurement | Result |
|---|---:|
| Filesystem / health | NTFS / Healthy |
| Volume size | 126,812,377,088 bytes |
| Free capacity | 173,248,512 bytes |
| Required pre-copy floor | 3,348,910,080 bytes |
| Measured shortfall | 3,175,661,568 bytes |

The previously verified volume mapping identifies C: on Kingston NVMe (`PHYSICALDRIVE1`) and E:/L: on the source disk (`PHYSICALDRIVE0`). That mapping was not re-probed for this note. C: is the available physically independent internal target, but current free capacity does not satisfy the bounded copy floor.

The prior bounded inventory found at most 1,052,551,434 bytes among clearly identified developer/package/shader caches plus temporary/updater data. Even treating that entire prior candidate total as reclaimable would leave 2,123,110,134 bytes below the copy floor. No cache was relocated or deleted. The additional 1,392,518,114-byte Codex runtime cache and 29,961,599-byte OpenCode cache are protected active application state. Other model/app caches were small or not clearly safe to relocate. No protected process or directory was touched.

## Existing Liquid artifact observation

A bounded metadata check observed the preserved source at:

`E:\models\house-model\lfm25_gguf\LFM2.5-2.6B-Q4_K_M.gguf`

- Filename: `LFM2.5-2.6B-Q4_K_M.gguf`
- Observed byte size: `1,674,455,040`
- Expected canonical SHA-256 from prior evidence: `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`
- Upstream: `LiquidAI/LFM2.5-2.6B-GGUF`
- Revision: `e7caca5d835a3901a8e0d63e94009429bafafdfc`

The current E: source bytes were not hashed or parsed. The expected SHA remains historical for these current bytes. No copy, GGUF structure validation, Model Manager registration, download, or runtime start occurred. The E: original was not modified.

## Resident Binding defect and bounded repair

### Reproduction

Before the repair, a focused regression supplied an installed Liquid candidate and a `LOADABLE` runtime observation but no Resident-role evidence. The projection returned `BOUND`; the regression expected `DEGRADED`. The failure was:

```text
actual: BOUND
expected: DEGRADED
```

This confirmed that generic artifact/runtime state could promote Resident Binding without the `CIPHER_RESIDENT` qualification required by the current owner directive.

### Repair

- `createResidentBinding` now accepts an explicit current role-qualification observation.
- Missing or failed observation remains `UNKNOWN`; it does not inherit the generic Unsloth Passport, runtime readiness, model selection, or test fixture status.
- Only an explicit `QUALIFIED` observation from the role-qualification owner can permit `BOUND`; `NOT_QUALIFIED` and `UNKNOWN` remain `DEGRADED` with stable reason codes.
- Production composition does not yet wire the canonical Harness/Atlas evaluator, so it remains `UNKNOWN` and cannot report `BOUND`.
- `ResidentBinding` now validates its stable degraded-reason enum rather than accepting arbitrary strings.

This is a truthfulness guard, not a Resident qualification result. The unit fixtures that inject `QUALIFIED` verify projection behavior only; they are not model evidence.

## Verification

- Focused initial reproduction: **1 failing regression**, observed false `BOUND` without role evidence.
- First post-repair combined run: **18/19 passed**; one existing route fixture still expected `BOUND` without supplying the newly required role evidence. The fixture was corrected to declare its test-only qualification input.
- Final focused Resident Binding unit/route tests: **19 passed / 0 failed / 0 skipped**.
- Resident routes architecture tests: **11 passed / 0 failed / 0 skipped**.
- Node TypeScript check (`tsc -p tsconfig.node.json --noEmit`): **exit 0**.
- `git diff --check`: **pass**.
- Targeted ESLint invocation: **incomplete**. It produced no output for about 2.5 minutes and was interrupted as an owned command; no lint conclusion is claimed, and cause is unknown.
- Exact-SHA AIDE CI for the previous evidence-intake checkpoint `7477b3555bd063634c7605e0e1618529469f2cbf`: run `37964408605`, **SUCCESS**. This does not verify the current code change.
- No fresh Resource Admission or model runtime test was performed. Admission must be evaluated immediately before any future model start, after a safe exact-artifact copy and registration.

## Remaining gates

1. Obtain measured safe C: capacity of at least `3,348,910,080` bytes, or another already-authorized physically independent target meeting the same requirement.
2. Copy the existing E: artifact once, hash the copy, require the canonical SHA, validate GGUF structure, and register the exact existing model identity.
3. Implement and wire the Authority-governed Resident evaluator through the existing Harness/AttemptJournal/Model Atlas owners. No evaluator or Atlas route is currently wired in this candidate.
4. Establish current role evidence and a fresh canonical Admission `START` before any runtime launch.
5. Prove real Resident inference, cancellation, cleanup, and restart; then continue the Cipher workstation-to-mission vertical.

Until those gates pass, the source artifact remains observed by metadata only, Resident-role qualification remains `UNKNOWN`, and no `CIPHER_LIVE_DEMO` claim is supported.
