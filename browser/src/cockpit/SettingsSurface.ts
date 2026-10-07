// Settings surface — existing provider and BYOK configuration panels.
// Credentials/configuration are not runtime execution evidence.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { createProvidersPanel } from '../providers/providers.ts';
import { createByokPanel } from '../byok/byok.ts';
import { createConnectionsPanel } from '../connections/connections.ts';
import type { AppearancePreferences, ThemeEngine } from '../desktop/theme.ts';
import type { CipherPreferences, CipherSpeechState, CipherVoiceService } from '../desktop/cipher-voice.ts';

export interface SettingsSurfaceHandles {
  dispose(): void;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createSettingsSurface(parent: HTMLElement, _store: Store<AppState>, opts: { onToast: (code: string, message: string) => void; onReopenWalkthrough?: () => void; onRunSetup?: () => void; theme?: ThemeEngine; cipherVoice?: CipherVoiceService }): SettingsSurfaceHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content cockpit-settings-surface');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'SETTINGS'));
  header.appendChild(el('span', 'panel-maturity', 'AVAILABLE'));
  root.appendChild(header);
  root.appendChild(el('p', 'panel-intro', 'Provider and BYOK configuration surfaces are available. Stored credentials/configuration do not prove active remote execution; runtime route evidence remains in MODELS.'));

  if (opts.onReopenWalkthrough !== undefined) {
    const walkthroughSection = el('section', 'cockpit-settings-section');
    walkthroughSection.appendChild(el('h3', 'cockpit-settings-section-title', 'WALKTHROUGH'));
    const reopen = el('button', 'cockpit-settings-action', 'REOPEN WALKTHROUGH') as HTMLButtonElement;
    reopen.type = 'button';
    const reopenHandler = (): void => opts.onReopenWalkthrough!();
    reopen.addEventListener('click', reopenHandler);
    walkthroughSection.appendChild(reopen);
    if (opts.onRunSetup !== undefined) {
      const runSetup = el('button', 'cockpit-settings-action', 'RUN ADAPTIVE SETUP') as HTMLButtonElement;
      runSetup.type = 'button';
      runSetup.addEventListener('click', () => opts.onRunSetup!());
      walkthroughSection.appendChild(runSetup);
    }
    root.appendChild(walkthroughSection);
  }

