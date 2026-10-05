import { APP_REGISTRY, type CovertAppManifest } from './app-registry.ts';
import type { WindowManager } from './window-manager.ts';
import type { DesktopAppId, DesktopLayoutState, NormalizedBounds, PixelBounds } from './types.ts';
import { bindWindowInteractions } from './window-interactions.ts';

export interface WindowManagerViewOptions {
  layer: HTMLElement;
  dock: HTMLElement;
  paletteHost: HTMLElement;
  manager: WindowManager;
  onAttach(appId: DesktopAppId, content: HTMLElement): void;
}

interface WindowElements {
  root: HTMLElement;
  content: HTMLElement;
  disposeInteractions(): void;
}

interface PaletteItem {
  label: string;
  detail: string;
  run(): void;
}

function button(label: string, text: string, className: string, ariaLabel = label): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = text;
  node.setAttribute('aria-label', ariaLabel);
  node.title = ariaLabel;
  return node;
}

function normalizedFromPixels(bounds: PixelBounds, layer: HTMLElement): NormalizedBounds {
  const width = Math.max(1, layer.clientWidth);
  const height = Math.max(1, layer.clientHeight);
  return { x: bounds.x / width, y: bounds.y / height, width: bounds.width / width, height: bounds.height / height };
}

function pixelsFromNormalized(bounds: NormalizedBounds, layer: HTMLElement): PixelBounds {
  const width = layer.clientWidth;
  const height = layer.clientHeight;
  return { x: bounds.x * width, y: bounds.y * height, width: bounds.width * width, height: bounds.height * height };
}

export class WindowManagerView {
  private readonly options: WindowManagerViewOptions;
  private readonly windows = new Map<DesktopAppId, WindowElements>();
  private readonly launcherButtons = new Map<DesktopAppId, HTMLButtonElement>();
  private readonly taskButtons = new Map<DesktopAppId, HTMLButtonElement>();
  private readonly unsubscribe: () => void;
  private readonly palette: HTMLDialogElement;
  private readonly paletteInput: HTMLInputElement;
  private readonly paletteList: HTMLElement;
  private previousFocus: HTMLElement | null = null;

  constructor(options: WindowManagerViewOptions) {
    this.options = options;
    this.palette = document.createElement('dialog');
    this.palette.className = 'desktop-command-palette';
    this.palette.setAttribute('aria-label', 'Covert command palette');
    this.paletteInput = document.createElement('input');
    this.paletteInput.type = 'search';
    this.paletteInput.autocomplete = 'off';
    this.paletteInput.spellcheck = false;
    this.paletteInput.placeholder = 'Open an application or switch layout…';
    this.paletteInput.setAttribute('aria-label', 'Search applications and layouts');
    this.paletteInput.setAttribute('role', 'combobox');
    this.paletteInput.setAttribute('aria-controls', 'desktop-command-results');
    this.paletteInput.setAttribute('aria-expanded', 'true');
    this.paletteList = document.createElement('div');
    this.paletteList.className = 'desktop-command-results';
    this.paletteList.id = 'desktop-command-results';
    this.paletteList.setAttribute('role', 'listbox');
    this.paletteInput.addEventListener('input', () => this.renderPaletteItems());
    this.paletteInput.addEventListener('keydown', event => this.onPaletteKeyDown(event));
    this.palette.addEventListener('close', () => this.previousFocus?.focus());
    const paletteTitle = document.createElement('div');
    paletteTitle.className = 'desktop-command-title';
    paletteTitle.textContent = 'COMMAND PALETTE';
    this.palette.append(paletteTitle, this.paletteInput, this.paletteList);
    options.paletteHost.appendChild(this.palette);

    this.renderDock();
    this.unsubscribe = options.manager.subscribe(state => this.renderWindows(state));
    this.renderWindows(options.manager.snapshot());
    document.addEventListener('keydown', this.onGlobalKeyDown, true);
    document.addEventListener('covert:open-command-palette', this.openPaletteEvent);
    window.addEventListener('resize', this.onViewportResize);
  }

  openPalette(): void {
    if (this.palette.open) {
      this.paletteInput.focus();
      return;
    }
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.paletteInput.value = '';
    this.renderPaletteItems();
    this.palette.showModal();
    this.paletteInput.focus();
  }

  dispose(): void {
    this.unsubscribe();
    document.removeEventListener('keydown', this.onGlobalKeyDown, true);
    document.removeEventListener('covert:open-command-palette', this.openPaletteEvent);
    window.removeEventListener('resize', this.onViewportResize);
    for (const window of this.windows.values()) {
      window.disposeInteractions();
      window.root.remove();
    }
    this.windows.clear();
    this.taskButtons.clear();
    this.palette.remove();
    this.options.dock.replaceChildren();
  }

