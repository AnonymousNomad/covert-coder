# D2 — FULL LOCAL MODEL LIFECYCLE (RESULT: PASS)

Artifact: `E:\models\smollm2-360m-instruct-q8_0.gguf` (386,404,992 bytes — present & verified)
Surfaces: supervised production stack (supervisor + arch + legacy + facade), governed operations only.
Raw evidence: `d2-lifecycle.json` (BEFORE: broke at register 400), `d2-lifecycle-AFTER.json`.

## Root cause found (the real break)
Acquisition (import/download) copies artifacts to the **workspace** `models/` directory, but `ModelRuntime.register()` and `local://` resolution only looked in the **repo root** `models/` directory:
`model-runtime.ts` — `file = path.resolve(this.modelDir, rel)` → "artifact not found in models directory" → registration, inventory projection, STARTABLE and READY were all unreachable (Luna's frozen D2 gate).

## Bounded repair (one owner: model-runtime.ts)
- Added `resolveArtifactPath(rel)`: repo-root candidate first, then `<workspace>/models/<rel>`; used by `register()` and by `entryFromManifest()` local:// resolution. Existing starter-manifest behavior unchanged; no fake state introduced.

## AFTER (governed operations, real engine)
| Step | Result |
|---|---|
| import | 200 (artifact copied to workspace/models + manifest) |
| register | 200 (id `smollm2-360m-instruct-q8_0`) |
| start #1 | 200 |
| **real inference #1** | **`D2-INFERENCE-ONE`** (real engine generation) |
| stop | 200 |
| start #2 | 200 |
| **real inference #2** | **`D2-INFERENCE-TWO`** (real engine generation after restart) |
| status | r 200 (ingested model present; bundled manifest entries show truthful `artifact_available:false` for a non-present starter artifact) |

Probe caveat (documented honestly): the probe polled `/api/models/ready` (plural) — the canonical route is `GET /api/model/ready` (singular, per policy) — so the poll returned 404 and the `ready` booleans are probe artifacts; the two real generations prove READY + serving. Probe path corrected for future runs.

## Still to run (next blocks)
- D2 negative controls (missing/corrupt/duplicate/stale, duplicate start, engine death, stop-already-stopped).
- D2 authority regression rerun (prepare/binding/unauthorized/wrong-path).
- Wave 10A owned-engine cleanup proof.
