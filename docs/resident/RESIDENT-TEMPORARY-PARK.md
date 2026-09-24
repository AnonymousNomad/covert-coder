# RESIDENT TEMPORARY PARK

Date: 2026-09-23 · Branch: `resident/marathon-h1` · Status: **TEMPORARILY PARKED**

```text
reason:                        runtime qualification resource priority (operator directive)
not a model failure:           YES
not a Resident failure:        YES
evidence deleted or altered:   NO
qualification verdict:         UNCHANGED / NOT YET FINAL
```

## Frozen state at park

- **Phase:** Condition F (post F1/F2). Apparatus between atomic units; no engine and no
  runner was active at park time (verified: 0 llama-server, 0 lane node processes).
- **Last completed units:**
  - `F1` — official `LFM2.5-2.6B-Q4_K_M` (sha256 `02a8b7e17487d326e46d68ce0ba24211e1b80a14c4cd0597fa73c1cd697f52ed`,
    1,674,455,040 B), sequencer treatment, reserve 1536: **8/20**; 6 rows empty (`0c`),
    1 fetch-failed, 2 containment-unusable. `DEV-lfm-official-f1.json`.
  - `F2` — same artifact/treatment, preregistered reserve **2048** diagnosis: **6/20**, `0c`
    rows **doubled to 10**. → `0c` is **not** a generation-budget artifact; more budget made
    it spread (template/reasoning-extraction class). `DEV-lfm-official-f2.json`,
    `docs/resident/CONDITION-F-RESULTS.json` (chain3 summary).
- **Pending units (not started — no partial artifacts):**
  - `F3` — raw-engine interface diagnosis; probe **prepared, not yet run**
    (`experiments/resident-specialization/f3-probe.mjs`, captures finish_reason +
    reasoning/content split, `--jinja` ON vs OFF, row `dev-auth-02`).
  - `F1b` — official artifact with the **D treatment** (packet only; best validated after
    E was not accepted).
  - Final gate decision; RP0–RP7 only if qualified.
- **Evidence frozen and pushed:** Condition D `068c936` · E analyzer `c9315c9` · held-out
  battery + chain2 `f0a121d` · official profile + chain3 `b226d3f` · analyzer E2 `9f9d87d` ·
  **E freeze `63f5759`** (E verdict `MODEL_SPECIFIC_INTERACTION`; E ACCEPTED: NO;
  SKILL EXTRACTED: NO). All 84 result JSONs parse (0 invalid).
- **Branch HEAD at park:** see `git log -1` (local == origin/resident/marathon-h1).

## Deterministic resume

```text
1. Confirm no foreign engine is running, RAM >= ~2 GB free, E:\llama-cpp\llama-server.exe present.
2. Verify artifact: sha256 of models/LFM2.5-2.6B-Q4_K_M.gguf == 02a8b7e1...52ed (1,674,455,040 B).
3. F3 diagnosis:
   node --experimental-strip-types experiments/resident-specialization/f3-probe.mjs
   -> experiments/resident-orchestration/results/F3-INTERFACE-PROBE.json
4. If F3 shows template/reasoning-extraction class: apply ONE bounded interface variable
   (e.g. official-template reasoning handling), recorded as the tested variable; rerun matched.
5. F1b (D treatment, best validated):
   AIDE_CANDIDATE_FILE=LFM2.5-2.6B-Q4_K_M.gguf AIDE_CANDIDATE_LABEL=lfm-official-f1b
   AIDE_SEAT_PACKET=1 AIDE_DEV_MAXTOKENS=1536
   node --experimental-strip-types experiments/resident-specialization/run-dev.mjs
6. Final gate: AUTHORITY >=3/4 · CLAIMS >=3/4 · COMPOUND >=1/2 · COMMUNICATION >=3/4 ·
   COMPREHENSION >=0.66 · HARD FAILURES = 0 -> RESIDENT QUALIFIED / NOT QUALIFIED.
7. On pass: RP0-RP7 production slice; on fail: classify gates, freeze verdict.
```

**Next expected artifact:** `F3-INTERFACE-PROBE.json`, then `DEV-lfm-official-f1b.json`.
**Required runtime/model:** llama.cpp `llama-server` (CPU, ngl 0), official Liquid Q4_K_M.
**Required resource state:** exclusive engine slot (RAM ≥ ~2 GB free), no resident/foreign
engine contention.

## Resource release (per park directive)

- Resident-owned processes stopped: **none needed — 0 were running** (verified at park).
- Foreign/user/runtime-lab processes: untouched (none interfered with at any point).
- Free physical RAM at park: **~6.6 GB**.
