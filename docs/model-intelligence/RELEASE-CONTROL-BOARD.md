# Covert — Provider-Ecosystem Release Control Board (scoped)

**SCOPE:** This board governs the **provider/backend/model-runtime ecosystem** only. It is **not** the
global Covert release authority. The global release remains subject to workstation, security, integration,
packaging, clean-user/clean-machine, regression, CI, and single-RC-SHA gates owned by their respective lanes.

**PROVIDER-ECOSYSTEM RELEASE BLOCKERS: NONE CURRENTLY IDENTIFIED** (within this lane's evidence and
ownership; global blockers are not classified or closed here).

Buckets: **RELEASE BLOCKER** (this ecosystem cannot ship until closed) · **RELEASE FEATURE** (committed
to the supported V1 release — complete or explicitly remove from V1 scope) · **FOUNDATION** (architecture
required now to prevent replacement/rework; activation may stay gated) · **BACKLOG** (valuable; must not
interrupt convergence). `REJECTED` is a disposition. `POST-RC` is a milestone/tag.

## RELEASE BLOCKER
| ID | Item | State |
| --- | --- | --- |
| — | None currently identified within the provider-ecosystem scope | — |

## RELEASE FEATURE (supported-V1 committed functionality)
| ID | Item | State | Notes |
| --- | --- | --- | --- |
| RF-01 | DESKTOP-PACKAGING-1R3 installed-app lifecycle | RESUME-READY (floor green 4.14 GB ≥ 3.07 GB at 15:05) | Owned by the desktop packaging lane, resumed from `da320b96fc9ab2ec4da7d0c24150d24ce90d2c17` |
| RF-02 | UI-ID-001 installed build identity ambiguity | UNRESOLVED / PACKAGING HANDOFF | Operator-visible installed-product identity |
| RF-03 | DESKTOP-SECURITY-DEPENDENCY | BLOCKED — external research required | No dependency mutation in this lane |
| RF-04 | Model Intelligence accepted candidates pending convergence (Atlas/Harness Sync/resident binding + MI-1C residuals: false-READY legacy audit, Veritas, arch-gate disposition) | PARTIAL | Convergence review completes or re-scopes |
| RF-05 | Canonical Unsloth runtime path — untouched, unaffected by any experimental finding | OPERATIONAL (passport-scoped) | Explicitly listed so reclassification of experiments cannot touch it |

## FOUNDATION (required now; activation not required)
| ID | Item | Why |
| --- | --- | --- |
| FN-01 | Runtime Broker adapter boundary + explicit backend selection seam (as shipped on PR #41: composed recovery slot, operator-activated, no silent fallback) | This **reusable architectural seam** is foundation; it prevents the next runtime integration from redesigning Model Manager. The seam is distinct from qualifying any one experimental target. |
| FN-02 | Protocol-family adapter boundary (Native / OpenAI-Compatible / Anthropic-Compatible / Covert-Managed Local / External Local / Aggregator-Catalogue / Custom) on the existing Model Access identity chain | Prevents per-provider redesign |
| FN-03 | Catalogue ≠ execution separation (representable-but-not-executable artifacts; GGUF/Safetensors/Transformers classes) | Catalogue truthfulness at HF scale |
| FN-04 | Assisted localhost detection contract (detect → propose; never auto-enroll/authorize/route/transmit) | Beginner onboarding without Authority bypass |
| FN-05 | Capability-observation store distinct from routes (documented vs observed/qualified) | Prevents "HTTP 200 = qualified" |

## BACKLOG
| ID | Item | Tag |
| --- | --- | --- |
| BL-01 | gfx900 hardware qualification (HIP/ROCm evidence matrix). Evidence preserved; status **NOT PROVEN** | [EXPERIMENT] |
| BL-02 | Known defect: `/api/models/status` 500 / ≥30 s hang→502 — demonstrably confined to the unsupported LLAMA_CPP (experimental/refusal) composition; canonical Unsloth composition unaffected. No V1 route evidence to the contrary found. No repair in this lane. | [EXPERIMENT] |
| BL-03 | OpenRouter live catalogue search + capability mapping | [POST-RC] |
| BL-04 | Safetensors/Transformers acquisition planning (no execution claim) | [POST-RC] |
| BL-05 | vLLM / arbitrary OpenAI-compatible external-runtime qualification | [POST-RC] |
| BL-06 | Embeddings/multimodal surfaces per current contracts | [POST-RC] |

## Dispositions (not buckets)
REJECTED (disposition): silent cloud fallback; auto-enrollment of detected servers; hardcoded provider
catalogues where trustworthy live discovery exists; new credential store / model registry / router;
full provider ecosystem inside RC1.
