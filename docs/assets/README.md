# Public documentation assets

This directory is reserved for publication-safe, reproducible visual evidence:

- `screenshots/` — screenshots captured from an accepted build.
- `demos/` — short recordings or animated demonstrations of verified behavior.
- `architecture/` — rendered architecture visuals that agree with `docs/ARCHITECTURE.md`.
- `diagrams/` — supporting diagrams and product-flow illustrations.

Do not add fabricated screenshots, synthetic telemetry, private source, credentials, or unapproved branding. The approved [Covert emblem](branding/covert-coder-emblem.png) is present; its [provenance](branding/README.md) records the bounded extraction from the canonical reference.

The [cockpit captures](screenshots/README.md) are real-product release-candidate evidence, with unavailable runtime states preserved. They do not certify every backend subsystem.

Each committed asset should have a nearby note identifying the build/revision, capture date, scope, and verification evidence. Empty directories are retained only as scaffolding until accepted assets exist.
