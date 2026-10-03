<div align="center">
  <img src="docs/assets/branding/covert-coder-emblem.png" width="150" alt="Covert Coder emblem" />

# Covert Coder

**Sovereign AI software engineering. Local by default. Connected by choice.**

A governed AI development workbench for local and connected models, bounded context, typed tool execution, verification, evidence, and operator-controlled automation.

[![AIDE CI](https://github.com/AnonymousNomad/covert-coder/actions/workflows/ci.yml/badge.svg?branch=covert-production)](https://github.com/AnonymousNomad/covert-coder/actions/workflows/ci.yml?query=branch%3Acovert-production)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-2ea44f.svg)](LICENSE)
![Node.js 26.4.0](https://img.shields.io/badge/Node.js-26.4.0-339933?logo=node.js&logoColor=white)
![Status: Engineering Preview](https://img.shields.io/badge/status-Engineering%20Preview-6f42c1)
![Local-first](https://img.shields.io/badge/local--first-default-0b8f55)
[![Security](https://img.shields.io/badge/security-private%20reporting-24292f)](SECURITY.md)

[Architecture](#system-architecture) · [Local runtime](#local-runtime) · [Security](#privacy-security-and-egress) · [Quick start](#quick-start) · [Verification](#verification) · [Engineering Preview](docs/ENGINEERING_PREVIEW.md) · [Contributing](CONTRIBUTING.md)

</div>

> [!IMPORTANT]
> **Covert Coder is an Engineering Preview.** The public <code>covert-production</code> branch is the stable evaluation baseline. Active release-spine work is developed and qualified separately before promotion. A route, screenshot, model file, mock, or local rerun is not treated as production proof.

## Overview

Covert Coder is a local-first AI software-engineering environment built around a simple architectural rule:

> **Models are replaceable workers. They are not the authority.**

The workbench is designed to coordinate the complete engineering transaction around a model: context selection, workflow, model identity, provider/runtime routing, tool execution, authorization, verification, provenance, replay, recovery, and persistent project state.

The intended result is not another model-specific coding client. It is an operator-controlled development system that can use local inference, configured providers, or hybrid role assignment without moving trust into the model itself.

**Your models. Your machine. Your workflow.**

Covert Coder is the current public product identity. **AIDE Sovereign Workbench** is historical engineering lineage and still appears in older evidence, package metadata, and migration records.

## Design principles

| Principle | Engineering meaning |
| --- | --- |
| **Local first** | Local models and local tools remain first-class. Online model search and provider execution are explicit egress choices. |
| **Operator authority** | A model may propose an action; it does not gain raw machine authority by generating a tool call. |
| **Typed execution** | Privileged operations flow through bounded services, contracts, capability checks, and execution authority. |
| **Replaceable intelligence** | Logical roles are separated from physical model/provider identity. |
| **Truthful state** | Discovered, downloaded, verified, registered, running, qualified, and ready are not interchangeable states. |
| **No silent fallback** | Runtime/provider substitution must be explicit and observable. |
| **Evidence over confidence** | Model prose, compilation, runtime execution, verification, and release acceptance remain separate claims. |
| **Failure preservation** | A later green rerun does not erase an unexplained earlier red. |

## System architecture

The governed product loop is designed around one Resident surface with specialized worker roles behind it:

~~~text
USER
  → RESIDENT ASSISTANT
  → CONTEXT CONTROL
  → WORKFLOW ENGINE + SKILL INTELLIGENCE
  → ORCHESTRATOR
  → MODEL ACCESS / ROLE ROUTING
  → EXECUTION AUTHORITY
  → RESOURCE ADMISSION
  → WORKER MODELS + TOOLS
  → VERITAS / VERIFICATION
  → GHOST CODE / PROVENANCE
  → MISSION RECEIPT + MEMORY
  → RESIDENT
  → USER
~~~

### Resident and worker roles

The Resident is the continuity and interaction surface.

Planner, Coder, and Reviewer are logical roles behind Resident. They are not required to be three separate chat sessions or three simultaneously loaded physical models.

A constrained machine may assign one model to multiple roles. A larger system may assign distinct models. A hybrid configuration may eventually use local and connected models for different roles while preserving the same authority and verification boundaries.

### Runtime topology

The current application topology separates browser UX, product routing, canonical backend ownership, and model runtimes:

~~~mermaid
flowchart LR
  UI["Browser Workbench<br/>:4173"] --> EDGE["Product Facade<br/>:4777"]
  EDGE --> TS["Canonical TypeScript Backend<br/>:4778"]
  EDGE --> LEGACY["Legacy Backend<br/>:4779<br/>migration inventory"]
  TS --> CAP["Workspace · Git · Terminal<br/>Tasks · LSP · DAP"]
  TS --> AUTH["Execution Authority"]
  TS --> MODEL["Model Access + Runtime Broker"]
  MODEL --> LOCAL["Local Runtime<br/>loopback/private port"]
  MODEL -. "explicit opt-in" .-> CLOUD["Configured Provider"]
~~~

New user-facing behavior is expected to travel through the product facade and canonical backend. The legacy backend exists as migration inventory, not as a second product architecture.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for route ownership and migration details.

## Model access and routing

Covert treats model selection as a chain of identities rather than a single string in a dropdown:

~~~text
logical role
→ model identity
→ source / artifact identity
→ provider route
→ credential source
→ execution adapter
→ observed response identity
~~~

The purpose is to prevent configuration from being mistaken for execution truth.

Selecting a model does not prove that model answered. A stored credential does not prove provider authentication. A provider health check does not prove an exact model route. A downloaded artifact does not prove runtime qualification.

Those states are intentionally separated.

## Tool execution and authority

A model-generated tool request is untrusted input until it crosses the applicable control boundaries.

The expected path is:

~~~text
model proposes tool
→ parse
→ schema validation
→ capability / policy evaluation
→ Execution Authority
→ operator policy / approval where required
→ execution
→ result
→ model continuation
→ verification
→ evidence
~~~

This separates four different questions:

1. Can the model describe the action?
2. Is the action structurally valid?
3. Is the action permitted?
4. Did the resulting work actually satisfy the engineering requirement?

Covert does not collapse those into a single “agent succeeded” state.

## Local runtime

### Canonical V1 backend

The active engineering preview has qualified **Unsloth** as the canonical V1 local runtime backend through the Runtime Broker boundary.

Direct llama.cpp remains an explicit reference/recovery path. It is not intended to become an invisible fallback when the primary runtime is unavailable.

The frozen qualification profile is deliberately narrow:

| Field | Qualified profile |
| --- | --- |
| OS | Windows 11 |
| Runtime | Unsloth 2026.9.11 |
| Backend | Vulkan through the Unsloth-managed llama-server path |
| GPU | NVIDIA GTX 1060 Mobile 6 GB |
| Model | LFM2.5-2.6B-Q4_K_M.gguf |
| Artifact size | 1,674,455,040 bytes |
| SHA-256 | 02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed |
| Binding | 127.0.0.1:18888 |
| API protection | Bearer-authenticated loopback |

That profile passed bounded live qualification for model discovery, exact artifact identity, non-stream inference, streaming, cancellation/recovery, failed-request recovery, unload/reload, runtime restart/reload, owned shutdown, and authenticated/unauthenticated behavior.

A governed harmless tool case also crossed Covert Execution Authority. Malformed structured arguments were rejected before tool execution.

The same profile completed a bounded 30-minute stability run with repeated inference, streaming, cancellation/recovery, unload/reload, and adapter-owned runtime interruption/restart/reload without a recorded request failure.

> [!NOTE]
> This is **profile-specific qualification**, not a claim that every operating system, GPU, model, quantization, or Unsloth release is certified.

The detailed runtime evidence currently lives on the active convergence branch:
[Unsloth Runtime V1 closeout](https://github.com/AnonymousNomad/covert-coder/blob/nightshift/production-convergence-20260926/docs/design/local-runtime-lab/UNSLOTH-RUNTIME-V1-CLOSEOUT.md).

## Model lifecycle

Covert keeps model lifecycle states explicit:

~~~text
DISCOVERED
→ SELECTED
→ DOWNLOADING
→ VERIFIED
→ REGISTERED
→ ROLE_ASSIGNED
→ RUNTIME_QUALIFIED
→ READY
~~~

The product should not report READY because a filename exists, a manifest contains an entry, or a catalog lookup succeeded.

### Model Hub and acquisition

The project includes daemon-side infrastructure for:

- Hugging Face search and repository-file discovery;
- explicit model downloads;
- resumable partial transfers;
- bounded retry;
- cancellation and cleanup;
- GGUF import and validation;
- hardware/model fit evaluation;
- runtime registration;
- model-role assignment foundations.

Network-touching model-host operations are explicit egress events.

The active first-run work is converging those pieces into one transaction:

~~~text
hardware + workflow
→ recommendation
→ operator approval
→ exact artifact
→ download
→ integrity / format validation
→ registration
→ role assignment
→ runtime qualification
→ persisted readiness
~~~

The objective is to remove unnecessary manual setup without removing operator control.

## Context, workflow, memory, and provenance

Covert is not designed to solve context management by sending the entire repository to every model.

The system separates:

- **Context Control** — bounded project context selection;
- **Workflow Engine** — durable engineering task structure;
- **Skill Intelligence** — procedural capability and methodology;
- **Memory** — scoped retained project/user state;
- **Ghost Code / provenance** — evidence and replay relationships between requests, actions, artifacts, and outcomes.

These systems are at different maturity levels. Public capability claims remain bounded by the current evidence rather than by architecture diagrams.

## Privacy, security, and egress

Covert is **local-first**, not “network activity can never occur.”

The boundary is explicit:

- services bind to loopback by default;
- local models and local tools can operate without cloud-provider credentials;
- provider credentials are intended to remain daemon-side rather than browser state or logs;
- Model Hub search/download is an explicit network operation;
- configured online providers are explicit network operations;
- when an online provider is enabled, that provider receives the content selected for that request;
- imported models, plugins, dependencies, provider responses, and model-generated output are treated as untrusted inputs;
- privileged writes and tool actions remain subject to the applicable authority boundary.

Local inference is not dependent on a remote inference provider once the required local runtime and model artifacts are present.

Read [SECURITY.md](SECURITY.md) before using Covert with private source or external providers.

Security vulnerabilities should be reported through [GitHub private vulnerability reporting](https://github.com/AnonymousNomad/covert-coder/security/advisories/new), not a public issue.

## Current capability status

The public baseline intentionally uses conservative labels.

| Surface | Status | Boundary |
| --- | --- | --- |
| Browser workbench, Monaco editor, workspace, search, chat | **Implemented** | Public baseline |
| Git, terminal, tasks, TypeScript LSP, Python DAP | **Implemented** | Typed service/route families |
| Resident Assistant | **Experimental** | Coordination surface; not an authority bypass |
| Context Control | **Partial** | Canonical bounded context exists; convergence continues |
| Workflow Engine + Skill Intelligence | **Experimental** | Metadata and execution foundations exist |
| Orchestrator | **Available** | Coordinates model/tool paths through typed services |
| Execution Authority | **Available** | Mediates privileged execution and writes |
| Local model/runtime support | **Available / hardware-dependent** | Exact runtime qualification is profile-specific |
| Model Hub / Hugging Face integration | **Partial / opt-in** | Search/import/download infrastructure; network use explicit |
| BYOK/provider routing | **Partial / opt-in** | Connected execution remains separately qualified |
| Veritas / evidence gates | **Implemented as tooling** | Verification does not grant execution permission |
| Ghost Code / provenance / replay | **Partial** | Public claims remain evidence-bounded |
| Memory / Helix | **Experimental** | Scoped persistence/retrieval is still being productized |
| Desktop packaging / bounded desktop control | **Experimental** | Historical packages do not certify the current cockpit |
| Clean-user installer / upgrade / uninstall | **Not release-certified** | Release-spine gate |

For the active status snapshot, see [docs/ENGINEERING_PREVIEW.md](docs/ENGINEERING_PREVIEW.md).

## Engineering Preview branch

The active convergence lane is:

~~~text
nightshift/production-convergence-20260926
~~~

It contains newer Model Access, role-routing, runtime, evidence, Resident, and release-spine work than the public baseline.

Experienced testers can inspect it directly:

~~~bash
git fetch origin
git switch nightshift/production-convergence-20260926
npm ci
npm run doctor
npm start
~~~

> [!WARNING]
> The convergence branch is not a release branch. Its current checkpoint must be evaluated by **exact commit SHA and exact-SHA CI**, not by branch name alone. A temporarily red checkpoint is treated as evidence to investigate, not something to relabel as green.

## Quick start

### Requirements

- Git
- **Node.js 26.4.0** — current pinned CI reference runtime
- npm
- a compatible local model/runtime if local inference is required

The package currently declares Node >=20. That declaration is not a certification that every Node 20+ release passes the complete current verification path.

### Public baseline

~~~bash
git clone https://github.com/AnonymousNomad/covert-coder.git
cd covert-coder
git switch covert-production
npm ci
npm run doctor
npm start
~~~

Open:

~~~text
http://127.0.0.1:4173/
~~~

<code>npm run doctor</code> reports missing runtime binaries, model artifacts, and environment requirements. It does not silently download private assets, create execution authority, or enable an online provider.

## Verification

Typical development checks include:

~~~bash
npm run check:arch
npm run build:frontend
npm run test:e2e
npm run veritas
~~~

The repository also contains focused acceptance, runtime, browser, integration, and desktop qualification commands.

Hardware- or artifact-dependent tests may skip when required assets are absent. A skip remains a skip.

### Evidence law

Covert deliberately separates:

**implementation**
≠ **availability**
≠ **qualification**
≠ **authority**
≠ **verification**
≠ **release acceptance**

Relevant evidence surfaces include:

- <code>common/</code> — shared contracts and generated API definitions;
- <code>tests/</code> — unit, integration, architecture, and acceptance coverage;
- <code>harness/</code> — model-independent verification and operating gates;
- <code>docs/evidence/</code> — public evidence records where appropriate;
- <code>capsules/</code> — portable runtime/evidence metadata;
- <code>benchmarks/</code> — benchmark definitions and published results.

## Development doctrine

The project follows an evidence-first operating discipline internally referred to as **The Developer’s Way**:

~~~text
observe
→ preserve
→ reproduce
→ research
→ isolate
→ root-cause
→ repair
→ regression-test
→ verify
→ prove
→ record
→ continue
~~~

The practical rules are straightforward:

- do not weaken a test merely to obtain green;
- do not increase a timeout simply because a timeout occurred;
- do not convert UNKNOWN into READY;
- do not hide degraded state;
- do not silently fall back to another model/provider;
- do not treat a rerun as root cause;
- do not let documentation outrun evidence.

## Release focus

The active release spine is focused on convergence rather than feature count:

- first-run hardware and workflow onboarding;
- model recommendation → acquisition → integrity → registration → role assignment;
- canonical Resident binding;
- governed local inference through the final product path;
- connected-provider qualification;
- Mission Receipt and provenance;
- restart/recovery;
- browser/user acceptance;
- clean-machine installation;
- upgrade/uninstall/state preservation;
- packaging, signing, SBOM, and license gates.

See [docs/RELEASE_ROADMAP.md](docs/RELEASE_ROADMAP.md) for the public roadmap.

## Documentation

Start with [docs/README.md](docs/README.md).

- [Getting started](docs/GETTING_STARTED.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Covert Coder North Star](docs/COVERT_CODER_NORTH_STAR.md)
- [Operations](docs/OPERATIONS.md)
- [Veritas and Harness](docs/VERITAS_HARNESS.md)
- [Release roadmap](docs/RELEASE_ROADMAP.md)
- [Research log](docs/RESEARCH_LOG.md)
- [Engineering Preview](docs/ENGINEERING_PREVIEW.md)
- [Support](SUPPORT.md)

Historical documents may use the AIDE name or contain time-bound paths/status. Historical evidence should be evaluated against its recorded commit, environment, and scope.

## Contributing

Contributions should preserve operator control, reproducibility, explicit authority boundaries, and honest capability reporting.

Before substantial changes:

- read [CONTRIBUTING.md](CONTRIBUTING.md);
- keep credentials, private source, model weights, and machine-specific secrets out of commits;
- add or update the applicable tests;
- update contracts and documentation when behavior changes;
- preserve skips, degraded states, and unsupported conditions accurately.

See also:

- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Support Guide](SUPPORT.md)
- [Apache-2.0 License](LICENSE)

## License

Covert Coder is licensed under **Apache-2.0** unless a file or dependency states otherwise.

Third-party models, runtimes, libraries, and tools retain their own licenses and attribution requirements.

## Support the project

Covert is being developed in public. Useful participation includes reproducible bug reports, hardware/runtime testing, documentation, code contributions, and sponsorship.

[![GitHub Sponsors](https://img.shields.io/badge/GitHub_Sponsors-Support%20Covert-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/anonymousnomad)
