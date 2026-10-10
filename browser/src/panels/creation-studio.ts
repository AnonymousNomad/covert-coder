import { buildCreationStudioRenderManifest } from '../../../common/creation-studio-manifest.ts';
import type {
  CreationStudioProductionT,
  CreationStudioSceneT,
  CreationStudioShotT
} from '../../../common/contracts/creation-studio.ts';

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function field(label: string, control: HTMLElement): HTMLElement {
  const root = el('label', 'creation-studio-field');
  root.append(el('span', 'creation-studio-label', label), control);
  return root;
}

export function createCreationStudioPanel(parent: HTMLElement) {
  parent.replaceChildren();
  let sceneSequence = 0;
  let shotSequence = 0;
  const production: CreationStudioProductionT = {
    production_id: 'local-draft',
    title: 'Untitled production',
    premise: '',
    target_duration_seconds: 1800,
    status: 'DRAFT',
    execution_connection: 'NOT_CONNECTED',
    scenes: []
  };

  const root = el('section', 'creation-studio');
  const header = el('header', 'creation-studio-header');
  const heading = el('div', '');
  heading.append(el('h2', '', 'COVERT CREATION STUDIO'), el('p', 'creation-studio-note', 'Cipher-directed production planning · rendering is not connected.'));
  const state = el('div', 'creation-studio-state', 'LOCAL DRAFT · NOT PERSISTED · RENDER NOT CONNECTED');
  header.append(heading, state);

  const body = el('div', 'creation-studio-body');
  const planning = el('section', 'creation-studio-planning');
  const outline = el('section', 'creation-studio-outline');
  const manifest = el('section', 'creation-studio-manifest');
  body.append(planning, outline, manifest);
  root.append(header, body);
  parent.appendChild(root);

  const title = document.createElement('input');
  title.value = production.title;
  title.maxLength = 240;
  title.setAttribute('aria-label', 'Production title');
  const premise = document.createElement('textarea');
  premise.value = production.premise;
  premise.maxLength = 8000;
  premise.setAttribute('aria-label', 'Production premise');
  const duration = document.createElement('input');
  duration.type = 'number';
  duration.min = '1';
  duration.max = '360';
  duration.value = '30';
  duration.setAttribute('aria-label', 'Target duration minutes');

  const productionForm = el('div', 'creation-studio-production');
  productionForm.append(
    el('h3', '', 'PRODUCTION'),
    field('TITLE', title),
    field('PREMISE', premise),
    field('TARGET MINUTES', duration)
  );

  const sceneTitle = document.createElement('input');
  sceneTitle.maxLength = 240;
  sceneTitle.placeholder = 'Scene title';
  sceneTitle.setAttribute('aria-label', 'New scene title');
  const sceneSummary = document.createElement('textarea');
  sceneSummary.maxLength = 4000;
  sceneSummary.placeholder = 'What happens in this scene?';
  sceneSummary.setAttribute('aria-label', 'New scene summary');
  const addScene = document.createElement('button');
  addScene.type = 'button';
  addScene.textContent = 'ADD SCENE';

  const sceneBuilder = el('div', 'creation-studio-builder');
  sceneBuilder.append(el('h3', '', 'SCENE BUILDER'), field('TITLE', sceneTitle), field('SUMMARY', sceneSummary), addScene);

  const sceneSelect = document.createElement('select');
  sceneSelect.setAttribute('aria-label', 'Shot scene');
  const shotPrompt = document.createElement('textarea');
  shotPrompt.maxLength = 8000;
  shotPrompt.placeholder = 'Describe the shot, camera, subject, motion, lighting and action.';
  shotPrompt.setAttribute('aria-label', 'Shot prompt');
  const shotDuration = document.createElement('input');
  shotDuration.type = 'number';
  shotDuration.min = '1';
  shotDuration.max = '60';
  shotDuration.value = '6';
  shotDuration.setAttribute('aria-label', 'Shot duration seconds');
  const aspect = document.createElement('select');
  aspect.setAttribute('aria-label', 'Shot aspect ratio');
  for (const value of ['16:9', '9:16', '1:1', '2.39:1']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    aspect.appendChild(option);
  }
  const provider = document.createElement('input');
  provider.maxLength = 120;
  provider.placeholder = 'Provider ID (optional)';
  provider.setAttribute('aria-label', 'Video provider ID');
  const model = document.createElement('input');
  model.maxLength = 160;
  model.placeholder = 'Model ID (optional)';
  model.setAttribute('aria-label', 'Video model ID');
  const addShot = document.createElement('button');
  addShot.type = 'button';
  addShot.textContent = 'ADD SHOT';

  const shotBuilder = el('div', 'creation-studio-builder');
  shotBuilder.append(
    el('h3', '', 'SHOT BUILDER'),
    field('SCENE', sceneSelect),
    field('PROMPT', shotPrompt),
    field('SECONDS', shotDuration),
    field('ASPECT', aspect),
    field('VIDEO PROVIDER', provider),
    field('VIDEO MODEL', model),
    addShot
  );
  planning.append(productionForm, sceneBuilder, shotBuilder);

  const manifestOutput = el('pre', 'creation-studio-manifest-json');
  const manifestStatus = el('p', 'creation-studio-note');
  manifest.append(el('h3', '', 'RENDER MANIFEST'), manifestStatus, manifestOutput);

  function syncProductionFields(): void {
    production.title = title.value.trim() || 'Untitled production';
    production.premise = premise.value;
    const minutes = Number(duration.value);
    production.target_duration_seconds = Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 360) * 60 : 60;
  }

  function refreshSceneSelect(): void {
    const selected = sceneSelect.value;
    sceneSelect.replaceChildren();
    for (const scene of [...production.scenes].sort((a, b) => a.order - b.order)) {
      const option = document.createElement('option');
      option.value = scene.scene_id;
      option.textContent = String(scene.order + 1) + '. ' + scene.title;
      sceneSelect.appendChild(option);
    }
    sceneSelect.disabled = production.scenes.length === 0;
    addShot.disabled = production.scenes.length === 0;
    if (production.scenes.some(scene => scene.scene_id === selected)) sceneSelect.value = selected;
  }
  function render(): void {
    syncProductionFields();
    refreshSceneSelect();
    outline.replaceChildren(el('h3', '', 'PRODUCTION OUTLINE'));
    if (production.scenes.length === 0) {
      outline.append(el('p', 'creation-studio-note', 'No scenes yet. Add a scene, then break it into short renderable shots.'));
    }
    for (const scene of [...production.scenes].sort((a, b) => a.order - b.order)) {
      const sceneNode = el('section', 'creation-studio-scene');
      sceneNode.append(el('h4', '', 'SCENE ' + String(scene.order + 1) + ' · ' + scene.title));
      if (scene.summary) sceneNode.append(el('p', '', scene.summary));
      const shots = [...scene.shots].sort((a, b) => a.order - b.order);
      if (shots.length === 0) sceneNode.append(el('p', 'creation-studio-note', 'No shots planned.'));
      for (const shot of shots) {
        const video = shot.assignments.find(assignment => assignment.capability === 'VIDEO');
        const shotNode = el('article', 'creation-studio-shot');
        shotNode.append(
          el('strong', '', 'SHOT ' + String(shot.order + 1) + ' · ' + String(shot.duration_seconds) + 's · ' + shot.aspect_ratio),
          el('p', '', shot.prompt),
          el('code', '', video?.state === 'ASSIGNED' ? String(video.provider_id) + ' / ' + String(video.model_id) : 'VIDEO MODEL · UNASSIGNED'),
          el('span', 'creation-studio-shot-state', shot.state)
        );
        sceneNode.append(shotNode);
      }
      outline.append(sceneNode);
    }
    const built = buildCreationStudioRenderManifest(production);
    manifestStatus.textContent = built.execution_state + ' · ' + String(built.shots.length) + ' shots · ' + String(built.total_duration_seconds) + ' planned seconds';
    manifestOutput.textContent = JSON.stringify(built, null, 2);
  }

  addScene.addEventListener('click', () => {
    const nextTitle = sceneTitle.value.trim();
    if (!nextTitle) return;
    const scene: CreationStudioSceneT = {
      scene_id: 'scene-' + String(++sceneSequence).padStart(3, '0'),
      order: production.scenes.length,
      title: nextTitle,
      summary: sceneSummary.value.trim(),
      shots: []
    };
    production.scenes.push(scene);
    sceneTitle.value = '';
    sceneSummary.value = '';
    render();
    sceneSelect.value = scene.scene_id;
  });
  addShot.addEventListener('click', () => {
    const scene = production.scenes.find(item => item.scene_id === sceneSelect.value);
    const prompt = shotPrompt.value.trim();
    const seconds = Number(shotDuration.value);
    if (!scene || !prompt || !Number.isFinite(seconds) || seconds <= 0) return;
    const providerId = provider.value.trim() || null;
    const modelId = model.value.trim() || null;
    const assigned = providerId !== null && modelId !== null;
    const shot: CreationStudioShotT = {
      shot_id: 'shot-' + String(++shotSequence).padStart(4, '0'),
      order: scene.shots.length,
      prompt,
      duration_seconds: Math.min(seconds, 60),
      aspect_ratio: aspect.value as CreationStudioShotT['aspect_ratio'],
      state: 'PLANNED',
      assignments: [{
        capability: 'VIDEO',
        provider_id: providerId,
        model_id: modelId,
        state: assigned ? 'ASSIGNED' : 'UNASSIGNED'
      }]
    };
    scene.shots.push(shot);
    shotPrompt.value = '';
    render();
  });

  for (const control of [title, premise, duration]) {
    control.addEventListener('input', () => render());
  }

  render();
  return {
    root,
    production,
    buildManifest: () => buildCreationStudioRenderManifest(production),
    dispose(): void { parent.replaceChildren(); }
  };
}
