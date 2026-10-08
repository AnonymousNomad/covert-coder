import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export type HardwareVendor = 'NVIDIA' | 'AMD' | 'INTEL' | 'APPLE' | 'CPU' | 'UNKNOWN';
export type HardwareSource = 'nvidia-smi' | 'amd-smi' | 'windows-pnp';

export interface HardwareDeviceInfo {
  vendor: Exclude<HardwareVendor, 'CPU'>;
  deviceName: string | null;
  driverVersion: string | null;
  architecture: string | null;
  vramBytes: number | null;
  freeVramBytes: number | null;
  source: HardwareSource;
}

export interface HardwareInfo {
  totalRamBytes: number;
  freeRamBytes: number;
  logicalCpus: number;
  devices: HardwareDeviceInfo[];
  vendor: HardwareVendor;
  deviceName: string | null;
  driverVersion: string | null;
  architecture: string | null;
  vramBytes: number | null;
  freeVramBytes: number | null;
  vramSource: HardwareSource | 'multiple' | 'unknown';
}

let cached: HardwareInfo | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

function usableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length === 0 || /^(n\/a|unknown|none)$/i.test(normalized) ? null : normalized;
}

export function parseNvidiaSmiMemory(text: string): { totalMib: number; freeMib: number | null } | null {
  const line = text.trim().split('\n')[0]?.trim() ?? '';
  if (line.length === 0) return null;
  const parts = line.split(',').map(part => Number(part.trim()));
  const totalRaw = parts[0] ?? NaN;
  if (!Number.isFinite(totalRaw) || totalRaw <= 0) return null;
  const freeRaw = parts[1] ?? NaN;
  const totalMib = totalRaw;
  const freeMib = Number.isFinite(freeRaw) && freeRaw >= 0 ? freeRaw : null;
  return { totalMib, freeMib };
}

export function parseNvidiaSmiDevices(text: string): HardwareDeviceInfo[] {
  const devices: HardwareDeviceInfo[] = [];
  for (const line of text.split(/\r?\n/)) {
    const [nameRaw, driverRaw, totalRaw, freeRaw] = line.split(',').map(part => part.trim());
    const totalMib = Number(totalRaw);
    if (!Number.isFinite(totalMib) || totalMib <= 0) continue;
    const freeMibValue = Number(freeRaw);
    devices.push({
      vendor: 'NVIDIA',
      deviceName: usableText(nameRaw),
      driverVersion: usableText(driverRaw),
      architecture: null,
      vramBytes: Math.round(totalMib * 1024 * 1024),
      freeVramBytes: Number.isFinite(freeMibValue) && freeMibValue >= 0 ? Math.round(freeMibValue * 1024 * 1024) : null,
      source: 'nvidia-smi'
    });
  }
  return devices;
}

function vendorFromWindowsPnp(pnpId: string, name: string): Exclude<HardwareVendor, 'CPU'> {
  const id = pnpId.toUpperCase();
  if (id.includes('VEN_10DE') || /\bNVIDIA\b/i.test(name)) return 'NVIDIA';
  if (id.includes('VEN_1002') || /\bAMD\b|\bATI\b/i.test(name)) return 'AMD';
  if (id.includes('VEN_8086') || /\bINTEL\b/i.test(name)) return 'INTEL';
  if (/\bAPPLE\b/i.test(name)) return 'APPLE';
  return 'UNKNOWN';
}

export function parseWindowsVideoControllers(text: string): HardwareDeviceInfo[] {
  let parsed: unknown;
  try { parsed = JSON.parse(text) as unknown; }
  catch { return []; }
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  return entries.flatMap((entry): HardwareDeviceInfo[] => {
    if (entry === null || typeof entry !== 'object') return [];
    const value = entry as Record<string, unknown>;
    const name = usableText(value.Name ?? value.name);
    const pnpId = usableText(value.PNPDeviceID ?? value.PnpDeviceId ?? value.pnpDeviceId) ?? '';
    const driverVersion = usableText(value.DriverVersion ?? value.driverVersion);
    if (name === null && pnpId.length === 0) return [];
    return [{
      vendor: vendorFromWindowsPnp(pnpId, name ?? ''),
      deviceName: name,
      driverVersion,
      architecture: null,
      // Win32_VideoController.AdapterRAM may be truncated and does not provide
      // a dependable free-VRAM measurement. Keep memory unknown here.
      vramBytes: null,
      freeVramBytes: null,
      source: 'windows-pnp'
    }];
  });
}

function sectionValues(block: string, sectionName: string): Map<string, string> {
  const lines = block.split(/\r?\n/);
  const sectionIndex = lines.findIndex(line => /^\s*[A-Z0-9_]+:\s*$/i.test(line) && line.trim().slice(0, -1).toUpperCase() === sectionName);
  if (sectionIndex < 0) return new Map();
  const sectionIndent = lines[sectionIndex]!.match(/^\s*/)?.[0].length ?? 0;
  const fields = new Map<string, string>();
  for (let index = sectionIndex + 1; index < lines.length; index++) {
    const line = lines[index]!;
    const match = /^(\s*)([A-Z0-9_]+):\s*(.*?)\s*$/i.exec(line);
    if (match === null) continue;
    if (match[1]!.length <= sectionIndent) break;
    fields.set(match[2]!.toUpperCase(), match[3]!);
  }
  return fields;
}

