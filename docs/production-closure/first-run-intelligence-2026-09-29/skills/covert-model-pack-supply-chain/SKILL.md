---
name: covert-model-pack-supply-chain
description: Secure Covert model downloads and offline bundles with immutable identity, licensing, hash verification, resumable acquisition, atomic installation and release traceability.
---

# Covert model-pack supply chain

1. Manifest binds model ID → upstream repo → immutable revision → exact file → license/notices → SHA-256 → size → runtime/profile → Covert evaluation revision.
2. Never trust filename or mutable `main` as release identity.
3. Download to `.partial`; cancellation leaves no READY registration.
4. Verify expected length and SHA-256 before parsing/loading.
5. Validate model metadata and chat template; fail closed on unexpected identity.
6. Atomic rename/promotion into the managed model directory.
7. Store provenance separately from secrets and user data.
8. Offline/full bundle manifest must be signed or otherwise integrity-bound to the application release and include required license/notice material.
9. Update/removal preserves projects and role configuration as an unavailable exact target until the user explicitly chooses a replacement.
10. Test corrupted/truncated file, disk-full, interrupted download, changed upstream artifact, hash mismatch, duplicate identity, path traversal and rollback.
