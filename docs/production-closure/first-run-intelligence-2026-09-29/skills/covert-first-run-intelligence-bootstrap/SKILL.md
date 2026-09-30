---
name: covert-first-run-intelligence-bootstrap
description: Close Covert first-run setup around the user's real workflow, hardware, repositories, providers, local models, workflows, skills and migrated context without creating duplicate authority or storage systems.
---

# Covert first-run intelligence bootstrap

## Use when

Implementing or reviewing onboarding, Setup Session, first-run wizard, workflow profiling, provider connection, repository onboarding or readiness validation.

## Procedure

1. Ground current onboarding/setup contracts and persistence owners.
2. Inventory which stages are real, fixture-only, planned or disconnected.
3. Build one canonical setup plan from user answers + observed hardware/repo facts. Tag every field by provenance: `USER_STATED`, `REPO_OBSERVED`, `TOOL_DISCOVERED`, `DEFAULT`, or `INFERRED_PENDING_CONFIRMATION`.
4. Present the plan before mutations. Apply through existing Authority-owned routes only.
5. Make every optional network action explicit.
6. Route credentials to secure credential owners; never setup-session JSON.
7. Route model acquisition through Model Manager/Model Access; never side-load an unregistered path.
8. Route project import through workspace/Git abstractions; never assume all repositories should be cloned.
9. Route context migration through the migration procedure; never copy raw archive text into durable memory automatically.
10. Validate with real state after provisioning. UI completion is not readiness.
11. Restart and prove selected settings, exact model identities and approved imported context survive.
12. Record remaining DEGRADED/UNKNOWN items rather than hiding them.

## Acceptance

A new clean profile can reach a usable project with either local-only, hybrid or cloud-first posture, with explicit user choices, no config-file editing and no unauthorized network or mutation.
