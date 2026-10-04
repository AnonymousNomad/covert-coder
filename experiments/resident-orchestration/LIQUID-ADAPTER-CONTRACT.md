# LIQUID ADAPTER CONTRACT

How Covert must speak to thinking-class GGUF models (Liquid LFM2.5/QAD family) and
how it must understand what they say. Repairs implemented in the adapter/runtime
layer only; Helix, Context Control, Authority, Harness, Veritas and the Resident
architecture are untouched by design.

## 1. Engine launch (runtime → llama-server)
| Setting | Required | Evidence |
|---|---|---|
| `--jinja` | **ON** | A/B: without it the same task reasoned 4369 chars and truncated (`finish=length`, content 0); with it 3389 chars then content 243 chars, `finish=stop` |
| samplers | from the model profile sidecar (temperature 0.1, top_k 50, repeat_penalty 1.1) | accounting parity |
| `--ctx-size` | ≥ input + reserve + margin; 4096 minimum for Resident tasks | admission arithmetic |
| `--parallel 1`, `--threads` | unchanged | measured |
| `-ngl` | from the profile (0 on this CPU-only box; GPU PATH NOT TESTED) | no Vulkan build on disk |

## 2. Generation budget (runtime → engine)
- The runtime MUST NOT cap generation below the caller's reserve. The previous
  hard cap `min(maxTokens, 512)` truncated thinking models (PROVEN root cause).
- Effective ceiling: `max(512, servedContext - 768)` — room for the prompt is
  reserved; the caller's reserve is honored up to that ceiling.
- Minimum safe reserve for proposal-class Resident tasks: **1280** at ctx 2048;
  **1536** recommended at ctx 4096 (measured reasoning 850–1100 tokens).
- Overflow rescue (engine HTTP 400 → refit history, retry once) is preserved.

## 3. Reasoning vs final content
- The model emits `reasoning_content` (a thinking block) BEFORE `content`.
- Extraction: return `content` as the Resident answer. Never score reasoning as
  the answer; never persist reasoning as memory; never ingest it into Helix.
- If `content` is empty while `finish_reason=length`, the caller must treat it as
  GENERATION_BUDGET (do not retry as a semantic failure).
- If `content` is empty while `reasoning_content` completes and `finish=stop`,
  treat it as FINAL_CONTENT_EXTRACTION (adapter bug), not the model.

## 4. Tool-call handling
- For Resident action proposals the model returns a JSON action object in
  `content` (canonical Covert proposal shape). Native `tool_calls` were NOT
  emitted for these tasks; if a future profile enables them, the adapter maps
  native syntax → canonical proposal → Authority; Authority/Harness never see
  model-specific tokens.
- Tool-result round trip is NOT_TESTED (no tool loop in the Resident path yet).

## 5. Stop conditions
- Natural stops observed (`finish=stop`); no premature stops. Do not edit stop
  sequences without a captured terminating token/reason (none found defective).

## 6. Timeout profile
- Measured (CPU, contended): prompt eval 3–30 s; generation 5–7 tok/s; per-task
  15–242 s. The runtime caps request timeouts at 300 s — sufficient for
  ≤1280-token reserves at this speed, thin for 4096 reserves; raise per-phase
  only with measurements (never classify slow CPU as model incapacity).

## 7. Profile persistence (canonical)
- `models/<artifact>.gguf.profile.json` sidecar: `{ preset, samplers {…}, runtime {…} }`
  — written for the Liquid candidate with the tested accounting settings.
- Runtime profile version/date/assumptions recorded in
  `experiments/resident-orchestration/runtime/LIQUID-PROFILE.json`.

## 8. Profile safety
- Reject before launch: input + reserve > served context; unknown parser/template;
  non-finite sampler values; ngl > 0 on a CPU-only build (current behaviour: the
  runtime only adds `-ngl 999` for a Vulkan resolution; sidecar ngl is explicit).

## 9. Escalation note (other lane owns the runtime)
This contract documents the repairs made in this lane plus the requirements the
production runtime must keep: `--jinja` for Jinja-macro templates, no sub-request
generation caps, caller-reserve honoring, sidecar sampler application.
