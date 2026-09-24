import { test, expect } from '@playwright/test';

const hash = 'a'.repeat(64);
const localModel = {
  id: 'local-qwen', display_name: 'Local Qwen', family: 'Qwen', provider: 'local', locality: 'LOCAL',
  availability: 'INSTALLED', provider_state: null, offline_capable: true,
  qualification: { state: 'QUALIFIED', qualified_roles: ['IMPLEMENTER'], unqualified_roles: [], evidence_refs: ['passport/local-qwen'], stale: false, stale_reasons: [] },
  artifact: { label: 'qwen.gguf', revision: 'rev-1', hash, hash_status: 'verified', format: 'gguf', quantization: 'Q4_K_M' },
  runtime_backend: 'UNSLOTH', resource_requirements: { ram_mb: 1024, vram_mb: null, disk_mb: 1000 }, resource_fit: 'FIT',
  passport_ref: 'passport/local-qwen', evidence_refs: ['evidence/local-qwen'], known_strengths: ['tool-use'], known_failures: []
};
const staleModel = {
  ...localModel, id: 'stale-qwen', display_name: 'Stale Qwen',
  qualification: { state: 'STALE', qualified_roles: ['IMPLEMENTER'], unqualified_roles: [], evidence_refs: ['passport/stale'], stale: true, stale_reasons: ['artifact_hash_changed'] }
};
const cloudModel = {
  id: 'opencode/MiniMax-M3', display_name: 'MiniMax M3', family: 'MiniMax', provider: 'opencode', locality: 'CLOUD',
  availability: 'CONNECTED', provider_state: 'AUTHENTICATED', offline_capable: false,
  qualification: { state: 'TESTED', qualified_roles: ['REVIEWER'], unqualified_roles: [], evidence_refs: ['passport/minimax'], stale: false, stale_reasons: [] },
  artifact: { label: 'MiniMax-M3', revision: null, hash: null, hash_status: null, format: null, quantization: null },
  runtime_backend: null, resource_requirements: null, resource_fit: 'UNKNOWN', passport_ref: 'passport/minimax',
  evidence_refs: ['evidence/minimax'], known_strengths: [], known_failures: []
};
const snapshot = {
  generated_at: '2026-09-24T12:00:00.000Z', public_safe: true, available_ram_mb: 8192,
  local_discovery: { status: 'AVAILABLE', scanned_dirs: 1, discovered_count: 2, error_count: 0 }, provider_probe: 'AVAILABLE',
  models: [localModel, staleModel, cloudModel],
  providers: [{ id: 'opencode', state: 'AUTHENTICATED', model_ids: ['opencode/MiniMax-M3'] }],
  recommendation: {
    role: 'IMPLEMENTER', offline_only: false,
    recommended: [{ id: 'local-qwen', display_name: 'Local Qwen', reasons: ['ROLE_QUALIFIED', 'LOCAL_AVAILABLE'], evidence_refs: ['passport/local-qwen'], confidence: 'QUALIFIED' }],
    alternatives: [], excluded: [{ id: 'stale-qwen', reasons: ['INSUFFICIENT_EVIDENCE'] }]
  },
  model_packs: {
    catalog_status: 'AVAILABLE',
    items: [{
      id: 'qwen-pack', display_name: 'Qwen Pack Artifact', intended_role: 'IMPLEMENTER', source_repo: 'Qwen/Qwen-GGUF',
      declared_license: 'Apache-2.0', artifact_label: 'qwen-pack.gguf', expected_sha256: hash, expected_size_bytes: 1024,
      installation_state: 'MISSING', qualification_state: null, qualified_roles: [], resource_fit: 'UNKNOWN', matched_model_id: null, evidence_refs: []
    }],
    bundles: [{
      id: 'local-coder', version: '1.0.0', display_name: 'Covert Local Engineering Pack', summary: 'One local implementation model.',
      required_models: [{ model_id: 'qwen-pack', roles: ['IMPLEMENTER'] }], optional_models: [], provider_dependencies: [],
      runtime_requirements: [{ runtime_id: 'UNSLOTH', health_required: true, capabilities: [] }],
      qualification_requirements: [{ model_id: 'qwen-pack', roles: ['IMPLEMENTER'] }],
      resource_expectations: { ram_mb: null, vram_mb: null, disk_mb: null },
      state: 'AVAILABLE', installation_state: 'AVAILABLE', qualification_state: 'QUALIFICATION_REQUIRED',
      members: [{
        model_id: 'qwen-pack', required: true, roles: ['IMPLEMENTER'], display_name: 'Qwen Pack Artifact', source_repo: 'Qwen/Qwen-GGUF',
        artifact_filename: 'qwen-pack.gguf', artifact_revision: 'rev-1', expected_sha256: hash, declared_license: 'Apache-2.0',
        installation_state: 'MISSING', qualification_state: null, qualified_roles: [], resource_fit: 'UNKNOWN', evidence_refs: []
      }],
      block_reasons: ['QUALIFICATION_REQUIRED']
    }],
    offline_bundle: { id: 'offline', display_name: 'Offline Bundle', state: 'MISSING_DEPENDENCY', qualification_state: 'QUALIFICATION_MISSING', dependency_ids: ['qwen-pack'], installation_available: false },
    hybrid_setup: { state: 'QUALIFICATION_MISSING', qualified_local_implementers: 1, qualified_connected_cloud_reviewers: 0, configuration_only: true }
  },
  runtime: { canonical_name: 'UNSLOTH', registered: true, health: 'HEALTHY', health_detail: null, version: 'lab-fixture', ownership: 'fixture', loaded_models: [{ id: 'local-qwen', loaded: false, context_tokens: 4096 }, { id: 'stale-qwen', loaded: false, context_tokens: 4096 }], metrics: {}, capabilities: { tools: false, metrics: true, unload: false } },
  developer_notes: [{
    kind: 'developer-note', source: 'DEVELOPER_NOTES — James Ferrell', note_id: 'verify-first', title: 'Run the checks',
    body: 'A model saying work is finished is not evidence that work is finished. Run the checks.', category: 'VERIFICATION',
    trigger: null, priority: 1, dismissible: true, active: true
  }],
  system_advisories: [{ kind: 'system-advisory', id: 'qualification-pending', severity: 'CAUTION', title: 'Qualification pending', detail: 'One local artifact has not been qualified.', evidence_refs: ['evidence/model-manager'] }]
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/models/manager?**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: snapshot }) }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'MODEL MANAGER' })).toBeVisible();
});

