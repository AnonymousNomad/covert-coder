---
name: failure-runtime-doc-trailing-whitespace
description: Avoid Markdown hard-break spaces that fail repository whitespace validation.
---

# Runtime Documentation Trailing Whitespace

## Finding

`git diff --check` rejected two Markdown lines that used trailing spaces to force a hard break. The content was valid, but the repository check treats trailing spaces as an error.

## Recovery

Use a blank line between paragraphs or a list/table for separation. Do not add trailing spaces to force Markdown rendering. Inspect the changed paragraph and run `git diff --check` after the correction.
