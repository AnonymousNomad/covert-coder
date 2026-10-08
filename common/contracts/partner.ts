import { z } from 'zod';

const Uuid = z.string().uuid();
const Sha256Hex = z.string().regex(/^[a-f0-9]{64}$/);
const Base64Url = z.string().min(16).max(512).regex(/^[A-Za-z0-9_-]+$/);
const P256Coordinate = z.string().length(43).regex(/^[A-Za-z0-9_-]+$/);

export const PARTNER_PROTOCOL_MAJOR = 1;
export const PARTNER_PROTOCOL_MINOR = 0;

export const PartnerProtocolVersion = z.strictObject({
  major: z.number().int().min(0).max(100),
  minor: z.number().int().min(0).max(1000)
});

export const PartnerScope = z.enum([
  'cipher.chat.read',
  'cipher.chat.send',
  'system.read',
  'work.read',
  'partner.devices.read',
  'partner.settings.read',
  'partner.settings.write'
]);

export const PartnerPublicKey = z.strictObject({
  kty: z.literal('EC'),
  crv: z.literal('P-256'),
  x: P256Coordinate,
  y: P256Coordinate
});

export const PartnerHelloRequest = z.strictObject({
  schema: z.literal('covert.partner-hello-request.v1'),
  protocol: PartnerProtocolVersion,
  client_instance_id: Uuid
});

export const PartnerHello = z.strictObject({
  schema: z.literal('covert.partner-hello.v1'),
  protocol: z.strictObject({ major: z.literal(PARTNER_PROTOCOL_MAJOR), minor: z.literal(PARTNER_PROTOCOL_MINOR) }),
  workstation_id: Uuid,
  workstation_fingerprint: Sha256Hex,
  server_time: z.string().datetime(),
  pairing_enabled: z.literal(true),
  device_proof_required: z.literal(true),
  features: z.array(z.enum(['pairing.confirmation.v1', 'device-proof.v1', 'read-only.snapshot.v1'])).max(8)
});

export const PairingChallenge = z.strictObject({
  schema: z.literal('covert.partner-pairing-challenge.v1'),
  protocol: z.strictObject({ major: z.literal(PARTNER_PROTOCOL_MAJOR), minor: z.literal(PARTNER_PROTOCOL_MINOR) }),
  challenge_id: Uuid,
  nonce: Base64Url,
  workstation_id: Uuid,
  workstation_fingerprint: Sha256Hex,
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  requested_scopes: z.array(PartnerScope).min(1).max(16)
}).refine(value => new Date(value.expires_at).getTime() > new Date(value.created_at).getTime(), {
  message: 'pairing challenge expiry must follow its creation time'
});

export const PartnerPairingChallengeRequest = z.strictObject({
  requested_scopes: z.array(PartnerScope).min(1).max(7)
});

export const PairingConfirmation = z.strictObject({
  schema: z.literal('covert.partner-pairing-confirmation.v1'),
  protocol: z.strictObject({ major: z.literal(PARTNER_PROTOCOL_MAJOR), minor: z.literal(PARTNER_PROTOCOL_MINOR) }),
  challenge_id: Uuid,
  workstation_id: Uuid,
  workstation_fingerprint: Sha256Hex,
  device_name: z.string().trim().min(1).max(80),
  public_key: PartnerPublicKey,
  key_thumbprint: Base64Url,
  signed_at: z.string().datetime(),
  signature: z.string().length(86).regex(/^[A-Za-z0-9_-]+$/)
});

export const PartnerPairingPending = z.strictObject({
  schema: z.literal('covert.partner-pairing-pending.v1'),
  pending_id: Uuid,
  device_id: Uuid,
  device_name: z.string().min(1).max(80),
  key_thumbprint: Base64Url,
  requested_scopes: z.array(PartnerScope).min(1).max(16),
  created_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  state: z.literal('AWAITING_OPERATOR')
});

