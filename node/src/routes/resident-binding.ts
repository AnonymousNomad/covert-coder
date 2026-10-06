import { type Route } from '../server.ts';
import { ResidentBinding, type ResidentBindingT } from '../../../common/contracts/resident-binding.ts';

// Resident Binding transport: one read-only route over the canonical Resident
// Binding projection. The service derives the verdict from Model Manager
// inventory + runtime observation on every read; this route adds no cache,
// registry, or inference of its own (see the transport law in
// docs/model-intelligence/MAIN_LUNA_RESIDENT_BINDING_CONTRACT.md).

export interface ResidentBindingReadSurface {
  read(): Promise<ResidentBindingT>;
}

export function routeForResidentBinding(service: ResidentBindingReadSurface): Route {
  return {
    method: 'GET',
    path: '/api/resident/binding',
    response: ResidentBinding,
    handler: async () => service.read()
  };
}
