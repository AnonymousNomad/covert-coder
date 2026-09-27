// Covert ambient presentation. Decorative only: never a source of product truth.
import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';

export interface AmbientHandles {
  root: HTMLElement;
  dispose(): void;
}

function activityFor(state: AppState): 'idle' | 'work' | 'verify' | 'warn' | 'alert' {
  if (state.topbar.verification === 'FAILED') return 'alert';
  if (state.topbar.verification === 'DEGRADED') return 'warn';
  if (state.panel === 'verification') return 'verify';
  if (state.panel === 'editor' || state.panel === 'terminal' || state.panel === 'projects'
    || state.panel === 'models' || state.panel === 'skills' || state.panel === 'memory') return 'work';
  return 'idle';
}

export function createAmbientEffects(parent: HTMLElement, store: Store<AppState>): AmbientHandles {
  parent.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'cockpit-ambient-grid';
  parent.appendChild(grid);

  const rain = document.createElement('div');
  rain.className = 'cockpit-ambient-rain';
  rain.setAttribute('aria-hidden', 'true');
  for (let columnIndex = 0; columnIndex < 32; columnIndex += 1) {
    const column = document.createElement('span');
    column.className = 'cockpit-ambient-code-column';
    column.style.left = `${(columnIndex * 73) % 100}%`;
    column.style.setProperty('--code-delay', `${-((columnIndex * 17) % 23)}s`);
    column.style.setProperty('--code-opacity', String(0.22 + ((columnIndex * 11) % 16) / 100));
    const digits = Array.from(
      { length: 38 },
      (_, rowIndex) => ((columnIndex * 19 + rowIndex * 13 + rowIndex ** 2) % 2).toString()
    );
    column.textContent = digits.join('\n');
    rain.appendChild(column);
  }
  parent.appendChild(rain);

  const documentRoot = document.documentElement;
  const paint = (state: AppState): void => {
    documentRoot.dataset.covertMatrixActivity = activityFor(state);
  };
  paint(store.get());
  const unbind = store.subscribe(paint);

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const paintReduced = (): void => { parent.classList.toggle('cockpit-ambient-reduced', reducedQuery.matches); };
  paintReduced();
  const onReduced = (): void => paintReduced();
  reducedQuery.addEventListener?.('change', onReduced);

  return {
    root: parent,
    dispose(): void {
      unbind();
      reducedQuery.removeEventListener?.('change', onReduced);
      if (documentRoot.dataset.covertMatrixActivity !== undefined) delete documentRoot.dataset.covertMatrixActivity;
      parent.replaceChildren();
    }
  };
}
