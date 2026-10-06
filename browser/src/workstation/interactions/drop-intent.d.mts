export interface ProjectBinding { readonly projectId: string; readonly rootGeneration: number }
export type DropTarget = 'desktop' | 'editor' | 'cipher' | 'models' | 'profiles' | 'launcher';
export type ResourceKind = 'project' | 'file' | 'model-artifact' | 'profile' | 'tool' | 'application';
export interface ResourceReference { readonly kind: ResourceKind; readonly id: string; readonly revision: string }
export interface InternalTransfer { mime: 'application/vnd.covert.resource+json'; data: string }
export interface FileHint { name: string; size: number; type: string; lastModified: number }
export interface ExternalTransfer { mime: 'application/x-covert-file-hint'; files: FileHint[] }
export type DropIntent =
  | Readonly<{ version: 1; kind: 'project.open.preview' | 'file.open.preview' | 'context.attach.preview' | 'model.inspect.preview' | 'profile.apply.preview' | 'tool.inspect.preview' | 'application.inspect.preview'; project: ProjectBinding | null; activation: 'DISABLED'; resource: ResourceReference }>
  | Readonly<{ version: 1; kind: 'external-file.inspect'; project: ProjectBinding; activation: 'DISABLED'; file: Readonly<FileHint> }>;
export type DropInspection =
  | Readonly<{ status: 'PREVIEW'; activation: 'DISABLED'; intent: DropIntent; preview: Readonly<{ label: string; ownerRevision: string }> }>
  | Readonly<{ status: 'REFUSED' | 'UNAVAILABLE'; code: string }>;
export function parseDropIntent(transfer: InternalTransfer | ExternalTransfer, target: DropTarget, binding: ProjectBinding | null): DropIntent;
export function createDropInspector(options: {
  getBinding(): ProjectBinding | null;
  inspectResource?(intent: DropIntent, options: { signal: AbortSignal }): Promise<ResourceReference & { label: string }>;
  timeoutMs?: number; maxPending?: number;
}): Readonly<{ stage(transfer: InternalTransfer | ExternalTransfer, target: DropTarget): Promise<DropInspection>; invalidate(): void; dispose(): void }>;
