---
name: covert-windows-cumulative-stability
description: Diagnose failures that emerge only in long Windows test runs or sustained Covert operation. Use when isolated tests pass but cumulative suites time out, leak resources, or become order-dependent.
---

# Covert Windows cumulative stability

## Objective

Classify and repair cumulative failures instead of accepting isolated green reruns as proof of full-suite stability.

## Suspect classes

Investigate with evidence, not assumption:

- leaked child process or server;
- leaked socket/listener/port;
- file handle or temporary directory leak;
- event listener/timer/AbortController leak;
- test-order/global-state contamination;
- request queue or event-loop starvation;
- memory/commit growth;
- VRAM/local-model pressure;
- ephemeral-port/TIME_WAIT pressure;
- filesystem latency, E:-drive behavior, antivirus/indexing contention;
- database/file lock accumulation;
- fixture shutdown race;
- concurrency limits or unbounded retries;
- harness timeout that masks a slower product lifecycle;
- external environmental interference.

## Measurement plan

1. Establish a clean baseline before the full run: process tree, memory, commit, handles if available, listening ports, owned temp directories, node/edge/python/model processes, relevant file sizes, and free disk.
2. Divide the architecture battery into logical groups without changing assertions. Capture the same resource snapshot after each group.
3. When failure begins, identify the earliest abnormal resource/state trend rather than only the final timed-out test.
4. Re-run the failing test alone and after the smallest predecessor set that reproduces the failure.
5. Use repetition to establish whether the sequence is deterministic or stochastic. Record run counts; do not cherry-pick one pass.
6. Inspect cleanup ownership for every service/process started by the reproducing predecessor group.
7. Repair the leak/state defect or classify an actual environment limitation. Do not simply increase global timeouts unless measurements prove a legitimate supported-duration requirement.
8. Re-run focused reproduction, predecessor sequence, full cumulative suite, and exact-SHA CI.

## Minimum evidence

For each run record: source SHA, test order/group, start/end time, pass/fail/skip counts, failure names, free physical RAM, free commit, relevant process counts/PIDs, owned listeners/ports, temporary resources, and cleanup result.

When available, record handle counts or equivalent diagnostics for suspect processes.

## Acceptance

Full cumulative stability is green only when the declared full suite completes successfully under the supported environment with owned resources cleaned. Isolated reruns remain supporting evidence, not replacement evidence.
