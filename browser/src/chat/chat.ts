/// <reference lib="dom" />
/// <reference lib="webworker" />

import { api } from '../services/api.ts';
import type { ChatMessageT } from '../../../common/contracts/chat.ts';
import type { RoleTargetT } from '../../../common/contracts/byok.ts';
import type { RouteEntryT } from '../../../common/contracts/routing.ts';
import { MODEL_ACCESS_CHANGED_EVENT } from '../services/model-access-events.ts';
import { initialConversationRouteId, restoreConversationRouteId } from './model-selection.ts';

export interface ChatPanelOptions {
  onToast?: (code: string, message: string) => void;
}

export interface ChatPanel {
  refreshModels(): Promise<void>;
  dispose(): void;
}

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
        <label class="chat-model-label" for="chat-model">Conversation model</label>
        <select id="chat-model" class="chat-model-select" aria-label="Conversation model"></select>
        <span class="chat-model-scope">Saved with this conversation; it does not change project role defaults.</span>
        <span id="chat-meter" class="chat-meter"></span>
      </div>
      <div id="chat-banner" class="chat-banner"></div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-row">
        <textarea id="chat-input" class="chat-input" rows="2" placeholder="Ask the model…"></textarea>
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
  if (modelSelectEl === null || messagesEl === null || inputEl === null || sendBtnEl === null || stopBtnEl === null || bannerEl === null || meterEl === null) throw new Error('chat panel mount failed');
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
        boundModelId = restoreConversationRouteId(latest.modelId, routes);
      } else {
        let actTarget: RoleTargetT = 'local';
        try { actTarget = (await api.connections()).routed_roles.coder; }
        catch { /* the safe default remains local */ }
        boundModelId = initialConversationRouteId(orderedRoutes(), actTarget);
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
    for (const message of history) {
      const row = document.createElement('div');
      row.className = `chat-message ${message.role}`;
      const labelRow = document.createElement('div');
      labelRow.className = 'chat-message-label-row';
      const label = document.createElement('div');
      label.className = 'chat-message-label';
      label.textContent = message.role === 'user' ? 'you' : routeById(boundModelId)?.displayName ?? 'assistant';
      labelRow.appendChild(label);
      if (message.role === 'assistant') {
        const reask = document.createElement('button');
        reask.type = 'button';
        reask.className = 'chat-reask';
        reask.textContent = 're-ask';
        reask.title = `Re-ask this turn with ${routeById(boundModelId)?.displayName ?? 'the current model'}`;
        reask.disabled = streaming;
        reask.addEventListener('click', () => {
          if (streaming) return;
          const index = history.indexOf(message);
          if (index >= 0) {
            history.splice(index);
            renderAll();
            void send();
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
    sendButton.disabled = value;
    modelSelect.disabled = value;
    stopButton.classList.toggle('hidden', !value);
  }

  function showBanner(text: string): void {
    banner.textContent = text;
    banner.classList.add('visible');
  }

  function hideBanner(): void {
    banner.textContent = '';
    banner.classList.remove('visible');
  }

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
      history.push({ role: 'user', content });
    }
    history.push({ role: 'assistant', content: '' });
    renderAll();
    setStreaming(true);
    const assistant = history[history.length - 1]!;
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
        history.pop();
        opts.onToast?.('NOT_READY', 'the model returned an empty response');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (assistant.content.length === 0) history.pop();
        else assistant.content += '\n[stopped]';
      } else {
        history.pop();
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
    dispose() {
      window.removeEventListener(MODEL_ACCESS_CHANGED_EVENT, refreshAfterModelAccessChange);
      controller?.abort();
    }
  };
}
