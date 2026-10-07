import type * as monaco from 'monaco-editor/editor/editor.api';
import { COVERT_PHOSPHOR, type AppearancePreferences } from '../desktop/theme.ts';

export const WORKSTATION_EDITOR_THEME = 'covert-workstation';

export function editorThemeFor(preferences: AppearancePreferences): monaco.editor.IStandaloneThemeData {
  const tokens = preferences.theme === 'TERMUX_IMPORT' && preferences.importedTermux !== null
    ? preferences.importedTermux
    : COVERT_PHOSPHOR;
  const color = (value: string): string => value.slice(1);
  return {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: color(tokens.textPrimary) },
      { token: 'comment', foreground: color(tokens.textMuted) },
      { token: 'keyword', foreground: color(tokens.accentPrimary) },
      { token: 'type', foreground: color(tokens.accentSecondary) },
      { token: 'number', foreground: color(tokens.textSecondary) },
      { token: 'string', foreground: color(tokens.accentSecondary) },
      { token: 'delimiter', foreground: color(tokens.textSecondary) },
      { token: 'regexp', foreground: color(tokens.accentSecondary) },
      { token: 'invalid', foreground: color(tokens.stateFailure) }
    ],
    colors: {
      'editor.background': tokens.desktopBackground,
      'editor.foreground': tokens.textPrimary,
      'editorGutter.background': tokens.desktopBackground,
      'editorLineNumber.foreground': tokens.textMuted,
      'editorLineNumber.activeForeground': tokens.accentPrimary,
      'editorCursor.foreground': tokens.cursor,
      'editor.selectionBackground': tokens.selectionBackground,
      'editor.inactiveSelectionBackground': tokens.selectionBackground,
      'editor.selectionForeground': tokens.selectionForeground,
      'editor.lineHighlightBackground': tokens.surfaceRaised,
      'editorIndentGuide.background1': tokens.windowBorder,
      'editorIndentGuide.activeBackground1': tokens.textMuted,
      'editorWhitespace.foreground': tokens.windowBorder,
      'editorWidget.background': tokens.surfaceBackground,
      'editorWidget.foreground': tokens.textPrimary,
      'editorWidget.border': tokens.windowBorder,
      'editorSuggestWidget.background': tokens.surfaceBackground,
      'editorSuggestWidget.foreground': tokens.textPrimary,
      'editorSuggestWidget.border': tokens.windowBorder,
      'editorSuggestWidget.selectedBackground': tokens.selectionBackground,
      'editorHoverWidget.background': tokens.surfaceBackground,
      'editorHoverWidget.foreground': tokens.textPrimary,
      'editorHoverWidget.border': tokens.windowBorder,
      'input.background': tokens.surfaceInset,
      'input.foreground': tokens.textPrimary,
      'input.border': tokens.windowBorder,
      'focusBorder': tokens.windowBorderFocused,
      'scrollbarSlider.background': tokens.windowBorder,
      'scrollbarSlider.hoverBackground': tokens.textMuted,
      'scrollbarSlider.activeBackground': tokens.accentPrimary,
      'minimap.background': tokens.desktopBackground,
      'editorError.foreground': tokens.stateFailure,
      'editorWarning.foreground': tokens.stateWarning,
      'editorInfo.foreground': tokens.stateInfo
    }
  };
}
