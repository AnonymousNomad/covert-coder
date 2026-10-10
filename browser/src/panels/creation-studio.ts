import { api } from '../services/api.ts';
import { buildCreationStudioRenderManifest } from '../../../common/creation-studio-manifest.ts';
import type {
  CreationStudioBibleEntryT,
  CreationStudioContinuityEntryT,
  CreationStudioProductionT,
  CreationStudioRecordT,
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function newProductionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return 'production-' + crypto.randomUUID();
  return 'production-' + Date.now().toString(36);
}

function blankProduction(): CreationStudioProductionT {
  return {
    production_id: newProductionId(),
    title: 'Untitled production',
    premise: '',
    target_duration_seconds: 1800,
    status: 'DRAFT',
    execution_connection: 'NOT_CONNECTED',
    scenes: []
  };
}

export function createCreationStudioPanel(parent: HTMLElement) {
  parent.replaceChildren();
  let sceneSequence = 0;
  let shotSequence = 0;
  let bibleSequence = 0;
  let continuitySequence = 0;
  let editingBibleId: string | null = null;
  let editingContinuityId: string | null = null;
  let production: CreationStudioProductionT = blankProduction();
  let bibleEntries: CreationStudioBibleEntryT[] = [];
  let continuityEntries: CreationStudioContinuityEntryT[] = [];
  let recordRevision = 0;
  let ownerReadable = false;
  let dirty = false;
  let busy = true;
  let alive = true;
  let statusDetail = 'loading canonical owner';
  let request: AbortController | null = null;

  const root = el('section', 'creation-studio');
  const header = el('header', 'creation-studio-header');
  const heading = el('div', '');
  heading.append(el('h2', '', 'COVERT CREATION STUDIO'), el('p', 'creation-studio-note', 'Cipher-directed production planning · rendering is not connected.'));
  const actions = el('div', 'creation-studio-actions');
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.textContent = 'RELOAD';
  reload.setAttribute('aria-label', 'Reload canonical production');
  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = 'SAVE PRODUCTION';
  save.setAttribute('aria-label', 'Save production');
  actions.append(reload, save);
  const state = el('div', 'creation-studio-state', 'LOADING CANONICAL STATE · RENDER NOT CONNECTED');
  header.append(heading, actions, state);

  const body = el('div', 'creation-studio-body');
  const planning = el('section', 'creation-studio-planning');
  const outline = el('section', 'creation-studio-outline');
  const manifest = el('section', 'creation-studio-manifest');
  body.append(planning, outline, manifest);
  root.append(header, body);
  parent.appendChild(root);

  const title = document.createElement('input');
  title.maxLength = 240;
  title.setAttribute('aria-label', 'Production title');
  const premise = document.createElement('textarea');
  premise.maxLength = 8000;
  premise.setAttribute('aria-label', 'Production premise');
  const duration = document.createElement('input');
  duration.type = 'number';
  duration.min = '1';
  duration.max = '360';
  duration.setAttribute('aria-label', 'Target duration minutes');

  const productionForm = el('div', 'creation-studio-production');
  const canonicalMemory = el('p', 'creation-studio-note');
  canonicalMemory.setAttribute('aria-label', 'Canonical production memory');
  productionForm.append(
    el('h3', '', 'PRODUCTION'),
    field('TITLE', title),
    field('PREMISE', premise),
    field('TARGET MINUTES', duration),
    canonicalMemory
  );

  const bibleCategory = document.createElement('select');
  bibleCategory.setAttribute('aria-label', 'Bible category');
  for (const value of ['CHARACTER', 'LOCATION', 'VISUAL_RULE', 'PROP', 'VEHICLE', 'VOICE', 'MUSIC', 'TERMINOLOGY']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value.replaceAll('_', ' ');
    bibleCategory.appendChild(option);
  }
  const bibleTitle = document.createElement('input');
  bibleTitle.maxLength = 240;
  bibleTitle.placeholder = 'Character, location, rule, prop…';
  bibleTitle.setAttribute('aria-label', 'Bible entry title');
  const bibleContent = document.createElement('textarea');
  bibleContent.maxLength = 8000;
  bibleContent.placeholder = 'Canonical production fact Cipher should preserve.';
  bibleContent.setAttribute('aria-label', 'Bible entry content');
  const bibleStatus = document.createElement('select');
  bibleStatus.setAttribute('aria-label', 'Bible entry status');
  for (const value of ['DRAFT', 'APPROVED']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    bibleStatus.appendChild(option);
  }
  const bibleSubmit = document.createElement('button');
  bibleSubmit.type = 'button';
  bibleSubmit.textContent = 'ADD BIBLE ENTRY';
  const bibleCancel = document.createElement('button');
  bibleCancel.type = 'button';
  bibleCancel.textContent = 'CANCEL EDIT';
  bibleCancel.hidden = true;
  const bibleList = el('div', 'creation-studio-bible-list');
  bibleList.setAttribute('aria-label', 'Production Bible entries');
  let bibleRowButtons: HTMLButtonElement[] = [];
  const bibleBuilder = el('div', 'creation-studio-builder');
  bibleBuilder.append(
    el('h3', '', 'PRODUCTION BIBLE'),
    el('p', 'creation-studio-note', 'Canonical creative facts consumed by Cipher. Keep credentials and provider secrets out of free-form content.'),
    field('CATEGORY', bibleCategory),
    field('TITLE', bibleTitle),
    field('CONTENT', bibleContent),
    field('STATUS', bibleStatus),
    bibleSubmit,
    bibleCancel,
    bibleList
  );

  const continuityScopeKind = document.createElement('select');
  continuityScopeKind.setAttribute('aria-label', 'Continuity scope kind');
  for (const value of ['PRODUCTION', 'SCENE', 'SHOT']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    continuityScopeKind.appendChild(option);
  }
  const continuityScopeId = document.createElement('select');
  continuityScopeId.setAttribute('aria-label', 'Continuity scope target');
  const continuityTitle = document.createElement('input');
  continuityTitle.maxLength = 240;
  continuityTitle.placeholder = 'Continuity fact title';
  continuityTitle.setAttribute('aria-label', 'Continuity entry title');
  const continuityContent = document.createElement('textarea');
  continuityContent.maxLength = 8000;
  continuityContent.placeholder = 'What later scenes or shots must preserve?';
  continuityContent.setAttribute('aria-label', 'Continuity entry content');
  const continuityStatus = document.createElement('select');
  continuityStatus.setAttribute('aria-label', 'Continuity entry status');
  for (const value of ['ACTIVE', 'RESOLVED']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    continuityStatus.appendChild(option);
  }
  const continuitySubmit = document.createElement('button');
  continuitySubmit.type = 'button';
  continuitySubmit.textContent = 'ADD CONTINUITY';
  const continuityCancel = document.createElement('button');
  continuityCancel.type = 'button';
  continuityCancel.textContent = 'CANCEL CONTINUITY EDIT';
  continuityCancel.hidden = true;
  const continuityList = el('div', 'creation-studio-continuity-list');
  continuityList.setAttribute('aria-label', 'Continuity entries');
  let continuityRowButtons: HTMLButtonElement[] = [];
  const continuityBuilder = el('div', 'creation-studio-builder');
  continuityBuilder.append(
    el('h3', '', 'CONTINUITY'),
    el('p', 'creation-studio-note', 'Canonical continuity facts. Scope them to the whole production, a scene, or a shot.'),
    field('SCOPE', continuityScopeKind),
    field('TARGET', continuityScopeId),
    field('TITLE', continuityTitle),
    field('CONTENT', continuityContent),
    field('STATUS', continuityStatus),
    continuitySubmit,
    continuityCancel,
    continuityList
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
  planning.append(productionForm, bibleBuilder, continuityBuilder, sceneBuilder, shotBuilder);

  const manifestOutput = el('pre', 'creation-studio-manifest-json');
  const manifestStatus = el('p', 'creation-studio-note');
  manifest.append(el('h3', '', 'RENDER MANIFEST'), manifestStatus, manifestOutput);

  const editControls: Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement> = [
    title, premise, duration, bibleCategory, bibleTitle, bibleContent, bibleStatus, bibleSubmit, bibleCancel,
    continuityScopeKind, continuityScopeId, continuityTitle, continuityContent, continuityStatus, continuitySubmit, continuityCancel,
    sceneTitle, sceneSummary, addScene, sceneSelect, shotPrompt, shotDuration, aspect, provider, model, addShot
  ];

  function syncControlsFromProduction(): void {
    title.value = production.title;
    premise.value = production.premise;
    duration.value = String(Math.max(1, production.target_duration_seconds / 60));
  }

  function syncProductionFields(): void {
    production.title = title.value.trim() || 'Untitled production';
    production.premise = premise.value;
    const minutes = Number(duration.value);
    production.target_duration_seconds = Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 360) * 60 : 60;
  }

  function recalculateSequences(): void {
    sceneSequence = 0;
    shotSequence = 0;
    bibleSequence = 0;
    continuitySequence = 0;
    for (const entry of bibleEntries) {
      const bibleMatch = /^bible-(\d+)$/.exec(entry.entry_id);
      if (bibleMatch) bibleSequence = Math.max(bibleSequence, Number(bibleMatch[1]));
    }
    for (const entry of continuityEntries) {
      const continuityMatch = /^continuity-(\d+)$/.exec(entry.entry_id);
      if (continuityMatch) continuitySequence = Math.max(continuitySequence, Number(continuityMatch[1]));
    }
    for (const scene of production.scenes) {
      const sceneMatch = /^scene-(\d+)$/.exec(scene.scene_id);
      if (sceneMatch) sceneSequence = Math.max(sceneSequence, Number(sceneMatch[1]));
      for (const shot of scene.shots) {
        const shotMatch = /^shot-(\d+)$/.exec(shot.shot_id);
        if (shotMatch) shotSequence = Math.max(shotSequence, Number(shotMatch[1]));
      }
    }
  }

  function nextBibleId(): string {
    const used = new Set(bibleEntries.map(entry => entry.entry_id));
    let value = '';
    do value = 'bible-' + String(++bibleSequence).padStart(4, '0'); while (used.has(value));
    return value;
  }

  function nextContinuityId(): string {
    const used = new Set(continuityEntries.map(entry => entry.entry_id));
    let value = '';
    do value = 'continuity-' + String(++continuitySequence).padStart(4, '0'); while (used.has(value));
    return value;
  }

  function nextSceneId(): string {
    const used = new Set(production.scenes.map(scene => scene.scene_id));
    let value = '';
    do value = 'scene-' + String(++sceneSequence).padStart(3, '0'); while (used.has(value));
    return value;
  }

  function nextShotId(): string {
    const used = new Set(production.scenes.flatMap(scene => scene.shots.map(shot => shot.shot_id)));
    let value = '';
    do value = 'shot-' + String(++shotSequence).padStart(4, '0'); while (used.has(value));
    return value;
  }

  function refreshContinuityScopeTargets(): void {
    const selected = continuityScopeId.value;
    continuityScopeId.replaceChildren();
    if (continuityScopeKind.value === 'PRODUCTION') {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Entire production';
      continuityScopeId.appendChild(option);
      continuityScopeId.value = '';
      continuityScopeId.disabled = true;
      return;
    }
    if (continuityScopeKind.value === 'SCENE') {
      for (const scene of [...production.scenes].sort((a, b) => a.order - b.order || a.scene_id.localeCompare(b.scene_id))) {
        const option = document.createElement('option');
        option.value = scene.scene_id;
        option.textContent = String(scene.order + 1) + '. ' + scene.title;
        continuityScopeId.appendChild(option);
      }
      continuityScopeId.disabled = production.scenes.length === 0 || busy;
      if (production.scenes.some(scene => scene.scene_id === selected)) continuityScopeId.value = selected;
      return;
    }
    const shots = production.scenes
      .flatMap(scene => scene.shots.map(shot => ({ scene, shot })))
      .sort((left, right) => left.scene.order - right.scene.order || left.scene.scene_id.localeCompare(right.scene.scene_id) || left.shot.order - right.shot.order || left.shot.shot_id.localeCompare(right.shot.shot_id));
    for (const { scene, shot } of shots) {
      const option = document.createElement('option');
      option.value = shot.shot_id;
      option.textContent = scene.title + ' · shot ' + String(shot.order + 1);
      continuityScopeId.appendChild(option);
    }
    continuityScopeId.disabled = shots.length === 0 || busy;
    if (shots.some(({ shot }) => shot.shot_id === selected)) continuityScopeId.value = selected;
  }

  function resetContinuityEditor(): void {
    editingContinuityId = null;
    continuityScopeKind.value = 'PRODUCTION';
    continuityTitle.value = '';
    continuityContent.value = '';
    continuityStatus.value = 'ACTIVE';
    continuitySubmit.textContent = 'ADD CONTINUITY';
    continuityCancel.hidden = true;
    refreshContinuityScopeTargets();
  }

  function renderContinuity(): void {
    continuityList.replaceChildren();
    continuityRowButtons = [];
    if (continuityEntries.length === 0) {
      continuityList.append(el('p', 'creation-studio-note', 'No continuity facts yet. Record only facts that later work must preserve.'));
      return;
    }
    for (const entry of continuityEntries) {
      const item = el('article', 'creation-studio-continuity-entry');
      const scope = entry.scope_kind === 'PRODUCTION' ? 'PRODUCTION' : entry.scope_kind + ' · ' + String(entry.scope_id);
      item.append(
        el('strong', '', scope + ' · ' + entry.title),
        el('span', 'creation-studio-shot-state', entry.status),
        el('p', '', entry.content)
      );
      const controls = el('div', 'creation-studio-entry-actions');
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'EDIT CONTINUITY';
      edit.disabled = busy;
      edit.addEventListener('click', () => {
        if (busy) return;
        editingContinuityId = entry.entry_id;
        continuityScopeKind.value = entry.scope_kind;
        refreshContinuityScopeTargets();
        continuityScopeId.value = entry.scope_id ?? '';
        continuityTitle.value = entry.title;
        continuityContent.value = entry.content;
        continuityStatus.value = entry.status;
        continuitySubmit.textContent = 'SAVE CONTINUITY';
        continuityCancel.hidden = false;
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'REMOVE CONTINUITY';
      remove.disabled = busy;
      remove.addEventListener('click', () => {
        if (busy) return;
        continuityEntries = continuityEntries.filter(candidate => candidate.entry_id !== entry.entry_id);
        if (editingContinuityId === entry.entry_id) resetContinuityEditor();
        markDirty();
      });
      continuityRowButtons.push(edit, remove);
      controls.append(edit, remove);
      item.append(controls);
      continuityList.append(item);
    }
  }

  function resetBibleEditor(): void {
    editingBibleId = null;
    bibleCategory.value = 'CHARACTER';
    bibleTitle.value = '';
    bibleContent.value = '';
    bibleStatus.value = 'DRAFT';
    bibleSubmit.textContent = 'ADD BIBLE ENTRY';
    bibleCancel.hidden = true;
  }

  function renderBible(): void {
    bibleList.replaceChildren();
    bibleRowButtons = [];
    if (bibleEntries.length === 0) {
      bibleList.append(el('p', 'creation-studio-note', 'No Bible entries yet. Add canonical characters, locations, visual rules, props or terminology.'));
      return;
    }
    for (const entry of bibleEntries) {
      const item = el('article', 'creation-studio-bible-entry');
      item.append(
        el('strong', '', entry.category.replaceAll('_', ' ') + ' · ' + entry.title),
        el('span', 'creation-studio-shot-state', entry.status),
        el('p', '', entry.content)
      );
      const controls = el('div', 'creation-studio-entry-actions');
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'EDIT';
      edit.disabled = busy;
      edit.addEventListener('click', () => {
        if (busy) return;
        editingBibleId = entry.entry_id;
        bibleCategory.value = entry.category;
        bibleTitle.value = entry.title;
        bibleContent.value = entry.content;
        bibleStatus.value = entry.status;
        bibleSubmit.textContent = 'SAVE BIBLE ENTRY';
        bibleCancel.hidden = false;
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'REMOVE';
      remove.disabled = busy;
      remove.addEventListener('click', () => {
        if (busy) return;
        bibleEntries = bibleEntries.filter(candidate => candidate.entry_id !== entry.entry_id);
        if (editingBibleId === entry.entry_id) resetBibleEditor();
        markDirty();
      });
      bibleRowButtons.push(edit, remove);
      controls.append(edit, remove);
      item.append(controls);
      bibleList.append(item);
    }
  }

  function paintState(): void {
    canonicalMemory.textContent = 'CANONICAL RECORD · ' + production.production_id + ' · BIBLE ' + String(bibleEntries.length) + ' · CONTINUITY ' + String(continuityEntries.length);
    if (busy) state.textContent = 'OWNER REQUEST IN FLIGHT · RENDER NOT CONNECTED';
    else if (!ownerReadable) state.textContent = 'CANONICAL STATE UNAVAILABLE · SAVE DISABLED · ' + statusDetail + ' · RENDER NOT CONNECTED';
    else if (dirty) state.textContent = 'UNSAVED CHANGES · BASE REVISION ' + String(recordRevision) + ' · RENDER NOT CONNECTED';
    else if (recordRevision > 0) state.textContent = 'SAVED REVISION ' + String(recordRevision) + ' · ' + statusDetail + ' · RENDER NOT CONNECTED';
    else state.textContent = 'NEW DRAFT · NOT SAVED · RENDER NOT CONNECTED';

    reload.disabled = busy;
    save.disabled = busy || !ownerReadable || !dirty;
    for (const control of editControls) control.disabled = busy;
    for (const control of bibleRowButtons) control.disabled = busy;
    for (const control of continuityRowButtons) control.disabled = busy;
    if (!busy) {
      refreshContinuityScopeTargets();
      sceneSelect.disabled = production.scenes.length === 0;
      addShot.disabled = production.scenes.length === 0;
    }
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
    if (production.scenes.some(scene => scene.scene_id === selected)) sceneSelect.value = selected;
  }

  function render(): void {
    syncProductionFields();
    refreshSceneSelect();
    refreshContinuityScopeTargets();
    renderBible();
    renderContinuity();
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
    paintState();
  }

  function markDirty(): void {
    dirty = true;
    statusDetail = 'local edits pending';
    render();
  }

  function applyRecord(record: CreationStudioRecordT): void {
    production = clone(record.production);
    bibleEntries = clone(record.bible_entries);
    continuityEntries = clone(record.continuity_entries);
    recordRevision = record.revision;
    resetBibleEditor();
    resetContinuityEditor();
    dirty = false;
    ownerReadable = true;
    statusDetail = 'canonical owner read';
    recalculateSequences();
    syncControlsFromProduction();
    render();
  }

  async function reloadCanonical(force = false): Promise<void> {
    if (!alive || busy && request !== null) return;
    if (dirty && !force && typeof window !== 'undefined' && typeof window.confirm === 'function' &&
        !window.confirm('Discard unsaved Creation Studio changes and reload the canonical record?')) return;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    busy = true;
    statusDetail = 'loading canonical owner';
    paintState();
    try {
      const result = await api.creationStudioList(controller.signal);
      if (!alive || controller.signal.aborted) return;
      const record = result.records[0] ?? null;
      if (record) applyRecord(record);
      else {
        production = blankProduction();
        bibleEntries = [];
        continuityEntries = [];
        recordRevision = 0;
        resetBibleEditor();
        resetContinuityEditor();
        ownerReadable = true;
        dirty = false;
        statusDetail = 'canonical owner empty';
        recalculateSequences();
        syncControlsFromProduction();
        render();
      }
    } catch (error) {
      if (!alive || controller.signal.aborted) return;
      ownerReadable = false;
      statusDetail = String((error as { code?: string })?.code ?? 'owner read failed').slice(0, 80);
    } finally {
      if (request === controller) request = null;
      busy = false;
      if (alive) paintState();
    }
  }

  async function saveCanonical(): Promise<void> {
    if (!alive || busy || !ownerReadable || !dirty) return;
    syncProductionFields();
    busy = true;
    statusDetail = 'save pending Authority';
    paintState();
    try {
      const record = await api.creationStudioPut({
        expected_revision: recordRevision,
        production: clone(production),
        bible_entries: clone(bibleEntries),
        continuity_entries: clone(continuityEntries)
      });
      if (!alive) return;
      applyRecord(record);
      statusDetail = 'canonical save confirmed';
    } catch (error) {
      if (!alive) return;
      const code = String((error as { code?: string })?.code ?? 'SAVE_FAILED');
      if (code === 'CONFLICT') {
        ownerReadable = false;
        statusDetail = 'REVISION CONFLICT · RELOAD REQUIRED';
      } else {
        statusDetail = code.slice(0, 80);
      }
    } finally {
      busy = false;
      if (alive) paintState();
    }
  }

  bibleSubmit.addEventListener('click', () => {
    if (busy) return;
    const nextTitle = bibleTitle.value.trim();
    const nextContent = bibleContent.value.trim();
    if (!nextTitle || !nextContent) return;
    const next: CreationStudioBibleEntryT = {
      entry_id: editingBibleId ?? nextBibleId(),
      category: bibleCategory.value as CreationStudioBibleEntryT['category'],
      title: nextTitle,
      content: nextContent,
      status: bibleStatus.value as CreationStudioBibleEntryT['status']
    };
    const index = bibleEntries.findIndex(entry => entry.entry_id === next.entry_id);
    if (index >= 0) bibleEntries[index] = next;
    else bibleEntries.push(next);
    resetBibleEditor();
    markDirty();
  });
  bibleCancel.addEventListener('click', () => {
    if (busy) return;
    resetBibleEditor();
  });

  continuityScopeKind.addEventListener('change', () => refreshContinuityScopeTargets());
  continuitySubmit.addEventListener('click', () => {
    if (busy) return;
    const nextTitle = continuityTitle.value.trim();
    const nextContent = continuityContent.value.trim();
    const scopeKind = continuityScopeKind.value as CreationStudioContinuityEntryT['scope_kind'];
    const scopeId = scopeKind === 'PRODUCTION' ? null : (continuityScopeId.value || null);
    if (!nextTitle || !nextContent || (scopeKind !== 'PRODUCTION' && scopeId === null)) return;
    const next: CreationStudioContinuityEntryT = {
      entry_id: editingContinuityId ?? nextContinuityId(),
      scope_kind: scopeKind,
      scope_id: scopeId,
      title: nextTitle,
      content: nextContent,
      status: continuityStatus.value as CreationStudioContinuityEntryT['status']
    };
    const index = continuityEntries.findIndex(entry => entry.entry_id === next.entry_id);
    if (index >= 0) continuityEntries[index] = next;
    else continuityEntries.push(next);
    resetContinuityEditor();
    markDirty();
  });
  continuityCancel.addEventListener('click', () => {
    if (busy) return;
    resetContinuityEditor();
  });

  addScene.addEventListener('click', () => {
    const nextTitle = sceneTitle.value.trim();
    if (!nextTitle || busy) return;
    const scene: CreationStudioSceneT = {
      scene_id: nextSceneId(),
      order: production.scenes.length,
      title: nextTitle,
      summary: sceneSummary.value.trim(),
      shots: []
    };
    production.scenes.push(scene);
    sceneTitle.value = '';
    sceneSummary.value = '';
    markDirty();
    sceneSelect.value = scene.scene_id;
  });

  addShot.addEventListener('click', () => {
    const scene = production.scenes.find(item => item.scene_id === sceneSelect.value);
    const prompt = shotPrompt.value.trim();
    const seconds = Number(shotDuration.value);
    if (!scene || !prompt || !Number.isFinite(seconds) || seconds <= 0 || busy) return;
    const providerId = provider.value.trim() || null;
    const modelId = model.value.trim() || null;
    const assigned = providerId !== null && modelId !== null;
    const shot: CreationStudioShotT = {
      shot_id: nextShotId(),
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
    markDirty();
  });

  for (const control of [title, premise, duration]) control.addEventListener('input', markDirty);
  reload.addEventListener('click', () => { void reloadCanonical(); });
  save.addEventListener('click', () => { void saveCanonical(); });

  syncControlsFromProduction();
  render();
  void reloadCanonical(true);

  return {
    root,
    get production(): CreationStudioProductionT { return production; },
    buildManifest: () => buildCreationStudioRenderManifest(production),
    refresh: () => reloadCanonical(),
    dispose(): void {
      alive = false;
      request?.abort();
      request = null;
      parent.replaceChildren();
    }
  };
}
