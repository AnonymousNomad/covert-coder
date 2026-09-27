# resident.handle-provider-failure

Method:
1. Identify the failure class from canonical state: unreachable, invalid credential, not configured, or consent missing.
2. Never expose credential material while diagnosing; report only the state.
3. Choose the fallback honestly: local worker, another configured provider, or stop-and-report.
4. Record the failure and the fallback in canonical state.

Boundary: a fallback to another provider is a routing decision; cloud egress still requires consent, and missing credentials are never invented.
