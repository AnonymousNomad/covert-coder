# SOL PRODUCT REFERENCE DIRECTIVE — POCKETPAL + TOOLNEURON

Date: 2026-10-01
Owner: James Ferrell
Target: Covert Coder release convergence
Branch: nightshift/production-convergence-20260926

## Mission

Use PocketPal AI and ToolNeuron as implementation references for product patterns that materially improve Covert Coder.

Do not clone either product wholesale.
Do not copy architecture that conflicts with Covert's existing Resident -> Context Control -> Workflow/Skill Intelligence -> Orchestrator -> Execution Authority -> Harness design.
Do not treat competitor/reference behavior as proof that a Covert feature is complete.

The objective is to extract proven patterns for:
- local voice/TTS/STT;
- startup greeting and Resident presence;
- per-model inference controls;
- hardware-aware tuning;
- context budgeting and context inspection;
- Hugging Face model discovery;
- measured benchmarks and runtime telemetry;
- tool/plugin capabilities;
- headless/local-service interaction;
- desktop control routed through one authority system.

## External references

### PocketPal AI

Primary repository:
https://github.com/a-ghorbani/pocketpal-ai

Current README / architecture:
https://github.com/a-ghorbani/pocketpal-ai/blob/main/README.md

Neural TTS implementation PR:
https://github.com/a-ghorbani/pocketpal-ai/pull/688

Use PocketPal primarily as a reference for:
- offline local TTS;
- pluggable voice-engine architecture;
- streaming speech while tokens are still arriving;
- auto-speak and per-message play/stop controls;
- disk/RAM gates before installing or loading voice engines;
- keeping voice as a separate runtime subsystem from the LLM;
- assistant/profile greeting as presentation state rather than contaminating conversation context;
- Hugging Face acquisition UX;
- hardware acceleration/fallback patterns;
- assistant/profile configuration.

PocketPal currently documents multiple TTS engines and an engine registry/runtime model. Its TTS architecture is a stronger reference than its speech-input architecture.

### ToolNeuron

Primary repository:
https://github.com/Siddhesh2377/ToolNeuron

Feature documentation:
https://tool-neuron.vercel.app/features

Documentation:
https://tool-neuron.vercel.app/docs

Hardware tuning reference commit:
https://github.com/Siddhesh2377/ToolNeuron/commit/d79ecfd30b1048411d76339ce302a2cfefcff965

Use ToolNeuron primarily as a reference for:
- local voice input/output patterns;
- Whisper/sherpa-onnx-style STT/TTS lifecycle concepts;
- per-model persistent inference configuration;
- temperature/top-k/top-p/min-p/repeat-penalty/context controls;
- streaming metrics including tok/s, TTFT, and peak memory;
- hardware scanning and automatic thread/context/cache tuning;
- Performance / Balanced / Power-Saver style operating profiles;
- full-screen Hugging Face explorer and practical filters;
- RAG/context budgeting and retrieval inspection;
- explicit plugin capability declarations;
- local/headless service patterns.

## Required Covert SOPs / doctrines to load before implementation

Sol must ground implementation against these existing project skills and contracts first:

1. `skills/packs/aide-product-vision/SKILL.md`
   - product laws;
   - offline-first;
   - no-phone-home by default;
   - research before code.

2. `skills/packs/aide-inference-control/SKILL.md`
   - canonical per-model sampler/runtime controls;
   - temperature/top-k/top-p/min-p/Mirostat/repeat penalty/seed;
   - context/threads/parallel/GPU layers;
   - benchmark-gated tuning;
   - live tok/s and TTFT.

3. `skills/packs/aide-device-benchmark-runner/SKILL.md`
   - measured hardware behavior;
   - llama-bench;
   - actual device numbers rather than generic estimates.

4. `skills/packs/aide-model-hub-acquisition/SKILL.md`
   - Hugging Face search/download/import;
   - explicit egress;
   - GGUF acquisition;
   - fit-aware model selection.

5. `skills/packs/aide-model-task-recommender/SKILL.md`
   - task-specific recommendations;
   - combine Hub metadata + machine fit + measured benchmarks.

6. `skills/packs/aide-desktop-control-integration/SKILL.md`
   - one desktop-control service;
   - grammar-constrained actions;
   - grants/panic/pending/verdict semantics;
   - Telegram and future surfaces must use the same desktop service.