  if (opts.theme !== undefined) {
    const theme = opts.theme;
    const current = theme.preferences();
    const appearanceSection = el('section', 'cockpit-settings-section desktop-settings-group');
    appearanceSection.appendChild(el('h3', 'cockpit-settings-section-title', 'APPEARANCE'));
    appearanceSection.appendChild(el('p', 'panel-intro', 'Presentation preferences are local to this workstation. Termux palette files are read locally and are not uploaded.'));
    const feedback = el('div', 'desktop-settings-feedback', 'Appearance follows system settings where selected.');
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    const persist = (patch: Partial<AppearancePreferences>): void => {
      const saved = theme.update(patch);
      feedback.textContent = saved ? 'Appearance applied and saved on this device.' : 'Appearance applied for this session; this device could not save the preference.';
    };
    const addSelect = <T extends string>(labelText: string, value: T, choices: readonly [T, string][], onChange: (next: T) => void): HTMLSelectElement => {
      const label = el('label', 'desktop-settings-field');
      label.appendChild(el('span', 'desktop-settings-label', labelText));
      const select = document.createElement('select');
      select.className = 'desktop-settings-control';
      for (const [choice, text] of choices) select.add(new Option(text, choice));
      select.value = value;
      select.addEventListener('change', () => onChange(select.value as T));
      label.appendChild(select);
      appearanceSection.appendChild(label);
      return select;
    };
    const addRange = (labelText: string, value: number, min: number, max: number, step: number, format: (n: number) => string, onChange: (next: number) => void): void => {
      const label = el('label', 'desktop-settings-field');
      const line = el('span', 'desktop-settings-range-label');
      const name = el('span', 'desktop-settings-label', labelText);
      const shown = el('output', 'desktop-settings-value', format(value));
      line.append(name, shown);
      const input = document.createElement('input');
      input.type = 'range'; input.className = 'desktop-settings-range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(value);
      input.addEventListener('input', () => { const next = Number(input.value); shown.textContent = format(next); onChange(next); });
      label.append(line, input);
      appearanceSection.appendChild(label);
    };
    const addToggle = (labelText: string, checked: boolean, onChange: (next: boolean) => void): void => {
      const label = el('label', 'desktop-settings-toggle');
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked;
      input.addEventListener('change', () => onChange(input.checked));
      label.append(input, el('span', 'desktop-settings-label', labelText));
      appearanceSection.appendChild(label);
    };
    const themeSelect = addSelect('Theme', current.theme, [['COVERT_PHOSPHOR', 'Covert Phosphor'], ['TERMUX_IMPORT', 'Imported Termux palette']], value => persist({ theme: value }));
    const termuxOption = themeSelect.querySelector<HTMLOptionElement>('option[value="TERMUX_IMPORT"]');
    if (termuxOption !== null) termuxOption.disabled = current.importedTermux === null;
    const paletteLabel = el('label', 'desktop-settings-field');
    paletteLabel.appendChild(el('span', 'desktop-settings-label', 'Import a .properties palette'));
    const paletteFile = document.createElement('input');
    paletteFile.type = 'file'; paletteFile.accept = '.properties,text/plain'; paletteFile.className = 'desktop-settings-control';
    paletteFile.addEventListener('change', () => {
      const file = paletteFile.files?.[0];
      if (!file) return;
      if (file.size > 64 * 1024) { feedback.textContent = 'Palette was not imported: file exceeds the 64 KiB limit.'; paletteFile.value = ''; return; }
      void file.text().then(text => {
        const saved = theme.importTermux(text);
        themeSelect.value = theme.preferences().theme;
        if (termuxOption !== null) termuxOption.disabled = false;
        feedback.textContent = saved ? 'Palette imported locally and saved on this device.' : 'Palette imported for this session; this device could not save the preference.';
      }).catch(() => { feedback.textContent = 'Palette could not be read. No file data was uploaded.'; });
    });
    paletteLabel.appendChild(paletteFile); appearanceSection.appendChild(paletteLabel);
    const fontChoices: readonly [string, string][] = [['Segoe UI', 'Segoe UI'], ['Cascadia Mono', 'Cascadia Mono'], ['Consolas', 'Consolas']];
    addSelect('Interface font', current.interfaceFont, fontChoices, value => persist({ interfaceFont: value }));
    addSelect('Editor font', current.editorFont, fontChoices, value => persist({ editorFont: value }));
    addSelect('Terminal font', current.terminalFont, fontChoices, value => persist({ terminalFont: value }));
    addRange('Text size', current.fontSize, 10, 24, 1, value => `${value}px`, value => persist({ fontSize: value }));
    addRange('Line height', current.lineHeight, 1, 2, 0.05, value => value.toFixed(2), value => persist({ lineHeight: value }));
    addSelect('Window density', current.density, [['comfortable', 'Comfortable'], ['compact', 'Compact']], value => persist({ density: value }));
    addSelect('Terminal cursor', current.cursorStyle, [['block', 'Block'], ['underline', 'Underline'], ['bar', 'Bar']], value => persist({ cursorStyle: value }));
    addToggle('Blink terminal cursor', current.cursorBlink, value => persist({ cursorBlink: value }));
    addSelect('Glow effects', current.glow, [['low', 'Low'], ['off', 'Off']], value => persist({ glow: value }));
    addToggle('Scanline effect', current.scanlines, value => persist({ scanlines: value }));
    addSelect('Reduced motion', current.reducedMotion, [['system', 'Follow system'], ['on', 'Reduce motion'], ['off', 'Allow motion']], value => persist({ reducedMotion: value }));
    appearanceSection.appendChild(feedback);
    root.appendChild(appearanceSection);
  }

