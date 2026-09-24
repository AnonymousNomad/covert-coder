---
name: failure-runtime-adapter-strict-types
description: Repair runtime adapter TypeScript errors under the repository's exact optional and erasable syntax contract.
---

# Runtime Adapter Strict Type Failures

## Finding

The focused compiler run used the repository's `tsconfig.base.json` rules and found:

- `erasableSyntaxOnly` rejects constructor parameter properties; use explicit class fields and assignments.
- `exactOptionalPropertyTypes` rejects passing `{ key: undefined }` to optional `key?: T`; omit absent keys with conditional object spreads.
- A Zod enum export is a runtime value; annotations must use its exported inferred type.
- `ChildProcess.exitCode` is readonly in Node types; a fake process fixture should keep mutable state outside that interface and expose it through a getter.

## Recovery

1. Fix only the compiler-reported declarations and call sites.
2. Keep strictness enabled; do not relax `tsconfig` or add casts that hide the mismatch.
3. Run the focused project-equivalent typecheck before compiling/running the focused test.
4. Preserve the test runner's process ownership assertions and verify temp outputs are removed.
