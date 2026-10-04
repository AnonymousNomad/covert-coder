# Covert Coder — Engineering Preview Status

**Snapshot date:** 2026-10-03

Covert Coder is currently an **Engineering Preview entering controlled beta recruitment**. It is not yet a production-certified consumer release.

This page separates:

- source presence;
- deterministic test evidence;
- exact-SHA CI evidence;
- hardware/runtime qualification;
- clean-environment portability evidence;
- live local or provider execution evidence;
- remaining beta-entry and release gates.

## Public baseline vs active convergence

The public baseline is:

`covert-production`

The active convergence branch is:

`nightshift/production-convergence-20260926`

The latest verified convergence checkpoint at this snapshot is:

`7391b98e1e0972dd3fe4365420fe15366b77b24c`

Exact-SHA AIDE CI run:

`37160203378` — **SUCCESS**

That checkpoint is a documentation/evidence-only child of the preceding green code checkpoint `690c29dd930c1e1d62b1c4f92dac5ef0ed096854`.

The preceding code checkpoint recorded:

- architecture: **983 total / 972 pass / 0 fail / 11 skip**;
- Veritas: **6/6**;
- Resident ownership UI fixture: **21/21**;
- focused Git/hook environment regression: **14/14**.

Always verify the latest branch HEAD and CI before treating this snapshot as current.

## Current product surfaces

| Surface | Status | Current boundary |
| --- | --- | --- |
| Browser workbench / Monaco editor | Implemented | Current typed frontend/workbench |
| Workspace / search / Git / tasks | Implemented | Routed through canonical service layers |
| Governed terminal | Implemented on qualified paths | Platform-specific provider/facade gaps remain under qualification |
| TypeScript LSP / Python DAP | Implemented | Current typed route/service families |
| Execution Authority | Available | Mediates privileged execution/write decisions |
| Orchestrator | Available | Coordinates governed task/model/tool paths |
| Veritas / evidence tooling | Implemented | Verification does not grant execution permission |
| Runtime Broker | Available | Abstracts local runtime ownership from product workflow |
| Unsloth local runtime | Qualified for frozen V1 profile | Exact Windows/Vulkan/GTX 1060/Liquid profile only |
| Model Hub / GGUF import | Available daemon-side | First-run recommendation-to-acquisition convergence still open |
| Resident Assistant | Experimental / active convergence | One Resident surface; clean first-run model binding still open |
| Planner/Coder/Reviewer roles | Available in current routing contracts | Final first-user role assignment journey still being closed |
| Context Control | Partial | Bounded composition exists; full cross-surface convergence remains open |
| Workflow Engine / Skill Intelligence | Experimental | Metadata/runtime pieces exist; release promotion remains governed |
| BYOK/provider access | Partial / opt-in | Provider-specific live qualification remains incomplete |
| Subscription-backed adapters | Partial / under qualification | Official client/auth boundaries only; no token scraping |
| Ghost / provenance / replay | Partial | Claims remain limited to recorded evidence |
| Memory / Helix | Experimental | Scoped persistence exists; broader release acceptance remains open |
| Desktop packaging | Experimental | Historical builds do not certify the final beta cockpit |

## Qualified local runtime

The V1 local-runtime qualification is frozen to the following profile:

