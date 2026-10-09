import type { ModelManagerResponseT } from '../../../common/contracts/model-access.ts';
import type { WorkerDescriptorT } from '../../../common/contracts/worker-handoff.ts';

type SelectionView = {
  connections: Pick<ModelManagerResponseT['connections'], 'routed_roles' | 'preference'>;
  runtime: Pick<ModelManagerResponseT['runtime'], 'selected_model_id' | 'health'>;
};

type WorkerRole = 'planner' | 'coder' | 'reviewer';

// Project role targets and the observed loaded runtime remain owned by Model
// Access. A provider sentinel is not an artifact identity and must never be
// resolved from whichever model happens to be loaded.
export function residentWorkerForSelection(view: SelectionView, role: WorkerRole = 'coder'): WorkerDescriptorT {
  const selected = view.connections.routed_roles[role];
  if (selected !== 'local' && selected.provider_id === 'local') {
    if (view.runtime.health !== 'HEALTHY' || view.runtime.selected_model_id !== selected.model_id) {
      throw new Error(`The exact local ${role} model is not the healthy loaded model. Review Model Access; no replacement was selected.`);
    }
    return { worker: `local:${selected.model_id}`, provider: 'local', model: selected.model_id, role };
  }
  if (selected !== 'local') {
    if (view.connections.preference === 'local-only') throw new Error('The selected project worker is external, but Local-Only is enabled. Review Model Access.');
    if (!selected.provider_id || !selected.model_id) throw new Error('The selected project worker has no exact provider/model identity.');
    return { worker: `cloud:${selected.provider_id}:${selected.model_id}`, provider: selected.provider_id, model: selected.model_id, role };
  }
  throw new Error(`No exact ${role} model is selected in Model Access; the loaded runtime model is not an implicit role selection.`);
}
