# COVERT V1 RELEASE — CRITICAL PATH

Snapshot: 2026-09-25 · Branch: `audit/v1-release-closure-matrix` · Base SHA: `e23aec80cd05ab0c237eba793421bb5e7c5a57e7`
Companions: `docs/v1/COVERT-V1-RELEASE-CLOSURE-MATRIX.json` (canonical rows) and `.md` (rendering).

This path identifies actual dependencies and owners from the frozen matrix. It does not estimate dates. No item starts without a named owner and an acceptance condition. No public claim is updated until the P0 set is closed and the claim matrix is re-issued.

Freeze rule: after this document is committed, a new V1 implementation may exist only to close a frozen matrix row or repair a reproduced defect.

---

## 0. Ground truth at freeze

- Certified scope: source core only — candidate `dc0d30ee`, CI run 35869659152, independent certification record, 0 certifier modifications.
- Source assembly head (this base): `e23aec8`.
- Installer: NOT CERTIFIED (accepted boundary). Permanent Resident: PENDING QUALIFICATION. Capability Fabric / Delegation: POST_CANDIDATE.
- Matrix: 176 rows · 10 release blockers (P0) · 62 P1 · 82 P2 · 5 observations.

P0 release blockers (verbatim from the frozen matrix):

| ID | Blocker | Owner |
| --- | --- | --- |
| C1-02 | 30 documented typed routes unreachable through the product edge (27 legacy 404 + 3 shadowed); no route→map drift gate | CORE |
| C2-02 | Canonical `session.json` / `chat-history.json` written non-atomically (crash truncation window) | PLATFORM-STATE |
| C4-01 | Workspace Trust does not exist (model, persistence, enforcement) | SECURITY |
| C4-02 | Local-Only preference bypassed by non-chat egress surfaces | SECURITY |
| C4-04 | `GET /api/modelhub/files` performs token-bearing external egress under auto-permitted `.read` | SECURITY |
| C5-15 | A running agent mission cannot be cancelled | RELIABILITY |
| C6-03 | TUI surface absent (V1 scope decision pending) | DISTRIBUTION |
| C6-09 | glib advisory blocks the affected Linux desktop packaging path | DISTRIBUTION |
| C6-10 | No installer/code signing | DISTRIBUTION |
| C7-30 | No long-horizon regression contract or executable test | RELEASE |

---

## 1. Wave 0 — Independent P0 closures (can run in parallel immediately)

These have no cross-dependencies on each other and should start first.

| Item | Owner | Blocked by | Can run in parallel with | Evidence required | Closure condition |
| --- | --- | --- | --- | --- | --- |
| C4-04 modelhub/files egress (defect) | SECURITY | — | C1-02, C2-02, C4-01 | route classified `capability.external`; test proves consent-off/approval-off denial + journal before fetch | No unapproved token-bearing egress remains on any modelhub route; test in the arch battery |
| C2-02 atomic session/chat writes | PLATFORM-STATE | — | C4-04, C1-02, C4-01 | kill/crash injection test; temp+fsync+rename in both writers; backup on corrupt | Loss bound = acknowledged state only; test proves no truncation |
| C1-02 facade route-map completeness | CORE | — | C4-04, C2-02, C4-01 | regenerated map or explicit direct-only list; route→map drift test; live probe of each affected family through :4777 | Every documented typed route is mapped or explicitly direct-only; drift test fails on a new unmapped route |
| C4-01 Workspace Trust (model + enforcement) | SECURITY | design decision (three-state semantics + policy owner) | C1-02, C2-02, C4-04 | persisted trust state; fail-closed predicate at route/service level; tests for untrusted→restricted→trusted and denial paths | Trust is enforced by a canonical owner, not UI-only; untrusted workspace content cannot reach execution |
| C4-02 Local-Only universal enforcement | SECURITY | C4-04 (shares modelhub surface) | C1-02, C2-02, C4-01 | every egress call site enumerated; preference/consent consulted or exemption documented; test per surface | No external transmission occurs under local-only; claim language re-scoped if any exemption accepted |

