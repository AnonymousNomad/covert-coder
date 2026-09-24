# MODEL MANAGER — Intelligence Registry, Discovery, Recommendations

Production model-management infrastructure for Covert. This slice makes Covert
understand what intelligence is available, what each model has actually proven,
what fits the current task and machine, and how to explain that recommendation —
without tying Covert to one provider, one runtime, or one model family.

## Canonical Intelligence Registry

`node/src/services/intelligence-registry.ts` — one representation for local
artifacts, cloud providers and qualification evidence (`.aide/intelligence/
registry.json`, strict zod schema, `intelligence-registry-v1`).

- **Availability ≠ qualification.** Availability: `UNAVAILABLE · DISCOVERED ·
  AVAILABLE · INSTALLED · CONNECTED · LOADABLE`. Qualification: `UNTESTED ·
  TESTED · QUALIFIED · NOT_QUALIFIED · INVALID_EVIDENCE · STALE`. An installed
  model has not earned any role.
- **Artifact identity law.** Qualification attaches to the exact artifact /
  revision / hash / runtime treatment (`qualification.basis`). A change to the
  artifact hash, Harness Profile hash or runtime treatment marks a QUALIFIED
  entry **STALE** (`evaluateStaleness`) — never silently preserved. Q4_K_M
  qualification never transfers to Q2/Q8/QAD/another fine-tune.
- **References, not duplication.** Entries carry `passport_ref`,
  `harness_profile_ref` and `evidence_refs`; evidence bodies stay in their
  canonical homes.
- **Public-safe serialization** (`toPublicSafe`) strips local paths, endpoints
  and provider internals; it throws if a credential-shaped value or absolute
  path would leave the machine. Machine-local paths never appear in
  public-facing output.

## Local discovery (bounded)

`node/src/services/intelligence-discovery.ts` — depth-1 scan of configured
locations only (`<workspace>/models` + `AIDE_MODEL_DIRS`); never crawls disks.
Captures filename, size, format, quantization (from filename; e.g. `Q4_K_M`,
`Q4_0`), `hash_status: not_computed` (GB-scale hashing is explicit, not
automatic). Model Pack installs map into the same registry — no second model
database.

## Cloud discovery (no credentials, no network)

Provider state derives from **local configuration presence only**:
`CONFIGURED_NOT_VERIFIED · AUTHENTICATED · AUTH_FAILURE · UNAVAILABLE`.
Cloud access stays blocked until credential rotation is confirmed; the probe
never contacts providers and never prints credential values.

## Recommendation Engine V0 (deterministic, no LLM)

`node/src/services/recommendation-engine.ts` — inputs: role, local-only/offline
preference, available RAM (+ headroom), provider cost tiers, verified outcome
history, task class. Output: `recommended[] / alternatives[] / excluded[]` each
with **reason codes** (`ROLE_QUALIFIED`, `OFFLINE_CAPABLE`, `LOW_RESOURCE_FIT`,
`LOWER_COST`, `PAST_PROJECT_SUCCESS`, `RESOURCE_INCOMPATIBLE`,
`ROLE_NOT_QUALIFIED`, `INSUFFICIENT_EVIDENCE`, …), evidence refs and
evidence-oriented confidence (`QUALIFIED · SUPPORTED_BY_LIMITED_EVIDENCE ·
EXPERIMENTAL · NO_QUALIFICATION_DATA`). Stable ordering (role score → cost →
id); **no global "best model" ranking** — recommendations are contextual.
User override is always allowed (no blocking) except technical
incompatibility/Authority/resource rules; `roleNotQualified` is a CAUTION, not
a block.

## Developer Notes — James Ferrell

`node/src/services/developer-notes.ts` — a distinct content source
(`kind: 'developer-note'`, attributed `DEVELOPER_NOTES — James Ferrell`), never
rendered as a System Advisory and never as qualification evidence. Categories:
CONTEXT · MODELS · COST · LOCAL_AI · WORKFLOW · VERIFICATION · DEBUGGING.
Seed notes cover: checkpoint-don't-stuff context, least-expensive-that-passes,
planning/implementation/review separation, smallest-quant-is-not-best,
completion-reports-are-not-verification, role-specific qualification.
Deterministic triggers (context pressure, unqualified selection, expensive-
for-routine, resource pressure) with dismissal/session suppression — no nagging.

## System Advisories

`node/src/services/system-advisories.ts` — severity-aware system facts
(`INFO · CAUTION · BLOCKING`): qualification pending, credential rotation
required, artifact hash mismatch, insufficient RAM, role not qualified,
evidence stale, runtime owned by another lane.

## Runtime Adapter boundary

`node/src/services/runtime-adapter.ts` — the stable contract every backend must
satisfy (`discover · status · load · unload · health · generate · tools ·
metrics`) plus a registry. The product decision now names **Unsloth as the
canonical local runtime**. This Model Manager consumes it only through the
RuntimeAdapter interface; runtime implementation and lifecycle remain owned by
the Unsloth lane. Alternative RuntimeAdapters are an advanced extension path,
not a normal four-backend selector. This UI does not load, unload, or generate.

## Offline-first and provider failure

Covert starts and operates with zero cloud configuration: registry loads,
local discovery works, Developer Notes work, local qualification information
works, runtime configuration works. Provider failure, expired auth, or an
unknown/disappearing provider model degrades gracefully — local models remain
available (covered by tests).

## Tests

`tests/arch/model-manager.test.ts` (11 passing): schema round-trip, availability
vs qualification independence, staleness on hash/profile/runtime change, bounded
discovery + quant detection, credential-free provider probing + offline startup,
recommendation determinism + role filtering + resource exclusion + cost
tie-break + no-ranking, notes triggers/dismissal/attribution/isolation,
advisory severities, user override semantics, public-safe serialization leak
checks.

## Operator-facing Model Manager

The existing `MODELS` cockpit panel now presents the Registry projection through
the read-only `GET /api/models/manager` contract. Views are ALL, LOCAL, CLOUD,
and MODEL PACKS. Model cards keep availability, role qualification, local/cloud
placement, offline status, estimated resource fit, runtime, artifact identity,
Capability Passport reference, and evidence references separate.

Recommendation results remain deterministic and role-scoped. A chosen model in
this panel is explicitly a **view-only override**: the current execution router
does not consume this panel selection. Unavailable, resource-incompatible, and
cloud models without authenticated provider state cannot be selected. An
installed model may remain visible with `UNTESTED`, `STALE`, or another
non-qualified state.

Model Pack cards read the existing `models/manifest.json` and reconcile it
against the Intelligence Registry; there is no second model database. They
distinguish installed artifacts, locally available artifacts, missing
dependencies, provider-required entries, and source-only candidates. Installer
actions remain disabled because a download/install service is not part of this
slice. Installation status never implies qualification. Developer Specials are
workflow recipes with no model membership asserted until evidence exists.

Developer Notes are rendered in a separately tagged/attributed section from
System Advisories. Note dismissal is session-only. Runtime status is read only;
the adapter interface currently does not expose version or ownership metadata,
so those fields correctly display as not reported.

The endpoint uses the existing central `capability.read` policy enrollment. It
does not perform cloud requests, persist discovery results, expose local paths,
or change Resource Admission, routing, Authority, or runtime state.
