import assert from 'node:assert/strict';
import { generateKeyPairSync, sign, X509Certificate, createHash, type KeyObject } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { PartnerEvent, PartnerHello, PartnerHelloRequest, PartnerMetric, PartnerPairingPending,
  PartnerProofChallenge, PartnerProtocolError, PartnerSnapshot, PairingChallenge, PartnerDevicePrincipal,
  type PairingChallengeT, type PartnerProofChallengeT } from '../../common/contracts/partner.ts';
import { partnerKeyThumbprint, partnerPairingSigningBytes, partnerRequestBodyDigest,
  partnerRequestSigningBytes } from '../../common/security/partner-proof.mjs';
import { isPrivatePlatformStatePath } from '../../common/security/private-platform-state.mjs';
import { createExecutionAuthority } from '../../node/src/services/execution-authority.mjs';
import { listenPartnerProtocol } from '../../node/src/services/partner-protocol.ts';
import { ArchServer } from '../../node/src/server.ts';
import { pairFixture } from './authority-fixture.ts';

type JsonReply = { status: number; raw: string; body: unknown };
type DeviceKeys = { privateKey: KeyObject; publicKey: { kty: 'EC'; crv: 'P-256'; x: string; y: string } };

const TEST_ORIGIN = 'http://partner-protocol.test';
const FIXTURE_DIR = path.resolve('tests/fixtures/partner-protocol');

async function testTlsMaterial() {
  return {
    certificate: await fs.readFile(path.join(FIXTURE_DIR, 'partner-test-cert.pem')),
    key: await fs.readFile(path.join(FIXTURE_DIR, 'partner-test-key.pem'))
  };
}

async function makeWorkspace(prefix = 'covert-partner-protocol-') {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function unassignedPrivateAddress(): string {
  const assigned = new Set(Object.values(os.networkInterfaces()).flatMap(entries => entries ?? []).map(entry => entry.address));
  const candidate = Array.from({ length: 254 }, (_, index) => `10.250.250.${index + 1}`).find(address => !assigned.has(address));
  assert.ok(candidate, 'test host must have an unassigned address in the private test range');
  return candidate;
}

function makeKeys(): DeviceKeys {
  const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = pair.publicKey.export({ format: 'jwk' });
  assert.equal(jwk.kty, 'EC');
  assert.equal(jwk.crv, 'P-256');
  assert.equal(typeof jwk.x, 'string');
  assert.equal(typeof jwk.y, 'string');
  return { privateKey: pair.privateKey, publicKey: { kty: 'EC', crv: 'P-256', x: jwk.x!, y: jwk.y! } };
}

function signedConfirmation(challenge: PairingChallengeT, keys: DeviceKeys, deviceName: string, signedAt = new Date().toISOString()) {
  const unsigned = {
    schema: 'covert.partner-pairing-confirmation.v1' as const,
    protocol: challenge.protocol,
    challenge_id: challenge.challenge_id,
    workstation_id: challenge.workstation_id,
    workstation_fingerprint: challenge.workstation_fingerprint,
    device_name: deviceName,
    public_key: keys.publicKey,
    key_thumbprint: partnerKeyThumbprint(keys.publicKey),
    signed_at: signedAt
  };
  return { ...unsigned, signature: sign('sha256', partnerPairingSigningBytes(challenge, unsigned), {
    key: keys.privateKey, dsaEncoding: 'ieee-p1363'
  }).toString('base64url') };
}

function requestTls(port: number, pathname: string, method: 'GET' | 'POST', body?: unknown, headers: Record<string, string> = {},
  localAddress = '127.0.0.1'): Promise<JsonReply> {
  const bytes = body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const request = https.request({ hostname: '127.0.0.1', localAddress, port, path: pathname, method,
      rejectUnauthorized: false, headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json', 'content-length': String(bytes.byteLength) }),
        ...headers
      } }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let parsed: unknown = null;
        try { parsed = JSON.parse(raw) as unknown; } catch { /* preserve body bytes for the assertion */ }
        resolve({ status: response.statusCode ?? 0, raw, body: parsed });
      });
    });
    request.once('error', reject);
    request.end(bytes);
  });
}