Wave 0 exit gate: all five closed with evidence; `npm run check` + arch battery green on the closure SHA; egress manual sweep repeats the enumeration.

---

## 2. Wave 1 — Reliability and truth closures (start after or alongside Wave 0)

| Item | Owner | Blocked by | Notes |
| --- | --- | --- | --- |
| C5-15 mission cancellation + C5-11/C5-12 provider/modelhub timeouts | RELIABILITY | C5-11/C5-12 are prerequisites for meaningful cancel | One workstream: bounded fetch (abort signals, idle timeouts, server request timeout) + cancel API + loop abort; test stops a hung-provider mission |
| C7-30 long-horizon regression contract | RELEASE | Contract definition: none. Execution: after C2-02/C5-15/C2-11 decisions | Define contract now; run the executable test at the closure SHA. Required clauses in §6 |
| C1-12 Veritas producer decision + C1-11 canonical harness surface | HARNESS-CONTEXT | — | Decide: product producer of passing evidence, or intentional no-pass with claim language narrowed |
| C1-05 OpenAPI truth (terminal routes) + C1-06 dead subagent family | CORE | — | Generate doc with production options; register or delete dead family; both covered by drift test |
| C1-07 Authority waiver decision | SECURITY | — | Burn down 20 waivers or record an acceptance decision; flip coverage test strict |
| C5-19 admission as gate | RELIABILITY | C1-02 (route reachability) | Call admission at model/training/agent starts with real resource requirements; disk preflight |
| C5-25 performance budgets + candidate-bound measurement | RELIABILITY | — | Define budgets (launch, first token, RAM, tok/s floor, mission wall-clock); measure at closure SHA. Do not invent numbers — publish definition + rationale with the artifact |
| C3-07 stage-aware claim | HARNESS-CONTEXT | — | Test stage-sensitive skill selection or narrow the claim |
| C3-15/C3-16 handoff worktree/branch preflight + C3-17 incident record | HARNESS-CONTEXT + RESIDENT-LANE | RESIDENT-LANE supplies the incident record | Extend envelope with worktree/branch/HEAD/baseline/clean-dirty/protected boundaries/owned processes; bind preflight to agent start |
| C2-03/C2-04/C2-05 state validation, versioning, corruption policy | PLATFORM-STATE | — | Uniform policy; backups on destructive resets; downgrade behavior documented |
| C2-06 locking/CAS decision | PLATFORM-STATE | scope decision: is multi-instance on one workspace supported? | If supported → P0; if not → document single-instance enforcement |
| C1-08/C4-05/C7-17 reachable surfaces | CORE | C1-02 | Admission, egress manifest, readiness become reachable or explicitly declared console/API-only |
| C1-13 provenance model identity | CORE | C1-02 | Run records bind engine/model identity; receipt stays reachable and truthful |

Wave 1 exit gate: P0 set fully closed; P1 closures that depend on Wave 0 complete; claims for reliability/harness updated only with evidence.

---

## 3. Wave 2 — Distribution decision gate

| Item | Owner | Blocked by | Notes |
| --- | --- | --- | --- |
| C6-03 TUI scope decision | DISTRIBUTION + release owner | — | If V1: build the TUI over the same facade/API and record acceptance. If V1.1: record the scope change explicitly |
| C6-09 glib disposition | DISTRIBUTION | cargo-capable packaging host | Resolve graph to glib ≥0.20.0 or a reviewed mitigation with reachability evidence; re-run clean build/install |
| C6-10 signing + C6-22 SBOM/checksums/provenance automation | DISTRIBUTION + RELEASE | C6-07/C6-08 | Signing required if a packaged installer ships in V1; source release exempt by scope |
| C6-07/C6-08 installer lifecycle | DISTRIBUTION | C6-09 (Linux path), C6-26 install mode | Lifecycle gate green with recorded evidence; fix the `/health` vs `/api/health` probe mismatch |
| C6-12 clean-machine packaged acceptance | DISTRIBUTION | C6-07/C6-08/C6-10 | Documented install → first launch → runtime config → model → mission → update/uninstall on a clean machine |
| C6-26 install privilege model | DISTRIBUTION | — | Declare per-machine vs per-user; prove first-run writes under the declared mode |
| C6-25 Unsloth Runtime V1 admin separation | RUNTIME-LANE | runtime-lane evidence | App install remains elevation-free unless proven otherwise; runtime lane owns the elevation requirement |

