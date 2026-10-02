# ACTIVITY / LOADING TEST MATRIX

Exercise all states in the isolated Design Lab with deterministic fixtures.

| State | Corporate | Matrix | Original |
|---|---|---|---|
| IDLE | figure dim/static | sparse/slow or static | visor dim |
| PLANNING | cyan slow sweep | cyan-green medium-low rain | cyan visor |
| REASONING | violet slow pulse | restrained violet/cyan trace | violet/magenta visor |
| EXECUTING | emerald medium sweep | green medium rain | green visor |
| COMPILING | bright green/cyan fast segments | dense faster rain | bright green/cyan pulse |
| TESTING | green/cyan fast segments | dense faster rain | green/cyan pulse |
| VERIFYING | green + cyan verify tick | stable verification green | green + brief cyan edge |
| DEBUGGING | amber | amber traces | amber visor |
| WAITING_INPUT | amber breathe/no spin | slow amber cues | amber slow/static |
| RECOVERING | amber->green | controlled transition | amber->green |
| STALE | stop + STALE | freeze/near-static + STALE | dim amber static |
| FAILED | red static | red fault accents, no working rain | red static |
| BLOCKED | red static | red edge/static | red static |
| COMPLETE | short green confirm -> idle | short green settle -> idle | short green confirm -> dim |

Acceptance requires proof that stale/failed does not keep showing "working" motion.
