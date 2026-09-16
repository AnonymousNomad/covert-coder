# GitHub Repository Setup

Canonical repository: [AnonymousNomad/covert-coder](https://github.com/AnonymousNomad/covert-coder).

Public product: **Covert Coder**. Engineering lineage: **AIDE Sovereign Workbench**.
The repository rename does not rename package, desktop, signing, update, or environment-variable identifiers.

Recommended settings:

- Public repository
- Description: `Covert Coder — a local-first sovereign AI development environment for governed models, workflows, execution, evidence, and verification.`
- Topics: `offline-ide`, `local-ai`, `developer-tools`, `llama-cpp`, `lsp`, `dap`, `privacy`, `open-source`, `software-engineering`
- Enable Issues and Discussions
- Protect `main` with CI required before merge
- Disable force pushes and branch deletion on `main`
- Enable secret scanning and push protection when available
- Keep private vulnerability reporting enabled; direct sensitive reports to GitHub Security Advisories, not public issues
- Add the Apache-2.0 license
- Do not commit model weights, tokens, checkpoints, or private CaseFiles

The Hugging Face repository remains the model/package mirror. GitHub should be the code, issue, discussion, and contributor home.
