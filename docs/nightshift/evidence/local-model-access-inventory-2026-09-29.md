# Local GGUF Model Access inventory and digest evidence — 2026-09-29

## Artifact identity

- Registered model: `lfm2.5-2.6b-q4_k_m-02a8b7e1`
- File: `E:/models/house-model/lfm25_gguf/LFM2.5-2.6B-Q4_K_M.gguf`
- Format / quantization: GGUF / Q4_K_M
- Size: `1,674,455,040` bytes
- Fresh SHA-256: `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`
- The full digest matches the eight-character digest suffix in the registered ID and the previously recorded Runtime Passport artifact digest.

The bounded inventory under `E:/models/house-model` found this one GGUF. Hashing read the file only. The canonical `.aide/ingested-models.json` entry now retains the full digest; its original bytes were copied to a temporary backup before the digest field was added. The registry edit changed only that record's `sha256` metadata.

## Model Access projection

`GET /api/models/manager` was evaluated with the actual local ingested registry entry. It returned the imported artifact as `LOCAL_IMPORT`, `INSTALLED`, with filename and `GGUF` format. The digest is surfaced as `expected_sha256` with `hash_status=EXPECTED`; `observed_sha256` remains null until an authorized runtime observation binds the digest to the loaded model. The response does not contain the absolute model path.

The model's qualification remains `REQUIRES_PREFLIGHT` and readiness remains `SETUP_REQUIRED`. Artifact identity and availability do not establish model loading, inference quality, or release qualification.

## Source changes and verification

The Covert import path now persists the SHA-256 it already computes, reloads only a valid 64-character digest, and keeps the digest across runtime restarts. Re-ingesting an existing imported identity refreshes its digest only for the same path or a matching previously stored full digest; a differing full digest fails closed. Model Access presents this persisted value as expected evidence, separate from a runtime-observed hash.

- `node --test tests/arch/model-runtime.test.ts tests/arch/model-access.test.ts`: 16 passed, 0 failed, 6 skipped. Skips are the existing bundled GGUF dependent cases; the new synthetic GGUF persistence test ran and passed.
- `npx --no-install tsc -p tsconfig.node.json --noEmit`: passed.
- Scoped ESLint for the changed runtime, view, and test files: passed.
- A real-registry Model Access projection check passed for exact identity, expected digest, non-observed status, `REQUIRES_PREFLIGHT`, `SETUP_REQUIRED`, and path redaction.
- No runtime was started and no inference request was made in this verification.

## Fresh local qualification admission check

At `2026-09-29T11:54:38-05:00`, a read-only Windows sample reported 3.347 GiB free physical RAM and 3.818 GiB free commit (`CommitLimit - CommittedBytes`). The `scripts/qualification/unsloth-runtime-v1-closeout.mjs` start gate requires at least 6.5 GiB free physical RAM, 5.0 GiB free commit, and no existing runtime process, among other conditions. An existing `llama-server.exe` process (PID 3152) was also present. This bounded sample fails both memory floors; it is not a full runtime preflight or model qualification. No process was stopped, no runtime was started, and no inference was attempted.

## Exact-SHA CI

The earlier imported-model visibility checkpoint `5f3fc845ebbb8381f09b0c4b48658e94735704b0` passed AIDE CI `36596351172`, all 22 workflow steps. The digest persistence source checkpoint `30377fb6c1b0004cb56ed8819a8ab5543f221bdf` passed exact-SHA AIDE CI `36598309737`, all 22 workflow steps. Neither result proves a live model load or inference.

The subsequent evidence checkpoint `ae9f73d451a8ebacdd2a725f7a6278e7960f928a` passed exact-SHA AIDE CI `36601309894`, all 22 workflow steps. It records the read-only admission sample above and does not change local model qualification.
