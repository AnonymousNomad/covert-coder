# Covert workstation implementation checkpoint

2026-10-06. **Application foundation implemented; shell integration blocked by unavailable current Windows source.** This is an execution report, not a new design review or release acceptance.

## 1. Source truth

The authenticated published convergence is `ca8527e565b62326fd940f574d9964413e3c6751`, on `nightshift/production-convergence-20260926`. Published accepted preparation is `1dd2b1729e470713156da821679a46c5583daac4`. The isolated local preparation snapshot has the identical tree but different commit metadata: `502f3db5fd3baf56bc16dd57f9afb402cf490c4c`, tree `fb027c1ab14447b6ba3267c0efabb6251d15a52b`.

Desktop Commander reports NEURO-MIRROR OFFLINE, device `3da504a7-5692-4574-98b6-3bed662b0f2c`, last seen 15 hours ago. This is observed access evidence, not inferred from an old SHA. `E:\covert-sovereign-workstation-shell` remains unreadable from this session. Required but missing: its current worktree path/branch/HEAD/upstream, complete dirty tracked status and diff including binary changes, untracked UI/assets, Luna implementation inventory, current packaging-owned paths and integration/convergence relationship. These cells remain UNKNOWN.

Historical packaging source was inspected at `07d360953cda54f547a9ace71aa22f5368c3128e` and `72053e3b0787c30160457fec3968e6793f24994a`. That does not settle live dirty ownership. PR41 remains experimental and draft/not merge-ready; it was not merged. Protected PR31 was untouched.

## 2. Luna disposition

Preserved completely: no host operation, reset, clean, overwrite, discard, replacement shell or integration from stale source. The reported `12b999d329b59fd7dd480504ce84670b0de521f5` remains a report, not current truth. New modules do not mount into Luna's UI or claim she has not implemented equivalent capabilities. They must be adopted, adapted or superseded only after comparing her actual source.

## 3. Worktree

Candidate worktree: `/workspace/scratch/a9eeb25c9b6a/covert-workstation-preparation`, an existing isolated linked worktree, now branch `feat/workstation-intent-foundation-20261006`.

**Integration worktree: not selected**, pending Windows reconciliation. This is a hash-verified sparse reconstruction, not a complete frontend/build checkout. S1 `e5307c9e32913ef82e6583c4c92ac9453d7b8015` and paused S2 `9baa711cbfc4d431b07f84389bdec4aac0d2865c` were preserved clean. No convergence ref was moved.

## 4. Baseline

Linux, Node v24.19.0. Before new code, root `npm test` failed because existing `tests/unit/test-facade.mjs` is absent in the sparse checkout. Pinned existing `test-owned-process.mjs` passed 1/1. The initial npm command used the wrong scratch parent and returned ENOENT; that tooling invocation was corrected before recording the actual baseline.

## 5. Application code actually changed

| Slice | Implemented behavior | Remaining boundary |
|---|---|---|
| Typed drop intent | Strict bounded data records; registered resource/target combinations; immutable project/root/revision binding; read-only inspection, timeout, invalidation and bounded pending capacity | Preview only. Native metadata is not a file handle. No effect, grant, download, install, context materialization or command API |
| Environment profile | Versioned declarative layout/tool/app/terminal/model/workflow/shortcut references; distinct PRESENT/MISSING/UNKNOWN inspection; rejected credentials/grants/hooks/commands | No apply, installation, routing, grants or canonical project persistence |
| Shared presence | One owner-fact projection/engine for Scout, Rook, Mutt, Tinker; separate Resident/task/capture/output/remote dimensions; stale/foreign facts UNKNOWN; independent appearance/personality/voice references | Static fallback intents; artwork UNQUALIFIED; no mount, inference, privileged Resident enrollment, native media or animation |
| Optional-media teardown | Owned adapter stop plus separate observation; concurrent stop deduplication; bounded callbacks; failure-safe projection; teardown-generation correlation | No start/capture/route/permission API. Injected owner observations are trusted inputs, not measured device proof |

Files are under `browser/src/workstation/interactions/`, `presence/` and `media/`, with `.d.mts` interfaces. Four unit test files accompany them. `package.json` adds `test:workstation-foundation` and runs it before the unchanged existing suite. No new dependency or version was added. No existing production UI/CSS/backend service/desktop or packaging path changed.

## 6. First bounded slices and review repairs

Each feature's tests first failed for its missing module, then passed after implementation. A native-file negative additionally failed before repairing the selection gate. The final independent read-only review identified three Important defects and a Minor temporal-test coverage gap. All were repaired:

1. An observation from a timed-out earlier teardown could say INACTIVE during a later failed stop. The regression reproduced false STOPPED while actual fixture capture stayed ACTIVE. Observations now carry the teardown generation; the stale result yields UNKNOWN/PARTIAL, and a subsequent fresh read can report ACTIVE.
2. A throwing final renderer could prevent presence disposal and leave a timer. Disposal now marks the engine terminal and cancels timers before notifying; cleanup is unconditional. Hide and late cancelled callbacks cannot resurrect rendering.
3. Drop transfer and native-array getters could run before rejection. Data descriptors are now validated before reading those fields. Counter tests prove zero getter calls.
4. Temporal drop tests now await an explicit owner-start signal before project/root changes, invalidate or disposal, then complete the old read. This exercises real in-flight and late-result behavior.

The new failure tests were run RED against the reviewed implementation, then GREEN after repairs. One test incorrectly required a redundant hidden-frame render to throw on a subsequent dispose; it was corrected to assert terminal cleanup/no late render instead. No product gate was weakened.

## 7. Focused, regression and runtime evidence

