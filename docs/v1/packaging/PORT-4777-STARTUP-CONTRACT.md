# Port 4777 and desktop startup contract

Status: source-traced; no production behavior changed.

## Current source truth

The packaged Tauri shell starts the bundled Node executable at desktop/src/main.rs. It passes fixed values for facade 4777, architecture API 4778, and legacy API 4779. desktop/stack-launcher.mjs forwards those ports to the child processes. The same source also uses 4777 as the frontend facade origin. Development UI ports are 5173 for Vite and 4173 for preview.

scripts/facade.mjs binds the facade to 127.0.0.1:4777 by default. node/src/server.ts binds the architecture API to 127.0.0.1:4778. daemon/server.mjs binds the legacy API to 127.0.0.1:4779 by default. Facade route-map entries not otherwise mapped default to the legacy API. Thus the existing lifecycle smoke probe at 4777/health is routed to the legacy health route; it is distinct from the shell’s 4777/api/health check.

The supervisor owns its child IPC references. Its readiness call waits for the architecture API readiness and legacy authority readiness. The facade is attached as an authority adapter, but the readiness method does not request facade readiness over IPC. The launcher emits the pairing proof after its supervisor readiness call. The Rust shell then probes the fixed HTTP endpoint 4777/api/health and accepts a response beginning with HTTP/1.1 200.

The facade and backend servers do not select a free port. EADDRINUSE fails startup; scripts/facade.mjs logs the occupied port and throws. There is no source-level retry on another port, stale-process ownership check, or endpoint handoff from the sidecar to Tauri. The shell’s HTTP health result is not cryptographically or process-identity bound to the listener. The controlled sidecar launch and bind reduce the ordinary race, but the final probe itself establishes only an HTTP response, not listener ownership.

## Classification

**DEFECT — fixed-port collision has no safe recovery, and final facade readiness is not bound to the exact owned listener.**

This is a source classification, not a claim that a foreign process was observed serving 4777 during the historical hang. Historical EADDRINUSE and the missing installed Runtime path were separate observations; causality between them remains unproven.

The exact accepted design must be chosen in product implementation work. It must retain local-only binding and owned-process cleanup. A dynamic port is acceptable only if the supervisor reports the selected bound endpoint through a private owned channel and the UI consumes that exact endpoint. A fixed-port approach is acceptable only if preflight, bind, and readiness prove the listener belongs to the launched sidecar. An unrelated HTTP 200 must never satisfy readiness.

## Later acceptance criteria

1. Keep port inspection read-only. Report listeners with port, PID, executable path where available, parent PID, and an ownership result based on exact path/ancestry evidence. A matching executable name alone is not ownership.
2. Exercise occupied and free listener cases without terminating listeners.
3. Prove an occupied required port gives a bounded, truthful startup result and does not send pairing credentials or application requests to the occupying process.
4. Prove a successful startup binds the selected endpoint to the exact sidecar instance using an owned channel or equivalent process-bound evidence.
5. Prove sidecar exit, timeout, and shell close clean only the exact owned process tree and leave unrelated same-name processes alive.
6. Verify the endpoint can be discovered by the shell without absolute screen coordinates, stale cached state, or a fixed-port assumption unless that fixed port is ownership-verified.
7. Verify shell recovery after a port conflict requires a fresh startup lease; do not replay old readiness or pairing state.
8. Record listener snapshots before launch, during readiness, and after exact cleanup. Do not include command lines or environment values in evidence because they can contain credentials.

## Read-only diagnostic

Run scripts/packaging/port-preflight.ps1 with the required product ports. It does not stop listeners. Ownership remains UNKNOWN if process metadata does not establish an exact repository/install relationship. The default list includes 4777, 4778, 4779, 4173, and 5173. Model-server ports are dynamically selected from model configuration and are not application startup ports. The startup probe records before/during/after port observations and uses the process-tree helper only for its own exact child, never for a listener found by this utility.
