import type { DeviceTierT, HardwareProfileResponseT, HardwareRecommendResponseT } from '../../../common/contracts/hardware.ts';

export class HardwareProfileError extends Error {
  readonly code: string;
  constructor(code: string, message: string);
}
export function deriveTier(totalRamBytes: number): DeviceTierT;
export function deriveBackend(vramBytes: number): 'vulkan' | 'cpu';
export function getDeviceProfile(): Promise<HardwareProfileResponseT>;
export function recommendRoles(): Promise<HardwareRecommendResponseT>;
