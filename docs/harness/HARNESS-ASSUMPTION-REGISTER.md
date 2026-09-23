# Harness Assumption Register

The register records assumptions found in current code, earlier audits, and
historical H1/H2 work. “Current disposition” is against the immutable review
base, not against a later branch.

| ID | Assumption | Origin/evidence | Current disposition | Consequence |
|---|---|---|---|---|
| A-01 | `harness/` is the production Harness | `harness/README.md`, `harness/orchestrator.mjs` | **OBSOLETE / SHADOW** | Trace AgentLoop and route Authority instead. |
| A-02 | Harness owns permissions and context | `harness/README.md` guarantee list | **PARTIALLY VALID** | Authority owns permission; Context providers/Composer own assembly; Harness records bindings. |
| A-03 | A successful tool return is execution proof | `agent-loop.mjs:623-638` explicitly rejects this for required checks | **SUPERSEDED** | Tool success is an observation, not acceptance. |
| A-04 | Operation Authority is the complete execution admission | `authority.ts:6-21`; no attempt/resource/context fields | **PARTIALLY VALID** | Necessary permission boundary, insufficient whole-attempt identity. |
| A-05 | Resource START means worker execution may proceed | `resource-admission.ts:56-99` | **OBSOLETE** | Current response is a probe decision with no reservation or settlement. |
| A-06 | Session ID can stand for task, run, and attempt | `agent-loop.mjs:614-620`, `:691-707` | **PARTIALLY VALID / RISKY** | It correlates files but cannot express retries, child attempts, or uncertain effects cleanly. |
| A-07 | Async checkpoint start establishes a before-state | prior `HARNESS_AUDIT.md`; AgentLoop starts checkpoint before tool execution without awaiting completion | **INVALID** | Before-state evidence can race mutation and failure disclosure. |
| A-08 | Cwd plus path checks constitute a sandbox | `agent-tools.mjs:232-279`; existing audit | **INVALID** | Child processes inherit environment and can access outside the cwd. |
| A-09 | Killing the direct child proves process cleanup | `agent-tools.mjs:250-259` | **INVALID** | Descendant/foreign-process cleanup is not observed or proven. |
| A-10 | Handoff “do not replay effects” is enough retry protection | `continuation-manager.ts:199-215` | **PARTIALLY VALID** | It is a useful instruction, not an enforced effect-certainty gate. |
| A-11 | Trajectory JSON is replay | `agent-loop.mjs:613-620`; `replays.ts:3-32` | **OBSOLETE** | It supports observation review, not exact or semantic replay of a sealed attempt. |
| A-12 | Generic Veritas score is the live acceptance authority | `harness/veritas.mjs:33-53`; live loop forces unavailable/false | **PARTIALLY VALID** | Generic score is a helper; requirement-bound Veritas must receive independent evidence. |
| A-13 | Context source/status events identify model input | `agent.ts:160-169`; `agent-loop.mjs:320-326` | **INVALID** | Status does not prove content, order, truncation, digest, or actual model delivery. |
| A-14 | Caller worker descriptor proves model identity | `provenance.ts:14-30`; `agent-loop.mjs:696-707` | **INVALID** | Provider/runtime/artifact/template/configuration must be observed independently. |
| A-15 | Completion prose is safe to treat as done | `agent-loop.mjs:396-400`, `:722-727` | **INVALID** | `done` can coexist with failed/unavailable verification. |
| A-16 | Historical H1/H2 contracts are shipped because they exist in Git | commits `f2136f8` through `11b5dec` | **INVALID** | They are not ancestors of the certified candidate. |
| A-17 | A retry can reuse the same authority decision | H1 historical retry tests reject this; current continuation lacks equivalent envelope binding | **SUPERSEDED / GAP** | Every mutation retry needs fresh authority/evidence and a new attempt identity. |
| A-18 | Append-only observations are automatically canonical truth | provenance contract explicitly says observation is not verification | **SUPERSEDED** | Preserve observation/verification/truth separation. |
| A-19 | Models exposing one chat interface are interchangeable | PR #31 cross-candidate matrix | **INVALID** | Context, adapter, template, tool, and reasoning behavior differ. |
| A-20 | One calibration can represent a model forever | no current Passport; addendum drift cases | **INVALID** | Fingerprint/version boundaries and targeted invalidation are required. |
| A-21 | Calibration may lower acceptance for weak models | addendum same-acceptance rule | **INVALID** | Sync can change presentation/budget/profile only; Veritas standard is invariant. |
| A-22 | Early model success should dominate future routing | addendum exploration-bias risk | **INVALID** | Recommendations need sample size, confidence, recency, and bounded exploration. |
| A-23 | A model failure is a Model Failure before system effects are excluded | PR #31 system-gap analysis; Liquid closure report | **INVALID** | Context/adapter/runtime/projection/evaluator divergence must be checked first. |
| A-24 | A benchmark pass is comparable without Harness/profile version | addendum version-lineage requirement | **INVALID** | All synthesis observations need Harness, profile, context and Skill versions. |
| A-25 | A provider connection is equivalent to model readiness | `provider-connections.mjs` aggregation; connection addendum | **INVALID** | Connection, model discovery, runtime readiness, Resource Admission and Veritas remain separate states. |
| A-26 | A credential file owned by a delegated client can be copied into Covert | `opencode-bridge.ts` deliberately avoids credential-file access; provider research | **INVALID** | Use delegated status/auth/session APIs and opaque owner/reference only. |
| A-27 | ChatGPT subscription, OpenAI API, Codex, repository access and Copilot access are one entitlement | provider connection addendum; official provider distinctions | **INVALID** | Represent separate connection classes and account scopes. |
| A-28 | A rotating free/auto provider alias is a stable model identity | OpenRouter dynamic catalog/free-model requirement | **INVALID** | Harness Sync requires an exact fingerprint; otherwise use Standard mode only. |
| A-29 | A catalog download grants permission to execute the artifact | Hugging Face/ModelScope acquisition research | **INVALID** | Revision/hash/license/runtime checks precede registration; acquisition is not authority. |
| A-30 | A stored API key or detected CLI auth proves a healthy provider | current connection service heuristic | **INVALID** | Require bounded provider/bridge verification and preserve auth/rate-limit/unavailable states. |
| A-31 | All OpenAI-compatible endpoints share tool/reasoning behavior | OpenCode custom-provider and Ollama compatibility documentation | **INVALID** | Discover capabilities per endpoint/model and preserve `UNKNOWN` where not observed. |

## Architecture consequence

The next execution slice must retire A-04/A-05/A-06/A-10/A-13/A-14 together at
the execution-admission boundary. The intended productization slice must also
retire A-25/A-26/A-30 at the connection boundary, without making the Harness
responsible for provider routing, context construction, Authority, Veritas, or
model analytics. Connection Center and sealed-attempt work are related but
separate implementation boundaries.