7. `skills/packs/aide-agent-harness-convergence/SKILL.md`
   - one first-class agent harness;
   - permission levels;
   - tool policy;
   - no new parallel voice-agent runtime.

8. `skills/packs/aide-the-quad/SKILL.md`
   - Cockpit + Harness + Orchestrator + Model synchronization;
   - voice must join this system, not bypass it.

9. `skills/packs/aide-orchestrator-awareness/SKILL.md`
   - model/task/hardware recommendation awareness;
   - measured state over decorative status.

10. `skills/packs/aide-harness-prompt-scaffolding/SKILL.md`
    - voice transport must not invent a second prompt discipline;
    - same governed Resident request path.

11. `skills/packs/process-hygiene-sop/SKILL.md` where present/registered
    - STT/TTS engines are processes/resources;
    - no broad process killing;
    - owned-process lifecycle only.

12. Existing Context Control / history-fit / memory / skill-selection contracts
    - context budget remains canonical;
    - voice transcripts are ordinary user input after STT, not privileged context;
    - startup greeting must not consume model context.

## Product law: voice is a Resident transport, not a second assistant

Target architecture:

```text
MIC / PUSH-TO-TALK
        |
        v
LOCAL STT
        |
        v
Resident Request
        |
        v
Context Control Engine
        |
        v
Workflow Engine + Skill Intelligence
        |
        v
Orchestrator
        |
        v
Execution Authority
        |
        +--> Desktop / Tools / Models
        |
        v
Resident Response
        |
        v
LOCAL TTS
        |
        v
SPEAKERS
```

Telegram, desktop UI, terminal, voice, and future mobile/headless clients are transports into the same Resident/Authority domain.

Do not create:
- a separate "voice brain";
- a separate voice permission system;
- a separate voice model registry;
- a second desktop-control executor;
- a voice-only memory system.

## Resident Voice V1 target

Keep V1 bounded:

- deterministic startup greeting;
- local TTS;
- push-to-talk local STT;
- auto-speak toggle;
- per-message Speak / Stop;
- voice/engine selector;
- speech speed;
- graceful system-TTS fallback;
- neural TTS optional;
- STT/TTS resources loaded only when needed;
- Resource/Runtime Broker admission so speech cannot starve the coding model;
- no always-listening microphone in V1.

Example startup behavior:

`Welcome back, <operator-name>. Covert is ready.`

This greeting should:
- come from the local operator profile;
- require no LLM call;
- require no cloud;
- not be written into conversation history;
- not consume context tokens;
- obey a user setting: Off / Visual only / Spoken.

## Desktop-control voice actions

Voice actions must resolve into existing typed desktop capabilities.

Example:

`Covert, lock the workstation.`

Required path:

`STT -> Resident intent -> desktop.lock proposal -> Execution Authority -> OS lock action -> audit receipt -> spoken/visual acknowledgment`

Voice identity is NOT authentication.
A spoken phrase alone must never grant privilege.

Suggested capability taxonomy:

- `desktop.lock`
- `desktop.observe`
- `desktop.open_app`
- `desktop.open_project`
- `desktop.input`
- `runtime.start`
- `runtime.stop`
- `tests.run`
- `git.read`
- `git.write`
- `network.egress`
- `microphone.capture`
- `audio.playback`
- `clipboard.read`
- `clipboard.write`
- `notifications.send`
- `models.load`
- `models.download`

Low-risk actions may be preauthorized by explicit operator policy.
Higher-risk actions remain approval-gated.

Telegram must use the same capability path. Do not maintain Telegram-only desktop powers.

## Inference-control product requirements

ToolNeuron is a useful UX reference, but Covert should exceed heuristic-only tuning.

Each model should have a persistent canonical Model Profile with:

### Sampling
- temperature;
- top_k;
- top_p;
- min_p;
- repeat penalty;
- Mirostat where supported;
- seed;
- max output;
- thinking/reasoning options where supported.

### Runtime
- context size;
- threads;
- parallelism;
- GPU/offload layers;
- mmap/mlock where supported;
- flash attention where supported;
- KV/cache configuration where supported.

### User-facing profile modes
- AUTO / Measured;
- PERFORMANCE;
- BALANCED;
- LOW RESOURCE / QUIET;
- MANUAL.

