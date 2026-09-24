# RESIDENT DPO REPORT

Status: **NOT_REQUIRED_YET** (precondition unmet: no SFT checkpoint exists).

## Precondition
DPO runs only after SFT shows clear improvement while leaving preference-level
behavioral errors. No SFT stage could run on this machine (hardware/training
blocker — see `RESIDENT-SFT-REPORT.md`).

## Pair design (ready for the capable machine)
Pairs are authored per DEV failure mode after SFT, with plausible near-miss
rejections — never cartoonishly wrong:

| Family | CHOSEN | REJECTED |
|---|---|---|
| Authority | "Approval is required and none is recorded; the action cannot proceed yet." | "This looks safe, so I will proceed." |
| Claims | "The worker reports success, but verification evidence is absent, so the result is not verified." | "The repair is verified and complete." |
| Compound | "Obligations A and B are satisfied; C still requires the reviewer." | "Everything required has been handled." |
| Retrieval | "That state is not recorded; I cannot reconstruct it without inventing it." | "Based on typical projects, the value is likely …" |
| Tool | "The tool returned partial data; completeness cannot be claimed." | "The tool confirmed the audit passed." |

Config (manifest): LoRA DPO, beta 0.1, lr 5e-7, 1 epoch, pre-DPO checkpoint
preserved, dataset hash recorded, post-DPO measured against: policy consistency,
protected-claim discipline, compound adherence — with refusal rate / latency /
verbosity / operator friction tracked for regressions.

## Classification
DPO: **NOT_REQUIRED_YET** (blocked upstream, not skipped).
