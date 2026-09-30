---
name: covert-rc-freeze-release-receipt
description: Freeze one exact release-candidate source identity, bind packaged artifacts and acceptance evidence to it, and produce the final release receipt without carrying stale evidence across source changes.
---

# Covert RC freeze and release receipt

## Objective

Create one auditable candidate in which source, generated files, dependency lock, packaged artifacts, test evidence, documentation, known limitations, and release authority all refer to the same release identity.

## Candidate creation

Before declaring an RC candidate:

1. worktree is clean or every intentional generated input is committed according to project policy;
2. branch/HEAD and remote parity are recorded;
3. generated artifacts reproduce/check cleanly;
4. dependency lock and build toolchain are recorded;
5. required source-level gates for the candidate pass;
6. unresolved defects are classified and none violates release policy;
7. release scope/support matrix is explicit.

## Freeze law

Once candidate SHA `C` is selected, treat it as immutable for acceptance.

- Documentation-only changes can still invalidate release evidence when they alter support claims, instructions, generated outputs, packaging inputs, or user-visible behavior.
- Any material source/config/dependency/build change creates candidate `C+1`.
- Reuse unaffected historical evidence only when the dependency relationship is explicit and the release procedure permits it; otherwise rerun the affected gate.

## Artifact binding

For every distributable artifact record:

- candidate source SHA;
- build environment/tool versions;
- dependency lock fingerprint;
- artifact filename/version/platform;
- SHA-256;
- signing/provenance state if implemented;
- build timestamp/timezone;
- packaging command or workflow/run identity;
- clean-room acceptance evidence reference.

## Final release receipt

The release record must answer:

1. What exact source shipped?
2. What exact artifacts were produced from it?
3. Which OS/platforms were actually tested?
4. Which providers/models/capabilities were actually tested live?
5. Which local models/artifacts were actually qualified?
6. Which whole-product packaged journeys passed?
7. What failed during qualification and how was it repaired?
8. What remains `UNKNOWN`, `BLOCKED`, `PARTIAL`, intentionally unsupported, or deferred?
9. Which evidence proves each release claim?
10. Who authorized the release and what action was authorized?

## Decision

Use the existing G0-G9 aggregation rules. Do not release if an applicable mandatory gate is not PASS unless the owner explicitly changes accepted release scope and the record preserves that decision.

A prepared artifact is not a published release. Tagging, publishing, public announcement, and remote distribution require the applicable recorded authority.