Wave 2 exit gate: binary distribution either fully closed (installer certified + signed + acceptance) or explicitly excluded from V1 by a recorded scope decision.

---

## 4. Wave 3 — Lane integrations (owner handoffs)

These are not this lane's execution. Each needs a decision recorded by the release owner.

| Handoff | Item | Owner | Produce | Unblocks |
| --- | --- | --- | --- | --- |
| RELS-04 | Authority chat-contract integration (`e41083d`) | CORE | Integration decision + battery on merged SHA | RELS-03 Resident F1b rerun |
| RELS-03 | Resident F1b qualification | RESIDENT-LANE | One owner rerun on the integrated SHA; result recorded | Resident-dependent release gates |
| C1-10 | Model Manager integration (`d80d184`, MM9) | MODEL-MANAGER-LANE | Broad acceptance + single-manager decision | Local-model claim scope |
| C1-09 / RELS-05 | RuntimeAdapter decision + Runtime V1 Passport (`e41aafa`) | RUNTIME-LANE | Decision: adapter required or ModelRuntime canonical | Runtime claim finality |
| C4-20 | Desktop Control lane head (`aed7efd`) | DESKTOP-CONTROL-LANE | Integrate or defer decision | Broad GUI mission scope |
| RELS-06 / C7-34 | Operator Control displayed-vs-enforced parity | OPERATOR-CONTROL-LANE | Effective-value/source/why-blocked evidence or scope statement | Settings truth claims |
| RELS-01 | Dogfood findings | DOGFOOD-LANE | P0/P1 findings, self-hosted, comparison, failure/recovery evidence | Final acceptance confidence; matrix rows already exist to ingest |
| C7-08 | SetupSession evidence | OPERATOR-CONTROL-LANE | Acceptance evidence for the setup flow | Onboarding claim |
| C7-12 | Model selection scope | MODEL-MANAGER-LANE | Role-only documented or task-aware with measurements | Local-model claim |

Wave 3 exit gate: every open OWNER HANDOFF either has a recorded decision or a dated owner action; no lane is modified from outside.

---

## 5. Wave 4 — Claims and publication (strictly last)

| Item | Owner | Blocked by |
| --- | --- | --- |
| C7-31 claim-matrix reconciliation | RELEASE | Waves 0–3 |
| C4-19 publication guard | RELEASE | C7-31 |
| C1-02-dependent claim rows (receipt/admission/readiness/egress "PROVEN") | RELEASE | C1-02 |
| C3-07 stage-aware claim language | HARNESS-CONTEXT | C3-07 evidence |
| RELS-08 public-site copy | DOCS-PUBLIC | C7-31 |
| C7-01/C7-02/C7-33 README truth + E2E command | DOCS-PUBLIC | none (can run earlier) |
| C7-32 soak artifact | RELEASE | C7-30 execution |

Publication rule: no public claim may exceed qualification evidence. The frozen authoritative surface is `docs/release/RELEASE-CLAIM-MATRIX.md` after reconciliation.

---

## 6. Required V1 long-horizon test contract (C7-30)

Closure requires a written contract plus an executable test. The test may run on real models outside this audit lane. Required coverage:

- Long mission: ≥25 iterations / ≥N tool calls (N fixed by the contract author with rationale).
- Many skill/capability transitions across stages (plan → implement → verify).
- Handoffs between workers, including at least one model switch and one provider switch.
- Interruption/resume: kill the backend mid-mission; restart; resume or fail truthfully.
- Context pressure: force retrieval/context refill and assert bounded context.
- Stale information: mutate workspace/evidence externally; assert the mission does not act on stale state.
- Project switch: with the isolation invariant.

Required invariants (all must be asserted, all fail-loud):