  private renderDock(): void {
    this.options.dock.replaceChildren();
    const launcher = document.createElement('nav');
    launcher.className = 'desktop-launcher';
    launcher.setAttribute('aria-label', 'Covert applications');
    const tasks = document.createElement('div');
    tasks.className = 'desktop-window-tasks';
    tasks.setAttribute('aria-label', 'Open windows');
    const layoutTools = document.createElement('div');
    layoutTools.className = 'desktop-layout-tools';

    for (const manifest of APP_REGISTRY) {
      const appButton = button(`Open ${manifest.title}`, manifest.icon, 'desktop-launcher-app', `${manifest.title} application`);
      appButton.dataset.appId = manifest.id;
      appButton.setAttribute('aria-haspopup', 'false');
      if (manifest.maturity !== 'AVAILABLE') {
        appButton.disabled = true;
        appButton.dataset.maturity = manifest.maturity;
        appButton.title = `${manifest.title} · ${manifest.maturity}`;
        appButton.setAttribute('aria-label', `${manifest.title}, ${manifest.maturity.toLowerCase()}`);
      } else {
        appButton.addEventListener('click', () => this.openApp(manifest.id));
      }
      this.launcherButtons.set(manifest.id, appButton);
      launcher.appendChild(appButton);
    }

    const layoutSelect = document.createElement('select');
    layoutSelect.className = 'desktop-layout-select';
    layoutSelect.setAttribute('aria-label', 'Desktop layout');
    for (const [value, label] of [
      ['CODING', 'Coding'], ['DEBUGGING', 'Debugging'], ['MODEL_WORK', 'Model work'],
      ['VERIFICATION', 'Verification'], ['MINIMAL', 'Minimal'], ['CUSTOM', 'Custom']
    ] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      layoutSelect.appendChild(option);
    }
    layoutSelect.addEventListener('change', () => {
      const value = layoutSelect.value as DesktopLayoutState['selectedLayout'];
      if (value !== 'CUSTOM') this.options.manager.selectLayout(value);
    });

    const save = button('Save layout', 'Save', 'desktop-layout-action');
    save.addEventListener('click', () => this.options.manager.saveLayout());
    const restore = button('Restore startup layout', 'Restore', 'desktop-layout-action');
    restore.addEventListener('click', () => this.options.manager.restoreStartupLayout());
    const reset = button('Reset layout to Coding', 'Reset', 'desktop-layout-action');
    reset.addEventListener('click', () => this.options.manager.resetLayout());
    const startup = button('Set current layout as startup', 'Set startup', 'desktop-layout-action');
    startup.addEventListener('click', () => this.options.manager.setStartupLayout());
    const palette = button('Open command palette', '⌕', 'desktop-palette-trigger', 'Open command palette (Ctrl+K)');
    palette.addEventListener('click', () => this.openPalette());
    layoutTools.append(layoutSelect, save, restore, reset, startup, palette);
    this.options.dock.append(launcher, tasks, layoutTools);
    this.renderWindowTasks(this.options.manager.snapshot());
  }

  private renderWindows(state: DesktopLayoutState): void {
    const visibleIds = new Set(state.windows.map(window => window.appId));
    for (const [appId, elements] of this.windows) {
      if (!visibleIds.has(appId)) {
        elements.disposeInteractions();
        elements.root.remove();
        this.windows.delete(appId);
      }
    }
    const focused = state.windows.filter(window => !window.minimized).sort((left, right) => right.zIndex - left.zIndex)[0]?.appId ?? null;
    for (const windowState of state.windows) {
      const manifest = APP_REGISTRY.find(app => app.id === windowState.appId);
      if (!manifest) continue;
      let elements = this.windows.get(windowState.appId);
      if (!elements) {
        elements = this.createWindow(manifest);
        this.windows.set(windowState.appId, elements);
        this.options.onAttach(windowState.appId, elements.content);
        this.options.layer.appendChild(elements.root);
      }
      const pixels = pixelsFromNormalized(windowState.bounds, this.options.layer);
      elements.root.style.left = `${pixels.x}px`;
      elements.root.style.top = `${pixels.y}px`;
      elements.root.style.width = `${pixels.width}px`;
      elements.root.style.height = `${pixels.height}px`;
      elements.root.style.zIndex = String(windowState.zIndex);
      elements.root.style.setProperty('--window-min-width', `${manifest.minWidth}px`);
      elements.root.style.setProperty('--window-min-height', `${manifest.minHeight}px`);
      elements.root.hidden = windowState.minimized;
      elements.root.classList.toggle('is-focused', focused === windowState.appId);
      elements.root.classList.toggle('is-maximized', windowState.snap === 'maximized');
      elements.root.dataset.snap = windowState.snap;
      elements.content.setAttribute('aria-label', `${manifest.title} content`);
      const launcher = this.launcherButtons.get(windowState.appId);
      launcher?.classList.toggle('is-running', true);
      launcher?.setAttribute('aria-pressed', focused === windowState.appId ? 'true' : 'false');
    }
    for (const manifest of APP_REGISTRY) {
      const launcher = this.launcherButtons.get(manifest.id);
      const open = state.windows.some(window => window.appId === manifest.id);
      launcher?.classList.toggle('is-running', open);
      if (!open) launcher?.setAttribute('aria-pressed', 'false');
    }
    const layoutSelect = this.options.dock.querySelector<HTMLSelectElement>('.desktop-layout-select');
    if (layoutSelect) layoutSelect.value = state.selectedLayout;
    this.renderWindowTasks(state);
  }