export const PartnerPairingPendingList = z.strictObject({
  pairings: z.array(PartnerPairingPending).max(10000)
});

export const PartnerPairingApprovalRequest = z.strictObject({
  pending_id: Uuid,
  approved_scopes: z.array(PartnerScope).min(1).max(7)
});

export const PartnerPairingRejectionRequest = z.strictObject({ pending_id: Uuid });
export const PartnerPairingRejectionResponse = z.strictObject({ rejected: z.literal(true) });

export const PartnerDevicePrincipal = z.strictObject({
  schema: z.literal('covert.partner-device-principal.v1'),
  device_id: Uuid,
  workstation_id: Uuid,
  device_name: z.string().min(1).max(80),
  public_key: PartnerPublicKey,
  key_thumbprint: Base64Url,
  scopes: z.array(PartnerScope).max(16),
  created_at: z.string().datetime(),
  revoked_at: z.string().datetime().nullable(),
  last_seen_at: z.string().datetime().nullable(),
  state: z.enum(['ACTIVE', 'REVOKED'])
}).refine(value => (value.state === 'ACTIVE') === (value.revoked_at === null), {
  message: 'device state and revocation time must agree'
});

export const PartnerDeviceList = z.strictObject({
  devices: z.array(PartnerDevicePrincipal).max(10000)
});

export const PartnerDeviceRevokeRequest = z.strictObject({ device_id: Uuid });

export const PartnerProofChallenge = z.strictObject({
  schema: z.literal('covert.partner-proof-challenge.v1'),
  challenge_id: Uuid,
  device_id: Uuid,
  workstation_id: Uuid,
  workstation_fingerprint: Sha256Hex,
  nonce: Base64Url,
  expires_at: z.string().datetime()
});

export const PartnerProofChallengeRequest = z.strictObject({
  schema: z.literal('covert.partner-proof-challenge-request.v1'),
  device_id: Uuid
});

export const PartnerRequestProof = z.strictObject({
  schema: z.literal('covert.partner-request-proof.v1'),
  device_id: Uuid,
  challenge_id: Uuid,
  issued_at: z.string().datetime(),
  method: z.enum(['GET', 'POST']),
  path: z.string().min(1).max(240).regex(/^\/partner\/v1\/[a-z0-9/-]+$/),
  body_sha256: Sha256Hex,
  signature: z.string().length(86).regex(/^[A-Za-z0-9_-]+$/)
});

export const PartnerMetric = z.strictObject({
  schema: z.literal('covert.partner-metric.v1'),
  metric_id: z.enum([
    'cpu.utilization_pct', 'memory.used_bytes', 'memory.available_bytes',
    'gpu.utilization_pct', 'gpu.vram_used_bytes', 'gpu.vram_available_bytes',
    'disk.system_free_bytes', 'disk.secondary_free_bytes',
    'cpu.temperature_c', 'gpu.temperature_c'
  ]),
  state: z.enum(['AVAILABLE', 'UNKNOWN', 'UNSUPPORTED', 'STALE']),
  value: z.number().finite().nullable(),
  unit: z.enum(['percent', 'bytes', 'celsius']).nullable(),
  observed_at: z.string().datetime().nullable()
}).refine(value => value.state === 'AVAILABLE'
  ? value.value !== null && value.unit !== null && value.observed_at !== null
  : value.value === null && value.unit === null && value.observed_at === null, {
  message: 'unsupported, unknown, and stale metrics carry no fabricated value'
});

export const PartnerWorkerState = z.enum([
  'REQUESTED', 'ADMITTED', 'STARTING', 'RUNNING', 'COMPLETED', 'STOPPED', 'CANCELLED', 'FAILED', 'UNKNOWN'
]);

export const PartnerWorkerSummary = z.strictObject({
  worker_id: z.string().min(1).max(128),
  project_id: z.string().min(1).max(128).nullable(),
  task_id: z.string().min(1).max(128).nullable(),
  state: PartnerWorkerState,
  route_label: z.string().min(1).max(160).nullable(),
  started_at: z.string().datetime().nullable(),
  evidence_ref: z.string().min(1).max(240).nullable()
});

