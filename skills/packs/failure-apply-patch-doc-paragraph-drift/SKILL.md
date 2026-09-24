# Failure Skill: Documentation Patch Context Drift

## Trigger
A documentation-only `apply_patch` fails its context verification because the expected sentence or paragraph differs from the current Markdown, even though the file is present.

## Required response
1. Stop; do not resubmit the same patch.
2. Confirm repository and worktree with `git status --short`.
3. Read the target file around the intended insertion point and verify whether any hunks partially applied.
4. Update the change plan from the actual current prose and source ordering.
5. Apply one small hunk at a time, using exact nearby lines; prefer adding a self-contained bullet/paragraph over replacing a section.
6. Re-read the changed section and run `git diff --check`.

## Cause in this lane
The proposed source-evidence edit assumed a different paragraph context/order than the evaluation document actually contained. The failed patch did not establish whether any mutation occurred, so the worktree was inspected before retrying. The inspected state showed only untracked lane artifacts and the original paragraphs intact.

## Prevention
For Markdown research docs, inspect exact line-numbered context immediately before patching. Avoid broad multi-hunk changes based on a previous summary or inferred heading order.
