---
name: failure-js-fixture-tuple-syntax
description: Prevent malformed JavaScript test-case tuples from reaching browser or integration test execution.
---

# JavaScript fixture tuple syntax

When a test fixture stores cases as positional arrays, keep every case value—including regular expressions—inside the same array. A delimiter placed after the array can turn the next case into an invalid destructuring target.

Before launching a browser or service, run `node --check` on the harness. After a syntax failure, inspect the exact line and surrounding delimiters, correct only that structure, and rerun the syntax check before executing the harness.
