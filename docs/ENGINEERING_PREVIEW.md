# Covert Coder — Engineering Preview Status

**Snapshot date:** 2026-09-29

Covert Coder is currently a **pre-release engineering preview**, not a production-certified consumer release.

This page exists to separate:

- what is implemented;
- what has fixture or CI evidence;
- what has real-machine or live-provider evidence;
- what is still being closed before a downloadable preview is promoted more broadly.

## Public baseline vs active convergence

The public baseline is:

`covert-production`

The active convergence branch is:

`nightshift/production-convergence-20260926`

At the time of this snapshot, the latest externally verified convergence checkpoint was:

`30ad8cc81341af00352d56102efdf63c40e5bcc2`

Its exact-SHA AIDE CI run `36588074664` completed successfully across all required workflow steps.

Always check the latest branch HEAD and CI before treating this snapshot as current.

## What is implemented today

| Surface | Status | Notes |
| --- | --- | --- |
| Browser workbench / Monaco editor | Implemented | Current typed frontend/workbench |
| Workspace / search / Git / tasks | Implemented | Routed through the canonical service layer |
| Governed terminal | Implemented | Privileged activity remains policy/authority bounded |
| TypeScript LSP / Python DAP | Implemented | Current typed route/service families |
| Execution Authority | Available | Mediates privileged execution/write decisions |
| Orchestrator | Available | Coordinates governed task/model/tool paths |
| Veritas / evidence tooling | Implemented | Verification does not itself grant authority |
| Local model/runtime support | Available / hardware-dependent | Requires compatible runtime/model artifacts |
| Resident Assistant | Experimental | Advisory/coordination foundation exists; end-to-end live orchestration is still being closed |
| Context Control | Partial | Canonical bounded composition exists; full cross-surface convergence remains open |
| Workflow Engine / Skill Intelligence | Experimental | Metadata/runtime pieces exist; release promotion remains gated |
| Ghost Code / provenance / replay | Partial | Claims remain limited to recorded evidence |
| Memory / Helix | Experimental | Scoped persistence exists; broader release acceptance remains open |
| Desktop packaging | Experimental | Historical builds do not certify the current Covert cockpit |

## What the active convergence work has recently proven

Recent accepted convergence work includes:

- provider/model identity separation;
- OpenCode bridge lifecycle handling;
- exact target checks;
- startup cancellation and timeout handling;
- session cleanup enforcement;
- delegated model identity mismatch failure;
- Authority-bound timeout/failure outcomes;
- durable Authority stream-finalization ordering;
- DAP disconnect race repair;
- exact-SHA CI evidence for those repairs.

These results are meaningful engineering evidence, but much of the provider work is still fixture-backed.

## What is not yet a public release claim

The following are **not yet claimed as release-certified**:

- live OpenCode Go mission through Covert;
- live second-model proof through the same OpenCode Go connection;
- full Resident → worker → verifier → receipt production journey;
- live Mission Receipt acceptance;
- restart/recovery on a real provider-backed mission;
- automatic qualification of arbitrary local GGUF models;
- clean-machine current Covert installer acceptance;
- upgrade/uninstall/state-preservation acceptance;
- production-ready Codex adapter;
- finished CLI/TUI distributions;
- mobile companion release.

## Model Access direction

Covert is converging toward one understandable model-selection experience.

### Connected sources

Examples:

- OpenCode Go
- qualified local models
- direct/BYOK providers where configured
- Codex, once its governed adapter is promoted from contract-only

### Model selection

A source may expose multiple models.

For example, OpenCode Go is treated as one connected source/account with a dynamically discovered model catalog.

The exact model selected for a mission remains explicit and must follow execution, evidence, and receipts.

## Local GGUF direction

Covert should discover approved local GGUF files, then:

1. hash them;
2. inspect metadata;
3. determine runtime compatibility;
4. qualify them with evidence;
5. expose only truthful readiness states.

A file being present on disk is not the same as being qualified.

## Engineering Preview test path

Experienced testers can evaluate the active convergence branch:

```bash
git fetch origin
git switch nightshift/production-convergence-20260926
npm ci
npm run doctor
npm start
```

Record the exact SHA you tested.

Do not post credentials, model weights, private source, auth artifacts, or private data in public issues.

## Downloadable preview gate

Before Covert is promoted as a normal downloadable Engineering Preview, the target journey is:

```text
install
→ first run
→ open project
→ connect/select model source
→ select exact model
→ Resident accepts a bounded task
→ governed execution
→ streamed status
→ verification
→ Mission Receipt
→ restart/recovery
→ uninstall/upgrade evidence
```

The project can be shown publicly before every one of those gates is closed, but screenshots and demos must keep the **Engineering Preview / pre-release** label until the corresponding release evidence exists.

## Reporting problems

Normal bugs and usability issues:

https://github.com/AnonymousNomad/covert-coder/issues

Security issues:

https://github.com/AnonymousNomad/covert-coder/security/advisories/new

When reporting a bug, include:

- OS;
- exact branch;
- exact commit SHA;
- command/action performed;
- non-sensitive logs;
- whether the behavior was fixture-backed, local-model, or connected-provider.
