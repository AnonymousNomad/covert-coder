import { createHash, X509Certificate } from 'node:crypto';
import https from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import { PairingConfirmation, PartnerHello, PartnerHelloRequest, PartnerPairingPending, PartnerProtocolError,
  PartnerProofChallenge, PartnerProofChallengeRequest, PartnerRequestProof, PartnerSnapshot,
  PARTNER_PROTOCOL_MAJOR, PARTNER_PROTOCOL_MINOR, type PartnerDevicePrincipalT } from '../../../common/contracts/partner.ts';
import { partnerSha256Hex } from '../../../common/security/partner-proof.mjs';
import type { ExecutionAuthority } from './execution-authority.mjs';
import type { Logger } from './logger.ts';

export interface PartnerProtocolOptions {
  authority: ExecutionAuthority;
  bind_host: string;
  lan_cidr: string;
  port: number;
  tls_key: string | Buffer;
  tls_certificate: string | Buffer;
  logger?: Pick<Logger, 'warn' | 'error'>;
  snapshot?: (principal: PartnerDevicePrincipalT) => Promise<unknown>;
}

const BODY_LIMIT_BYTES = 32 * 1024;
const PUBLIC_MESSAGES = Object.freeze({
  PROTOCOL_MAJOR_MISMATCH: 'Partner protocol major version is unsupported',
  INVALID_REQUEST: 'Partner request is invalid',
  FORBIDDEN: 'Partner device is not authorized for this request',
  NOT_FOUND: 'Partner resource is unavailable',
  CONFLICT: 'Partner challenge is expired, consumed, or stale',
  NOT_READY: 'Partner service is not ready',
  PROJECTION_UNAVAILABLE: 'Partner projection is not configured'
});

function ipv4Number(address: string): number | null {
  if (!net.isIPv4(address)) return null;
  return address.split('.').reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}

function privateIpv4(address: string): boolean {
  const value = ipv4Number(address);
  if (value === null) return false;
  return (value >>> 24) === 10 || (value >>> 20) === 0xac1 || (value >>> 16) === 0xc0a8;
}

function ipv4PrefixLength(mask: string): number | null {
  const value = ipv4Number(mask);
  if (value === null) return null;
  const bits = value.toString(2).padStart(32, '0');
  if (!/^1*0*$/.test(bits)) return null;
  const firstZero = bits.indexOf('0');
  return firstZero < 0 ? 32 : firstZero;
}

function interfacePrefixLength(address: string): number | null {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.address !== address) continue;
      return typeof entry.netmask === 'string' ? ipv4PrefixLength(entry.netmask) : null;
    }
  }
  return null;
}

function cidrContains(cidr: string, address: string): boolean {
  const [network, bitsText, extra] = cidr.split('/');
  if (!network || !bitsText || extra !== undefined) return false;
  const bits = Number(bitsText);
  const networkValue = ipv4Number(network);
  const addressValue = ipv4Number(address);
  if (networkValue === null || addressValue === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (networkValue & mask) === (addressValue & mask);
}

function assertLanBinding(host: string, cidr: string, port: number): void {
  const hostValue = ipv4Number(host);
  const [network, bitsText, extra] = cidr.split('/');
  const bits = Number(bitsText);
  const networkValue = network === undefined ? null : ipv4Number(network);
  const mask = bits >= 0 && bits <= 32 ? (bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0) : null;
  if (hostValue === null || !network || extra !== undefined || !Number.isInteger(bits) || bits < 16 || bits > 32 ||
      !Number.isSafeInteger(port) || port < 0 || port > 65535 || !cidrContains(cidr, host) ||
      networkValue === null || mask === null || ((networkValue & mask) >>> 0) !== networkValue) {
    throw new TypeError('Partner listener requires an explicit IPv4 address and same-subnet CIDR');
  }
  const loopback = (hostValue >>> 24) === 127;
  if (loopback) {
    if (host !== '127.0.0.1' || cidr !== '127.0.0.1/32') throw new TypeError('Partner loopback binding is restricted to 127.0.0.1/32');
  } else {
    if (!privateIpv4(host) || !privateIpv4(network)) throw new TypeError('Partner listener may bind only to a private IPv4 interface');
    const localPrefix = interfacePrefixLength(host);
    if (localPrefix === null) throw new TypeError('Partner bind host must be assigned to a local IPv4 interface');
    if (bits < localPrefix) throw new TypeError('Partner CIDR may not be broader than the bound interface subnet');
  }
}

function normalizedPeer(address: string | undefined): string | null {
  if (!address) return null;
  const ipv4Mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1];
  return ipv4Mapped ?? (net.isIPv4(address) ? address : null);
}

