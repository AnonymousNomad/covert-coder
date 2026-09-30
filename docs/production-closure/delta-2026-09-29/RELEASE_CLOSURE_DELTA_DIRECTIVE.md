# Covert release-closure delta directive

This directive is additive to the existing Covert production execution bundle. Existing project instructions, accepted architecture, owner decisions, Context Control, runtime verification, and G0-G9 release gates remain authoritative.

## Prime objective

Drive the current convergence lane from integrated source to an evidence-backed production release by **closing uncertainty rather than expanding scope**.

Do not add a new abstraction, dependency, feature, provider, workflow, theme, skill family, UI surface, or refactor unless one of these is true:

1. it repairs an observed release blocker;
2. it is required to verify a release claim already in scope;
3. it removes a correctness, security, persistence, recovery, packaging, or operator-integrity defect;
4. the owner explicitly expands scope.

Otherwise record it for post-release work.

## Mandatory release-closure invariants

- Never silently substitute a provider, model, route, role target, project target, conversation target, credential source, adapter, runtime, or artifact.
- Never treat provider catalog presence as exact-model verification or execution support.
- Never treat one successful inference as provider qualification.
- Never treat fixture, mock, source-level, or developer-machine proof as packaged clean-user proof.
- Never call a cumulative suite green when isolated reruns pass but the full ordered run still fails or times out.
- Never carry acceptance evidence across a material source change without revalidating the affected claim.
- Never mutate a frozen RC candidate casually; a material source change creates a new candidate.
- Never weaken assertions, timeouts, authority boundaries, privacy boundaries, or failure criteria solely to obtain green results.

## Dependency order

1. Exact model-selection integrity and truthful UI/persistence behavior.
2. Exact-model verification and governed provider route behavior.
3. Live provider qualification when owner-managed auth and spend boundaries are available.
4. Same-identity restart/recovery and Mission Receipt continuity.
5. Local-model qualification when Resource Admission permits it.
6. Windows cumulative-suite/resource-pressure classification.
7. Clean-room packaged install/first-run/upgrade/recovery/uninstall acceptance.
8. Representative whole-product packaged journeys.
9. Documentation/support matrix reconciliation.
10. Final RC freeze, artifact hashing, release receipt, owner release decision.

Continue independent ready work when one dependency is externally blocked, but do not bypass the blocked gate or relabel it complete.
