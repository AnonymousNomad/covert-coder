# resident.select-tools

Method:
1. List the tools the assignment actually needs (read, write, search, run, inspect).
2. Prefer the smallest tool set; every extra tool is extra risk.
3. Confirm each tool exists and is available in the canonical registry.
4. Note which tools are read-only and which mutate state.

Boundary: enabling a tool is not permission to use it. Mutating tool calls still pass through Execution Authority with exact approvals.
