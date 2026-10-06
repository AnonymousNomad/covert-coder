# MI-1B Compatibility Notice — for Main Luna

Date: 2026-10-06 · Lane: `feat/model-intelligence-mi1b-reliability-20261005`

**No public contract shape changed.** The MI-1A read surface (imports, calls, response schemas,
vocabularies, fixture paths) is unchanged and all consumer tests remain green. Two internal
behavior changes are worth knowing about while integrating:

1. **Stricter qualification for single-condition records (internal).** A record whose native or
   harnessed condition is missing can no longer carry `qualification.state = TESTED`; it is created
   as `INVALID_EVIDENCE` with reason `condition_missing`. The read state for such records was already
   `INCOMPLETE` (`native_missing` / `harnessed_missing`) — record-level qualification now agrees with it.
   Your fixture (`views.record`) has both conditions and is unaffected.
2. **Integrity sidecars (internal storage).** Committed records now get a `<evaluation_id>.sha256`
   sidecar next to the record. A contradicting sidecar surfaces through the READ surface as
   `evaluation_state: INCOMPLETE` with `stale_reasons: ['integrity_mismatch']`; a missing sidecar
   (older records) changes nothing. You never read sidecars directly.

New read-side vocabulary values you may see in `stale_reasons`: `integrity_mismatch` (in addition to
the existing reasons).

New tooling (read-only, optional for you): `scripts/model-atlas-doctor.mjs` and
`service.audit()` answer "is the Atlas healthy" without touching evidence.

Full details: `docs/model-intelligence/MODEL_ATLAS_RECOVERY.md`,
`docs/model-intelligence/MODEL_ATLAS_FAILURE_MATRIX.md`.
