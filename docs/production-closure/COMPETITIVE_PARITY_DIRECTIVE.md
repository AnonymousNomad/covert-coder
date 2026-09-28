# Covert Competitive Parity and Frictionless Product Directive

Version 1.0
Date: 2026-09-27

## Purpose

Covert must become frictionless enough that a user evaluating Cursor, GitHub Copilot, Zed, OpenCode, Roo Code, Cline, Windsurf-class tools, or similar coding agents can understand how to perform the same expected categories of work in Covert without learning an unnecessarily different workflow.

This is not a directive to clone competitors.

It establishes:

1. baseline product expectations;
2. competitive-parity categories;
3. Covert-specific extensions;
4. continuous competitive research;
5. evidence requirements.

The product should match expected workflows where those workflows are useful, and differentiate through Covert's local-first model, authority system, context control, model access fabric, evidence architecture, and operator control.

---

# 1. Product doctrine

Do not optimize for feature-count parity.

Optimize for:

- workflow parity;
- friction parity;
- capability clarity;
- migration ease;
- evidence-backed differentiation.

A user coming from another coding agent should immediately recognize:

- chat/agent surface;
- model selector;
- project/workspace context;
- plan/ask/code/debug modes or equivalents;
- terminal;
- diffs;
- checkpoints/recovery;
- provider connection;
- local-model connection;
- MCP/tool connection;
- settings;
- skills/instructions;
- Git workflow;
- browser/app verification;
- agent status;
- approvals/permissions.

Covert may name them differently, but the path must remain obvious.

---

# 2. Competitive baseline categories

## A. Agent interaction

Required product expectations:

- interactive agent;
- autonomous execution;
- planning mode;
- read-only/ask mode;
- debugging mode;
- implementation mode;
- stop/cancel;
- steer/follow-up while running;
- task queue where appropriate;
- streamed tool/action status;
- clear working state;
- final summary/evidence.

Covert advantage:
- explicit Execution Authority;
- controlled context;
- evidence-first completion.

## B. Multi-agent / delegated work

Expected:

- multiple concurrent agents/tasks;
- isolated worktrees or equivalent isolation;
- task delegation;
- coordinator/orchestrator;
- specialist agents;
- agent status;
- pause/stop;
- result review;
- merge/integration workflow.

Covert advantage:
- model-agnostic worker routing;
- local and remote workers under same control plane;
- qualification-aware routing.

## C. Model access

Expected:

- hosted models;
- first-party API keys;
- gateways;
- OpenRouter-class aggregation;
- subscriptions where officially supported;
- local models;
- custom OpenAI-compatible endpoints;
- model favorites/defaults;
- per-role/per-project model selection;
- model capability visibility.

Covert advantage:
- Model Access Fabric;
- hardware-aware recommendations;
- qualification state;
- multiple routes to same model;
- cost/resource policy;
- Hugging Face discovery/download/validation.

## D. Context

Expected:

- codebase search;
- semantic indexing;
- file/folder mentions;
- symbol context;
- URL/web context;
- previous thread/task context;
- rules/instructions;
- skills;
- compact/summarize long sessions;
- ignored files/sensitive-file exclusions.

Covert advantage:
- Context Control Engine;
- explicit context package;
- measurable scaffold/harness;
- workspace-aware context governance.

## E. Editing

Expected:

- multi-file edits;
- inline edit;
- diff review;
- hunk accept/reject;
- change summary;
- editor diagnostics;
- autocomplete/edit prediction eventually;
- formatting/lint integration.

Covert must not require every code change to happen through chat.

## F. Terminal and shell

Expected:

- integrated terminal;
- agent-run commands;
- stdout/stderr;
- cancellation;
- approval policies;
- shell selection;
- cwd/environment handling;
- command history/status;
- long-running process management.

Covert advantage:
- Authority + Resource Admission;
- visual resource telemetry;
- recoverable execution.

## G. Browser / application verification

Expected:

- launch dev app;
- navigate;
- click/input;
- screenshots;
- console inspection;
- visual validation;
- responsive testing;
- browser automation.

Covert should treat UI verification as a first-class verification tool, not optional decoration.

## H. Checkpoints / recovery

Expected:

- automatic checkpoints before meaningful edits;
- restore;
- compare;
- independent Git safety;
- interrupted-task recovery;
- session/task history.

Covert advantage:
- checkpoint/recovery doctrine extends beyond file edits to workflow state.

## I. Git and collaboration

Expected:

- diff/status;
- branch/worktree;
- commit assistance;
- PR creation where authorized;
- issue association;
- code review;
- review comments;
- iteration after review;
- GitHub/GitLab/etc. integrations where supported.

Covert should include first-class review workflow before public release.

## J. Code review

Expected:

- review current diff;
- PR review;
- detect bugs/security/quality issues;
- apply selected fixes;
- project-specific review instructions;
- independent reviewer model/agent.

Covert advantage:
- Veritas / evidence architecture can provide stronger review provenance.

## K. Tools / MCP / plugins

Expected:

- MCP local and remote;
- per-project and global configuration;
- enable/disable;
- connection health;
- tool permissions;
- auto-approval policy;
- marketplace/discovery;
- skills/workflows.

Covert advantage:
- central authority and skills intelligence.

## L. Permissions / safety

Expected:

- allow;
- deny;
- confirm;
- command policy;
- sandboxing where available;
- network controls where available;
- secret management;
- repository/workspace scope.

Covert advantage:
- Authority is architectural rather than a UI prompt layer.

