---
name: covert-clean-room-release-acceptance
description: Verify Covert from packaged artifact on a genuinely clean user environment, including install, first run, onboarding, project work, restart, upgrade, recovery, and uninstall/data policy.
---

# Covert clean-room release acceptance

## Objective

Prove that a user who does not have the developer repository, local caches, hidden environment configuration, or prior Covert state can install and use the declared release scope.

Developer-machine success is not clean-room acceptance.

## Clean environment requirements

Record why the environment is clean. It must not depend on the source checkout, developer-only PATH entries, existing node_modules/build trees, private test fixtures, personal model registry state, hidden credentials, or previous application data unless a migration test explicitly requires them.

Use a disposable VM, clean Windows account/image, or equivalent isolated environment that matches declared support.

## Core journey

`artifact -> install -> first boot -> onboarding -> privacy choice -> provider/local-model setup -> create/open project -> Resident mission -> governed terminal/build action -> persistence -> restart -> recover exact state -> upgrade -> recovery path -> uninstall/data policy`

Every step must use the packaged runtime.

## Required variants

- path with spaces and normal non-ASCII user/path content where supported;
- no network/offline startup;
- no credentials configured;
- invalid/revoked credential reference;
- unavailable provider/model;
- interrupted/cancelled operation;
- application crash or forced restart during a recoverable state;
- upgrade from the supported previous version/candidate when applicable;
- interrupted update/upgrade if the updater supports recovery;
- uninstall preserving user data according to policy;
- explicit full-data removal path if supported;
- reinstall after uninstall;
- missing optional dependency and missing local model;
- low-resource condition that should fail admission rather than destabilize the app.

## Packaging evidence

Record source SHA, dependency lock fingerprint, build command/environment, artifact names, SHA-256 hashes, signature/provenance state if implemented, install location, application version/build identity, and exact test environment.

The packaged application must be able to report enough identity to link the running binary to the release record.

## Acceptance rules

- A source-level E2E is not packaged E2E.
- An installer that launches once is not enough.
- Upgrade success without migration/recovery evidence is incomplete.
- Uninstall behavior must match documented data-retention claims.
- Any manual prerequisite required from the developer machine must either become part of installation/onboarding or be documented as a supported prerequisite and tested from clean state.

Close G6/G7 only for the exact platforms and journeys proven.