export const PartnerSnapshot = z.strictObject({
  schema: z.literal('covert.partner-snapshot.v1'),
  protocol: z.strictObject({ major: z.literal(PARTNER_PROTOCOL_MAJOR), minor: z.literal(PARTNER_PROTOCOL_MINOR) }),
  snapshot_id: Uuid,
  workstation_id: Uuid,
  captured_at: z.string().datetime(),
  resident_state: z.enum(['AVAILABLE', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN']),
  loaded_model_label: z.string().min(1).max(160).nullable(),
  metrics: z.array(PartnerMetric).max(64),
  workers: z.array(PartnerWorkerSummary).max(256),
  queued_work_count: z.number().int().nonnegative().nullable(),
  pending_operator_decision_count: z.number().int().nonnegative().nullable()
});

export const PartnerEvent = z.strictObject({
  schema: z.literal('covert.partner-event.v1'),
  protocol: z.strictObject({ major: z.literal(PARTNER_PROTOCOL_MAJOR), minor: z.literal(PARTNER_PROTOCOL_MINOR) }),
  event_id: Uuid,
  sequence: z.number().int().nonnegative(),
  workstation_id: Uuid,
  occurred_at: z.string().datetime(),
  event_type: z.enum([
    'resident.state.changed', 'system.metric.changed', 'work.session.changed',
    'work.queued', 'operator.decision.pending', 'evidence.verified'
  ]),
  project_id: z.string().min(1).max(128).nullable(),
  worker_id: z.string().min(1).max(128).nullable(),
  evidence_ref: z.string().min(1).max(240).nullable(),
  summary: z.string().min(1).max(280)
});

export const PartnerProtocolError = z.strictObject({
  schema: z.literal('covert.partner-error.v1'),
  code: z.enum(['PROTOCOL_MAJOR_MISMATCH', 'INVALID_REQUEST', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'NOT_READY', 'PROJECTION_UNAVAILABLE']),
  message: z.string().min(1).max(160)
});

export type PartnerScopeT = z.infer<typeof PartnerScope>;
export type PartnerHelloRequestT = z.infer<typeof PartnerHelloRequest>;
export type PartnerHelloT = z.infer<typeof PartnerHello>;
export type PairingChallengeT = z.infer<typeof PairingChallenge>;
export type PartnerPairingChallengeRequestT = z.infer<typeof PartnerPairingChallengeRequest>;
export type PairingConfirmationT = z.infer<typeof PairingConfirmation>;
export type PartnerPairingPendingT = z.infer<typeof PartnerPairingPending>;
export type PartnerPairingPendingListT = z.infer<typeof PartnerPairingPendingList>;
export type PartnerPairingApprovalRequestT = z.infer<typeof PartnerPairingApprovalRequest>;
export type PartnerPairingRejectionRequestT = z.infer<typeof PartnerPairingRejectionRequest>;
export type PartnerPairingRejectionResponseT = z.infer<typeof PartnerPairingRejectionResponse>;
export type PartnerDevicePrincipalT = z.infer<typeof PartnerDevicePrincipal>;
export type PartnerDeviceListT = z.infer<typeof PartnerDeviceList>;
export type PartnerDeviceRevokeRequestT = z.infer<typeof PartnerDeviceRevokeRequest>;
export type PartnerProofChallengeT = z.infer<typeof PartnerProofChallenge>;
export type PartnerProofChallengeRequestT = z.infer<typeof PartnerProofChallengeRequest>;
export type PartnerRequestProofT = z.infer<typeof PartnerRequestProof>;
export type PartnerMetricT = z.infer<typeof PartnerMetric>;
export type PartnerSnapshotT = z.infer<typeof PartnerSnapshot>;
export type PartnerEventT = z.infer<typeof PartnerEvent>;
