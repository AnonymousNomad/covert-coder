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

## Numbering rule

`MM0–MM7` is retained only as the historical aggregate label found in the
foundation commit message. It is not represented as eight individually
verified commits. Future work starts at MM8 and each accepted checkpoint must
have one scope, one immutable SHA, and its own test/evidence record.

## Boundaries

- The Registry remains the single model database; packs are projected from the
  existing model manifest and reconciled against that Registry.
- This UI's model choice is view-only because the existing mission router does
  not consume a Model Manager selection.
- Model Pack entries are reconciled from the existing manifest and Registry;
  download/install is not part of this slice. Installation state never implies
  qualification.
- Resource fit is an estimate and does not replace Resource Admission.
- Unsloth is the canonical local runtime decision. This checkpoint consumes
  only the RuntimeAdapter boundary and does not implement runtime behavior.
- The current RuntimeAdapter interface does not report version or ownership;
  the UI displays those fields as not reported rather than inferring them.
- No Resident, H3, Harness Sync, Authority, Veritas, Helix, or H4 semantics are
  changed by this Model Manager work.
