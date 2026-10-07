# Luna Demo-Proof Lane Checkpoint — 2026-10-07

## Status

**IMPLEMENTATION AND FRONTEND BUILD VERIFIED. LIVE HUGGING FACE ACQUISITION, RESOURCE ADMISSION, RUNTIME START, AND INFERENCE REMAIN UNVERIFIED.**

This checkpoint records source and focused test evidence only. It is not a public demo, installed-product, model-load, or inference acceptance claim.

## Lane

- Worktree: `E:\covert-local-model-demo-proof-20261007`
- Branch: `feat/local-model-demo-proof-20261007`
- Base HEAD: `7f79be9f09afa43283d3548b3b2fd0c98a6dbca7`
- Source status at initial checkpoint capture: dirty by this bounded implementation; the implementation freeze is recorded by the Git HEAD containing this note.
- Storage wiring: ModelHub writes beneath `path.join(workspace, 'models')`. The eventual product run must use and verify this E: worktree as its workspace. No C: model fallback was added.

## Implemented

- ModelHub repository inspection returns the immutable Hugging Face repository revision, the GGUF file size, its LFS SHA-256 when present, and the repository license label.
- Download requests and their `capability.external` approval bind repository, filename, revision, expected digest, expected size, and quantization label.
- Downloads resolve the pinned revision. Before publication, the service checks exact size, recomputes SHA-256, and requires a readable GGUF header. A mismatch or unreadable GGUF produces an error and no final artifact or ready manifest.
- Manifests retain pinned source identity, expected and observed digest, observed size, architecture, and embedded license label. The `lfm2` architecture is recognized consistently with the existing ModelRuntime allowlist.
- The Model Access panel has an explicit Hugging Face search → inspect → download/verify → canonical Model Manager registration flow. Search, repository inspection, download, and registration pass through the existing API and Authority approval path. The panel labels registration as local availability and does not claim it starts or qualifies the model.
- Canonical ModelRuntime registration verifies a present manifest against the file size, GGUF architecture, and recomputed SHA-256, then persists the source repository, revision, license, and actual digest. Model Access projects those provenance fields.
- Registration rejects artifact or manifest symlinks and real paths outside the configured model roots.
- The model weights remain outside immutable frontend/application resources.

## Verification

All commands ran from the isolated worktree. Exit codes are shown.

| Command | Result |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | exit 0; 127 packages added; lifecycle scripts disabled |
| `node --test --test-concurrency=1 tests/unit/test-m-hub.mjs tests/unit/test-modelhub-containment.mjs` | exit 0; 27 passed, 0 failed, 0 skipped |
| `node --test --test-concurrency=1 tests/arch/modelhub-routes.test.ts` | exit 0; 12 passed, 0 failed, 0 skipped |
| `node --test --test-concurrency=1 tests/arch/api-client.test.ts` | final exit 0; 23 passed, 0 failed, 0 skipped |
| `node --test --test-concurrency=1 tests/arch/model-register-profile.test.ts` | final exit 0; 10 passed, 0 failed, 0 skipped |
| `node --test --test-concurrency=1 tests/arch/model-access.test.ts` | exit 0; 15 passed, 0 failed, 0 skipped |
| `npx tsc -p tsconfig.node.json --noEmit` | final exit 0 |
| `npx tsc -p browser/tsconfig.browser.json --noEmit` | exit 0 |
| Targeted `npx eslint` over changed source and tests | exit 0 |
| `npm run contracts` | exit 0; regenerated `common/openapi.json` for 239 operations |
| `npm run build:frontend` | exit 0; 1,424 modules transformed; `browser/dist/index.html` and production assets emitted |
| `git diff --check` | exit 0 |

Build warning: Vite reports that some minified chunks exceed 500 kB; the main JS chunk is about 4.55 MB. No bundle-splitting change was made as part of this lane.

Preserved validation findings:

- The first API-client run was 22/23 because a new test expected a rejected promise from a synchronous schema validation. Production validation correctly threw `BAD_REQUEST` before transport. The test now asserts the synchronous throw; rerun passed 23/23.
- The first Node typecheck found a `Buffer<ArrayBufferLike>` incompatibility in the route-test `Response` fixture. The fixture now passes a `Uint8Array`; rerun typecheck passed.

## Live Gates Still Open

- No live Hugging Face search, repo metadata request, or model download was made. No external operation approval was fabricated or bypassed; the product UI still requires the operator’s one-time Authority decision for each external request.
- No model artifact was written. Source records contain prior exact-artifact qualification evidence for `LiquidAI/LFM2.5-2.6B-GGUF`, revision `e7caca5d835a3901a8e0d63e94009429bafafdfc`, and SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed` ([host inventory](local-gguf-host-inventory-2026-09-30.md), [runtime support contract](../../design/local-runtime-lab/UNSLOTH-V1-SUPPORT-CONTRACT.md)); this is local historical evidence, not a live Hub response or a newly acquired artifact.
- Fresh resource observations before live operations: physical RAM was `3.46 GiB` at `2026-10-07 09:09:08 -05:00`; free commit was `2.64 GiB` at `09:08:55 -05:00`; the GTX 1060 reported `5232 MiB` free VRAM and `15%` GPU use at `09:08:55 -05:00`. The qualified Unsloth profile’s conservative preflight requires at least `6.5 GiB` free RAM, `5 GiB` free commit, `4.5 GiB` free VRAM, GPU use below `50%`, no foreign model runtime, and a free dedicated loopback port. RAM and commit floors fail; the observed VRAM and GPU-use thresholds pass. Runtime ownership and the required port were not qualified. A filtered process inventory found multiple `node.exe` processes and no `python.exe`, `pythonw.exe`, `llama*.exe`, or `covert*.exe` names; the Node processes were not attributed or stopped.
- No runtime start, Resource Admission pass, prompt, model response, terminal journey, shutdown test, browser E2E, video, or screenshot occurred.

## Next Action

Launch this branch in its E: workspace. In Model Access, have the operator approve the exact Hugging Face search and repository/file inspection operations. Before downloading or starting a model, take a fresh serial resource reading and require every qualified-profile preflight floor to pass. Then approve the exact pinned download, verify its digest and size, register it through Model Manager, pass Resource Admission, and record a real prompt/response and clean shutdown. Keep the prior qualification claim tied to the exact artifact hash and runtime profile.
