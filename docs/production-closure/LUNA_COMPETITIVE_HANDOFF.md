# Luna Handoff — Competitive Parity

Read `COMPETITIVE_PARITY_DIRECTIVE.md` and `COMPETITIVE_BASELINE_MATRIX.md`.

Do not implement every missing feature immediately.

First audit current repository/runtime truth against the categories in the directive.

Return a machine-readable and human-readable matrix containing:

- category;
- expected workflow;
- current Covert implementation;
- evidence;
- status;
- severity P0/P1/P2/P3;
- dependency;
- recommended next action.

Then prioritize:

1. P0 friction blockers;
2. P1 expected parity;
3. existing release blockers;
4. Covert differentiators;
5. polish.

Do not copy competitor UI or marketing language.

The acceptance question is:

"Can a competent user coming from Cursor/Copilot/Zed/OpenCode/Roo perform the same important development workflow in Covert without unnecessary friction?"

After parity, identify where Covert is intentionally different and preserve those differences.
