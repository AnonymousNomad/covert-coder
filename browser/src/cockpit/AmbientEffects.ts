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

  // Honor prefers-reduced-motion
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    parent.classList.add('cockpit-ambient-reduced');
  }

  return { root: parent };
}
