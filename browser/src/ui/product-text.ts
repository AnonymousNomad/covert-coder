/** Product-owned prose only. Never transform source files, user text or IDs. */
export function productText(text: string): string {
  return text.replace(/(?<![\w-])AIDE(?: Sovereign Workbench)?(?![\w-])/g, 'Covert Coder');
}
