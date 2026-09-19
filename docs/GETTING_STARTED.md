# Getting started with Covert Coder

## Install

Use Git and Node.js **26.4.0**, the pinned CI reference runtime. The package's older `>=20` declaration is not proof of Node 20 compatibility. Native PTY installation may require platform build tools.

```bash
git clone https://github.com/AnonymousNomad/covert-coder.git
cd covert-coder
git switch covert-production
npm ci
npm run doctor
npm start
```

For the unmerged frontend candidate, select `feat/final-cockpit-production-ui` instead. The application builds its typed frontend before launching. Open **http://127.0.0.1:4173/**; leave the launch terminal running.

The doctor is diagnostic: warnings about missing models, llama.cpp, or debugpy are not proof that those capabilities work. It does not install them. Local chat requires a compatible local runtime and model artifact; see [operations](OPERATIONS.md).

## Pair the browser

1. Type `pair` in the terminal running `npm start`.
2. Paste the one-use code into the browser pairing form.
3. Choose **PAIR SESSION**.

Codes expire after five minutes. Pairing establishes an operator session, not blanket permission. Do not publish the code, session token, or raw approval material. If pairing fails, request a fresh code. Reloading requires a new session because the browser does not persist the credential.

## Setup

Open **Settings → Run Adaptive Setup**. Answer the questions, inspect the plan, and approve only changes you understand. Setup distinguishes waiting, approval required, applying, verifying, action required, ready, and failure. A missing model is not resolved by a green-looking card.

Closing setup does not grant authority or silently apply a plan. Escape closes the dialog and returns focus to the control that opened it.

## First engineering session

- **Command Center:** Resident, operational evidence, models, resources, and the lower console.
- **Resident:** choose Conversation for model chat or Governed Task for a reviewed task request. Quick actions prepare the task; they do not submit it.
- **Projects:** open a workspace file into Editor. Bundle install/trust controls remain separate governed actions.
- **Editor:** use Monaco tabs and splits; inspect modified state and diagnostics. Saving and session persistence retain their approval boundaries.
- **Terminal:** select an available provider/shell, choose Open Session, and review its approval. Stop Session closes the owned PTY.
- **Models:** inspect artifact, runtime, and route state. STARTABLE is not READY.
- **Skills / Memory / Verification / Security:** read the explicit evidence and unavailable states. They do not confer additional authority.
- **Settings:** provider configuration, connections, walkthrough, and setup.

The lower console can collapse; its tabs support arrow keys. At narrower widths, use **INTELLIGENCE** to open the contextual rail and Escape to close it. Reduced-motion preferences are respected.

## Local and connected operation

No cloud account is needed to open the workbench. Local inference needs separately installed weights and a runtime. External providers and model downloads are opt-in network operations; inspect the scope before enabling them. Never paste secrets into chat.

Harness Modes describe one canonical Harness with domain-specific composition. Appearance preferences are visual only; they are not operating-mode activation. See [Harness Modes](HARNESS_MODES.md).

## Troubleshooting and verification

Run `npm run doctor`, read the launch terminal, and retain the exact error without credentials. A failed read can show unavailable data; the model-route Refresh control retries on request. A denied session save leaves open tabs in the current window but does not promise restart continuity.

```bash
npx tsc -p browser/tsconfig.browser.json
npx eslint .
npm run build:frontend
node scripts/cockpit-acceptance.mjs
```

The browser acceptance driver uses installed Microsoft Edge. Wider architecture verification is `npm run check:arch`. Tests using fixtures do not prove that a local model is generating successfully.

Stop the launcher with Ctrl+C when finished. [Security](../SECURITY.md) · [Support](../SUPPORT.md) · [Documentation index](README.md).
