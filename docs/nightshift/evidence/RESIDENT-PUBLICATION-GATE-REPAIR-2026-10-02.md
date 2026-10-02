# Resident publication gate — generated caller-reference repair

The actual original Windows full pre-push hook on local
`e74b8c7f38fefed6004fec2e6a0bcfa0507d3fc9` completed with **897 total / 885 pass /
1 fail / 11 skips / 0 cancelled**, 476760.9521 ms. Git refused publication.
Remote remained `6ca400381ad8a0fdcdece12e0cac4bb62d91b5c8`.

Sole failure: `tests/arch/route-drift.test.ts:178`, C1-02 generated decision
reproducibility. Original log SHA256:
`2b0d80d1d5916632138f9ba908f455975a1e7ab794183cf986d1b748dcaf1f85`.
Original metadata/result/log and generated artifact bytes were retained under
`E:\covert-tooling\functional-release-20261001` before repair.

## Demonstrated cause and bounded correction

The optional signal assignment in `browser/src/services/api.ts` shifted two
bounded caller-reference line numbers in generated C1-02 JSON: the file read
reference 278 -> 279 and search reference 289 -> 290. Running the unchanged
canonical `scripts/build-c1-02-route-ownership-decisions.mjs` changes only those
two numbers. Generated Markdown is unchanged. Frozen C1-02 reproduction `.md`
and `.json` hashes are unchanged. No route, owner, request, response, Authority
classification, waiver or generator semantics changed in this correction.

Generator `--check` passes. Focused route-drift, actual supervised facade probes
and Authority ownership gates pass **6/6**, zero failures/skips/cancellations.
Route inventory remains 239, with zero conflicting/unclassified dispositions
and the same 20 migration waivers. This reopens only the generated drift result;
it does not qualify a model/provider, resolve the migration waivers or certify RC.

The original red remains evidence. The repaired candidate's actual full hook
and exact-SHA CI are still pending at receipt time; publication is conditional
on that actual hook passing. Functional source and its 54/54 affected-agent,
17/17 Resident browser and 18/18 setup/provider browser receipts are retained.
No thresholds, test assertions, durability or Authority controls are weakened.

Visual work stays paused. Locked references and rejected untracked Design Lab
are preserved; PR #31 remains frozen. Continue exact worker target binding after
the recovered coherent checkpoint's real gates, without routine review waiting.
