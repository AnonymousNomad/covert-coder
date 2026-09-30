---
name: covert-live-provider-qualification
description: Qualify one exact provider/model route end to end with governed execution, failure handling, durable evidence, and restart recovery. Use only after owner-managed auth and spend boundaries are available.
---

# Covert live provider qualification

## Objective

Establish support for one exact Provider x Model x Capability route. Catalog discovery, authentication presence, or one successful response is insufficient.

## Preconditions

- Exact provider/account connection identified.
- Exact provider model ID identified.
- Credential source reference established without exposing secret contents.
- Existing spend ceiling/paid-call authority resolved.
- Local/cloud privacy policy and egress consent satisfied.
- Authority and Resource Admission boundaries active.
- Cancellation and timeout ownership defined.

If any required precondition is absent, keep the route `BLOCKED` or `UNKNOWN` and continue independent work.

## Qualification sequence

Execute in this order and preserve the same target identity throughout:

`discover -> exact-model verify -> select -> authorize -> admit -> execute -> first delta -> terminal success -> receipt -> cancel -> timeout -> provider error -> cleanup -> restart -> reverify if required -> execute same identity -> recover receipt/state`

Do not skip directly from discovery to execution acceptance.

## Evidence required per stage

- logical model identity;
- exact `provider_model_id`;
- provider/account connection identity;
- credential reference/source, never plaintext;
- adapter implementation/version or source fingerprint;
- Authority operation/decision;
- Admission decision/resource state where applicable;
- request scope and capability under test;
- first streamed delta or equivalent response proof;
- terminal event and final status;
- durable Mission Receipt/attempt evidence;
- cancellation ownership and provider cleanup;
- timeout terminal state and cleanup;
- provider-side error mapping without false success;
- restart/recovery behavior;
- any observable accounting/usage metadata available without expanding scope.

## Failure requirements

1. Caller cancellation reaches the owned provider request and cleans owned resources.
2. Timeout yields one terminal failure path, no later success, and no orphaned process/session.
3. Provider error is preserved distinctly from cancellation, timeout, Authority denial, Admission denial, and local cleanup failure.
4. Cleanup failure cannot be overwritten by a successful-looking terminal event.
5. Stale exact-model verification cannot dispatch.
6. Missing exact model cannot fall back to another model.
7. Restart does not silently preserve stale verification if the contract requires re-verification.

## Acceptance

Qualify capability by capability. Text streaming does not automatically qualify tools, vision, structured output, reasoning, embeddings, or any other provider feature.

Record fixture evidence separately from live evidence. A live test proves only the exact provider/model/capability/environment tested.
