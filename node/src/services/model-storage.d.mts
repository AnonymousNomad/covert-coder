export declare class ModelStorageError extends Error {
  readonly code: 'NOT_READY';
}

export declare function resolveModelStorageDirectory(
  configured?: string | undefined,
  fsOps?: {
    stat(path: string): Promise<{ isDirectory(): boolean }>;
    realpath(path: string): Promise<string>;
    access(path: string, mode?: number): Promise<void>;
  }
): Promise<string>;

export declare function sameModelStorageDirectory(left: string, right: string): boolean;