test('isolated panel exercises ALL, LOCAL, CLOUD, MODEL PACKS, Unsloth, advisories, and Developer Notes', async ({ page }) => {
  await expect(page.locator('.mm-model-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'LOCAL', exact: true }).click();
  await expect(page.locator('.mm-model-card')).toHaveCount(2);
  await expect(page.getByText('Canonical runtime')).toBeVisible();
  await expect(page.locator('.mm-runtime-section')).toContainText('lab-fixture');
  await expect(page.locator('.mm-runtime-section')).toContainText('fixture');
  await page.getByRole('button', { name: 'CLOUD', exact: true }).click();
  await expect(page.locator('.mm-model-card')).toHaveCount(1);
  await expect(page.getByText('MiniMax M3')).toBeVisible();
  await page.getByRole('button', { name: 'MODEL PACKS', exact: true }).click();
  await expect(page.getByTestId('model-pack-local-coder')).toBeVisible();
  await expect(page.getByText('UNSLOTH · health required')).toBeVisible();
  await expect(page.locator('.mm-advisory-card')).toContainText('Qualification pending');
  await expect(page.locator('.mm-note-card')).toContainText('Run the checks');
  await expect(page.getByTestId('developer-special-offline')).toBeVisible();
});

test('selection requests show the explicit non-routing result and stale profiles stay blocked', async ({ page }) => {
  let selectionBody: unknown;
  await page.route('**/api/models/manager/selection-request', async route => {
    selectionBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ok: true,
      data: {
        decision: 'RECOMMENDED',
        selection_request: {
          requested_role: 'IMPLEMENTER', selected_intelligence_id: 'local-qwen',
          artifact_identity: { locality: 'LOCAL', artifact_id: 'qwen.gguf', revision: 'rev-1', sha256: hash, hash_status: 'verified' },
          qualification_state: 'QUALIFIED', operator_override: false, recommendation_evidence: ['passport/local-qwen'],
          reason_codes: ['ROLE_QUALIFIED', 'LOCAL_AVAILABLE'], scope: { project_id: `sha256:${hash}`, mission_id: null }, created_at: '2026-09-24T12:00:00.000Z'
        },
        block_reasons: [], routing_applied: false, authority_evaluated: false, resource_admission_evaluated: false
      }
    }) });
  });
  const staleCard = page.locator('.mm-model-card').filter({ hasText: 'Stale Qwen' });
  await expect(staleCard.getByRole('button', { name: 'CREATE ROLE SELECTION REQUEST' })).toBeDisabled();
  const localCard = page.locator('.mm-model-card').filter({ hasText: 'Local Qwen' });
  await localCard.getByRole('button', { name: 'CREATE ROLE SELECTION REQUEST' }).click();
  await expect(page.locator('.mm-selection-result')).toContainText('has not changed mission routing');
  expect(selectionBody).toEqual({ requested_role: 'IMPLEMENTER', selected_model_id: 'local-qwen', operator_override: false });
});

test('local pack import displays verified artifact identity without claiming qualification', async ({ page }) => {
  let installBody: unknown;
  await page.route('**/api/models/manager/packs/install', async route => {
    installBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      ok: true,
      data: {
        model_id: 'qwen-pack', installed: true, idempotent: false, destination_filename: 'qwen-pack.gguf', artifact_sha256: hash,
        identity_verification: 'EXPECTED_HASH_MATCH', availability: 'INSTALLED', qualification_state: 'UNTESTED', qualification_changed: false, runtime: 'UNSLOTH'
      }
    }) });
  });
  await page.getByRole('button', { name: 'MODEL PACKS', exact: true }).click();
  await page.getByLabel('Local artifact path for Qwen Pack Artifact').fill('C:\\models\\qwen-pack.gguf');
  await page.getByRole('button', { name: 'VERIFY AND IMPORT LOCAL GGUF' }).click();
  await expect(page.locator('.mm-install-result')).toContainText('LOCAL ARTIFACT VERIFIED AND REGISTERED');
  await expect(page.locator('.mm-install-result')).toContainText('Qualification: UNTESTED');
  expect(installBody).toEqual({ model_id: 'qwen-pack', source_path: 'C:\\models\\qwen-pack.gguf' });
});
