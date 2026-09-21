/// <reference lib="dom" />
/// <reference lib="webworker" />

import { api } from '../services/api.ts';
import type { ChatMessageT } from '../../../common/contracts/chat.ts';
import type { RouteEntryT } from '../../../common/contracts/routing.ts';

export interface ChatPanelOptions {
  onToast?: (code: string, message: string) => void;
  onSetupModel?: () => void;
}

export interface ChatPanel {
  refreshModels(): Promise<void>;
}

const STATUS_ORDER: Record<string, number> = { ready: 0, starting: 1, unverified: 2, down: 3 };

function routeLabel(route: RouteEntryT): string {
  const status = ` · ${route.status.toUpperCase()}`;
  return `${route.displayName} · ${route.providerType}${status}`;
}

export function createChatPanel(container: HTMLElement, opts: ChatPanelOptions = {}): ChatPanel {
  container.innerHTML = `
    <div class="chat-panel">
      <div class="chat-toolbar">
        <label class="chat-model-label" for="chat-model">Model</label>
        <select id="chat-model" class="chat-model-select"></select>
        <button type="button" class="cockpit-mode chat-refresh" aria-label="Refresh model routes">Refresh</button>
        <span id="chat-meter" class="chat-meter"></span>
      </div>
      <div id="chat-banner" class="chat-banner"></div>
      <div class="chat-messages" id="chat-messages"></div>
      <div class="chat-input-row">
        <textarea id="chat-input" class="chat-input" aria-label="Message to selected model" rows="2" placeholder="Message Resident’s selected model…"></textarea>
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
  const refreshButton = container.querySelector<HTMLButtonElement>('.chat-refresh')!;

  let routes: RouteEntryT[] = [];
  let boundModelId = '';
  let conversationId: string | undefined;
  let history: ChatMessageT[] = [];
  let streaming = false;
  let controller: AbortController | null = null;
  sendButton.disabled = true;

  function orderedRoutes(): RouteEntryT[] {
    return [...routes].sort((a, b) => STATUS_ORDER[a.status]! - STATUS_ORDER[b.status]! || a.displayName.localeCompare(b.displayName));
  }

  function routeById(id: string): RouteEntryT | undefined {
    return routes.find(route => route.id === id);
  }

  function selectedRouteIsReady(): boolean {
    return routeById(boundModelId)?.status === 'ready';
  }

  function syncInputState(): void {
    sendButton.disabled = streaming || !selectedRouteIsReady() || input.value.trim().length === 0;
    modelSelect.disabled = streaming || orderedRoutes().every(route => route.status !== 'ready');
  }

  async function refreshModels(): Promise<void> {
    refreshButton.disabled = true;
    try {
      routes = (await api.routes()).routes;
      const current = boundModelId;
      modelSelect.textContent = '';
      for (const route of orderedRoutes()) {
        const option = document.createElement('option');
        option.value = route.id;
        option.textContent = routeLabel(route);
        option.disabled = route.status !== 'ready';
        modelSelect.appendChild(option);
      }
      const readyRoutes = orderedRoutes().filter(route => route.status === 'ready');
      const localReady = readyRoutes.find(route => route.providerType === 'local');
      const preferred = localReady ?? readyRoutes[0];
      if (current.length > 0 && routeById(current)?.status === 'ready') {
        modelSelect.value = current;
      } else {
        modelSelect.value = preferred?.id ?? '';
      }
      boundModelId = modelSelect.value;
      syncInputState();
      if (preferred === undefined) {
        showSetupBanner(routes.length === 0
          ? 'No model route is available yet. Set up a local model before using Resident.'
          : 'No local model is ready yet. Set one up in Models; Resident will refresh automatically when READY is proven.');
      } else if (localReady === undefined) {
        showBanner(`No local model is ready yet. Resident is using ${preferred.displayName} through the available remote route.`);
      } else hideBanner();
      void refreshMeter();
    } catch {
      showSetupBanner('Model routes are unavailable. Open Models to inspect local runtime and artifact state.');
      boundModelId = '';
      syncInputState();
    } finally {
      refreshButton.disabled = streaming;
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

  function restoreBinding(storedModelId: string): void {
    const candidates = [storedModelId, `local:${storedModelId}`];
    let route = candidates.map(routeById).find(entry => entry?.status === 'ready');
    if (route === undefined) route = orderedRoutes().find(entry => entry.status === 'ready');
    if (route !== undefined) {
      boundModelId = route.id;
      modelSelect.value = route.id;
    }
  }

  async function restoreLatest(): Promise<void> {
    try {
      const payload = await api.chatHistory();
      const latest = payload.conversations[0];
      if (latest !== undefined) {
        conversationId = latest.id;
        history = latest.messages;
        restoreBinding(latest.modelId);
        renderAll();
      }
    } catch {
      showBanner('Previous conversation unavailable. This conversation starts locally; continuity is not confirmed.');
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
    syncInputState();
    modelSelect.disabled = value;
    refreshButton.disabled = value;
    input.disabled = value;
    stopButton.classList.toggle('hidden', !value);
  }

  function showBanner(text: string): void {
    banner.replaceChildren(document.createTextNode(text));
    banner.classList.add('visible');
  }

  function showSetupBanner(text: string): void {
    banner.textContent = '';
    banner.appendChild(document.createTextNode(text));
    if (opts.onSetupModel !== undefined) {
      const setup = document.createElement('button');
      setup.type = 'button';
      setup.className = 'chat-setup-button';
      setup.textContent = 'SET UP A MODEL';
      setup.addEventListener('click', opts.onSetupModel);
      banner.appendChild(setup);
    }
    banner.classList.add('visible');
  }

  function hideBanner(): void {
    banner.textContent = '';
    banner.classList.remove('visible');
  }

  async function persistConversation(): Promise<void> {
    if (history.length === 0) return;
    try {
      const title = history.find(message => message.role === 'user')?.content.slice(0, 60) ?? 'conversation';
      const request: { id?: string; modelId: string; title: string; messages: ChatMessageT[] } = {
        modelId: boundModelId,
        title,
        messages: history
      };
      if (conversationId !== undefined) request.id = conversationId;
      const saved = await api.chatHistorySave(request);
      conversationId = saved.id;
    } catch {
      showBanner('Conversation was not saved. Keep this tab open; durable continuity is not confirmed.');
    }
  }

  async function send(): Promise<void> {
    const content = input.value.trim();
    if (content.length === 0 && history[history.length - 1]?.role !== 'user') return;
    if (streaming || boundModelId.length === 0) return;
    hideBanner();
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
      renderAll();
      void persistConversation();
      void refreshMeter();
    }
  }

  modelSelect.addEventListener('change', () => {
    const previous = boundModelId;
    const next = modelSelect.value;
    if (next === previous) return;
    const from = routeById(previous);
    const to = routeById(next);
    if (to?.status !== 'ready') {
      modelSelect.value = previous;
      return;
    }
    boundModelId = next;
    if (from !== undefined && to !== undefined && to.contextLength < from.contextLength) {
      showBanner(`switching from ${from.displayName} (${from.contextLength} ctx) to ${to.displayName} (${to.contextLength} ctx) — the most recent turns will be kept, older ones are not sent`);
    }
    void refreshMeter();
  });

  sendButton.addEventListener('click', () => void send());
  input.addEventListener('input', syncInputState);
  refreshButton.addEventListener('click', () => { void refreshModels(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  });
  stopButton.addEventListener('click', () => {
    controller?.abort();
  });

  void refreshModels().then(() => restoreLatest());

  return { refreshModels };
}
