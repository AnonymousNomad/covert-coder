# Covert — Release Control Board

Buckets (canonical, exact): **RELEASE BLOCKER** (RC cannot ship until closed) · **RELEASE FEATURE**
(committed V1 functionality — complete or explicitly remove from V1 scope) · **FOUNDATION** (architecture
required now to prevent replacement/rework; activation may stay gated) · **BACKLOG** (valuable; must not
interrupt convergence). `REJECTED` is a **disposition**. `POST-RC` is a **milestone/tag**, not a bucket.

## RELEASE BLOCKER
| ID | Item | State | Rationale |
| --- | --- | --- | --- |
| (none currently) | — | — | Nothing on the canonical supported V1 path is currently proven blocked by this board. PR #41/gfx900 is experimental hardware qualification and must not block RC merely because the experiment exists; the compat-path status defect (below) is scoped to that experimental path. |

## RELEASE FEATURE (complete or explicitly cut from V1)
| ID | Item | State | Notes |
| --- | --- | --- | --- |
| RF-01 | DESKTOP-PACKAGING-1R3 installed-app lifecycle (pairing → installed terminal → restart proof) | RESUME-READY (floor green 4.14 GB ≥ 3.07 GB at 15:05); not executed | Committed desktop lane; owner runs from `da320b96fc9ab2ec4da7d0c24150d24ce90d2c17` |
| RF-02 | UI-ID-001 installed build identity (`Start Session` vs `OPEN SESSION` provenance) | UNRESOLVED / PACKAGING HANDOFF | Operator-visible identity of the installed product; packaging lane |
| RF-03 | DESKTOP-SECURITY-DEPENDENCY | BLOCKED — DISPOSITION: external research required | No dependency mutation authorized in-slice |
| RF-04 | Model Intelligence committed seams: Atlas/Harness Sync/resident binding accepted candidates pending convergence; MI-1C residuals (false-READY legacy audit, Veritas, arch-gate disposition) | PARTIAL (accepted candidates) | Complete or explicitly re-scope at convergence review |
| RF-05 | llama.cpp explicit compatibility runtime: full live lifecycle | PARTIAL / RESOURCE ADMISSION (host physical < 6,656 MB) | Feature of the experimental compat lane; completes when hardware window allows, not an RC blocker |
| RF-06 | Compat-path `/api/models/status` defect (500 / ≥30 s hang→502 when no engine runs in LLAMA_CPP composition) | ISOLATED — repair staged | **Scope determination: affects only the experimental/refusal path; the canonical Unsloth composition is unaffected (status route exercised green in prior canonical lanes).** Not an RC blocker; fix with the compat lane |

## FOUNDATION (required now; activation may remain gated)
| ID | Item | Why it must exist now |
| --- | --- | --- |
| FN-01 | Protocol-family adapter boundary (Native / OpenAI-Compatible / Anthropic-Compatible / Covert-Managed Local / External Local / Aggregator-Catalogue / Custom) on the existing Model Access chain | prevents another Model Manager redesign per provider |
| FN-02 | Catalogue ≠ execution separation (representable-but-not-executable artifacts across GGUF/Safetensors/Transformers) | truthfulness for HF-scale catalogues |
| FN-03 | Assisted localhost detection contract (detect → propose; never auto-enroll/authorize/route/transmit) | beginner onboarding without Authority bypass |
| FN-04 | Capability-observation store distinct from routes (documented vs observed/qualified) | prevents "HTTP 200 = qualified" |

## BACKLOG (milestone tag shown in [brackets])
| ID | Item | Tag |
| --- | --- | --- |
| BL-01 | OpenRouter live catalogue search + capability mapping | [POST-RC] |
| BL-02 | Safetensors/Transformers acquisition planning (no execution claim) | [POST-RC] |
| BL-03 | vLLM / arbitrary OpenAI-compatible external-runtime qualification | [POST-RC] |
| BL-04 | Embeddings/multimodal surfaces per current contracts | [POST-RC] |
| BL-05 | gfx900 real-hardware qualification matrix (HIP/ROCm evidence) | [EXPERIMENT] |

## Dispositions (not buckets)
| Item | Disposition | Reason |
| --- | --- | --- |
| Silent cloud fallback / auto-enrollment of detected servers | REJECTED | violates Authority + no-silent-fallback law |
| Hardcoded provider catalogues where trustworthy live discovery exists | REJECTED | drift/poisoning |
| New credential store / model registry / router | REJECTED | duplicates canonical systems |
| Full provider ecosystem in RC1 | REJECTED-IN-SCOPE | optimize finite release; seams now, features after |

Rule: every entry cites verified source evidence; no UI/documentation inference.
