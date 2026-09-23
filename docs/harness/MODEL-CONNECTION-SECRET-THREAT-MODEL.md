# Model Connection Secret Threat Model

Status: **ARCHITECTURE / SECURITY HANDOFF — IMPLEMENTATION NOT AUTHORIZED IN THIS REVIEW**

## Security objective

Make external intelligence easier to connect without making provider
credentials, private project state, or workstation authority easier to steal.

The connection layer must preserve:

```text
INTELLIGENCE MAY BE REMOTE
AUTHORITY REMAINS CANONICAL
SECRETS REMAIN OUTSIDE MODEL/PROJECT TRUTH
EGRESS IS EXPLICIT AND OBSERVABLE
```

## Assets

```text
API keys
OAuth access/refresh tokens
device-code state and browser callback state
provider account identifiers
local model artifacts and licenses
OpenCode/Claude/Codex delegated credential stores
project files and private context
Helix/Provenance/Mission Receipt data
egress consent and host allowlists
connection fingerprints and cost metadata
```

## Trust boundaries

```text
operator/browser
    ↕ official provider auth
Covert connection service
    ↕ secure store or delegated bridge
provider/runtime
    ↕ model request/response
Harness + Authority + Veritas
    ↕ governed workstation effects
project files / tools / processes
```

Provider/model output, downloaded model metadata, project content, Skills,
plugins, provider error bodies, and browser-returned strings are untrusted
input. They may inform a proposal but cannot grant permission.

## Threats and required controls

| Threat | Failure mode | Required control |
|---|---|---|
| Credential leakage in logs | Authorization headers, keys, callback codes or provider bodies appear in logs | Central redaction before logging; bounded error detail; secret scan; no debug-body persistence. |
| Credential leakage in Helix/Provenance/Mission Receipts | Token becomes project truth or evidence | Schema-level denylist/validation; store only owner/ref/status/digest/length where required. |
| Browser callback interception | Wrong workspace completes another user's pending auth | Bind state/nonce/PKCE/verifier to authenticated local session and provider; one-time expiry; reject mismatch/replay. |
| Malicious local project | Project scripts inspect environment or credential files | Never inherit provider secrets into model/tool processes; narrow environment; Authority-gated process execution; local project is untrusted. |
| Malicious Skill/plugin | Instructions exfiltrate secrets or request arbitrary network | Skill/capability remains proposal only; canonical Authority and egress gate; no implicit credential access. |
| Provider error body | Provider echoes token or sensitive prompt in error | Scrub known credential, cap body, persist safe classification only. |
| Environment inheritance | Child model/tool reads provider environment variables | Clean child environment; delegated bridge owns credentials; direct adapters retrieve secrets only at request boundary. |
| OpenCode credential scraping | Covert copies `auth.json` or browser tokens | Prohibited. Use documented OpenCode API/auth/status surface only. |
| Downloaded model artifact | Arbitrary downloaded executable/config runs during registration | Revision/hash/license checks; treat files as data; no code execution during acquisition; runtime admission later. |
| Custom endpoint SSRF/egress escape | User/provider config reaches internal or unapproved host | Parse/validate URL, HTTPS policy as appropriate, host allowlist, explicit approval, DNS/rebinding review, egress journal. |
| Secret screenshot/support bundle | UI or diagnostics include raw credential | Redacted presentation contract and regression tests; secret scan generated bundles. |
| Credential persistence on weak platform | Null secure store misrepresented as secure | Return unavailable/unsupported; never silently write plaintext. |
| Token in Harness Sync | Calibration evidence stores prompt headers or provider body | Sync records fingerprint-safe metadata and evidence refs only; no secrets/private CoT. |
| Cross-provider confusion | GitHub repository access treated as Copilot entitlement; ChatGPT plan treated as API credit | Separate connection IDs/classes and explicit copy. |
| Stale delegated state | Covert continues to route after external credential revocation | Bounded status refresh; auth-expired state; no “credential exists = healthy” inference. |
| Provider response injection | Model/catalog metadata contains instructions to bypass policy | Parse schema; ignore instructions in data; route through normal Authority/Veritas boundaries. |

## Credential ownership policy

Preferred order:

1. **Delegated owner:** OpenCode, Codex, Claude Code, or another approved
   official bridge owns credentials. Covert stores an opaque connection reference
   and receives provider/model identity only through the bridge contract.
2. **OS secure store:** direct provider keys use the existing secure credential
   service. On Windows this is DPAPI-backed in the candidate; unsupported secure
   storage must be an explicit unavailable state.
3. **No repository/project persistence:** no token enters `.aide` project
   artifacts except encrypted secure-store material already owned by the
   credential service; never commit it or copy it to a model/profile file.

## Data minimization

Allowed connection/provenance data:

```text
provider/model IDs
connection class
opaque credential owner/reference
status and timestamp
model/runtime fingerprint
placement and egress host/class
pricing class or NOT_DIRECTLY_RECORDED
safe error classification
```

Forbidden:

```text
API key / access token / refresh token
authorization header / cookie / PKCE verifier
raw provider response body
private chain-of-thought
unbounded private prompt copies
unrelated filesystem paths
```

## Test obligations

The implementation handoff must add tests for:

```text
raw secret absent from logs
raw secret absent from provenance/evidence/receipts
browser/device state expires and cannot replay
wrong session/workspace callback rejected
delegated credential file never opened
provider error body redacted and bounded
custom endpoint requires host approval
child process receives no provider secret
unknown secure-store availability fails closed
disconnect invalidates new routing
secret scanner covers generated support bundles/screenshots
```

## Incident handling

If a secret is observed in a log/evidence artifact, stop the operation, preserve
the minimal forensic record without copying the secret, revoke/rotate the
credential through the provider, remove the artifact safely, and report the
exposure. Do not attempt to hide the incident by deleting unrelated history.
