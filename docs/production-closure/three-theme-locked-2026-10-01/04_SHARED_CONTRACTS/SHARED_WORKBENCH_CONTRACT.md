# SHARED WORKBENCH CONTRACT

## Canonical shell behavior
At 1600x900 baseline:
- top utility bar: 48–60 px;
- status bar: 22–28 px;
- outer activity rail: 64–96 px depending on theme;
- secondary/project pane: 220–300 px default;
- right intelligence pane: 300–380 px default;
- bottom execution pane: 190–280 px default;
- center work surface consumes remaining space.

## Resizing
Every major splitter:
- pointer draggable;
- keyboard operable;
- visible focus state;
- minimum content width;
- double-click reset to theme default;
- persisted per workspace + theme;
- safe reset command.

Suggested minimums:
- project pane: 180 px;
- center work surface: 520 px;
- right intelligence pane: 280 px;
- bottom execution pane: 150 px.

Suggested maximums:
- project pane: 34% viewport width;
- right pane: 42% viewport width;
- bottom pane: 55% viewport height.

## Wide vs narrow
At >=1440 px:
- use four-zone desktop layout.

At 1100–1439 px:
- allow secondary pane collapse;
- right intelligence pane remains dockable/collapsible.

Below 1100 px:
- do not crush editor below usable width;
- Resident may switch to overlay/tabbed secondary pane;
- preserve the same state and conversation.

## Persistence
Persist:
- theme;
- panel widths/heights;
- collapsed/visible state;
- selected tabs;
- ambient effect toggle;
- reduced-motion preference if product-owned.

Do not persist fake running state.
