# Cipher Laptop implementation — 2026-10-07 UTC

Working dossier: COVERT_PLATFORM_NIGHTSHIFT_2026-10-06(1).zip; SHA256 99b22b246c45aeba1238a5a5416bd2b255222cf872530e3043d959e41128bbaa. All 25 manifest entries verified and the full dossier read. Its proposed schemas are implementation guidance, not runtime evidence.

Reconciliation at 02:38:50 UTC: E:\covert-workstation-integration-saul-20261006 / feat/workstation-integration-saul-20261006 / 96cd159199ad7161c03fb86c2887d03c12e0eefc, three bounded commits after 14b9ad9, with only owned workstation evidence/checkpoint documents dirty before this foundation. Luna's 40 source hashes, HEAD and dirty status were unchanged; packaging remained clean at da320b96fc9ab2ec4da7d0c24150d24ce90d2c17. Current source supersedes the package's historical 14b9ad9 text. No source reset, stash, clean or foreign process termination occurred.

## Ledger owner slice

Production: common/contracts/cipher-laptop.ts and node/src/services/cipher-ledger.ts. Negative/focused proof: tests/arch/cipher-ledger.test.ts.

The owner requires an explicit storage root and Resident reference. Storage root is independent from window/project identity. The logical Cipher identity remains model/personality-independent; an Authority principal is a separate identity. Project IDs remain null when no canonical Project owner can supply one. No path/window/workbench ID is relabeled a Project ID.

The strict versioned contract adds action_id as the stable pre-effect correlation, distinct from per-record event_id and effect_generation. Records contain metadata and owner references, not prompts, credentials, command text or duplicate domain databases. Unknown fields and common secret-like reference values are refused. Private internal append does not expose model-controlled write authority.

Logical append uses the existing atomic JSON writer and single-owner mutation lock. Sequence, previous hash, deterministic canonical bytes, checkpoint count/root and marker identity are verified before append/read. Capacity is bounded at 10,000 records; capacity refusal requires explicit reconciliation/archival work, never silent history deletion. This initial snapshot persistence has linear write/verify cost and needs measured segmentation before unbounded history.

Durable lockdown is separately recorded and hash-bound to the identity marker. Restart cannot clear it by removing only the lockdown file. Corrupt ledger bytes are preserved. Pending pre-effect history on restart becomes UNKNOWN_PENDING_RECONCILIATION; new prepares are held and no blind retry is permitted.

Results preserve semantic distinctions: prepare, Authority decision, attempt, observation and verifier references. An observation cannot label itself VERIFIED. Signature status is always SIGNATURE_UNAVAILABLE. A local unsigned/unwitnessed chain cannot prove resistance to a coordinated full rewrite/deletion of all local metadata. Atomic replacement is application-level crash safety, not guaranteed power-loss durability.

Sixteen focused tests passed after additional negative tests exposed three defects: manufactured verification, removed-lockdown recovery and deletion of both live owner history files. All three were repaired without weakening assertions. Initial node types also exposed strict optional-field incompatibility; the typed input contract repaired it without suppression.

This owner is not yet mounted or correlated into real Authority effects at this slice. No complete lockdown/containment, signing, credential gating, Laptop UI, notebook correction, Buddy policy, Pack installation, remote channel or whole-platform acceptance is claimed. The next slice wires the deterministic Authority boundary and live read projections, then proves negative execution/restart behavior. Existing H3 attempt/admission, provenance, memory, Authority, tasks and verifier owners are preserved and referenced.
