// Unified Provider Connections panel. One canonical, evidence-only read over
// subscription runtimes, API-key providers, the local runtime, and catalog
// access. States come purely from daemon evidence: a stored key or installed
// CLI is surfaced as configured/available, NEVER as a live connection unless a
// probe actually succeeded. Mutations (preference, HF token, test, sign-in)
// run through the same exact-operation authority surface as every other write.

import { api, ApiError } from '../services/api.ts';
import type {
  ConnectionsViewResponseT,
  ProviderConnectionT,
  RoutingPreferenceT,
  ConnectionStatusT
} from '../../../common/contracts/connections.ts';

export interface ConnectionsPanelOptions {
  onToast: (code: string, message: string) => void;
}

export interface ConnectionsPanel {
  refresh(): Promise<void>;
}

const ROLES = ['plan', 'act', 'utility'] as const;
type Role = (typeof ROLES)[number];

const STATUS_LABELS: Record<ConnectionStatusT, string> = {
  not_configured: 'NOT CONFIGURED',
  sign_in_required: 'SIGN IN REQUIRED',
  configured: 'CONFIGURED · NOT VERIFIED',
  connected: 'CONNECTED',
  invalid_key: 'INVALID CREDENTIAL',
  unreachable: 'UNREACHABLE',
  unavailable: 'UNAVAILABLE',
  unknown: 'UNKNOWN'
};

const PREFERENCES: RoutingPreferenceT[] = ['local-first', 'local-only', 'api-keys-with-approval'];

const PREFERENCE_LABELS: Record<RoutingPreferenceT, string> = {
  'local-first': 'Local first',
  'local-only': 'Local only',
  'api-keys-with-approval': 'API keys (operator approval)'
};

function statusHint(conn: ProviderConnectionT): string {
  if (conn.detail.length > 0) return conn.detail;
  return STATUS_LABELS[conn.status];
}

function routedRoles(view: ConnectionsViewResponseT, conn: ProviderConnectionT): Role[] {
  const roles: Role[] = [];
  for (const role of ROLES) {
    const target = view.routed_roles[role];
    if (conn.kind === 'local-runtime' && target === 'local') roles.push(role);
    else if (target !== 'local' && target.provider_id === conn.provider_id) roles.push(role);
  }
  return roles;
}

