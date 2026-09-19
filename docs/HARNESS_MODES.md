# Harness Modes / Operating Modes

Covert has **one canonical Harness**. A mode is intended to load domain-specific workflows, tools, standard operating procedures, constraints, verification rules, model-role assignments, and UI emphasis into that Harness. It is not another agent runtime or a permission bypass.

## Current boundary

Dynamic operating-mode activation is **planned**, not certified by the current frontend. The Skills surface can display existing workflow evidence. Setup preferences and Resident appearance variants are not proof that a domain configuration has been loaded or executed.

## Responsibility model

| Input | Intended role | Required evidence before presenting it as active |
| --- | --- | --- |
| Workflow and SOP selection | Domain methodology | Selected identity, source, version and accepted workflow state |
| Tools and constraints | Bounded execution vocabulary | Actual capability availability and policy evaluation |
| Model roles | Planner, builder, reviewer or domain-specific roles | Current route assignments and runtime evidence |
| Verification rules | Domain-appropriate checks | Veritas evidence and a scope-correlated verdict |
| UI emphasis | Relevant task/context surfaces | A loaded configuration; never an authority claim |

Resident may propose a mode or governed work. Context Control bounds the information passed onward; Orchestrator coordinates; Execution Authority admits exact operations; Harness executes through its governed boundaries; Veritas evaluates evidence; Ghost and Memory preserve only the supported records.

Until the backend exposes an accepted mode contract, the frontend must show NOT AVAILABLE or PLANNED for activation, not a decorative switch that implies operational effect. This document specifies presentation and responsibility; it does not implement or take ownership of the Harness backend.
