# Contributing to Covert Coder

Covert Coder is a local-first development workbench. Contributions should preserve user control, reproducibility, and honest capability reporting.

## Before A Change

- Open an issue for substantial features or protocol changes.
- Keep model weights, tokens, credentials, private user data, and training checkpoints out of Git.
- Prefer existing protocols such as LSP, DAP, Git, JSON-RPC, and OpenAI-compatible local APIs.
- Add a test and update the relevant manifest or documentation.

## Required Checks

Use Node.js 26.4.0 and the locked dependencies (`npm ci`). For cockpit changes, include a production-build browser review and responsive captures. Do not substitute mocked telemetry for live-product screenshots.

```bash
npx tsc -p browser/tsconfig.browser.json
npx eslint .
npm run build:frontend
node scripts/cockpit-acceptance.mjs
```

The cockpit browser driver uses locally installed Microsoft Edge. Its fixtures test UI behavior, not real inference. Include affected route/architecture tests and disclose unavailable hardware/runtime acceptance separately. Keep backend contracts and `data-authority="none"` intact. An appearance preference is not a Harness Mode.

Broader release gates remain:

```bash
npm test
npm run check
npm run veritas
```

For desktop work, also run `npm run desktop:prepare` and `npm run desktop:build` on a supported desktop host.

## Model Contributions

Every model pack must include its upstream license, source revision, tokenizer/template details, checksum, hardware estimate, benchmark results, and limitations. A model is not `ready` merely because it loads.
