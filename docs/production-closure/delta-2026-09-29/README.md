# Covert Release Closure Delta Pack

Version 1.0 — 2026-09-29 America/Chicago

## Purpose

This is a narrow additive pack for the final production-closure phase of Covert Coder. It does **not** replace the existing production execution bundle, standing directive, project instructions, Context Control skill, runtime verification skill, or G0-G9 release gates.

Use this pack only where the existing bundle leaves ambiguity around the remaining release-risk surfaces: exact model selection integrity, live provider qualification, clean-room packaged acceptance, cumulative Windows stability, and final release-candidate freeze/evidence.

## Operating rule

> From this point forward, optimize for elimination of release uncertainty, not feature count. Every new abstraction, feature, dependency, workflow, skill, UI surface, or refactor creates qualification debt and therefore requires a demonstrated release-blocking reason. Prefer closing existing `UNKNOWN`, `PARTIAL`, `BLOCKED`, or `UNVERIFIED` states over creating new capability.

## Installation

1. Keep the existing `docs/production-closure/` bundle authoritative.
2. Place this delta under a non-conflicting path such as `docs/production-closure/delta-2026-09-29/`.
3. Search the live skill registry for equivalent procedures before registering any skill here. Reuse or merge when adequate; do not create duplicates merely because files are present.
4. If imported, preserve the existing Authority, Admission, Model Manager, Context Control, persistence, and release-gate boundaries.
5. Use `LUNA_HANDOFF.md` only as a starting packet. Refresh repository/machine truth before mutation.

## Contents

- `RELEASE_CLOSURE_DELTA_DIRECTIVE.md` — controlling scope and anti-drift rule.
- `skills/model-selection-integrity/SKILL.md` — exact target identity and fallback discipline.
- `skills/live-provider-qualification/SKILL.md` — end-to-end provider/model qualification sequence.
- `skills/clean-room-release-acceptance/SKILL.md` — packaged clean-user acceptance.
- `skills/windows-cumulative-stability/SKILL.md` — cumulative-suite/resource-pressure diagnosis.
- `skills/rc-freeze-release-receipt/SKILL.md` — immutable RC candidate and release receipt.
- `templates/RELEASE_CLAIM_TRACEABILITY_MATRIX.csv` — requirement-to-evidence linkage.
- `workflows/FINAL_RELEASE_CONVERGENCE.md` — dependency-ordered final closure workflow.
- `LUNA_HANDOFF.md` — concise handoff for the current convergence lane.
- `MANIFEST.sha256` — integrity manifest for this delta pack.

## Non-goals

This pack does not add competitor research, new feature scope, architecture redesign, theme work, model/provider claims, or release authority. It does not convert fixture evidence into live evidence or developer-machine evidence into packaged clean-room evidence.
