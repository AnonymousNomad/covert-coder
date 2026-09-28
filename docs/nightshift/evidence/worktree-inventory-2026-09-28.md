# Canonical convergence worktree inventory — 2026-09-28

Observed at 2026-09-28T12:05:49Z on NEURO-MIRROR.

## Repository and worktree truth

- Repository remote: https://github.com/AnonymousNomad/covert-coder.git
- Canonical worktree: E:/covert-nightshift-integration
- Branch: nightshift/production-convergence-20260926
- HEAD: b0f0a729e7b1bc72f4e7dfa4f18d8d13b8873798
- Upstream at observation: origin/fix/v1-p0-route-drift; ahead 13, behind 0.
- Worktrees: 41.
- Before this report was created: 5 tracked modified paths, 35 untracked paths, 0 staged.
- Before stabilization actions: 12 tracked modified paths, 36 untracked files, 0 staged.
- No branch integration or PR #31 mutation was performed.

## Inventory boundaries

This records repository-visible tracked and untracked paths, plus path collisions with
other worktrees. Ignored machine-local application state is outside this Git inventory.
The owner addendum dated 2026-09-28 is the active priority authority; dated older packets
remain historical evidence and do not transfer acceptance to this SHA.

## Tracked modifications and dispositions

- package.json — active harness comparison: adds test:harness-battery.
- scripts/run-harness-battery.mjs — active harness comparison: replaces the old battery
  with a fixed scaffold-only paired runner and immutable evidence output.
- skills/registry.json — production skill catalog: now records 304 entries and 12 added
  skills (five Covert closure skills and seven failure-recovery skills).
- skills/packs/failure-apply-patch-doc-paragraph-drift/SKILL.md — added required name and
  description frontmatter because its newly registered entry previously had no metadata.
- skills/packs/failure-markdown-hardbreak-diff-check/SKILL.md — same registry metadata repair.
- Registry count was corrected from 303 to 304 after comparing the declared value to the
  current entry array; there are no duplicate names and every listed path resolves.
- Nine other tracked skill files were initially modified only by CR-at-end-of-line
  differences. git diff --ignore-cr-at-eol --quiet confirmed no other content change.
  Those known line-ending-only edits were restored to the indexed bytes; no semantic work
  was discarded.

The nine normalized files were:
- skills/packs/aide-arch-model-runtime/SKILL.md
- skills/packs/aide-ci-diagnostics/SKILL.md
- skills/packs/aide-inference-control/SKILL.md
- skills/packs/aide-offline-rag/SKILL.md
- skills/packs/aide-trio-integration/SKILL.md
- skills/packs/aide-vscode-parity-roadmap/SKILL.md
- skills/packs/fsi-gutenberg-catalog-locc-filter/SKILL.md
- skills/packs/fsi-license-classifier-url-groundtruth/SKILL.md
- skills/packs/fsi-tokenizer-byte-level-bpe-gates/SKILL.md

## Untracked active harness-comparison work

- benchmarks/context-ablation-v1.mjs — ten unique prompts, behavioral grader, synthetic canary.
- scripts/verify-harness-battery-task-count.mjs — local fake-endpoint paired fixture.
- tests/unit/test-harness-battery-core.mjs — grader and task-lock tests.
- docs/evidence/harness-comparison-audit-2026-09-27.md — scope, historical-battery defects,
  design decisions and current grader-isolation blocker.
- skills/packs/covert-real-model-harness-pilot/SKILL.md — pilot preflight and evidence procedure.
- skills/packs/covert-dogfood-evaluation/SKILL.md — real product/evaluation procedure; its
  obsolete claim about the former duplicated/substr runner was corrected to the current scope.

These source files form one bounded harness unit. The test fixture makes 20 synthetic calls;
it is not model evidence and creates no real completion result.

## Untracked production-closure directives

- docs/COVERT_CODER_STANDING_DIRECTIVE.md — imported standing directive.
- docs/COVERT_PRODUCTION_CONTEXT_ADDENDUM.md — research, skill and context-control addendum.
- docs/nightshift/ACTIVE-CONTEXT-PACKET.md — historical packet, superseded by the current
  checkpoint created for this stabilization.
- docs/nightshift/COVERT-NIGHTSHIFT-EXECUTION-LEDGER.md — historical execution queue.
- docs/nightshift/WORKTREE_CONVERGENCE_LEDGER_2026-09-27.md — dated convergence state.

These are preserved as project direction and historical planning, not proof of current
runtime or release acceptance.

## Untracked dated evidence — docs/nightshift/evidence/

Each item is retained as historical evidence; none is promoted to current-candidate acceptance.

- harness-pilot-checkpoint-2026-09-27-0952.md — blocked pilot checkpoint and source fingerprints.
- harness-pilot-resource-preflight-2026-09-27T095201-0500.json — dated resource snapshot.
- harness-pilot-resource-preflight-2026-09-27T101135-0500.json — dated resource snapshot.
- harness-pilot-resource-preflight-2026-09-27T102426-0500.json — dated resource snapshot.
- harness-pilot-resource-preflight-2026-09-27T104328-0500.json — dated resource snapshot.
- harness-pilot-resource-preflight-2026-09-27T111931-0500.json — dated resource snapshot.
- harness-pilot-resource-preflight-2026-09-27T134940-0500.json — dated resource snapshot.
- harness-pilot-resource-preflight-2026-09-27T173122-0500.json — dated resource snapshot.
- harness-pilot-runtime-attempt-2026-09-27T102549-0500.json — failed authenticated runtime attempt;
  no model completion is represented.
