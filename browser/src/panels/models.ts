// Models panel — governed local model acquisition and runtime readiness.
//
// This surface deliberately composes the existing Model Hub, ModelRuntime and
// role router. It does not accept arbitrary URLs or paths and it never treats
// a spawned process as READY: readiness is established by /api/model/ready.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import type { HubFilesResponseT, HubSearchResponseT, HubDownloadsListResponseT } from '../../../common/contracts/modelhub.ts';
import type { HardwareProfileResponseT } from '../../../common/contracts/hardware.ts';
import type { ModelStatusResponseT, ModelRoleAssignRequestT } from '../../../common/contracts/models.ts';
import type { RoutesResponseT } from '../../../common/contracts/routing.ts';
import { modelDisplayState, modelIsActive, modelIsVerifiedReady } from '../../../common/model-state.ts';

export interface PanelHandles {
  dispose(): void;
}

type HubModelT = HubSearchResponseT['models'][number];
type HubFileT = HubFilesResponseT['files'][number];
type DownloadJobT = HubDownloadsListResponseT['jobs'][number];
type HubSort = 'downloads' | 'likes' | 'modified';
type FitLabel = 'GOOD FIT' | 'MAY FIT' | 'TOO LARGE' | 'UNKNOWN';

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, handler: () => void | Promise<void>, disabled = false, cls = 'cockpit-mode'): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = cls;
  node.textContent = label;
  node.disabled = disabled;
  node.addEventListener('click', () => { void handler(); });
  return node;
}

