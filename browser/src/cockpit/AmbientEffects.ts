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

  const rain = document.createElement('div');
  rain.className = 'cockpit-ambient-rain';
  rain.setAttribute('aria-hidden', 'true');
  for (let columnIndex = 0; columnIndex < 32; columnIndex += 1) {
    const column = document.createElement('span');
    column.className = 'cockpit-ambient-code-column';
    column.style.left = `${(columnIndex * 73) % 100}%`;
    column.style.setProperty('--code-delay', `${-((columnIndex * 17) % 23)}s`);
    const digits = Array.from({ length: 38 }, (_, rowIndex) => ((columnIndex * 19 + rowIndex * 13 + rowIndex ** 2) % 2).toString());
    column.textContent = digits.join('\n');
    rain.appendChild(column);
  }
  parent.appendChild(rain);

  // Honor prefers-reduced-motion
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    parent.classList.add('cockpit-ambient-reduced');
  }

  return { root: parent };
}
