# Covert V1 Release Matrix Addendum 001

**Date:** 2026-09-25  
**Frozen baseline:** `3e42aad8a8741beae81f40906988b361929942ab`  
**Scope:** Mapping only. No subsystem implementation and no installed-application inspection or modification.

## Freeze rule

The 176-row release matrix is unchanged. This addendum records two material gaps that became explicit after the baseline froze. It does not silently amend the baseline counts or rewrite its history. The earlier `RELS-10` upstream-ownership note is superseded by post-freeze evidence here: `audit/v1-release-closure-matrix` was pushed and verified at `0/0` ahead/behind on 2026-09-25.

## ADD-001 — A. Multi-model workflow synchronization

**Result: MATERIAL GAP — PARTIAL, P1, V1-required, release blocking for the multi-model workflow.**

The matrix already contains adjacent coverage in rows `C1-11`, `C1-12`, `C1-13`, `C1-14`, `C3-15`, `C3-16`, `C3-18`, `C3-19`, `C3-21`, `C5-23`, `C7-13`, `C7-15`, `C7-16`, `C7-30`, `RELS-03`, and `RELS-04`. These cover production-loop wiring, verification, provenance, request/attempt identity, handoffs, workflow continuity, correlation, mission execution, and long-horizon regressions.

They do not explicitly require the full sequence `Resident → mission creation → planner → coder → deterministic verification → reviewer → bounded repair → reverification → acceptance → Resident reporting`. In particular, there is no explicit matrix row for a mission DAG, canonical role-transition owner, immutable candidate identity, stale-review invalidation after repair, parallel-worker synchronization, bounded repair state, interruption/reassignment, per-transition Resource Admission and Authority checks, human approval boundary, or Resident completion ownership.

**Required design invariant:** models propose state; the Orchestrator/Workflow Engine owns state transitions. A planner cannot authoritatively launch the coder; a coder cannot declare mission completion; a reviewer must bind approval to an immutable candidate identity. Candidate change invalidates review. Terminal completion requires accepted verification and no unresolved required obligation.

**Closure evidence required:** typed DAG and transition contract; bound mission/attempt/role/predecessor/candidate identities and policy receipts; deterministic tests for each transition, parallel barriers, stale review, bounded repair/reverification, interruption/reassignment, Authority denial, Resource Admission denial, human approval, and false completion. Resident reports canonical accepted state only.

**Owner:** CORE / WORKFLOW-ORCHESTRATOR.  
**Dependency:** `C1-11`, `C1-12`, `C1-14`, `C3-15`, `C3-16`, `C5-23`, `C7-30`, `RELS-03`, `RELS-04`.  
**Not part of Wave 0A implementation.**

## ADD-002 — B. Existing installed legacy Covert application

**Result: MATERIAL GAP — PARTIAL, P1, V1-required, release blocking before replacement or in-place lifecycle operations.**

Existing rows `C6-07`, `C6-08`, `C6-11`, and `C6-12` cover platform installers, generic Windows lifecycle, future update/rollback/repair, and clean-machine installation. `C2-03`, `C2-04`, and `C2-05` cover generic persisted-store versioning, migration, and corruption handling. None requires reconciliation of the operator's reported pre-existing Covert installation or identifies the state it owns.

Before any action against that installation, closure requires a read-only inventory of product/package identity, executable and version/build, install path, uninstall registration, shortcuts, AppData/state/databases/configuration, credential presence and owner (never credential values), ports, background processes/services, shared mutable paths, and install/upgrade behavior. Then document backup, side-by-side versus replacement, migration, rollback, uninstall, and reinstall ownership, and validate the path on a copy or isolated fixture.

**Priority:** P1. There is no evidence in this mapping check that the old install shares dangerous mutable state, so this is not escalated to P0.  
**Release gate:** blocks an operation that would replace, upgrade, uninstall, or reinstall the reported instance until the inventory and recovery plan are verified.  
**Owner:** DISTRIBUTION / RELEASE.  
**No installation action is authorized here.** The application was not inventoried, opened, modified, upgraded, or removed.

## Machine-readable rows

The exact row fields, statuses, priorities, owners, dependencies, gaps, and acceptance conditions are in `COVERT-V1-RELEASE-MATRIX-ADDENDUM-001.json`. The addendum reserves Dogfood evidence fields; no Dogfood result is inferred.

## Wave 0A boundary

This addendum is audit metadata only. Wave 0A remains limited to `C4-04 → C4-02`. It does not implement multi-model workflow synchronization, inspect or touch the legacy installed application, or alter the frozen matrix.
