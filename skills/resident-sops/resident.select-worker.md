# resident.select-worker

Method:
1. Describe the assignment: capability needed, size, risk, locality, budget.
2. Query the canonical arsenal (filtered) for candidate workers with honest availability.
3. Prefer an available worker whose role matches; never select a worker that is unavailable, uninstalled, or unknown.
4. Report the choice, the fallback, and the expected cost class.

Boundary: worker selection is a recommendation. Starting a worker is an operation that requires approval, and a stronger worker never replaces Resident continuity.
