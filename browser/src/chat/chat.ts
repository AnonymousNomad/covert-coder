/// <reference lib="dom" />
/// <reference lib="webworker" />

import { api } from '../services/api.ts';
import type { ChatMessageT } from '../../../common/contracts/chat.ts';
import type { RoleTargetT } from '../../../common/contracts/byok.ts';
import type { RouteEntryT } from '../../../common/contracts/routing.ts';
import type { AgentStreamEventT } from '../../../common/contracts/agent.ts';
import { MODEL_ACCESS_CHANGED_EVENT } from '../services/model-access-events.ts';
import { initialConversationRouteId, restoreConversationRouteId } from './model-selection.ts';
import { DEFAULT_CIPHER_MODE, resolveCipherDispatch, type CipherMode } from '../cockpit/interaction-mode.ts';

export interface ChatPanelOptions {
  onToast?: (code: string, message: string) => void;
  onGovernedSubmit?: (mode: 'plan' | 'act', task: string) => Promise<void> | void;
  governedStatus?: HTMLElement;
}

export interface ChatPanel {
  refreshModels(): Promise<void>;
  appendAgentEvent(event: AgentStreamEventT): void;
  submitGoverned(mode: 'plan' | 'act', task: string): Promise<void>;
  setGovernedAvailable(available: boolean): void;
  dispose(): void;
}

type TimelineEntry =
  | { kind: 'chat'; message: ChatMessageT }
  | { kind: 'governed-prompt'; mode: 'plan' | 'act'; content: string }
  | { kind: 'agent-event'; event: AgentStreamEventT; label: string; content: string };

const STATUS_ORDER: Record<string, number> = { ready: 0, starting: 1, unverified: 2, down: 3 };

function routeLabel(route: RouteEntryT): string {
  const status = route.status === 'ready' ? 'READY'
    : route.status === 'starting' ? 'STARTING'
      : route.status === 'down' ? 'UNAVAILABLE' : 'UNVERIFIED';
  return `${route.displayName} · ${route.providerType} · ${status}`;
}

