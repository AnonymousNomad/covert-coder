---
name: covert-user-context-migration
description: Import user-authorized conversations, preferences, project facts and repository context into Covert with provenance, review, deduplication and privacy boundaries instead of pretending every AI subscription exposes a memory API.
---

# Covert user-context migration

## Sources

Supported connector/API only when documented and authorized; otherwise user-provided export/archive/files. Never scrape browser sessions, tokens, local app databases or undocumented private endpoints.

## Pipeline

1. Identify source and supported export/connector mechanism.
2. Obtain explicit scope: which accounts/projects/conversations/repos and desired retention.
3. Parse locally when possible.
4. Classify raw records separately from candidate durable memory.
5. Extract candidate preferences, project facts, decisions, recurring workflows and named resources.
6. Attach provenance and sensitivity classification.
7. Deduplicate and surface conflicts; do not silently choose a winner.
8. Show a review screen: accept/edit/reject/bulk-scope controls.
9. Persist accepted items through the canonical memory/project store. Credentials and access tokens never enter memory.
10. Provide delete/re-import and provenance inspection.

## Tests

Malformed exports, huge archives, duplicates, contradictory facts, deleted source files, secrets in conversations, managed-workspace export restrictions, cancellation, partial import and restart persistence.
