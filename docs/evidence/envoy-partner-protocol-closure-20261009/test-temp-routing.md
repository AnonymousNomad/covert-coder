# Test Temporary Path Exception

- The first focused Partner test run completed 10 passed, 0 failed, 0 skipped. After adding the device-ID proof case, the C:-routed final run completed 11 passed, 0 failed, 0 skipped.
- After that run, inspection showed the inherited `TEMP` and `TMP` values were `E:\pip_temp`, and Node `os.tmpdir()` resolved to the same path.
- The Partner tests create temporary workspaces through `os.tmpdir()`. Therefore this focused run created test fixture files on E: and executed each test's cleanup path. The suite passed, but residual cleanup was not independently inspected because E: is now read-only for this mission.
- This was an environment-routing error. E: remains off limits for active work. Every later test run was preflighted to `C:\CovertPartnerProtocol-temp-20261009`; the final 70-test core rerun shows only C: fixture paths and removes the capability-authority workspace.
- The C: worktree and C: npm cache were not redirected. No production source file was changed by the focused run.
- The later 70/70 core regression run also exposed one explicit Windows test root in `tests/arch/capability-authority.test.ts`; its output records `E:\pip_temp\opencode\phase2a-authority-gr9zag`. The test closes its servers but does not remove that fixture directory. Its residual contents are therefore UNKNOWN and were not inspected or cleaned because E: is read-only for this mission.
- The core suite's inherited-temp fixtures did resolve to `C:\CovertPartnerProtocol-temp-20261009`; only the explicit hard-coded fixture escaped that override.
- The task-owned C: temporary root remains after verification. The cleanup command was rejected before launch by the command policy because it requested recursive cleanup through a computed target; it was not retried. A read-only process check found no active Node command referencing that root. The root is retained.

This note records the exception; it does not claim E: remained untouched.
