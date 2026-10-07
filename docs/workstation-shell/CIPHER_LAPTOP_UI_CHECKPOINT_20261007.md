# Covert — project-addressed Cipher Laptop / platform UI convergence
2026-10-07. Bounded production slice; not release or visual acceptance.

Sol now owns final platform UI/workstation presentation under the operator's morning directive. Historical Luna presentation-owner statements remain historical and are superseded for current assignments.

Production code checkpoint: `c5db51a97bd2dc11b39ad18ebd387e0a9992791c`. This commit changes eight source/test files (269 insertions, 49 deletions). Evidence publication follows in a separate bounded commit.

## Production change
Cipher's Laptop remains the existing internal application. Its real Notebook, Activity and Integrity projections now resolve canonical ProjectRegistry/ProjectSeat identity rather than inferring scope from windows or paths. The desktop receives a compact left application rail and separately captioned bottom tasks; the existing editor and independently owned terminal panels remain mounted.

The canonical current-project read supplies immutable Project ID and checkout ID. Laptop reads check the binding before and after payload retrieval. Activity requests address the owner by Project ID and displayed rows must also match the exact checkout. Foreign/legacy rows are withheld, never rewritten. An unknown or changed binding withholds Notebook and project history while Integrity stays inspectable. Notebook remains the configured storage-root owner; its records are not falsely described as project-granted or installation-wide.

Notebook writes require fresh owner receipts, a normal ledger projection and a new canonical binding check. Authority still decides the effect. Failure of that last lookup now clears the Notebook projection and mutation controls until refresh.

## Source reconciliation
Starting own source: E:\covert-workstation-integration-saul-20261006, branch feat/workstation-integration-saul-20261006, HEAD 810b0025ac583a4e50174ce1631e556a366e38b2, clean; 13 commits ahead / 0 behind 14b9ad9; tracked upstream origin/feat/workstation-integration-saul-20261006, 13 ahead / 0 behind the existing local remote-tracking ref (not freshly fetched).

Foreign source: E:\covert-sovereign-workstation-shell, branch feat/covert-sovereign-workstation-shell, HEAD 12b999d329b59fd7dd480504ce84670b0de521f5; no upstream. Initial 43 modified / 14 individually enumerated untracked changed during live work to 42 modified / 23 untracked at 14:33:32 UTC. Current observed source wins. No foreign file was reset, cleaned, stashed, staged, committed or overwritten.

Other lanes: convergence 7f79be9f09afa43283d3548b3b2fd0c98a6dbca7 (one unrelated untracked directive preserved); packaging da320b96fc9ab2ec4da7d0c24150d24ce90d2c17 (clean). No merge or push performed.

| Luna work | Disposition | Action |
|---|---|---|
| Real terminal ownership, expectedOwner reattachment, bounded replay, readiness | KEEP / INTEGRATE | Preserve; future coordinated owner integration, not a replacement terminal |
| ASK / PLAN / ACT, governed AgentLoop | KEEP | Preserve existing real behavior |
| Startup readiness, IPC/origin and safe facade reads | KEEP / INTEGRATE | Keep security semantics; merge source before regenerated route artifacts |
| Setup validation distinguishing backend truth from optional stopped models; canonical nullable workflow response | KEEP / ADAPT | Useful owner-contract fixes; newer regression evidence remains lane-specific |
| AppsInventory capability metadata | ADAPT / INTEGRATE | Reuse useful inventory through internal utility surfaces |
| MyCovert home gate / modern inventory-card composition | SUPERSEDE PRESENTATION | Accepted concept makes the developer desktop primary; no foreign deletion |
| Generated OpenAPI/facade ownership files | ADAPT / INTEGRATE | Regenerate from reconciled descriptors; no blanket JSON overwrite |
| New demo/setup/pairing failure evidence and screenshots | UNRELATED / PRESERVE | Read-only inspected; not proof of this code or full acceptance |

Luna's new root-cause note reports a 4/5 browser suite with an isolated one-use pairing-proof fix not yet rerun. None of those results is claimed here. A source capture incorrectly used HEAD as a for-each-ref pattern: its upstream fields are not evidence; separately recheck the branch ref.

## Exact production files
- browser/src/panels/cipher-laptop.ts — real owners, canonical binding, receipt aging, gated sections and write hold.
- browser/src/services/api.ts — validated GET /api/projects/current and optional project-addressed Activity query.
- common/contracts/project.ts — response type alias only; no schema or route change.
- browser/src/cockpit/CockpitShell.ts — left launcher mount and independent desktop canvas.
- browser/src/desktop/window-manager-view.ts — optional launcher host, application labels and distinct instance task captions.
- browser/src/desktop/desktop.css — compact square rail/taskbar and Laptop records-desk layout using existing tokens.

Tests: tests/unit/test-cipher-laptop-panel.test.mjs; new tests/unit/test-desktop-launcher-view.test.mjs.

