// Phase 7 — Ambient background effects.
// Subtle only: moving grid, faint particles, scanning line, panel breathing.
// No glitch, no flash, no gaming effects. Honors prefers-reduced-motion.

export interface AmbientHandles {
  root: HTMLElement;
}

export function createAmbientEffects(parent: HTMLElement): AmbientHandles {
  parent.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'cockpit-ambient-grid';
  parent.appendChild(grid);

  const scan = document.createElement('div');
  scan.className = 'cockpit-ambient-scan';
  parent.appendChild(scan);

  const dots = document.createElement('div');
  dots.className = 'cockpit-ambient-dots';
  parent.appendChild(dots);

  // Honor prefers-reduced-motion
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    parent.classList.add('cockpit-ambient-reduced');
  }

  return { root: parent };
}
