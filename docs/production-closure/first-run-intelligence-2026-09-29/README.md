# Covert First-Run Intelligence Bootstrap Pack

Version 1.0 — 2026-09-29

## Purpose

Add the missing product contract for first-run intelligence: optional model packs, hardware-aware recommendations, governed one-click download/import, provider/account connection, repository onboarding, user-context migration, workflow/skill setup, and a distinct Resident specialization path.

This pack is additive to the existing Covert production/release-closure directives. It does not replace accepted Model Manager, Runtime Broker, Context Control, Authority, onboarding, or release gates.

## Core product decision

The base installer should remain usable without large model weights. First run may offer explicit opt-in packs with clear size, license, source revision, hash, hardware fit, role fit and network implications. A separate offline/full bundle may contain redistributable weights only after license and supply-chain verification.

Personal user data is not fine-tuning data by default. Imported repositories, conversations, preferences and memories remain governed context/memory unless the user separately opts into an explicit training workflow.

## Included

- `FIRST_RUN_INTELLIGENCE_BOOTSTRAP_DIRECTIVE.md`
- `LUNA_HANDOFF.md`
- five focused skills under `skills/`
- `workflows/FIRST_RUN_INTELLIGENCE_WORKFLOW.md`
- `workflows/RESIDENT_SPECIALIZATION_WORKFLOW.md`
- `templates/FIRST_RUN_ACCEPTANCE_MATRIX.csv`
- `templates/MODEL_PACK_MANIFEST.schema.json`
- `templates/MIGRATION_PROVENANCE.schema.json`
- `research/CANDIDATE_MODEL_NOTES_2026-09-29.md`

## Installation

Place under the existing production-closure/reference area and reconcile against repository truth before importing skills. Reuse existing equivalents where adequate. Do not create duplicate model managers, credential stores, memory systems, onboarding stores, or authority paths.
