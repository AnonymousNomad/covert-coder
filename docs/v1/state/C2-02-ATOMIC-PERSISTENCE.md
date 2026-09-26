# C2-02 — Crash-Consistent Session and Chat Persistence

| Field | Value |
|---|---|
| Status | CLOSED for the supported single-process typed-server topology |
| Branch | fix/v1-p0-atomic-persistence |
| Implementation checkpoint | 75e50da039de35ed51a6676e39091d51da09fac6 — atomic batch persistence for provider imports |
| Starting SHA | 1d6f4969db8b0d88abd285ab2cb8917d790b8567 |
| Platform exercised | Windows 11, Node 26.4.0, E: NTFS |

This closes C2-02 for application-process interruption and truthful recovery. It does not claim power-loss durability or coordination between independent server processes sharing one workspace.

## Ownership

| State | Canonical file | Owner and active routes | Authority |
|---|---|---|---|
| Session | .aide/session.json | node/src/services/session-store.ts; GET/PUT /api/session through node/src/routes/session.ts | Canonical; no database or second mirror is authoritative. |
| Chat history | .aide/chat-history.json | node/src/services/chat-store.ts; GET/POST /api/chat/history through node/src/routes/chat.ts; local provider-export import uses the same ChatStore | Canonical; no database or second mirror is authoritative. |

node/src/openapi.ts constructs one SessionStore and one ChatStore per typed ArchServer route set. The standard scripts/start.mjs supervisor starts one typed server. daemon/server.mjs no longer owns a session writer. session/store.mjs remains a standalone legacy utility/test target and is not part of the typed production route path.

Session reads happen on GET and on each PUT read/modify/write. Legacy session shape migrates to schema version 1 and is persisted atomically. ChatStore.load refreshes the canonical file on each GET; save rereads under the path lock. Provider export import uses `ChatStore.saveMany()` to commit a valid parsed batch with one atomic replacement. Save-only adapters retain the sequential per-conversation fallback used by the partial-failure service-seam test. A typed-server batch write failure preserves the pre-import canonical file and emits no success response.

## Baseline failure reproduction

