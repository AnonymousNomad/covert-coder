# Covert Studio Foundation

Date: 2026-10-09
Status: UI FOUNDATION ONLY

## Purpose

Covert Studio is the governed generative-media production application used by Cipher and the operator to plan and eventually execute long-form AI-assisted film, episodic, trailer, cinematic and promotional production.

Studio is not a video-generation model.

Studio coordinates qualified image, video, voice, music, sound and deterministic editing capabilities through existing Covert owners.

## Product model

`USER → CIPHER → STUDIO PLAN → APPROVAL / AUTHORITY → RESOURCE ADMISSION → QUALIFIED GENERATOR / TOOL → ARTIFACT → REVIEW → ASSEMBLY → EVIDENCE / RECEIPT`

Cipher acts as director / coordinator.

Authority, credentials, provider identity, spend, filesystem effects, publication and verification remain canonical Covert responsibilities.

## Durable production hierarchy

`PRODUCTION → SEQUENCE → SCENE → SHOT → GENERATION ATTEMPT → APPROVED ASSET`

An approved asset must retain provenance to:

- production
- scene and shot
- prompt / structured generation request
- character / location / prop references
- provider and model identity
- model revision where available
- generation parameters
- source assets
- output artifact identity
- operator review state
- continuity review state

## Workspaces

- PROJECT — production identity, format, target runtime, budget and release intent
- STORY — treatment, screenplay, scenes and dialogue
- BIBLE — canonical characters, locations, wardrobe, props, vehicles and visual rules
- SHOTS — ordered shot graph and generation requirements
- ASSETS — canonical imported and generated media
- GENERATORS — qualified image/video/audio providers and local runtimes
- TIMELINE — deterministic assembly, trim, transition, subtitles and audio mix
- REVIEW — continuity, quality, operator review and regeneration decisions
- EXPORT — final rendering and publication requests

## Provider-neutral generation contract direction

Studio should request capabilities, not vendor names.

Examples:

- `media.image.generate`
- `media.video.generate`
- `media.video.image_to_video`
- `media.video.extend`
- `media.voice.synthesize`
- `media.music.generate`
- `media.sound.generate`
- `media.lipsync.apply`
- `media.timeline.render`

Provider/model routing belongs behind Model Access / App Catalog / qualified adapters.

## Continuity doctrine

A failed shot should not invalidate the production.

Studio must be able to identify the smallest failed unit and regenerate only that unit while preserving approved assets.

Continuity checks should eventually cover:

- character identity
- wardrobe
- props / weapons
- location appearance
- time of day
- screen direction
- camera language
- dialogue timing
- voice identity
- visual style
- preceding / following frame compatibility

## First implementation slices

S0 — application shell and truthful gated workspaces
S1 — production/project manifest + story/bible records
S2 — sequence/scene/shot graph
S3 — provider-neutral generation request contract
S4 — first image/video adapter behind existing governance
S5 — artifact provenance + review state
S6 — deterministic FFmpeg assembly
S7 — continuity checks and targeted regeneration
S8 — budget/spend envelope and production receipt

Current implementation is S0 only.

No generation, spend, publication, provider call or media mutation is authorized by the current Studio surface.
