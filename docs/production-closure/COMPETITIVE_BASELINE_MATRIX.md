# Covert Competitive Baseline Matrix — Initial Research

Date checked: 2026-09-27

This is an initial category matrix. Luna must reconcile Covert status from repository/runtime evidence.

| Category | Cursor | GitHub Copilot | Zed | OpenCode | Roo Code | Covert target |
|---|---|---|---|---|---|---|
| Agentic edits | Yes | Yes | Yes | Yes | Yes | Required |
| Plan/read-only modes | Yes | Yes | Profiles/modes | Agent config | Yes | Required |
| Terminal tools | Yes | Yes | Yes | Yes | Yes | Required |
| Browser verification | Yes | ecosystem/tooling | MCP/external | extensible | web access | Required |
| Checkpoints | Yes | review/branch workflows | Yes | integration dependent | Yes | Required |
| MCP | Yes | Yes | Yes | Yes | Yes | Required |
| Skills/instructions | Yes | Yes | Yes | plugins/skills/instructions | config/plugins | modes/rules | Required |
| Multi-agent | Projects/cloud agents | cloud agents/app | Parallel Agents | agent/runtime dependent | Orchestrator | Required |
| Worktree isolation | Projects/agents | app/cloud workflows | Yes | possible via workflow | possible | Required |
| Provider choice | curated models | GitHub models/ecosystem | hosted/API/subscription/gateway/local | 75+ + local | broad + local | Model Access Fabric |
| Subscription access | Cursor plan | Copilot plan | supported subscriptions | OpenCode Go + supported providers | some providers | BYOS required |
| API keys | provider dependent | ecosystem | Yes | Yes | Yes | Required |
| Local models | limited relative to agnostic tools | limited/extension dependent | Yes | Yes | Yes | First-class |
| Custom endpoint/gateway | some | ecosystem | Yes | Yes | Yes | Required |
| Semantic context/index | Yes | Yes | project context | search/config | Yes | Context Control |
| Diff review | Yes | Yes | Yes | yes via editor/runtime | Yes | Required |
| Code review | Bugbot/review | First-class | review changes | workflow dependent | agent review | First-class |
| Cloud/background agent | Yes | Yes | external paths | web/server possible | extension dependent | Later/self-hosted/cloud |
| Mobile/remote control | Yes | GitHub Mobile/app surfaces | no primary focus | web pair | no primary focus | Companion |
| Automations | Yes | GitHub/agents | limited | scripts/plugins | workflows | Required eventually |
| Tool permission profiles | Yes | permissions/policies | Yes | config | Yes | Authority |
| Secure provider credentials | Yes | account-managed | system keychain | local auth store | provider configs | Credential Vault |
| Local model catalog/download | not core | not core | provider/local config | provider catalog | Ollama/LM Studio | Hugging Face catalog |
| Hardware-aware recommendation | not core | not core | not core | not core | not core | Covert differentiator |
| Qualification/evidence state | not central | review evidence | not central | model/provider testing | not central | Covert differentiator |
| Explicit execution authority | approval/sandbox policy | permission policy | tool permissions | config | auto-approval/tool groups | Covert differentiator |

## Source references

Cursor:
- https://cursor.com/docs
- https://cursor.com/docs/agent/overview
- https://cursor.com/docs/mcp

GitHub Copilot:
- https://docs.github.com/en/copilot/get-started/about-github-copilot
- https://docs.github.com/en/copilot/concepts/agents/code-review
- https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents

Zed:
- https://zed.dev/docs/ai/overview
- https://zed.dev/docs/ai/agents
- https://zed.dev/docs/ai/agent-panel
- https://zed.dev/docs/ai/mcp

OpenCode:
- https://opencode.ai/docs/providers
- https://opencode.ai/v2/docs

Roo Code:
- https://roocodeinc.github.io/Roo-Code/basic-usage/using-modes/
- https://roocodeinc.github.io/Roo-Code/providers/
- https://roocodeinc.github.io/Roo-Code/features/checkpoints/

This matrix must be updated from fresh sources before publishing any comparison.
