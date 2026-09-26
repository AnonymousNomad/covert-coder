---
name: failure-provider-credential-mistaken-for-live-connection
description: Prevents stored provider credentials from being presented as a live-verified connection.
---

# Provider Credential Is Not Live Evidence

## Trigger

A provider status is inferred as connected merely because a credential exists, especially after process restart or probe-cache expiry.

## Recovery

1. Identify the canonical credential owner and the exact source of the status.
2. Represent credential presence as configured, not connected.
3. Require an explicit Authority-governed probe to produce live connection evidence.
4. Keep successful probe state bounded; after its validity window expires, fall back to configured.
5. Verify list/read paths never trigger network calls and probe failures never expose credential material.

## Guardrails

- Do not add a parallel provider registry or credential store.
- Do not treat an installed CLI or stored key as authentication proof.
- Do not silently retry egress during page load.
