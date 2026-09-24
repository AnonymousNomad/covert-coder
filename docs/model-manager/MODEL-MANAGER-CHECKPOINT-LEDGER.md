# Model Manager Checkpoint Ledger

This ledger normalizes earlier MM0–MM7 labels without rewriting history or
inventing one commit per label. Git history contains one aggregate foundation
commit and one subsequent hardening commit; the earlier report did not provide
separate SHAs or verifiable boundaries for each MM0–MM7 sub-label.

| Checkpoint | SHA | Scope | Status / evidence |
|---|---|---|---|
| MM Foundation (historically reported as MM0–MM7) | `5880343d64b8b883f74d425cd401bf92557fb205` | Intelligence Registry, bounded discovery, provider state, deterministic recommendations, Developer Notes, System Advisories, RuntimeAdapter boundary, initial Model Manager tests | Accepted aggregate foundation; original test report: 11/11 |
| MM Foundation Hardening | `89d52fd5cafda61fa76d21da8b2f85300ea59247` | Strict index-safety correction and verification | Accepted starting checkpoint; original report: TypeScript exit 0, 11/11 foundation battery |
| MM8 Operator Model Manager | `fe7e0c067828980296161abc313f076251ebc014` | Registry-backed operator views, read-only API projection, pack reconciliation, recommendations, Developer Notes/Advisories presentation, Unsloth adapter status | Scoped checks pass; full architecture gate remains non-green. See [verification record](MODEL-MANAGER-VERIFICATION.json). Not release-certified. |
| MM8 Frozen Candidate / Evidence Ledger | `408fbe6871762676e27a59a7e9abbb974fd5c0a2` | MM8 verification and checkpoint consolidation; no runtime behavior change | Frozen candidate. Focused 44/44, TypeScript, lint, frontend build, and OpenAPI pass. Full architecture gate: 622 pass / 16 fail / 11 skip; not release-certified. |
| MM9 Model Pack Lifecycle / Selection Requests | `376acd0fb0b5d1431a1df2273e60a1d3351545b4` | Versioned packs over the existing catalog/Registry, explicit local artifact import, scoped non-routing selection requests, Developer Specials, optional RuntimeAdapter version/ownership metadata, isolated E2E | Implementation complete. 57/57 focused tests, Node/browser TypeScript, touched-file lint, frontend build, OpenAPI/route checks 12/12, isolated Edge E2E 3/3 pass. Full architecture acceptance remains pending a clean Resident resource window; the MM8 622/16/11 result is not rewritten or relabeled. |

## Numbering rule

`MM0–MM7` is retained only as the historical aggregate label found in the
foundation commit message. It is not represented as eight individually
verified commits. MM8's frozen candidate is `408fbe6`. Future work starts at MM9 and each accepted checkpoint must
have one scope, one immutable SHA, and its own test/evidence record.

## MM8 frozen evidence classification

The broad gate result at the MM8 freeze is recorded without converting
unrelated baseline failures or skipped tests into Model Manager failures:

- **622 passed, 16 failed, 11 skipped.**
- **Failures:** 1 unchanged Academy route timeout; 15 cascading Bucket-C
  aborts from that fixture failure. The available evidence does not attribute
  these to MM8.
- **8 skips:** bundled Qwen GGUF-dependent tests skipped because the optional
  artifact is absent from this source checkout. These are expected
  environmental skips, not passes; they become release blockers only for a
  distribution claim that promises those exact bundled artifacts.
- **3 skips:** model/chat assertions explicitly waived during migration. They
  remain intentional waivers, not passes, and keep the broad architecture
  acceptance gate non-green until their route disposition is resolved.

This is a frozen candidate checkpoint, not release certification. Any later
gate run is a new evidence point and must retain the result above unchanged.

## Boundaries

- The Registry remains the single model database; packs are projected from the
  existing model manifest and reconciled against that Registry.
- At MM8, model choice is view-only because the existing mission router does
  not consume a Model Manager selection. MM9 may produce an explicit,
  project-scoped selection request, but must not mutate router state.
- MM8 reconciles Model Pack entries from the existing manifest and Registry;
  MM9 adds only an Authority-approved local artifact import. Installation
  state never implies qualification.
- MM9 import verifies catalog identity, exact source path binding, GGUF
  structure, and SHA-256 where available. It performs no implicit download or
  runtime load. Registry availability is recorded independently from
  qualification; import never qualifies an artifact.
- MM9 selection creates an ephemeral project-scoped request only. It does not
  mutate mission routing, evaluate Authority, or claim Resource Admission.
  Operator choice may override a recommendation, but not availability,
  artifact, provider, estimated resource-fit, stale-evidence, or runtime
  preflight blocks.
- Resource fit is an estimate and does not replace Resource Admission.
- Unsloth is the canonical local runtime decision. This checkpoint consumes
  only the RuntimeAdapter boundary and does not implement runtime behavior.
  The interface now permits optional version/ownership metadata; absent or
  unsafe values remain unreported. No Unsloth runtime implementation was added.
- No Resident, H3, Harness Sync, Authority, Veritas, Helix, or H4 semantics are
  changed by this Model Manager work.

## MM9 verification and architecture disposition

The MM9 implementation checkpoint is `376acd0fb0b5d1431a1df2273e60a1d3351545b4`.
Focused verification: **57/57 pass, 0 fail, 0 skip**. Contract/OpenAPI and
route-authority checks: **12/12 pass**. Node and browser TypeScript, touched
file lint, and frontend production build pass. Vite reports a large-client
chunk warning (~4.5 MB against its 500 kB advisory threshold); MM9 did not
change bundle splitting.

The non-destructive Model Manager browser harness passes **3/3** using the
already-installed Microsoft Edge channel. The first default Chromium launch
could not run because the Playwright-managed browser binary was absent; those
three attempts were environment-unavailable, not product failures. No browser
was downloaded. The isolated fixture server, worker, browser, and port were
verified absent after the successful run.

The broad architecture gate was **not rerun**: the Resident lane has not
released/confirmed a safe resource window. MM9 status is therefore
**IMPLEMENTATION COMPLETE / ARCHITECTURE ACCEPTANCE PENDING RESOURCE WINDOW**.
The frozen MM8 baseline remains 622 pass / 16 fail / 11 skip, with its 1
Academy timeout, 15 cascading Bucket-C aborts, and 8 environmental plus 3
migration-waived skips classified above. No claim of a green full gate is made.