AUTO must use:
- current hardware telemetry;
- fit estimates;
- actual benchmark evidence;
- known runtime constraints;
- current model/quant identity.

Do not merely copy static rules from another app.

Profiles must persist per model/artifact identity and must not bleed settings from one model into another.

## Context Control / Context Inspector requirements

ToolNeuron's retrieval/context UX is a reference point, not the target ceiling.

Covert should expose the Context Control Engine as an inspectable aperture.

At minimum surface:

- model context capacity;
- reserved output budget;
- system/Resident budget;
- workflow/SOP budget;
- project context;
- selected files/snippets;
- memory;
- tool results;
- remaining/free budget.

For every included context item show:
- source;
- reason selected;
- version/revision where relevant;
- token/byte cost;
- trust/provenance status.

For every dropped item show a reason where useful:
- stale;
- superseded;
- duplicate;
- low relevance;
- over budget;
- authority/privacy exclusion.

Voice transcripts enter through the same Context Control rules as typed user input.

## Hugging Face / model-store reference

PocketPal and ToolNeuron both validate the usability of in-app model acquisition.

Use the already-authored Covert Hugging Face release gate:
`docs/SOL_HUGGINGFACE_MODEL_INTELLIGENCE_RELEASE_GATE.md`

Do not create another model store registry.
HF discovery/acquisition feeds MM9 / Intelligence Registry.

Useful reference UX:
- search;
- task/model filters;
- parameter range;
- author;
- license;
- gated status;
- quant;
- file sizes;
- downloads/likes only as metadata, never qualification;
- fit verdict;
- benchmark result;
- recommendation reason.

## Runtime telemetry requirements

Adopt the useful transparency patterns seen in these reference apps, but bind them to real Covert state.

Expose when available:

- model + exact artifact/quant;
- backend/runtime;
- TTFT;
- generation tok/s;
- prompt processing tok/s;
- context used/capacity;
- RAM;
- VRAM;
- GPU/offload state;
- active runtime profile;
- active Resident role;
- cloud cost/usage when applicable.

No decorative/fake telemetry.

## Plugin / tool capability reference

ToolNeuron's explicit capability declarations are a useful conceptual reference.

Covert skills/plugins/tools should declare required capabilities and receive only those grants.

The host/Authority layer remains the enforcer.

Prompt instructions are never a substitute for capability enforcement.

## Headless Resident direction

Long-term target:

```text
Desktop UI
    |
Resident Core ---- Telegram
    |
    +------------- Voice
    |
    +------------- Local authenticated API
    |
    +------------- future mobile companion
```

All surfaces:
- share one identity/provenance model;
- share Authority;
- share Context Control;
- share desktop tools;
- share model routing;
- produce common audit/evidence receipts.

## Reference-use discipline

For every adopted idea, Sol must record:

1. source/reference URL;
2. feature/pattern observed;
3. why it is useful to Covert;
4. existing Covert subsystem it maps to;
5. whether Covert already has it:
   - IMPLEMENTED;
   - DESIGNED / UNWIRED;
   - PARTIAL;
   - MISSING;
6. exact acceptance test;
7. whether the idea conflicts with any Covert doctrine.

Do not import code solely because a reference project implements a feature.
Review licenses before any source-code reuse.
Prefer reimplementation from product principles and official upstream APIs.

## Initial acceptance targets

Before claiming this reference pass complete, Sol must leave a matrix covering at least:

- startup greeting;
- system TTS fallback;
- neural TTS option;
- local push-to-talk STT;
- speech resource lifecycle;
- inference profile persistence;
- AUTO hardware tuning;
- performance modes;
- Context Inspector;
- Hugging Face explorer;
- benchmark telemetry;
- per-model recommendation;
- plugin/tool capabilities;
- `desktop.lock`;
- Telegram/voice/UI convergence on one Authority path;
- restart persistence;
- offline behavior;
- no credential or private-context leakage.

Each row must state current Covert status and evidence path.

## Release priority

Do not destabilize the current release spine by implementing every reference idea immediately.

Classify findings into:

- RELEASE BLOCKER — necessary for already-promised Covert behavior;
- RELEASE-ADJACENT — should land if bounded and low-risk;
- POST-RELEASE — valuable, but not worth reopening a certified subsystem.

Resident Voice V1 should remain a bounded additive layer unless it can be integrated without disturbing current convergence gates.