- Windows 11;
- Unsloth `2026.9.11`;
- Unsloth-managed llama-server path;
- Vulkan;
- NVIDIA GTX 1060 Mobile 6 GB;
- `LFM2.5-2.6B-Q4_K_M.gguf`;
- artifact size `1,674,455,040` bytes;
- SHA-256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`;
- loopback binding `127.0.0.1:18888`;
- bearer-authenticated API.

That profile passed:

- exact artifact/model identity;
- non-stream inference;
- streaming;
- cancellation/recovery;
- invalid-request recovery;
- unload/reload;
- runtime restart/reload;
- clean owned shutdown;
- one governed read-only tool-call path through Execution Authority.

A bounded stability run completed for a little over 30 minutes with **23 interval ticks, 46 host-resource samples, 19 requests, and zero failures**.

This does not qualify every OS, GPU, Unsloth release, quantization, model family, or runtime configuration.

## Model lifecycle and readiness

Covert intentionally distinguishes:

```text
DISCOVERED
→ SELECTED
→ DOWNLOADING
→ VERIFIED
→ REGISTERED
→ ROLE_ASSIGNED
→ RUNTIME_QUALIFIED
→ READY
```

A model file on disk is not READY.

A successful route fixture is not live-provider proof.

Authentication is not exact-model qualification.

Selected identity is not proof of observed execution identity.

## Current first-run objective

The remaining local beta-entry convergence is:

```text
device / workflow profile
→ recommendation
→ exact artifact mapping
→ operator approval
→ download
→ integrity / format validation
→ Model Manager registration
→ Planner / Coder / Reviewer assignment
→ runtime qualification
→ persistence across restart
→ Resident starts a real development task
```

The underlying Model Hub, hardware-fit, import, routing, runtime, and onboarding systems exist at different maturity levels. The current task is to make them one first-user transaction without duplicating business logic or manufacturing readiness.

## Privacy and sovereignty boundary

Covert is local-first, not "network can never occur."

- local inference can operate without a cloud AI provider;
- local tools can operate without cloud AI credentials;
- services bind to loopback by default;
- model-host search/download is an explicit network operation;
- configured online providers are explicit network operations;
- provider credentials are intended to remain daemon-side;
- online-provider use exposes only the context selected for that request;
- fully disconnected use requires required runtime/model assets to already be present or imported through an offline path.

Sovereignty is treated as operator control of execution, data flow, model choice, and evidence—not as a claim that optional network features do not exist.

## Clean-environment portability evidence

A separate clean Linux environment was used to test application portability with:

- no existing Covert state;
- no local model runtime;
- no model weights;
- no configured AI provider.

That test was **not** used to qualify local inference.

It established the pinned Node `26.4.0` environment, dependency installation, native PTY support, Doctor **10/10**, applicable architecture/debugger checks, production frontend build, real application startup, health endpoints, one-use operator pairing, real repository file loading, and denial preservation for a requested write capability.

Because no inference source or model artifacts were present, Covert correctly reported zero active/startable models and degraded/unavailable state.

The application stack was shut down afterward and its service ports were verified closed.

## Preserved Windows E2E incident

An aggregate Windows E2E sequence previously timed out on different read-only routes while the host was under significant process/resource pressure.

The timeout was not increased and assertions were not weakened.

After specifically identified user processes were closed and memory/commit headroom recovered, the same code passed the full sequence, Veritas, and exact-SHA CI.

A later controlled cache-expired readiness request returned successfully in roughly 1.65 seconds rather than reaching the 30-second request deadline.

This supports **host contention** as the failure category.

The exact lower-level Windows mechanism—scheduling, paging, I/O, service latency, or a combination—was not captured and is not claimed as proven.

The original red remains preserved in the evidence record.

## Connected-provider status

Covert contains foundations for BYOK and managed/official-client provider access.

Current design law:

```text
model identity
→ source / artifact identity
→ provider route
→ credential source
→ execution adapter
→ observed response identity
```

The connected beta path is not called qualified until it proves:

```text
authentication
→ model discovery
→ explicit route selection
→ real request
→ real response
→ provider/model identity
→ streaming/cancel/error behavior
→ restart persistence
```

Official supported authentication boundaries are required. Browser-cookie or token scraping is not part of the architecture.

## What is not yet a release claim

The following remain open or intentionally limited:

- finished consumer installer acceptance on the final beta candidate;
- universal Unsloth/platform/model support;
- arbitrary GGUF qualification;
- clean first-run Resident model binding;
- automatic recommendation-to-Hub-to-role assignment across all target hardware;
- complete connected-provider/subscription qualification;
- final Resident → worker → tool → verification → provenance journey on a fresh beta install;
- upgrade/uninstall/state-preservation acceptance for the final package;
- all planned visual themes and post-beta product polish.

## Engineering Preview test path

Experienced testers can evaluate the active convergence branch:

```bash
git fetch origin
git switch nightshift/production-convergence-20260926
npm ci
npm run doctor
npm start
```

Record the exact SHA tested.

Do not post credentials, auth artifacts, model weights, private source, or private data in public issues.

## Beta recruitment

The first beta cohort is intended to provide hardware and workflow diversity rather than marketing validation.

Useful test environments include:

- older and newer NVIDIA GPUs;
- AMD;
- CPU-only systems;
- low- and high-RAM systems;
- different GGUF families and quantizations;
- different local-runtime expectations;
- real development projects rather than hello-world tasks.

## Reporting problems

Normal bugs and usability issues:

https://github.com/AnonymousNomad/covert-coder/issues

Security issues:

https://github.com/AnonymousNomad/covert-coder/security/advisories/new

When reporting a bug, include:

- operating system;
- exact branch;
- exact commit SHA;
- hardware relevant to the failure;
- command/action performed;
- non-sensitive logs;
- whether the path was local-model, fixture-backed, or connected-provider.

## Claim discipline

The project follows a verify-first operating rule:

```text
OBSERVE
→ PRESERVE
→ REPRODUCE
→ RESEARCH
→ ISOLATE
→ ROOT-CAUSE
→ REPAIR
→ REGRESSION
→ VERIFY
→ RECORD
→ CONTINUE
```

A rerun does not erase a red.

A skip is not a pass.

A configured model/provider is not automatically READY.

AI proposes. Evidence decides.
