type TestBackend = 'facade' | 'ts' | 'legacy';

type StackRequestOptions = {
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  envelope?: boolean;
};

type StackJsonResponse = {
  status: number;
  body: Record<string, unknown>;
};

export function launchSupervisedStack(options: {
  workspace: string;
  env?: Record<string, string>;
  origin?: string;
}): Promise<{
  json(backend: TestBackend, method: string, pathname: string, options?: StackRequestOptions): Promise<StackJsonResponse>;
  request(backend: TestBackend, method: string, pathname: string, options?: StackRequestOptions): Promise<Response>;
  close(): Promise<void>;
}>;
