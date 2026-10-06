# Workstation research

Primary documentation inspected 2026-10-06. Last-column choices are design inference; performance budgets are recommendations. Operator references remain visual authority. No measurements asserted.

| Question | Source | Finding and user benefit | Decision / implementation consequence |
|---|---|---|---|
| Native windows/webviews? | [Microsoft performance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance) | Redundant controls add process/resource cost | ADOPT one existing host/WebView with internal frames; measure whole UI process tree |
| Hidden views? | [MDN visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) | Internal DOM visibility is distinct from host document visibility | ADOPT explicit suspension for minimized Buddy/monitor; preserve actual task lifetime |
| Internal resize? | [MDN ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) | Element dimensions can be observed | ADOPT content-box resize to editor/terminal, coalesced writes, cleanup |
| Terminal APIs? | [Xterm API](https://xtermjs.org/docs/api/terminal/classes/terminal/) | Focus/resize/disposal are explicit | ADOPT fit plus approved backend rows/columns and separate session ownership |
| Fast output? | [Xterm flow control](https://xtermjs.org/docs/guides/flowcontrol/) | Async writes/WS can accumulate buffers | ADOPT bounded transport/render buffers and tested watermarks; show gaps rather than imply complete transcript |
| Windows scaling? | [Tauri window API](https://v2.tauri.app/reference/javascript/api/namespacewindow/) | Scale/resize events and unlisten handles exist | ADOPT logical geometry/reclamp through current host bridge; no new native subsystem |
| Focus? | [W3C keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) | Visible, persistent, predictable focus differs from selection | ADOPT active-window/child-focus return; keyboard geometry controls |
| Decisions? | [W3C modal pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | True modals inert background and contain/restore focus | ADOPT modal semantics only for decisions; ordinary applications nonmodal |
| Green readability? | [W3C contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Normal text threshold 4.5:1, large text 3:1 | ADOPT measured token contrast; no microscopic type/glow |
| Zoom/narrow host? | [W3C reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Utility content should avoid unnecessary two-direction scrolling | ADOPT responsive settings/decisions, reachable frames |
| Motion preference? | [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) | OS preference is available | ADOPT static Buddy poses, no wandering |
| Capture permission? | [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) | Capture permission and usage indication matter | ADOPT actual capture state/stop controls; separate routing/retention grants |
| Browser speech local? | [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) | Some implementations send audio to a service | REJECT assumed-local generic speech; qualify explicit STT route |
| Companion design? | Supplied companion sheet inspected | Compact utility forms/sensors/joints convey purpose | ADOPT principles; REJECT specific machines/marks/fantasy scenery |

Research is sufficient for the next reconciled slice. Use installed/pinned package types before coding; current docs are not evidence all APIs are already wired.