  private createWindow(manifest: CovertAppManifest): WindowElements {
    const root = document.createElement('section');
    root.className = 'desktop-window';
    root.tabIndex = 0;
    root.dataset.appId = manifest.id;
    root.setAttribute('aria-label', `${manifest.title} window`);

    const titlebar = document.createElement('header');
    titlebar.className = 'desktop-window-titlebar';
    const identity = document.createElement('div');
    identity.className = 'desktop-window-identity';
    const icon = document.createElement('span');
    icon.className = 'desktop-window-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = manifest.icon;
    const title = document.createElement('span');
    title.className = 'desktop-window-title';
    title.textContent = manifest.title;
    const maturity = document.createElement('span');
    maturity.className = 'desktop-window-maturity';
    maturity.textContent = manifest.maturity;
    identity.append(icon, title, maturity);

    const controls = document.createElement('div');
    controls.className = 'desktop-window-controls';
    controls.dataset.noDrag = 'true';
    const snap = button(`Snap ${manifest.title} window`, '⌗', 'desktop-window-control desktop-window-snap', 'Snap window');
    const minimize = button(`Minimize ${manifest.title}`, '−', 'desktop-window-control', 'Minimize window');
    const maximize = button(`Maximize ${manifest.title}`, '□', 'desktop-window-control', 'Maximize or restore window');
    const close = button(`Close ${manifest.title}`, '×', 'desktop-window-control desktop-window-close', 'Close window');
    const snapMenu = document.createElement('div');
    snapMenu.className = 'desktop-snap-menu';
    snapMenu.hidden = true;
    for (const [target, label] of [
      ['left', 'Snap left'], ['right', 'Snap right'],
      ['top-left', 'Snap top left'], ['top-right', 'Snap top right'],
      ['bottom-left', 'Snap bottom left'], ['bottom-right', 'Snap bottom right']
    ] as const) {
      const item = button(label, label, 'desktop-snap-option');
      item.addEventListener('click', event => {
        event.stopPropagation();
        snapMenu.hidden = true;
        this.options.manager.snap(manifest.id, target);
      });
      snapMenu.appendChild(item);
    }
    snap.addEventListener('click', event => {
      event.stopPropagation();
      snapMenu.hidden = !snapMenu.hidden;
    });
    minimize.addEventListener('click', event => { event.stopPropagation(); this.options.manager.minimize(manifest.id); });
    maximize.addEventListener('click', event => { event.stopPropagation(); this.options.manager.toggleMaximize(manifest.id); });
    close.addEventListener('click', event => { event.stopPropagation(); this.options.manager.close(manifest.id); });
    controls.append(snap, minimize, maximize, close);
    titlebar.append(identity, controls);
    root.append(titlebar, snapMenu);

    const content = document.createElement('div');
    content.className = 'desktop-window-content';
    root.appendChild(content);
    for (const edge of ['n', 'e', 's', 'w']) {
      const handle = document.createElement('div');
      handle.className = `desktop-resize-handle desktop-resize-${edge}`;
      handle.setAttribute('aria-hidden', 'true');
      root.appendChild(handle);
    }
    root.addEventListener('pointerdown', () => this.options.manager.focus(manifest.id));
    const disposeInteractions = bindWindowInteractions({
      element: root,
      canvas: this.options.layer,
      titlebar,
      minimum: { width: manifest.minWidth, height: manifest.minHeight },
      onFocus: () => {},
      onCommit: bounds => this.options.manager.setBounds(manifest.id, normalizedFromPixels(bounds, this.options.layer))
    });
    return { root, content, disposeInteractions };
  }

