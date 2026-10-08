import { createHash } from 'node:crypto';

const sha256 = value => createHash('sha256').update(value).digest('hex');

function signingFrame(domain, fields) {
  const chunks = [Buffer.from(`${domain}\n`, 'utf8')];
  for (const field of fields) {
    const bytes = Buffer.from(String(field), 'utf8');
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(bytes.byteLength);
    chunks.push(length, bytes);
  }
  return Buffer.concat(chunks);
}

export function partnerKeyThumbprint(publicKey) {
  if (!publicKey || publicKey.kty !== 'EC' || publicKey.crv !== 'P-256' ||
      typeof publicKey.x !== 'string' || typeof publicKey.y !== 'string') {
    throw new TypeError('P-256 public key required');
  }
  const canonical = JSON.stringify({ crv: publicKey.crv, kty: publicKey.kty, x: publicKey.x, y: publicKey.y });
  return createHash('sha256').update(canonical).digest('base64url');
}

export function partnerPairingSigningBytes(challenge, confirmation) {
  const key = confirmation.public_key;
  return signingFrame('covert-partner-pairing-v1', [
    challenge.protocol.major, challenge.protocol.minor,
    challenge.challenge_id, challenge.nonce, challenge.workstation_id, challenge.workstation_fingerprint,
    challenge.created_at, challenge.expires_at, [...challenge.requested_scopes].sort().join(','),
    confirmation.device_name, key.kty, key.crv, key.x, key.y, confirmation.key_thumbprint, confirmation.signed_at
  ]);
}

export function partnerRequestBodyDigest(body) {
  return sha256(body);
}

export function partnerRequestSigningBytes(proof, challenge) {
  return signingFrame('covert-partner-request-v1', [
    1, proof.device_id, proof.challenge_id, challenge.nonce, challenge.workstation_id,
    challenge.workstation_fingerprint, proof.issued_at, proof.method, proof.path, proof.body_sha256
  ]);
}

export { sha256 as partnerSha256Hex };