At the starting SHA, both stores wrote directly to the canonical path with fs.writeFile. An isolated fault-injection reproduction against disposable fixtures interrupted an in-place write after truncation and left the canonical bytes as {; JSON.parse failed. No operator state was touched.

## Commit protocol

Both writers now use node/src/services/atomic-json.ts:

1. Serialize the full candidate and validate against the owning contract.
2. Exclusively create a unique temporary file in the canonical file’s own directory.
3. Write all bytes, call FileHandle.sync(), close, reread, and verify exact bytes plus JSON/schema validity.
4. Rename the same-directory temporary onto the canonical path.
5. After a successful commit, best-effort remove only helper-named temporary files older than 24 hours.

The canonical path is never opened for truncating writes. Existing-target replacement was exercised on Windows/NTFS. Injected serialization, temp-creation, write, flush, readback, and replacement faults preserve the old valid canonical bytes. A caught failure removes its owned temp; abrupt process exit may leave a uniquely named orphan.

## Concurrency, recovery, and errors

withFileMutationLock serializes read/modify/write by normalized path within one Node process. Concurrent independent store instances preserve both session patches and both chat conversations. The supported topology is one typed ArchServer process per workspace, launched by scripts/start.mjs. There is no cross-process lock or compare-and-swap; independently launching multiple typed servers against the same workspace is unsupported. Atomic rename alone does not solve that case. Removing the legacy daemon session route eliminates the known second session writer from the standard topology.

| State at startup or failure | Result |
|---|---|
| Valid canonical file | Parse, validate, and return it. |
| Missing file in a usable existing workspace | First-run empty state; later writes create .aide. |
| Missing due to invalid/unreadable workspace path | READ_FAILED; never report empty success. |
| Malformed or zero-length JSON | CORRUPT_STATE; preserve bytes; route returns NOT_READY. |
| Unsupported session version or chat schema | UNSUPPORTED_SCHEMA; preserve bytes. |
| Orphan helper temp | Ignore at startup; never promote it. A named temp older than 24 hours is eligible for cleanup only after a later successful commit. |
| Backup candidate | None created or consumed; corrupt canonical state requires explicit operator recovery. |
| Permission/storage failure | Sanitized NOT_READY with state kind, reason, operation phase, optional OS code, and bounded recovery action. No state content or absolute file path is logged. |

A failed commit produces no success response. ChatStore publishes its new in-memory view only after replacement succeeds. A failed session migration leaves the legacy canonical bytes unchanged.

## Durability boundary

On tested Windows/NTFS, injected application-process interruptions during a partial temp write, after a complete temp write but before rename, and immediately after rename left either the old or new complete canonical JSON. FileHandle.sync() is called on the temp file. The containing directory is not flushed, and no power-loss, controller-failure, or filesystem-corruption durability claim is made.

## Wave 0B provider-route reconciliation

The initial full-suite failure was a **C2-02 performance regression**. It was not cleared by the provider suite passing alone. The exact provider import matrix timed out at its fixed 5-second request signal when run after `provenance.test.ts`; the same provider suite passed alone on some runs. Tracing showed the 200-conversation import request was the operation that exceeded the client deadline. The server continued the admitted local import after the client aborted, so fixture teardown could race the still-running handler and report `ENOTEMPTY` or leave fixture files behind.

A single bounded A/B diagnostic used the exact pre-C2 `ChatStore` source from starting SHA `1d6f4969db8b0d88abd285ab2cb8917d790b8567` and an equivalent isolated current-store fixture with three existing conversations followed by 200 imports:

| Writer | 200-conversation import | Notes |
|---|---:|---|
| Pre-C2 direct writer | 319 ms | One in-memory load followed by direct canonical writes. |
| C2 atomic per-conversation writer | 7,395 ms | 200 atomic commits; instrumented atomic helper total 7,142 ms. |

Atomic phase totals across the 200 commits were: serialize 26 ms; schema validate 45 ms; temp creation 199 ms; temp write 62 ms; file flush 6,239 ms; close 61 ms; readback/validation 191 ms; rename 230 ms. The remaining measured save time includes canonical reads, object updates, and lock-path overhead. Lock wait was not independently instrumented; the fixture had one sequential writer and no competing writer. This was a single diagnostic run per implementation, not a performance qualification.

Correction `75e50da` adds `ChatStore.saveMany()` and makes the real typed provider-import route use one atomic history commit for its parsed batch. The atomic helper and its file flush were preserved. The generic save-only path and its partial-failure test remain intact. With the fixed 5-second client budget unchanged, the exact import matrix passed in 2,952 ms; the full provider file passed 5/5 with the matrix at 681 ms; `provenance + provider` passed 12/12 with the matrix at 594 ms.

## Verification

| Check | Result |
|---|---|
| Focused persistence/session/chat/importer tests | PASS, 27/27, exit 0, runner duration 9.165 s. The added tests prove one atomic import commit and preserve old canonical bytes on batch replacement failure. |
| Exact provider import matrix | PASS, 1/1, 2.952 s; fixed request abort remains 5 s. |
| Provider route regression in isolation | PASS, 5/5; matrix 681 ms. |
| Immediately preceding suite plus provider routes | PASS, 12/12; matrix 594 ms after the 3.486 s provenance live test. |
| Full architecture suite | PASS, 773 total, 762 passed, 0 failed, 11 skipped; runner duration 442.231 s. Provider matrix 998 ms in that run. |
| Full `npm run check` | PASS, exit 0. Node syntax, Node TypeScript, browser TypeScript, ESLint (0 errors, 63 warnings), and architecture all completed. Architecture: 773 total, 762 passed, 0 failed, 11 skipped; runner duration 462.812 s. |
| Diff hygiene | `git diff --check` passed before implementation commit; full check passed after the change. |

Full raw runner logs remain outside Git in `E:\pip_temp`:

| Log | Bytes | SHA256 |
|---|---:|---|
| `runtime-arch-20260926-083025.log` | 75,408 | `5042F24B7BCB350DE77A6BA94FD71EF9729F412170E889DEABE253FB3C5B317D` |
| `runtime-npm-check-20260926-083811.log` | 83,345 | `63A40B032B7A83D6D3322234F7327353B74C3EDB0EA5A9201D83310F89EE708E` |

The timeout and teardown failure are reconciled as one C2-02 regression plus a downstream fixture-teardown race after client abort. Both the standalone full architecture gate and full `npm run check` now pass with the original request deadline unchanged.

The failed combined-run fixture retained a complete 51,628-byte `chat-history.json` after the client abort (SHA256 `C84041F8357262FDAE1E16CBD219D24D86CDA8D851C7DD39732B1F503E563D43`). This is evidence that the server-side import continued after the client stopped waiting. Cleanup of the exact test-owned temp fixture and diagnostic scripts was rejected by command policy, so those artifacts remain outside Git under `E:\pip_temp`.

## Limits and preserved findings

- No cross-process writer coordination, backup creation, or automatic recovery of malformed canonical state.
- No power-loss durability qualification. Filesystem error cases were injected; no real disk-full event was induced.
- Provider batch import is atomic as one history replacement; this does not add cross-process locking or power-loss durability.
- The route continues work after a client disconnect; tests now stay inside the request budget, but general server-side cancellation semantics are outside C2-02.
- C4-02 remains frozen as BLOCKED: system/process-level and legacy egress remains outside a canonical Local-Only enforcement boundary. This slice adds no route-specific egress guard.
- C1-02 route-map drift reproduction was not started.
