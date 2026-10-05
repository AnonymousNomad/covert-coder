export type WorkstationThemeId = 'COVERT_PHOSPHOR' | 'TERMUX_IMPORT';
export type CursorStyle = 'block' | 'underline' | 'bar';
export type ReducedMotionMode = 'system' | 'on' | 'off';
export type WindowDensity = 'comfortable' | 'compact';
export type GlowLevel = 'off' | 'low';

export interface SemanticThemeTokens {
  desktopBackground: string;
  surfaceBackground: string;
  surfaceRaised: string;
  surfaceInset: string;
  windowBorder: string;
  windowBorderFocused: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentSecondary: string;
  stateSuccess: string;
  stateWarning: string;
  stateFailure: string;
  stateInfo: string;
  stateUnknown: string;
  selectionBackground: string;
  selectionForeground: string;
  cursor: string;
  terminalForeground: string;
  terminalBackground: string;
  terminalCursor: string;
  terminalColors: string[];
}

export interface AppearancePreferences {
  version: 1;
  theme: WorkstationThemeId;
  importedTermux: SemanticThemeTokens | null;
  interfaceFont: string;
  editorFont: string;
  terminalFont: string;
  fontSize: number;
  lineHeight: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  density: WindowDensity;
  glow: GlowLevel;
  scanlines: boolean;
  reducedMotion: ReducedMotionMode;
}

export interface ThemeEngine {
  preferences(): AppearancePreferences;
  update(patch: Partial<AppearancePreferences>): boolean;
  importTermux(text: string): boolean;
  dispose(): void;
}

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export const APPEARANCE_STORAGE_KEY = 'covert.desktop.appearance.v1';

export const COVERT_PHOSPHOR: SemanticThemeTokens = {
  desktopBackground: '#080d0d',
  surfaceBackground: '#101817',
  surfaceRaised: '#192420',
  surfaceInset: '#0a1010',
  windowBorder: '#31433d',
  windowBorderFocused: '#43c99a',
  textPrimary: '#e3ece7',
  textSecondary: '#b3c1ba',
  textMuted: '#87968e',
  accentPrimary: '#40d5a2',
  accentSecondary: '#76c9c2',
  stateSuccess: '#74d6a5',
  stateWarning: '#e6b963',
  stateFailure: '#e27f7f',
  stateInfo: '#7eb7d0',
  stateUnknown: '#a1aaa5',
  selectionBackground: '#174436',
  selectionForeground: '#e4fff2',
  cursor: '#50dfa9',
  terminalForeground: '#d7e7de',
  terminalBackground: '#080d0d',
  terminalCursor: '#50dfa9',
  terminalColors: [
    '#101817', '#df777b', '#6fca8e', '#d4b35f', '#72a8cf', '#bd8bc7', '#66b9b2', '#c5d0ca',
    '#64726c', '#ee888c', '#85dc9f', '#f0cb70', '#8abce2', '#d09bd8', '#7bc8c1', '#e3ece7'
  ]
};

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  version: 1,
  theme: 'COVERT_PHOSPHOR',
  importedTermux: null,
  interfaceFont: 'Segoe UI',
  editorFont: 'Cascadia Mono',
  terminalFont: 'Cascadia Mono',
  fontSize: 13,
  lineHeight: 1.45,
  cursorStyle: 'block',
  cursorBlink: false,
  density: 'comfortable',
  glow: 'low',
  scanlines: false,
  reducedMotion: 'system'
};

const HEX_COLOR = /^#[\da-f]{6}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

function isThemeTokens(value: unknown): value is SemanticThemeTokens {
  if (!isRecord(value) || !Array.isArray(value.terminalColors) || value.terminalColors.length !== 16) return false;
  const colorKeys = Object.keys(COVERT_PHOSPHOR).filter(key => key !== 'terminalColors');
  return colorKeys.every(key => isColor(value[key])) && value.terminalColors.every(isColor);
}

