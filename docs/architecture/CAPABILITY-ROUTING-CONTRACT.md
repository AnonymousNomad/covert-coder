# Capability Routing Contract

- **Status:** DESIGN / CONTRACT ONLY. The router is not implemented; this document defines what V1.1 must build.
- **Parent:** `docs/architecture/REMOTE-OPERATOR-CONTROL-PLANE.md`.
- **Canonical owner:** routing selects an executor for an already-authorized operation. Authority remains the only permission owner; the workflow engine remains the only transition owner.
- **Frozen references:** `docs/v1/COVERT-V1-RELEASE-CLOSURE-MATRIX.md` C3-12 (capability taxonomy, MISSING — V1.1; "Do not create parallel states before the Fabric decision"); `artifacts/integration-certification/CAPABILITY-FABRIC-DISPOSITION.md` (the Fabric decision); C5-19 (admission gate).

## 1. Purpose

One deterministic decision point answers: **which executor fulfills this authorized operation, on which device, and why** — recorded as a receipt. Today the choice is accidental: the agent model picks from a hardcoded 9-tool registry (`node/src/services/agent-tools.mjs:297-492`), the direct `/api/agent/tool` dispatcher is shadowed (`node/src/openapi.ts:1000-1021`), and there is no executor hierarchy anywhere (base audit).

## 2. Taxonomy discipline (C3-12)

There is exactly one capability taxonomy. This contract consumes the Capability Fabric taxonomy and must not create a parallel one:

| Fabric state (`CAPABILITY-FABRIC-DISPOSITION.md:7`) | Meaning |
|---|---|
| `AVAILABLE` | present on the device/filesystem, not necessarily installed/enabled |
| `INSTALLED` | present and known to the registry |
| `ENABLED` | may be invoked (installation does not imply enablement) |
| `PERMISSION_GRANTED` | operator policy allows the operation class |
| `HEALTHY` | runtime health probe passes (or `UNKNOWN` stays `UNKNOWN`) |
| `AUTHORIZED_FOR_OPERATION` | an exact Authority operation currently permits this invocation |

Mapping for the seven suggested state words from the product brief (for operators, not for code): INSTALLED→`INSTALLED`, EXPOSED→`INSTALLED` (discoverable; no second "EXPOSED" state), CALLABLE→`ENABLED`+`HEALTHY`, AUTHENTICATED→`ENABLED` (adapter credentials valid), AUTHORIZED→`PERMISSION_GRANTED`, QUALIFIED→`HEALTHY` with `qualification_ref` evidence, ACTIVE→an in-flight `AUTHORIZED_FOR_OPERATION` + attempt. Do not implement these words as states.

Substrates to consume (no new registries unless the Fabric task creates one):
- plugin trust + Node-permission sandbox (`plugins/manager.mjs:5,8-12,65-93`) — the closest existing capability-pack substrate;
- workbench bundles (`workbenches/manager.mjs:247-269,332-379`) — composition + trust;
- micro-expert registry (`harness/micro-experts.mjs`) — advisory specialists, never executors;
- skills registry (`skills/registry.json`, `node/src/services/skills-loader.mjs`) — discovery/ranking precedent only;
- egress classification (`common/contracts/egress.ts:6,9`) — network requirement truth;
- model lifecycle states (`common/model-state.ts:1-30`) and admission states (`common/contracts/admission.ts:7`) — state vocabulary reuse.

## 3. Capability descriptor

```ts
type CapabilityDescriptor = {
  capability_id: string;        // stable, dotted: 'email.read', 'desktop.uia.input', 'terminal.pty'
  kind: 'TOOL' | 'SKILL_PACK' | 'WORKFLOW_PACK' | 'VERIFIER' |
        'PROVIDER_ADAPTER' | 'MODEL_ADAPTER' | 'CONTEXT_PROVIDER' | 'COMPOSITE_PACK';
  display_name: string;
  provider: {                   // who implements it
    adapter_id: string;         // e.g. 'native.desktop', 'connector.gmail', 'mcp.filesystem'
    version: string;
  };
  device_scope: 'local' | 'any' | string[];   // device ids or classes allowed
  platform: string[];
  side_effects: 'none' | 'local' | 'external';
  idempotency: 'idempotent' | 'at_most_once' | 'non_idempotent';
  trust_requirement: 'trusted_thin' | 'trusted_full' | 'operator_only';
  authority_requirement: { risk_class: 'read' | 'write' | 'execute' | 'external' | 'permission' | 'revoke' };
  network_requirement: { egress: 'none' | 'consent_required' | 'local_only_forbidden'; hosts: string[] };
  qualification: { required: boolean; evidence_ref: string | null; scope: string | null };
  state: FabricState;           // Section 2
  health: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
  last_verification_at: string | null;
};
```

Rule: `authority_requirement.risk_class` must match the enrolled operation kind. A capability cannot self-declare a lower risk than its executor path performs.

## 4. Router contract

```ts
type RoutingDecision = {
  routing_id: string;
  operation_ref: string;            // canonical operation_id
  mission_ref: string | null;
  request: {
    capability_hint: string | null; // from ingress intent (if deterministic)
    objective_digest: string;       // sha256 of normalized objective/args
    device_target: string | null;
    workspace_id: string;
  };
  candidates: Array<{
    capability_id: string;
    provider_adapter: string;
    tier: 1 | 2 | 3 | 4 | 5 | 6;     // Section 5
    eligible: boolean;
    refusal?: string;               // typed reason when not eligible
  }>;
  selected: { capability_id: string; provider_adapter: string; tier: number } | null;
  selection_basis: string;          // deterministic explanation
  gui_fallback_used: boolean;
  policy_ref: string | null;
  decided_at: string;
};
```

