# Local Model Evidence Intake — 2026-10-09

## Disposition

`LOCAL_MODEL_EVIDENCE_PRESERVED_AND_ACCEPTED_AS_CANONICAL_INPUT`

This is an evidence intake into the existing Cipher/Liquid implementation lane. It does not replace the existing Model Manager, Broker, Harness Sync, Model Atlas, Resident, Authority, or release evidence owners. It does not qualify Liquid for the Cipher Resident role and does not claim the current host is ready to start a model.

## Source evidence and publication

- Evidence branch: `feat/local-model-demo-proof-20261007`
- Preserved checkpoint: `d312738af787d30fd3d1e174cec9366dc7eb9c02`
- Current evidence tip verified on `origin` at `2026-10-09 12:02 -05:00`: `8b0220753848088416c67a743be4f299bbab91b7`
- Exact-SHA CI run: [37938012906](https://github.com/AnonymousNomad/covert-coder/actions/runs/37938012906), completed with failure on `8b0220753848088416c67a743be4f299bbab91b7`.
- CI disposition: `CI_RED_NOT_ATTRIBUTED_TO_LOCAL_MODEL_EVIDENCE_COMMIT`. This intake does not repair or rewrite the evidence branch to obtain green CI.
- Canonical-input record: `LOCAL-MODEL-C-RECOVERY-RECHECK-2026-10-09.md` and `.json` at [the evidence tip](https://github.com/AnonymousNomad/covert-coder/tree/8b0220753848088416c67a743be4f299bbab91b7/docs/nightshift/evidence).

The prior recovery recheck's fixture-backed ModelHub tests passed (30/30 unit and 12/12 architecture tests). Those tests do not prove live Hugging Face acquisition, current artifact bytes, runtime launch, or inference.

## Canonical artifact reconciliation

The pinned identity matches the existing Liquid artifact already present in Covert's V1 Unsloth Passport, `BrokerModelRuntime` qualification history, Model Access/import history, and model card:

| Field | Canonical value |
|---|---|
| Artifact | `LFM2.5-2.6B-Q4_K_M.gguf` |
| Size | `1,674,455,040` bytes |
| SHA-256 recorded by prior verification | `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed` |
| Upstream | `LiquidAI/LFM2.5-2.6B-GGUF` |
| Pinned revision | `e7caca5d835a3901a8e0d63e94009429bafafdfc` |
| Existing Covert model ID | `lfm2.5-2.6b-q4_k_m-02a8b7e1` |

The bounded source check observed the expected filename and size at `E:\models\house-model\lfm25_gguf\LFM2.5-2.6B-Q4_K_M.gguf`. The E: source was preserved. Its current bytes were **not** hashed or structurally parsed in this check. The recorded SHA above remains historical until a safe independent copy is hashed and validated. Do not download another copy unless later evidence shows the existing bytes are absent or unusable; a new download now would duplicate an already represented artifact identity.

## Qualification boundary

The existing [Unsloth V1 Passport](../../design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json), [model card](MODEL-CARD-LFM2.5-2.6B-Q4_K_M.md), and [runtime closure record](LOCAL-RUNTIME-CLOSURE-2026-09-30.md) contain historical evidence for the exact artifact under a narrow profile: native Windows Administrator, Unsloth `2026.9.11`, Vulkan, GTX 1060 Mobile, and the recorded request/runtime profile. The runtime closure also records successful exact-model start, generation, stop, restart, and second generation at that earlier time.

That history does **not** establish:

- current artifact-byte integrity or current safe accessibility;
- current canonical Admission `START`;
- current runtime readiness;
- `ROLE=CIPHER_RESIDENT` qualification;
- Resident-specific instruction, handoff, authority, refusal, or project-state performance;
- general tool-use qualification or release readiness.

The Passport's partial tool-call observations do not satisfy the Resident role gate. No qualification is inherited merely because the runtime or artifact was previously qualified.

## Current bounded gates

### Artifact-copy capacity

At `2026-10-09 12:02 -05:00`, C: had `186,351,616` bytes free. The required pre-copy floor is `3,348,910,080` bytes, leaving a measured shortfall of `3,162,558,464` bytes. C: remains physically independent from the E: source, but it cannot currently hold the required recovery copy with the prescribed margin.

Bounded C: cache measurements found `903,795,263` bytes across clearly identified developer/package/shader caches:

| Measured directory | Bytes |
|---|---:|
| `C:\Users\Grey_\.cargo\registry` | 694,686,617 |
| `C:\Users\Grey_\AppData\Local\npm-cache` | 163,984,030 |
| `C:\Users\Grey_\AppData\Local\Unity\Caches` | 25,180,456 |
| `C:\Users\Grey_\AppData\Local\pip\Cache` | 7,918,822 |
| `C:\Users\Grey_\.m2\repository` | 6,159,293 |
| `C:\Users\Grey_\AppData\Local\NVIDIA\DXCache` | 5,726,208 |
| `C:\Users\Grey_\AppData\Local\D3DSCache` | 122,880 |
| `C:\Users\Grey_\AppData\Local\NuGet\v3-cache` | 11,279 |
| `C:\Users\Grey_\AppData\Local\uv\cache` | 5,587 |
| `C:\Users\Grey_\AppData\Local\NVIDIA\GLCache` | 64 |
| `C:\Users\Grey_\AppData\Local\ms-playwright` | 27 |
| `C:\Users\Grey_\AppData\Local\ms-playwright-go` | 0 |
| **Measured candidate total** | **903,795,263** |

Even treating every byte in that candidate set as reclaimable would leave `2,258,763,201` bytes below the required floor. Including the separately measured Tauri updater directory (`129,081,000` bytes) and all Temp contents (`19,675,171` bytes) raises the candidate total to `1,052,551,434` bytes and still leaves `2,110,007,030` bytes short. No cache was moved or deleted. The Rust toolchain (`619,529,243` bytes) and Android SDK (`205,250,142` bytes) were measured separately and excluded because they are installed development toolchains, not disposable caches; relocating them would change other development workflows. The Codex primary runtime (`1,392,518,114` bytes), OpenCode state, browser data, recovery snapshots, Git history, WSL data, credentials, and unique project state remain protected.

Current operation state: `ACQUISITION_BLOCKED_CAPACITY` for the bounded independent-copy operation only. This does not change the global `RECOVERY_PARTIAL` disposition and does not block unrelated work that does not depend on the uncopied artifact.

### Runtime Admission

The latest canonical Admission record in the recovery recheck is from `2026-10-09T13:04:05.660Z` and returned `REFUSE_RESOURCE`: free physical memory `5,461 MiB` against `6,656 MiB`; commit `6,373 MiB` against `5,120 MiB`; VRAM `5,234 MiB` against `4,608 MiB`; GPU utilization `3%` against a strict below-`50%` ceiling. Physical RAM was `1,195 MiB` below the floor. This is a historical measurement, not a fresh Admission result for a launch now.

Do not start a model until a safe exact-artifact copy has been verified and an immediate canonical Admission returns `START` with all unchanged floors satisfied.

## Integration order after capacity clears

1. Copy the existing E: artifact once to the independent C: target; hash that copy and validate GGUF structure. Preserve the E: original.
2. Reconcile the verified copy against the existing canonical Model Manager identity and registration. Do not create a duplicate model or bypass the canonical owner.
3. Use the existing Harness Sync and Model Atlas flow for a fresh `ROLE=CIPHER_RESIDENT` evaluation. Bind evidence to the exact artifact hash, runtime/profile, host, and evaluation revision. Do not inherit the Unsloth V1 qualification as Resident evidence.
4. Take fresh canonical Admission immediately before the Authority-governed runtime start. Preserve exact model identity, no substitution, and canonical Runtime Broker/Model Manager ownership.
5. Prove the Resident-specific inference and required lifecycle/authority behavior through the governed path. Continue the Cipher Laptop/workstation → Harness/Atlas → Mission Composer → Authority/Orchestrator → verification/receipt feedback vertical; a generic chat response is not the endpoint.
6. Only after those results are recorded may the demo state advance toward `CIPHER_LIVE_DEMO`.

## Audit placement

No separately named Product-Lock / Implementation Reconciliation Audit file was present in this MI1B checkout when searched. This document is a linked intake for that audit, not a replacement or claim that the wider audit is complete. The evidence branch and PR #31 remain unmerged and untouched.

## Evidence files

- `docs/design/local-runtime-lab/evidence/UNSLOTH-RUNTIME-PASSPORT-V1.json`
- `docs/nightshift/evidence/MODEL-CARD-LFM2.5-2.6B-Q4_K_M.md`
- `docs/nightshift/evidence/LOCAL-RUNTIME-CLOSURE-2026-09-30.md`
- `docs/nightshift/evidence/LOCAL-MODEL-EVIDENCE-INTAKE-2026-10-09.md`
- `LOCAL-MODEL-C-RECOVERY-RECHECK-2026-10-09.md` and `.json` on evidence tip `8b0220753848088416c67a743be4f299bbab91b7`
