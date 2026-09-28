# Covert harness comparison audit — 2026-09-27

## Current question

The first comparison must isolate a defined part of Covert and keep the model, task, runtime, decoding settings, token cap, and machine fixed. A score from one successful chat is a smoke test, not evidence that Covert improves models generally.

## Verified project behavior

- The shipped UI sends chat through the local facade on port 4777 to the typed backend. The canonical POST /api/chat route uses the Chat Context Composer and has an Authority gate.
- In that route, harness=false bypasses the entire context augmentation package. The enabled package can include the versioned scaffold, learned preferences, memory blocks and recall, workspace retrieval, and Resident or Skill advisory text. A comparison on that route would measure this combined package.
- Agent mode is a separate path. It adds tool grammar, Execution Authority, attempt tracking, and Veritas checks. The chat toggle does not switch all of those components on and off.
- Therefore, the new runner measures only the core prompt scaffold. It composes the current scaffold with the same production functions, then compares the exact same messages against a local model endpoint with the scaffold omitted. It does not claim to measure the full agent harness or every context feature.

## Problems in the historical battery

The prior scripts/run-harness-battery.mjs declared ten task prompts and duplicated them to report twenty tasks. Several graders accepted substrings rather than correct outputs, the injection task had no forbidden value, and the report path overwrote the previous raw JSON. Its printed denominator was hardcoded.

The two dated Markdown reports preserve historical observations, but their scores do not support a current comparative claim. The separate benchmarks/run.mjs suite is also a smoke suite with shape checks, not a paired harness ablation.

## Work completed

- Added a locked ten-prompt suite: nine small JavaScript function tasks with behavior cases, plus one synthetic canary non-disclosure task.
- Added strict response grading. Function responses are checked across multiple cases with bounded VM execution; Markdown code fences fail the requested format. Canary scoring tests only the exact synthetic token.
- Rebuilt the runner around one local OpenAI-compatible completion endpoint. It rejects non-loopback destinations, pins the scaffold version and source fingerprints, fixes temperature at zero, requests one completion, pairs identical task messages, balances ON-first and OFF-first order, does not retry, captures latency and token usage, and writes a unique evidence file without overwriting.
- Added a focused package command named test:harness-battery.
- Added unit tests for grader behavior and a local HTTP fixture that checks one ON and one OFF request per task, identical task prompts, balanced order, and evidence output.

## Verification completed

The focused run passed:

- Grader unit tests: 6 passed, 0 failed.
- Local endpoint fixture: 10 unique prompts, 20 paired calls, balanced order, and no model server started.

The fixture response is intentionally not treated as model evidence.

## Live-run status

No model inference ran in this audit. A fresh laptop sample showed 6.54 GiB free RAM, 5.09 GiB free commit, and a GTX 1060 with 994 MiB used and 4% utilization. The project admission floors are 6.5 GiB RAM, 5 GiB commit, and 4.5 GiB free VRAM. RAM and commit had only about 0.04 GiB and 0.09 GiB of margin. The previously measured runtime startup cost was larger than those margins, so starting a model could push the machine below its admission floor. Edge and Godot sessions were left running.

## Remaining work

1. Run this suite against the same loaded local model three or more times per task after the runtime can start while retaining admission headroom. Record the exact weights SHA-256, runtime name/version, scaffold context size, hardware, source revision, and raw report.
2. Repeat the same suite on each additional local model. Treat every model as a separate result row with its own weights and runtime fingerprints.
3. Add a separate adapter and verification method for another harness before claiming a cross-harness result. It must hold prompts, model weights, runtime, tools, token limits, decoding, and hardware constant where possible. Report any non-equivalent settings.
4. Build a separate agent-harness coding benchmark if the intended claim is about tools, Authority, workflow, or Veritas. The current suite does not evaluate those capabilities.
5. Review paired task outcomes across a larger, independently authored task set before making a general effectiveness claim. The ten-task suite is a local pilot and its repeated trials are clustered by prompt.

## Scope and limits

All benchmark endpoint traffic is restricted to loopback. The task suite and synthetic canary contain no user data. If a future model run occurs, its raw output will be stored in the evidence JSON. The current grader executes raw task code in node:vm on the benchmark host. Node's official documentation states node:vm is not a security mechanism and must not be used to run untrusted code: https://nodejs.org/api/vm.html. Node's Permission Model also explicitly does not provide security guarantees against malicious code: https://nodejs.org/api/permissions.html. Therefore the unit tests and local fake-endpoint fixture validate deterministic grading mechanics only; they do not authorize live model-output execution on the host. Block the real pilot until generated code is run inside an OS-level isolated worker with no access to host files, credentials, network, or user processes, or a non-executing grader with equivalent deterministic semantics is established. No cloud provider, external API, competitor service, GitHub operation, commit, or push was used for the original audit.
