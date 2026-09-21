// Stateful visual presence for the existing Resident surface.
// The figure remains presentation-only: it observes real Resident, Model Hub
// and runtime projections and never becomes an authority or a second agent.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { ResidentPushSummaryT } from '../../../common/contracts/resident.ts';
import type { ModelStatusResponseT } from '../../../common/contracts/models.ts';
import type { RoutesResponseT } from '../../../common/contracts/routing.ts';
import type { HubDownloadsListResponseT } from '../../../common/contracts/modelhub.ts';

export type ResidentPresentationState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'OBSERVING'
  | 'SUGGESTION'
  | 'WARNING'
  | 'VERIFIED'
  | 'DEGRADED';

export type ResidentAmbientAction =
  | 'NONE'
  | 'LOOK_AT_WORKSPACE'
  | 'LOOK_AT_OPERATOR'
  | 'POSTURE_SHIFT'
  | 'CHECK_DISPLAY'
  | 'DRINK_WATER'
  | 'DRINK_COFFEE'
  | 'RETURN_TO_IDLE';

export interface ResidentAmbientActionContract {
  action: ResidentAmbientAction;
  availability: 'AVAILABLE' | 'ASSET_REQUIRED' | 'BLOCKED_BY_STATE';
  reason: string;
  cooldownMs: number;
}

export interface ResidentFigureHandles {
  root: HTMLElement;
  dispose(): void;
}

const RESIDENT_CROP = new URL('../../../docs/assets/screenshots/covert-resident-reference-crop.jpg', import.meta.url).href;

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// This is the explicit future-action boundary. Current safe actions use the
// existing crop; physical actions remain honest until frame/asset support exists.
export function residentAmbientActionContract(action: ResidentAmbientAction, state: ResidentPresentationState): ResidentAmbientActionContract {
  if (['WARNING', 'SUGGESTION', 'LISTENING', 'THINKING', 'VERIFIED'].includes(state)) {
    return { action, availability: 'BLOCKED_BY_STATE', reason: 'critical or interactive Resident state', cooldownMs: 60_000 };
  }
  if (action === 'DRINK_WATER' || action === 'DRINK_COFFEE') {
    return { action, availability: 'ASSET_REQUIRED', reason: 'a convincing physical action needs dedicated Resident frames', cooldownMs: 15 * 60_000 };
  }
  if (action === 'POSTURE_SHIFT' || action === 'LOOK_AT_WORKSPACE' || action === 'LOOK_AT_OPERATOR' || action === 'CHECK_DISPLAY' || action === 'RETURN_TO_IDLE' || action === 'NONE') {
    return { action, availability: 'AVAILABLE', reason: 'subtle current-image-safe presentation treatment', cooldownMs: 60_000 };
  }
  return { action, availability: 'BLOCKED_BY_STATE', reason: 'unknown ambient action', cooldownMs: 60_000 };
}

function pushState(push: ResidentPushSummaryT | null): ResidentPresentationState {
  if (push === null) return 'DEGRADED';
  return push.verdict === 'ATTENTION_REQUIRED' ? 'WARNING' : 'IDLE';
}

function modelPresenceState(
  status: ModelStatusResponseT | null,
  routes: RoutesResponseT | null,
  downloads: HubDownloadsListResponseT | null
): { state: ResidentPresentationState; source: string; readyId?: string } {
  if (downloads?.jobs.some(job => job.status === 'running') === true) return { state: 'OBSERVING', source: 'MODEL HUB · DOWNLOAD' };
  if (status === null || routes === null) return { state: 'DEGRADED', source: 'MODEL STATE · UNAVAILABLE' };
  if (status.models.length === 0) return { state: 'DEGRADED', source: 'MODEL SETUP · FIND MODEL' };
  if (status.models.some(model => model.status === 'error')) return { state: 'WARNING', source: 'MODEL RUNTIME · ERROR' };
  if (status.models.some(model => model.status === 'starting')) return { state: 'THINKING', source: 'MODEL RUNTIME · STARTING' };
  const readyRoute = routes.routes.find(route => route.providerType === 'local' && route.status === 'ready');
  if (readyRoute !== undefined) return { state: 'OBSERVING', source: 'LOCAL MODEL · READY', readyId: readyRoute.id };
  if (status.models.some(model => model.artifact_available === true && model.runtime_available === true)) return { state: 'OBSERVING', source: 'LOCAL MODEL · STARTABLE' };
  return { state: 'DEGRADED', source: 'MODEL SETUP · ARTIFACT REQUIRED' };
}

