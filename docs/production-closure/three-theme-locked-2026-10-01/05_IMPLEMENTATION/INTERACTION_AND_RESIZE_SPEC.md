# INTERACTION / RESIZE SPEC

## Splitters
- hit target: minimum 8 px
- visible line: 1 px idle / 2 px hover-focus
- pointer cursor appropriate to axis
- keyboard arrows resize 10 px
- Shift+arrow resize 40 px
- Home/End snap to min/max where safe
- double click resets to theme default
- Escape cancels active drag when possible

## Collapse
Every non-editor pane has:
- close/collapse button
- command palette action
- keyboard accessible action
- restore command

## Persistence
Persist only stable layout geometry, not transient state.
Version the layout schema so old layouts can be reset safely.

## Editor primacy
If viewport cannot fit all panes:
1. preserve editor minimum;
2. collapse project secondary pane;
3. reduce right pane to compact dock;
4. reduce bottom pane;
5. never squeeze center editor into unusable width.

## Resident
Closing Resident returns width to editor.
Reopening restores last valid width.
No separate parallel chat stack.
