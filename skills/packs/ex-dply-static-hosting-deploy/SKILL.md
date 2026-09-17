---
name: ex-dply-static-hosting-deploy
description: Deployment and hosting for verified static and edge-compatible immersive web experiences. Ships verified experiences reproducibly with build identity, deployment method verification, rollback strategy, and post-deployment validation. Use when deploying static or edge-compatible web experiences, configuring CDN and hosting strategies, planning build pipelines for immersive experiences, executing post-deployment verification, managing rollback strategies, or compiling deployment records with build identity and verification evidence.
---

# Deployment — Static and Edge Hosting

## PURPOSE

Ship verified immersive web experiences reproducibly. The deployment skill ensures that what was verified in QC is exactly what reaches production: same build, same behavior, same experience. Deployment is not "upload and hope" — it is a verified, recorded, reversible action.

## WHEN TO ACTIVATE

- Deploying a static or edge-compatible web experience to production
- Configuring CDN, hosting, or edge delivery strategies
- Planning build pipelines for immersive experiences (build → verify → deploy)
- Executing post-deployment verification (confirming production matches staging)
- Managing rollback strategies when deployment issues arise
- Compiling deployment records with build identity and verification evidence

## WHEN NOT TO ACTIVATE

- No completed QC pass (use ex-qc-production-readiness-checklist first)
- Model serving or inference deployment (use edge-deployment-ci or gguf-quantization-deployment)
- AIDE IDE deployment (use aide-packaging-offline or aide-arch-packaging-release)
- Docker or container deployment for AI workloads (use cipher-cloud-setup)
- Internal development server deployment (not production deployment)

## REQUIRED INPUTS

- RELEASE_EVIDENCE (from ex-qc-production-readiness-checklist) — QC must pass before deployment
- IMPLEMENTATION_BLUEPRINT (build requirements, asset strategy)
- Target hosting platform (static host, CDN, edge functions)
- Domain and SSL requirements
- Build environment (local, CI/CD, edge build)

## WORKFLOW

1. **Verify build integrity.** Build the production artifact from the verified source. Record: build timestamp, source commit hash, build tool version, build configuration, and output artifact hash. The build must be reproducible — running the same build again produces byte-identical output.
2. **Stage and verify.** Deploy to a staging environment that mirrors production. Run a subset of QC checks on staging to confirm the deployment environment does not introduce issues. Compare staging behavior against the verified implementation.
3. **Configure hosting.** Set up the hosting platform: domain pointing, SSL certificate, headers (CSP, HSTS, caching), redirect rules, and error pages. Every configuration is documented and version-controlled.
4. **Deploy to production.** Execute the deployment with rollback capability. Record: deployment timestamp, deployment method (CLI, API, Git push, manual upload), deployment target (URL, CDN edge locations), and deployment artifact hash.
5. **Run post-deployment verification.** Immediately after deployment: verify the production URL loads correctly, check that all assets resolve, confirm SSL is valid, test critical user paths, and compare production artifact hash against the staged build hash.
6. **Document deployment record.** Compile the full deployment artifact: build identity, deployment method, verification results, rollback strategy, and monitoring setup. This is the audit trail for the deployment.
7. **Set up monitoring.** Configure uptime monitoring, error tracking, and performance monitoring. Define alert thresholds and escalation paths. Monitoring is part of deployment, not an afterthought.

## DECISION RULES

1. **QC must pass before deployment.** No deployment proceeds without a passing RELEASE_EVIDENCE. The QC gate is not advisory — it is a hard prerequisite. If QC fails, fix the issues, re-run QC, and only then deploy.
2. **Build identity is recorded for every deployment.** Every deployment records: source commit, build hash, deployment timestamp, and deployment target. This creates an audit trail that enables rollback and debugging.
3. **Staging mirrors production.** The staging environment must use the same hosting configuration, same asset delivery, and same headers as production. "It works on staging" is only meaningful if staging matches production.
4. **Rollback strategy is defined before deployment.** Every deployment has a documented rollback procedure: how to revert, how long rollback takes, and what data state is preserved. Rollback is not figured out after a failure — it is planned before the deployment.
5. **Post-deployment verification is immediate.** Within 5 minutes of deployment: verify the production URL loads, check critical paths, confirm asset delivery, and validate SSL. If verification fails, execute rollback immediately.
6. **Deployment is atomic.** The entire experience deploys as one unit. Partial deployments, rolling updates, or canary deployments for static sites are not in scope — the entire build ships or the entire build rolls back.
7. **No deployment without monitoring.** A deployed experience without monitoring is a deployed experience you will discover is broken from user reports, not from your own systems. Monitoring is mandatory.

