// Projects surface — workspace/file projection plus existing workbench bundles.
// File opening is delegated to the already-mounted Monaco host; this surface
// does not gain write authority by displaying the workspace.

import type { Store } from '../store/store.ts';
import type { AppState } from '../store/state.ts';
import { api } from '../services/api.ts';
import { createWorkbenchesPanel } from '../workbenches/workbenches.ts';
import type { EditorHost } from '../editor/host.ts';
import type { WorkspaceListResponseT } from '../../../common/contracts/workspace.ts';

export interface ProjectsSurfaceHandles {
  refresh(): Promise<void>;
  setEditorHost(host: EditorHost): void;
  dispose(): void;
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createProjectsSurface(parent: HTMLElement, store: Store<AppState>, opts: { onToast: (code: string, message: string) => void }): ProjectsSurfaceHandles {
  parent.innerHTML = '';
  const root = el('div', 'panel-content cockpit-projects-surface');
  const header = el('header', 'panel-header');
  header.appendChild(el('h2', 'panel-title', 'PROJECTS / WORKSPACE'));
  header.appendChild(el('span', 'panel-maturity', 'AVAILABLE'));
  root.appendChild(header);

  const workspaceSection = el('section', 'cockpit-projects-workspace');
  const workspaceHead = el('div', 'cockpit-projects-section-head');
  workspaceHead.appendChild(el('h3', 'cockpit-projects-section-title', 'WORKSPACE FILES'));
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = 'cockpit-projects-refresh';
  refreshButton.textContent = 'REFRESH';
  workspaceHead.appendChild(refreshButton);
  workspaceSection.appendChild(workspaceHead);
  const workspaceMeta = el('div', 'cockpit-projects-workspace-meta');
  const workspaceList = el('div', 'cockpit-projects-file-list');
  workspaceSection.append(workspaceMeta, workspaceList);
  root.appendChild(workspaceSection);

  const workbenchSection = el('section', 'cockpit-projects-workbenches');
  workbenchSection.appendChild(el('h3', 'cockpit-projects-section-title', 'WORKBENCHES'));
  const workbenchMount = el('div', 'cockpit-projects-workbench-mount');
  workbenchSection.appendChild(workbenchMount);
  root.appendChild(workbenchSection);
  parent.appendChild(root);

  let editorHost: EditorHost | null = null;
  let alive = true;

  function renderWorkspace(workspace: WorkspaceListResponseT | null): void {
    workspaceList.innerHTML = '';
    if (workspace === null) {
      workspaceMeta.textContent = '/api/workspace unavailable.';
      workspaceList.appendChild(el('div', 'panel-empty-detail', 'Workspace/file navigation is unavailable until the daemon responds.'));
      return;
    }
    workspaceMeta.textContent = `${workspace.workspace} · ${workspace.entries.length} top-level entries`;
    for (const entry of workspace.entries.slice(0, 120)) {
      const row = el('div', 'cockpit-projects-file-row');
      row.appendChild(el('span', 'cockpit-projects-file-kind', entry.kind === 'directory' ? 'DIR' : 'FILE'));
      if (entry.kind === 'file') {
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'cockpit-projects-file-button';
        open.textContent = entry.name;
        open.title = `Open ${entry.name} in Monaco`;
        open.disabled = editorHost === null;
        open.addEventListener('click', () => {
          if (editorHost !== null) void editorHost.open(entry.name);
        });
        row.appendChild(open);
      } else {
        row.appendChild(el('span', 'cockpit-projects-file-name', entry.name));
      }
      workspaceList.appendChild(row);
    }
  }

  async function refresh(): Promise<void> {
    if (!alive) return;
    try {
      const workspace = await api.workspaceList();
      if (!alive) return;
      store.set(prev => ({ ...prev, workspace }));
      renderWorkspace(workspace);
    } catch {
      renderWorkspace(null);
    }
  }

  refreshButton.addEventListener('click', () => { void refresh(); });
  createWorkbenchesPanel(workbenchMount, { onToast: opts.onToast });
  void refresh();

  return {
    refresh,
    setEditorHost(host: EditorHost): void {
      editorHost = host;
      const workspace = store.get().workspace;
      if (workspace !== null) renderWorkspace(workspace);
    },
    dispose() {
      alive = false;
      parent.innerHTML = '';
    }
  };
}
