# Covert Coder — Public Site Brief

**Status:** content/design brief for Engineering Preview

This brief is intentionally narrower than the full product roadmap. Its job is to make the public website accurate, understandable, and useful before a broader Engineering Preview push.

## Primary message

# Covert Coder

**Vibe at the surface. Engineering underneath.**

Your models. Your machine. Your workflow.

Local by default. Connected by choice.

Covert Coder is a local-first AI development workbench designed to govern model choice, context, tools, execution, verification, provenance, and evidence around a real software project.

## Required public label

Use:

**Engineering Preview / Pre-release**

Do not use:

- Production Ready
- Stable Release
- Fully Autonomous
- Better than Cursor overall
- Supports every local model
- Fully offline in every configuration

unless future evidence explicitly supports the statement.

## Recommended landing-page structure

### 1. Hero

Include:

- product name;
- tagline;
- one strong product screenshot;
- Engineering Preview badge;
- GitHub CTA;
- secondary documentation/preview-status CTA.

Suggested CTA labels:

- View on GitHub
- Engineering Preview Status
- Read the Architecture

Do not add a download CTA until a current installer passes the downloadable-preview gate.

### 2. What Covert is

Short explanation:

Covert places a governed control plane between the operator and the models/tools doing the work.

Core ideas:

- local-first;
- model/provider choice;
- bounded context;
- Resident coordination;
- Execution Authority;
- Resource Admission;
- Veritas;
- Mission Receipts;
- reproducible evidence.

### 3. Model Access

Show the product mental model:

```text
Model source / connection
  ↓
available models
  ↓
exact selected model
  ↓
governed mission
```

Potential source cards:

- OpenCode Go
- Local GGUF
- BYOK / configured providers
- Codex — upcoming governed adapter

Do not hard-code a permanent OpenCode Go model list on the marketing site.

### 4. Resident Assistant

Describe Resident as:

- project-aware;
- workflow-aware;
- model/tool coordinator;
- operator-facing mission/status surface.

Public boundary:

Resident is still Experimental until real streamed end-to-end orchestration, Mission Receipt, and restart/recovery acceptance are closed.

### 5. Governed execution

Explain the intended loop:

```text
User
→ Resident
→ Context Control
→ Workflow / Skills
→ Orchestrator
→ Execution Authority
→ Resource Admission
→ Worker
→ Veritas
→ Mission Receipt
→ Resident
```

This section should visually emphasize that model output and execution authority are not the same thing.

### 6. Local-first / GGUF

Explain:

- local models remain first-class;
- GGUF files are treated as artifacts that require identity and qualification;
- cloud/provider use is explicit;
- local presence is not automatically shown as verified readiness.

Avoid claiming every GGUF will work.

### 7. Evidence over claims

Public differentiator section:

- exact-SHA CI;
- Veritas;
- model/runtime identity;
- receipts/provenance;
- failure/cancellation/cleanup evidence.

Suggested copy:

> Covert is designed to distinguish what a model said from what the system actually verified.

### 8. Engineering Preview status

Link directly to:

`docs/ENGINEERING_PREVIEW.md`

Show a small truthful status matrix:

- Implemented
- Available
- Experimental
- Partial
- Not release-certified

### 9. Screenshots

Only publish screenshots from a known branch/SHA.

Recommended screenshot set:

1. main cockpit;
2. Resident;
3. Model Access;
4. local model inventory/qualification;
5. OpenCode Go model selection;
6. integrated terminal;
7. editor + diff;
8. Authority/status;
9. verification/results;
10. Mission Receipt when live acceptance exists.

Do not use concept art as though it is current product UI.

### 10. Community

Links:

- GitHub
- Issues
- Discussions
- Discord when the public invite is ready
- Sponsorship

## Website implementation guidance

Keep the first site small.

Recommended first version:

- static/mostly-static;
- fast;
- accessible;
- responsive;
- no account system;
- no unnecessary database;
- no analytics that conflict with local-first/privacy messaging.

Preferred workflow:

- canonical source in GitHub;
- branch/PR previews;
- Vercel preview deployment;
- production deployment only when owner-authorized;
- Playwright smoke checks for public routes.

## Suggested page set

For Engineering Preview:

- `/` — landing page
- `/preview` — engineering preview status
- `/docs` — documentation entry / links
- `/security` — security boundary / disclosure link

Do not build a large marketing CMS before these pages are useful.

## Competitive language

Allowed direction:

- local-first;
- governed execution;
- provider/model plurality;
- evidence/receipts;
- local GGUF support direction;
- one control plane for multiple workers.

Avoid unsupported universal rankings.

Better wording:

> Covert is being built to compete with modern AI development environments while taking a different approach: local-first operation, explicit authority, model plurality, and evidence-backed execution.

## Launch sequence

1. refresh README;
2. publish Engineering Preview status;
3. implement minimal website;
4. add verified current screenshots;
5. add website URL to repository metadata;
6. validate links/accessibility/mobile layout;
7. only then begin broader screenshot/social posting;
8. add download CTA after installer acceptance.

## Source-of-truth rule

Website copy is downstream of repository truth.

If README/status/evidence and website disagree, fix the website rather than weakening repository evidence.
