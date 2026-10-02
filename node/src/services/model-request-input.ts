import { createHash } from 'node:crypto';
import { ModelAdapterRequestInputObservation, type ModelAdapterRequestInputObservationT } from '../../../common/contracts/routing.ts';

export interface AdapterRequestInputOptions {
  // Internal callback and exact Router binding; never supplied by HTTP input.
  adapterInput?: {
    route_id: string;
    target_revision: string;
    onRequestInput: (observation: Readonly<ModelAdapterRequestInputObservationT>) => Promise<void>;
  } | undefined;
}

// Stateless evidence utility. Adapters own serialization/fetch; AgentLoop owns
// persistence. Caller sends this same serialized string after the awaited check.
export async function observeAdapterRequestInput(
  serialized: string,
  request: Pick<ModelAdapterRequestInputObservationT, 'adapter' | 'protocol' | 'requested_model' | 'request_index' | 'stream'>,
  options: AdapterRequestInputOptions,
  signal?: AbortSignal
): Promise<void> {
  if (options.adapterInput === undefined) return;
  signal?.throwIfAborted();
  const observation = Object.freeze(ModelAdapterRequestInputObservation.parse({
    ...request, scope: 'ADAPTER_REQUEST_INPUT', route_id: options.adapterInput.route_id,
    target_revision: options.adapterInput.target_revision,
    body_sha256: createHash('sha256').update(serialized, 'utf8').digest('hex'),
    body_bytes: Buffer.byteLength(serialized, 'utf8')
  }));
  await options.adapterInput.onRequestInput(observation);
  signal?.throwIfAborted();
}
