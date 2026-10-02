# Prepared adapter request input - 2026-10-02

Status: **LOCAL VERIFIED; publication and exact-SHA CI pending**.
Parent: f51513a6736505c23ca1638f5d5b59aa023b1444; AIDE36971389714 SUCCESS, all23steps.

## Root cause and repair

Router prepared input is independently serialized and can change on a Runtime
HTTP400 retry or Anthropic role framing. An actual controlled HTTP/fetch probe
produced8mission requests and0adapter observations. Existing Runtime and
Provider owners now serialize once, emit an awaited strict scalar observation,
and send exactly those bytes. Request index distinguishes original/retry.
The current Router revalidates bound target; AgentLoop persists
MODEL_ADAPTER_INPUT_PREPARED through existing AttemptJournal with attempt,
session and iteration correlation and rechecks Authority actor/cancellation.
Provider rechecks current egress before dispatch. No parallel owner/executor,
ledger, HTTP-supplied callback or public response migration is introduced.
The observation stores SHA256/UTF8 byte count, scope, protocol, adapter,
requested model, exact route/revision, stream and request index; no raw body,
authentication header, key, prompt or reasoning is stored by this addition.

## Regression and proof

Original18adapter tests all failed before repair. A fixture-only HTTP namespace
shadowing caused5governed failures. Broader affected tests then exposed a
legacy cancellation regression: the optional helper checked abort even when
no observer existed. Early return for absent observers preserves that path;
the original Provider cancellation assertion remains unchanged. Added observed
pre-cancelled chat/stream tests require zero callbacks and zero mission fetch.
All original red logs are retained and hashed in the companion receipt.

Affected212/212 pass, including20new direct adapter cases and5new governed
adapter cases. Controlled actual Runtime HTTP/Provider fetch proves byte
equality, HTTP400 retry identities, latest-task preservation, Anthropic framing,
mutation safety, persistence refusal/cancellation/egress revocation boundaries.
Actual HTTP Authority/Router/AgentLoop/Runtime/Journal proves durability before
mission body arrival, recovery read, immutable admission, correlation and no
late request on write failure/cancellation/actor or exact-target revocation.
Node/browser type checks, scoped lint, contracts and unchanged C1 checks pass.
Complete original Veritas6/6true; Windows architecture958/947/0/11/0.
Original npmtestchain passes. Full publication hook and exact-SHA CI follow.

## Limits and next dependency

ADAPTER_REQUEST_INPUT means prepared request bytes; it does not prove server
receipt, actual tokenizer use, response-observed model, successful inference,
model qualification or which selected context/skill bytes fully survived.
OpenCode managed task input remains NOT_RECORDED in this bounded scope.
No whole Resident18/R11/R12, live model/provider role, fresh-user/dogfood or RC
acceptance is claimed. Historical gate timeouts and dependency warning remain
open. Admission6656MiBphysical/5120MiBcommit, Authority, tests and deadlines
are unchanged. No actual local model start or foreign process termination.
Themes remain paused; locked package/references/Lab retained; PR31 frozen.
Next after green publication: OpenCode managed input evidence in its current
bridge, then response-observed identity and actual selected context/skill proof.
