# Runtime bootstrap and desktop startup contract

Status: source-traced; no Runtime V1 threshold or product source changed.

## Two distinct runtime dependencies

The packaged desktop shell requires its bundled Node executable and stack-launcher.mjs to start its local application services. desktop/src/main.rs returns a setup error if either is missing. Tauri build then uses an expect path, so this required desktop bootstrap failure can prevent the window from launching. The shell also waits up to 60 seconds for a pairing response and then up to 30 seconds for facade HTTP health. These are application bootstrap dependencies.

The local inference engine and model weights are optional during desktop preparation unless AIDE_REQUIRE_MODEL_RUNTIME=1. desktop/prepare.mjs warns when llama-server is absent by default. desktop/stack-launcher.mjs supplies a candidate AIDE_LLAMA_SERVER path under the bundled resources. daemon/server.mjs loads the model manifest with a caught error; daemon/model-manager.mjs reports runtime and artifact availability separately. A model start operation reports setup-required errors when the runtime binary or model artifact is unavailable. Source evidence therefore supports that a missing optional inference runtime need not prevent the sidecar shell services from starting when the required Node resources, frontend, and ports are healthy.

The frozen installed-app inventory found no root runtime directory, llama-server, or GGUF model and recorded a missing install-root runtime path in historical launch evidence. The current source points the optional engine path under the Tauri resource directory. Those path observations differ. They do not establish that the historical path caused the hang.

## Configuration ownership and resolution

| Concern | Current source | Persistence / behavior |
|---|---|---|
| Node sidecar | Tauri resource_dir/runtime/node.exe | Required packaged resource; no optional state |
| Sidecar launcher | Tauri resource_dir/stack-launcher.mjs | Required packaged resource |
| Local inference binary | AIDE_LLAMA_SERVER set by Tauri to resource_dir/runtime/llama-server.exe; daemon also has install-root and machine-local fallback candidates outside that desktop override | No durable user-facing runtime-path preference was established in this source trace |
| Model manifest | resource_dir/models/manifest.json | Loaded by daemon; load failure is caught |
| Model artifact directory | AIDE_MODEL_DIR set to resource_dir/models | Bundle/resource location by default; model weights are not necessarily present |
| Model file override | AIDE_MODEL_PATH | Environment override; current desktop shell does not persist it as a user setting |
| User workspace | AIDE_WORKSPACE set to resource_dir by desktop/src/main.rs | This also anchors mutable .aide state and is currently inside the installation resource tree |

The absence of the optional local inference engine is represented by runtime_available false in the model status projection. Current UI sources show an unavailable runtime state and configuration/setup messaging. The exact first-user UI path and whether every screen remains usable have not been proven in a fresh profile.

## Required future contract

1. Missing optional local Runtime yields RUNTIME_NOT_CONFIGURED or RUNTIME_UNAVAILABLE and the shell remains available.
2. Missing model weights yield a separate no-model state and a usable configuration/acquisition path.
3. Invalid configured paths are validated and reported without silently substituting another runtime.
4. Provider absence or missing credentials does not prevent shell startup.
5. Required Node/WebView/bootstrap resource failures produce a bounded and actionable startup error; they are not mislabeled as an optional model Runtime failure.
6. Malformed optional caches are refused or reconstructed only under explicit recoverability rules. Original data is backed up before migration or repair.
7. No Runtime qualification threshold changes are part of this contract.
8. First-run acceptance records the exact runtime, model, provider, and shell statuses from the installed candidate and verifies close/reopen behavior.

## Current gaps

- Shell creation currently fails if required Node bootstrap resources are absent.
- Missing optional llama-server behavior is source-supported as nonfatal, but no fresh-profile desktop acceptance proved the UI path end to end.
- The configured binary path, model artifacts, and workspace state currently point into resource_dir in the packaged shell; install-directory mutability and update preservation remain unresolved.
- Historical installed runtime path does not match the current source path.
- No durable, user-owned runtime configuration path was established for the packaged UI.
