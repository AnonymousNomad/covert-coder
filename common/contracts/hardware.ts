import { z } from 'zod';

/**
 * Covert Core v0.1 — hardware capability detection + role-based model
 * recommendation. Contract-first slice 1. Consumes the existing
 * `node/src/services/hardware.ts` probe and `models/manifest.json` registry.
 */

export const DeviceTier = z.enum(['S', 'M', 'L', 'XL']);

export const HardwareBackend = z.enum(['vulkan', 'cuda', 'rocm', 'cpu', 'apple', 'unknown']);
export const HardwareVendor = z.enum(['NVIDIA', 'AMD', 'INTEL', 'APPLE', 'CPU', 'UNKNOWN']);
export const HardwareDeviceSource = z.enum(['nvidia-smi', 'amd-smi', 'windows-pnp']);
export const HardwareDevice = z.object({
  vendor: z.enum(['NVIDIA', 'AMD', 'INTEL', 'APPLE', 'UNKNOWN']),
  deviceName: z.string().nullable(),
  driverVersion: z.string().nullable(),
  architecture: z.string().nullable(),
  vramBytes: z.number().nonnegative().nullable(),
  freeVramBytes: z.number().nonnegative().nullable(),
  source: HardwareDeviceSource
}).strict();

export const HardwareProfileResponse = z
  .object({
    totalRamBytes: z.number().nonnegative(),
    freeRamBytes: z.number().nonnegative(),
    logicalCpus: z.number().int().nonnegative(),
    devices: z.array(HardwareDevice),
    vendor: HardwareVendor,
    deviceName: z.string().nullable(),
    driverVersion: z.string().nullable(),
    architecture: z.string().nullable(),
    vramBytes: z.number().nonnegative().nullable(),
    freeVramBytes: z.number().nonnegative().nullable(),
    vramSource: z.enum(['nvidia-smi', 'amd-smi', 'windows-pnp', 'multiple', 'unknown']),
    tier: DeviceTier,
    backend: HardwareBackend,
    detectedAt: z.number().positive()
  })
  .strict();

export const CovertRole = z.enum(['planner', 'coder', 'reviewer']);

export const RoleRecommendation = z
  .object({
    role: CovertRole,
    modelId: z.string().min(1),
    name: z.string().min(1),
    parametersB: z.number().nonnegative(),
    quant: z.string().min(1),
    fileBytes: z.number().nonnegative(),
    contextTokens: z.number().int().positive(),
    fit: z.enum(['COMFORTABLE', 'TIGHT', 'OVER']),
    onDisk: z.boolean(),
    reason: z.string().min(1)
  })
  .strict();

export const HardwareRecommendResponse = z
  .object({
    device: z
      .object({
        tier: DeviceTier,
        backend: HardwareBackend,
        totalRamGb: z.number().nonnegative(),
        logicalCpus: z.number().int().nonnegative(),
        vramMb: z.number().nonnegative().nullable()
      })
      .strict(),
    recommendations: z.array(RoleRecommendation).min(3).max(3),
    generatedAt: z.number().positive()
  })
  .strict();

export type DeviceTierT = z.infer<typeof DeviceTier>;
export type HardwareBackendT = z.infer<typeof HardwareBackend>;
export type HardwareVendorT = z.infer<typeof HardwareVendor>;
export type HardwareDeviceT = z.infer<typeof HardwareDevice>;
export type CovertRoleT = z.infer<typeof CovertRole>;
export type HardwareProfileResponseT = z.infer<typeof HardwareProfileResponse>;
export type RoleRecommendationT = z.infer<typeof RoleRecommendation>;
export type HardwareRecommendResponseT = z.infer<typeof HardwareRecommendResponse>;