`route(operation) → RoutingDecision` is a pure decision; execution happens after selection through the selected executor's exact-operation contract. The decision is recorded before dispatch and is part of the receipt chain (REMOTE-016).

## 5. Executor hierarchy and selection

Preferred order (lower tier wins when multiple candidates are eligible):
1. **Native Covert capability** — first-party, typed, locally verified (e.g. task runner, terminal, git, desktop native ops).
2. **Typed service/API connector** — provider API/IMAP with explicit consent and typed contracts.
3. **MCP/provider integration** — only when an MCP runtime exists with explicit trust (today: metadata only; no runtime).
4. **CLI/terminal** — allowlisted commands (`node/src/routes/terminal.ts:8`), bounded.
5. **Browser automation** — does not exist today; test tooling (Playwright) is not a product capability.
6. **Desktop Control GUI automation** — universal fallback, never the default.

Selection algorithm (deterministic):
```
1. enumerate candidate capabilities by capability_id/kind for the objective
2. filter: state ∈ {ENABLED, PERMISSION_GRANTED, HEALTHY, AUTHORIZED_FOR_OPERATION}
           AND trust_requirement satisfied AND device_scope contains target
           AND platform supported AND network_requirement satisfied (Local-Only aware)
           AND qualification valid (required capabilities must have unexpired evidence)
3. if none eligible → typed refusal ROUTING_NO_CANDIDATE (never guess, never downgrade silently)
4. rank eligible candidates by tier, then by qualification freshness, then by
   idempotency (idempotent first), then by provider version (highest), then capability_id (lexicographic)
5. GUI fallback (tier 6) requires policy flag `allow_gui_fallback` for the capability class;
   otherwise refusal ROUTING_GUI_FALLBACK_NOT_PERMITTED
6. record RoutingDecision with the full candidate list and the basis string
```

Anti-patterns forbidden by this contract:
- picking the first registered capability without eligibility checks;
- model-driven free choice of executor (models may propose an objective; the router selects the executor);
- silently substituting a different device;
- silently escalating (e.g. terminal → GUI);
- treating qualification evidence from one device/version as valid for another.

## 6. Examples

| Request | Expected routing |
|---|---|
| "check my email" | tier 2 `email.read` connector when qualified; tier 6 desktop mail-client automation only if no connector and `allow_gui_fallback` for `email.read` |
| "report machine status" | tier 1 `device.status` (read projection; no side effects) |
| "run the test suite" | tier 1 `task.run` (task runner) with admission gate |
| "open Calculator" | tier 1 `desktop.launch_app` (native op) |
| "take a screenshot of the fixture window" | tier 1 `desktop.capture` (leased-window capture; owned executor) |
| "send that email" | tier 2 `email.send` with CLASS B policy (per-operation decision unless preauthorized bounds) |
| "stop that mission" | tier 1 `mission.cancel` control operation (never a GUI click, never a model "stop" prompt) |

## 7. Executor adapter contract

Every executor adapter (native, connector, MCP, terminal, browser, desktop) exposes the same minimal interface to the router:

```ts
interface CapabilityExecutor {
  capability_id: string;
  describe(): CapabilityDescriptor;
  execute(input: {
    operation: { operation_id: string; kind: string; digest: string };
    args: unknown;            // already digest-bound
    device_id: string | null;
    mission_ref: string | null;
    attempt_ref: string | null;
  }): Promise<{
    status: 'SUCCESS' | 'REFUSED' | 'FAILED' | 'UNCERTAIN';
    code?: string;            // typed refusal/failure code
    output?: unknown;
    receipt: { action_id: string; postcondition: string | null; evidence_refs: string[] };
  }>;
}
```

Rules:
- Adapters validate the exact operation against their own authority assertion (never trust the router's word) — matching the existing `desktop-control.mjs:27-30` pattern.
- Adapters may refuse without side effects; `UNCERTAIN` is honest for unconfirmed termination/external effects.
- Adapters never write canonical truth; they return receipts to the harness/recorder.

## 8. Admission integration (C5-19)

- Before dispatching any start that consumes significant resources, the router (or the caller) obtains a Resource Admission decision (`node/src/services/resource-admission.ts`).
- `REFUSE_RESOURCE` → typed refusal, no dispatch; `QUEUE` → mission state `QUEUED`, never partial execution.
- Remote-triggered starts must be admission-gated; this is the remote answer to C5-19 and is a V1.1 implementation condition.

## 9. Qualification

- `qualification.required = true` for capabilities whose correctness claims depend on tested scope (desktop UIA classes, OS builds, connector APIs).
- Qualification evidence is a reference to committed evidence (e.g. `docs/evidence/desktop-control-wave2/...` pattern), scoped to device + version.
- The router treats expired/invalid qualification as ineligible for consequential classes; read-only status capabilities may degrade to `DEGRADED` with explicit labeling.

## 10. Verification requirements

- REMOTE-004 (consequential action requires correct policy), REMOTE-011 (Desktop Control only through the router), REMOTE-016 (receipt chain) are the acceptance battery for this contract.
- Additional contract tests required at implementation: deterministic selection with fixed candidate sets; GUI-fallback refusal without policy; stale qualification refusal; admission refusal propagates without dispatch; Local-Only removes egress-requiring candidates.

## 11. Open decisions

1. Where the routing decision is persisted (recommend `.aide/routing/decisions.jsonl`, append-only, digest-only).
2. Whether `capability_hint` may come from the model (recommend: model may suggest, router must independently verify eligibility).
3. The qualification expiry rule per capability kind (recommend: desktop UIA tied to OS build; connectors tied to API version).
