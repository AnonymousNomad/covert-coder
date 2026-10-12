# EXT-001 — enuff-tech collaborator package

This branch is a **distribution record only**. It is not a product integration lane and it is not the branch to develop on.

## Package

`COVERT_COLLAB_ENUFF_TECH_MISSION_001_2026-10-12.zip`

SHA-256:

`bc23323927f9000c48268cc53b2aa2da204c6caeb084f9574136951983cec77c`

## Mission source lock

Repository: `AnonymousNomad/covert-coder`

Accepted Workstation preparation SHA:

`1dd2b1729e470713156da821679a46c5583daac4`

The package itself creates a dedicated checkout pinned to that exact SHA.

## Collaborator start

1. Accept the OpenCode workspace invitation.
2. Accept the GitHub repository collaborator invitation.
3. Download the ZIP from this branch.
4. Extract it under a normal non-root account on the first EL9 host.
5. Run:

```bash
bash scripts/start.sh
```

6. If OpenCode is not yet connected to the Covert workspace, use `/connect`.
7. In OpenCode run `/covert/start`.

Run the same package independently on both EL9 systems.

The package generates one return ZIP per host. Attach both return ZIPs to GitHub issue EXT-001. Continuous status reports are not required.
