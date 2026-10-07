import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeHardware, clearHardwareCache, parseNvidiaSmiMemory } from '../../node/src/services/hardware.ts';
import { getDeviceProfile } from '../../node/src/services/hardware-profile.mjs';

test('cached hardware profile retains the source observation time, not response time', async () => {
 clearHardwareCache();
 const sample = await probeHardware();
 const first = await getDeviceProfile();
 await new Promise(resolve => setTimeout(resolve, 10));
 const second = await getDeviceProfile();
 assert.equal(first.detectedAt, sample.detectedAt);
 assert.equal(second.detectedAt, first.detectedAt);
 assert.equal(first.freeVramKnown, sample.freeVramKnown);
 assert.ok(first.detectedAt <= Date.now());
});
for (const [input, expected] of [
 ['6144, 0', {totalMib:6144,freeMib:0}],
 ['6144, ', {totalMib:6144,freeMib:null}],
 ['6144, -1', {totalMib:6144,freeMib:null}],
 ['6144, 7000', {totalMib:6144,freeMib:null}],
 ['6144, N/A', {totalMib:6144,freeMib:null}]
] as const) {
 test(`GPU free-memory probe distinguishes measured zero from unavailable: ${input}`, () => {
   assert.deepEqual(parseNvidiaSmiMemory(input), expected);
 });
}
