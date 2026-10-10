export function createCreationStudioService(options: {
  workspace: string;
  now?: () => Date;
}): {
  list(): unknown;
  put(input: unknown): unknown;
};
