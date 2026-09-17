---
name: failure-desktop-generated-staging-authority
description: Diagnose desktop packaging paths where an ignored staged artifact exists locally but has no tracked source or generator. Use when desktop/resources or desktop/frontend passes locally yet cannot be reproduced from a clean checkout.
---

# Desktop Generated Staging Authority

## Trigger

Load this skill when a desktop runtime or test references a file beneath an ignored staging tree such as `desktop/resources/` or `desktop/frontend/`, but the corresponding tracked source cannot be found.

## Procedure

1. Stop before editing or copying the local staged artifact back into source.
2. Confirm whether the artifact is tracked and whether Git ignores it:
   - `git ls-files -- <path>`
   - `git check-ignore -v <path>`
3. Search tracked files for the artifact name and for code that generates or copies it.
4. Read the staging script completely. Do not infer generation from a passing local staged tree.
5. Treat an ignored artifact without a tracked source or deterministic generator as stale local state, not repository evidence.
6. Establish one tracked authority, then make the staging process recreate the ignored copy from that authority.
7. Add a clean-room regression that begins without the staged tree and proves preparation creates the required artifact.
8. Verify both source and staged hashes or bytes where exact parity matters.

## Failure-Closed Rules

- Never package an ignored local artifact whose provenance cannot be reproduced.
- Never claim desktop preparation passes from a pre-existing staged tree alone.
- Never weaken a missing-artifact gate into a success claim. A platform skip must say why and must not claim packaging acceptance.
- Do not edit the ignored staged copy as the durable fix.

## Evidence

Record the tracked source, generator/copy step, clean staging command, staged path, parity check, and test result.
