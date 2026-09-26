---
name: aide-onboarding-walkthrough
description: Covert V1 first-run configuration, provider discoverability, resumable setup, and canonical settings ownership.
---

# Covert V1 Setup and Onboarding

## Product contract

Onboarding explains and configures the same services used by the workbench. It is not a second provider registry, credential store, router, workspace owner, or permission engine. Persist wizard progress only in `.aide/onboarding-state.json`; write actual configuration through its canonical service.

The wizard stages are:

1. Welcome and what Covert does.
2. Hardware and local intelligence.
3. Existing provider connections and supported connection methods.
4. A workflow profile written through canonical role routing.
5. Security and workspace-trust explanation.
6. Workspace review and project navigation.
7. Truthful setup verification.
8. Finish and open the workbench.

Local models, account or subscription clients, OAuth, and API keys are distinct connection methods. Expose only methods that are implemented and verified. Detecting an executable or finding an auth file does not prove that a client is authenticated or executable. Do not claim a sign-in completed unless the official client reports it through a verified status path.

## Canonical ownership

| Setup concern | Owner |
|---|---|
| Wizard progress, completion, deferral | `node/src/services/onboarding.mjs` |
| Provider status and connection metadata | Existing Provider Connections / Provider services |
| Provider credentials | Existing encrypted credential service |
| Role routing | Existing BYOK role-routing service |
| Local model installation and qualification | Model Manager and Runtime services |
| Hardware facts | Hardware Profile service |
| Workspace selection | Projects / Workspace services |
| Execution permissions and trust | Authority / Security owners |

Do not store API keys, provider connection state, role routing, permissions, or workspace configuration in onboarding state or browser persistent storage.

## Provider truth and safety

- `CONFIGURED` means Covert has a credential reference; it does not mean the provider is reachable.
- `CONNECTED` requires an explicit successful live verification.
- Installed Codex, Claude, or OpenCode binaries are not proof of authentication.
- Never parse another application's auth store, copy its tokens, capture passwords, or imply Covert owns a credential held by an official client.
- Never silently switch billing sources. External role routing requires explicit provider consent and an explicit successful test in the setup session.
- Global Local-Only remains an independent release gate. Do not present a local route choice as proof that all network egress is blocked.
- Provider tests happen only after an explicit user action and report each provider result separately.

## Progress behavior

- First launch opens setup when it is incomplete and not deferred.
- `Skip for now` persists a `deferred` progress flag without completing or erasing the wizard. Covert remains usable.
- Settings → Setup & Onboarding can resume deferred or incomplete setup.
- `Continue Setup` keeps the saved step. `Start Over` resets wizard progress only and preserves current application configuration.
- Exiting partway preserves already completed step progress. The next launch resumes unless the user chose `Skip for now`.
- Rerunning completed setup reads current configuration and begins a fresh wizard review without resetting provider, model, route, workspace, theme, or permission state.
- The product tour is separate from setup and must not mark setup complete.

## Provider discoverability

All entry points converge on Settings → Intelligence → Providers:

- Settings navigation.
- Model Manager’s Provider Connections action.
- Chat’s Connect or manage providers action.
- The onboarding Providers step.

Use the existing provider and BYOK panels. Do not implement login independently in Chat or onboarding. Be explicit when official-client login/execution or OAuth is not yet integrated.

## Verification

Run the focused onboarding and provider route tests, including:

- all eight progress steps and skip behavior;
- deferred first-run, resume, and restart without configuration reset;
- legacy progress migration;
- approval binding, stale-transition rejection, replay rejection, and serialization;
- no `.aide/setup-session.json` or onboarding-owned configuration;
- truthful configured versus connected provider states;
- Provider Connections links from Settings, Model Manager, Chat, and onboarding;
- Settings rerun entry and product-tour separation;
- TypeScript, lint, frontend tests, contract generation, and production frontend build.

Do not claim provider-specific account login, OAuth, model discovery, billing, or execution support unless that path is separately implemented and qualified.
