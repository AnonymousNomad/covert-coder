# Device Agent Contract

- **Status:** DESIGN / CONTRACT ONLY. No device agent code is authorized by this document (explicitly out of lane scope).
- **Parent:** `docs/architecture/REMOTE-OPERATOR-CONTROL-PLANE.md`.
- **Canonical owner:** the device agent is an executor and state provider under the canonical control plane. Authority remains the only permission owner; the workflow/orchestrator engine remains the only transition owner.
- **Frozen references:** `docs/v1/COVERT-V1-RELEASE-CLOSURE-MATRIX.md` (C3-12 capability taxonomy, C5-19 admission gate); `artifacts/integration-certification/CAPABILITY-FABRIC-DISPOSITION.md`.

## 1. Purpose and boundary

Define the contract for a future Covert Device Agent that lets the operator run and observe Covert work on other authorized devices (and on the current Windows machine) without creating a second control system.

The agent:
- executes exact, authority-approved operations on its device;
- reports device, resource, runtime, and mission-observation state truthfully;
- provides a capability manifest for routing;
- never orchestrates, never judges completion, never mints authority, never stores canonical project truth.

### 1.1 Explicit prohibitions

- No second Orchestrator: the agent does not schedule models, assign roles, or transition missions.
- No second Authority: the agent cannot approve, widen scope, or create operations.
- No canonical truth storage: mission/project truth stays in the owning workspace (`.aide/`), not on the agent.
- No inbound listener requirement: agents initiate outbound channels (parent doc Section 17).
- No image-wide or wildcard process control; owned-process discipline applies on every device (base: `node/src/services/owned-process.mjs:4-5,45-73`).

## 2. Device identity

```ts
type DeviceRecord = {
  device_id: string;              // stable, generated at enrollment (UUIDv4 + optional SPKI fingerprint)
  display_name: string;
  platform: 'windows' | 'linux' | 'macos' | 'android' | 'ios' | 'other';
  os_version: string;             // build-level truth
  covert_version: string;         // agent version
  enrolled_at: string;
  enrolled_by_actor: string;      // operator actor that approved enrollment
  owner_actor: string;            // canonical owner; device credential belongs to this owner
  device_class: 'OWNER' | 'BOUNDED' | 'INGRESS' | 'DEVELOPMENT';
  public_key: string;             // agent public key (enrollment / attestation)
  key_protection: 'dpapi' | 'tpm' | 'os_keychain' | 'software_only';
  revoked_at: string | null;
  last_seen_at: string | null;
  status: 'ENROLLED' | 'ONLINE' | 'OFFLINE' | 'SUSPENDED' | 'REVOKED';
};
```

Rules:
- `device_id` is stable for the device lifetime; re-enrollment creates a new record and revokes the old one.
- The private key never leaves the device; it is protected with the strongest available facility (`dpapi` today on Windows; TPM-backed preferred when available).
- Revocation is an operator `revoke`-class operation; revocation kills device credentials and any live adapter binding for that device, and must be provable after restart.
- Device identity is **not** an actor identity. Authority actors authorize; devices execute. The envelope carries the device id for targeting; the operation is still bound to an actor.

## 3. Enrollment, rotation, revocation

```
enroll:      operator-approved operation device.enroll
             → device displays one-time code (out-of-band)
             → agent generates keypair locally, submits public key + code
             → control plane verifies, creates DeviceRecord(ENROLLED)
rotate:      operator-approved device.rotate (new key, old key revoked)
suspend:     operator-approved device.suspend (keeps record, refuses execution)
revoke:      operator-approved device.revoke (record REVOKED; credentials dead)
```

- Enrollment is never inferred from network reachability.
- The one-time code expires (same TTL discipline as pairings: minutes, not days).
- A device can be enrolled for one owner only; sharing is explicit re-enrollment under a new record.

## 4. Capability manifest and state reporting

Each agent maintains a capability manifest (substrate: Capability Fabric taxonomy; see the capability routing contract). A manifest entry is per device and must be truthful about its qualification:

```ts
type DeviceCapabilityEntry = {
  capability_id: string;          // stable id, e.g. 'desktop.uia.input', 'terminal.pty'
  kind: 'TOOL' | 'SKILL_PACK' | 'WORKFLOW_PACK' | 'VERIFIER' |
        'PROVIDER_ADAPTER' | 'MODEL_ADAPTER' | 'CONTEXT_PROVIDER' | 'COMPOSITE_PACK';
  version: string;
  state: 'AVAILABLE' | 'INSTALLED' | 'ENABLED' | 'PERMISSION_GRANTED' |
         'HEALTHY' | 'AUTHORIZED_FOR_OPERATION';
  platform: string;
  side_effects: 'none' | 'local' | 'external';
  idempotency: 'idempotent' | 'at_most_once' | 'non_idempotent';
  qualification_ref: string | null;   // evidence for the exact tested scope (device + version)
  last_verification_at: string | null;
};
```

