# Known limitations — certified source release

This page is intentionally explicit. A green source-core certification does not
turn pending or post-candidate work into shipped behavior.

- **Permanent Resident:** qualification is still pending. Resident-dependent
  release gates must run after the accepted artifact is supplied.
- **Packaged desktop installer:** not certified. The source path and a desktop
  installer are separate release surfaces.
- **Capability Fabric v0.1:** post-candidate; the Capability Center UI does not
  imply that the backend Fabric runtime is shipped.
- **Delegation runtime:** post-candidate; the candidate does not ship the
  model-neutral delegation runtime.
- **Luna skills-loader change:** not included in the immutable candidate and
  remains separately reviewable.
- **Local models:** the source checkout does not bundle GGUF weights. A user
  needs a compatible local runtime and a verified model artifact for local chat.
- **Environment-dependent checks:** platform/tool-specific skips remain
  documented rather than being presented as universal passes.
- **External providers:** opt-in and consent-gated; they are not required for
  the local-first source core.
- **Kimi live proof:** blocked on the certification machine by entitlement, not
  silently promoted to a pass.
- **Tauri/glib:** tracked for the desktop packaging lane; this source-core
  record does not certify an installer.
- **Release artifacts:** the SBOM and checksums in the assembly set are bound to
  this SHA. They must be regenerated for any new source candidate.

See [the machine-readable limitation record](KNOWN-LIMITATIONS.json) and the
[claim matrix](RELEASE-CLAIM-MATRIX.md).
