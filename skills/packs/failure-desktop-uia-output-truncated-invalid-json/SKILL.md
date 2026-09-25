---
name: failure-desktop-uia-output-truncated-invalid-json
description: Prevent the generic desktop action output limit from slicing structured UIA JSON and returning an unparsable partial result.
---

# Desktop UIA Output Truncated into Invalid JSON

## Failure signature

The UIA provider succeeds, but a generic response-size cap slices its serialized
JSON. Consumers then fail to parse an incomplete action result, often when an
inspection returns a larger control inventory.

## Procedure

1. Stop treating the parse failure as a provider action failure. Compare the
   helper result size with the service projection limit without printing
   visible control values.
2. Preserve a valid structured response: bound provider collections at their
   source and expose an explicit truncation indicator where needed.
3. Never truncate serialized JSON as arbitrary text. If the bounded projection
   still exceeds its limit, return a typed refusal/failure before claiming
   success.
4. Keep UIA response limits separate from unrelated desktop text output, and
   retain safe field projection for evidence and receipts.
5. Test a response below and above the former cap and prove every returned
   successful response parses as complete JSON.

## Safety rule

Oversized or incomplete UIA output must remain a hard failure or an explicitly
bounded partial inventory; it must never be silently accepted as complete.
