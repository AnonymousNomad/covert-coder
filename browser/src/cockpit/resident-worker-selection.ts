import type { ModelManagerResponseT } from '../../../common/contracts/model-access.ts';
import type { WorkerDescriptorT } from '../../../common/contracts/worker-handoff.ts';

type SelectionView = {
  connections: Pick<ModelManagerResponseT['connections'], 'routed_roles' | 'preference'>;
  runtime: Pick<ModelManagerResponseT['runtime'], 'selected_model_id' | 'health'>;
};

// Project role defaults and the observed loaded runtime remain owned by Model
// Access. This is only an exact request projection, never readiness or fallback.
export function residentWorkerForSelection(view: SelectionView, mode: 'plan' | 'act' = 'act'): WorkerDescriptorT {
  const selected = view.connections.routed_roles[mode];
  if (selected !== 'local') {
    if (view.connections.preference === 'local-only') throw new Error('The selected project worker is external, but Local-Only is enabled. Review Model Access.');
    if (!selected.provider_id || !selected.model_id) throw new Error('The selected project worker has no exact provider/model identity.');
    return { worker: `cloud:${selected.provider_id}:${selected.model_id}`, provider: selected.provider_id, model: selected.model_id, role: mode };
  }
  const model = view.runtime.selected_model_id;
  if (view.runtime.health !== 'HEALTHY' || model === null) throw new Error('No healthy exact local model is loaded. Review Model Access; no replacement was selected.');
  return { worker: `local:${model}`, provider: 'local', model, role: mode };
}
