# Covert Coder Desktop Shell Plan

The production desktop target is a lightweight native shell around the existing web workbench and the local daemon.

## Boundary

- **UI:** editor, panels, community views, model lanes, and user approvals.
- **Daemon:** filesystem, Git, terminal/task broker, model process lifecycle, workspace trust, audit log, and encrypted-sync adapters.
- **Model runtimes:** separate localhost processes using the Covert Coder model contract.
- **Community transports:** optional direct peers or user-selected relays; disabled by default.

Tauri is the native shell around the independently runnable daemon. The Windows path is buildable with the pinned Tauri CLI and Rust toolchain; do not claim other platform builds or release readiness until each target is built and its installed lifecycle is tested.

The Tauri CLI is pinned in the root package and the Rust project lives in `desktop/`. `desktop/prepare.mjs` stages the typed frontend, approved backend files, bundled Node runtime, and declared runtime packages, including only the host-architecture `node-pty` prebuild. Development-only files are excluded. Use `npm run desktop:dev` for development or `npm run desktop:build` for the canonical Windows NSIS build.

The immutable desktop resources include the model manifest but never model weights or a model server binary. On Windows, model storage defaults to `E:\CovertData\CovertCoder\models`; set an absolute `AIDE_MODEL_DIR` to choose another external path. If E: is unavailable and no override is configured, startup fails with configuration guidance. See `STORAGE.md` for workspace, credential, log, and runtime paths.

## Shell Acceptance Gates

- Launches without network access.
- Restores workspace and unsaved editor state.
- Shows workspace trust before enabling tools.
- Starts and stops local model runtimes.
- Routes filesystem and Git operations through the daemon.
- Requires approval for writes, commands, sync, and publishing.
- Recovers from daemon/model crashes without losing local edits.
