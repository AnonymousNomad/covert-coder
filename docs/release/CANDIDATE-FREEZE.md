# IMMUTABLE RELEASE CANDIDATE — freeze record

Date: 2026-09-23
Branch: `audit/wiring-ledger`
Freeze SHA: **the commit containing this file** (see `git log` — the last commit on the branch when this document was added; no further commits follow the freeze).

## Freeze checklist

```
READY_FOR_LUNA:      YES
P0:                  ACCEPT (P0.2–P0.9 PASS; P0.10 POST_CANDIDATE)
P1:                  ACCEPT (Health, Admission, Provenance, Mission Receipt, Readiness, Doctor, Egress)
GOLDEN MISSION:      PASS (all 9 verdicts; honest supported_conclusion=null + limitations)
FULL REGRESSION:     140/140 guard-verified (17 suites, 0 skip) — BATTERY-release-regression.json
BROAD GATE:          npm run check exit 0 — 691 tests / 680 pass / 0 fail / 11 identified skips
TSC:                 PASS (tsconfig.node.json + browser/tsconfig.browser.json)
LINT:                PASS (0 errors; pre-existing warnings class)
CONTRACTS:           PASS (openapi regenerated; drift suite green; 232 documented routes)
TWO-PROJECT ISOLATION: PASS (cross_project_leak 0)
BATTERY INTEGRITY:   PASS (REQUESTED == DISCOVERED == EXECUTED enforced by scripts/battery-guard.mjs; selftest 3/3)
FALSE VERIFIED:      0
FALSE TRANSITIONS:   0
FALSE GREEN:         0
LEAKS:               0 (transcript/authority/secret/cross-project)
OWNED STRAYS:        0
FOREIGN TOUCHED:     0
```

## Capability Fabric: POST_CANDIDATE
Evidence-based NO-GO for this candidate: v0.1 scope (manifest, typed descriptors, permission model integrated with canonical Authority, local registry, Trust Passport backend, conformance states, CLI, fixtures) materially expands the regression surface across Authority + plugin substrate. Directive explicitly accepts POST_CANDIDATE. Luna's Capability Center UI is unaffected; backend Fabric is the next bounded release-extension task (see CAPABILITY-FABRIC-DISPOSITION.md).

## Delegation: POST_CANDIDATE
Per DELEGATION-CONTRACT.md (truthful NOT_READY; maps to existing subagent routes).

## Luna skills-loader semantic change: NOT_AVAILABLE on this lane
No `SKILLS-LOADER-SEMANTIC-CHANGE.md` (or equivalent evidence package) exists anywhere on this branch's `artifacts/` or `docs/`. Therefore: the isolated semantic change is NOT included in this candidate, was NOT merged, and is NOT rejected — it is UNREVIEWED and deferred to Luna's certification flow. Candidate correctness does not depend on it.

## Known limitations (documented, not hidden)
1. Delegation runtime: POST_CANDIDATE.
2. Capability Fabric v0.1: POST_CANDIDATE.
3. Luna skills-loader semantic change: unreviewed on this lane (not included).
4. Bundled GGUF artifacts are not present in this checkout: model/GGUF suites carry explicit environment skips (gguf.test.ts, model-routes.test.ts, model-runtime.test.ts).
5. Platform skips: DPAPI + desktop list_windows tests skip on non-win32 (run on this box); DAP debugpy and LSP roundtrip skips depend on the configured Python/TS servers.
6. Migration waivers: POST /api/models/ingest, /api/chat, /api/chat/stream carry documented ARCHITECTURE-DECISION waivers (see model-routes.test.ts).
7. Resident runtime not wired in this process (readiness reports UNKNOWN honestly).
8. External provider features require explicit enrollment + consent (local is the default).
9. Kimi live proof ENVIRONMENT-BLOCKED on this machine (no Kimi Code entitlement); moonshot builtin path recorded on the subscription lane.

## Post-candidate items (do not enter candidate line)
Custom Liquid specialization · hosted marketplace · WASM plugin expansion · native bounty platform · desktop control · ACP interoperability · distributed workers · large training/corpus platform · Fabric v0.1 · delegation runtime.

## Certification note
From this point the candidate line is frozen. Only certification-driven defects (reproduced by Luna or by CI) may modify it. Luna is the independent certifier.