| Check | Observed outcome | Limit |
|---|---|---|
| `npm run test:workstation-foundation` | 87 passed, 0 failed/skipped | Node source behavior and injected owner fixtures |
| Existing `node --test tests/unit/test-owned-process.mjs` | 1 passed, 0 failed; unrelated real processes terminated: 0 | Linux regression; not Windows/native descendant containment |
| Root `npm test` | New 87 tests pass, then exit 1: missing existing `test-facade.mjs` | Full suite not green |
| `npm run build:frontend` | Exit 127: `vite: not found` | No bundler/browser build proof |
| `npm run check:arch` | Exit 127: `tsc: not found` | Declarations/architecture/ESLint not qualified |
| JavaScript `node --check`; `git diff --check` | Passed | Syntax/patch checks, not product acceptance |
| Published tree identities and source readback | Exact Git tree hashes matched for all five code commits; key module/package blob identities verified | Isolated branch only |

Raw baseline, RED/GREEN, regression, full-suite, build and architecture logs plus measurements are in [evidence/20261006](evidence/20261006/manifest.json). No persistent child process was started for these modules. All command processes completed; the owned-process regression reported zero unrelated process termination.

## 8. Screenshots/reference comparison

No production UI was mounted or changed, so there is no new runtime screenshot or meaningful visual comparison. The accepted retro references and original concepts remain authoritative. No new family artwork was falsely marked qualified. Source-only manifests do not prove silhouette, movement, accessibility or visual acceptance.

## 9. Resource measurements

Single Linux Node microbenchmark, 10,000 measured iterations after 1,000 warmups per operation:

| Operation | Mean microseconds |
|---|---:|
| Typed drop parse | 7.87 |
| Small profile inspect | 11.04 |
| Presence fact projection | 17.39 |
| Repeated visible owner update | 21.13 |
| Hidden owner update | 15.59 |

Repeated identical updates produced no extra frames: count stayed 2. Visible freshness timers: 1; hidden/disposed timers: 0; hidden update frames: 0. Whole benchmark Node RSS rose from 41,385,984 to 51,826,688 bytes; retained heap delta after GC was 354,856 bytes. Those figures include JIT/harness/process overhead and are **not** incremental UI footprint or Windows/WebView/model competition measurements. No UI performance budget is marked passed.

## 10. Security gaps closed/newly exposed

Three candidate-level correctness/security-relevant defects are closed by source regression evidence: stale teardown confirmation, renderer-dependent cleanup and accessor execution before rejection. These are not platform security closure.

Source modules supply partial negative evidence for S19 media truth, S24 stale recovery/presentation, S25 project isolation and S28 bounded capacity. Every canonical security row keeps its existing OPEN/UNVERIFIED/BLOCKED status. No global security row is PASS; no runtime hardening claim is made. Live app-principal/context enforcement, credential lifecycle, localhost widening, acquisition/executable integrity, native terminal/process ownership, egress/revocation, memory provenance, event audiences, native capture privacy, restart/lock/sleep and Veritas/Ghost packaged adversarial coverage remain required owner work.

Review declined to judge: Windows/Tauri mounting/windows/accessibility/restoration/performance/package; Luna dirty reconciliation; art/assets/interactions/proactivity; actual Resident/Authority/context/credential/model/provider/revocation/egress/isolation boundaries; native media shutdown/lock/sleep/panic/process descendants; correctness of adapter observations or event-loop-blocking callbacks; Node20/declaration consumers/full checkout/browser/CI. Ruling: all retain their accepted contracts and activation/acceptance gates. The cost is explicitly incomplete integration, not an altered architecture or a concealed PASS.

## 11. Exact code commits

The remote connector creates different author/timestamp metadata from local Git. Each corresponding tree hash was checked equal; neither local SHA is falsely presented as a remote object.

| Slice | Published commit | Local commit |
|---|---|---|
| Drop | `59c350f0a106fa11f5cfd2863939a5122390d946` | `e31a0bfd311d493f890740da38bff71e1a943288` |
| Profiles | `0f0855e47212aac41cb31bddd7d221321d5ba5e6` | `58408e422a48482ea0059e4ba3642c6c0c7695df` |
| Shared presence | `6868e4907dd42b5014162fd511b504a4cbadf5fd` | `40617dfef64fff54792d8a26fc415b2b40a04f95` |
| Media/test command | `872d8fda4954f4ab235c95ead63995e776a2e15c` | `a88794a347c7fead67723dc88551293594982f7c` |
| Review repairs | `7b967d2112bca73e802543a0425ee221b1986bc3` | `f028b4dd64ed74dad83018518c176331606c0223` |

Published branch: [feat/workstation-intent-foundation-20261006](https://github.com/AnonymousNomad/covert-coder/tree/feat/workstation-intent-foundation-20261006). Evidence/source-truth changes are a separate checkpoint commit after these code slices. This branch is not merged, activated, deployed or accepted as a packaged workstation.

## 12. Next implementation slice and actual dependency

The next authorized application slice remains **reconciled tokens/chrome and internal window hosting**, followed by the existing editor and two independently owned real PTYs. It must use the current Luna implementation and canonical owners. Once NEURO-MIRROR is accessible, the next action is a read-only inventory of the required source cells, compare preserved old controls and Luna deltas, establish packaging ownership and choose the integration worktree. Then run its full baseline and continue bounded commits without routine approval.

The present dependency is live host/source access, not a product-direction choice or request for another authorization. This checkpoint exhausts the independently specified unmounted slices; continuing into the shell now would create precisely the stale competing implementation the operator prohibited. The architecture and existing activation gates remain unchanged.