## M. Rules / skills / profiles

Expected:

- global instructions;
- project instructions;
- reusable skills;
- role/mode profiles;
- per-mode tool permissions;
- import/export/share.

Covert already has a major opportunity here because the project is built around directives, SOPs, skills and workflows.

## N. Remote / background work

Expected modern category:

- run task without keeping foreground UI active;
- monitor status remotely;
- notifications;
- mobile/tablet access;
- cloud or self-hosted execution path;
- PR/artifact result;
- take over/intervene.

Covert direction:
- desktop remains authoritative;
- secure Companion/PWA gives tablet/phone control;
- future remote worker infrastructure may be local/self-hosted/cloud.

## O. Automations

Expected emerging category:

- scheduled tasks;
- event-triggered tasks;
- GitHub/issue triggers;
- recurring maintenance;
- monitoring.

Covert should route automations through workflows and Authority.

## P. Provider/account UX

Required frictionless flow:

`Connect Model Source`
→ choose subscription/API/gateway/local/custom
→ authenticate
→ discover models
→ test connection
→ show capabilities
→ qualify
→ select.

No manual JSON should be required for common providers.

Advanced JSON/config remains available.

## Q. Local model UX

Required:

`Browse Models`
→ hardware-aware filter
→ model details/license
→ quantization recommendation
→ download
→ verify hash/structure
→ runtime check
→ qualification
→ use.

This should be easier than manually finding GGUFs and configuring runtimes.

## R. Onboarding

A new user should reach a useful agent task with minimal decisions.

Recommended first-run path:

1. choose workspace/project;
2. select model source;
3. connect subscription/API or choose local;
4. Covert verifies provider/runtime;
5. recommend one model;
6. run guided first task;
7. show what Authority and evidence mean.

Advanced configuration should not block first use.

## S. Observability

User should know:

- what agent is active;
- what model/provider route is used;
- what tools are being called;
- what files changed;
- what commands ran;
- resource usage;
- cost where relevant;
- current task phase;
- why execution is blocked;
- how to stop it.

## T. Product portability

Export/import non-secret configuration:

- project profile;
- model preferences;
- skills;
- workflows;
- provider IDs;
- role assignments;
- routing policy;
- theme;
- qualification metadata where portable.

Secrets must be reconnected securely.

---

# 3. Covert-specific differentiation

Do not copy competitor positioning.

Covert should differentiate around:

## Sovereign control
Local-first and offline-capable paths.

## Model freedom
Subscriptions, API keys, gateways, local models, Hugging Face and custom endpoints under one fabric.

## Context governance
Context is selected and controlled, not an opaque side effect.

## Execution Authority
Tools and agents do not gain authority merely because a model requested a call.

## Evidence
Completion claims should be backed by tests, traces or explicit evidence.

## Hardware-aware local AI
Recommendations based on the actual machine.

## Transparent orchestration
The user can understand why a worker/model/tool was selected.

## Companion control
Tablet/mobile supervision of the authoritative desktop runtime.

## Experience system
Distinctive interactive themes tied to real system state, with minimal/reduced-motion modes.

---

# 4. Continuous competitive research

Maintain a living competitive matrix.

Track at minimum:

- Cursor
- GitHub Copilot
- Zed
- OpenCode
- Roo Code
- Cline
- Windsurf-class systems
- relevant new entrants.

For every competitor capability:

- source URL;
- date checked;
- capability;
- user workflow;
- Covert status:
  - VERIFIED
  - PARTIAL
  - MISSING
  - NOT NEEDED
  - INTENTIONALLY DIFFERENT
- evidence;
- priority;
- related Covert issue.

Do not copy marketing claims.

Verify behavior from current documentation or direct product testing.

---

# 5. Priority classification

P0 — friction blocker
A normal user cannot perform an expected core workflow.

P1 — parity gap
A major competitor workflow exists and is materially useful.

P2 — differentiator support
Improves Covert's unique thesis.

P3 — polish
Useful but not release-blocking.

Do not allow P3 work to displace P0/P1 closure.

---

# 6. Immediate parity audit

Luna should inspect current Covert and classify these first:

1. onboarding;
2. model source connection;
3. local model discovery/import;
4. model selection;
5. chat/agent interaction;
6. plan/ask/code/debug equivalents;
7. context selection;
8. file editing/diff review;
9. integrated terminal;
10. command permissions;
11. MCP;
12. skills/workflows;
13. checkpoints;
14. browser verification;
15. Git/worktree;
16. code review;
17. multi-agent execution;
18. OpenCode delegated execution;
19. background/remote control;
20. companion/mobile;
21. notifications;
22. automations;
23. provider/account health;
24. cost/resource visibility;
25. history/recovery;
26. installer/upgrade;
27. privacy/offline behavior;
28. public documentation.

Produce a matrix with evidence, not memory.

---

# 7. Friction audit

For each core workflow record:

- clicks/actions from launch to success;
- manual config files required;
- credential entry;
- confusing choices;
- failure messaging;
- recovery path;
- documentation dependency;
- time to first useful result.

The goal is not identical UI.

The goal is:
"No important workflow is needlessly harder in Covert."

---

# 8. Release condition

Covert is not considered competitively ready merely because it has more architecture.

Before public comparison claims:

- close P0 friction blockers;
- close or explicitly classify P1 parity gaps;
- run representative E2E workflows;
- document limitations;
- test installation on a clean environment;
- publish only evidence-backed differentiators.
