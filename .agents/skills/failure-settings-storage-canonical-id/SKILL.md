---
name: failure-settings-storage-canonical-id
description: Validate persisted operator preferences using their canonical setting IDs rather than internal field aliases.
---

# Preference storage assertions

The preference store may map canonical setting IDs (for example `layout.density`) to shorter in-memory fields (for example `density`). Its serialized JSON uses the canonical IDs.

When asserting persistence, inspect the serializer or persisted object contract first. Assert through the canonical ID, and separately verify that scoped changes do not appear in another scope.

Unknown setting IDs may be preserved without adding a recovery issue or changing the loaded status. Assert their preservation and non-application independently; expect a recovery banner only when the store records a recovery issue.
