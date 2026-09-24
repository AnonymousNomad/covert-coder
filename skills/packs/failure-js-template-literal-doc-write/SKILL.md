---
name: failure-js-template-literal-doc-write
description: Prevent JavaScript template-literal parsing failures when writing Markdown that contains backticks through functions.exec.
---

# JavaScript template-literal quoting failure

## Observed signature

functions.exec reports a JavaScript SyntaxError such as Unexpected identifier before a nested filesystem tool runs. The attempted document or patch was not applied.

## Diagnosis

An unescaped Markdown backtick inside a JavaScript template literal closes the JavaScript string early. This is a wrapper construction failure, not a patch parser or repository failure.

## Procedure

1. Stop after the first syntax error. Do not repeat the same wrapper unchanged.
2. Confirm the error occurred before the nested tool invocation and inspect repository status for partial writes.
3. For long Markdown containing backticks, use a quoted JavaScript string assembled from escaped lines, or a writer that encodes the content without treating Markdown as JavaScript syntax.
4. Invoke the filesystem tool once with the corrected payload.
5. Read back every file and verify status and diff before continuing.

## Evidence boundary

In the 2026-09-24 runtime-lab session, a JavaScript template literal containing Markdown backticks failed with SyntaxError before apply_patch ran. No documentation files were created by that call. This procedure addresses that observed wrapper error only.
