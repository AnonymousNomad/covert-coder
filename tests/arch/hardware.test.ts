import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeHardware, clearHardwareCache, parseAmdSmiStatic, parseWindowsVideoControllers } from '../../node/src/services/hardware.ts';

test('AMD SMI reports AMD device identity independently from inference-backend qualification', () => {
  const devices = parseAmdSmiStatic(`GPU: 0
    ASIC:
        MARKET_NAME: Radeon Pro W7900
        VENDOR_ID: 0x1002
        TARGET_GRAPHICS_VERSION: gfx1100
    DRIVER:
        NAME: amdgpu
        VERSION: 6.8.5
    VRAM:
        SIZE: 49152 MB`);
  assert.deepEqual(devices, [{
    vendor: 'AMD',
    deviceName: 'Radeon Pro W7900',
    driverVersion: '6.8.5',
    architecture: 'gfx1100',
    vramBytes: 49_152_000_000,
    freeVramBytes: null,
    source: 'amd-smi'
  }]);
});

test('AMD SMI preserves unreported driver, architecture and VRAM as UNKNOWN', () => {
  const devices = parseAmdSmiStatic(`GPU: 0
    ASIC:
        VENDOR_ID: 0x1002
        MARKET_NAME: N/A
        TARGET_GRAPHICS_VERSION: N/A
    DRIVER:
        VERSION: N/A
    VRAM:
        SIZE: N/A`);
  assert.deepEqual(devices, [{
    vendor: 'AMD',
    deviceName: null,
    driverVersion: null,
    architecture: null,
    vramBytes: null,
    freeVramBytes: null,
    source: 'amd-smi'
  }]);
});

test('Windows PNP identity recognizes AMD without treating absent AdapterRAM as zero VRAM', () => {
  const devices = parseWindowsVideoControllers(JSON.stringify({
    Name: 'AMD Radeon RX 6800',
    PNPDeviceID: 'PCI\\VEN_1002&DEV_73BF&SUBSYS_00000000',
    DriverVersion: '31.0.24027.1012'
  }));
  assert.deepEqual(devices, [{
    vendor: 'AMD',
    deviceName: 'AMD Radeon RX 6800',
    driverVersion: '31.0.24027.1012',
    architecture: null,
    vramBytes: null,
    freeVramBytes: null,
    source: 'windows-pnp'
  }]);
});

test('hardware probe reports real machine facts', async () => {
  clearHardwareCache();
  const info = await probeHardware();
  assert.ok(info.totalRamBytes > 0, 'total RAM must be positive');
  assert.ok(info.freeRamBytes > 0, 'free RAM must be positive');
  assert.ok(info.freeRamBytes <= info.totalRamBytes);
  assert.ok(info.logicalCpus >= 1);
  assert.ok(info.vramBytes === null || info.vramBytes >= 0);
  assert.ok(info.freeVramBytes === null || info.freeVramBytes >= 0);
  assert.ok(['NVIDIA', 'AMD', 'INTEL', 'APPLE', 'CPU', 'UNKNOWN'].includes(info.vendor));
  assert.ok(['nvidia-smi', 'amd-smi', 'windows-pnp', 'multiple', 'unknown'].includes(info.vramSource));
  assert.ok(Array.isArray(info.devices));
});

test('hardware probe caches for 30 seconds', async () => {
  clearHardwareCache();
  const first = await probeHardware();
  const second = await probeHardware();
  assert.deepEqual(first, second);
});
