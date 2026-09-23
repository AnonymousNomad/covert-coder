# resident.construct-workflow

Method:
1. Decompose the job into stages with explicit inputs, outputs and gates.
2. Reuse canonical stages and gates wherever an existing workflow covers part of the job.
3. Keep the composition minimal: no invented stages that no verifier can check.
4. Present the composed workflow for approval before it is used.

Boundary: composing a workflow is planning, not permission. Each proposed step remains subject to authority and verification when it runs.
