import type { Store } from '../store/store.ts';
import type {
  AppState,
  VerificationState,
  NetworkState,
  HarnessState
} from '../store/state.ts';
import { COVERT_VISUAL_ASSET_SLOTS } from '../cockpit/VisualAssetSlots.ts';

export interface TopbarMode {
  private: boolean | null;
  local: boolean | null;
  verifiable: boolean | null;
}

export interface TopbarHandles {
  root: HTMLElement;
  setEngine(opts: { label: string; ready: boolean }): void;
  setDaemon(opts: { label: string; reachable: boolean }): void;
  setVerification(state: VerificationState): void;
  setHarness(state: HarnessState): void;
  setCloud(state: NetworkState): void;
  setModes(modes: TopbarMode): void;
}

export function createTopbar(parent: HTMLElement, _store: Store<AppState>): TopbarHandles {
  parent.innerHTML = `
    <header class="topbar" role="banner">
      <div class="topbar-identity">
        <span class="topbar-mark" data-asset-slot="${COVERT_VISUAL_ASSET_SLOTS.branding.emblem.relativePath}" data-artwork-state="required" title="Approved Covert emblem asset required" aria-hidden="true">\u25c7</span>
        <span class="topbar-brand">COVERT</span>
        <span class="topbar-subbrand">CODER</span>
      </div>
      <nav class="topbar-modes" aria-label="system mode">
        <span class="topbar-mode" data-mode="private" title="Private: BYOK consent disabled">PRIVATE</span>
        <span class="topbar-mode" data-mode="local" title="Local: daemon reachable on 127.0.0.1">LOCAL</span>
        <span class="topbar-mode" data-mode="verifiable" title="Verifiable: audit bus reachable">VERIFIABLE</span>
      </nav>
      <nav class="topbar-chips" aria-label="system status">
        <button class="topbar-chip" data-chip="daemon" type="button" title="Daemon reachability on the local facade" aria-label="Daemon reachability">
          <span class="topbar-chip-dot" data-chip-dot="daemon"></span>
          <span data-chip-label="daemon">DAEMON: UNKNOWN</span>
        </button>
        <button class="topbar-chip" data-chip="engine" type="button" title="Model readiness (configured + runtime + artifact)" aria-label="Model readiness">
          <span class="topbar-chip-dot" data-chip-dot="engine"></span>
          <span data-chip-label="engine">NO MODEL READY</span>
        </button>
        <button class="topbar-chip" data-chip="verify" type="button" title="Verification state (positive canonical verdict only)" aria-label="Verification state">
          <span data-chip-label="verify">VERIFY: UNVERIFIED</span>
        </button>
        <button class="topbar-chip" data-chip="harness" type="button" title="Closed-loop harness state" aria-label="Harness state">
          <span data-chip-label="harness">HARNESS: STANDBY</span>
        </button>
        <button class="topbar-chip" data-chip="cloud" type="button" title="Network / BYOK configuration state" aria-label="Network state">
          <span class="topbar-chip-dot" data-chip-dot="cloud"></span>
          <span data-chip-label="cloud">LOCAL ONLY</span>
        </button>
      </nav>
      <span class="topbar-spacer"></span>
      <button class="topbar-hint" type="button" disabled title="Command palette unavailable in this cockpit phase" aria-label="Command palette unavailable">
        <kbd>Ctrl</kbd><kbd>K</kbd>
      </button>
      <button class="topbar-hint" type="button" disabled title="Terminal command palette unavailable; terminal view is read-only" aria-label="Terminal command palette unavailable">
        <kbd>Ctrl</kbd><kbd>&#96;</kbd>
      </button>
    </header>
  `;

  const root = parent.querySelector<HTMLElement>('.topbar');
  if (root === null) throw new Error('topbar mount failed');

  const daemon = chip(parent, 'daemon');
  const engine = chip(parent, 'engine');
  const verify = chip(parent, 'verify');
  const harness = chip(parent, 'harness');
  const cloud = chip(parent, 'cloud');

  function setDataState(el: HTMLElement, state: string | null): void {
    if (state === null) el.removeAttribute('data-state');
    else el.setAttribute('data-state', state);
  }

  function setEngine(opts: { label: string; ready: boolean }): void {
    engine.label.textContent = opts.label;
    setDataState(engine.root, opts.ready ? 'ok' : null);
  }

  function setDaemon(opts: { label: string; reachable: boolean }): void {
    daemon.label.textContent = `DAEMON: ${opts.label}`;
    setDataState(daemon.root, opts.reachable ? 'ok' : null);
  }

  function setVerification(v: VerificationState): void {
    verify.label.textContent = `VERIFY: ${v}`;
    setDataState(verify.root, v === 'VERIFIED' ? 'ok' : v === 'DEGRADED' ? 'warn' : v === 'FAILED' ? 'err' : null);
  }

  function setHarness(state: HarnessState): void {
    harness.label.textContent = `HARNESS: ${state}`;
    setDataState(harness.root, state === 'ON' ? 'idle' : state === 'ENABLED' ? 'idle-soft' : null);
  }

  function setCloud(state: NetworkState): void {
    const labelMap: Record<NetworkState, string> = {
      LOCAL_ONLY: 'LOCAL ONLY',
      CREDENTIAL_MISSING: 'CREDENTIAL MISSING',
      REMOTE_CONFIGURED: 'REMOTE CONFIGURED'
    };
    cloud.label.textContent = labelMap[state];
    setDataState(cloud.root, state === 'CREDENTIAL_MISSING' ? 'warn' : null);
  }

  function setModes(modes: TopbarMode): void {
    const apply = (name: string, value: boolean | null): void => {
      const el = parent.querySelector<HTMLElement>(`[data-mode="${name}"]`);
      if (el === null) return;
      if (value === null) {
        el.removeAttribute('data-state');
        el.classList.add('topbar-mode-unknown');
      } else {
        el.classList.remove('topbar-mode-unknown');
        el.setAttribute('data-state', value ? 'on' : 'off');
      }
    };
    apply('private', modes.private);
    apply('local', modes.local);
    apply('verifiable', modes.verifiable);
  }

  return { root, setEngine, setDaemon, setVerification, setHarness, setCloud, setModes };
}

function chip(parent: HTMLElement, name: string): { root: HTMLElement; label: HTMLElement; dot: HTMLElement | null } {
  const r = parent.querySelector<HTMLElement>(`[data-chip="${name}"]`);
  if (r === null) throw new Error(`topbar chip missing: ${name}`);
  const l = r.querySelector<HTMLElement>(`[data-chip-label="${name}"]`);
  if (l === null) throw new Error(`topbar chip label missing: ${name}`);
  const d = r.querySelector<HTMLElement>(`[data-chip-dot="${name}"]`);
  return { root: r, label: l, dot: d };
}
