# Covert workstation / Cipher implementation checkpoint — 2026-10-07 UTC

Production implementation continued from live Windows source. This is a bounded implementation checkpoint, not platform or release acceptance.

## Source truth

Initial 01:42–01:45 UTC: E:\covert-workstation-integration-saul-20261006, feat/workstation-integration-saul-20261006, clean 14b9ad9fcfe69b9fbb628fe1a913c9a2e4b225c4, upstream origin/feat/workstation-integration-saul-20261006, fetched 0/0. No newer target work was discarded. Final target truth and exact commit history are in the final receipt and branch history.

Luna's E:\covert-sovereign-workstation-shell remains at 12b999d329b59fd7dd480504ce84670b0de521f5, no upstream. Its original 18 modified + 4 untracked / 40-hash snapshot remained unchanged through 03:41 UTC. At 04:02 UTC current observed source changed: 22 modified + 4 untracked; three previously hashed files differ (terminal-sessions route and generated ownership decisions); a new docs/covert-world reconciliation directory and additional OpenAPI/facade tests are present. The latest terminal route adds a truthful NOT_READY owner check. This is foreign lane work, preserved and not staged or overwritten. KEEP the implementation and history; INTEGRATE the new owner-readiness contract only after owner convergence and focused evidence. Our branch is not the latest integrated shell.

Packaging E:\covert-desktop-dogfood-20261006 remains clean da320b96fc9ab2ec4da7d0c24150d24ce90d2c17, descendant of original shell HEAD (0/6). Shell is 7/0 against convergence cfaad716a01af06dfe61dcfb3d1acd7dea9b4b2c. Original worktrees, unrelated directives and foreign processes were preserved.

## Production behavior implemented

- WSL: UTF-16LE identities, truthful installed/stopped/running/unknown discovery, exact distro/executable/cwd launch. Interactive WSL remains failing; no silent backend fallback.
- Resource Monitor: actual hardware-owner snapshot in a lazy internal utility window, truthful cached timestamps, stale/unknown states, hidden polling suppression and disposal. Unsupported utilization says UNAVAILABLE.
- Cipher durable spine: one logical Resident identity; bounded metadata-only prepare/decision/attempt/observation lineage linked to actual Authority and required audit receipts. Immutable prepared identity and atomic holds; failed persistence denies new effects. Unknown outcomes are not replayed.
- Integrity/lockdown: deterministic persisted critical hold and pending-permit revocation; operator reads/evidence survive. Already-running processes/credentials/network are not claimed contained. Local chain is unsigned and unwitnessed.
- Shared seat: operator HTTP and trusted pre-enrolled service principal invoke the same canonical routes/Authority dispatcher. Exact intent, revoked/forged principal and scope widening negatives pass. No live Resident enrollment or remote credential/channel activation.
- Operator Notebook: approved provenance, RETAIN/SESSION/DO_NOT_RETAIN distinctions, revision correction, logical removal with content-free tombstones. Historical identity capacity is reserved before accepting content. No memory-derived grants or automatic context ingestion.
- Private records: generic file/patch/search/agent adapters reject direct and resolved Laptop private paths, including Windows aliases. Canonical Notebook access remains. This is not OS/terminal isolation.
- Cipher Laptop utility: ACTIVITY / INTEGRITY / NOTEBOOK use real owners, refresh coalescing/timeouts, visible snapshot age and lifecycle cleanup. Conventional green internal window; fresh pairing required after browser reload. No model, verification, listening or working state is fabricated.
- Packs/policies: strict declarative preview/dependency inspection; scripts/grants/credentials refused; publisher/qualification unknown. One Resident policy type for conservative and broader initiative; appearance/personality/voice independent of grants; all four Scout/Rook/Mutt/Tinker preferences supported without activating capture. No marketplace or connector execution.

Existing Monaco, two separately owned native PTYs, ASK/PLAN/ACT, governed AgentLoop and readiness work were rehosted/preserved. Window management did not become domain truth.

## Production files

Backend: common/contracts/{cipher-laptop,cipher-notebook,capability-seat}.ts; common/platform/{covert-pack,resident-policy}.ts; common/security/{operation-policy,private-platform-state}.mjs; node/src/services/{cipher-ledger,cipher-authority-recorder,cipher-notebook,execution-authority,workspace,agent-tools}; node/src/routes/{cipher-laptop,fs}; server/OpenAPI/generated contracts. Earlier runtime/terminal/hardware files are identified by commits 36e0f11 and 912e884.

UI: browser/src/panels/cipher-laptop.ts; cockpit/CockpitShell.ts; desktop/app-registry.ts and desktop.css; services/api.ts; store/state.ts; shell/shell.ts. Exact since-base file inventory is archived. No third-party companion artwork was copied.

## Verification and failures

Earlier baseline 66, WSL-focused 34, resource-focused 27 and Cipher-focused 133 passed in overlapping separate runs. Private file/alias regressions were observed RED, repaired, then 26 route tests passed. Fresh-context branch review found three Important issues: atomic integrity gate race, mutable lineage identity, historical Notebook capacity. All three were reproduced RED and repaired; review/core 40 and production-focused 133 passed.