export function createConnectionsPanel(container: HTMLElement, opts: ConnectionsPanelOptions): ConnectionsPanel {
  container.innerHTML = `
    <div class="connections-panel">
      <div class="connections-head">
        <span class="connections-title">Connections</span>
        <span class="connections-consensus" id="connections-consensus">…</span>
      </div>
      <p class="providers-note">One canonical view: subscription runtimes, API-key providers, the local runtime, and catalog access. Every state here is evidence from this machine — stored credentials and installed CLIs are shown as configured, never as live connections.</p>
      <label class="connections-pref">
        <span class="connections-pref-label">Routing preference</span>
        <select class="connections-pref-select" id="connections-pref"></select>
      </label>
      <div class="connections-list" id="connections-list"></div>
    </div>
  `;
  const consensusBox = container.querySelector<HTMLElement>('#connections-consensus');
  const listBox = container.querySelector<HTMLElement>('#connections-list');
  const prefBox = container.querySelector<HTMLSelectElement>('#connections-pref');
  if (consensusBox === null || listBox === null || prefBox === null) throw new Error('connections panel mount failed');
  const consensusEl: HTMLElement = consensusBox;
  const listEl: HTMLElement = listBox;
  const prefEl: HTMLSelectElement = prefBox;

  function toast(code: string, message: string): void {
    opts.onToast(code, message);
  }

  function renderCard(view: ConnectionsViewResponseT, conn: ProviderConnectionT): HTMLElement {
    const card = document.createElement('div');
    card.className = 'conn-card';
    card.dataset.connectionId = conn.id;

    const head = document.createElement('div');
    head.className = 'conn-card-head';
    const dot = document.createElement('span');
    dot.className = `provider-dot ${conn.status}`;
    const name = document.createElement('span');
    name.className = 'provider-name';
    name.textContent = conn.name;
    const account = document.createElement('span');
    account.className = 'provider-status';
    account.textContent = conn.account_label;
    head.append(dot, name, account);
    card.appendChild(head);

    const status = document.createElement('div');
    status.className = 'conn-status';
    status.textContent = STATUS_LABELS[conn.status];
    card.appendChild(status);

    const meta = document.createElement('div');
    meta.className = 'conn-meta';
    meta.textContent = statusHint(conn);
    card.appendChild(meta);

    const badges = routedRoles(view, conn);
    if (badges.length > 0) {
      const badgeRow = document.createElement('div');
      badgeRow.className = 'conn-badges';
      badgeRow.textContent = 'routed: ';
      for (const role of badges) {
        const badge = document.createElement('span');
        badge.className = 'conn-badge';
        badge.textContent = role;
        badgeRow.appendChild(badge);
      }
      card.appendChild(badgeRow);
    }

    const actions = document.createElement('div');
    actions.className = 'conn-actions';

    if (conn.kind === 'api-key' && (conn.id.startsWith('api:') || conn.id.startsWith('builtin:'))) {
      const test = document.createElement('button');
      test.type = 'button';
      test.className = 'provider-action';
      test.textContent = 'Test connection';
      test.addEventListener('click', () => {
        test.disabled = true;
        status.textContent = 'CHECKING…';
        api
          .connectionsTest(conn.id)
          .then(result => {
            status.textContent = result.ok ? `CONNECTED (${result.detail})` : `NOT CONNECTED (${result.detail})`;
            toast(result.ok ? 'OK' : 'NOT_READY', result.detail);
            void refresh();
          })
          .catch((error: unknown) => {
            const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'test failed';
            status.textContent = `UNAVAILABLE (${message})`;
            toast('INTERNAL', message);
          })
          .finally(() => {
            test.disabled = false;
          });
      });
      actions.appendChild(test);
    } else if (conn.kind === 'subscription') {
      const note = document.createElement('span');
      note.className = 'conn-meta';
      note.textContent = conn.status === 'unknown'
        ? 'Official client detected; verified account login and launch flow are not integrated yet.'
        : 'Install an officially supported client to make this connection available.';
      actions.appendChild(note);
    } else if (conn.kind === 'catalog-token') {
      if (conn.status === 'connected') {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'provider-action danger';
        remove.textContent = 'Remove token';
        remove.addEventListener('click', () => {
          remove.disabled = true;
          api
            .connectionsHfDelete()
            .then(() => {
              toast('OK', 'Hugging Face token removed');
              void refresh();
            })
            .catch((error: unknown) => {
              toast('INTERNAL', error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'remove failed');
            })
            .finally(() => {
              remove.disabled = false;
            });
        });
        actions.appendChild(remove);
      } else {
        const token = document.createElement('input');
        token.type = 'password';
        token.className = 'provider-key';
        token.placeholder = 'hf_… (stored encrypted, never echoed)';
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'provider-confirm';
        save.textContent = 'Save token';
        save.addEventListener('click', () => {
          const value = token.value.trim();
          if (value.length === 0) {
            toast('NOT_READY', 'paste a token to save');
            return;
          }
          save.disabled = true;
          api
            .connectionsHfSet(value)
            .then(() => {
              token.value = '';
              toast('OK', 'Hugging Face token stored');
              void refresh();
            })
            .catch((error: unknown) => {
              toast('INTERNAL', error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'save failed');
            })
            .finally(() => {
              save.disabled = false;
            });
        });
        actions.append(token, save);
      }
    }

    card.appendChild(actions);
    return card;
  }

  function renderPreference(preference: RoutingPreferenceT): void {
    prefEl.textContent = '';
    for (const option of PREFERENCES) {
      const el = document.createElement('option');
      el.value = option;
      el.textContent = PREFERENCE_LABELS[option];
      if (option === preference) el.selected = true;
      prefEl.appendChild(el);
    }
  }

  function render(view: ConnectionsViewResponseT): void {
    consensusEl.textContent = view.consensus;
    consensusEl.classList.toggle('empty', view.consensus.length === 0);
    renderPreference(view.preference);
    listEl.textContent = '';
    for (const conn of view.connections) {
      listEl.appendChild(renderCard(view, conn));
    }
  }

  prefEl.addEventListener('change', () => {
    const value = prefEl.value as RoutingPreferenceT;
    api
      .connectionsSetPreference(value)
      .then(() => toast('OK', `routing preference: ${PREFERENCE_LABELS[value]}`))
      .catch((error: unknown) => {
        toast('INTERNAL', error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'preference update failed');
        void refresh();
      });
  });

  async function refresh(): Promise<void> {
    let view: ConnectionsViewResponseT;
    try {
      view = await api.connections();
    } catch (error) {
      consensusEl.textContent = 'unavailable';
      listEl.textContent = '';
      const err = document.createElement('div');
      err.className = 'conn-meta';
      err.textContent = error instanceof Error ? error.message : 'connections unavailable';
      listEl.appendChild(err);
      return;
    }
    render(view);
  }

  void refresh();

  return { refresh };
}
