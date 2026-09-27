# resident.select-workflow

Method:
1. Classify the work (software build, bug repair, model training, website production, audit, other).
2. Match the class against the canonical workflow bundles and their validation state.
3. Prefer an installed, validated bundle; if none fits, hand off to resident.construct-workflow.
4. Report the selection and why it fits; the operator confirms before execution.

Boundary: selecting a workflow does not authorize any step inside it. Execution Authority gates every mutating action separately.