Latest production Windows run: 5 PASS / 1 FAIL, serialized installed Edge. Passing: pairing/reattachment, two real PTYs/lifecycle, real editor/AgentLoop/ASK-PLAN-ACT, real Resource Monitor, Cipher Laptop lineage/Notebook/window lifecycle/browser reload. Failing: selected interactive WSL emits no marker. This test stays enabled. Scripted worker fixtures do not qualify a live model.

Expanded architecture: 1077 total, 1065 PASS, 1 FAIL, 11 SKIP, 782.398s. Failure: Helix memory HTTP deadline. Unchanged Helix tests passed 3/3 in isolation and in the latest focused run; wider timeout root cause remains unproved. No deadline/assertion was weakened. A final latest focused/types/lint/contracts receipt is recorded separately; wider whole-product GREEN is not asserted.

## Visual and resource proof

Original reference images were restored and viewed. Latest actual runtime captures were inspected against their black/phosphor-green character, compact rectangular chrome, terminal typography, overlapping windows, sparse desktop and thin dock. Laptop is an operational utility over real records, not a chat/dashboard mock. Existing terminal color aliases now resolve to the established desktop phosphor token. No new palette values/cards/glass were introduced.

Latest Windows build/test/browser run: 82.679s, generation-aware sampled owned tree peak 1687.62 MiB, CPU 98891ms; initial physical 8200 MiB / free commit 6430 MiB; final 6978 / 5181 MiB. Expanded architecture measured peak 739.03 MiB. These are test/build/browser trees, not idle-product budgets. Sampling can miss short children. Earlier PID-only estimates are approximate and were never used to terminate processes. Bundle remains 4.712 MB / 1.218 MB gzip with an open size warning.

Floors remain physical >=3072 MiB and free Windows commit >5120 MiB. No free-virtual-memory substitution, floor reduction or foreign kill. Heavy checks are serialized and gated; latest per-phase receipts preserve any closed gate.

## Security and remaining gates

S29–S35 in SECURITY_ACCEPTANCE_20261006.csv track owner/contract/implementation/negative proof/status. Missing signatures/witness, global effect correlation, control/stop lineage, live Resident enrollment/context leases, immutable project addressing, installation-wide continuity, OS/terminal and app isolation, credentials/egress, aggregate containment, remote authentication, voice/vision privacy and clean restart/recovery remain open or partial. Cipher is never Authority.

Interactive WSL backend ownership/shutdown handoff remains open; system ConPTY diagnostic success is not activation authority. Wider product/full npm regression; latest integrated source adoption; packaged Tauri security and actual-target supply-chain/SBOM (including inherited glib advisory); clean-user; clean-machine; CI; independent Veritas/Ghost evidence; single RC SHA remain global gates.

## Evidence / next slice

Raw RED/GREEN logs, full architecture failure, latest native receipts and runtime screenshots are archived under evidence/20261007 with a byte-verified SHA256 manifest. Hashes prove bytes, not trusted signing or acceptance.

Next executable slice: reconcile owner lane's new terminal-readiness delta; qualify the WSL backend with owned shutdown negatives; establish canonical durable project IDs and context leases before project switching or live Resident seat activation. Move Laptop continuity to the installation-wide canonical owner only with a proven migration/recovery contract. No broad connector, marketplace, capture or self-grant activation.

Latest exact production checks: 158/158 focused tests, zero skips (101.233s); Node types 11.844s, browser types 5.066s, scoped lint 2.560s, all exit 0. Each phase freshly resource-gated. Contract drift result follows in its raw receipt.

Latest OpenAPI/facade/route drift checks: 7/7 PASS, zero skips, 25.729s (actual openapi-drift and route-drift test files). Generated contracts regenerated without tracked drift. Full architecture timeout remains an open wider gate despite this focused pass.

## Exact production commits after 14b9ad9

| SHA | Purpose |
| --- | --- |
| 36e0f11f1de592c7d4f5a1780460528ccddfa0ae | WSL discovery/lifecycle/exact launch |
| 912e8842edcd7f42ddf22a9540d06f9a12b559c6 | Real Resource Monitor |
| 96cd159199ad7161c03fb86c2887d03c12e0eefc | Hardware schema and actual subscription ACK contracts |
| 390d1a076e8ba349b42d7a6d0f3f87aa129ad4fb | Durable Cipher ledger/integrity |
| 1eae672356708e33609236ebcaff43287ec4d8e4 | Required Authority lineage/pending revocation |
| cf7d48ccbf32983a97d81c5eca193c9519397be9 | Shared capability seat/Notebook/review repairs |
| e8829ba99d1c176d4036fa187952dcb41c90d554 | Pack preview/independent Resident policy |
| dbf83e983c9ba91d070c0f7f97b2a285fd112d4d | Private record file-capability repair |
| e5924f71e7ff9131f12faab76e5f90b0866bc9e3 | Mounted Cipher Laptop utility/native proof |

Production receipt observes 62 changed files across these nine commits and target upstream 9 ahead / 0 behind before the evidence-only checkpoint commit. Luna now has 26 dirty entries at unchanged HEAD; packaging remains clean. The evidence-only commit follows this production SHA and is identifiable in branch history. No shared convergence merge or release publication is implied.