Rules:
- `UNKNOWN` stays `UNKNOWN`. An unverified capability is not advertised as qualified (aligns with `CAPABILITY-FABRIC-DISPOSITION.md:7`).
- Qualification is scoped: a Windows UIA picker claim is scoped to the exact tested dialog classes on the tested OS build (C4-20 evidence discipline).
- Capability version drift invalidates qualification; the router must refuse stale manifests for consequential classes.

## 5. State report schema

```ts
type DeviceStateReport = {
  device_id: string;
  reported_at: string;
  online: boolean;
  session: { user: string; interactive: boolean } | null;   // interactive desktop session matters for GUI ops
  resources: {
    free_memory_mb: number | null;      // null = unknown; never guessed
    gpu_free_mb: number | null;         // null when unprobeable
    load_1m: number | null;             // null on platforms without load average
    disk_free_mb: number | null;
    cpu_count: number;
  };
  desktop_availability: 'AVAILABLE' | 'SESSION_LOCKED' | 'NO_INTERACTIVE_SESSION' | 'UNKNOWN';
  runtime_availability: { model_runtime: 'READY' | 'STOPPED' | 'STARTING' | 'UNKNOWN' };
  network_posture: { local_only: boolean; adapters: string[] };
  current_mission_ref: string | null;
  approved_roots: string[];
  registered_apps: string[];
  health: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';
};
```

Rules:
- Report what is measured; `null`/`UNKNOWN` for what is not.
- Device state is advisory input to routing and status; it never substitutes for Authority decisions or admission.

## 6. Execution boundary

- The agent receives an exact operation (canonical descriptor + digest + `operation_id`) through the control plane and returns a typed result with a receipt.
- It may refuse (`DEVICE_OFFLINE`, `SESSION_LOCKED`, `CAPABILITY_UNAVAILABLE`, `QUALIFICATION_EXPIRED`) without side effects; refusals are recorded.
- It must not accept free-form commands, must not interpret text as instructions, and must not chain capabilities on its own initiative.
- Process control on the device follows the owned-process discipline: exact retained handles, no image-wide sweeps, honest `unconfirmed` when a kill cannot be proven.
- Admission (C5-19) gates any start that consumes significant resources; the agent reports the resource truth the admission service needs.

## 7. Multi-device model (contract only)

| Device class | Examples | Allowed by policy (default) |
|---|---|---|
| OWNER | primary laptop (Windows) | full capability set within policy; strongest device identity |
| BOUNDED | tablet/Android | read/status, notifications, bounded tasks; no privileged control |
| INGRESS | phone | submit requests, receive notifications, approve where policy allows; no execution |
| DEVELOPMENT | future workstation (Linux) | development capabilities (build/test/git), scoped roots |

Constraints:
- One operator may own many devices; missions are bound to a target device at creation.
- Cross-device conflict is resolved by the canonical mission store (single transition owner), never by last-writer-wins.
- An INGRESS device never executes capabilities; it only carries the envelope.
- A BOUNDED device's manifest is smaller by contract, not by trust in its network location.

## 8. Transport

- Device-initiated outbound channel; no requirement for an inbound port (parent doc Section 17).
- The channel carries: envelopes (device → control plane), operation deliveries (control plane → device), receipts (device → control plane), notifications (control plane → operator channels, not necessarily through the device).
- Reconnect behavior: dedupe by `request_id`/`operation_id`; no re-execution; state reconciliation precedes retry.
- Local-Only ON disables non-local transports entirely; agents report `OFFLINE` truthfully.

## 9. Windows specifics (current V1 platform)

- The interactive desktop and GUI capabilities require a user session; a service-context component cannot perform UIA input. If a service component is ever added, it must not claim desktop availability it does not have.
- Secret protection uses DPAPI `CurrentUser` today (`node/src/services/secret-store.mjs:5-22`); TPM-backed keys preferred when available.
- The existing Desktop Control and UIA executors are the reference implementation of the device's GUI capability; the device agent wraps the same authority and owned-process discipline rather than duplicating or bypassing it.
- Session lock/unlock is a state transition that must be reported (`desktop_availability: SESSION_LOCKED`); queued GUI operations are refused or held, never executed into a locked desktop.

## 10. Verification requirements

- Enrollment: device can enroll only with an operator-approved operation and a valid one-time code; expired code refused; revoked device cannot reconnect.
- Identity: device keys never leave the device; the control plane can prove which device executed an operation.
- Truthfulness: state report `null`/`UNKNOWN` values are preserved end-to-end (no fabricated zeros).
- Execution: agent executes only exact operations; forged/expired operations are refused with no side effects.
- Process discipline: no image-wide termination; owned handles only; honest `unconfirmed`.
- Reconnect: duplicate deliveries do not re-execute; reconciliation is observable in receipts.
- Local-Only: with Local-Only ON, the agent transport is unavailable and reports it truthfully.
- Scope: a BOUNDED device cannot execute OWNER-class operations even with a valid operator approval.

## 11. Open decisions

1. Device key root on Windows: DPAPI vs TPM (recommend capability detection with TPM preference).
2. Whether the first device agent is an evolution of the desktop shell process or a separate supervised process (recommend: separate, supervised by the local control plane, sharing the same Authority).
3. Device-level retention of recent receipts (recommend: hashes only, bounded ring, canonical receipts stay in the workspace).
