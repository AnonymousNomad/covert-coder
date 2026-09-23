# Model Connection UX

Status: **PRODUCT CONTRACT / DESIGN ONLY**

## UX promise

Covert lets a new user begin locally, connect an account when they choose, or
try a currently available free path without requiring provider expertise.

```text
LOCAL BY DEFAULT
CONNECTED BY CHOICE
ONE PROVIDER-NEUTRAL WORKER CONTRACT
ONE AUTHORITY BOUNDARY
ONE VERIFICATION STANDARD
```

The UI must never turn a credential presence, catalog entry, or provider brand
into a green `READY` claim.

## First-run choice

After the welcome/readiness screen, show four clear paths:

```text
[ Use Local Models ]
[ Connect an Account ]
[ Try Currently Free Models ]
[ Advanced / Manual Setup ]
```

No path is mandatory. The local path remains usable when all network access is
disabled. The free path is labeled `CURRENTLY FREE` and displays provider
limits; it never promises permanent free service.

## Connections screen

Primary view:

```text
MODEL CONNECTIONS

Local Models       AVAILABLE / ACTION REQUIRED / OFFLINE
OpenCode           CONNECTED / SIGN IN REQUIRED / UNAVAILABLE
OpenCode Go        AVAILABLE THROUGH OPENCODE / NOT CONNECTED
OpenRouter         CONNECT / CONNECTED / RATE LIMITED
GitHub Copilot     CONNECT / CONNECTED / PLAN LIMITATION
OpenAI API         CONNECT / CONNECTED / AUTH EXPIRED
Codex / ChatGPT    CONNECT THROUGH OFFICIAL CODEX PATH
Anthropic API      CONNECT / CONNECTED
Claude Code        OFFICIAL BRIDGE ONLY / NOT SUPPORTED
Hugging Face       CATALOG / OPTIONAL AUTH
ModelScope         CATALOG / OPTIONAL AUTH
Ollama             LOCAL RUNTIME / NOT DETECTED
Custom Endpoint    MANUAL / HOST APPROVAL REQUIRED
```

Each row shows:

```text
status
connection class
credential owner
placement: local / direct remote / delegated remote
last verified
safe capabilities discovered
models available count, or UNKNOWN
```

`CONNECTED` means the connection probe succeeded for the stated scope. It does
not mean that every listed model is startable, tool-capable, affordable, or
accepted for a role.

## Provider detail before connect

Every provider detail view must answer:

```text
WHAT IT PROVIDES
HOW AUTHENTICATION WORKS
FREE / PAID / SUBSCRIPTION / LOCAL
WHERE COMPUTE RUNS
WHETHER NETWORK IS REQUIRED
WHAT COVERT CAN ACCESS
WHAT COVERT CANNOT ACCESS
WHO OWNS THE CREDENTIAL
HOW TO DISCONNECT / REVOKE
CURRENT LIMITATIONS
```

The UI uses provider-supplied facts and safe static copy. It does not infer
subscription rights from a provider name.

## Connection flow

```text
select provider
→ show auth method and data boundary
→ browser/device/API-key/delegated flow
→ return to Covert
→ verify connection
→ discover models/capabilities
→ show exact status and limitations
→ offer Standard Harness or optional Harness Sync
```

For a raw API key, entry is masked, never echoed into logs, and passed directly
to the secure store. The success view displays an opaque reference such as
`credential owner: COVERT_SECURE_STORE`, never the secret.

For delegated OpenCode access, Covert shows `credential owner: OPENCODE` and
uses OpenCode's supported auth flow. It does not open or import OpenCode's
credential store.

## Model discovery and acquisition

Discovery cards show:

```text
model ID and exact revision
source/provider
license and attribution reference
artifact size
quantization
estimated RAM/VRAM
context/output limits
tool/structured-output/reasoning capability
hash or integrity status
Harness qualification: NONE / SYNCED / EXPIRED / UNKNOWN
```

Download flow:

```text
inspect metadata/license
→ choose revision/quantization
→ show required resources
→ download to bounded model directory
→ verify expected hash when supplied
→ register without executing downloaded code
→ runtime probe
→ optional Harness Sync
```

If license or hash data is missing, the UI says `NOT_RECORDED` and does not
present the model as a recommended bundled artifact.