  private renderWindowTasks(state: DesktopLayoutState): void {
    const taskHost = this.options.dock.querySelector<HTMLElement>('.desktop-window-tasks');
    if (!taskHost) return;
    const openIds = new Set(state.windows.map(window => window.appId));
    for (const [appId, task] of this.taskButtons) {
      if (!openIds.has(appId)) {
        task.remove();
        this.taskButtons.delete(appId);
      }
    }
    for (const window of state.windows) {
      const manifest = APP_REGISTRY.find(app => app.id === window.appId);
      if (!manifest) continue;
      let task = this.taskButtons.get(manifest.id);
      if (!task) {
        task = button(`Restore ${manifest.title}`, manifest.icon, 'desktop-window-task', `${manifest.title} window`);
        task.addEventListener('click', () => this.options.manager.restore(manifest.id));
        this.taskButtons.set(manifest.id, task);
      }
      if (task.parentElement !== taskHost) taskHost.appendChild(task);
      task.title = `${manifest.title}${window.minimized ? ', minimized' : ', open'}`;
      task.setAttribute('aria-label', `Focus or restore ${manifest.title}${window.minimized ? ', minimized' : ', open'}`);
      task.classList.toggle('is-minimized', window.minimized);
    }
  }

  private openApp(appId: DesktopAppId): void {
    this.options.manager.open(appId);
  }

  private itemsForPalette(): PaletteItem[] {
    const apps = APP_REGISTRY.filter(app => app.maturity === 'AVAILABLE').map(app => ({
      label: `Open ${app.title}`,
      detail: app.keyboardShortcut ?? app.id,
      run: () => this.openApp(app.id)
    }));
    const layouts = [
      ['CODING', 'Coding'], ['DEBUGGING', 'Debugging'], ['MODEL_WORK', 'Model work'], ['VERIFICATION', 'Verification'], ['MINIMAL', 'Minimal']
    ] as const;
    return [...apps, ...layouts.map(([id, label]) => ({ label: `Switch layout: ${label}`, detail: 'Layout', run: () => this.options.manager.selectLayout(id) }))];
  }

  private renderPaletteItems(): void {
    const query = this.paletteInput.value.trim().toLowerCase();
    const paletteItems = this.itemsForPalette().filter(item => `${item.label} ${item.detail}`.toLowerCase().includes(query));
    this.paletteList.replaceChildren();
    for (const [index, item] of paletteItems.entries()) {
      const row = button(item.label, item.label, 'desktop-command-result', item.label);
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
      row.id = `desktop-command-result-${index}`;
      const detail = document.createElement('span');
      detail.className = 'desktop-command-detail';
      detail.textContent = item.detail;
      row.appendChild(detail);
      row.addEventListener('click', () => {
        item.run();
        this.palette.close();
      });
      this.paletteList.appendChild(row);
    }
    if (paletteItems.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'desktop-command-empty';
      empty.textContent = 'No matching available application or layout.';
      this.paletteList.appendChild(empty);
    }
  }

  private onPaletteKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.palette.close();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const rows = Array.from(this.paletteList.querySelectorAll<HTMLButtonElement>('.desktop-command-result'));
      if (rows.length === 0) return;
      const current = rows.findIndex(row => row.getAttribute('aria-selected') === 'true');
      const next = event.key === 'ArrowDown' ? (current + 1) % rows.length : (current <= 0 ? rows.length - 1 : current - 1);
      rows.forEach((row, index) => row.setAttribute('aria-selected', index === next ? 'true' : 'false'));
      this.paletteInput.setAttribute('aria-activedescendant', rows[next]?.id ?? '');
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = this.paletteList.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      selected?.click();
    }
  }

  private onGlobalKeyDown = (event: KeyboardEvent): void => {
    if (this.palette.open) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      event.stopPropagation();
      this.openPalette();
      return;
    }
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      const shortcut = `Alt+${event.key}`;
      const app = APP_REGISTRY.find(manifest => manifest.keyboardShortcut?.toLowerCase() === shortcut.toLowerCase() && manifest.maturity === 'AVAILABLE');
      if (app) {
        event.preventDefault();
        this.openApp(app.id);
        return;
      }
    }
    if (event.altKey && event.key.startsWith('Arrow')) {
      const focused = this.options.manager.snapshot().windows.filter(window => !window.minimized).sort((a, b) => b.zIndex - a.zIndex)[0];
      if (!focused) return;
      const pixels = pixelsFromNormalized(focused.bounds, this.options.layer);
      const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
      const vertical = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
      const next = event.shiftKey
        ? { ...pixels, width: pixels.width + direction * 24, height: pixels.height + vertical * 24 }
        : { ...pixels, x: pixels.x + direction * 24, y: pixels.y + vertical * 24 };
      event.preventDefault();
      this.options.manager.setBounds(focused.appId, normalizedFromPixels(next, this.options.layer));
    }
  };

  private openPaletteEvent = (): void => this.openPalette();

  private onViewportResize = (): void => this.renderWindows(this.options.manager.snapshot());
}
