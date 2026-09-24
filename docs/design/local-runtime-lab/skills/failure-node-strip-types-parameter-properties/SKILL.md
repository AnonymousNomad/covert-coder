---
name: failure-node-strip-types-parameter-properties
description: Run TypeScript contract tests with the pinned compiler when Node strip-only mode rejects TypeScript parameter properties.
---

# Node Strip-Only TypeScript Parameter Properties

## Finding

Node v26.4.0 accepts `--experimental-strip-types` but does not transform TypeScript parameter properties. A `.ts` test containing `constructor(private readonly value: Type)` fails during module parsing, before any assertions run. The repository's lockfile pins TypeScript 5.9.3, whose compiler supports emitting JavaScript and rewriting relative `.ts` import extensions.

## Recovery

1. Stop after `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`; do not retry the same Node command.
2. Check the installed Node flags, pinned TypeScript version, project module settings, and existing test-runner conventions.
3. If the test suite is intended for direct Node stripping, replace non-erasable syntax in the test and imported files with ordinary fields/assignments, then verify using the repository's `erasableSyntaxOnly` compiler setting.
4. Retry Node's test runner only after that source correction. If other non-erasable syntax is required, emit to an isolated temporary output directory with the repository-local compiler and `rewriteRelativeImportExtensions`, preserving ESM and dependency resolution.
5. Remove only the verified temporary output directory and confirm no runtime/test process remains.
6. Do not add a new test runner or dependency declaration merely to bypass this parser limitation.
