// Resident Operator Identity — governed presentation layer.
//
// Appearance configuration and local presentation state only. This component
// owns no Resident intelligence, model selection, workflow state, execution,
// authority, permissions, or verification. Artwork remains unavailable until
// approved local files and provenance exist.

import { COVERT_VISUAL_ASSET_SLOTS, type OperatorVisualVariant } from './VisualAssetSlots.ts';

export const OPERATOR_VARIANTS = ['engineering', 'security', 'research', 'creative'] as const;
export type OperatorVariantId = typeof OPERATOR_VARIANTS[number];

export type OperatorPresenceState = 'unknown' | 'idle' | 'attention' | 'unavailable';
export type OperatorFocusTarget = 'neutral' | 'resident' | 'editor' | 'terminal' | 'verification' | 'artwork';
export type OperatorTransitionState = 'stable' | 'switching';
export type OperatorArtworkState = 'available' | 'required';

export interface OperatorAssetRef {
  src: string;
  alt: string;
}

export interface OperatorAsset {
  id: string;
  name: string;
  role: string;
  operator: OperatorAssetRef | null;
  portrait: OperatorAssetRef | null;
  environment: OperatorAssetRef | null;
  animations: {
    arrival: readonly OperatorAssetRef[];
    idle: readonly OperatorAssetRef[];
    visor: readonly OperatorAssetRef[];
  };
  colorTheme: {
    identity: string;
    edge: string;
    accent: string;
  };
  accessibilityOptions: {
    decorativeArtwork: boolean;
    reducedMotion: 'static';
  };
}

export interface OperatorProfile {
  id: OperatorVariantId;
  name: string;
  role: string;
  context: string;
  interactionStyle: {
    tone: string;
    briefing: string;
  };
  asset: OperatorAsset;
}

export interface OperatorPresentationState {
  variantId: OperatorVariantId;
  presence: OperatorPresenceState;
  focusTarget: OperatorFocusTarget;
  transition: OperatorTransitionState;
  artworkVisibility: 'visible' | 'hidden';
  reducedMotion: boolean;
}

export type OperatorPresentationEvent =
  | { type: 'appearance-transition-start'; fromVariant: OperatorVariantId; toVariant: OperatorVariantId; reducedMotion: boolean }
  | { type: 'appearance-transition-complete'; variantId: OperatorVariantId; artworkState: OperatorArtworkState }
  | { type: 'presentation-state-changed'; state: OperatorPresenceState }
  | { type: 'focus-target-changed'; target: OperatorFocusTarget }
  | { type: 'reduced-motion-changed'; reducedMotion: boolean };

export interface OperatorIdentityHandles {
  root: HTMLElement;
  getState(): OperatorPresentationState;
  setPresentationState(state: OperatorPresenceState): void;
  setFocusTarget(target: OperatorFocusTarget): void;
  dispose(): void;
}

export interface OperatorIdentityOptions {
  titleMount?: HTMLElement;
  initialVariant?: OperatorVariantId;
  onPresentationEvent?: (event: OperatorPresentationEvent) => void;
}

function emptyAsset(id: string, name: string, role: string, identity: string, edge: string, accent: string): OperatorAsset {
  return {
    id,
    name,
    role,
    operator: null,
    portrait: null,
    environment: null,
    animations: { arrival: [], idle: [], visor: [] },
    colorTheme: { identity, edge, accent },
    accessibilityOptions: { decorativeArtwork: true, reducedMotion: 'static' }
  };
}

export const OPERATOR_PROFILES: Readonly<Record<OperatorVariantId, OperatorProfile>> = {
  engineering: {
    id: 'engineering',
    name: 'ENGINEERING',
    role: 'Engineering presentation',
    context: 'Coding, debugging, architecture, review',
    interactionStyle: { tone: 'precise', briefing: 'structured advisory briefings' },
    asset: emptyAsset('resident-engineering-v01', 'ENGINEERING', 'Engineering presentation', 'purple', 'cyan', 'purple')
  },
  security: {
    id: 'security',
    name: 'SECURITY',
    role: 'Security presentation',
    context: 'Security review, audits, vulnerability analysis',
    interactionStyle: { tone: 'measured', briefing: 'bounded evidence briefings' },
    asset: emptyAsset('resident-security-v01', 'SECURITY', 'Security presentation', 'purple', 'cyan', 'purple')
  },
  research: {
    id: 'research',
    name: 'RESEARCH',
    role: 'Research presentation',
    context: 'Research, discovery, documentation',
    interactionStyle: { tone: 'analytical', briefing: 'evidence-oriented briefings' },
    asset: emptyAsset('resident-research-v01', 'RESEARCH', 'Research presentation', 'purple', 'cyan', 'blue')
  },
  creative: {
    id: 'creative',
    name: 'CREATIVE',
    role: 'Creative presentation',
    context: 'UI, game, and experience design',
    interactionStyle: { tone: 'expressive', briefing: 'visual design briefings' },
    asset: emptyAsset('resident-creative-v01', 'CREATIVE', 'Creative presentation', 'purple', 'cyan', 'magenta')
  }
};

