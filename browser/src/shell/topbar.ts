import type { Store } from '../store/store.ts';
import type {
  AppState,
  VerificationState,
  NetworkState,
  HarnessState
} from '../store/state.ts';
import { createWorldMap } from '../cockpit/CovertWorldMap.ts';

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

export function createTopbar(parent: HTMLElement, store: Store<AppState>): TopbarHandles {
  const emblem = new URL('../../../docs/assets/branding/covert-coder-emblem.png', import.meta.url).href;
  parent.innerHTML = `
    <header class="topbar" role="banner">
      <div class="topbar-identity">
        <img class="topbar-mark" src="${emblem}" alt="Covert emblem" width="44" height="52" />
        <span class="topbar-wordmark">
          <span class="topbar-brand">COVERT CODER</span>
          <span class="topbar-subbrand">SOVEREIGN DEVELOPMENT ENVIRONMENT</span>
          <span class="topbar-doctrine"><span class="topbar-doctrine-private">PRIVATE MINDS</span><b>&gt;</b><span class="topbar-doctrine-work">REAL WORK</span><b>&gt;</b><span class="topbar-doctrine-free">ZERO COMPROMISE</span></span>
        </span>
      </div>
      <div class="topbar-command-band" aria-label="Covert operating sequence">
        <div class="topbar-command-phases"><span>CODE</span><span>ANALYZE</span><span>BUILD</span><span>VERIFY</span><span>DEPLOY</span></div>
        <span class="topbar-discipline">DISCIPLINE IS A FORCE MULTIPLIER</span>
      </div>
      <div class="topbar-map-wrap" aria-hidden="true"></div>
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
          <span data-chip-label="engine">MODEL STATE UNKNOWN</span>
        </button>
        <button class="topbar-chip" data-chip="verify" type="button" title="Verification state (positive canonical verdict only)" aria-label="Verification state">
          <span data-chip-label="verify">VERIFY: UNVERIFIED</span>
        </button>
        <button class="topbar-chip" data-chip="harness" type="button" title="Closed-loop configuration, not Harness mode or execution state" aria-label="Closed-loop configuration">
          <span data-chip-label="harness">LOOP: UNKNOWN</span>
        </button>
        <button class="topbar-chip" data-chip="cloud" type="button" title="Network / BYOK configuration state" aria-label="Network state">
          <span class="topbar-chip-dot" data-chip-dot="cloud"></span>
          <span data-chip-label="cloud">NETWORK: UNKNOWN</span>
        </button>
      </nav>
      <div class="topbar-doctrine-right">
        <span>INFORMATION<br />WANTS TO BE FREE.</span>
        <strong>INTELLIGENCE<br />DEMANDS CONTROL.</strong>
        <small class="topbar-operational-status" data-operational-status="unknown">OFFLINE READY · LOCAL FIRST · YOU CONTROL IT</small>
      </div>
      <span class="topbar-spacer"></span>
      <button class="topbar-hint cockpit-intel-toggle" type="button" aria-controls="cockpit-intel" aria-expanded="false">INTELLIGENCE</button>
      <span class="topbar-window-boundary" title="Window controls are provided by the host shell" aria-label="Host shell window controls">— □ ×</span>
    </header>
  `;

  const root = parent.querySelector<HTMLElement>('.topbar');
  if (root === null) throw new Error('topbar mount failed');

  const daemon = chip(parent, 'daemon');
  const engine = chip(parent, 'engine');
  const verify = chip(parent, 'verify');
  const harness = chip(parent, 'harness');
  const cloud = chip(parent, 'cloud');
  const mapHost = root.querySelector<HTMLElement>('.topbar-map-wrap');
  const operationalStatus = root.querySelector<HTMLElement>('[data-operational-status]');
  if (mapHost !== null) mapHost.appendChild(createWorldMap('covert-world-map covert-world-map-header'));
  const destinations = { daemon: 'security', engine: 'models', verify: 'verification', harness: 'skills', cloud: 'settings' } as const;
  for (const [name, panel] of Object.entries(destinations)) {
    const button = root.querySelector<HTMLButtonElement>(`[data-chip="${name}"]`);
    button?.addEventListener('click', () => store.set(previous => ({ ...previous, panel })));
  }

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
    harness.label.textContent = `LOOP: ${state}`;
    setDataState(harness.root, state === 'ON' ? 'idle' : state === 'ENABLED' ? 'idle-soft' : null);
  }

  function setCloud(state: NetworkState): void {
    const labelMap: Record<NetworkState, string> = {
      UNKNOWN: 'NETWORK: UNKNOWN',
      LOCAL_ONLY: 'LOCAL ONLY',
      CREDENTIAL_MISSING: 'CREDENTIAL MISSING',
      REMOTE_CONFIGURED: 'REMOTE CONFIGURED'
    };
    cloud.label.textContent = labelMap[state];
    setDataState(cloud.root, state === 'CREDENTIAL_MISSING' ? 'warn' : null);
    if (operationalStatus !== null) {
      operationalStatus.textContent = state === 'REMOTE_CONFIGURED'
        ? 'REMOTE CONFIGURED · LOCAL FIRST · YOU CONTROL IT'
        : state === 'UNKNOWN'
          ? 'STATUS UNKNOWN · LOCAL FIRST · YOU CONTROL IT'
          : 'OFFLINE READY · LOCAL FIRST · YOU CONTROL IT';
      operationalStatus.dataset.operationalStatus = state.toLowerCase();
    }
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
