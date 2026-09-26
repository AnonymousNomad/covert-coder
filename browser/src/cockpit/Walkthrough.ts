// Optional product tour. Setup progress and completion are owned only by
// SetupSession; viewing this tour never marks configuration complete.

import type { Store } from '../store/store.ts';
import type { AppState, Panel } from '../store/state.ts';

export interface WalkthroughHandles {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

interface Step {
  id: Panel;
  title: string;
  detail: string;
}

const STEPS: Step[] = [
  { id: 'command-center', title: 'COMMAND CENTER', detail: 'Your operator overview: daemon, engine, resident, git, cloud, harness, verification and task state in one surface.' },
  { id: 'resident', title: 'RESIDENT', detail: 'Your persistent partner. It describes, plans and proposes; every action still crosses the approval gate.' },
  { id: 'projects', title: 'PROJECTS', detail: 'Open the workspace, inspect files and workbench state.' },
  { id: 'editor', title: 'EDITOR', detail: 'The source surface with search. Saves are explicitly approved operations.' },
  { id: 'terminal', title: 'TERMINAL', detail: 'Process IO: commands run as approved operations with real output.' },
  { id: 'models', title: 'MODELS', detail: 'Local model lineup, routes, and runtime state. Nothing is claimed ready without evidence.' },
  { id: 'skills', title: 'SKILLS', detail: 'The procedural surface. Selected skills are injected into the working loop per task.' },
  { id: 'memory', title: 'MEMORY', detail: 'Helix state: day digests and learned patterns from real work.' },
  { id: 'verification', title: 'VERIFICATION', detail: 'Evidence and gate state. Verification is not execution permission.' },
  { id: 'security', title: 'SECURITY', detail: 'Capability state and provider configuration; credentials live in the OS-backed store.' },
  { id: 'extensions', title: 'EXTENSIONS', detail: 'Local add-ons. The extension host remains phase-gated until its acceptance passes.' },
  { id: 'settings', title: 'SETTINGS', detail: 'Operator configuration. You can reopen this walkthrough here at any time.' }
];

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createWalkthrough(
  host: HTMLElement,
  store: Store<AppState>,
  opts: { onToast: (code: string, message: string) => void }
): WalkthroughHandles {
  const root = el('div', 'cockpit-walkthrough');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Covert Coder product tour');

  const header = el('div', 'cockpit-walkthrough-header');
  const counter = el('span', 'cockpit-walkthrough-counter', '');
  const title = el('span', 'cockpit-walkthrough-title', '');
  header.append(counter, title);

  const detail = el('p', 'cockpit-walkthrough-detail', '');

  const controls = el('div', 'cockpit-walkthrough-controls');
  const back = el('button', 'cockpit-walkthrough-btn', 'BACK') as HTMLButtonElement;
  const next = el('button', 'cockpit-walkthrough-btn', 'NEXT') as HTMLButtonElement;
  const skip = el('button', 'cockpit-walkthrough-btn', 'SKIP') as HTMLButtonElement;
  const finish = el('button', 'cockpit-walkthrough-btn cockpit-walkthrough-finish', 'FINISH') as HTMLButtonElement;
  back.type = next.type = skip.type = finish.type = 'button';
  controls.append(back, next, skip, finish);

  root.append(header, detail, controls);
  host.appendChild(root);

  let index = 0;
  let open = false;

  function highlight(step: Step | null): void {
    host.querySelectorAll<HTMLElement>('.cockpit-rail-item.cockpit-walkthrough-target').forEach(item => item.classList.remove('cockpit-walkthrough-target'));
    if (step === null) return;
    const item = host.querySelector<HTMLElement>(`.cockpit-rail-item[data-item-id="${step.id}"]`);
    if (item) item.classList.add('cockpit-walkthrough-target');
  }

  function render(): void {
    const step = STEPS[index]!;
    counter.textContent = `STEP ${index + 1} OF ${STEPS.length}`;
    title.textContent = step.title;
    detail.textContent = step.detail;
    back.disabled = index === 0;
    next.hidden = index === STEPS.length - 1;
    finish.hidden = index !== STEPS.length - 1;
    highlight(step);
    store.set(prev => ({ ...prev, panel: step.id }));
  }

  function show(): void {
    open = true;
    root.hidden = false;
    render();
  }

  function dismiss(): void {
    open = false;
    root.hidden = true;
    highlight(null);
  }

  back.addEventListener('click', () => { if (index > 0) { index--; render(); } });
  next.addEventListener('click', () => { if (index < STEPS.length - 1) { index++; render(); } });
  skip.addEventListener('click', () => { opts.onToast('BAD_REQUEST', 'Walkthrough skipped. Reopen it any time from SETTINGS.'); dismiss(); });
  finish.addEventListener('click', () => {
    dismiss();
    opts.onToast('OK', 'Product tour closed. Setup progress is unchanged.');
  });

  return {
    open(): void { index = 0; show(); },
    close(): void { dismiss(); },
    isOpen(): boolean { return open; }
  };
}