export function getOperatorProfile(id: OperatorVariantId): OperatorProfile {
  return OPERATOR_PROFILES[id];
}

// Registered for extension; approved artwork is still required before these
// profiles can claim a complete visual identity.
export const FUTURE_OPERATOR_VARIANTS: readonly OperatorVariantId[] = ['security', 'research', 'creative'];

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function localAsset(ref: OperatorAssetRef | null): OperatorAssetRef | null {
  if (ref === null || ref.src.trim().length === 0) return null;
  try {
    const resolved = new URL(ref.src, document.baseURI);
    if (resolved.origin !== window.location.origin) return null;
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return { ...ref, src: resolved.toString() };
  } catch {
    return null;
  }
}

interface PortraitView {
  root: HTMLElement;
  setProfile(profile: OperatorProfile): void;
  dispose(): void;
}

function renderPortrait(titleMount: HTMLElement, initialProfile: OperatorProfile): PortraitView {
  const portrait = el('span', 'cockpit-resident-portrait');
  portrait.setAttribute('role', 'img');
  let hasApprovedPortrait = false;

  function setProfile(profile: OperatorProfile): void {
    const slots = COVERT_VISUAL_ASSET_SLOTS.operators[profile.id as OperatorVisualVariant];
    portrait.dataset.assetSlot = slots.portrait.relativePath;
    portrait.dataset.assetState = slots.portrait.status;
    portrait.dataset.variant = profile.id;
    portrait.setAttribute('aria-label', `${profile.name} Resident appearance; presentation only`);
    const asset = localAsset(profile.asset.portrait);
    if (asset === null && hasApprovedPortrait) {
      portrait.dataset.artworkState = 'required';
      return;
    }
    portrait.replaceChildren();
    if (asset === null) {
      portrait.dataset.artworkState = 'required';
      portrait.classList.add('cockpit-resident-portrait-unavailable');
      portrait.appendChild(el('span', 'cockpit-resident-portrait-mark', '\u25c8'));
      portrait.appendChild(el('span', 'cockpit-resident-portrait-label', profile.name));
      return;
    }
    hasApprovedPortrait = true;
    portrait.dataset.artworkState = 'available';
    portrait.classList.remove('cockpit-resident-portrait-unavailable');
    const image = document.createElement('img');
    image.src = asset.src;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.loading = 'eager';
    image.decoding = 'async';
    image.addEventListener('error', () => {
      image.remove();
      portrait.dataset.artworkState = 'required';
      portrait.classList.add('cockpit-resident-portrait-unavailable');
      portrait.appendChild(el('span', 'cockpit-resident-portrait-mark', '\u25c8'));
      portrait.appendChild(el('span', 'cockpit-resident-portrait-label', profile.name));
    }, { once: true });
    portrait.appendChild(image);
  }

  setProfile(initialProfile);
  titleMount.appendChild(portrait);
  return {
    root: portrait,
    setProfile,
    dispose(): void {
      portrait.remove();
    }
  };
}

interface ArtworkView {
  root: HTMLElement;
  setProfile(profile: OperatorProfile): OperatorArtworkState;
}

function missingArtwork(profile: OperatorProfile): HTMLElement {
  const unavailable = el('div', 'cockpit-operator-artwork-missing');
  unavailable.appendChild(el('span', 'cockpit-operator-artwork-kicker', 'STATIC IDENTITY'));
  unavailable.appendChild(el('strong', 'cockpit-operator-artwork-title', profile.name));
  unavailable.appendChild(el('span', 'cockpit-operator-artwork-detail', 'APPROVED ARTWORK REQUIRED'));
  unavailable.appendChild(el('span', 'cockpit-operator-artwork-boundary', 'PRESENTATION ONLY · NO AUTHORITY'));
  return unavailable;
}