## Real owners and gates
| Surface | Owner / route | Proven behavior / gate |
|---|---|---|
| Project binding | ProjectRegistry + ProjectSeat / GET /api/projects/current | Real UUID pair; BOUND_CONFIGURED_CHECKOUT; switching GATED_OWNER_REBIND_REQUIRED |
| Activity | Durable Cipher ledger / GET /api/cipher/laptop/activity | Actual chronology; exact project + checkout filter; OBSERVED distinct from VERIFIED |
| Notebook | Governed operator Notebook / GET/POST /api/cipher/laptop/notebook and POST /remove | Explicit retention/provenance/corrections/logical removal; no credentials or automatic capture |
| Integrity | Ledger integrity + deterministic Authority control | Real state, unsigned chain reported SIGNATURE_UNAVAILABLE; unresolved actions are not an approval queue |
| Missions / Inbox / Watches | Respective owner projections absent | GATED |
| Security | Cross-owner Laptop control projection absent | GATED; Integrity is available separately |
| Comms | No activated remote channel | NOT CONFIGURED |
| Evidence | Dedicated verifier projection absent | GATED; real references may exist in ledger, no manufactured results |
| Permissions | Enrollment/context/grant projection absent | GATED |
| Existing editor / terminals | Existing editor + terminal service | No mock replacement, launcher/task operations remain presentation |
| Resources | Existing observed resource utility | No new readings or decorative telemetry |

## Verification and defect repair
| Receipt | Result | Scope |
|---|---|---|
| laptop-project-red.log | RED | Original panel lacked canonical project/gated behavior |
| laptop-project-first.log | 11/13 | Initial async/read and nav fixture expectations corrected to legitimate new contract |
| laptop-project-green.log | 15/15 | Project-scoped panel fixtures before independent review |
| laptop-review-red.log | 15/16, 1 genuine failure | Submit-time binding rejection left Notebook content/controls available |
| launcher-red.log | 1/3, 2 genuine expected failures | Original dock lacked separate host and terminal captions |
| ui-project-launcher-green.log | 19/19, 931.0839 ms | Actual panel/view transpiled into controlled DOM fixtures |
| workstation-regression.log | 29/29, 30143.9644 ms | Existing window manager, terminal binding/replay/isolation/output, voice/theme regression |
| project-laptop-owner-regression.log | 23/23, 175649.699 ms | Real Windows ArchServer/Authority routes, project isolation, Notebook provenance, restart/tamper hold |
| Scoped ESLint debug rerun | PASS, exit 0 | Five changed TypeScript files and both changed test files; unchanged rules |
| git diff --check | PASS | Whitespace only |

Total final focused/regression tests: 71 passed; no skips/cancellations. These do not establish full browser typing or screenshot acceptance.

Independent existing reviewer inspected Laptop/API/project type changes, found the failed-write-check defect, then accepted the repair for the tested scope. No remaining actionable finding in that reviewed scope. Desktop composition was self-reviewed and tested; live visual review is still required.

Original scoped lint produced no diagnostic after extended delay and was stopped only after revalidating the exact owned Node process, parent and command; lint-stall-owner.json records that check. No foreign process was terminated. The debug rerun completed with LINT_EXIT 0 in 290.37 seconds using unchanged configuration and rules. It showed slow configuration/rule loading followed by successful parsing of every scoped file; the underlying storage/system cause is not established.

## Visual contract and actual proof
Source retains black/phosphor-green tokens, terminal fonts and rectangular chrome. Changes move application launch controls to the left and window tasks to the bottom, retaining movable overlapping windows and real panel mounts. The Laptop has a compact internal records desk. No new avatar/art, gradients, decorative gauges or mock approvals.

This is a source-level comparison with the accepted composition. No new runtime screenshot was captured. The accepted generated concept is a reference, not runtime evidence. Luna's screenshots are of her lane and not this changed source. Exact visual fidelity, density, overflow/focus behavior and runtime resource cost remain UNVERIFIED until a permitted actual browser run.

## Resource discipline
Heavy gate: available physical >=3072 MiB AND free commit >5120 MiB. Free commit measured from CIM CommitLimit minus CommittedBytes, not FreeVirtualMemory.

| UTC | Physical MiB | Free commit MiB |
|---|---:|---:|
| 14:26:16 | 3827 | 3122 |
| 14:31:20 | 3444 | 2426 |
| 14:33:32 | 3786 | 2032 |
| 14:43:58 | 3422 | 2792 |
| 14:50:09 | 2865 | 1911 |

Focused Node runs use max-old-space-size=256 and serialized test files. HTTP fixtures use C: TEMP/TMP, AIDE_CLOSED_LOOP=0 and isolated C: self-improve root. Full Node/browser compilers, build/browser/model/full-suite/package checks remain resource-gated; no floor was lowered. Test durations above are test measurements, not UI performance measurements.

## Security / integration closure
Repaired: stale project payload display across binding changes; mutation hold after last owner lookup failure; ambiguous unresolved-action label. Negatives prove foreign project/checkout filtering, no mutation after rebind/failure, unavailable owner withholding, owner-only history, permit rejection and restart/tamper behavior in covered routes.

Not claimed: global containment, live Resident enrollment/context leases, installation-wide Notebook migration, project switching, terminal/task/evidence/context/model owner reassociation beyond existing covered boundaries, arbitrary third-party execution, witness signatures, remote authority or continuous voice/vision.

Global gates remain: full Node/browser types, broader regression, paired Windows browser visual/behavior proof, merged Luna source/generated-contract drift, packaged security acceptance, clean-user/clean-machine, CI and one tested RC SHA.

## Next executable closure
When both resource floors permit, serialize Node/browser types, build and paired actual Laptop/desktop browser journeys; capture screenshots and repair visual drift against the accepted concept. Continue canonical terminal/project association and Resident context leases only through owner-enforced addressing. Reconcile useful Luna setup/terminal/facade changes before convergence; do not adopt her generated files independently of source.
