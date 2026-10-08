import { createPublicKey, randomBytes, randomUUID, verify } from 'node:crypto';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { z } from 'zod';
import { PartnerDevicePrincipal, PartnerPairingPending, PartnerProofChallenge, PartnerRequestProof,
  PartnerPublicKey, PartnerScope, PairingChallenge, PairingConfirmation } from '../../../common/contracts/partner.ts';
import { partnerKeyThumbprint, partnerPairingSigningBytes, partnerRequestSigningBytes } from '../../../common/security/partner-proof.mjs';
import { atomicWriteJson, withFileMutationLock } from './atomic-json.ts';

const STATE_FILE = 'partner-devices.json';
const STATE_SCHEMA = 'covert.partner-device-state.v1';
const PAIRING_TTL_MS = 5 * 60_000;
const PENDING_TTL_MS = 10 * 60_000;
const PROOF_TTL_MS = 30_000;
const MAX_CLOCK_SKEW_MS = 60_000;
const State = z.strictObject({
  schema: z.literal(STATE_SCHEMA),
  workstation_id: z.string().uuid(),
  workstation_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  created_at: z.string().datetime(),
  challenges: z.array(z.strictObject({
    challenge: PairingChallenge,
    state: z.enum(['OPEN', 'CONSUMED'])
  })).max(10000),
  pending: z.array(z.strictObject({
    pending_id: z.string().uuid(),
    device_id: z.string().uuid(),
    device_name: z.string().min(1).max(80),
    public_key: PartnerPublicKey,
    key_thumbprint: z.string().min(16).max(512).regex(/^[A-Za-z0-9_-]+$/),
    requested_scopes: z.array(PartnerScope).min(1).max(16),
    created_at: z.string().datetime(),
    expires_at: z.string().datetime(),
    state: z.enum(['AWAITING_OPERATOR', 'APPROVED', 'REJECTED', 'EXPIRED']),
    approved_scopes: z.array(PartnerScope).max(16).nullable()
  })).max(10000),
  devices: z.array(PartnerDevicePrincipal).max(10000)
});

export class PartnerDeviceError extends Error {
  constructor(code, message = 'Partner device request denied') {
    super(message);
    this.name = 'PartnerDeviceError';
    this.code = code;
  }
}

function deny(code = 'FORBIDDEN') {
  throw new PartnerDeviceError(code);
}

function normalizeFingerprint(value) {
  const fingerprint = String(value ?? '').toLowerCase().replaceAll(':', '');
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new PartnerDeviceError('BAD_REQUEST', 'TLS certificate fingerprint is invalid');
  return fingerprint;
}

function errorCode(error) {
  return typeof error === 'object' && error !== null && typeof error.code === 'string' ? error.code : undefined;
}

async function ensureSafeDirectory(workspace, directory) {
  const root = await fs.realpath(workspace);
  const relative = path.relative(root, directory);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new PartnerDeviceError('NOT_READY', 'Partner state path is outside the workspace');
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const stat = await fs.lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new PartnerDeviceError('NOT_READY', 'Partner state directory is unsafe');
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') throw error;
      await fs.mkdir(current);
      const stat = await fs.lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new PartnerDeviceError('NOT_READY', 'Partner state directory is unsafe');
    }
  }
  const actual = await fs.realpath(directory);
  if (path.resolve(actual) !== path.resolve(directory)) throw new PartnerDeviceError('NOT_READY', 'Partner state directory identity changed');
}

function validateState(value) {
  const parsed = State.parse(value);
  for (const device of parsed.devices) {
    if (partnerKeyThumbprint(device.public_key) !== device.key_thumbprint) throw new PartnerDeviceError('NOT_READY', 'Partner device key identity is corrupt');
  }
  for (const pending of parsed.pending) {
    if (partnerKeyThumbprint(pending.public_key) !== pending.key_thumbprint) throw new PartnerDeviceError('NOT_READY', 'Pending Partner key identity is corrupt');
  }
  return parsed;
}

