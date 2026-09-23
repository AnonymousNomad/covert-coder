# Model Connection Provider Matrix

Status: **ARCHITECTURE / RESEARCH INPUT — IMPLEMENTATION OWNED BY DEEPSEEK #1**

Research date: 2026-09-23. Provider behavior, pricing, model catalogs, and
terms change. The implementation must verify current provider metadata at
connection time and must not turn this document into a permanent catalog.

## Product boundary

Covert exposes a provider-neutral connection view. A connection is not proof
that a model is runnable, permitted for a mission, or suitable for a role.
Connection state, discovered capability, Resource Admission, Execution
Authority, Harness observation, and Veritas acceptance remain separate.

Credentials are owned by either an approved external bridge or an OS-secure
store. Covert records opaque references and safe metadata only.

## Matrix

| Source | Connection class | Official/current authentication evidence | What it provides | Current disposition | Important limits |
|---|---|---|---|---|---|
| OpenCode | `DELEGATED_PROVIDER_BRIDGE` | OpenCode supports `/connect`, provider OAuth/device flows, API-key credentials, and a headless server/provider surface. See [OpenCode providers](https://opencode.ai/docs/providers) and [OpenCode v2 providers](https://opencode.ai/v2/docs/providers). | Delegated provider catalog, auth state, model execution through the existing Covert bridge. | **FIRST BROKER CANDIDATE**; reuse `opencode-bridge.ts`. | Covert must not read OpenCode credential files or imply that every OpenCode provider is permitted for every use. |
| OpenCode Go | `SUBSCRIPTION_BRIDGE` via OpenCode | OpenCode documents connecting OpenCode Go through its `/connect` flow and OpenCode account/API-key path. | Optional low-cost hosted coding-model access. | **DELEGATED / OPTIONAL**. | Not local and not permanently free; limits and pricing must be fetched/displayed from current provider information. |
| OpenRouter | `API_KEY_PROVIDER` or delegated through OpenCode | OpenRouter documents bearer API-key access, a models API/catalog, and OpenAI-compatible requests. See [OpenRouter quickstart](https://openrouter.ai/docs/quickstart). | Multi-model remote catalog; potentially current free endpoints. | **DIRECT LATER / OPENCODE NOW**. | `free` availability, limits, routing, and model identity are dynamic. Harness Sync must bind an exact model/provider revision, not a rotating alias or anonymous router. |
| GitHub Copilot | `DEVICE_OAUTH_PROVIDER` or delegated through OpenCode | GitHub documents device authentication at `github.com/login/device` for Copilot CLI; OpenCode documents the same device-code path for its Copilot provider. See [GitHub Copilot CLI authentication](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli). | Subscription-backed Copilot model access where the account/plan permits it. | **DELEGATED / OPTIONAL**. | Repository access and Copilot model access are distinct connections. Model availability depends on account/plan and may change. |
| OpenAI API | `API_KEY_PROVIDER` | OpenAI documents `OPENAI_API_KEY` for API requests and secure environment/secret handling. See [OpenAI SDKs and CLI](https://developers.openai.com/api/docs/libraries). | Direct API model access, catalog/capability metadata where available. | **EXISTING DIRECT ADAPTER, NEEDS PROVIDER-NEUTRAL DISCOVERY**. | API billing/limits are separate from ChatGPT subscriptions. Never infer one from the other. |
| Codex with ChatGPT account | `SUBSCRIPTION_BRIDGE` / `DEVICE_OAUTH_PROVIDER` | OpenAI documents signing Codex in with a ChatGPT account and distinguishes this from API-key use. See [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan%28.pdf). | Official Codex client/account access where the user is entitled. | **DELEGATED ONLY**; do not scrape or duplicate Codex credentials. | This is not generic OpenAI API credit. Covert must expose product, account, and usage-limit distinctions. |
| Anthropic API | `API_KEY_PROVIDER` | Anthropic documents Console/API authentication and Claude Code authentication options. See [Set up Claude Code](https://docs.anthropic.com/en/docs/claude-code/getting-started). | Direct Anthropic API access. | **DIRECT API ONLY UNTIL TERMS ARE VERIFIED**. | Do not reuse Claude Pro/Max credentials through an unofficial third-party path. |
| Claude Code account | `SUBSCRIPTION_BRIDGE` | Anthropic documents Claude App Pro/Max and enterprise platform paths for Claude Code. | Official Claude Code client access if a supported bridge exists. | **DELEGATED / TERMS-GATED**. | OpenCode's provider page explicitly warns that Anthropic prohibits plugins that use Claude Pro/Max models. Covert must not implement subscription-token extraction or advertise this path as supported without current written permission. |
| Hugging Face Hub | `MODEL_CATALOG` | Hugging Face documents anonymous/public downloads, revision-pinned downloads, and read/fine-grained tokens for private/gated content. See [Downloading models](https://huggingface.co/docs/hub/models-downloading) and [User access tokens](https://huggingface.co/docs/hub/security-tokens). | Local model catalog/acquisition, metadata, revision and license references. | **CATALOG / DOWNLOAD SOURCE**, not an inference provider. | Downloadable does not mean redistributable. Verify license, revision, hash, gates, and source before registration. |
| ModelScope | `MODEL_CATALOG` | The official ModelScope site describes ModelHub; the official client exposes `snapshot_download` and model download tooling. See [ModelScope](https://modelscope.cn/) and [official ModelScope client](https://github.com/modelscope/modelscope). | Local model catalog/acquisition and revision-pinned snapshots. | **CATALOG / DOWNLOAD SOURCE**, not assumed inference provider. | Authentication, licensing, revisions, and file formats are repository-specific; do not treat ModelScope and Hugging Face metadata as interchangeable. |
| llama.cpp-compatible local runtime | `LOCAL_RUNTIME` | Existing Covert model-runtime contract and local GGUF runtime path. | Local inference, no provider credential, offline-first execution. | **PRIMARY LOCAL PATH**. | Runtime/model/template/configuration must be fingerprinted; local availability does not equal readiness or successful governed execution. |
| Ollama local | `LOCAL_RUNTIME` | Ollama documents a local OpenAI-compatible endpoint at `http://localhost:11434/v1`; tool support varies by model. See [Ollama OpenAI compatibility](https://ollama.com/blog/openai-compatibility) and [tool support](https://ollama.com/blog/tool-support). | Local model runtime and model acquisition through Ollama. | **LOCAL COMPATIBILITY ADAPTER**. | The endpoint is local, but model identity, tool support, context limits, and runtime state require discovery. A nominal API key may be unused by the local endpoint. |
| Custom OpenAI-compatible endpoint | `CUSTOM_ENDPOINT` | OpenCode documents custom provider configuration with a base URL, model IDs, and environment-backed credentials. | User-controlled remote or local-compatible inference endpoint. | **BOUNDED CUSTOM PATH**. | Host approval, TLS, egress consent, secret handling, capability discovery, and provider terms are required. Never accept arbitrary endpoint URLs silently. |

## Authentication and ownership rules

1. An account/browser flow belongs to the provider or delegated bridge. Covert
   may launch or observe an official flow, but must not capture raw browser
   credentials or scrape another client's private credential store.
2. A direct API key belongs in the existing secure credential store. The API
   response, logs, evidence, Helix, Provenance, Mission Receipt, and Harness
   Passport contain only an opaque credential reference and a safe digest/length
   where an input-binding record is required.
3. A model download is a catalog operation, not permission to execute arbitrary
   downloaded code. Verify revision, hash, license and runtime compatibility
   before registration.
4. A connection may be `CONNECTED` while a model is unavailable, unsupported,
   rate-limited, resource-inadmissible, or not approved for the requested role.

## Provider facts that must remain dynamic

The UI/backend must query or refresh, where the provider exposes it:

```text
model identity and revision
context and output limits
tool/structured-output/reasoning capability
rate and quota state
pricing or pricing-unknown
provider region/egress information
auth expiration
```

The strings `FREE`, `CONNECTED`, `READY`, and `SUPPORTED` must each be tied to
the exact observed source, timestamp, and scope. `CURRENTLY_FREE` is acceptable
for a discovered offer; `ALWAYS_FREE` is not a valid provider claim.

## Research conclusions

- OpenCode is a viable initial broker because the candidate already has a
  narrow OpenCode bridge that asks OpenCode for health/provider/auth state and
  records delegated provider/model identity returned by OpenCode.
- Hugging Face and ModelScope belong primarily in model acquisition/catalog
  flows, with license/hash/revision gates before local registration.
- OpenAI API, ChatGPT/Codex access, GitHub repository access, and GitHub Copilot
  model access are separate connection records.
- Anthropic API access and Claude subscription access are separate records;
  unofficial subscription reuse is explicitly out of scope.
- Ollama and other OpenAI-compatible endpoints are transport/runtime choices,
  not proof of common tool or reasoning behavior.