function closeServer(server: http.Server | https.Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function directAuthority(workspace: string, clock: () => number = Date.now) {
  const auditRows: Array<Readonly<Record<string, unknown>>> = [];
  const authority = createExecutionAuthority({ workspace, clock, record: async event => {
    auditRows.push(event);
    return { persisted: true };
  } });
  return { authority, auditRows };
}

async function operatorFor(authority: ReturnType<typeof createExecutionAuthority>) {
  const proof = authority.control.createPairing(TEST_ORIGIN);
  const paired = await authority.pair(proof, TEST_ORIGIN);
  return { token: paired.token, actor: authority.authenticate(paired.token, TEST_ORIGIN) };
}

function signedRequestProof(deviceId: string, challenge: PartnerProofChallengeT,
  privateKey: DeviceKeys['privateKey']) {
  const unsigned = {
    schema: 'covert.partner-request-proof.v1' as const,
    device_id: deviceId,
    challenge_id: challenge.challenge_id,
    issued_at: new Date().toISOString(),
    method: 'GET' as const,
    path: '/partner/v1/snapshot',
    body_sha256: partnerRequestBodyDigest(Buffer.alloc(0))
  };
  return { ...unsigned, signature: sign('sha256', partnerRequestSigningBytes(unsigned, challenge), {
    key: privateKey, dsaEncoding: 'ieee-p1363'
  }).toString('base64url') };
}

test('Partner contracts are strict, versioned, and preserve unknown metrics as unknown', () => {
  const workstationId = '00000000-0000-4000-8000-000000000001';
  assert.equal(PartnerHelloRequest.parse({ schema: 'covert.partner-hello-request.v1', protocol: { major: 2, minor: 0 },
    client_instance_id: '00000000-0000-4000-8000-000000000002' }).protocol.major, 2,
  'major versions parse as data so the protocol boundary can return a deliberate mismatch response');
  assert.equal(PartnerHello.safeParse({ schema: 'covert.partner-hello.v1', protocol: { major: 1, minor: 0 },
    workstation_id: workstationId, workstation_fingerprint: 'a'.repeat(64), server_time: new Date().toISOString(),
    pairing_enabled: true, device_proof_required: true, features: ['pairing.confirmation.v1', 'device-proof.v1'] }).success, true);
  assert.equal(PartnerMetric.safeParse({ schema: 'covert.partner-metric.v1', metric_id: 'cpu.utilization_pct',
    state: 'UNKNOWN', value: null, unit: null, observed_at: null }).success, true);
  assert.equal(PartnerMetric.safeParse({ schema: 'covert.partner-metric.v1', metric_id: 'cpu.utilization_pct',
    state: 'UNKNOWN', value: 0, unit: 'percent', observed_at: new Date().toISOString() }).success, false,
  'unknown telemetry cannot be represented as a zero reading');
  const event = { schema: 'covert.partner-event.v1', protocol: { major: 1, minor: 0 }, event_id: '00000000-0000-4000-8000-000000000003',
    sequence: 1, workstation_id: workstationId, occurred_at: new Date().toISOString(), event_type: 'work.queued',
    project_id: null, worker_id: null, evidence_ref: null, summary: 'Work queued' };
  assert.equal(PartnerEvent.safeParse({ ...event, bearer: 'must-not-cross-protocol' }).success, false,
    'event contracts reject arbitrary credential-bearing fields');
  assert.equal(PartnerProtocolError.safeParse({ schema: 'covert.partner-error.v1', code: 'PROTOCOL_MAJOR_MISMATCH',
    message: 'Partner protocol major version is unsupported' }).success, true);
  assert.equal(isPrivatePlatformStatePath('.aide/platform-authority/partner-devices.json', 'win32'), true);
  assert.equal(isPrivatePlatformStatePath('.aide/platform-authority-public.json', 'win32'), false);
});

test('Authority pairing binds host and key, consumes the challenge once, requires operator confirmation, and enforces scopes', async () => {
  const workspace = await makeWorkspace();
  let now = Date.now();
  const authorityResult = await directAuthority(workspace, () => now);
  const fingerprint = 'a'.repeat(64);
  try {
    await authorityResult.authority.partner.initialize(fingerprint);
    const operator = await operatorFor(authorityResult.authority);
    const resident = authorityResult.authority.control.delegate(operator.actor, 'agent', []);
    await assert.rejects(authorityResult.authority.control.createPartnerPairingChallenge(resident, ['system.read']), { code: 'FORBIDDEN' },
      'a Resident or delegated worker cannot create device grants');
    const challenge = await authorityResult.authority.control.createPartnerPairingChallenge(operator.actor, ['system.read', 'work.read']);
    const keys = makeKeys();
    const wrongHost = signedConfirmation(challenge, keys, 'field-device');
    const reorderedPublicKey = { ...wrongHost, public_key: {
      y: keys.publicKey.y, x: keys.publicKey.x, crv: keys.publicKey.crv, kty: keys.publicKey.kty
    } };
    assert.deepEqual(partnerPairingSigningBytes(challenge, reorderedPublicKey), partnerPairingSigningBytes(challenge, wrongHost),
      'signature framing binds key values with a stable field order across JSON runtimes');
    const wrongWorkstationId = { ...wrongHost, workstation_id: '00000000-0000-4000-8000-000000000099' };
    const wrongWorkstation = { ...wrongHost, workstation_fingerprint: 'b'.repeat(64) };
    await assert.rejects(authorityResult.authority.partner.submitPairingConfirmation(wrongWorkstationId), { code: 'FORBIDDEN' });
    await assert.rejects(authorityResult.authority.partner.submitPairingConfirmation(wrongWorkstation), { code: 'FORBIDDEN' });

    const confirmation = signedConfirmation(challenge, keys, 'field-device');
    const pending = await authorityResult.authority.partner.submitPairingConfirmation(confirmation);
    assert.equal(PartnerPairingPending.safeParse(pending).success, true);
    assert.equal(pending.state, 'AWAITING_OPERATOR');
    await assert.rejects(authorityResult.authority.partner.submitPairingConfirmation(confirmation), { code: 'CONFLICT' },
      'the exact signed pairing confirmation is one-use');
    await assert.rejects(authorityResult.authority.partner.createProofChallenge(pending.device_id), { code: 'FORBIDDEN' },
      'a phone cannot activate its own pending identity');

    const approvalsBeforeInvalidScope = authorityResult.auditRows.filter(row => row.kind === 'partner.device.pairing.approval').length;
    await assert.rejects(authorityResult.authority.control.confirmPartnerPairing(operator.actor, pending.pending_id, ['cipher.chat.send']),
      { code: 'FORBIDDEN' }, 'approval cannot add a scope the device did not request');
    assert.equal(authorityResult.auditRows.filter(row => row.kind === 'partner.device.pairing.approval').length, approvalsBeforeInvalidScope,
      'an invalid scope request is rejected before an approval audit event is written');
    await assert.rejects(authorityResult.authority.control.confirmPartnerPairing(resident, pending.pending_id, ['system.read']),
      { code: 'FORBIDDEN' }, 'a Resident or delegated worker cannot approve its own device grant');
    const principal = await authorityResult.authority.control.confirmPartnerPairing(operator.actor, pending.pending_id, ['system.read']);
    assert.equal(PartnerDevicePrincipal.safeParse(principal).success, true);
    assert.deepEqual(principal.scopes, ['system.read']);
    assert.equal('token' in principal, false, 'Partner principal is not an operator bearer session');
    assert.equal((await authorityResult.authority.partner.requireScope(principal.device_id, 'system.read')).device_id, principal.device_id);
    await assert.rejects(authorityResult.authority.partner.requireScope(principal.device_id, 'work.read'), { code: 'FORBIDDEN' });

    const expired = await authorityResult.authority.control.createPartnerPairingChallenge(operator.actor, ['system.read']);
    now = new Date(expired.expires_at).getTime() + 1;
    const expiredConfirmation = signedConfirmation(expired, makeKeys(), 'expired-device', new Date(now).toISOString());
    await assert.rejects(authorityResult.authority.partner.submitPairingConfirmation(expiredConfirmation), { code: 'CONFLICT' });
  } finally {
    authorityResult.authority.control.close();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('TLS Partner adapter rejects version drift, bearer/cookie material, proof replay, and missing scopes', async () => {
  const workspace = await makeWorkspace();
  const { certificate, key } = await testTlsMaterial();
  const certFingerprint = createHash('sha256').update(new X509Certificate(certificate).raw).digest('hex');
  const { authority, auditRows } = await directAuthority(workspace);
  const logs: string[] = [];
  let snapshotCalls = 0;
  let listener: https.Server | undefined;
  try {
    const snapshot = {
      schema: 'covert.partner-snapshot.v1' as const,
      protocol: { major: 1 as const, minor: 0 as const },
      snapshot_id: '00000000-0000-4000-8000-000000000010',
      workstation_id: '00000000-0000-4000-8000-000000000011',
      captured_at: new Date().toISOString(), resident_state: 'UNKNOWN' as const,
      loaded_model_label: null, metrics: [], workers: [], queued_work_count: null, pending_operator_decision_count: null
    };
    listener = await listenPartnerProtocol({ authority, bind_host: '127.0.0.1', lan_cidr: '127.0.0.1/32', port: 0,
      tls_key: key, tls_certificate: certificate,
      logger: { warn: (_message, metadata) => logs.push(JSON.stringify(metadata)), error: (_message, metadata) => logs.push(JSON.stringify(metadata)) },
      snapshot: async () => { snapshotCalls++; return PartnerSnapshot.parse({ ...snapshot,
        workstation_id: authority.partner.workstation().workstation_id }); }
    });
    const address = listener.address();
    assert.ok(address && typeof address === 'object');
    const port = address.port;

    const helloBody = { schema: 'covert.partner-hello-request.v1', protocol: { major: 1, minor: 0 },
      client_instance_id: '00000000-0000-4000-8000-000000000013' };
    const helloReadOnly = await requestTls(port, '/partner/v1/hello', 'POST', helloBody);
    assert.equal(helloReadOnly.status, 200);
    assert.ok(PartnerHello.parse(helloReadOnly.body).features.includes('read-only.snapshot.v1'));

    const mismatch = await requestTls(port, '/partner/v1/hello', 'POST', {
      schema: 'covert.partner-hello-request.v1', protocol: { major: 2, minor: 0 },
      client_instance_id: '00000000-0000-4000-8000-000000000012'
    });
    assert.equal(mismatch.status, 426);
    assert.equal(PartnerProtocolError.parse(mismatch.body).code, 'PROTOCOL_MAJOR_MISMATCH');

    const hello = await requestTls(port, '/partner/v1/hello', 'POST', helloBody, { authorization: 'Bearer envoy-test-credential-marker' });
    assert.equal(hello.status, 400);
    assert.equal(hello.raw.includes('envoy-test-credential-marker'), false);
    const helloOk = await requestTls(port, '/partner/v1/hello', 'POST', helloBody, { cookie: 'session=envoy-test-credential-marker' });
    assert.equal(helloOk.status, 400);

    const operator = await operatorFor(authority);
    const challenge = await authority.control.createPartnerPairingChallenge(operator.actor, ['system.read', 'work.read']);
    const deviceKeys = makeKeys();
    const confirmation = signedConfirmation(challenge, deviceKeys, 'field-device');
    const serializedConfirmation = JSON.stringify(confirmation);
    const paired = await requestTls(port, '/partner/v1/pairing-confirmations', 'POST', confirmation, { 'x-covert-partner-major': '1' });
    assert.equal(paired.status, 202);
    const pending = PartnerPairingPending.parse(paired.body);
    assert.equal(paired.raw.includes('signature'), false);
    assert.equal(paired.raw.includes(operator.token), false);
    assert.equal(serializedConfirmation.includes(confirmation.signature), true, 'test uses an actual signed device challenge');
    const replay = await requestTls(port, '/partner/v1/pairing-confirmations', 'POST', confirmation, { 'x-covert-partner-major': '1' });
    assert.equal(replay.status, 409);

    const beforeApproval = await requestTls(port, '/partner/v1/proof-challenges', 'POST', {
      schema: 'covert.partner-proof-challenge-request.v1', device_id: pending.device_id
    }, { 'x-covert-partner-major': '1' });
    assert.equal(beforeApproval.status, 403, 'phone authentication cannot approve or self-activate a pairing');

    const principal = await authority.control.confirmPartnerPairing(operator.actor, pending.pending_id, ['system.read']);
    const challengeResponse = await requestTls(port, '/partner/v1/proof-challenges', 'POST', {
      schema: 'covert.partner-proof-challenge-request.v1', device_id: principal.device_id
    }, { 'x-covert-partner-major': '1' });
    assert.equal(challengeResponse.status, 200);
    const requestChallenge = PartnerProofChallenge.parse(challengeResponse.body);
    const proof = signedRequestProof(principal.device_id, requestChallenge, deviceKeys.privateKey);
    const proofHeader = Buffer.from(JSON.stringify(proof)).toString('base64url');
    const unauthorized = await requestTls(port, '/partner/v1/snapshot', 'GET', undefined, {
      'x-covert-partner-major': '1', 'x-covert-partner-proof': proofHeader
    });
    assert.equal(unauthorized.status, 403, 'system.read cannot read the combined System and Work projection without work.read');
    assert.equal(snapshotCalls, 0, 'unauthorized projection never reaches its provider');
    assert.equal(PartnerProtocolError.parse(unauthorized.body).code, 'FORBIDDEN');
    const proofReplay = await requestTls(port, '/partner/v1/snapshot', 'GET', undefined, {
      'x-covert-partner-major': '1', 'x-covert-partner-proof': proofHeader
    });
    assert.equal(proofReplay.status, 409, 'device proof challenge is one-use');

    const fullChallenge = await authority.control.createPartnerPairingChallenge(operator.actor, ['system.read', 'work.read']);
    const fullDeviceKeys = makeKeys();
    const fullConfirmation = signedConfirmation(fullChallenge, fullDeviceKeys, 'field-device-full-scope');
    const fullPairing = await requestTls(port, '/partner/v1/pairing-confirmations', 'POST', fullConfirmation, { 'x-covert-partner-major': '1' });
    assert.equal(fullPairing.status, 202);
    const fullPending = PartnerPairingPending.parse(fullPairing.body);
    const fullPrincipal = await authority.control.confirmPartnerPairing(operator.actor, fullPending.pending_id, ['system.read', 'work.read']);
    const fullProofChallengeResponse = await requestTls(port, '/partner/v1/proof-challenges', 'POST', {
      schema: 'covert.partner-proof-challenge-request.v1', device_id: fullPrincipal.device_id
    }, { 'x-covert-partner-major': '1' });
    assert.equal(fullProofChallengeResponse.status, 200);
    const fullProofChallenge = PartnerProofChallenge.parse(fullProofChallengeResponse.body);
    const fullProof = signedRequestProof(fullPrincipal.device_id, fullProofChallenge, fullDeviceKeys.privateKey);
    const fullProofHeader = Buffer.from(JSON.stringify(fullProof)).toString('base64url');
    const signedBodyRequest = await requestTls(port, '/partner/v1/snapshot', 'GET', { unexpected: 'body' }, {
      'x-covert-partner-major': '1', 'x-covert-partner-proof': fullProofHeader
    });
    assert.equal(signedBodyRequest.status, 400, 'snapshot proof binding rejects an unsigned GET body');
    assert.equal(PartnerProtocolError.parse(signedBodyRequest.body).code, 'INVALID_REQUEST');
    assert.equal(snapshotCalls, 0);
    const snapshotResponse = await requestTls(port, '/partner/v1/snapshot', 'GET', undefined, {
      'x-covert-partner-major': '1', 'x-covert-partner-proof': fullProofHeader
    });
    assert.equal(snapshotResponse.status, 200);
    assert.equal(PartnerSnapshot.parse(snapshotResponse.body).workstation_id, authority.partner.workstation().workstation_id);
    assert.equal(snapshotCalls, 1, 'a properly scoped, device-signed request reaches the configured projection once');

    await assert.rejects(listenPartnerProtocol({ authority, bind_host: '0.0.0.0', lan_cidr: '0.0.0.0/24', port: 0,
      tls_key: key, tls_certificate: certificate }), /private IPv4|explicit IPv4/,
    'public/wildcard binding is rejected before listen');
    const unassignedAddress = unassignedPrivateAddress();
    const [first, second, third] = unassignedAddress.split('.');
    await assert.rejects(listenPartnerProtocol({ authority, bind_host: unassignedAddress, lan_cidr: `${first}.${second}.${third}.0/24`, port: 0,
      tls_key: key, tls_certificate: certificate }), /assigned to a local IPv4 interface/,
    'a private address that is not assigned to this workstation cannot be exposed as its Partner listener');
    await assert.rejects(listenPartnerProtocol({ authority, bind_host: '127.0.0.1', lan_cidr: '127.0.0.1/32', port: 0,
      tls_key: key, tls_certificate: '' }), /TLS certificate and private key are required/);
    assert.equal(logs.some(value => value.includes('envoy-test-credential-marker') || value.includes(confirmation.signature)), false,
      'Partner logs contain neither supplied credential-like headers nor signatures');
    const protocolResponses = [mismatch.raw, helloReadOnly.raw, hello.raw, helloOk.raw, paired.raw, replay.raw, beforeApproval.raw,
      challengeResponse.raw, unauthorized.raw, proofReplay.raw, signedBodyRequest.raw, snapshotResponse.raw].join('\n');
    assert.equal(protocolResponses.includes(operator.token), false, 'no Partner response carries the operator bearer');
    assert.equal(protocolResponses.includes('BEGIN PRIVATE KEY'), false);
    assert.ok(auditRows.length > 0, 'existing Authority audit path recorded pairing control decisions');
    assert.equal(certFingerprint, authority.partner.workstation().workstation_fingerprint);
  } finally {
    if (listener) await closeServer(listener);
    authority.control.close();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('revocation and last-seen survive a separate Authority process restart', async () => {
  const workspace = await makeWorkspace();
  const { certificate } = await testTlsMaterial();
  const fingerprint = createHash('sha256').update(new X509Certificate(certificate).raw).digest('hex');
  const { authority } = await directAuthority(workspace);
  try {
    await authority.partner.initialize(fingerprint);
    const operator = await operatorFor(authority);
    const challenge = await authority.control.createPartnerPairingChallenge(operator.actor, ['system.read']);
    const keys = makeKeys();
    const pending = await authority.partner.submitPairingConfirmation(signedConfirmation(challenge, keys, 'revocable-device'));
    const principal = await authority.control.confirmPartnerPairing(operator.actor, pending.pending_id, ['system.read']);
    const proofChallenge = await authority.partner.createProofChallenge(principal.device_id);
    const proof = signedRequestProof(principal.device_id, proofChallenge, keys.privateKey);
    await authority.partner.verifyRequestProof(proof, { method: 'GET', path: '/partner/v1/snapshot',
      body_sha256: partnerRequestBodyDigest(Buffer.alloc(0)), issued_at: proof.issued_at });
    const revoked = await authority.control.revokePartnerDevice(operator.actor, principal.device_id);
    assert.equal(revoked.state, 'REVOKED');
    assert.ok(revoked.revoked_at);

    authority.control.close();
    const probePath = path.resolve('tests/fixtures/partner-protocol/restart-probe.mjs');
    const child = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', probePath], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 15000, windowsHide: true,
      env: { ...process.env, PARTNER_TEST_WORKSPACE: workspace, PARTNER_TEST_FINGERPRINT: fingerprint,
        PARTNER_TEST_DEVICE_ID: principal.device_id }
    });
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.trim(), 'REVOKED_WITH_LAST_SEEN');
  } finally {
    authority.control.close();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('broad workstation API stays loopback-only and Partner pairing administration uses the existing operator route', async () => {
  const workspace = await makeWorkspace('covert-partner-admin-');
  const { certificate, key } = await testTlsMaterial();
  const arch = new ArchServer(workspace, path.join(workspace, '.aide', 'logs', 'partner-admin-test.log'));
  let broad: http.Server | undefined;
  let partner: https.Server | undefined;
  try {
    await assert.rejects(arch.listen(0, '0.0.0.0'), /bound to 127\.0\.0\.1/,
      'the broad workstation API rejects explicit non-loopback binding');
    broad = await arch.listen(0);
    const address = broad.address();
    assert.ok(address && typeof address === 'object');
    assert.equal(address.address, '127.0.0.1');
    const base = `http://127.0.0.1:${address.port}`;
    const unauthenticated = await fetch(`${base}/api/partner/pairings/challenge`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requested_scopes: ['system.read'] })
    });
    assert.equal(unauthenticated.status, 403);

    const operator = await pairFixture(arch, base);
    partner = await arch.listenPartner({ bind_host: '127.0.0.1', lan_cidr: '127.0.0.1/32', port: 0,
      tls_key: key, tls_certificate: certificate });
    const partnerAddress = partner.address();
    assert.ok(partnerAddress && typeof partnerAddress === 'object');
    const partnerHello = await requestTls(partnerAddress.port, '/partner/v1/hello', 'POST', {
      schema: 'covert.partner-hello-request.v1', protocol: { major: 1, minor: 0 },
      client_instance_id: '00000000-0000-4000-8000-000000000040'
    });
    assert.equal(partnerHello.status, 200);
    assert.equal(PartnerHello.parse(partnerHello.body).features.includes('read-only.snapshot.v1'), false,
      'snapshot is not advertised without a real projection provider');
    const snapshotUnavailable = await requestTls(partnerAddress.port, '/partner/v1/snapshot', 'GET', undefined,
      { 'x-covert-partner-major': '1' });
    assert.equal(snapshotUnavailable.status, 503);
    assert.equal(PartnerProtocolError.parse(snapshotUnavailable.body).code, 'PROJECTION_UNAVAILABLE');
    const noActions = await requestTls(partnerAddress.port, '/partner/v1/actions', 'POST', undefined,
      { 'x-covert-partner-major': '1' });
    assert.equal(noActions.status, 404, 'worker stop, approval, shell, and other Partner action routes are not implemented');
    const response = await operator.request('/api/partner/pairings/challenge', {
      method: 'POST', body: JSON.stringify({ requested_scopes: ['system.read', 'work.read'] })
    });
    assert.equal(response.status, 200);
    const envelope = await response.json() as { ok: boolean; data: unknown };
    assert.equal(envelope.ok, true);
    assert.equal(PairingChallenge.safeParse(envelope.data).success, true);
    assert.equal((await operator.request('/api/partner/devices')).status, 200);
    assert.equal((await operator.request('/api/partner/pairings/pending')).status, 200);
  } finally {
    if (partner) await closeServer(partner);
    if (broad) await closeServer(broad);
    await arch.logger.flush();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('pairing transactions serialize concurrent confirmations, reject duplicate keys, and keep device scopes out of Authority', async () => {
  const workspace = await makeWorkspace('covert-partner-concurrency-');
  const { authority } = await directAuthority(workspace);
  const fingerprint = 'c'.repeat(64);
  try {
    await authority.partner.initialize(fingerprint);
    const operator = await operatorFor(authority);
    await assert.rejects(authority.control.createPartnerPairingChallenge(operator.actor, [] as never), { code: 'BAD_REQUEST' },
      'a challenge must request at least one supported scope');
    await assert.rejects(authority.control.createPartnerPairingChallenge(operator.actor, ['system.read', 'terminal.exec'] as never),
      { code: 'BAD_REQUEST' }, 'unknown scopes cannot enter a durable challenge');

    const challenge = await authority.control.createPartnerPairingChallenge(operator.actor, ['system.read']);
    const keys = makeKeys();
    const confirmation = signedConfirmation(challenge, keys, 'race-device');
    const attempts = await Promise.allSettled([
      authority.partner.submitPairingConfirmation(confirmation),
      authority.partner.submitPairingConfirmation(confirmation)
    ]);
    const successes = attempts.filter((attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof authority.partner.submitPairingConfirmation>>> =>
      attempt.status === 'fulfilled');
    const failures = attempts.filter((attempt): attempt is PromiseRejectedResult => attempt.status === 'rejected');
    assert.equal(successes.length, 1, 'only one concurrent pairing confirmation may consume a challenge');
    assert.equal(failures.length, 1);
    const rejected = failures[0];
    assert.ok(rejected, 'the rejected concurrent pairing attempt is present');
    assert.equal((rejected.reason as { code?: string }).code, 'CONFLICT');
    const completed = successes[0];
    assert.ok(completed, 'the successful concurrent pairing attempt is present');
    const pending = completed.value;

    const duplicatePendingChallenge = await authority.control.createPartnerPairingChallenge(operator.actor, ['system.read']);
    await assert.rejects(authority.partner.submitPairingConfirmation(
      signedConfirmation(duplicatePendingChallenge, keys, 'duplicate-pending-device')), { code: 'CONFLICT' },
    'the same public key cannot register a second pending device');

    const principal = await authority.control.confirmPartnerPairing(operator.actor, pending.pending_id, ['system.read']);
    await assert.rejects(authority.control.createPartnerPairingChallenge(principal as never, ['system.read']),
      { code: 'FORBIDDEN' }, 'a Partner device principal is not an Authority actor');
    await assert.rejects(authority.control.confirmPartnerPairing(principal as never, pending.pending_id, ['system.read']),
      { code: 'FORBIDDEN' }, 'a Partner device principal cannot approve grants');

    const duplicateActiveChallenge = await authority.control.createPartnerPairingChallenge(operator.actor, ['system.read']);
    await assert.rejects(authority.partner.submitPairingConfirmation(
      signedConfirmation(duplicateActiveChallenge, keys, 'duplicate-active-device')), { code: 'CONFLICT' },
    'an active key cannot be registered a second time');

    const revoked = await authority.control.revokePartnerDevice(operator.actor, principal.device_id);
    assert.equal(revoked.state, 'REVOKED');
    await assert.rejects(authority.partner.requireScope(principal.device_id, 'system.read'), { code: 'FORBIDDEN' });
    await assert.rejects(authority.partner.createProofChallenge(principal.device_id), { code: 'FORBIDDEN' },
      'revoked devices cannot obtain request-proof challenges');

    const rePairChallenge = await authority.control.createPartnerPairingChallenge(operator.actor, ['system.read']);
    await assert.rejects(authority.partner.submitPairingConfirmation(
      signedConfirmation(rePairChallenge, keys, 'revoked-key-repair')), { code: 'CONFLICT' },
    'a revoked public-key identity remains durably unavailable');
    const replacementKeys = makeKeys();
    const replacementChallenge = await authority.control.createPartnerPairingChallenge(operator.actor, ['system.read']);
    const replacement = await authority.partner.submitPairingConfirmation(
      signedConfirmation(replacementChallenge, replacementKeys, 'replacement-device'));
    assert.equal(replacement.state, 'AWAITING_OPERATOR', 'a replacement key can begin a separately approved pairing');
  } finally {
    authority.control.close();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('corrupt Partner registry fails closed without overwriting the recoverable bytes', async () => {
  const workspace = await makeWorkspace('covert-partner-corrupt-state-');
  const fingerprint = 'd'.repeat(64);
  const initial = await directAuthority(workspace);
  const restarted = await directAuthority(workspace);
  const statePath = path.join(workspace, '.aide', 'platform-authority', 'partner-devices.json');
  const corruptBytes = Buffer.from('{"schema":"covert.partner-device-state.v1",', 'utf8');
  try {
    await initial.authority.partner.initialize(fingerprint);
    initial.authority.control.close();
    await fs.writeFile(statePath, corruptBytes);
    await assert.rejects(restarted.authority.partner.initialize(fingerprint), { code: 'NOT_READY' },
      'registry corruption is not repaired or replaced implicitly');
    assert.deepEqual(await fs.readFile(statePath), corruptBytes, 'failed initialization preserves the original corrupt evidence');
  } finally {
    initial.authority.control.close();
    restarted.authority.control.close();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('Partner listener is opt-in and startup failure leaves the loopback API available', async () => {
  const workspace = await makeWorkspace('covert-partner-listener-failure-');
  const { key } = await testTlsMaterial();
  const arch = new ArchServer(workspace, path.join(workspace, '.aide', 'logs', 'partner-listener-failure.log'));
  let broad: http.Server | undefined;
  try {
    broad = await arch.listen(0);
    const address = broad.address();
    assert.ok(address && typeof address === 'object');
    const base = 'http://127.0.0.1:' + address.port;
    const partnerRouteOnBroadApi = await fetch(base + '/partner/v1/hello', { method: 'POST' });
    assert.equal(partnerRouteOnBroadApi.status, 404, 'the broad API does not expose the Partner protocol');
    await assert.rejects(arch.listenPartner({ bind_host: '127.0.0.1', lan_cidr: '127.0.0.1/32', port: 0,
      tls_key: key, tls_certificate: '' }), /TLS certificate and private key are required/);
    const broadRouteAfterFailure = await fetch(base + '/api/partner/pairings/pending');
    assert.equal(broadRouteAfterFailure.status, 403, 'a failed Partner listener does not stop the workstation API');
  } finally {
    if (broad) await closeServer(broad);
    await arch.logger.flush();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('TLS pairing rejects malformed payloads and wrong device keys without consuming the valid challenge', async () => {
  const workspace = await makeWorkspace('covert-partner-invalid-pairing-');
  const { certificate, key } = await testTlsMaterial();
  const { authority } = await directAuthority(workspace);
  const logs: string[] = [];
  let listener: https.Server | undefined;
  try {
    listener = await listenPartnerProtocol({ authority, bind_host: '127.0.0.1', lan_cidr: '127.0.0.1/32', port: 0,
      tls_key: key, tls_certificate: certificate,
      logger: { warn: (_message, metadata) => logs.push(JSON.stringify(metadata)), error: (_message, metadata) => logs.push(JSON.stringify(metadata)) } });
    const address = listener.address();
    assert.ok(address && typeof address === 'object');
    const operator = await operatorFor(authority);
    const challenge = await authority.control.createPartnerPairingChallenge(operator.actor, ['system.read']);
    const keys = makeKeys();
    const confirmation = signedConfirmation(challenge, keys, 'valid-device');
    const wrongSigner = makeKeys();
    const wrongKey = { ...confirmation, public_key: wrongSigner.publicKey, key_thumbprint: partnerKeyThumbprint(wrongSigner.publicKey) };
    const wrongKeyResponse = await requestTls(address.port, '/partner/v1/pairing-confirmations', 'POST', wrongKey, { 'x-covert-partner-major': '1' });
    assert.equal(wrongKeyResponse.status, 403, 'signature/key mismatch is rejected');
    assert.equal(PartnerProtocolError.parse(wrongKeyResponse.body).code, 'FORBIDDEN');

    const secretMarker = 'partner-payload-secret-marker';
    const malformed = await requestTls(address.port, '/partner/v1/pairing-confirmations', 'POST',
      { ...confirmation, unexpected_secret: secretMarker }, { 'x-covert-partner-major': '1' });
    assert.equal(malformed.status, 400);
    assert.equal(PartnerProtocolError.parse(malformed.body).code, 'INVALID_REQUEST');
    assert.equal(malformed.raw.includes(secretMarker), false, 'invalid payloads are not reflected');
    assert.equal(logs.some(value => value.includes(secretMarker)), false, 'invalid payloads are not logged');

    const paired = await requestTls(address.port, '/partner/v1/pairing-confirmations', 'POST', confirmation, { 'x-covert-partner-major': '1' });
    assert.equal(paired.status, 202, 'invalid attempts do not consume the valid one-use challenge');
    const replay = await requestTls(address.port, '/partner/v1/pairing-confirmations', 'POST', confirmation, { 'x-covert-partner-major': '1' });
    assert.equal(replay.status, 409);
    assert.equal(paired.raw.includes(operator.token), false, 'Partner responses never return the operator bearer');
  } finally {
    if (listener) await closeServer(listener);
    authority.control.close();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('TLS Partner listener denies peers outside its configured LAN scope', async () => {
  const workspace = await makeWorkspace('covert-partner-peer-scope-');
  const { certificate, key } = await testTlsMaterial();
  const { authority } = await directAuthority(workspace);
  let listener: https.Server | undefined;
  try {
    listener = await listenPartnerProtocol({ authority, bind_host: '127.0.0.1', lan_cidr: '127.0.0.1/32', port: 0,
      tls_key: key, tls_certificate: certificate });
    const address = listener.address();
    assert.ok(address && typeof address === 'object');
    const hello = { schema: 'covert.partner-hello-request.v1', protocol: { major: 1, minor: 0 },
      client_instance_id: '00000000-0000-4000-8000-000000000099' };
    const denied = await requestTls(address.port, '/partner/v1/hello', 'POST', hello, {}, '127.0.0.2');
    assert.equal(denied.status, 403, 'a peer outside the configured CIDR is denied before protocol dispatch');
    assert.equal(PartnerProtocolError.parse(denied.body).code, 'FORBIDDEN');
  } finally {
    if (listener) await closeServer(listener);
    authority.control.close();
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