- p1-c5-15-cancellation-filtered-2026-09-27T112936-0500.json — production-closure evidence.
- production-convergence-checkpoint-2026-09-28-0058Z.md — previous current-state checkpoint,
  superseded by the later checkpoint for this worktree inventory.

Resource and runtime records describe their timestamps only. Re-measure resources and credential
presence before any future inference; do not reuse a historical preflight as a current gate.

## Untracked secondary experience-design bundle

These user-accepted documents are planning/research only. Preserve them, but keep their
implementation behind the release blockers in the 2026-09-28 owner addendum.

- docs/production-closure/README.md
- docs/production-closure/EXPERIENCE_DESIGN_ADDENDUM.md
- docs/production-closure/WEB_EXPERIENCE_RESEARCH.md
- docs/production-closure/VISUAL_ANTI_PATTERN_REGISTER.md
- docs/production-closure/EXPERIENCE_RESEARCH_REFERENCES.md
- docs/production-closure/LUNA_EXPERIENCE_HANDOFF.md
- docs/production-closure/COMPETITIVE_PARITY_DIRECTIVE.md
- docs/production-closure/COMPETITIVE_BASELINE_MATRIX.md
- docs/production-closure/LUNA_COMPETITIVE_HANDOFF.md
- docs/production-closure/skills/covert-experience-design/SKILL.md

No theme, marketing or website implementation was performed.

## Untracked production-closure skills

- skills/packs/covert-context-control/SKILL.md — engineering context packet procedure.
- skills/packs/covert-fresh-user-release-audit/SKILL.md — clean-user release audit procedure.
- skills/packs/covert-unsloth-product-wiring/SKILL.md — accepted runtime wiring procedure.
- skills/packs/covert-real-model-harness-pilot/SKILL.md — controlled pilot procedure.
- skills/packs/covert-dogfood-evaluation/SKILL.md — real task and comparison procedure.

## Explicitly parked local-only helper

The machine-specific scripts/qualification/nightshift-product-ingest.mjs was not product code:
it hard-coded the local checkout and model artifact paths. It is retained in a named Git stash,
not deleted or committed:

- stash commit: fcca09dc7b1d981d1083f398acb0c06332dd9430
- stashed file blob: 6e3649cbd688467ffe7c6f950409a16cc4d71291
- stash message: park machine-specific nightshift model-ingest helper

The stash created by this action is distinct from the pre-existing stash on feat/ui-cockpit-rebuild;
that older stash was left untouched.

## Worktree collisions and preservation

The full repository contains 41 worktrees. Fifteen other worktrees reported dirty status.
No external branch/worktree was cleaned, reset, removed, or merged. This inventory itself was one untracked evidence file when recorded. The owner addendum is
preserved separately at `docs/nightshift/POST-OVERNIGHT-CONVERGENCE-ADDENDUM-2026-09-28.md`.
This snapshot was observed before that addendum and supersession notices were added.

- PR #31 remains at b79d2480498e446cff36b26dd4b4faef7745726b in E:/aide-sovereign-workbench,
  with 246 dirty status entries. Its dirty changes overlap skills/registry.json and three
  skill files; its changes are substantive and remain frozen in that separate worktree.
- The current convergence lane's nine EOL-only skill changes were normalized away. The
  registry still has a future read-only reconciliation point with PR #31; do not fold either
  worktree's dirty state into the other.
- E:/aide-sovereign-workbench-ui-fidelity is detached at ddcba2f, locked as initializing, and
  reports 1,395 staged deletions, including paths that appear in this inventory. Treat as a
  separate incomplete worktree, not as a request to delete files.
- E:/pip_temp/opencode/aide-ci-repro is detached at 2072cc4 and reports 143 dirty entries,
  including a deleted package.json. It remains untouched.
- Other dirty branches include operator-control, Context Control, Ghost overnight,
  harness-sync, model acquisition, first-run/model bootstrap, operator convergence,
  public-site planning, release validation, subscription certification, universal-intelligence,
  and v1 public operations. Their local edits/artifacts remain owned by those worktrees.

## Validation and current blockers

- npm run test:harness-battery — 6 grader tests passed; local fake endpoint passed ten unique
  tasks and twenty synthetic calls with balanced order and evidence hash checks.
- Affected-file ESLint passed for runner, task battery, fixture verifier and unit tests.
- Registry JSON parsed; declared count matched 304 entries; every registered path resolved.
- No credential-shaped values were found by a limited scan for common GitHub/provider tokens,
  bearer/JWT values and private-key markers. This is not a complete secret audit.
- No real model inference was run; result remains 0/60.
- Current runner evaluates raw model-generated JavaScript inside node:vm on the host. Official
  Node documentation says node:vm is not a security mechanism and the Permission Model does
  not protect against malicious code. Real inference must remain blocked until evaluation is
  OS-isolated with no host files, credentials, network, or user processes, or a deterministic
  non-executing grader is established.
- Historical 2026-09-27 pilot records show missing credential and insufficient retained resource
  headroom; those measurements are stale. Fresh credential/resource checks remain required.
- The owner addendum's next branch work is read-only reconciliation of Model Manager,
  Universal Intelligence, and subscription/provider lanes after this worktree is clean.

This inventory reports classification and preservation decisions. It is not a product acceptance
record and does not claim the convergence branch is clean, pushed, or CI-green.
