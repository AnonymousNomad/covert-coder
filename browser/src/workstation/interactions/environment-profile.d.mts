import type { ProjectBinding } from './drop-intent.mjs';
export interface EnvironmentProfile {
  readonly version: 1; readonly id: string; readonly title: string;
  readonly layout: Readonly<{ version: 1; windows: ReadonlyArray<Readonly<{ instanceId: string; appRef: string; x: number; y: number; width: number; height: number; minimized?: boolean }>> }>;
  readonly applications: readonly string[]; readonly tools: readonly string[];
  readonly terminals: ReadonlyArray<Readonly<{ id: string; profileRef: string; cwdRef: string }>>;
  readonly modelRoles: ReadonlyArray<Readonly<{ role: string; modelRef: string; routeRef?: string }>>;
  readonly workflowRefs: readonly string[];
  readonly shortcuts: ReadonlyArray<Readonly<{ id: string; commandRef: string }>>;
}
export type ProfileReferenceKind = 'application' | 'tool' | 'terminal-profile' | 'directory' | 'model' | 'route' | 'workflow' | 'command';
export interface ProfileReference { readonly kind: ProfileReferenceKind; readonly id: string }
export function parseEnvironmentProfile(raw: string): EnvironmentProfile;
export function inspectEnvironmentProfile(raw: string, options: {
  binding: ProjectBinding | null;
  lookupCapability?(reference: ProfileReference & { readonly project: ProjectBinding }): { presence: 'PRESENT' | 'MISSING' | 'UNKNOWN'; revision?: string };
}): Readonly<{ profile: EnvironmentProfile; project: ProjectBinding; activation: 'DISABLED';
  references: ReadonlyArray<ProfileReference & { readonly presence: 'PRESENT' | 'MISSING' | 'UNKNOWN'; readonly revision?: string }>;
  missing: readonly ProfileReference[]; unknown: readonly ProfileReference[];
}>;
