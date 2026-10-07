# Cipher Laptop implementation — 2026-10-07 UTC

Working dossier: COVERT_PLATFORM_NIGHTSHIFT_2026-10-06(1).zip; SHA256 99b22b246c45aeba1238a5a5416bd2b255222cf872530e3043d959e41128bbaa. All 25 manifest entries verified and the full dossier read. Its proposed schemas are implementation guidance, not runtime evidence.

Reconciliation at 02:38:50 UTC: E:\covert-workstation-integration-saul-20261006 / feat/workstation-integration-saul-20261006 / 96cd159199ad7161c03fb86c2887d03c12e0eefc, three bounded commits after 14b9ad9, with only owned workstation evidence/checkpoint documents dirty before this foundation. Luna's 40 source hashes, HEAD and dirty status were unchanged; packaging remained clean at da320b96fc9ab2ec4da7d0c24150d24ce90d2c17. Current source supersedes the package's historical 14b9ad9 text. No source reset, stash, clean or foreign process termination occurred.

## Ledger owner slice

Production: common/contracts/cipher-laptop.ts and node/src/services/cipher-ledger.ts. Negative/focused proof: tests/arch/cipher-ledger.test.ts.

The owner requires an explicit storage root and Resident reference. Storage root is independent from window/project identity. The logical Cipher identity remains model/personality-independent; an Authority principal is a separate identity. Project IDs remain null when no canonical Project owner can supply one. No path/window/workbench ID is relabeled a Project ID.

The strict versioned contract adds action_id as the stable pre-effect correlation, distinct from per-record event_id and effect_generation. Records contain metadata and owner references, not prompts, credentials, command text or duplicate domain databases. Unknown fields and common secret-like reference values are refused. Private internal append does not expose model-controlled write authority.

Logical append uses the existing atomic JSON writer and single-owner mutation lock. Sequence, previous hash, deterministic canonical bytes, checkpoint count/root and marker identity are verified before append/read. Capacity is bounded at 10,000 records; capacity refusal requires explicit reconciliation/archival work, never silent history deletion. This initial snapshot persistence rewrites the bounded snapshot and lifecycle verification currently has quadratic worst-case cost; it needs measured indexing/segmentation before larger-volume activation.

Durable lockdown is separately recorded and hash-bound to the identity marker. Restart cannot clear it by removing only the lockdown file. Corrupt ledger bytes are preserved. Pending pre-effect history on restart becomes UNKNOWN_PENDING_RECONCILIATION; new prepares are held and no blind retry is permitted.

Results preserve semantic distinctions: prepare, Authority decision, attempt, observation and verifier references. An observation cannot label itself VERIFIED. Signature status is always SIGNATURE_UNAVAILABLE. A local unsigned/unwitnessed chain cannot prove resistance to a coordinated full rewrite/deletion of all local metadata. Atomic replacement is application-level crash safety, not guaranteed power-loss durability.

Sixteen focused tests passed after additional negative tests exposed three defects: manufactured verification, removed-lockdown recovery and deletion of both live owner history files. All three were repaired without weakening assertions. Initial node types also exposed strict optional-field incompatibility; the typed input contract repaired it without suppression.

This owner is not yet mounted or correlated into real Authority effects at this slice. No complete lockdown/containment, signing, credential gating, Laptop UI, notebook correction, Buddy policy, Pack installation, remote channel or whole-platform acceptance is claimed. The next slice wires the deterministic Authority boundary and live read projections, then proves negative execution/restart behavior. Existing H3 attempt/admission, provenance, memory, Authority, tasks and verifier owners are preserved and referenced.

## Production Authority adoption
The real server now owns one Laptop ledger and binds its required Authority recorder to it. Operator-only status/activity read routes project that same owner. Mutation prepare, decision and pre-effect attempt must be durable before the executor can enter. Required canonical audit receipts still apply. Record history is not exposed to delegated workers.

Critical integrity state calls the trusted root's revokePending control before attempting state persistence; operator reads and exact stop/revoke controls remain available. This is pending-permit containment only, not proof of killing existing processes, preventing every credential/network path, or packaged containment.

Observed invocation failure is FAILED, not a rollback or zero-effect assertion. Unknown/lost outcome persistence remains RECONCILING, with no blind replay. A test writes a real partial file before throwing to prove the distinction. Missing canonical audit receipt after a persisted Laptop observation also holds integrity.

Focused production regression: 100/100 pass on Windows, including real file effects, tamper detection/preserved bytes, pending-permit revocation, anonymous/worker denial, real Authority and AgentLoop regression, terminal session ownership, and presentation cleanup. Node/browser type checks and scoped lint pass. Generated OpenAPI and facade ownership include both read routes. Runtime browser/visual acceptance is recorded separately after execution.

## Shared operational seat and Operator Notebook
The operator addendum is adopted: workstation and Laptop are separate principal seats over one canonical platform, not duplicate implementations. ArchServer's trusted capabilityPort accepts an already-enrolled ActorHandle, validates registered non-stream contracts, and uses the same governedDispatch/operationInput and route handler as human HTTP. It offers prepare/invoke, not grants, delegation, approval, credentials or Authority control. Real Windows tests use the same file capability with distinct operator/service attribution and deny changed intent, forged/revoked principals and scope widening. This is a tested root seam, not a qualified live Resident model binding or universal adapter.

The root owns one Notebook beside the ledger. Operator-only GET/POST/remove routes use canonical Authority, exact route/body permits and durable lineage. Records preserve user-provided/observed/inferred provenance and confidence; operator approval is mandatory; unknown fields and common credential patterns are refused. These patterns are defensive rejection, not a complete secret detector. Inference never adds authority. SESSION records remain transient, DO_NOT_RETAIN is not a save request, stale revisions cannot overwrite corrections, returned records are detached, and removal writes content-free revision tombstones. Removal is logical, not forensic disk/backup erasure. Expiry hides records; automatic expiry deletion and approved model-context retrieval remain gated.

Capacity reserves up to 500 distinct active/historical identities before new content is accepted, so removal or RETAIN-to-SESSION correction cannot overflow the tombstone budget. Known identities can be explicitly recreated at their tombstone revision. No silent revision-history deletion. Segmented archival and larger-volume qualification remain open.

Fresh review reproduced three Important findings, all repaired: concurrent UNKNOWN hold crossing pre-effect admission, mutable/missing action lineage, and removable-record capacity. The serialized ledger rejects prepare/decision/attempt during a hold; UNKNOWN raises its persisted hold immediately; already-running work may still record an observation under RECONCILING. Principal/kind/origin/project/task/capability/target/digest remain bound to PREPARE. Invalid lineage locks deterministically; unimplemented reconciliation cannot clear it. Forty review/core tests and the final 133-test focused regression pass, with both compilers and scoped lint green. Full architecture and final browser receipts follow in the workstation checkpoint.

Ruling: no new principal, credential or context grant is minted merely to activate the Laptop. Current history/Notebook reads remain operator-only until genuine Resident/context qualification. The root port is enrolled-principal-only. Cost: live Resident memory/operation access is still gated, rather than silently widened.
Ruling: current durable storage is workspace-private and project_id stays null where the canonical Project owner is absent. Cost: installation-wide continuity and multi-project context isolation are not claimed; their owner/addressing adoption is still required.
Ruling: bounded personal record identities reserve removal history without silent compaction. Cost: after 500 distinct identities, new IDs require an explicit archival/reconciliation capability; existing IDs can still be corrected/recreated/removed.
