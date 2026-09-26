# C2-02 — Crash-Consistent Session and Chat Persistence

| Field | Value |
|---|---|
| Status | CLOSED for the supported single-process typed-server topology |
| Branch | fix/v1-p0-atomic-persistence |
| Implementation checkpoint | e6c1dc12d894ec8b7d92f7122e1db17f6c6384ff |
| Starting SHA | 1d6f4969db8b0d88abd285ab2cb8917d790b8567 |
| Platform exercised | Windows 11, Node 26.4.0, E: NTFS |

This closes C2-02 for application-process interruption and truthful recovery. It does not claim power-loss durability or coordination between independent server processes sharing one workspace.

## Ownership

| State | Canonical file | Owner and active routes | Authority |
|---|---|---|---|
| Session | .aide/session.json | node/src/services/session-store.ts; GET/PUT /api/session through node/src/routes/session.ts | Canonical; no database or second mirror is authoritative. |
| Chat history | .aide/chat-history.json | node/src/services/chat-store.ts; GET/POST /api/chat/history through node/src/routes/chat.ts; local provider-export import uses the same ChatStore | Canonical; no database or second mirror is authoritative. |

node/src/openapi.ts constructs one SessionStore and one ChatStore per typed ArchServer route set. The standard scripts/start.mjs supervisor starts one typed server. daemon/server.mjs no longer owns a session writer. session/store.mjs remains a standalone legacy utility/test target and is not part of the typed production route path.

Session reads happen on GET and on each PUT read/modify/write. Legacy session shape migrates to schema version 1 and is persisted atomically. ChatStore.load refreshes the canonical file on each GET; save rereads under the path lock. Provider export import saves one conversation at a time and remains non-transactional.

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

## Verification

| Check | Result |
|---|---|
| Focused persistence/session/chat/importer tests | PASS, 26/26, exit 0, test-runner duration 3.736 s. Command: node --test tests/arch/state-persistence-atomicity.test.ts tests/arch/session-routes.test.ts tests/arch/chat-history-authority.test.ts tests/arch/importers.test.ts |
| Provider route regression in isolation | PASS, 5/5. The 200-conversation import matrix took 4.521 s against a 5 s fixture deadline. |
| Full npm run check after final source change | NOT GREEN. Node syntax, Node TypeScript, browser TypeScript, and ESLint completed; ESLint had 0 errors and 63 warnings. Architecture: 773 total, 760 passed, 2 failed, 11 skipped for absent bundled GGUF. The POST /api/providers/import authority matrix test timed out at 5.456 s against a 5 s fixture deadline; its teardown then reported ENOTEMPTY on the same fixture. The provider suite passed in isolation. Load-sensitive timing is supported by the contrast; exact host cause is unproven. |
| Workflow/handoff/continuation | Earlier targeted run 89/89; the full architecture run after the final source change had no failures in these suites. |
| Diff hygiene | git diff --check passed before implementation commit. |

The full npm run check remains a failed overall gate. The isolated provider pass and focused C2 tests do not convert it to a full-suite pass.

## Limits and preserved findings

- No cross-process writer coordination, backup creation, or automatic recovery of malformed canonical state.
- No power-loss durability qualification. Filesystem error cases were injected; no real disk-full event was induced.
- Provider-export import remains per-conversation and non-transactional.
- The provider import case is close to its 5 s test deadline and timed out at 5.456 s during the full architecture run.
- C4-02 remains frozen as BLOCKED: system/process-level and legacy egress remains outside a canonical Local-Only enforcement boundary. This slice adds no route-specific egress guard.
- C1-02 route-map drift reproduction was not started.
