# Model Atlas — Recovery & Operations Runbook (MI-1B)

Audience: operators and developers. This is operational documentation, not marketing.
Law: **evidence is never silently deleted, repaired, or manufactured.**

## Storage layout (canonical, internal)

```text
<workspace>/.aide/atlas/
├── evaluations/
│   ├── <evaluation_id>.json        # immutable evaluation record (the evidence)
│   └── <evaluation_id>.sha256      # integrity sidecar: sha256 of the record bytes + byte count
└── candidates/
    └── <sha256(model_id)[0:32]>.json   # latest execution-free evaluation candidate (replaceable)
```

- Records are append-only. A repeated evaluation creates a new `evaluation_id`; history is never rewritten.
- Candidates are derived, pending projections; latest-wins replacement is expected and safe.
- Atomic write: every file is written to a same-directory temp, fsynced, re-read for verification, then renamed
  over the canonical path (repository primitive `node/src/services/atomic-json.ts`). Readers see the old file or
  the new file, never a half-written one. Power-loss durability is explicitly not promised by that primitive.
- Locking: an in-process per-path mutation lock serializes writes within the single supervised Node service.
  Cross-process writers are outside the supported architecture — do not run two daemons against one workspace.

## Identify corruption (read-only)

```text
node scripts/model-atlas-doctor.mjs --workspace <workspace> [--evidence-root <repo-or-evidence-root>] [--json <report>]
```

Exit code 0 = healthy, 1 = issues found. It reports and never modifies anything. Classes:

| Report field | Meaning | Healthy? |
| --- | --- | --- |
| `totals.corrupt` | file unreadable, invalid JSON, invalid schema, wrong type, or filename ≠ `evaluation_id` | NO |
| `totals.integrity_mismatch` | sidecar digest contradicts the record bytes (tampering or bit-rot) | NO |
| `totals.unverified` | no sidecar (older records / crash before sidecar commit) | yes (absence ≠ corruption) |
| `duplicate_evaluation_ids` | the same evidence id present more than once | NO |
| `dangling_recommendation_refs` | recommendation cites evidence not recorded on its evaluation | NO |
| `unsupported_schema_files` | JSON whose `schema` is a different version | NO |
| `evidence_refs.dangling` | resolved evidence reference missing (when `--evidence-root` provided) | NO |

The same checks are available programmatically: `createModelAtlas({ workspace }).audit(options)`.

## What is safe to inspect

Everything above is read-only. You may open records in any text editor; they are pretty-printed JSON.

## What must never be silently deleted

- Any `evaluations/*.json` (including corrupt ones — they are evidence of a failure).
- Any `.sha256` sidecar that contradicts its record (keep it; it is the tamper witness).
- The doctor report itself when attached to an investigation.

## How healthy records remain usable

State is composed per model: the latest valid record is still returned together with
`stale_reasons: ['corrupt_evidence']` or `['integrity_mismatch']` and `evaluation_state: INCOMPLETE`.
A damaged sibling never hides healthy evidence, and no UI shows corrupt evidence as evaluated.

## If corruption is found (operator procedure)

1. Run the doctor with `--json` and keep the report.
2. Identify the affected files from `issues`.
3. Do **not** delete or edit evidence in place. Move suspect files to a quarantine folder
   (e.g. `.aide/atlas-quarantine/<timestamp>/`) only with explicit operator approval, preserving the report.
4. Re-run the doctor. Remaining healthy records continue to serve the UI as before.
5. For a tampering finding, treat the machine/workspace as suspect until the cause is understood
   (the sidecar cannot distinguish malice from bit-rot; both are integrity failures).

## Index / projection reconstruction

There is no persistent index. History and model views are recomputed from the immutable files on every read,
so a lost or stale projection cannot exist; nothing needs rebuilding. Candidates (`candidates/*.json`) are
rebuildable by Harness Sync at any time and are not evidence.

## Backups

Copy the whole `<workspace>/.aide/atlas/` directory (records + sidecars + candidates) while the daemon is
stopped. Restoring a backup is safe: records are immutable and self-describing. After restoring, run the
doctor — old records without sidecars will report `unverified`, which is expected.

## Schema versioning posture

- The version IS the `schema` literal on each record (`covert.model-atlas.evaluation.v1`); sidecars carry
  `covert.model-atlas.integrity.v1`.
- Older versions: currently none exist. If a v2 is ever introduced, the reader must keep v1 parsing
  (or an explicit, non-destructive migration that writes NEW records and leaves v1 files untouched).
- Unsupported newer versions are treated as corrupt (visible in the doctor under
  `unsupported_schema_files`) — fail visible, never best-effort parse.
- Rollback: because migrations must be additive and non-destructive, rolling back the daemon does not
  require rolling back data; the older daemon reports newer files as unsupported (corrupt) rather than
  guessing.

## Authority boundary

The doctor and all reliability paths are read-only. Deleting, quarantining, migrating, or rewriting
evidence requires explicit operator approval. Execution of evaluations remains governed by Authority and
is not part of this subsystem (see `MI-2-DESIGN-NOTE.md`).
