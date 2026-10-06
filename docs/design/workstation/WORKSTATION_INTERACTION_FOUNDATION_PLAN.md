# Workstation interaction foundation implementation plan

> **For agentic workers:** Execute inline with superpowers:executing-plans. Keep the accepted contract as authority; no shell activation before Luna reconciliation.

**Goal:** Implement reusable, effect-disabled workstation interaction foundations while the Windows shell is inaccessible.
**Architecture:** Browser-safe ESM modules with typed declarations and behavioral Node tests. They validate presentation inputs, preserve project identity and consume canonical owner callbacks; they never replace Authority, context, credentials or process owners.
**Tech Stack:** Existing JavaScript ESM / TypeScript declarations; Node's built-in test runner. No new runtime dependency.
**Spec:** docs/design/workstation/WORKSTATION_DESIGN_CONTRACT.md; WORKSTATION_WINDOW_CONTRACT.md; CIPHER_AND_BUDDY_CONTRACT.md; WORKSTATION_SECURITY_CONTRACT.md; operator continuation directive.

## Global constraints
- Original black/phosphor-green retro identity remains fixed.
- No old shell/frame/CSS, packaging, S1/S2, plugin or runtime edits.
- New modules are unmounted; app activation is blocked on Luna's complete dirty/untracked source.
- Drop ≠ authority; profile ≠ installation/grant/execution; cosmetic pose ≠ operational truth.
- One Resident, four chassis references, independent persona/voice/grants.
- No third-party execution or default continuous media capture.
- Real backend/Windows proof remains required; source-only checks do not pass workstation security gates.

## Review focus
- Project/root generation changes while read-only inspection is in flight: discard result, never retarget.
- Hostile/oversized MIME payloads and profile fields: reject without filesystem/network/command effects.
- Stale owner facts and hidden/reduced-motion presence: unknown truth, no background animation loop.
- Media stop request lies or hangs: stop both owned media paths; report partial/unknown from observation.
- Disposed controllers and late callbacks: no resurrection, stale updates or retained unbounded work.

## Task 1: Typed drop inspection boundary
**Files:** browser/src/workstation/interactions/drop-intent.mjs and .d.mts; tests/unit/test-workstation-drop-intent.mjs.
**Interfaces:** parseDropIntent(transfer, target, binding) -> immutable typed intent; createDropInspector({getBinding, inspectResource?, timeoutMs?, maxPending?}) -> stage(transfer,target), invalidate(), dispose(). Binding = {projectId,rootGeneration} or null. Resource payload v1 = {version,kind,id,revision,project?}; seven distinct routes plus external-file inspection. Returned PREVIEW always has activation DISABLED; no effect/grant APIs.
- [ ] Write behavioral negatives for unsupported MIME, bad JSON/keys/prototype data, bounds, cross-project root, malformed owner result, absent owner, overload, timeout, cancellation, disposal and caller mutation.
- [ ] Run test file: expect failures from absent implementation.
- [ ] Implement strict payload parsing, target dispatch, immutable snapshots and bounded cancellable read-only inspection.
- [ ] Run task tests and pinned owned-process regression: all executed assertions pass.
- [ ] Check syntax/whitespace, commit task and record full-suite blockage separately.

## Task 2: Declarative environment profiles
**Files:** browser/src/workstation/interactions/environment-profile.mjs and .d.mts; tests/unit/test-workstation-environment-profile.mjs.
**Interfaces:** parseEnvironmentProfile(raw) -> immutable v1 record; inspectEnvironmentProfile(raw, {binding,lookupCapability}) -> profile/project/missing references, activation DISABLED. Distinct application/tool/terminal/model/workflow/shortcut reference lists and layout intent. No commands, credentials, grants, routes or executable hooks.
- [ ] Write tests for complete profile, absent capabilities, explicit terminal/model roles, unknown executable/credential fields, array/geometry limits, duplicate IDs, invalid/missing binding and input mutation.
- [ ] Run file: expect missing implementation failure.
- [ ] Implement allowlisted schema and read-only missing-capability projection; reuse Task 1 validation helpers only if their semantics match.
- [ ] Run both task files + owned-process regression; syntax/whitespace checks; commit and record.

## Task 3: Shared presence facts and four families
**Files:** browser/src/workstation/presence/presence-engine.mjs and .d.mts; tests/unit/test-workstation-presence.mjs.
**Interfaces:** projectPresence({binding,facts,now,freshForMs}) -> independent Resident/task/capture/output/remote/attention facts and supplemental pose; createPresenceEngine({binding,render,clock?,schedule?,cancel?,family?,reducedMotion?,freshForMs?}) -> update, setPresentation, setVisible, dispose. Built-in Scout/Rook/Mutt/Tinker metadata share one engine; no executable packs.
- [ ] Write stale/foreign/future-fact, offline+capture, task-vs-cosmetic, independent family/persona/voice, hidden, reduced-motion, expiry and disposal tests with deterministic time.
- [ ] Run file: expect missing implementation failure.
- [ ] Implement conservative fact projection and one bounded freshness timer; default packs are static, assets unqualified, no model/inference/render loops.
- [ ] Run accumulated suite + pinned regression; syntax/whitespace; commit and record. No claim of rendered/qualified four-family art.

## Task 4: Independent optional-media teardown
**Files:** browser/src/workstation/media/media-lifecycle.mjs and .d.mts; tests/unit/test-workstation-media-lifecycle.mjs.
**Interfaces:** createMediaLifecycle({capture?,output?,onState?,timeoutMs?}) -> stop(reason). Each already-owned adapter supplies stop() and observe() -> ACTIVE/INACTIVE/UNKNOWN. Reasons: operator, buddy-off, lock, sleep, restart, project-switch, dispose. No start, permission or route APIs.
- [ ] Write tests for confirmed both-stop, lying acknowledgment, throwing/hanging adapters, repeated concurrent stop, lock/sleep/restart/Buddy Off and no plaintext errors.
- [ ] Run file: expect missing implementation failure.
- [ ] Implement parallel bounded stop with observed per-path results; model-independent and no synthetic containment.
- [ ] Run accumulated suite + regression; inspect syntax/whitespace; commit and record. Backend/native capture proof remains open.

## Integrated source verification
- [ ] Run all four new suites and pinned owned-process test; read totals/failures/skips.
- [ ] Attempt actual repository npm test/build/check commands; preserve incomplete-checkout/toolchain failures with exact names.
- [ ] Add executable source benchmark with explicit Linux/Node-only scope; report bytes/timings/timers without projecting Windows budgets.
- [ ] Fresh reviewer inspects full diff, accepted contracts, tests and ledger. Fix serious findings with regression tests.
- [ ] Publish isolated candidate checkpoint, update security closure evidence without awarding runtime PASS, and check Windows availability again.