export function createResidentFigure(parent: HTMLElement, store: Store<AppState>): ResidentFigureHandles {
  parent.innerHTML = '';
  const root = el('section', 'resident-figure');
  root.dataset.presentationState = 'IDLE';
  root.setAttribute('aria-label', 'Resident visual presence');

  const imageWrap = el('div', 'resident-figure-art');
  const image = document.createElement('img');
  image.className = 'resident-figure-image';
  image.src = RESIDENT_CROP;
  image.alt = 'Masked Resident figure';
  image.width = 138;
  image.height = 548;
  imageWrap.appendChild(image);
  imageWrap.appendChild(el('span', 'resident-figure-scan', ''));
  root.appendChild(imageWrap);

  const identity = el('div', 'resident-figure-identity');
  identity.appendChild(el('span', 'resident-figure-kicker', 'CIPHER / RESIDENT'));
  identity.appendChild(el('strong', 'resident-figure-title', 'SILENT TOOLS\nREAL IMPACT'));
  identity.appendChild(el('span', 'resident-figure-boundary', 'ADVISORY VISUAL · NO AUTHORITY'));
  root.appendChild(identity);

  const stateLine = el('div', 'resident-figure-state');
  stateLine.appendChild(el('span', 'resident-figure-state-label', 'IDLE'));
  stateLine.appendChild(el('span', 'resident-figure-state-source', 'STATE · CHECKING'));
  root.appendChild(stateLine);

  const suggestion = el('aside', 'resident-figure-suggestion');
  suggestion.hidden = true;
  suggestion.setAttribute('aria-live', 'polite');
  root.appendChild(suggestion);

  parent.appendChild(root);

  let alive = true;
  let timer: number | null = null;
  let transientTimer: number | null = null;
  let ambientTimer: number | null = null;
  let verifiedTimer: number | null = null;
  let lastAmbientAt = 0;
  let idleSince = Date.now();
  let push: ResidentPushSummaryT | null = null;
  let modelState: ResidentPresentationState = 'DEGRADED';
  let modelSource = 'MODEL STATE · CHECKING';
  let previousReadyId = '';

  function setAmbientAction(action: ResidentAmbientAction): void {
    const contract = residentAmbientActionContract(action, root.dataset.presentationState as ResidentPresentationState);
    if (contract.availability !== 'AVAILABLE' || action === 'NONE') return;
    root.dataset.ambientAction = action;
    lastAmbientAt = Date.now();
    if (ambientTimer !== null) window.clearTimeout(ambientTimer);
    ambientTimer = window.setTimeout(() => {
      delete root.dataset.ambientAction;
      ambientTimer = null;
    }, action === 'POSTURE_SHIFT' ? 5000 : 9000);
  }

  function setState(state: ResidentPresentationState, source: string): void {
    root.dataset.presentationState = state;
    const label = root.querySelector<HTMLElement>('.resident-figure-state-label');
    const sourceLabel = root.querySelector<HTMLElement>('.resident-figure-state-source');
    if (label !== null) label.textContent = state;
    if (sourceLabel !== null) sourceLabel.textContent = source;
    if (state === 'IDLE') {
      if (idleSince === 0) idleSince = Date.now();
    } else {
      idleSince = 0;
    }
  }

  function resolvedState(): { state: ResidentPresentationState; source: string } {
    if (push?.verdict === 'ATTENTION_REQUIRED') return { state: 'WARNING', source: 'RESIDENT PUSH · ATTENTION' };
    if (modelState === 'WARNING' || modelState === 'THINKING' || modelState === 'DEGRADED') return { state: modelState, source: modelSource };
    if (modelState === 'OBSERVING') return { state: 'OBSERVING', source: modelSource };
    return { state: pushState(push), source: push === null ? 'RESIDENT PUSH · UNAVAILABLE' : 'RESIDENT PUSH · READY' };
  }

  function applyResolvedState(): void {
    if (!alive) return;
    const resolved = resolvedState();
    if (root.dataset.presentationState === 'LISTENING' || root.dataset.presentationState === 'VERIFIED') return;
    setState(resolved.state, resolved.source);
  }

  function showSuggestion(nextPush: ResidentPushSummaryT | null): void {
    suggestion.innerHTML = '';
    if (nextPush === null || nextPush.verdict !== 'ATTENTION_REQUIRED' || nextPush.reasons[0] === undefined) {
      suggestion.hidden = true;
      return;
    }
    const reason = nextPush.reasons[0];
    suggestion.appendChild(el('span', 'resident-figure-suggestion-kicker', 'LEGITIMATE SYSTEM CONDITION'));
    suggestion.appendChild(el('strong', 'resident-figure-suggestion-title', 'Resident attention requested'));
    suggestion.appendChild(el('span', 'resident-figure-suggestion-detail', reason));
    suggestion.hidden = false;
  }

  function applyPush(nextPush: ResidentPushSummaryT | null): void {
    push = nextPush;
    showSuggestion(nextPush);
    applyResolvedState();
  }

  function applyModelSignal(signal: ReturnType<typeof modelPresenceState>): void {
    modelState = signal.state;
    modelSource = signal.source;
    if (signal.readyId !== undefined && signal.readyId !== previousReadyId) {
      previousReadyId = signal.readyId;
      if (verifiedTimer !== null) window.clearTimeout(verifiedTimer);
      setState('VERIFIED', 'LOCAL MODEL · READY PROVEN');
      verifiedTimer = window.setTimeout(() => {
        verifiedTimer = null;
        applyResolvedState();
      }, 1600);
      return;
    }
    applyResolvedState();
  }

  async function refresh(): Promise<void> {
    if (!alive) return;
    setState('THINKING', 'RESIDENT · READING STATE');
    const [pushResult, modelResult, routeResult, downloadResult] = await Promise.allSettled([
      api.residentPush(),
      api.modelsStatus(),
      api.routes(),
      api.modelHubDownloads()
    ]);
    if (!alive) return;
    applyPush(pushResult.status === 'fulfilled' ? pushResult.value.push : null);
    applyModelSignal(modelPresenceState(
      modelResult.status === 'fulfilled' ? modelResult.value : null,
      routeResult.status === 'fulfilled' ? routeResult.value : null,
      downloadResult.status === 'fulfilled' ? downloadResult.value : null
    ));
  }

  function paintPanel(state: AppState): void {
    if (root.dataset.presentationState === 'THINKING' || root.dataset.presentationState === 'LISTENING' || root.dataset.presentationState === 'VERIFIED') return;
    const observing = state.panel !== ('command-center' as Panel) && state.panel !== 'resident';
    if (observing && modelState !== 'DEGRADED' && push?.verdict !== 'ATTENTION_REQUIRED') {
      setState('OBSERVING', 'ACTIVE SURFACE · OBSERVING');
      setAmbientAction('LOOK_AT_WORKSPACE');
    } else {
      applyResolvedState();
    }
  }

  function onFocus(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches('textarea, input, [contenteditable="true"]')) return;
    if (!target.closest('.cockpit-resident, .cockpit-resident-chat')) return;
    if (transientTimer !== null) window.clearTimeout(transientTimer);
    setState('LISTENING', 'OPERATOR INPUT · ADVISORY');
    transientTimer = window.setTimeout(() => {
      transientTimer = null;
      if (alive) paintPanel(store.get());
    }, 1800);
  }

  function ambientTick(): void {
    if (!alive || root.dataset.presentationState !== 'IDLE' || idleSince === 0) return;
    if (Date.now() - idleSince < 45_000 || Date.now() - lastAmbientAt < 60_000) return;
    setAmbientAction('POSTURE_SHIFT');
  }

  const unbind = store.subscribe(paintPanel);
  document.addEventListener('focusin', onFocus);
  void refresh();
  timer = window.setInterval(() => { void refresh(); }, 8000);
  const ambientInterval = window.setInterval(ambientTick, 15_000);

  return {
    root,
    dispose(): void {
      alive = false;
      if (timer !== null) window.clearInterval(timer);
      if (transientTimer !== null) window.clearTimeout(transientTimer);
      if (ambientTimer !== null) window.clearTimeout(ambientTimer);
      if (verifiedTimer !== null) window.clearTimeout(verifiedTimer);
      window.clearInterval(ambientInterval);
      unbind();
      document.removeEventListener('focusin', onFocus);
      parent.innerHTML = '';
    }
  };
}