function validPreferences(value: unknown): value is AppearancePreferences {
  if (!isRecord(value) || value.version !== 1) return false;
  if (value.theme !== 'COVERT_PHOSPHOR' && value.theme !== 'TERMUX_IMPORT') return false;
  if (value.importedTermux !== null && !isThemeTokens(value.importedTermux)) return false;
  if (![value.interfaceFont, value.editorFont, value.terminalFont].every(font => typeof font === 'string' && font.length > 0 && font.length <= 96)) return false;
  if (typeof value.fontSize !== 'number' || !Number.isFinite(value.fontSize) || value.fontSize < 10 || value.fontSize > 24) return false;
  if (typeof value.lineHeight !== 'number' || !Number.isFinite(value.lineHeight) || value.lineHeight < 1 || value.lineHeight > 2) return false;
  if (!['block', 'underline', 'bar'].includes(String(value.cursorStyle))) return false;
  if (typeof value.cursorBlink !== 'boolean' || typeof value.scanlines !== 'boolean') return false;
  if (!['comfortable', 'compact'].includes(String(value.density))) return false;
  if (!['off', 'low'].includes(String(value.glow))) return false;
  return ['system', 'on', 'off'].includes(String(value.reducedMotion));
}

function copyTokens(tokens: SemanticThemeTokens): SemanticThemeTokens {
  return { ...tokens, terminalColors: [...tokens.terminalColors] };
}

export function terminalThemeFor(preferences: AppearancePreferences): TerminalTheme {
  const tokens = preferences.theme === 'TERMUX_IMPORT' && preferences.importedTermux !== null
    ? preferences.importedTermux
    : COVERT_PHOSPHOR;
  const colors = tokens.terminalColors;
  return {
    background: tokens.terminalBackground,
    foreground: tokens.terminalForeground,
    cursor: tokens.terminalCursor,
    selectionBackground: tokens.selectionBackground,
    black: colors[0]!, red: colors[1]!, green: colors[2]!, yellow: colors[3]!,
    blue: colors[4]!, magenta: colors[5]!, cyan: colors[6]!, white: colors[7]!,
    brightBlack: colors[8]!, brightRed: colors[9]!, brightGreen: colors[10]!, brightYellow: colors[11]!,
    brightBlue: colors[12]!, brightMagenta: colors[13]!, brightCyan: colors[14]!, brightWhite: colors[15]!
  };
}

export function parseTermuxPalette(text: string): SemanticThemeTokens {
  if (text.length > 64 * 1024) throw new Error('Theme file exceeds the 64 KiB import limit.');
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#') || trimmed.startsWith('!')) continue;
    const match = /^(background|foreground|cursor|cursorColor|selectionBackground|color(?:[0-9]|1[0-5]))\s*[=:]\s*(#[\da-f]{6})\s*$/i.exec(trimmed);
    if (match) values.set(match[1]!.toLowerCase(), match[2]!.toLowerCase());
  }
  const colors = [...COVERT_PHOSPHOR.terminalColors];
  for (let index = 0; index < colors.length; index++) {
    const parsed = values.get(`color${index}`);
    if (parsed !== undefined) colors[index] = parsed;
  }
  const foreground = values.get('foreground') ?? COVERT_PHOSPHOR.terminalForeground;
  const background = values.get('background') ?? COVERT_PHOSPHOR.terminalBackground;
  const cursor = values.get('cursorcolor') ?? values.get('cursor') ?? COVERT_PHOSPHOR.terminalCursor;
  const imported: SemanticThemeTokens = {
    ...COVERT_PHOSPHOR,
    desktopBackground: background,
    surfaceBackground: colors[0] ?? COVERT_PHOSPHOR.surfaceBackground,
    surfaceRaised: colors[8] ?? COVERT_PHOSPHOR.surfaceRaised,
    surfaceInset: background,
    textPrimary: foreground,
    textSecondary: colors[7] ?? COVERT_PHOSPHOR.textSecondary,
    textMuted: colors[8] ?? COVERT_PHOSPHOR.textMuted,
    accentPrimary: colors[2] ?? COVERT_PHOSPHOR.accentPrimary,
    accentSecondary: colors[6] ?? COVERT_PHOSPHOR.accentSecondary,
    selectionBackground: values.get('selectionbackground') ?? COVERT_PHOSPHOR.selectionBackground,
    cursor,
    terminalForeground: foreground,
    terminalBackground: background,
    terminalCursor: cursor,
    terminalColors: colors
  };
  if (!isThemeTokens(imported)) throw new Error('Theme colors were invalid. Use six-digit hexadecimal values.');
  return imported;
}

