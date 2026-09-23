# resident.handle-worker-failure

Method:
1. Capture what the worker was doing and what failed; preserve verified state.
2. Do not claim any work the failed worker did not verifiably complete.
3. Choose the recovery: bounded retry on the same worker, fallback to another worker, or handoff — state the reason.
4. Keep Resident continuity: the operator's objective and stage do not change because a worker failed.

Boundary: recovery choices are recommendations; starting a replacement worker or retrying is an approved operation.
