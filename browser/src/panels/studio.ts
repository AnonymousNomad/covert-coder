export interface StudioPanelHandles {
  dispose(): void;
}

const WORKSPACES = [
  ['PROJECT', 'FOUNDATION', 'Production identity, target runtime, format, budget and release intent will live here.'],
  ['STORY', 'GATED', 'Treatment, screenplay and scene ownership are not integrated yet.'],
  ['BIBLE', 'GATED', 'Character, location, prop, wardrobe and visual continuity records are not integrated yet.'],
  ['SHOTS', 'GATED', 'The durable sequence → scene → shot → generation graph is not integrated yet.'],
  ['ASSETS', 'GATED', 'Generated and imported media require canonical artifact identity and provenance.'],
  ['GENERATORS', 'GATED', 'Video, image, voice, music and sound providers require Model Access plus governed adapters.'],
  ['TIMELINE', 'GATED', 'Deterministic assembly/editing is not integrated yet.'],
  ['REVIEW', 'GATED', 'Continuity, quality and operator-approval review are not integrated yet.'],
  ['EXPORT', 'GATED', 'Rendering and publication are effects and require Authority and Resource Admission.']
] as const;

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createStudioPanel(parent: HTMLElement): StudioPanelHandles {
  parent.replaceChildren();
  const root = el('section', 'covert-studio');
  const header = el('header', 'covert-studio-header');
  const identity = el('div', 'covert-studio-identity');
  identity.append(
    el('h2', '', 'COVERT STUDIO'),
    el('p', 'covert-studio-subtitle', 'Governed generative-media production workspace')
  );
  header.append(identity, el('span', 'covert-studio-state', 'FOUNDATION · NO PRODUCTION OWNER'));
  root.append(header);

  const statement = el(
    'p',
    'covert-studio-note',
    'Studio coordinates production work; it does not generate media by itself. Cipher may plan and request qualified capabilities, while Authority, credentials, providers, artifacts and execution retain their canonical owners.'
  );
  root.append(statement);

  const flow = el('div', 'covert-studio-flow');
  for (const step of ['IDEA', 'SCRIPT', 'BIBLE', 'SHOT GRAPH', 'GENERATE', 'REVIEW', 'ASSEMBLE', 'EXPORT']) {
    flow.append(el('span', 'covert-studio-flow-step', step));
  }
  root.append(flow);

  const grid = el('div', 'covert-studio-grid');
  for (const [name, state, detail] of WORKSPACES) {
    const section = el('section', 'covert-studio-workspace');
    section.dataset.workspace = name.toLowerCase();
    section.append(el('h3', '', name), el('strong', '', state), el('p', '', detail));
    grid.append(section);
  }
  root.append(grid);

  root.append(
    el(
      'p',
      'covert-studio-note',
      'No provider call, generation, spend, file mutation, render, upload or publication action is available from this foundation surface.'
    )
  );
  parent.append(root);
  return { dispose: () => parent.replaceChildren() };
}