function send(response: ServerResponse, status: number, body: unknown): void {
  const bytes = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(bytes.byteLength),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  response.end(bytes);
}

function errorResponse(code: keyof typeof PUBLIC_MESSAGES) {
  return PartnerProtocolError.parse({ schema: 'covert.partner-error.v1', code, message: PUBLIC_MESSAGES[code] });
}

function statusFor(code: string): number {
  if (code === 'PROTOCOL_MAJOR_MISMATCH') return 426;
  if (code === 'BAD_REQUEST' || code === 'INVALID_REQUEST') return 400;
  if (code === 'FORBIDDEN') return 403;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'CONFLICT') return 409;
  return 503;
}

async function readJson(request: IncomingMessage): Promise<{ parsed: unknown; bytes: Buffer }> {
  if (request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    throw Object.assign(new Error('invalid content type'), { code: 'BAD_REQUEST' });
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.byteLength;
    if (length > BODY_LIMIT_BYTES) throw Object.assign(new Error('request too large'), { code: 'BAD_REQUEST' });
    chunks.push(bytes);
  }
  const bytes = Buffer.concat(chunks);
  try { return { parsed: JSON.parse(bytes.toString('utf8')) as unknown, bytes }; }
  catch { throw Object.assign(new Error('invalid JSON'), { code: 'BAD_REQUEST' }); }
}

function protocolMajor(request: IncomingMessage): number | null {
  const value = request.headers['x-covert-partner-major'];
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,2})$/.test(value)) return null;
  return Number(value);
}

function proofHeader(request: IncomingMessage): unknown {
  const value = request.headers['x-covert-partner-proof'];
  if (typeof value !== 'string' || value.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw Object.assign(new Error('device proof required'), { code: 'FORBIDDEN' });
  }
  try { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown; }
  catch { throw Object.assign(new Error('invalid device proof'), { code: 'FORBIDDEN' }); }
}

function securityError(code: string): keyof typeof PUBLIC_MESSAGES {
  if (Object.hasOwn(PUBLIC_MESSAGES, code)) return code as keyof typeof PUBLIC_MESSAGES;
  if (code === 'BAD_REQUEST') return 'INVALID_REQUEST';
  if (code === 'ZodError') return 'INVALID_REQUEST';
  return 'NOT_READY';
}

