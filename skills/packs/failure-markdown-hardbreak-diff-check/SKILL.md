# Failure Skill: Markdown Hard Breaks Fail Git Whitespace Check

## Trigger
`git diff --check` reports trailing whitespace on Markdown lines that use two spaces to request a CommonMark hard line break.

## Required response
1. Treat the check as failed even when the spaces were intentional.
2. Keep the content and remove the trailing spaces.
3. Use a blank line, list, or separate blockquote paragraph when visual separation is needed.
4. Re-stage the changed file and rerun `git diff --cached --check`.

## Cause in this lane
The research-doc headers and a Developer Note attribution used Markdown hard-break spaces. Git treats those spaces as trailing whitespace and rejected the staged diff check.

## Prevention
Do not use trailing spaces for Markdown layout in versioned docs. Prefer explicit paragraph/list structure.