  if (opts.cipherVoice !== undefined) {
    const voice = opts.cipherVoice;
    const cipherSection = el('section', 'cockpit-settings-section desktop-settings-group');
    cipherSection.appendChild(el('h3', 'cockpit-settings-section-title', 'CIPHER IDENTITY & VOICE'));
    cipherSection.appendChild(el('p', 'panel-intro', 'Covert is the workstation. Cipher is its Resident intelligence. Presentation identity does not change service names, routes, or authority.'));
    const prefs = voice.preferences();
    const feedback = el('div', 'desktop-settings-feedback', 'MICROPHONE: OFF · WAKE WORD: UNAVAILABLE');
    feedback.dataset.speechState = voice.speechState();
    feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
    cipherSection.appendChild(feedback);
    const persist = (patch: Partial<CipherPreferences>): void => {
      const saved = voice.update(patch);
      feedback.textContent = `${voice.speechState() === 'speaking' ? 'VOICE: SPEAKING · ' : ''}MICROPHONE: OFF · WAKE WORD: UNAVAILABLE${saved ? ' · SAVED ON THIS DEVICE' : ' · SESSION ONLY'}`;
    };
    const operator = document.createElement('input'); operator.type = 'text'; operator.className = 'desktop-settings-control'; operator.maxLength = 64; operator.value = prefs.operatorName;
    operator.addEventListener('change', () => persist({ operatorName: operator.value.trim() || 'Operator' }));
    const operatorLabel = el('label', 'desktop-settings-field'); operatorLabel.appendChild(el('span', 'desktop-settings-label', 'Operator name')); operatorLabel.appendChild(operator); cipherSection.appendChild(operatorLabel);
    const addVoiceToggle = (labelText: string, checked: boolean, disabled: boolean, onChange: (next: boolean) => void): HTMLInputElement => {
      const label = el('label', `desktop-settings-toggle${disabled ? ' is-disabled' : ''}`);
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked; input.disabled = disabled;
      input.addEventListener('change', () => onChange(input.checked)); label.append(input, el('span', 'desktop-settings-label', labelText)); cipherSection.appendChild(label);
      return input;
    };
    const voiceResponsesToggle = addVoiceToggle('Enable spoken responses (off by default)', prefs.voiceResponses, false, value => persist({ voiceResponses: value }));
    const startupGreetingToggle = addVoiceToggle('Speak a readiness greeting after pairing', prefs.startupGreeting, !prefs.voiceResponses, value => persist({ startupGreeting: value }));
    voiceResponsesToggle.addEventListener('change', () => { startupGreetingToggle.disabled = !voiceResponsesToggle.checked; });
    addVoiceToggle('Enable wake-word listening', false, true, () => {});
    const wakeSelect = document.createElement('select'); wakeSelect.className = 'desktop-settings-control'; wakeSelect.disabled = true;
    wakeSelect.add(new Option('Cipher', 'Cipher')); wakeSelect.add(new Option('Hey Cipher', 'Hey Cipher')); wakeSelect.value = prefs.wakePhrase;
    const wakeLabel = el('label', 'desktop-settings-field'); wakeLabel.appendChild(el('span', 'desktop-settings-label', 'Wake phrase · unavailable')); wakeLabel.appendChild(wakeSelect); cipherSection.appendChild(wakeLabel);
    addVoiceToggle('Continuous listening', false, true, () => {});
    addVoiceToggle('Sidekick suggestions', prefs.sidekickEnabled, false, value => persist({ sidekickEnabled: value }));
    cipherSection.appendChild(el('p', 'desktop-settings-note', 'This build has no local wake detector. No microphone is opened. Browser dictation or cloud speech is not substituted.'));
    cipherSection.appendChild(el('p', 'desktop-settings-note', 'Speech output uses the configured operating-system/browser voice. Processing locality depends on that voice; Covert does not claim it is local.'));
    const actions = el('div', 'desktop-settings-actions');
    const preview = el('button', 'cockpit-settings-action', 'PREVIEW SYSTEM VOICE') as HTMLButtonElement;
    preview.type = 'button'; preview.addEventListener('click', () => {
      const result = voice.previewVoice();
      if (result === 'disabled') feedback.textContent = 'Speech preview is off. Enable spoken responses first.';
      else if (result === 'unavailable') feedback.textContent = 'System speech output is unavailable in this browser/runtime.';
      else feedback.textContent = 'VOICE: STARTING · use Stop speech to mute immediately.';
    });
    const readiness = el('button', 'cockpit-settings-action', 'SPEAK CURRENT READINESS') as HTMLButtonElement;
    readiness.type = 'button'; readiness.addEventListener('click', () => {
      void voice.speakReadiness().then(result => {
        feedback.textContent = result === 'started' ? 'VOICE: STARTING · readiness came from the canonical /api/readiness read.'
          : result === 'unknown' ? 'Readiness could not be read. No readiness claim was spoken.'
            : result === 'disabled' ? 'Enable spoken responses first.' : 'System speech output is unavailable.';
      });
    });
    const stop = el('button', 'cockpit-settings-action', 'STOP SPEECH') as HTMLButtonElement;
    stop.type = 'button'; stop.addEventListener('click', () => voice.stopSpeaking());
    actions.append(preview, readiness, stop); cipherSection.appendChild(actions);
    const speechStateHandler = (event: Event): void => {
      const state = (event as CustomEvent<CipherSpeechState>).detail;
      feedback.dataset.speechState = state;
      feedback.textContent = state === 'speaking' ? 'VOICE: SPEAKING · MICROPHONE: OFF · WAKE WORD: UNAVAILABLE'
        : `VOICE: ${state.toUpperCase()} · MICROPHONE: OFF · WAKE WORD: UNAVAILABLE`;
    };
    document.addEventListener('covert:cipher-speech-state', speechStateHandler);
    root.appendChild(cipherSection);
    const disposeVoiceSettings = (): void => document.removeEventListener('covert:cipher-speech-state', speechStateHandler);
    root.dataset.voiceSettings = 'mounted';
    (root as HTMLElement & { disposeVoiceSettings?: () => void }).disposeVoiceSettings = disposeVoiceSettings;
  }

