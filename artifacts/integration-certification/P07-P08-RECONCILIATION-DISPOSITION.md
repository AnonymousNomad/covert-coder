# P0.7 / P0.8 — DISPOSITION: BLOCKED ON RELEASE RECONCILIATION

Evidence (this lane, production 8ea6c8b + repairs): the accepted **handoff CONSUMPTION** machinery (worker-handoff accept/consume + reconstructed context block into the receiving session) exists on the provider lane (elease/provider-handoff-gate-v0.1, Wave 3/4: d977683/a9f0105/f0959f0/8ca8218/67d010e), NOT in production.

Production truth (verified in this lane):
- handoff bundles are WRITE-ONLY: created/persisted/readable via API, with NO context consumer (ledger: memory.handoff-bundles = ORPHANED).
- continuation (Wave 6) IS in production (classification/policy/manager + tests green on this lane).

Consequence:
- **P0.7 (handoff consumption + restart): BLOCKED** — a second worker cannot consume a canonical handoff in production; only the bundle write + continuation planning exist here. The accepted consumption implementation must be reconciled from the provider lane (semantic reconciliation owned by the release-curator lane; the same class as the chat-authority port already landed).
- **P0.8 (local -> external -> local): BLOCKED on the same dependency** — worker interchangeability through one canonical state requires handoff consumption for the receiving worker; the external transport itself is PROVEN (P0.3/P0.4).

Not hacked in: no fake handoff consumer, no transcript-based reconstruction, no second orchestration path. This is recorded in the candidate claim matrix as the remaining reconciliation dependency, not as a pass.

