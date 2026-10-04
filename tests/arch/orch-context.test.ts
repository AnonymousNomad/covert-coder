import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapHardwareProbe } from '../../node/src/services/orch-context.mjs';

test('orchestrator telemetry preserves known zero VRAM and unknown VRAM separately', () => {
  assert.deepEqual(mapHardwareProbe({
    totalRamBytes: 16 * 1024 ** 3,
    freeRamBytes: 4 * 1024 ** 3,
    vramBytes: 0,
    freeVramBytes: 0,
    deviceName: 'Radeon Pro fixture',
    vramSource: 'amd-smi'
  }), {
    ramFreeMb: 4096,
    ramTotalMb: 16384,
    vramTotalMb: 0,
    vramFreeMb: 0,
    gpuName: 'Radeon Pro fixture',
    source: 'amd-smi'
  });

  const unknown = mapHardwareProbe({
    totalRamBytes: 16 * 1024 ** 3,
    freeRamBytes: 4 * 1024 ** 3,
    vramBytes: null,
    freeVramBytes: null,
    deviceName: 'Radeon Pro fixture',
    vramSource: 'windows-pnp'
  });
  assert.equal(unknown.vramTotalMb, null);
  assert.equal(unknown.vramFreeMb, null);
});