  const providersMount = el('section', 'cockpit-settings-section');
  providersMount.appendChild(el('h3', 'cockpit-settings-section-title', 'SECURITY'));
  providersMount.appendChild(el('h4', 'cockpit-settings-subtitle', 'SECRETS'));
  providersMount.appendChild(el('p', 'panel-intro', 'Stored credentials are encrypted at rest by the daemon and are never re-displayed. ADD / REPLACE / REMOVE / TEST CONNECTION run through the same operator pairing owner that authorizes every other write; there is no separate credential store.'));
  const byokMount = el('section', 'cockpit-settings-section');
  const connectionsMount = el('section', 'cockpit-settings-section');
  connectionsMount.appendChild(el('h3', 'cockpit-settings-section-title', 'CONNECTIONS'));
  connectionsMount.appendChild(el('h4', 'cockpit-settings-subtitle', 'UNIFIED PROVIDER VIEW'));
  connectionsMount.appendChild(el('p', 'panel-intro', 'One canonical read over subscription runtimes, API-key providers, the local runtime, and catalog access. States are local evidence only: stored keys and installed CLIs are shown as configured, never as live connections.'));
  root.append(providersMount, byokMount, connectionsMount);
  parent.appendChild(root);

  createProvidersPanel(providersMount, opts);
  let byokPanel: ReturnType<typeof createByokPanel> | null = null;
  let connectionsPanel: ReturnType<typeof createConnectionsPanel> | null = null;
  byokPanel = createByokPanel(byokMount, {
    onToast: opts.onToast,
    onModelAccessChanged: () => { void connectionsPanel?.refresh(); }
  });
  connectionsPanel = createConnectionsPanel(connectionsMount, {
    onToast: opts.onToast,
    onCatalogChanged: () => { void byokPanel?.refresh(); },
    onModelStatusChanged: () => { void byokPanel?.refresh(); }
  });

  return {
    dispose() {
      connectionsPanel?.dispose();
      (root as HTMLElement & { disposeVoiceSettings?: () => void }).disposeVoiceSettings?.();
      parent.innerHTML = '';
    }
  };
}
