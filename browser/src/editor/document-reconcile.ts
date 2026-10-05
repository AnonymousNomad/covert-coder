export interface ExternalDocumentSnapshot {
  savedContent: string;
  editorContent: string;
  diskContent: string;
  dirty: boolean;
}

export type ExternalDocumentAction = 'unchanged' | 'reload' | 'conflict';

export function classifyExternalDocumentChange(snapshot: ExternalDocumentSnapshot): ExternalDocumentAction {
  if (snapshot.diskContent === snapshot.savedContent) return 'unchanged';
  if (snapshot.dirty && snapshot.editorContent !== snapshot.diskContent) return 'conflict';
  return 'reload';
}
