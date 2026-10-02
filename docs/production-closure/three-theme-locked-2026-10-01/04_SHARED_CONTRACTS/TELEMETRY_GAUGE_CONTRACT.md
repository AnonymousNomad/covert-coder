# TELEMETRY / GAUGE CONTRACT

The user does not want a Docker/server dashboard. Covert is a developer + local-AI workstation.

## Priority order
1. RAM / commit pressure
2. GPU / VRAM
3. active model/runtime
4. CPU
5. disk free space
6. provider/network state
7. context budget when real

This ordering reflects the actual failure modes of local model work: memory/commit/VRAM pressure can stop admission or destabilize runtime even when CPU looks fine.

## Corporate gauge family
Lower-right instrument cluster:
- CPU: 180-degree arc, percentage + compact 30s trend if real.
- RAM: arc or segmented ring with used/total text.
- Commit: **pressure bar**, not a circle. Show committed/limit and warning thresholds.
- GPU/VRAM: dual-value instrument; GPU % + VRAM used/total.
- Disk: horizontal capacity bar.
- Runtime: exact active model name + runtime + READY/STARTING/FAILED/UNKNOWN.

Use graphite instruments, emerald normal state, cyan information, amber pressure, red failure.

## Matrix gauge family
Do not reuse corporate circles.
Use:
- compact numeric cells;
- thin phosphor bars;
- small real sparklines;
- mission metric strip for task/evidence counts;
- lower telemetry band for hardware.

## Original/Colorful gauge family
Use the reference's right-side resources module:
- one prominent circular health/resource ring;
- adjacent compact CPU/RAM/VRAM/Disk values;
- real trend line if historical samples exist;
- model lineup above it.

## Freshness
Every telemetry component supports:
- current value;
- `sampled_at`;
- state = FRESH / STALE / UNKNOWN / UNAVAILABLE / ERROR.

Stale data remains visible only if clearly marked stale.

## Performance
Poll visible high-value hardware values around 1 Hz by default. Slow or pause when:
- app is backgrounded;
- telemetry panel hidden;
- resource pressure is high.

Windows Performance Counters are designed for diagnostic collection and Microsoft notes they are not appropriate for collection faster than once per second. Prefer direct APIs where a lower-overhead path exists.
