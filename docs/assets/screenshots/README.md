# Real-product cockpit captures

Captured 2026-09-19 from `feat/final-cockpit-production-ui`, based on integrated revision `70bc46ae0a6b71afcb829f6d95a6e706f49fcd75`. The Git commit containing these assets identifies their frontend source revision.

The three publication images were refreshed after the final editor-control/startup-recovery follow-up, at 10:10–10:11 local time. The instrumented real-stack review opened the actual workspace file and passed split/setup checks, then stopped on a timed-out terminal provider probe. The visible unavailable/degraded state is real; these captures must not be mistaken for a passing end-to-end gate.

- [Command Center](covert-command-center.png): Resident, truthful model/resource state, operational intelligence, lower console.
- [Resident](covert-resident.png): governed-task presentation; no task has been fabricated or submitted for the image.
- [Editor](covert-editor.png): real repository `package.json` open in Monaco.

These are direct browser captures, not composites or synthetic telemetry. There were no installed model artifacts in the isolated review checkout. Unavailable and degraded states are intentional evidence, not retouched away. Screenshots certify appearance only; see the [verification report](../../evidence/final-cockpit-report.md) for functional scope.

## Reproduce locally

On Windows with Microsoft Edge and installed project dependencies:

```bash
node scripts/cockpit-live-review.mjs review
node scripts/cockpit-functional-review.mjs
```

The drivers run canonical `npm start` in the checkout on isolated ports 4273/4877/4878/4879, obtain a one-use pairing code in memory, and close their browser/launcher tree. They never save credentials. Use an isolated checkout with no private source or existing service on those ports.

The functional driver approves only exact terminal start/stop operations in its own workspace and sends `Write-Output COVERT_PTY_REVIEW` to the real PTY. Other approval dialogs are denied. Expected initial approval-required HTTP 409 responses are not execution failures. Editor session persistence is therefore deliberately not claimed by this capture run.

Raw review captures and JSON records stay under ignored `.aide/ui-review/`. Only the three publication-reviewed PNGs are committed. The fixture-based `scripts/cockpit-acceptance.mjs` is a separate UI test, never the screenshot source.

The baseline review used copied local locked dependencies. A separate clean `npm ci --offline` installation then passed from the local cache (127 packages); its native PTY also opened and closed successfully. `npm start`, pairing, doctor and real browser paths were executed. This is local Windows evidence, not a clean-machine or cross-platform certification.