## OpenRouter free-model lab

This is a bounded optional experience:

```text
Connect OpenRouter
→ fetch current model catalog
→ filter models currently marked free
→ show limits, fallback/routing behavior, identity and timestamp
→ user selects exact model
→ run Standard or optional Harness Sync
→ record exact model/provider fingerprint
```

Do not calibrate `auto`, `free`, or another rotating alias as though it were a
stable model. If the provider cannot return a stable identity, Sync is disabled
for that entry and Standard mode remains available.

## Harness Sync invitation

After a model is discovered and before first use:

```text
NEW MODEL DETECTED

Harness Sync is recommended. Covert can run a short calibration to learn how
this exact model/runtime handles context, tools, compound requirements,
recovery, Skills, and verification-sensitive claims.

[ Run Harness Sync ] [ Use Standard Harness ]
```

Use the wording `Optimize Covert for this model`, never `optimize the model`.
The user can switch back to Standard mode and can inspect Passport evidence.

## Worker availability view

After discovery, show a truth table rather than a single “connected” badge:

```text
ACCESS        connected / unavailable
MODEL         discovered / missing
RUNTIME       startable / failed / not applicable
RESOURCES     admitted / refused / unknown
HARNESS       standard / synchronized / expired
AUTHORITY     governed
VERITAS       required
```

This is especially important for hybrid operation:

```text
Resident: local
Planner: remote delegated
Coder: local
Reviewer: remote direct
Execution: governed and local to the workstation
```

Remote model placement must not imply remote execution authority.

## Preferences

Preferences are explicit routing constraints:

```text
OFFLINE ONLY
LOCAL PREFERRED
FREE ONLY
NO PAY-PER-TOKEN
SUBSCRIPTION ONLY
ALLOW PAID API
MAX COST PER MISSION
PROVIDERS ALLOWED
PROVIDERS BLOCKED
```

The UI explains that preferences may make a task unavailable. They never bypass
Resource Admission, Authority, or Veritas.

## Failure UX

| Failure | User-facing truth | Next action |
|---|---|---|
| credential missing | `SIGN IN REQUIRED` | start the provider's official flow |
| callback expired | `AUTHENTICATION EXPIRED` | restart the flow; discard pending state |
| key rejected | `INVALID CREDENTIAL` | replace/revoke through provider; do not retry blindly |
| provider rate limit | `RATE LIMITED` | show retry window if known; choose another permitted path |
| provider unavailable | `UNAVAILABLE` | retry health probe or use local/other connection |
| catalog entry missing | `MODEL NOT DISCOVERED` | refresh provider catalog |
| runtime missing | `RUNTIME NOT READY` | install/configure official local runtime |
| resource refusal | `NOT ADMITTED ON THIS MACHINE` | reduce concurrency/model or choose another model |
| license unknown | `LICENSE NOT RECORDED` | inspect source before acquisition |
| Harness Sync insufficient | `SYNC INSUFFICIENT EVIDENCE` | use Standard mode or rerun with explicit consent |
| egress denied | `NETWORK ACCESS NOT APPROVED` | review egress consent/allowlist; local mode remains available |
| disconnected during mission | `PROVIDER DISCONNECTED` | preserve attempt truth; do not silently replay mutation |
```

## Disconnect and revoke

Disconnect confirms scope:

```text
Remove Covert's stored credential reference
Revoke delegated connection if supported
Stop new routing through this connection
Keep historical mission/provider facts
```

No disconnect action deletes provider accounts, local model files, or verified
project truth without a separate, governed operation.

## Accessibility and trust

Status is conveyed by text and accessible labels, not color alone. Every status
has a detail/reason field. Focus order follows the connection flow. Secrets are
never shown in screenshots, debug views, empty-state examples, or support
bundles.

## Release classification

```text
REQUIRED FOR CONNECTION V0.1:
local view, existing direct-provider view, OpenCode bridge status, secure
credential references, model identity projection, local-first preferences,
truthful failure states.

BETA:
device/OAuth flows beyond existing delegated support, free-model lab,
revision-pinned acquisition UI, Passport invitation.

POST-RELEASE:
automatic model packs, autonomous provider switching, recommendation automation,
marketplace, bundled third-party weights.
```
