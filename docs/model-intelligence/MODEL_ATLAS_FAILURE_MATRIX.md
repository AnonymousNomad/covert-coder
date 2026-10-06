# Model Atlas — Failure & Integrity Matrix (MI-1B)

| Scenario | Detection | Expected behavior | Data preserved? | Operator impact | Test | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Process interrupted during write | Leftover `.tmp-aide-*` file next to record | Temp is invisible to reads; canonical file is old-or-new only | Yes (old state) | none | reliability: interrupted-write aftermath | PROVEN |
| Leftover temp file present | Doctor: none (temps not enumerated); manual inspect | Never parsed as a record; cleaned best-effort only if >24h old during a later write to the same target | n/a | none | reliability: interrupted-write aftermath | PROVEN |
| Truncated / zero-byte / malformed JSON | Doctor: `CORRUPT` | Record excluded; healthy evidence still served; state INCOMPLETE + `corrupt_evidence` | Yes (file untouched) | banner: evidence unverifiable to consumers | reliability: corruption matrix; audit tests | PROVEN |
| Missing required field / bad enum / bad SHA / bad id / wrong type | Contract validation → `CORRUPT` | Same as above | Yes | same | reliability: corruption matrix (9 cases) | PROVEN |
| Unsupported future schema | Doctor: `unsupported_schema_files` | Treated as corrupt; never best-effort parsed | Yes | documented migration required | audit: unsupported schema | PROVEN |
| Duplicate evaluation id in a copied/renamed file | Filename ≠ `evaluation_id` → `CORRUPT`; audit duplicate check | Excluded from history; anomaly reported | Yes | banner as above | reliability: duplicate-id copy | PROVEN |
| Tampered record (schema-valid content changed) | Integrity sidecar digest mismatch | State INCOMPLETE + `integrity_mismatch`; audit lists the file | Yes (tamper witness kept) | investigate per runbook | reliability: immutability/tamper; audit tests | PROVEN |
| Tampered record AND sidecar both rewritten | Undetectable by design (no signing key) | Out of scope; documented as a known limit | n/a | rely on backups/OS integrity | recovery doc | DOCUMENTED LIMIT |
| Missing sidecar (pre-MI-1B or crash between commits) | Doctor: `unverified` | Read normally; healthy stays true; doctor counts it | Yes | none (informational) | reliability: sidecar test; audit: unverified | PROVEN |
| Unbound recommendation evidence ref (foreign write) | Service write: `ATLAS_EVIDENCE_REF_UNBOUND`; audit: `dangling_recommendation_refs` | Write refused; foreign file flagged unhealthy | Yes | investigate | invariants: recommendation binding; audit: foreign record | PROVEN |
| Duplicate write of the same evaluation id | `ATLAS_IMMUTABILITY_VIOLATION` | Exactly one record persists; other attempts refused | Yes | none | reliability: immutability; concurrency same-id | PROVEN |
| Concurrent writes, same id | In-process per-path lock | One win, bounded typed refusals, no partial state | Yes | none | reliability: concurrency | PROVEN |
| Concurrent writes, different ids | Per-path locks (distinct keys) | All persist as valid JSON; unique history | Yes | none | reliability: concurrency (12 writers) | PROVEN |
| Read during write | Atomic rename boundary | Reader sees old or new record, never a fragment | Yes | none | reliability: concurrent reads | PROVEN |
| Disk/write error mid-commit | Temp write or rename fails → `AtomicJsonWriteError(phase)`; temp removed | No canonical change; error propagates | Yes (old state) | operation reports failure | atomic-json primitive (repository tests) | PROVEN (primitive) |
| Cross-process writers | Out of architecture (single supervised daemon per workspace) | Documented prohibition | n/a | none if respected | recovery doc | ARCHITECTURE CONSTRAINT |
| Stale fingerprint (material change) | Freshness comparison per dimension | STALE/INCOMPLETE with exact reasons; history kept | Yes | evidence marked not current | invariants: staleness table; MI-1 node-change proof | PROVEN |
| Qualification smuggling (single-condition / failed outcomes) | `deriveQualification` rules | Never TESTED without paired COMPLETED conditions | Yes | none | invariants: qualification attack matrix | PROVEN (tightened in MI-1B) |
| Pathological/unbounded metadata | Contract bounds (max lengths, counts) + strict schemas | Oversized/invalid input refused at write; corrupt at read if foreign | Yes | none | contract validation paths | PROVEN |
| Evidence ref is a traversal/absolute path | Doctor resolver containment (refuses absolute + escaping refs) | Counted dangling; never resolved outside the evidence root | Yes | investigate | audit: resolver behavior | PROVEN |
| Scale: many records | Batch list scan | List path scans once (9.1× faster at 1000 records); write path linear in fsync cost | Yes | none | scale probes 100/1000 | MEASURED |
| Secret material in records/fixtures | Secret scan (MI-1B changed surfaces) | No credentials, tokens, or absolute private paths in records, sidecars, fixtures, or reports | n/a | none | manual scan of changed surfaces | PROVEN (see handoff) |
