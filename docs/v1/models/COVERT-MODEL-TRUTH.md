# Covert Model Truth — Slice A

Status: PARTIAL — one confirmed retired catalog entry removed; the three live UI identities remain unverified.

## Reported UI observation

The operator reports that three entries display DEPRECATED in the general model selection surface and in Chat model selection. Their visible names and IDs were not supplied. The former installed AIDE-era application was uninstalled and must not be treated as the current product. The active Desktop Control worktree is owned by another worker, so this lane did not launch or interact with it.

## Source mapping

At the provider lane starting revision, the tracked source contained one model display name with the word DEPRECATED: ID aide-cipher-v1, name Cipher v1, replacement note north-mini-code-1.0. No second or third deprecated model identity was found in the active model manifest or application TypeScript and JavaScript source.

The chat model selector obtains routes from the existing model route API and uses the route display name. ModelRuntime loads model names from models/manifest.json. ModelRouter projects those names into local routes. The route-based ModelLineup surface also renders route display names. Therefore the literal deprecated label was catalog text, not a lifecycle value produced by the UI.

The separate Model Manager uses the IntelligenceRegistry projection for availability and qualification. The operational ModelState contract contains ready, running, starting, stopped, pending, experimental, and error. The display projection contains AVAILABLE, STARTABLE, STARTING, RUNNING, READY, DEGRADED, STOPPED, and FAILED. Neither contract defines DEPRECATED.

## Confirmed entry

| Field | Finding |
|---|---|
| ID | aide-cipher-v1 |
| Provider | Local runtime, based on its loopback endpoint and local artifact URI |
| Manifest status | ready, a declaration only |
| Artifact | The manifest says REMOVED; the expected models/aide-house/base.q8_0.gguf file is absent in this checkout |
| Actual availability | UNAVAILABLE in this checkout |
| Qualification | UNKNOWN; the active runtime manifest is not qualification evidence |
| Lifecycle | Retired from the active catalog; not a DEPRECATED runtime status |
| Display root cause | The retired model name contained the DEPRECATED annotation and was still loaded as an active runtime candidate |

This entry was removed from the active models array. No successor route or default was assigned. Replacement identity, availability, and qualification remain separate facts and were not inferred from the replacement note.

## Verification

- PASS: tests/unit/test-model-manifest-truth.mjs — 1 test passed; the active model catalog contains no retired, removed, or deprecated model entry.
- PASS: models/manifest.json parses and the expected removed artifact is absent.
- PASS: git diff --check.
- BLOCKED: integration route test could not load because this isolated worktree has no node_modules and zod is absent. The repository lockfile is present. No project dependencies were installed.
- BLOCKED: targeted ESLint could not run because project ESLint dependencies are absent. npx selected ESLint 10.11.0 and reported the missing @typescript-eslint/parser; no repository files were installed or modified by that attempt.

## Remaining blocker

Slice A cannot close from source inspection alone. Two of the three operator-reported entries have no attributable names or IDs in the current source evidence, and the live current UI was not read. To finish the mapping, provide the three visible names/IDs or a screenshot of the current Covert model selection and Chat model selector after launching the accepted current build. No provider integration work should start until those entries have truthful availability, qualification, and lifecycle classifications.

## Checkpoint

- Worktree: E:\aide-universal-intelligence-v1
- Branch: feat/covert-universal-intelligence-v1
- Starting revision: d80d18445b475d2ae2f6987b16cbb047224b2c5e
- Desktop Control production source: not modified
- Desktop Control UI: not launched or interacted with