1. No project bleed (session A's context/evidence never appears in session B).
2. No lost obligations (every accepted obligation terminates in a recorded state).
3. No stale capability identity (capability state is re-resolved, not cached across changes).
4. No stale model identity (per-run model id/hash recorded; no silent model substitution).
5. No false completion (`supported_conclusion` honest; unverified stays unverified).
6. No lost verification state (verification records survive restart and are read at request time).

Evidence required: a committed artifact with the invariant matrix, the model ids/hashes used, and the exact SHA tested. No soak claim may be made before this artifact exists (C7-32).

---

## 7. Verification-only closures (highest leverage, lowest risk)

These need tests/evidence/records, not product code:

- C3-07 stage-aware skill selection evidence (or claim narrowed).
- C4-17 desktop battery refresh with an authority fixture.
- C6-06 staged desktop smoke must fail when resources are absent; run in CI.
- C6-07/C6-08 installer target verification and lifecycle evidence at closure SHA.
- C7-05 wire the three ungated integration suites into the battery.
- C7-07 Walkthrough first-run browser acceptance.
- C7-08 SetupSession evidence.
- C7-21 real-host PowerShell/cmd PTY test.
- C3-17 Resident incident record (owner).
- C3-19 P07 polarity clarification.
- C7-32 soak artifact (after C7-30 exists).

---

## 8. Owner handoffs (open, from the matrix)

| Item | Owner | Dependency |
| --- | --- | --- |
| C1-09 | RUNTIME-LANE | RuntimeAdapter decision / Runtime V1 Passport integration |
| C4-20 | DESKTOP-CONTROL-LANE | Lane head integration decision |
| C6-25 | RUNTIME-LANE | Unsloth Runtime V1 elevation requirement |
| RELS-01 | DOGFOOD-LANE | Findings ingestion (lane parked on host recovery) |
| RELS-03 | RESIDENT-LANE | F1b rerun after RELS-04 |
| RELS-04 | CORE | Authority chat-contract integration decision |
| RELS-05 | RUNTIME-LANE | Runtime Passport integration |
| RELS-06 | OPERATOR-CONTROL-LANE | Displayed-vs-enforced settings evidence |

Parked-lane dependencies: RELS-01 (Dogfood), RELS-03 (Resident), C3-17 (Resident incident record). Active-lane dependencies: C1-09, C1-10, C4-16, C4-17, C4-20, C6-25, C7-08, C7-12, C7-34, RELS-05, RELS-06.

---

## 9. Non-goals at freeze

- No new features beyond closing frozen rows or repairing reproduced defects.
- No modification of Desktop Control, Dogfood, Resident, Runtime V1, Authority contract, Model Manager, Operator Control, harness protected implementation, Signature Workstation, or Distribution implementation from this lane.
- No reopening of certified source-core work unless a reproduced defect requires it.
- No public claim update before Wave 4.
- No dates: sequencing and evidence, not estimates.

---

## 10. Critical path summary (dependency order)

```
Wave 0  C4-04 ─┬─ C4-02 ──┐
        C2-02 ─┼─ C1-02 ──┼──> Wave 1 ──> Wave 2 (decision gate) ──> Wave 4 (claims)
        C4-01 ─┘         │
Wave 1  C5-11/C5-12 ──> C5-15 ──> C7-30 (execute)
        C1-05/C1-06/C1-07/C1-12/C5-19/C5-25
Wave 3  RELS-04 ──> RELS-03   C1-10   C1-09/RELS-05   C4-20   RELS-06/C7-34   RELS-01
```

Shortest path to "P0 closed": C4-04 (small) → C1-02 (map + drift gate) → C2-02 (atomic writes) → C4-01 (trust) and C4-02 (local-only). C5-15, C6-03, C6-09, C6-10, C7-30 are parallel tracks with their own owners.

Expected final declaration when all rows close (or are explicitly re-scoped by the release owner): **COVERT V1 RELEASE CLOSURE MATRIX CLOSED** — at which point the matrix becomes historical evidence, not a work board.
