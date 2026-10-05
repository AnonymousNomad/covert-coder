import { api } from '../services/api.ts';

export type CipherSpeechState = 'idle' | 'speaking' | 'unavailable' | 'error';
export type WakeWordState = 'off' | 'unavailable' | 'listening' | 'paused';

export interface CipherPreferences {
  version: 1;
  operatorName: string;
  voiceResponses: boolean;
  startupGreeting: boolean;
  wakeWordEnabled: boolean;
  wakePhrase: 'Cipher' | 'Hey Cipher';
  continuousListening: boolean;
  sidekickEnabled: boolean;
}

export interface SpeechInput {
  readonly state: 'unavailable';
  start(): Promise<never>;
  stop(): void;
}

export interface WakeWordEngine {
  readonly state: WakeWordState;
  start(): Promise<never>;
  stop(): void;
  pauseForSpeech(): void;
  resumeAfterSpeech(): void;
}

export interface SpeechOutput {
  speak(text: string): 'started' | 'disabled' | 'unavailable';
  stop(): void;
  dispose(): void;
}

export interface CipherVoiceService {
  preferences(): CipherPreferences;
  update(patch: Partial<CipherPreferences>): boolean;
  speechState(): CipherSpeechState;
  wakeState(): WakeWordState;
  speakReadiness(): Promise<'started' | 'disabled' | 'unavailable' | 'unknown'>;
  speakStartupGreeting(): Promise<'started' | 'disabled' | 'unavailable' | 'unknown'>;
  previewVoice(): 'started' | 'disabled' | 'unavailable';
  stopSpeaking(): void;
  dispose(): void;
}

export const CIPHER_PREFERENCES_STORAGE_KEY = 'covert.desktop.cipher-preferences.v1';
export const DEFAULT_CIPHER_PREFERENCES: CipherPreferences = {
  version: 1,
  operatorName: 'Operator',
  voiceResponses: false,
  startupGreeting: false,
  wakeWordEnabled: false,
  wakePhrase: 'Cipher',
  continuousListening: false,
  sidekickEnabled: false
};

function validPreferences(value: unknown): value is CipherPreferences {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.version === 1
    && typeof candidate.operatorName === 'string' && candidate.operatorName.trim().length > 0 && candidate.operatorName.length <= 64
    && typeof candidate.voiceResponses === 'boolean'
    && typeof candidate.startupGreeting === 'boolean'
    && typeof candidate.wakeWordEnabled === 'boolean'
    && (candidate.wakePhrase === 'Cipher' || candidate.wakePhrase === 'Hey Cipher')
    && typeof candidate.continuousListening === 'boolean'
    && typeof candidate.sidekickEnabled === 'boolean';
}

function readPreferences(storage: Storage | null): CipherPreferences {
  if (storage === null) return { ...DEFAULT_CIPHER_PREFERENCES };
  try {
    const raw = storage.getItem(CIPHER_PREFERENCES_STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_CIPHER_PREFERENCES };
    const parsed: unknown = JSON.parse(raw);
    return validPreferences(parsed) ? { ...parsed } : { ...DEFAULT_CIPHER_PREFERENCES };
  } catch {
    return { ...DEFAULT_CIPHER_PREFERENCES };
  }
}

export function readinessGreeting(readiness: { ready: boolean }): string {
  return readiness.ready
    ? 'Covert readiness reports ready. Your workspace and approvals remain under your control.'
    : 'Covert readiness reports that setup is incomplete or some capabilities need attention.';
}

export function createUnavailableSpeechInput(): SpeechInput {
  return {
    state: 'unavailable',
    async start(): Promise<never> { throw new Error('Speech input is unavailable in this build. The microphone remains off.'); },
    stop(): void {}
  };
}

export function createUnavailableWakeWordEngine(): WakeWordEngine {
  return {
    state: 'unavailable',
    async start(): Promise<never> { throw new Error('Local wake-word detection is not integrated in this build.'); },
    stop(): void {},
    pauseForSpeech(): void {},
    resumeAfterSpeech(): void {}
  };
}

export function createCipherVoiceService(onState: (state: CipherSpeechState) => void = (): void => {}): CipherVoiceService {
  let storage: Storage | null = null;
  try { storage = window.localStorage; } catch { /* In-memory preferences remain available. */ }
  let current = readPreferences(storage);
  let state: CipherSpeechState = typeof window !== 'undefined' && 'speechSynthesis' in window ? 'idle' : 'unavailable';
  const input = createUnavailableSpeechInput();
  const wake = createUnavailableWakeWordEngine();
  const setState = (next: CipherSpeechState): void => {
    state = next;
    onState(next);
    document.dispatchEvent(new CustomEvent('covert:cipher-speech-state', { detail: next }));
  };

  function speak(text: string): 'started' | 'disabled' | 'unavailable' {
    if (!current.voiceResponses) return 'disabled';
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setState('unavailable');
      return 'unavailable';
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = navigator.language;
      utterance.onstart = () => { wake.pauseForSpeech(); setState('speaking'); };
      utterance.onend = () => { setState('idle'); wake.resumeAfterSpeech(); };
      utterance.onerror = () => { setState('error'); wake.resumeAfterSpeech(); };
      window.speechSynthesis.speak(utterance);
      return 'started';
    } catch {
      setState('error');
      return 'unavailable';
    }
  }

  const output: SpeechOutput = {
    speak,
    stop(): void {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      wake.resumeAfterSpeech();
      setState('idle');
    },
    dispose(): void { this.stop(); }
  };

  return {
    preferences: () => ({ ...current }),
    update(patch): boolean {
      const candidate = { ...current, ...patch };
      if (!validPreferences(candidate)) return false;
      current = candidate;
      if (!current.voiceResponses) output.stop();
      let persisted = false;
      try {
        if (storage !== null) {
          storage.setItem(CIPHER_PREFERENCES_STORAGE_KEY, JSON.stringify(current));
          persisted = true;
        }
      } catch { /* Changes stay in effect for this session. */ }
      return persisted;
    },
    speechState: () => state,
    wakeState: () => current.wakeWordEnabled ? wake.state : 'off',
    async speakReadiness(): Promise<'started' | 'disabled' | 'unavailable' | 'unknown'> {
      if (!current.voiceResponses) return 'disabled';
      try {
        const readiness = await api.readiness();
        return speak(readinessGreeting(readiness));
      } catch { return 'unknown'; }
    },
    async speakStartupGreeting(): Promise<'started' | 'disabled' | 'unavailable' | 'unknown'> {
      if (!current.startupGreeting || !current.voiceResponses) return 'disabled';
      return this.speakReadiness();
    },
    previewVoice(): 'started' | 'disabled' | 'unavailable' {
      return speak(`Hello ${current.operatorName.trim()}. This is Cipher speaking through the system speech voice.`);
    },
    stopSpeaking(): void { output.stop(); },
    dispose(): void { output.dispose(); input.stop(); wake.stop(); }
  };
}
