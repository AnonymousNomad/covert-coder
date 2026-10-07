/// <reference lib="dom" />
/// <reference lib="webworker" />

import * as monaco from 'monaco-editor/editor/editor.api';
import { DEFAULT_APPEARANCE, type AppearancePreferences } from '../desktop/theme.ts';
import { editorThemeFor, WORKSTATION_EDITOR_THEME } from './theme.ts';

export interface EditorView {
  relPath: string;
  splitId: string;
  editor: monaco.editor.IStandaloneCodeEditor;
}

const views = new Map<string, EditorView>();
let nextId = 0;
let appearance: AppearancePreferences = { ...DEFAULT_APPEARANCE };
let themeRegistered = false;

function key(relPath: string, splitId: string): string {
  return `${relPath}@${splitId}#${nextId++}`;
}

export function createView(container: HTMLElement, relPath: string, splitId: string, model: monaco.editor.ITextModel): EditorView {
  if (!themeRegistered) {
    monaco.editor.defineTheme(WORKSTATION_EDITOR_THEME, editorThemeFor(appearance));
    themeRegistered = true;
  }
  const editor = monaco.editor.create(container, {
    model,
    theme: WORKSTATION_EDITOR_THEME,
    fontSize: appearance.fontSize,
    lineHeight: Math.round(appearance.fontSize * appearance.lineHeight),
    fontFamily: `'${appearance.editorFont.replaceAll("'", '')}', Consolas, 'Courier New', monospace`,
    automaticLayout: true,
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    tabSize: 2,
    wordWrap: 'off',
    renderWhitespace: 'selection',
    find: { addExtraSpaceOnTop: false }
  });
  const view: EditorView = { relPath, splitId, editor };
  views.set(key(relPath, splitId), view);
  return view;
}

export function setEditorAppearance(next: AppearancePreferences): void {
  appearance = { ...next };
  monaco.editor.defineTheme(WORKSTATION_EDITOR_THEME, editorThemeFor(appearance));
  themeRegistered = true;
  monaco.editor.setTheme(WORKSTATION_EDITOR_THEME);
  const options = {
    fontSize: appearance.fontSize,
    lineHeight: Math.round(appearance.fontSize * appearance.lineHeight),
    fontFamily: `'${appearance.editorFont.replaceAll("'", '')}', Consolas, 'Courier New', monospace`
  };
  for (const view of views.values()) view.editor.updateOptions(options);
}

export function saveViewState(relPath: string, splitId: string): monaco.editor.ICodeEditorViewState | null {
  const view = findView(relPath, splitId);
  return view === undefined ? null : view.editor.saveViewState();
}

export function restoreViewState(relPath: string, splitId: string, state: monaco.editor.ICodeEditorViewState | null | undefined): void {
  const view = findView(relPath, splitId);
  if (view !== undefined && state !== null && state !== undefined) view.editor.restoreViewState(state);
}

export function disposeViewFor(relPath: string, splitId: string): void {
  for (const [key, view] of views) {
    if (view.relPath === relPath && view.splitId === splitId) {
      view.editor.dispose();
      views.delete(key);
    }
  }
}

export function disposeAllViews(): void {
  for (const view of views.values()) view.editor.dispose();
  views.clear();
}

export function focusView(relPath: string, splitId: string): void {
  const view = findView(relPath, splitId);
  view?.editor.focus();
}

export function revealLine(relPath: string, splitId: string, line: number): void {
  const view = findView(relPath, splitId);
  if (view === undefined) return;
  const position = { lineNumber: line, column: 1 };
  view.editor.setPosition(position);
  view.editor.revealLineInCenter(line);
  view.editor.focus();
}

function findView(relPath: string, splitId: string): EditorView | undefined {
  return [...views.values()].find(v => v.relPath === relPath && v.splitId === splitId);
}
