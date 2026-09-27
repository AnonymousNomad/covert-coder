# resident.handle-tool-failure

Method:
1. Read the tool's actual error; do not generalize it into a vague failure.
2. Check whether the tool is available in the canonical registry before retrying.
3. Choose an alternative tool with equivalent effect, or escalate if none exists.
4. Do not silently degrade the assignment's verification standard to make a tool work.

Boundary: replacing a tool does not relax the gates; the same evidence standard still applies to the outcome.