## VALIDATION CHECKS

1. DEPLOYMENT_RECORD contains all 5 required sections: build_identity, staging_verification, hosting_configuration, deployment_execution, post_deployment_verification.
2. Build artifact hash is recorded and matches the staged build.
3. Staging verification confirms the deployment environment matches production behavior.
4. Rollback procedure is documented with estimated rollback time.
5. Post-deployment verification confirms production loads correctly within 5 minutes.
6. Monitoring configuration is documented with alert thresholds.

## FAILURE CONDITIONS

- QC has not passed → BLOCK deployment, require QC completion first.
- Build is not reproducible (hash mismatch on re-build) → BLOCK deployment, fix build reproducibility.
- Staging behavior differs from production → BLOCK deployment, identify and resolve the environment difference.
- Post-deployment verification fails → EXECUTE rollback immediately, diagnose, fix, re-deploy.

## OUTPUT CONTRACT

### DEPLOYMENT_RECORD

```json
{
  "deployment_id": "dply-{timestamp}",
  "qc_ref": "qc-{id}",
  "build_identity": {
    "source_commit": "string — git commit hash or source identifier",
    "build_timestamp": "string — ISO timestamp of build",
    "build_tool": "string — build tool and version",
    "build_config": "string — build configuration used",
    "artifact_hash": "string — SHA-256 hash of the production build artifact"
  },
  "staging_verification": {
    "staging_url": "string — staging environment URL",
    "verification_timestamp": "string — when staging was verified",
    "qc_subset_results": "string — summary of QC checks run on staging",
    "staging_matches_production_intent": "boolean"
  },
  "hosting_configuration": {
    "platform": "string — hosting platform (netlify, vercel, cloudflare-pages, github-pages, s3, custom)",
    "domain": "string — production domain",
    "ssl": "string — SSL certificate status",
    "headers": {"string": "string — key HTTP headers configured"},
    "redirects": ["string — redirect rules configured"],
    "error_pages": "string — custom error page configuration"
  },
  "deployment_execution": {
    "method": "string — CLI | API | git-push | manual",
    "timestamp": "string — ISO timestamp of deployment",
    "target": "string — deployment target (URL, edge locations)",
    "artifact_hash": "string — hash of the deployed artifact (must match build_identity)"
  },
  "post_deployment_verification": {
    "verification_timestamp": "string — when production was verified",
    "url_loads": "boolean",
    "assets_resolve": "boolean",
    "ssl_valid": "boolean",
    "critical_paths_pass": "boolean",
    "hash_matches_build": "boolean"
  },
  "rollback_strategy": {
    "method": "string — how to revert",
    "estimated_time": "string — how long rollback takes",
    "data_state_preserved": "string — what user data state is preserved through rollback"
  },
  "monitoring": {
    "uptime_monitoring": "string — monitoring service and check interval",
    "error_tracking": "string — error tracking service",
    "performance_monitoring": "string — performance monitoring setup",
    "alert_thresholds": "string — when alerts trigger"
  }
}
```

## RELATED SKILLS

- `ex-qc-production-readiness-checklist` — must pass before deployment proceeds
- `ex-fnt-component-composition` — implementation blueprint defines build requirements
- `ex-del-revision-approval-workflow` — client approval required before production deployment
- `ex-arch-immersive-landing-architecture` — architecture defines the experience being deployed
- `edge-deployment-ci` — model deployment CI/CD (different artifact class)
- `aide-packaging-offline` — AIDE offline packaging (different product surface)
