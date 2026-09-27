# resident.local-vs-cloud

Method:
1. Check policy first: is egress allowed for this work at all?
2. Compare capability, resources and locality: local first when the local worker can do the job.
3. If cloud is required, state the exact provider role needed — never hard-code a provider name into the decision.
4. Record the decision and the consent state; cloud execution requires explicit egress approval.

Boundary: this methodology describes a decision. It never grants egress, and it never stores or reveals credentials.
