# Workflow — Resident model specialization

1. Freeze Resident task contract and acceptance battery.
2. Select 3–5 license/runtime/hardware-compatible base candidates.
3. Benchmark untouched bases on identical prompts and machine profiles.
4. Select strongest base by defined Resident criteria, not general leaderboard rank.
5. Improve system contract, context format, tools and decoding first.
6. Identify persistent measured deficits.
7. Build a small high-quality Covert-owned/licensed SFT corpus targeting only those deficits.
8. Train adapter/LoRA when supported; version base revision + dataset manifest + training config + adapter hash.
9. Evaluate base vs adapter vs quantized adapter on held-out normal/adversarial batteries.
10. Reject regressions in tool correctness, authority behavior, truthfulness, latency or memory use.
11. Package as an optional `Covert Resident` pack only after redistribution review and clean-machine qualification.
12. Keep heavier planner/coder/reviewer routing available; Resident specialization must not become a bottleneck for all work.
