// Decorative Covert world map.
// This is a visual identity element only. It is deliberately not wired to
// network telemetry, routing, or any operational claim.

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

export function createWorldMap(className = 'covert-world-map'): SVGSVGElement {
  const map = svg('svg', {
    class: className,
    viewBox: '0 0 760 220',
    role: 'img',
    'aria-label': 'Decorative Covert world map',
    'data-decorative': 'true',
    focusable: 'false'
  }) as SVGSVGElement;

  const grid = svg('g', { class: 'covert-world-map-grid', 'aria-hidden': 'true' });
  for (let x = 30; x < 760; x += 46) grid.appendChild(svg('path', { d: `M ${x} 0 V 220` }));
  for (let y = 20; y < 220; y += 38) grid.appendChild(svg('path', { d: `M 0 ${y} H 760` }));
  map.appendChild(grid);

  const coastlines = svg('g', { class: 'covert-world-map-coastlines', 'aria-hidden': 'true' });
  const continents = [
    'M52 63 L76 38 111 31 129 48 119 68 139 85 126 108 102 105 91 126 70 113 58 88 39 78 Z',
    'M154 123 L180 113 198 125 204 148 190 166 184 193 166 181 171 151 151 138 Z',
    'M258 54 L289 38 322 42 337 57 323 69 304 68 292 84 264 75 246 87 229 75 239 59 Z',
    'M302 91 L332 87 354 102 368 126 356 149 337 139 324 118 303 112 287 102 Z',
    'M403 65 L423 49 451 55 473 48 505 62 532 57 555 72 547 92 519 91 503 105 475 98 456 113 432 101 414 111 396 95 Z',
    'M472 119 L500 113 519 129 537 143 526 162 508 155 494 175 475 160 481 141 462 132 Z',
    'M574 104 L602 92 635 103 662 98 701 115 723 137 706 153 679 145 655 157 626 147 606 157 585 142 562 133 Z',
    'M666 174 L691 163 717 176 704 193 674 192 Z'
  ];
  for (const d of continents) coastlines.appendChild(svg('path', { d }));
  map.appendChild(coastlines);

  const nodes = svg('g', { class: 'covert-world-map-nodes', 'aria-hidden': 'true' });
  for (const [cx, cy, tone] of [[105, 71, 'cyan'], [183, 143, 'violet'], [286, 59, 'green'], [440, 78, 'cyan'], [511, 141, 'violet'], [625, 125, 'green'], [687, 182, 'cyan']] as const) {
    nodes.appendChild(svg('circle', { cx: String(cx), cy: String(cy), r: '2.5', class: `covert-world-map-node covert-world-map-node-${tone}` }));
    nodes.appendChild(svg('circle', { cx: String(cx), cy: String(cy), r: '7', class: 'covert-world-map-node-ring' }));
  }
  map.appendChild(nodes);

  return map;
}
