// Presentation-only Resident visual presence.
// The image is a temporary crop from the approved reference because no
// standalone high-resolution Resident artwork exists in this RC.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { ResidentPushSummaryT } from '../../../common/contracts/resident.ts';

export type ResidentPresentationState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'OBSERVING'
  | 'SUGGESTION'
  | 'WARNING'
  | 'VERIFIED'
  | 'DEGRADED';

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

function verdictState(push: ResidentPushSummaryT | null): ResidentPresentationState {
  if (push === null) return 'DEGRADED';
  return push.verdict === 'ATTENTION_REQUIRED' ? 'WARNING' : 'IDLE';
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
  stateLine.appendChild(el('span', 'resident-figure-state-source', 'RESIDENT PUSH · CHECKING'));
  root.appendChild(stateLine);

  const suggestion = el('aside', 'resident-figure-suggestion');
  suggestion.hidden = true;
  suggestion.setAttribute('aria-live', 'polite');
  root.appendChild(suggestion);

  parent.appendChild(root);

  let alive = true;
  let timer: number | null = null;
  let transientTimer: number | null = null;
  let baseState: ResidentPresentationState = 'IDLE';

  function setState(state: ResidentPresentationState, source: string): void {
    root.dataset.presentationState = state;
    const label = root.querySelector<HTMLElement>('.resident-figure-state-label');
    const sourceLabel = root.querySelector<HTMLElement>('.resident-figure-state-source');
    if (label !== null) label.textContent = state;
    if (sourceLabel !== null) sourceLabel.textContent = source;
  }

  function showSuggestion(push: ResidentPushSummaryT | null): void {
    suggestion.innerHTML = '';
    if (push === null || push.verdict !== 'ATTENTION_REQUIRED' || push.reasons[0] === undefined) {
      suggestion.hidden = true;
      return;
    }
    const reason = push.reasons[0];
    suggestion.appendChild(el('span', 'resident-figure-suggestion-kicker', 'LEGITIMATE SYSTEM CONDITION'));
    suggestion.appendChild(el('strong', 'resident-figure-suggestion-title', 'Resident attention requested'));
    suggestion.appendChild(el('span', 'resident-figure-suggestion-detail', reason));
    suggestion.hidden = false;
  }

  function applyPush(push: ResidentPushSummaryT | null): void {
    baseState = verdictState(push);
    if (push === null) {
      showSuggestion(null);
      setState('DEGRADED', 'RESIDENT PUSH · UNAVAILABLE');
      return;
    }
    showSuggestion(push);
    setState(baseState, push.verdict === 'ATTENTION_REQUIRED' ? 'RESIDENT PUSH · ATTENTION' : 'RESIDENT PUSH · READY');
    if (push.verdict === 'READY') {
      setState('VERIFIED', 'RESIDENT PUSH · OBSERVED');
      window.setTimeout(() => { if (alive && root.dataset.presentationState === 'VERIFIED') setState('IDLE', 'RESIDENT PUSH · READY'); }, 1400);
    }
  }

  async function refresh(): Promise<void> {
    if (!alive) return;
    setState('THINKING', 'RESIDENT PUSH · READING');
    try {
      const response = await api.residentPush();
      if (alive) applyPush(response.push);
    } catch {
      if (alive) applyPush(null);
    }
  }

  function paintPanel(state: AppState): void {
    if (root.dataset.presentationState === 'THINKING' || root.dataset.presentationState === 'LISTENING' || root.dataset.presentationState === 'VERIFIED') return;
    const observing = state.panel !== ('command-center' as Panel) && state.panel !== 'resident';
    if (observing && baseState === 'IDLE') setState('OBSERVING', 'ACTIVE SURFACE · OBSERVING');
    else if (!observing && baseState === 'IDLE') setState('IDLE', 'RESIDENT PUSH · READY');
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

  const unbind = store.subscribe(paintPanel);
  document.addEventListener('focusin', onFocus);
  void refresh();
  timer = window.setInterval(() => { void refresh(); }, 8000);

  return {
    root,
    dispose(): void {
      alive = false;
      if (timer !== null) window.clearInterval(timer);
      if (transientTimer !== null) window.clearTimeout(transientTimer);
      unbind();
      document.removeEventListener('focusin', onFocus);
      parent.innerHTML = '';
    }
  };
}