function statusClass(state: string): string {
  if (state === 'READY' || state === 'RUNNING') return 'ok';
  if (state === 'FAILED') return 'err';
  if (state === 'STARTABLE' || state === 'STARTING' || state === 'DEGRADED') return 'warn';
  return 'dim';
}

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'SIZE UNKNOWN';
  if (value < 1024 ** 2) return `${Math.max(1, Math.round(value / 1024))} KB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}

function formatCount(value: number | undefined): string {
  return value === undefined ? 'UNKNOWN' : new Intl.NumberFormat().format(value);
}

function formatParameters(value: number | undefined): string {
  if (value === undefined) return 'PARAMETERS UNKNOWN';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B PARAMS`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M PARAMS`;
  return `${formatCount(value)} PARAMS`;
}

function quantLabel(filename: string): string {
  const match = filename.match(/(?:^|[-_.])(Q\d+(?:_[A-Z0-9]+)*)(?:[-_.]|$)/i);
  return match?.[1]?.toUpperCase() ?? 'QUANT UNKNOWN';
}

function fitForArtifact(size: number | null, hardware: HardwareProfileResponseT | null): FitLabel {
  if (size === null || hardware === null || hardware.freeRamBytes <= 0) return 'UNKNOWN';
  // Conservative pre-download estimate. Final architecture/context fit is
  // established by the GGUF manifest and ModelRuntime after publication.
  const estimatedBytes = size * 1.35 + 512 * 1024 ** 2;
  if (estimatedBytes <= hardware.freeRamBytes * 0.45) return 'GOOD FIT';
  if (estimatedBytes <= hardware.freeRamBytes * 0.72) return 'MAY FIT';
  return 'TOO LARGE';
}

function fitClass(fit: FitLabel): string {
  return fit === 'GOOD FIT' ? 'ok' : fit === 'TOO LARGE' ? 'err' : fit === 'MAY FIT' ? 'warn' : 'dim';
}

function relativeTime(iso: string | undefined): string {
  if (iso === undefined) return 'UPDATED UNKNOWN';
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) return 'UPDATED UNKNOWN';
  const hours = Math.max(0, Math.round((Date.now() - stamp) / 3_600_000));
  return hours < 24 ? `UPDATED ${hours}H AGO` : `UPDATED ${Math.round(hours / 24)}D AGO`;
}

export function createModelsPanel(parent: HTMLElement, _store: Store<AppState>): PanelHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content models-panel');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'MODELS'));
  header.appendChild(el('span', 'panel-maturity', 'LOCAL-FIRST · GOVERNED'));
  root.appendChild(header);
  root.appendChild(el('div', 'panel-intro', 'Find a compatible GGUF, verify its artifact, start the proven local runtime, then assign the same model to Planner, Coder, Reviewer, or Resident chat.'));
  const feedback = el('div', 'panel-intro models-feedback');
  feedback.setAttribute('role', 'status');
  root.appendChild(feedback);
  const body = el('div', 'models-body');
  root.appendChild(body);
  parent.appendChild(root);

  let alive = true;
  let refreshing = false;
  let pending = false;
  let findOpen = false;
  let searchBusy = false;
  let filesBusy = false;
  let queryText = '';
  let sort: HubSort = 'downloads';
  let hubModels: HubModelT[] = [];
  let selectedRepo = '';
  let selectedFiles: HubFileT[] = [];
  let selectedFile: HubFileT | null = null;
  let selectedQuant = '';
  let hardware: HardwareProfileResponseT | null = null;
  let status: ModelStatusResponseT = { runtime: false, models: [] };
  let routes: RoutesResponseT = { routes: [] };
  let jobs: DownloadJobT[] = [];
  let jobsMount: HTMLElement | null = null;
  let testResults = new Map<string, string>();
  let roleSelections = new Map<string, string[]>();
  const verifiedReady = new Set<string>();
  const registering = new Set<string>();
  const registeredJobs = new Set<string>();

  function setFeedback(message: string): void {
    feedback.textContent = message;
  }

  function routeMap(): Map<string, RoutesResponseT['routes'][number]> {
    return new Map(routes.routes.map(route => [route.id, route]));
  }

  function renderJobs(): void {
    if (jobsMount === null) return;
    jobsMount.innerHTML = '';
    const activeJobs = jobs.filter(job => job.status === 'running' || job.status === 'error' || job.status === 'cancelled' || job.status === 'done').slice(-5).reverse();
    if (activeJobs.length === 0) return;
    jobsMount.appendChild(el('div', 'models-section-header', 'DOWNLOAD / VERIFICATION EVIDENCE'));
    for (const job of activeJobs) {
      const row = el('div', `model-acquisition-job ${job.status === 'done' ? 'ok' : job.status === 'error' ? 'err' : job.status === 'cancelled' ? 'dim' : 'running'}`);
      const head = el('div', 'model-acquisition-job-head');
      head.appendChild(el('strong', 'model-acquisition-job-name', job.filename));
      head.appendChild(el('span', 'model-acquisition-job-status', job.status.toUpperCase()));
      row.appendChild(head);
      if (job.bytes_total !== null && job.bytes_total > 0) {
        const progress = document.createElement('progress');
        progress.max = job.bytes_total;
        progress.value = Math.min(job.bytes_done, job.bytes_total);
        progress.className = 'models-download-progress';
        row.appendChild(progress);
        row.appendChild(el('span', 'model-acquisition-job-meta', `${formatBytes(job.bytes_done)} / ${formatBytes(job.bytes_total)}`));
      } else if (job.status === 'running') {
        row.appendChild(el('span', 'model-acquisition-job-meta', `${formatBytes(job.bytes_done)} · SIZE PENDING`));
      }
      if (job.manifest !== undefined) {
        const manifest = job.manifest;
        row.appendChild(el('span', `model-acquisition-job-meta ${manifest.status === 'ready' ? 'ok-text' : 'warn-text'}`, `MANIFEST ${manifest.status.toUpperCase()} · ${manifest.architecture || 'ARCHITECTURE UNKNOWN'}`));
        row.appendChild(el('span', 'model-acquisition-job-hash', `SHA256 ${manifest.sha256 ?? 'UNAVAILABLE'}`));
      }
      if (job.error !== null) row.appendChild(el('span', 'model-acquisition-job-error', job.error));
      if (job.status === 'running') {
        row.appendChild(button('CANCEL', async () => {
          pending = true;
          setFeedback(`Approval required to cancel ${job.filename}.`);
          try {
            await api.modelHubCancel(job.job_id);
            setFeedback(`${job.filename}: cancellation requested.`);
            await refreshJobs();
          } catch (error) {
            setFeedback(`Cancellation did not complete: ${error instanceof Error ? error.message : String(error)}`);
          } finally {
            pending = false;
          }
        }, pending, 'models-action models-action-warn'));
      }
      jobsMount.appendChild(row);
    }
  }

  async function registerCompletedJob(job: DownloadJobT): Promise<void> {
    if (job.status !== 'done' || registering.has(job.job_id) || registeredJobs.has(job.job_id) || job.manifest === undefined) return;
    if (job.manifest.status !== 'ready') {
      setFeedback(`${job.filename}: FORMAT NOT CURRENTLY SUPPORTED · ${job.manifest.architecture || 'GGUF header unavailable'}.`);
      return;
    }
    const registeredId = job.filename.replace(/\.gguf$/i, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    if (status.models.some(model => model.id === registeredId && model.ingested === true)) {
      registeredJobs.add(job.job_id);
      return;
    }
    registering.add(job.job_id);
    setFeedback(`${job.filename}: verified SHA256. Requesting approval to register the local artifact.`);
    try {
      await api.modelRegister({
        filename: job.filename,
        repo_id: job.repo_id,
        ...(job.manifest.quant_label !== undefined && job.manifest.quant_label !== null ? { quant_label: job.manifest.quant_label } : {})
      });
      registeredJobs.add(job.job_id);
      setFeedback(`${job.filename}: REGISTERED · choose START MODEL in the inventory.`);
      await refreshState();
    } catch (error) {
      setFeedback(`Registration did not complete: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      registering.delete(job.job_id);
    }
  }

  async function refreshJobs(): Promise<void> {
    if (!alive) return;
    try {
      jobs = (await api.modelHubDownloads()).jobs;
      renderJobs();
      const completed = jobs.find(job => job.status === 'done' && job.manifest !== undefined && !registering.has(job.job_id) && !registeredJobs.has(job.job_id));
      if (completed !== undefined) await registerCompletedJob(completed);
    } catch {
      // The model inventory remains useful when the optional download
      // projection is unavailable; the next bounded poll retries it.
    }
  }

  async function refreshState(): Promise<void> {
    if (!alive || refreshing) return;
    refreshing = true;
    try {
      const [nextStatus, nextRoutes, nextHardware] = await Promise.all([
        api.modelsStatus(),
        api.routes(),
        api.hardwareProfile().catch(() => null)
      ]);
      status = nextStatus;
      routes = nextRoutes;
      hardware = nextHardware;
      // Paint the current inventory before optional readiness probes. A
      // stopped or failed endpoint must never blank the Models surface or
      // hide the operator's retry/evidence controls.
      if (alive) render();
      const proofCandidates = nextStatus.models.filter(model => model.ingested === true && model.runtime_available === true && model.artifact_available === true);
      const proofIds = new Set(proofCandidates.map(model => model.id));
      for (const id of [...verifiedReady]) if (!proofIds.has(id)) verifiedReady.delete(id);
      await Promise.all(proofCandidates.map(async model => {
        const proof = await Promise.race([
          api.modelReady(model.id),
          new Promise<null>(resolve => window.setTimeout(() => resolve(null), 7000))
        ]).catch(() => null);
        if (proof?.ready === true) verifiedReady.add(model.id);
        else verifiedReady.delete(model.id);
      }));
      if (alive) render();
    } catch (error) {
      if (alive) {
        body.innerHTML = '';
        body.appendChild(el('div', 'panel-error', `Failed to load model state: ${error instanceof Error ? error.message : String(error)}`));
      }
    } finally {
      refreshing = false;
    }
  }

  async function searchHub(): Promise<void> {
    if (searchBusy || queryText.trim().length === 0) return;
    searchBusy = true;
    setFeedback(`Searching Hugging Face Hub for “${queryText.trim()}” · explicit network request · GGUF filter.`);
    try {
      const response = await api.modelHubSearch(queryText.trim(), sort, 20);
      hubModels = response.models;
      selectedRepo = '';
      selectedFiles = [];
      selectedFile = null;
      setFeedback(`${hubModels.length} Hub result${hubModels.length === 1 ? '' : 's'} returned. Inspect a repository to choose one compatible artifact.`);
    } catch (error) {
      setFeedback(`Hub search unavailable: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      searchBusy = false;
      if (alive) render();
    }
  }

  async function inspectFiles(repoId: string): Promise<void> {
    if (filesBusy) return;
    filesBusy = true;
    selectedRepo = repoId;
    selectedFiles = [];
    selectedFile = null;
    setFeedback(`${repoId}: inspecting compatible GGUF artifacts.`);
    try {
      selectedFiles = (await api.modelHubFiles(repoId)).files;
      setFeedback(selectedFiles.length > 0 ? `${repoId}: choose one artifact. Covert will not download the whole repository.` : `${repoId}: FORMAT NOT CURRENTLY SUPPORTED · no GGUF artifact was returned.`);
    } catch (error) {
      setFeedback(`Repository inspection failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      filesBusy = false;
      if (alive) render();
    }
  }

  async function downloadSelected(): Promise<void> {
    if (selectedRepo.length === 0 || selectedFile === null || pending) return;
    pending = true;
    setFeedback(`Approval required to download ${selectedFile.filename} into the governed local models directory.`);
    try {
      const started = await api.modelHubDownload({ repo_id: selectedRepo, filename: selectedFile.filename, quant_label: selectedQuant || quantLabel(selectedFile.filename) });
      setFeedback(`${selectedFile.filename}: DOWNLOAD_STARTED · job ${started.job_id}.`);
      await refreshJobs();
      render();
    } catch (error) {
      setFeedback(`Download did not start: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      pending = false;
    }
  }

  async function startModel(id: string, name: string): Promise<void> {
    if (pending) return;
    pending = true;
    setFeedback(`Approval required to start ${name}. READY requires endpoint and inference proof.`);
    try {
      await api.modelStart(id);
      setFeedback(`${name}: STARTING · waiting for local endpoint readiness.`);
      if (alive) render();
      const deadline = Date.now() + 120_000;
      while (alive && Date.now() < deadline) {
        const ready = await api.modelReady(id);
        if (ready.ready) {
          verifiedReady.add(id);
          setFeedback(`${name}: READY · local endpoint responded and warmup completed.`);
          await refreshState();
          return;
        }
        await new Promise(resolve => window.setTimeout(resolve, 1000));
      }
      setFeedback(`${name}: readiness proof timed out. The model is not marked READY.`);
    } catch (error) {
      setFeedback(`Model start did not complete: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      pending = false;
      if (status.models.some(model => model.id === id && model.status !== 'running')) verifiedReady.delete(id);
      if (alive) await refreshState();
    }
  }

  async function stopModel(id: string, name: string): Promise<void> {
    if (pending) return;
    pending = true;
    setFeedback(`Approval required to stop ${name}.`);
    try {
      await api.modelStop(id);
      setFeedback(`${name}: STOP requested.`);
    } catch (error) {
      setFeedback(`Model stop did not complete: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      pending = false;
      if (alive) await refreshState();
    }
  }

  async function assignRoles(id: string, name: string): Promise<void> {
    const roles = roleSelections.get(id) ?? [];
    if (roles.length === 0 || pending) return;
    pending = true;
    setFeedback(`Approval required to assign ${name} to ${roles.join(', ')}.`);
    try {
      const request: ModelRoleAssignRequestT = { id, roles };
      const response = await api.modelAssignRoles(request);
      setFeedback(`${name}: roles saved · ${response.roles.filter(role => role !== 'chat').join(', ') || 'Resident chat only'}.`);
      await refreshState();
    } catch (error) {
      setFeedback(`Role assignment did not complete: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      pending = false;
    }
  }

  async function testModel(id: string, name: string): Promise<void> {
    if (pending) return;
    pending = true;
    setFeedback(`${name}: TEST MODEL · sending a real local inference probe.`);
    try {
      const response = await api.modelTest(`local:${id}`);
      const passed = response.text.trim() === 'COVERT_MODEL_READY';
      testResults.set(id, passed ? 'PASS · COVERT_MODEL_READY' : `FAIL · received ${response.text.trim().slice(0, 120)}`);
      setFeedback(`${name}: ${passed ? 'MODEL_TEST_INFERENCE PASSED.' : 'MODEL_TEST_INFERENCE FAILED.'}`);
    } catch (error) {
      testResults.set(id, `FAIL · ${error instanceof Error ? error.message : String(error)}`);
      setFeedback(`${name}: local inference failed · ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      pending = false;
      if (alive) render();
    }
  }

  function renderDiscovery(): HTMLElement {
    const section = el('section', 'models-discovery');
    const titleRow = el('div', 'models-section-header');
    titleRow.appendChild(el('span', '', 'FIND A MODEL · HUGGING FACE HUB'));
    titleRow.appendChild(button('CLOSE', () => { findOpen = false; render(); }, false, 'models-action models-action-quiet'));
    section.appendChild(titleRow);
    section.appendChild(el('div', 'models-discovery-note', 'Search is explicit and governed. Results are scoped to repositories with GGUF-compatible artifacts; final runtime compatibility is checked after download.'));
    const form = document.createElement('form');
    form.className = 'models-search-form';
    const input = document.createElement('input');
    input.className = 'models-search-input';
    input.type = 'search';
    input.placeholder = 'Qwen coder · DeepSeek coder · SmolLM · GGUF';
    input.value = queryText;
    input.setAttribute('aria-label', 'Search Hugging Face models');
    input.addEventListener('input', () => { queryText = input.value; });
    form.appendChild(input);
    const sortSelect = document.createElement('select');
    sortSelect.className = 'models-search-sort';
    for (const option of [['downloads', 'POPULAR'], ['likes', 'LIKED'], ['modified', 'RECENT']] as const) {
      const item = document.createElement('option');
      item.value = option[0];
      item.textContent = option[1];
      item.selected = sort === option[0];
      sortSelect.appendChild(item);
    }
    sortSelect.addEventListener('change', () => { sort = sortSelect.value as HubSort; });
    form.appendChild(sortSelect);
    const searchButton = button(searchBusy ? 'SEARCHING…' : 'SEARCH HUB', () => {}, searchBusy, 'models-action models-action-primary');
    searchButton.type = 'submit';
    form.appendChild(searchButton);
    form.addEventListener('submit', event => { event.preventDefault(); void searchHub(); });
    section.appendChild(form);

    if (hubModels.length === 0 && !searchBusy) {
      section.appendChild(el('div', 'models-discovery-empty', queryText.length > 0 ? 'No results loaded yet. Search the governed Hub for a real repository.' : 'Enter a model family or author to begin.'));
    }
    const resultList = el('div', 'models-hub-results');
    for (const model of hubModels) {
      const card = el('article', `models-hub-card ${selectedRepo === model.repo_id ? 'selected' : ''}`);
      const head = el('div', 'models-hub-card-head');
      head.appendChild(el('strong', 'models-hub-repo', model.repo_id));
      head.appendChild(el('span', 'models-hub-compatible', 'GGUF CANDIDATE'));
      card.appendChild(head);
      const meta = el('div', 'models-hub-meta');
      meta.appendChild(el('span', '', model.author ?? 'AUTHOR UNKNOWN'));
      meta.appendChild(el('span', '', formatParameters(model.parameters)));
      meta.appendChild(el('span', '', `${formatCount(model.downloads)} DOWNLOADS`));
      meta.appendChild(el('span', '', `${formatCount(model.likes)} LIKES`));
      meta.appendChild(el('span', '', relativeTime(model.last_modified)));
      card.appendChild(meta);
      const tags = model.tags.slice(0, 6);
      if (tags.length > 0) card.appendChild(el('div', 'models-hub-tags', tags.join(' · ')));
      if (model.gated === true) card.appendChild(el('div', 'models-hub-warning', 'AUTHENTICATION REQUIRED · use governed Hugging Face credentials if configured.'));
      const actions = el('div', 'models-card-actions');
      actions.appendChild(button(filesBusy && selectedRepo === model.repo_id ? 'INSPECTING…' : 'INSPECT GGUF FILES', () => inspectFiles(model.repo_id), filesBusy, 'models-action'));
      card.appendChild(actions);
      if (selectedRepo === model.repo_id) {
        const files = el('div', 'models-file-list');
        if (selectedFiles.length === 0 && !filesBusy) files.appendChild(el('div', 'models-discovery-empty', 'No compatible GGUF artifact found. FORMAT NOT CURRENTLY SUPPORTED.'));
        for (const file of selectedFiles) {
          const fit = fitForArtifact(file.size, hardware);
          const row = el('div', `models-file-row ${selectedFile?.filename === file.filename ? 'selected' : ''}`);
          const fileInfo = el('div', 'models-file-info');
          fileInfo.appendChild(el('strong', 'models-file-name', file.filename));
          fileInfo.appendChild(el('span', 'models-file-meta', `${formatBytes(file.size)} · ${quantLabel(file.filename)} · ${fit}`));
          fileInfo.appendChild(el('span', `models-file-fit ${fitClass(fit)}`, hardware === null ? 'HARDWARE UNKNOWN' : 'ESTIMATE · FINAL CHECK AFTER DOWNLOAD'));
          row.appendChild(fileInfo);
          const choose = button(selectedFile?.filename === file.filename ? 'SELECTED' : 'CHOOSE', () => {
            selectedFile = file;
            selectedQuant = quantLabel(file.filename) === 'QUANT UNKNOWN' ? '' : quantLabel(file.filename);
            render();
          }, file.filename.toLowerCase().endsWith('.gguf') === false, 'models-action models-action-quiet');
          row.appendChild(choose);
          files.appendChild(row);
        }
        if (selectedFile !== null) {
          const selected = el('div', 'models-selected-artifact');
          selected.appendChild(el('strong', 'models-selected-title', 'SELECTED ARTIFACT'));
          selected.appendChild(el('span', 'models-selected-line', `${selectedRepo} / ${selectedFile.filename}`));
          selected.appendChild(el('span', 'models-selected-line', `DESTINATION · models/${selectedFile.filename}`));
          selected.appendChild(el('span', 'models-selected-line', `SIZE · ${formatBytes(selectedFile.size)} · FIT · ${fitForArtifact(selectedFile.size, hardware)}`));
          selected.appendChild(button(pending ? 'REQUESTING…' : 'DOWNLOAD · VERIFY · REGISTER', () => downloadSelected(), pending, 'models-action models-action-primary'));
          files.appendChild(selected);
        }
        const discoveryJobs = el('div', 'models-download-jobs');
        files.appendChild(discoveryJobs);
        jobsMount = discoveryJobs;
        section.appendChild(files);
      }
      resultList.appendChild(card);
    }
    section.appendChild(resultList);
    return section;
  }

  function renderModelCard(model: ModelStatusResponseT['models'][number], routeMapValue: Map<string, RoutesResponseT['routes'][number]>): HTMLElement {
    const route = routeMapValue.get(`local:${model.id}`) ?? routeMapValue.get(model.id);
    const state = verifiedReady.has(model.id) ? 'READY' : modelDisplayState(model, route?.status);
    const card = el('article', `model-card ${statusClass(state)}`);
    const head = el('div', 'model-card-head');
    head.appendChild(el('span', 'model-card-name', model.name));
    head.appendChild(el('span', `model-card-status ${statusClass(state)}`, state));
    card.appendChild(head);
    const meta = el('div', 'model-card-meta');
    meta.appendChild(el('span', 'model-card-meta-item', `id: ${model.id}`));
    meta.appendChild(el('span', 'model-card-meta-item', `runtime: ${model.runtime_available ? 'available' : 'unavailable'}`));
    meta.appendChild(el('span', 'model-card-meta-item', `artifact: ${model.artifact_available ? 'verified/available' : 'unavailable'}`));
    if (route !== undefined) meta.appendChild(el('span', 'model-card-meta-item', `roles: ${route.roles.filter(role => role !== 'chat').join(', ') || 'RESIDENT CHAT'}`));
    if (model.setup_required && model.setup_message !== undefined) meta.appendChild(el('span', 'model-card-meta-item model-card-meta-warn', `setup: ${model.setup_message}`));
    card.appendChild(meta);
    if (model.endpoint.length > 0) card.appendChild(el('div', 'model-card-endpoint', model.endpoint));
    const actions = el('div', 'models-card-actions');
    const active = state === 'RUNNING' || state === 'READY' || state === 'STARTING';
    if (active) actions.appendChild(button(state === 'STARTING' ? 'STARTING…' : 'STOP MODEL', () => stopModel(model.id, model.name), pending || state === 'STARTING', 'models-action'));
    else actions.appendChild(button('START MODEL', () => startModel(model.id, model.name), pending || model.runtime_available !== true || model.artifact_available !== true, 'models-action models-action-primary'));
    if (modelIsVerifiedReady(state)) actions.appendChild(button('TEST MODEL', () => testModel(model.id, model.name), pending, 'models-action models-action-quiet'));
    card.appendChild(actions);
    if (modelIsVerifiedReady(state)) {
      const roleBox = el('div', 'models-role-box');
      roleBox.appendChild(el('div', 'models-role-title', 'USE THIS MODEL AS · OPERATOR ASSIGNMENT'));
      const current = roleSelections.get(model.id) ?? route?.roles.filter(role => ['planner', 'coder', 'reviewer'].includes(role)) ?? [];
      roleSelections.set(model.id, current);
      const checks = el('div', 'models-role-checks');
      for (const role of ['planner', 'coder', 'reviewer']) {
        const label = document.createElement('label');
        label.className = 'models-role-check';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = current.includes(role);
        checkbox.addEventListener('change', () => {
          const next = new Set(roleSelections.get(model.id) ?? []);
          if (checkbox.checked) next.add(role); else next.delete(role);
          roleSelections.set(model.id, [...next]);
        });
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(role.toUpperCase()));
        checks.appendChild(label);
      }
      roleBox.appendChild(checks);
      roleBox.appendChild(button('ASSIGN ROLES', () => assignRoles(model.id, model.name), pending || (roleSelections.get(model.id) ?? []).length === 0, 'models-action models-action-primary'));
      roleBox.appendChild(el('div', 'models-role-note', 'Resident chat remains available through the existing chat route.'));
      card.appendChild(roleBox);
    }
    const test = testResults.get(model.id);
    if (test !== undefined) card.appendChild(el('div', `models-test-result ${test.startsWith('PASS') ? 'ok-text' : 'warn-text'}`, `MODEL_TEST_INFERENCE · ${test}`));
    return card;
  }

  function render(): void {
    if (!alive) return;
    body.innerHTML = '';
    jobsMount = null;
    const runtimeRow = el('div', 'models-runtime');
    runtimeRow.appendChild(el('span', 'models-runtime-label', 'LOCAL RUNTIME'));
    runtimeRow.appendChild(el('span', `models-runtime-dot ${status.runtime ? 'ok' : 'err'}`));
    runtimeRow.appendChild(el('span', 'models-runtime-value', status.runtime ? 'llama-server available' : 'unavailable'));
    if (hardware !== null) runtimeRow.appendChild(el('span', 'models-runtime-value', `RAM ${formatBytes(hardware.freeRamBytes)} FREE · ${hardware.backend.toUpperCase()}`));
    body.appendChild(runtimeRow);

    const routeById = routeMap();
    const readyCount = status.models.filter(model => modelIsActive(modelDisplayState(model, routeById.get(`local:${model.id}`)?.status))).length;
    const hasUsableArtifact = status.models.some(model => model.runtime_available === true && model.artifact_available === true);
    if (readyCount === 0 && !hasUsableArtifact) {
      const empty = el('section', 'models-empty models-empty-setup');
      empty.appendChild(el('strong', 'models-empty-title', 'NO LOCAL MODELS READY'));
      empty.appendChild(el('span', 'models-empty-detail', status.models.length > 0
        ? 'The model registry is present, but no local artifact is available or runnable yet. Start with the governed path: search Hugging Face for a compatible GGUF, choose one artifact, download it, verify its manifest, register it, and prove READY.'
        : 'Start with the governed local path: search Hugging Face for a compatible GGUF, choose one artifact, download it, verify its manifest, register it, and prove READY.'));
      empty.appendChild(button(findOpen ? 'FIND MODEL OPEN' : 'FIND A MODEL', () => { findOpen = true; render(); }, false, 'models-action models-action-primary'));
      body.appendChild(empty);
    }
    const counts = el('div', 'models-counts');
    counts.appendChild(el('span', 'models-counts-value', `${readyCount} ACTIVE · ${status.models.length} REGISTERED`));
    body.appendChild(counts);
    if (findOpen) body.appendChild(renderDiscovery());

    if (status.models.length > 0) {
      body.appendChild(el('div', 'models-section-header', 'MODEL INVENTORY · REAL RUNTIME STATE'));
      const list = el('div', 'models-list');
      for (const model of status.models) list.appendChild(renderModelCard(model, routeById));
      body.appendChild(list);
    }
    if (routes.routes.length > 0) {
      body.appendChild(el('div', 'models-section-header', 'MODEL ROUTES · RESIDENT / ROLE EVIDENCE'));
      const routeTable = el('div', 'route-list');
      for (const route of routes.routes) {
        const row = el('div', `route-row ${statusClass(route.status.toUpperCase())}`);
        row.appendChild(el('span', 'route-id', route.id));
        row.appendChild(el('span', 'route-name', route.displayName));
        row.appendChild(el('span', 'route-provider-type', route.providerType));
        row.appendChild(el('span', 'route-roles', `roles: ${route.roles.join(', ') || '—'}`));
        row.appendChild(el('span', `route-status ${statusClass(route.status.toUpperCase())}`, route.status.toUpperCase()));
        routeTable.appendChild(row);
      }
      body.appendChild(routeTable);
    }
    if (jobsMount === null) {
      jobsMount = el('div', 'models-download-jobs');
      body.appendChild(jobsMount);
    }
    renderJobs();
  }

  void (async () => {
    await refreshState();
    await refreshJobs();
  })();
  const stateInterval = window.setInterval(() => { void refreshState(); }, 8000);
  const jobsInterval = window.setInterval(() => { void refreshJobs(); }, 1500);

  return {
    dispose(): void {
      alive = false;
      window.clearInterval(stateInterval);
      window.clearInterval(jobsInterval);
      parent.innerHTML = '';
    }
  };
}
