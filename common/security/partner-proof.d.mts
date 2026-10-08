import type { PairingChallengeT, PairingConfirmationT, PartnerProofChallengeT, PartnerRequestProofT } from '../contracts/partner.ts';

type PartnerPublicKey = PairingConfirmationT['public_key'];
type PairingSignatureInput = Pick<PairingConfirmationT, 'device_name' | 'public_key' | 'key_thumbprint' | 'signed_at'>;
type RequestSignatureInput = Pick<PartnerRequestProofT, 'device_id' | 'challenge_id' | 'issued_at' | 'method' | 'path' | 'body_sha256'>;
type RequestChallengeInput = Pick<PartnerProofChallengeT, 'nonce' | 'workstation_id' | 'workstation_fingerprint'>;

export function partnerKeyThumbprint(publicKey: PartnerPublicKey): string;
export function partnerPairingSigningBytes(challenge: PairingChallengeT, confirmation: PairingSignatureInput): Buffer;
export function partnerRequestSigningBytes(proof: RequestSignatureInput, challenge: RequestChallengeInput): Buffer;
export function partnerRequestBodyDigest(body: Uint8Array): string;
export function partnerSha256Hex(value: string | Uint8Array): string;
