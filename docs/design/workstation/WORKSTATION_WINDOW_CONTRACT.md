# Internal window contract

## Identity

WindowID/AppID/AppInstanceID, optional ProjectID/root revision, logical bounds/normal bounds, z-order, focus, minimized/maximized/snap state and layout version. Resource IDs remain distinct: terminal SessionID, task ID, editor document/buffer or model route. No grants/secrets/runtime flags in layouts.

## Behavior

Open reuses designated singletons; multi-instance terminals bind distinct approved sessions. Focus raises one frame and restores valid child focus. Background events never steal typing focus. Closing/minimizing active content selects another reachable frame/launcher.

Move/resize use CSS coordinates, pointer capture and cancellation on lost capture/blur/pointercancel. Coalesce writes; persist end geometry, not every pointer movement. Clamp titles/controls to usable area. Keyboard frame menu offers move/resize with arrows, Enter commit, Escape cancel.

Maximize respects essential strips and saves normal geometry. Snap left/right and quadrants; restore reclamps. Recompute after host size/scale change. Internal switching cannot hijack Windows Alt+Tab or editor/terminal shortcuts; choose binding after inventory. Reset layout remains reachable.

Minimize hides/inerts view and invokes explicit visibility hooks. It does not terminate work. Restore reconciles resource truth and refits content. Monaco receives actual dimensions; Xterm fits and sends rows/columns to the correct authenticated session. Host resize alone is insufficient. Defer zero-size hidden fits.

## Lifecycle and processes

Wrap existing mounts with activate/visibility/resize/dispose hooks. Release observers/listeners/render objects on dispose. Keep underlying task identity independent.

Dirty editor close uses buffer recovery/decision. Terminal close offers stop or explicitly supported detach with owned lifetime/recovery. If detach is unproved, cancel or stop; never silently orphan. Unconfirmed stop remains uncertain.

Bound terminal transport/render buffers and visible scrollback separately from task/evidence retention. Detect gaps/truncation; do not claim complete transcript. High-output acceptance requires actual backpressure/limits, not just a frame.

## Stacking and accessibility

App windows are nonmodal. Actual decision dialogs inert relevant background, contain focus and return it predictably. Host decisions/emergency controls remain above Buddy; extensions cannot spoof that chrome.

No positive-tabindex maze or window key listener swallowing editor/terminal input. All frame controls have names and keyboard access.

## Restore

Version per-project allowlisted frame intent with validated geometry. No stored command executes on restore. Reconnect a surviving terminal only after verifying identity/ownership; otherwise explicit new-start action.

Missing capability retains a recoverable explanation/placeholder without auto-install. Corrupt/unknown layouts get safe defaults and visible recovery; buffers stay in their own owner. Check DPI/narrow/offscreen recovery.