function readPreferences(storage: Storage | null): AppearancePreferences {
  if (storage === null) return { ...DEFAULT_APPEARANCE };
  try {
    const raw = storage.getItem(APPEARANCE_STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_APPEARANCE };
    const parsed: unknown = JSON.parse(raw);
    return validPreferences(parsed)
      ? { ...parsed, importedTermux: parsed.importedTermux === null ? null : copyTokens(parsed.importedTermux) }
      : { ...DEFAULT_APPEARANCE };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

function applyTokens(root: HTMLElement, tokens: SemanticThemeTokens, preferences: AppearancePreferences): void {
  const variables: Record<string, string> = {
    '--desktop-background': tokens.desktopBackground,
    '--desktop-surface': tokens.surfaceBackground,
    '--desktop-raised': tokens.surfaceRaised,
    '--desktop-inset': tokens.surfaceInset,
    '--desktop-border': tokens.windowBorder,
    '--desktop-border-focus': tokens.windowBorderFocused,
    '--desktop-text': tokens.textPrimary,
    '--desktop-text-secondary': tokens.textSecondary,
    '--desktop-text-muted': tokens.textMuted,
    '--desktop-accent': tokens.accentPrimary,
    '--desktop-accent-cyan': tokens.accentSecondary,
    '--desktop-success': tokens.stateSuccess,
    '--desktop-warning': tokens.stateWarning,
    '--desktop-failure': tokens.stateFailure,
    '--desktop-info': tokens.stateInfo,
    '--desktop-unknown': tokens.stateUnknown,
    '--desktop-selection-background': tokens.selectionBackground,
    '--desktop-selection-foreground': tokens.selectionForeground,
    '--desktop-cursor': tokens.cursor,
    '--desktop-terminal-foreground': tokens.terminalForeground,
    '--desktop-terminal-background': tokens.terminalBackground,
    '--desktop-terminal-cursor': tokens.terminalCursor,
    '--desktop-font-interface': `'${preferences.interfaceFont.replaceAll("'", '')}', system-ui, sans-serif`,
    '--desktop-font-editor': `'${preferences.editorFont.replaceAll("'", '')}', monospace`,
    '--desktop-font-mono': `'${preferences.terminalFont.replaceAll("'", '')}', monospace`,
    '--desktop-font-size': `${preferences.fontSize}px`,
    '--desktop-line-height': String(preferences.lineHeight),
    '--desktop-window-density': preferences.density === 'compact' ? '8px' : '14px',
    '--desktop-glow-opacity': preferences.glow === 'low' ? '0.18' : '0',
    '--desktop-scanline-opacity': preferences.scanlines ? '0.035' : '0'
  };
  tokens.terminalColors.forEach((color, index) => { variables[`--desktop-terminal-color-${index}`] = color; });
  for (const [property, value] of Object.entries(variables)) root.style.setProperty(property, value);
  root.dataset.theme = preferences.theme === 'COVERT_PHOSPHOR' ? 'covert-phosphor' : 'termux-import';
  root.dataset.density = preferences.density;
  root.dataset.glow = preferences.glow;
  root.dataset.scanlines = String(preferences.scanlines);
  const reducedMotion = preferences.reducedMotion === 'on' || (preferences.reducedMotion === 'system' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.dataset.reducedMotion = String(reducedMotion);
}

export function createThemeEngine(root: HTMLElement): ThemeEngine {
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { /* In-memory appearance still works. */ }
  let current = readPreferences(storage);
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const apply = (): void => applyTokens(root, current.theme === 'TERMUX_IMPORT' && current.importedTermux ? current.importedTermux : COVERT_PHOSPHOR, current);
  const onMotionPreference = (): void => {
    if (current.reducedMotion === 'system') apply();
  };
  motionQuery.addEventListener('change', onMotionPreference);
  apply();
  return {
    preferences: () => ({ ...current, importedTermux: current.importedTermux ? copyTokens(current.importedTermux) : null }),
    update(patch): boolean {
      const candidate: AppearancePreferences = { ...current, ...patch };
      if (!validPreferences(candidate)) return false;
      current = candidate;
      apply();
      let persisted = false;
      try {
        if (storage !== null) {
          storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(current));
          persisted = true;
        }
      } catch { /* The selected appearance remains active for this session. */ }
      document.dispatchEvent(new CustomEvent('covert:appearance-changed', { detail: this.preferences() }));
      return persisted;
    },
    importTermux(text): boolean {
      const importedTermux = parseTermuxPalette(text);
      return this.update({ theme: 'TERMUX_IMPORT', importedTermux });
    },
    dispose(): void {
      motionQuery.removeEventListener('change', onMotionPreference);
    }
  };
}