export async function listenPartnerProtocol(options: PartnerProtocolOptions): Promise<https.Server> {
  assertLanBinding(options.bind_host, options.lan_cidr, options.port);
  if (!options.tls_key || !options.tls_certificate) throw new TypeError('Partner TLS certificate and private key are required');
  const certificate = new X509Certificate(options.tls_certificate);
  const fingerprint = createHash('sha256').update(certificate.raw).digest('hex');
  const workstation = await options.authority.partner.initialize(fingerprint);

  const server = https.createServer({ key: options.tls_key, cert: options.tls_certificate, minVersion: 'TLSv1.2' }, (request, response) => {
    void handle(request, response);
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.keepAliveTimeout = 2_000;
  server.on('clientError', () => { options.logger?.warn('Partner protocol connection rejected', { code: 'INVALID_REQUEST' }); });
  server.on('tlsClientError', () => { options.logger?.warn('Partner TLS negotiation rejected', { code: 'TLS_REJECTED' }); });

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const peer = normalizedPeer(request.socket.remoteAddress);
    if (!peer || !cidrContains(options.lan_cidr, peer)) {
      send(response, 403, errorResponse('FORBIDDEN'));
      return;
    }
    if (request.headers.authorization !== undefined || request.headers.cookie !== undefined) {
      send(response, 400, errorResponse('INVALID_REQUEST'));
      return;
    }
    const method = request.method ?? '';
    const path = request.url ?? '';
    if (path.includes('?') || path.includes('#') || path.includes('\\') || path.includes('%')) {
      send(response, 400, errorResponse('INVALID_REQUEST'));
      return;
    }
    try {
      if (method === 'POST' && path === '/partner/v1/hello') {
        const { parsed } = await readJson(request);
        const helloRequest = PartnerHelloRequest.parse(parsed);
        if (helloRequest.protocol.major !== PARTNER_PROTOCOL_MAJOR) {
          send(response, 426, errorResponse('PROTOCOL_MAJOR_MISMATCH'));
          return;
        }
        const hello = PartnerHello.parse({ schema: 'covert.partner-hello.v1',
          protocol: { major: PARTNER_PROTOCOL_MAJOR, minor: PARTNER_PROTOCOL_MINOR },
          workstation_id: workstation.workstation_id, workstation_fingerprint: workstation.workstation_fingerprint,
          server_time: new Date().toISOString(), pairing_enabled: true, device_proof_required: true,
          features: ['pairing.confirmation.v1', 'device-proof.v1', ...(options.snapshot ? ['read-only.snapshot.v1'] : [])] });
        send(response, 200, hello);
        return;
      }

      const major = protocolMajor(request);
      if (major === null) throw Object.assign(new Error('protocol major required'), { code: 'BAD_REQUEST' });
      if (major !== PARTNER_PROTOCOL_MAJOR) {
        send(response, 426, errorResponse('PROTOCOL_MAJOR_MISMATCH'));
        return;
      }

      if (method === 'POST' && path === '/partner/v1/pairing-confirmations') {
        const { parsed } = await readJson(request);
        const confirmation = PairingConfirmation.parse(parsed);
        const pending = PartnerPairingPending.parse(await options.authority.partner.submitPairingConfirmation(confirmation));
        send(response, 202, pending);
        return;
      }

      if (method === 'POST' && path === '/partner/v1/proof-challenges') {
        const { parsed } = await readJson(request);
        const input = PartnerProofChallengeRequest.parse(parsed);
        send(response, 200, PartnerProofChallenge.parse(await options.authority.partner.createProofChallenge(input.device_id)));
        return;
      }

      if (method === 'GET' && path === '/partner/v1/snapshot') {
        if (!options.snapshot) throw Object.assign(new Error('projection unavailable'), { code: 'PROJECTION_UNAVAILABLE' });
        if (request.headers['transfer-encoding'] !== undefined ||
            (request.headers['content-length'] !== undefined && request.headers['content-length'] !== '0')) {
          throw Object.assign(new Error('snapshot GET must not carry a request body'), { code: 'BAD_REQUEST' });
        }
        const rawProof = PartnerRequestProof.parse(proofHeader(request));
        const bodySha = partnerSha256Hex(Buffer.alloc(0));
        const principal = await options.authority.partner.verifyRequestProof(rawProof, {
          method: 'GET', path, body_sha256: bodySha, issued_at: rawProof.issued_at
        });
        const [system, work] = await Promise.all([
          options.authority.partner.requireScope(principal.device_id, 'system.read'),
          options.authority.partner.requireScope(principal.device_id, 'work.read')
        ]);
        if (system.device_id !== work.device_id) throw Object.assign(new Error('principal changed'), { code: 'FORBIDDEN' });
        const snapshot = PartnerSnapshot.parse(await options.snapshot(principal));
        if (snapshot.workstation_id !== workstation.workstation_id) throw Object.assign(new Error('projection workstation mismatch'), { code: 'NOT_READY' });
        send(response, 200, snapshot);
        return;
      }

      send(response, 404, errorResponse('NOT_FOUND'));
    } catch (error) {
      const code = securityError(typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code) : error instanceof Error ? error.name : 'NOT_READY');
      options.logger?.warn('Partner protocol request denied', { code });
      send(response, statusFor(code), errorResponse(code));
    }
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.bind_host, () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server;
}