export function createPartnerDeviceStore({ workspace, clock = Date.now } = {}) {
  if (typeof workspace !== 'string' || !workspace) throw new TypeError('workspace required');
  const directory = path.join(workspace, '.aide', 'platform-authority');
  const file = path.join(directory, STATE_FILE);
  const proofChallenges = new Map();
  let workstation = null;

  async function readState() {
    await ensureSafeDirectory(workspace, directory);
    try {
      const stat = await fs.lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new PartnerDeviceError('NOT_READY', 'Partner state file is unsafe');
      return validateState(JSON.parse(await fs.readFile(file, 'utf8')));
    } catch (error) {
      if (errorCode(error) === 'ENOENT') throw new PartnerDeviceError('NOT_READY', 'Partner device state has not been initialized');
      if (error instanceof PartnerDeviceError) throw error;
      throw new PartnerDeviceError('NOT_READY', 'Partner device state is unavailable');
    }
  }

  async function mutate(operation) {
    return withFileMutationLock(file, async () => {
      const state = await readState();
      const result = await operation(state);
      if (result?.write === false) return result.value;
      const next = validateState(state);
      await atomicWriteJson(file, next, { validate: validateState });
      return result?.value;
    });
  }

  function ready() {
    if (!workstation) throw new PartnerDeviceError('NOT_READY', 'Partner TLS identity is not initialized');
    return workstation;
  }

  async function activeDevice(deviceId) {
    const state = await readState();
    const principal = state.devices.find(device => device.device_id === deviceId);
    if (!principal || principal.state !== 'ACTIVE' || principal.revoked_at !== null) deny();
    return PartnerDevicePrincipal.parse(principal);
  }

  return Object.freeze({
    file,
    async initialize(certificateFingerprint) {
      const fingerprint = normalizeFingerprint(certificateFingerprint);
      const result = await withFileMutationLock(file, async () => {
        await ensureSafeDirectory(workspace, directory);
        try {
          const stat = await fs.lstat(file);
          if (!stat.isFile() || stat.isSymbolicLink()) throw new PartnerDeviceError('NOT_READY', 'Partner state file is unsafe');
          const state = validateState(JSON.parse(await fs.readFile(file, 'utf8')));
          if (state.workstation_fingerprint !== fingerprint) throw new PartnerDeviceError('CONFLICT', 'Partner TLS identity changed; explicit workstation re-pairing is required');
          return { workstation_id: state.workstation_id, workstation_fingerprint: state.workstation_fingerprint };
        } catch (error) {
          if (errorCode(error) !== 'ENOENT') {
            if (error instanceof PartnerDeviceError) throw error;
            throw new PartnerDeviceError('NOT_READY', 'Partner device state is unavailable');
          }
          const state = State.parse({ schema: STATE_SCHEMA, workstation_id: randomUUID(), workstation_fingerprint: fingerprint,
            created_at: new Date(clock()).toISOString(), challenges: [], pending: [], devices: [] });
          await atomicWriteJson(file, state, { validate: validateState });
          return { workstation_id: state.workstation_id, workstation_fingerprint: state.workstation_fingerprint };
        }
      });
      workstation = Object.freeze(result);
      return workstation;
    },
    close() {
      proofChallenges.clear();
      workstation = null;
    },
    workstation() { return ready(); },
    async createPairingChallenge(requestedScopes) {
      const host = ready();
      const scopes = [...new Set(requestedScopes ?? [])];
      if (scopes.length === 0 || scopes.some(scope => !PartnerScope.safeParse(scope).success)) throw new PartnerDeviceError('BAD_REQUEST', 'At least one supported Partner scope is required');
      const now = clock();
      const challenge = PairingChallenge.parse({ schema: 'covert.partner-pairing-challenge.v1', protocol: { major: 1, minor: 0 },
        challenge_id: randomUUID(), nonce: randomBytes(32).toString('base64url'), workstation_id: host.workstation_id,
        workstation_fingerprint: host.workstation_fingerprint, created_at: new Date(now).toISOString(),
        expires_at: new Date(now + PAIRING_TTL_MS).toISOString(), requested_scopes: scopes });
      return mutate(state => {
        state.challenges = state.challenges.filter(item => new Date(item.challenge.expires_at).getTime() > now);
        state.challenges.push({ challenge, state: 'OPEN' });
        return { value: challenge };
      });
    },
    async submitPairingConfirmation(rawConfirmation) {
      const host = ready();
      const confirmation = PairingConfirmation.parse(rawConfirmation);
      if (confirmation.protocol.major !== 1) deny('CONFLICT');
      if (confirmation.workstation_id !== host.workstation_id || confirmation.workstation_fingerprint !== host.workstation_fingerprint) deny('FORBIDDEN');
      const actualThumbprint = partnerKeyThumbprint(confirmation.public_key);
      if (actualThumbprint !== confirmation.key_thumbprint) deny('FORBIDDEN');
      const issuedAt = new Date(confirmation.signed_at).getTime();
      const now = clock();
      if (!Number.isFinite(issuedAt) || issuedAt > now + MAX_CLOCK_SKEW_MS || issuedAt < now - PAIRING_TTL_MS - MAX_CLOCK_SKEW_MS) deny('CONFLICT');
      return mutate(state => {
        const entry = state.challenges.find(item => item.challenge.challenge_id === confirmation.challenge_id);
        if (!entry || entry.state !== 'OPEN' || new Date(entry.challenge.expires_at).getTime() <= now) deny('CONFLICT');
        const challenge = entry.challenge;
        if (confirmation.workstation_id !== challenge.workstation_id || confirmation.workstation_fingerprint !== challenge.workstation_fingerprint ||
            confirmation.protocol.major !== challenge.protocol.major) deny('FORBIDDEN');
        const challengeCreated = new Date(challenge.created_at).getTime();
        const challengeExpires = new Date(challenge.expires_at).getTime();
        if (issuedAt < challengeCreated - MAX_CLOCK_SKEW_MS || issuedAt > challengeExpires + MAX_CLOCK_SKEW_MS) deny('CONFLICT');
        const challengeSignature = partnerPairingSigningBytes(challenge, confirmation);
        let challengeSignatureValid = false;
        try {
          challengeSignatureValid = verify('sha256', challengeSignature,
            { key: createPublicKey({ key: confirmation.public_key, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(confirmation.signature, 'base64url'));
        } catch { challengeSignatureValid = false; }
        if (!challengeSignatureValid) deny('FORBIDDEN');
        if (state.devices.some(device => device.key_thumbprint === confirmation.key_thumbprint) ||
            state.pending.some(item => item.key_thumbprint === confirmation.key_thumbprint && item.state === 'AWAITING_OPERATOR')) deny('CONFLICT');
        entry.state = 'CONSUMED';
        const pending = PartnerPairingPending.parse({ schema: 'covert.partner-pairing-pending.v1', pending_id: randomUUID(),
          device_id: randomUUID(), device_name: confirmation.device_name, key_thumbprint: confirmation.key_thumbprint,
          requested_scopes: challenge.requested_scopes, created_at: new Date(now).toISOString(),
          expires_at: new Date(now + PENDING_TTL_MS).toISOString(), state: 'AWAITING_OPERATOR' });
        state.pending.push({ pending_id: pending.pending_id, device_id: pending.device_id, device_name: pending.device_name,
          public_key: confirmation.public_key, key_thumbprint: pending.key_thumbprint, requested_scopes: pending.requested_scopes,
          created_at: pending.created_at, expires_at: pending.expires_at, state: pending.state, approved_scopes: null });
        return { value: pending };
      });
    },
    async approvePairing(pendingId, scopes, beforeCommit) {
      const host = ready();
      const approved = [...new Set(scopes ?? [])];
      if (approved.length === 0 || approved.some(scope => !PartnerScope.safeParse(scope).success)) throw new PartnerDeviceError('BAD_REQUEST', 'At least one supported Partner scope is required');
      const now = clock();
      return mutate(async state => {
        const pending = state.pending.find(item => item.pending_id === pendingId);
        if (!pending || pending.state !== 'AWAITING_OPERATOR' || new Date(pending.expires_at).getTime() <= now) deny('CONFLICT');
        if (approved.some(scope => !pending.requested_scopes.includes(scope))) deny('FORBIDDEN');
        if (state.devices.some(device => device.device_id === pending.device_id || device.key_thumbprint === pending.key_thumbprint)) deny('CONFLICT');
        if (beforeCommit !== undefined) {
          if (typeof beforeCommit !== 'function') throw new TypeError('pairing commit callback must be a function');
          await beforeCommit({ key_thumbprint: pending.key_thumbprint, approved_scopes: approved });
        }
        pending.state = 'APPROVED';
        pending.approved_scopes = approved;
        const principal = PartnerDevicePrincipal.parse({ schema: 'covert.partner-device-principal.v1', device_id: pending.device_id,
          workstation_id: host.workstation_id, device_name: pending.device_name, public_key: pending.public_key,
          key_thumbprint: pending.key_thumbprint, scopes: approved, created_at: new Date(now).toISOString(),
          revoked_at: null, last_seen_at: null, state: 'ACTIVE' });
        state.devices.push(principal);
        return { value: principal };
      });
    },
    async rejectPairing(pendingId) {
      const now = clock();
      return mutate(state => {
        const pending = state.pending.find(item => item.pending_id === pendingId);
        if (!pending || pending.state !== 'AWAITING_OPERATOR' || new Date(pending.expires_at).getTime() <= now) deny('CONFLICT');
        pending.state = 'REJECTED';
        return { value: true };
      });
    },
    async revokeDevice(deviceId) {
      const now = clock();
      return mutate(state => {
        const index = state.devices.findIndex(device => device.device_id === deviceId);
        if (index < 0) deny('NOT_FOUND');
        const device = state.devices[index];
        if (device.state === 'REVOKED') return { write: false, value: device };
        const revoked = PartnerDevicePrincipal.parse({ ...device, state: 'REVOKED', revoked_at: new Date(now).toISOString() });
        state.devices[index] = revoked;
        for (const [id, challenge] of proofChallenges) if (challenge.device_id === deviceId) proofChallenges.delete(id);
        return { value: revoked };
      });
    },
    async listDevices() {
      const state = await readState();
      return state.devices.map(device => PartnerDevicePrincipal.parse(device));
    },
    async pendingPairings() {
      const state = await readState();
      return state.pending.filter(item => item.state === 'AWAITING_OPERATOR' && new Date(item.expires_at).getTime() > clock())
        .map(item => PartnerPairingPending.parse({ schema: 'covert.partner-pairing-pending.v1', pending_id: item.pending_id,
          device_id: item.device_id, device_name: item.device_name, key_thumbprint: item.key_thumbprint,
          requested_scopes: item.requested_scopes, created_at: item.created_at, expires_at: item.expires_at, state: item.state }));
    },
    async requireScope(deviceId, scope) {
      if (!PartnerScope.safeParse(scope).success) deny();
      const principal = await activeDevice(deviceId);
      if (!principal.scopes.includes(scope)) deny();
      return principal;
    },
    async createProofChallenge(deviceId) {
      const host = ready();
      await activeDevice(deviceId);
      const now = clock();
      for (const [id, value] of proofChallenges) if (value.expires_at <= now || value.used) proofChallenges.delete(id);
      if (proofChallenges.size >= 4096) throw new PartnerDeviceError('NOT_READY', 'Partner proof capacity reached');
      const challenge = PartnerProofChallenge.parse({ schema: 'covert.partner-proof-challenge.v1', challenge_id: randomUUID(),
        device_id: deviceId, workstation_id: host.workstation_id, workstation_fingerprint: host.workstation_fingerprint,
        nonce: randomBytes(32).toString('base64url'), expires_at: new Date(now + PROOF_TTL_MS).toISOString() });
      proofChallenges.set(challenge.challenge_id, { ...challenge, expires_at: new Date(challenge.expires_at).getTime(), used: false });
      return challenge;
    },
    async verifyRequestProof(rawProof, request) {
      const host = ready();
      const proof = PartnerRequestProof.parse(rawProof);
      const challenge = proofChallenges.get(proof.challenge_id);
      if (!challenge || challenge.used || challenge.expires_at <= clock() || challenge.device_id !== proof.device_id) deny('CONFLICT');
      challenge.used = true;
      if (proof.method !== request.method || proof.path !== request.path || proof.body_sha256 !== request.body_sha256 ||
          proof.issued_at !== request.issued_at || challenge.workstation_id !== host.workstation_id ||
          challenge.workstation_fingerprint !== host.workstation_fingerprint) deny('FORBIDDEN');
      const issuedAt = new Date(proof.issued_at).getTime();
      if (!Number.isFinite(issuedAt) || Math.abs(clock() - issuedAt) > MAX_CLOCK_SKEW_MS) deny('CONFLICT');
      const state = await readState();
      const principal = state.devices.find(device => device.device_id === proof.device_id);
      if (!principal || principal.state !== 'ACTIVE' || principal.revoked_at !== null) deny();
      let valid = false;
      try {
        valid = verify('sha256', partnerRequestSigningBytes(proof, challenge),
          { key: createPublicKey({ key: principal.public_key, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, Buffer.from(proof.signature, 'base64url'));
      } catch { valid = false; }
      if (!valid) deny();
      await mutate(current => {
        const index = current.devices.findIndex(device => device.device_id === proof.device_id);
        if (index < 0 || current.devices[index].state !== 'ACTIVE') deny();
        current.devices[index] = PartnerDevicePrincipal.parse({ ...current.devices[index], last_seen_at: new Date(clock()).toISOString() });
        return { value: true };
      });
      return PartnerDevicePrincipal.parse(principal);
    }
  });
}