export function createChatPanel(container: HTMLElement, opts: ChatPanelOptions = {}): ChatPanel {
  container.innerHTML = `
    <div class="chat-panel">
      <div class="chat-toolbar">
        <div class="chat-mode-switch" role="group" aria-label="Cipher interaction mode">
          <button type="button" class="chat-mode-button" data-mode="ask" aria-pressed="true">ASK</button>
          <button type="button" class="chat-mode-button" data-mode="plan" aria-pressed="false">PLAN</button>
          <button type="button" class="chat-mode-button" data-mode="act" aria-pressed="false">ACT</button>
        </div>
        <span class="chat-mode-description" aria-live="polite"></span>
        <div class="chat-model-binding">
          <label class="chat-model-label" for="chat-model">Conversation model</label>
          <select id="chat-model" class="chat-model-select" aria-label="Conversation model"></select>
          <span class="chat-model-scope">Saved with this conversation; it does not change project role defaults.</span>
        </div>
        <span id="chat-meter" class="chat-meter"></span>
      </div>
      <div id="chat-banner" class="chat-banner"></div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-governed-status" data-chat-governed-status></div>
      <div class="chat-input-row">
        <textarea id="chat-input" class="chat-input" rows="2" placeholder="Ask Cipher…"></textarea>
        <button type="button" id="chat-send" class="chat-send">Send</button>
        <button type="button" id="chat-stop" class="chat-stop hidden">Stop</button>
      </div>
    </div>
  `;
  const modelSelectEl = container.querySelector<HTMLSelectElement>('#chat-model');
  const messagesEl = container.querySelector<HTMLElement>('#chat-messages');
  const inputEl = container.querySelector<HTMLTextAreaElement>('#chat-input');
  const sendBtnEl = container.querySelector<HTMLButtonElement>('#chat-send');
  const stopBtnEl = container.querySelector<HTMLButtonElement>('#chat-stop');
  const bannerEl = container.querySelector<HTMLElement>('#chat-banner');
  const meterEl = container.querySelector<HTMLElement>('#chat-meter');
  const modeButtons = [...container.querySelectorAll<HTMLButtonElement>('.chat-mode-button')];
  const modeDescription = container.querySelector<HTMLElement>('.chat-mode-description');
  const modelBinding = container.querySelector<HTMLElement>('.chat-model-binding');
  const governedStatusSlot = container.querySelector<HTMLElement>('[data-chat-governed-status]');
  if (modelSelectEl === null || messagesEl === null || inputEl === null || sendBtnEl === null || stopBtnEl === null || bannerEl === null || meterEl === null || modeDescription === null || modelBinding === null || governedStatusSlot === null || modeButtons.length !== 3) throw new Error('chat panel mount failed');
  const modelSelect: HTMLSelectElement = modelSelectEl;
  const messages: HTMLElement = messagesEl;
  const input: HTMLTextAreaElement = inputEl;
  const sendButton: HTMLButtonElement = sendBtnEl;
  const stopButton: HTMLButtonElement = stopBtnEl;
  const banner: HTMLElement = bannerEl;
  const meter: HTMLElement = meterEl;

  let routes: RouteEntryT[] = [];
  let boundModelId = '';
  let conversationId: string | undefined;
  let history: ChatMessageT[] = [];
  let timeline: TimelineEntry[] = [];
  let mode: CipherMode = DEFAULT_CIPHER_MODE;
  let governedAvailable = true;
  let governedSubmitting = false;
  let streaming = false;
  let controller: AbortController | null = null;
  let persistenceQueue: Promise<void> = Promise.resolve();
  let initialized = false;
  let initializing: Promise<void> | null = null;

  function orderedRoutes(): RouteEntryT[] {
    return [...routes].sort((a, b) => STATUS_ORDER[a.status]! - STATUS_ORDER[b.status]! || a.displayName.localeCompare(b.displayName));
  }

  function routeById(id: string): RouteEntryT | undefined {
    return routes.find(route => route.id === id);
  }

  function renderModelOptions(): void {
    modelSelect.textContent = '';
    for (const route of orderedRoutes()) {
      const option = document.createElement('option');
      option.value = route.id;
      option.textContent = routeLabel(route);
      option.disabled = (route.status === 'down' || route.status === 'starting') && route.id !== boundModelId;
      modelSelect.appendChild(option);
    }
    if (boundModelId.length > 0 && routeById(boundModelId) === undefined) {
      const missing = document.createElement('option');
      missing.value = boundModelId;
      missing.textContent = `Unavailable saved target · ${boundModelId}`;
      missing.disabled = true;
      modelSelect.appendChild(missing);
    }
    if (boundModelId.length === 0) {
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'No available default — choose a model';
      empty.disabled = true;
      empty.selected = true;
      modelSelect.appendChild(empty);
    }
    modelSelect.value = boundModelId;
  }

  async function initialize(): Promise<void> {
    if (initialized) return;
    if (initializing !== null) return initializing;
    initializing = (async () => {
      try { routes = (await api.routes()).routes; }
      catch { routes = []; }

      let latest: Awaited<ReturnType<typeof api.chatHistory>>['conversations'][number] | undefined;
      try { latest = (await api.chatHistory()).conversations[0]; }
      catch { /* start a new conversation without restoring a binding */ }

      if (latest !== undefined) {
        conversationId = latest.id;
        history = latest.messages;
        timeline = [...history.map(message => ({ kind: 'chat' as const, message })), ...timeline.filter(entry => entry.kind !== 'chat')];
        boundModelId = restoreConversationRouteId(latest.modelId, routes);
      } else {
        let actTarget: RoleTargetT = 'local';
        try { actTarget = (await api.connections()).routed_roles.coder; }
        catch { /* the safe default remains local */ }
        boundModelId = initialConversationRouteId(orderedRoutes(), actTarget);
        timeline = timeline.filter(entry => entry.kind !== 'chat');
      }

      initialized = true;
      renderModelOptions();
      renderAll();
      void refreshMeter();
    })();
    await initializing;
  }

  async function refreshModels(): Promise<void> {
    if (!initialized) await initialize();
    try {
      routes = (await api.routes()).routes;
      renderModelOptions();
      void refreshMeter();
    } catch {
      // Keep the existing exact binding when routes are temporarily unavailable.
    }
  }

  async function refreshMeter(): Promise<void> {
    const route = routeById(boundModelId);
    if (route === undefined || history.length === 0) {
      meter.textContent = '';
      return;
    }
    try {
      const fit = await api.fit(history, route.contextLength);
      meter.textContent = `~${fit.estimatedTokens} of ${route.contextLength} tokens (approx)`;
    } catch {
      meter.textContent = '';
    }
  }

  function renderAll(): void {
    messages.textContent = '';
    for (const entry of timeline) {
      if (entry.kind === 'agent-event') {
        const row = document.createElement('article');
        row.className = 'chat-timeline-event';
        row.dataset.event = entry.event.event;
        const label = document.createElement('div');
        label.className = 'chat-message-label';
        label.textContent = entry.label;
        const body = document.createElement('div');
        body.className = 'chat-message-body';
        body.textContent = entry.content;
        row.append(label, body);
        messages.appendChild(row);
        continue;
      }
      const message = entry.kind === 'chat' ? entry.message : { role: 'user' as const, content: entry.content };
      const row = document.createElement('div');
      row.className = `chat-message ${message.role}`;
      const labelRow = document.createElement('div');
      labelRow.className = 'chat-message-label-row';
      const label = document.createElement('div');
      label.className = 'chat-message-label';
      label.textContent = entry.kind === 'governed-prompt' ? `you · ${entry.mode.toUpperCase()}`
        : message.role === 'user' ? 'you' : routeById(boundModelId)?.displayName ?? 'assistant';
      labelRow.appendChild(label);
      if (entry.kind === 'chat' && message.role === 'assistant') {
        const reask = document.createElement('button');
        reask.type = 'button';
        reask.className = 'chat-reask';
        reask.textContent = 're-ask';
        reask.title = `Re-ask this turn with ${routeById(boundModelId)?.displayName ?? 'the current model'}`;
        reask.disabled = streaming;
        reask.addEventListener('click', () => {
          if (streaming) return;
          const route = routeById(boundModelId);
          if (!route || route.status === 'down' || route.status === 'starting') { showBanner('The pinned conversation route is unavailable; the previous answer is retained.'); return; }
          const index = history.indexOf(message);
          if (index >= 0) {
            const entryIndex = timeline.findIndex(candidate => candidate.kind === 'chat' && candidate.message === message);
            if (entryIndex < 0 || timeline.slice(entryIndex + 1).some(candidate => candidate.kind !== 'chat')) return;
            history.splice(index);
            timeline.splice(entryIndex);
            renderAll();
            void sendAsk('');
          }
        });
        labelRow.appendChild(reask);
      }
      const body = document.createElement('div');
      body.className = 'chat-message-body';
      body.textContent = message.content;
      row.appendChild(labelRow);
      row.appendChild(body);
      messages.appendChild(row);
    }
    messages.scrollTop = messages.scrollHeight;
  }

  function setStreaming(value: boolean): void {
    streaming = value;
    modelSelect.disabled = value;
    stopButton.classList.toggle('hidden', !value);
    renderMode();
  }

  function renderMode(): void {
    for (const button of modeButtons) {
      const selected = button.dataset.mode === mode;
      button.setAttribute('aria-pressed', String(selected));
      button.disabled = !governedAvailable && button.dataset.mode !== 'ask';
    }
    const dispatch = resolveCipherDispatch(mode);
    modeDescription!.textContent = dispatch.path === 'chat'
      ? 'ASK · direct conversation with this conversation’s pinned model.'
      : dispatch.mode === 'plan'
        ? 'PLAN · governed AgentLoop using the exact Planner role; read-only planning.'
        : 'ACT · governed AgentLoop using the exact Coder role; Authority controls each protected operation.';
    modelBinding!.hidden = dispatch.path !== 'chat';
    sendButton.textContent = dispatch.path === 'chat' ? 'Send' : `Start ${dispatch.mode.toUpperCase()}`;
    input.placeholder = dispatch.path === 'chat' ? 'Ask Cipher…' : `Describe a ${dispatch.mode.toUpperCase()} request for Cipher…`;
    sendButton.disabled = streaming || (dispatch.path === 'agent' && (!governedAvailable || governedSubmitting));
  }

  function selectMode(next: CipherMode): void {
    if ((!governedAvailable && next !== 'ask') || !modeButtons.some(button => button.dataset.mode === next)) return;
    mode = next;
    renderMode();
  }

  function showBanner(text: string): void {
    banner.textContent = text;
    banner.classList.add('visible');
  }

  function hideBanner(): void {
    banner.textContent = '';
    banner.classList.remove('visible');
  }

  function agentEventText(event: AgentStreamEventT): { label: string; content: string } {
    switch (event.event) {
      case 'message': return { label: 'CIPHER · RESPONSE', content: event.text };
      case 'plan': return { label: `CIPHER · PLAN ${event.cycle}/${event.max_cycles}`, content: event.plan };
      case 'tool_call': return { label: 'AGENTLOOP · TOOL REQUEST', content: `${event.tool} · approval and execution follow canonical Authority policy.` };
      case 'tool_result': return { label: `AGENTLOOP · TOOL RESULT · ${event.ok ? 'OK' : 'FAILED'}`, content: `${event.tool}\n${event.output}` };
      case 'file_mutation': return { label: 'WORKSPACE · MUTATION EVENT', content: `${event.outcome.toUpperCase()} · ${event.paths.length} path(s); editor state is reconciled through the existing workspace event path.` };
      case 'awaiting_approval': return { label: 'AUTHORITY · OPERATOR DECISION REQUIRED', content: `Approval requested for ${event.approval.tool}. Use the decision controls below.` };
      case 'context': return { label: `CONTEXT · ${event.source.toUpperCase()}`, content: `${event.status.toUpperCase()}${event.error ? ` · ${event.error}` : ''}` };
      case 'verification': return { label: 'VERIFICATION · RESULT', content: `${event.status.toUpperCase()} · ${event.passed ? 'passed' : 'not passed'}` };
      case 'worker_lifecycle': return {
        label: `WORKER · ${event.state}`,
        content: `${event.model_id} · ${event.route_id} · project ${event.project_id} · checkout ${event.checkout_id}${event.detail ? `\n${event.detail}` : ''}`
      };
      case 'done': return { label: 'AGENTLOOP · COMPLETE', content: event.summary };
      case 'error': return { label: 'AGENTLOOP · ERROR', content: event.error };
      case 'aborted': return { label: 'AGENTLOOP · STOPPED', content: 'The governed task was aborted.' };
    }
  }

  function appendAgentEvent(event: AgentStreamEventT): void {
    timeline.push({ kind: 'agent-event', event, ...agentEventText(event) });
    renderAll();
  }

  async function submitGoverned(nextMode: 'plan' | 'act', task: string): Promise<void> {
    const content = task.trim();
    if (content.length === 0) return;
    if (streaming) {
      showBanner('Finish or stop the current ASK response before starting a governed task.');
      return;
    }
    if (!governedAvailable || governedSubmitting) {
      showBanner('A governed Cipher task is already active or unavailable. The existing task remains the source of status.');
      return;
    }
    const dispatch = resolveCipherDispatch(nextMode);
    if (dispatch.path !== 'agent') throw new Error('governed mode dispatch contract is invalid');
    selectMode(nextMode);
    timeline.push({ kind: 'governed-prompt', mode: dispatch.mode, content });
    renderAll();
    input.value = '';
    governedSubmitting = true;
    renderMode();
    try {
      if (opts.onGovernedSubmit === undefined) throw new Error('governed interaction path is unavailable');
      await opts.onGovernedSubmit(dispatch.mode, content);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'governed request failed';
      showBanner(detail);
      opts.onToast?.('INTERNAL', detail);
    } finally {
      governedSubmitting = false;
      renderMode();
    }
  }

  function setGovernedAvailable(available: boolean): void {
    governedAvailable = available;
    renderMode();
  }

  if (opts.governedStatus !== undefined) governedStatusSlot.appendChild(opts.governedStatus);

  function persistConversation(): Promise<void> {
    if (history.length === 0) return Promise.resolve();
    const modelId = boundModelId;
    const messages = history.map(message => ({ ...message }));
    const title = messages.find(message => message.role === 'user')?.content.slice(0, 60) ?? 'conversation';
    persistenceQueue = persistenceQueue.then(async () => {
      try {
        const request: { id?: string; modelId: string; title: string; messages: ChatMessageT[] } = {
          modelId,
          title,
          messages
        };
        if (conversationId !== undefined) request.id = conversationId;
        const saved = await api.chatHistorySave(request);
        conversationId = saved.id;
      } catch {
        // persistence is best-effort
      }
    });
    return persistenceQueue;
  }

  async function send(): Promise<void> {
    const content = input.value.trim();
    const dispatch = resolveCipherDispatch(mode);
    if (dispatch.path === 'agent') {
      await submitGoverned(dispatch.mode, content);
      return;
    }
    await sendAsk(content);
  }

  function removeChatMessage(message: ChatMessageT): void {
    const historyIndex = history.indexOf(message);
    if (historyIndex >= 0) history.splice(historyIndex, 1);
    const timelineIndex = timeline.findIndex(entry => entry.kind === 'chat' && entry.message === message);
    if (timelineIndex >= 0) timeline.splice(timelineIndex, 1);
  }

  async function sendAsk(content: string): Promise<void> {
    if (content.length === 0 && history[history.length - 1]?.role !== 'user') return;
    if (streaming) return;
    if (boundModelId.length === 0) {
      const detail = 'no model route is available; choose an available conversation model first';
      showBanner(detail);
      opts.onToast?.('NOT_READY', detail);
      return;
    }
    const selectedRoute = routeById(boundModelId);
    if (selectedRoute === undefined || selectedRoute.status === 'down' || selectedRoute.status === 'starting') {
      const detail = selectedRoute === undefined
        ? 'the saved model route is unavailable; choose a current route in this conversation'
        : `the selected route is ${selectedRoute.status}; choose a route that is available before sending`;
      showBanner(detail);
      opts.onToast?.('NOT_READY', detail);
      return;
    }
    if (content.length > 0) {
      input.value = '';
      const userMessage: ChatMessageT = { role: 'user', content };
      history.push(userMessage);
      timeline.push({ kind: 'chat', message: userMessage });
    }
    const assistant: ChatMessageT = { role: 'assistant', content: '' };
    history.push(assistant);
    timeline.push({ kind: 'chat', message: assistant });
    renderAll();
    setStreaming(true);
    const modelId = boundModelId;
    controller = new AbortController();
    try {
      const response = await api.chatStream(modelId, history, controller.signal);
      if (response.body === null) throw new Error('daemon returned no stream');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (raw.length === 0) continue;
          try {
            const payload = JSON.parse(raw) as { delta?: string; done?: boolean; error?: string; modelId?: string; usedApprox?: number; dropped?: number; truncatedSystem?: boolean };
            if (payload.error !== undefined) {
              opts.onToast?.('INTERNAL', `model: ${payload.error}`);
            } else if (payload.delta !== undefined) {
              assistant.content += payload.delta;
              renderAll();
            } else if (payload.done === true) {
              const used = payload.usedApprox;
              const dropped = payload.dropped;
              const truncated = payload.truncatedSystem === true;
              const route = routeById(payload.modelId ?? boundModelId);
              if (used !== undefined && route !== undefined) {
                meter.textContent = `~${used} of ${route.contextLength} tokens (approx)`;
              }
              if (payload.modelId !== undefined && payload.modelId !== modelId) {
                const fellTo = routeById(payload.modelId);
                const fellFrom = routeById(modelId);
                showBanner(`${fellFrom?.displayName ?? modelId} is down — this answer came from ${fellTo?.displayName ?? payload.modelId}`);
              }
              if (truncated) {
                opts.onToast?.('INTERNAL', 'model: the system prompt did not fit the model context and was truncated');
              } else if (dropped !== undefined && dropped > 0) {
                showBanner(`the model window fits the most recent turns; ${dropped} older turn(s) were not sent to ${route?.displayName ?? 'the model'}`);
              }
            }
          } catch {
            // skip malformed events
          }
        }
      }
      if (assistant.content.length === 0) {
        removeChatMessage(assistant);
        opts.onToast?.('NOT_READY', 'the model returned an empty response');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (assistant.content.length === 0) removeChatMessage(assistant);
        else assistant.content += '\n[stopped]';
      } else {
        removeChatMessage(assistant);
        opts.onToast?.('INTERNAL', error instanceof Error ? error.message : 'chat failed');
      }
    } finally {
      setStreaming(false);
      controller = null;
      hideBanner();
      renderAll();
      void persistConversation();
      void refreshMeter();
    }
  }

  modelSelect.addEventListener('change', () => {
    const previous = boundModelId;
    const next = modelSelect.value;
    if (next.length === 0 || next === previous) return;
    const from = routeById(previous);
    const to = routeById(next);
    boundModelId = next;
    if (from !== undefined && to !== undefined && to.contextLength < from.contextLength) {
      showBanner(`switching from ${from.displayName} (${from.contextLength} ctx) to ${to.displayName} (${to.contextLength} ctx) — the most recent turns will be kept, older ones are not sent`);
    }
    void refreshMeter();
    void persistConversation();
  });

  const refreshAfterModelAccessChange = (): void => { void refreshModels(); };
  window.addEventListener(MODEL_ACCESS_CHANGED_EVENT, refreshAfterModelAccessChange);

  for (const button of modeButtons) {
    button.addEventListener('click', () => {
      const requested = button.dataset.mode;
      if (requested === 'ask' || requested === 'plan' || requested === 'act') selectMode(requested);
    });
  }
  renderMode();
  sendButton.addEventListener('click', () => void send());
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  });
  stopButton.addEventListener('click', () => {
    controller?.abort();
  });

  void initialize();

  return {
    refreshModels,
    appendAgentEvent,
    submitGoverned,
    setGovernedAvailable,
    dispose() {
      window.removeEventListener(MODEL_ACCESS_CHANGED_EVENT, refreshAfterModelAccessChange);
      controller?.abort();
    }
  };
}