function amdMemoryBytes(value: string | undefined): number | null {
  const normalized = usableText(value);
  if (normalized === null) return null;
  const match = /^([\d,]+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i.exec(normalized);
  if (match === null) return null;
  const amount = Number(match[1]!.replace(/,/g, ''));
  const unit = match[2]!.toUpperCase();
  const scale = unit === 'B' ? 1 : unit === 'KB' ? 1_000 : unit === 'MB' ? 1_000_000 : unit === 'GB' ? 1_000_000_000 : 1_000_000_000_000;
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * scale) : null;
}

export function parseAmdSmiStatic(text: string): HardwareDeviceInfo[] {
  const gpuHeaders = [...text.matchAll(/^\s*GPU:\s*\d+\s*$/gim)];
  return gpuHeaders.flatMap((header, index): HardwareDeviceInfo[] => {
    const start = header.index ?? 0;
    const end = gpuHeaders[index + 1]?.index ?? text.length;
    const block = text.slice(start, end);
    const asic = sectionValues(block, 'ASIC');
    const driver = sectionValues(block, 'DRIVER');
    const vram = sectionValues(block, 'VRAM');
    const vendorText = `${asic.get('VENDOR_ID') ?? ''} ${asic.get('VENDOR_NAME') ?? ''}`;
    if (!/0x0*1002\b|advanced micro devices|\bamd(?:\/ati)?\b/i.test(vendorText)) return [];
    return [{
      vendor: 'AMD',
      deviceName: usableText(asic.get('MARKET_NAME')),
      driverVersion: usableText(driver.get('VERSION')),
      architecture: usableText(asic.get('TARGET_GRAPHICS_VERSION')),
      vramBytes: amdMemoryBytes(vram.get('SIZE')),
      freeVramBytes: null,
      source: 'amd-smi'
    }];
  });
}

function aggregateHardware(devices: HardwareDeviceInfo[]): Pick<HardwareInfo, 'devices' | 'vendor' | 'deviceName' | 'driverVersion' | 'architecture' | 'vramBytes' | 'freeVramBytes' | 'vramSource'> {
  const knownVendor = devices[0]?.vendor;
  const vendor: HardwareVendor = knownVendor !== undefined && knownVendor !== 'UNKNOWN' && devices.every(device => device.vendor === knownVendor)
    ? knownVendor
    : 'UNKNOWN';
  const knownValues = <K extends 'vramBytes' | 'freeVramBytes'>(key: K): number | null =>
    devices.length > 0 && devices.every(device => device[key] !== null)
      ? devices.reduce((sum, device) => sum + (device[key] ?? 0), 0)
      : null;
  const oneValue = <K extends 'deviceName' | 'driverVersion' | 'architecture'>(key: K): string | null => {
    if (devices.length === 0) return null;
    const values = [...new Set(devices.map(device => device[key]).filter((value): value is string => value !== null))];
    return values.length === 1 && devices.every(device => device[key] !== null) ? values[0]! : null;
  };
  const sources = [...new Set(devices.map(device => device.source))];
  return {
    devices,
    vendor,
    deviceName: oneValue('deviceName'),
    driverVersion: oneValue('driverVersion'),
    architecture: oneValue('architecture'),
    vramBytes: knownValues('vramBytes'),
    freeVramBytes: knownValues('freeVramBytes'),
    vramSource: sources.length === 1 ? sources[0]! : sources.length > 1 ? 'multiple' : 'unknown'
  };
}

export async function probeHardware(): Promise<HardwareInfo> {
  if (cached !== null && Date.now() - cachedAt < CACHE_MS) return cached;
  let devices: HardwareDeviceInfo[] = [];
  if (process.platform === 'win32') {
    try {
      const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-CimInstance Win32_VideoController | Select-Object Name,PNPDeviceID,DriverVersion | ConvertTo-Json -Compress'
      ], { timeout: 5000, windowsHide: true });
      devices = parseWindowsVideoControllers(String(stdout));
    } catch {
      // PNP identity is optional; unavailable OS enumeration remains UNKNOWN.
    }
  }

  try {
    const { stdout } = await run('nvidia-smi', ['--query-gpu=name,driver_version,memory.total,memory.free', '--format=csv,noheader,nounits'], { timeout: 5000, windowsHide: true });
    const nvidia = parseNvidiaSmiDevices(String(stdout));
    if (nvidia.length > 0) devices = [...nvidia, ...devices.filter(device => device.vendor !== 'NVIDIA')];
  } catch {
    // A missing NVIDIA utility does not prove CPU-only hardware.
  }

  // AMD documents AMD SMI support for Linux bare metal/VMs and calls WSL
  // support experimental; Windows identity therefore comes from PNP only.
  if (process.platform === 'linux') {
    try {
      const { stdout } = await run('amd-smi', ['static', '--asic', '--driver', '--vram'], { timeout: 5000, windowsHide: true });
      const amd = parseAmdSmiStatic(String(stdout));
      if (amd.length > 0) devices = [...devices.filter(device => device.vendor !== 'AMD'), ...amd];
    } catch {
      // Missing AMD SMI leaves accelerator identity/VRAM unknown.
    }
  }

  const aggregate = aggregateHardware(devices);
  cached = {
    totalRamBytes: os.totalmem(),
    freeRamBytes: os.freemem(),
    logicalCpus: os.cpus().length,
    ...aggregate
  };
  cachedAt = Date.now();
  return cached;
}

export function clearHardwareCache(): void {
  cached = null;
  cachedAt = 0;
}