function renderArtwork(parent: HTMLElement, initialProfile: OperatorProfile, onAssetFailure: () => void): ArtworkView {
  const region = el('div', 'cockpit-operator-artwork');
  region.setAttribute('role', 'img');
  let hasApprovedArtwork = false;

  function setProfile(profile: OperatorProfile): OperatorArtworkState {
    const slots = COVERT_VISUAL_ASSET_SLOTS.operators[profile.id as OperatorVisualVariant];
    region.dataset.assetSlot = slots.operator.relativePath;
    region.dataset.environmentSlot = slots.environment.relativePath;
    region.setAttribute('aria-label', `${profile.name} operator artwork; presentation only`);
    const environment = el('div', 'cockpit-operator-environment');
    environment.setAttribute('aria-hidden', 'true');
    const environmentAsset = localAsset(profile.asset.environment);
    if (environmentAsset !== null) environment.style.backgroundImage = `url(${JSON.stringify(environmentAsset.src)})`;

    const asset = localAsset(profile.asset.operator);
    const portrait = localAsset(profile.asset.portrait);
    const available = asset !== null && portrait !== null && environmentAsset !== null;
    if (!available && hasApprovedArtwork) {
      region.dataset.variant = profile.id;
      region.dataset.artworkState = 'required';
      region.setAttribute('aria-label', `${profile.name} operator artwork; approved artwork required; previous approved artwork retained`);
      return 'required';
    }
    region.replaceChildren(environment);
    if (asset === null) {
      region.appendChild(missingArtwork(profile));
    } else {
      const image = document.createElement('img');
      image.className = 'cockpit-operator-artwork-image';
      image.src = asset.src;
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.loading = 'eager';
      image.decoding = 'async';
      image.addEventListener('error', () => {
        image.replaceWith(missingArtwork(profile));
        region.dataset.artworkState = 'required';
        onAssetFailure();
      }, { once: true });
      region.appendChild(image);
      if (!available) region.appendChild(missingArtwork(profile));
    }
    region.dataset.variant = profile.id;
    region.dataset.artworkState = available ? 'available' : 'required';
    if (available) hasApprovedArtwork = true;
    return available ? 'available' : 'required';
  }

  setProfile(initialProfile);
  parent.appendChild(region);
  return { root: region, setProfile };
}

function initialReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function createOperatorIdentity(parent: HTMLElement, options: OperatorIdentityOptions = {}): OperatorIdentityHandles {
  parent.innerHTML = '';
  let profile = getOperatorProfile(options.initialVariant ?? 'engineering');
  const state: OperatorPresentationState = {
    variantId: profile.id,
    presence: 'unknown',
    focusTarget: 'neutral',
    transition: 'stable',
    artworkVisibility: 'visible',
    reducedMotion: initialReducedMotion()
  };
  let transitionFrame: number | null = null;
  let disposed = false;
  const root = el('section', 'cockpit-operator-identity');
  root.dataset.authority = 'none';
  root.dataset.presentationOnly = 'true';
  root.dataset.transitionState = state.transition;
  root.dataset.reducedMotion = String(state.reducedMotion);

  const header = el('div', 'cockpit-operator-header');
  header.appendChild(el('div', 'cockpit-operator-kicker', 'RESIDENT APPEARANCE'));
  const appearance = document.createElement('select');
  appearance.className = 'cockpit-operator-select';
  appearance.setAttribute('aria-label', 'Resident appearance');
  appearance.title = 'Presentation configuration only; does not change models, workflows, authority, or permissions';
  for (const id of OPERATOR_VARIANTS) {
    const variant = getOperatorProfile(id);
    const option = document.createElement('option');
    option.value = variant.id;
    option.textContent = variant.name;
    option.dataset.artworkState = variant.asset.operator === null ? 'required' : 'available';
    appearance.appendChild(option);
  }
  appearance.value = profile.id;
  header.appendChild(appearance);
  root.appendChild(header);

  let artworkState: OperatorArtworkState = 'required';
  const artwork = renderArtwork(root, profile, () => {
    artworkState = 'required';
    paint();
  });
  const controls = el('div', 'cockpit-operator-controls');
  const hideLabel = document.createElement('label');
  hideLabel.className = 'cockpit-operator-hide-label';
  const hide = document.createElement('input');
  hide.type = 'checkbox';
  hide.className = 'cockpit-operator-hide';
  hide.setAttribute('aria-label', 'Hide Resident artwork');
  hideLabel.appendChild(hide);
  hideLabel.appendChild(document.createTextNode(' HIDE ARTWORK'));
  controls.appendChild(hideLabel);
  const status = el('span', 'cockpit-operator-status');
  controls.appendChild(status);
  root.appendChild(controls);

  const portrait = options.titleMount === undefined ? null : renderPortrait(options.titleMount, profile);
  artworkState = artwork.root.dataset.artworkState === 'available' ? 'available' : 'required';

  function paint(): void {
    root.dataset.variant = state.variantId;
    root.dataset.presentationState = state.presence;
    root.dataset.focusTarget = state.focusTarget;
    root.dataset.transitionState = state.transition;
    root.dataset.reducedMotion = String(state.reducedMotion);
    root.dataset.artworkState = artworkState;
    root.dataset.identityTheme = profile.asset.colorTheme.identity;
    root.dataset.edgeTheme = profile.asset.colorTheme.edge;
    root.dataset.accentTheme = profile.asset.colorTheme.accent;
    status.textContent = `${profile.name} · ${artworkState === 'available' ? 'STATIC' : 'ARTWORK REQUIRED'} · ${state.presence.toUpperCase()}`;
  }

  const emit = (event: OperatorPresentationEvent): void => {
    options.onPresentationEvent?.(event);
  };

  function setProfile(next: OperatorProfile): void {
    if (next.id === profile.id) return;
    if (transitionFrame !== null) {
      window.cancelAnimationFrame(transitionFrame);
      transitionFrame = null;
    }
    const previous = profile.id;
    state.variantId = next.id;
    state.transition = 'switching';
    profile = next;
    artworkState = artwork.setProfile(next);
    portrait?.setProfile(next);
    paint();
    emit({ type: 'appearance-transition-start', fromVariant: previous, toVariant: next.id, reducedMotion: state.reducedMotion });
    const complete = (): void => {
      transitionFrame = null;
      if (disposed) return;
      state.transition = 'stable';
      paint();
      emit({ type: 'appearance-transition-complete', variantId: profile.id, artworkState });
    };
    if (state.reducedMotion) complete();
    else transitionFrame = window.requestAnimationFrame(complete);
  }

  const onAppearance = (): void => {
    const nextVariant = OPERATOR_VARIANTS.find((id) => id === appearance.value);
    if (nextVariant !== undefined) setProfile(getOperatorProfile(nextVariant));
  };
  appearance.addEventListener('change', onAppearance);

  const onHide = (): void => {
    state.artworkVisibility = hide.checked ? 'hidden' : 'visible';
    artwork.root.hidden = hide.checked;
    paint();
  };
  hide.addEventListener('change', onHide);

  const motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const onMotionPreference = (): void => {
    state.reducedMotion = motionQuery?.matches ?? false;
    root.dataset.reducedMotion = String(state.reducedMotion);
    emit({ type: 'reduced-motion-changed', reducedMotion: state.reducedMotion });
  };
  motionQuery?.addEventListener('change', onMotionPreference);
  paint();

  parent.appendChild(root);
  return {
    root,
    getState(): OperatorPresentationState {
      return { ...state };
    },
    setPresentationState(next: OperatorPresenceState): void {
      if (state.presence === next) return;
      state.presence = next;
      paint();
      emit({ type: 'presentation-state-changed', state: next });
    },
    setFocusTarget(target: OperatorFocusTarget): void {
      if (state.focusTarget === target) return;
      state.focusTarget = target;
      paint();
      emit({ type: 'focus-target-changed', target });
    },
    dispose(): void {
      disposed = true;
      if (transitionFrame !== null) window.cancelAnimationFrame(transitionFrame);
      appearance.removeEventListener('change', onAppearance);
      hide.removeEventListener('change', onHide);
      motionQuery?.removeEventListener('change', onMotionPreference);
      portrait?.dispose();
      parent.innerHTML = '';
    }
  };
}
