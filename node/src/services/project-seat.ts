import type { ExecutionAuthority } from './execution-authority.mjs';
import { type ProjectRegistry, ProjectRegistryError } from './project-registry.ts';
import type { ProjectAddressT, ProjectCheckoutT } from '../../../common/contracts/project.ts';

// Root-owned addressing, separate from UI/window identity. Existing canonical
// services remain bound to this checkout; no switching or lease is invented.
export function createProjectSeat(registry: ProjectRegistry, workspace: string) {
  let binding: ProjectCheckoutT | undefined;
  return Object.freeze({
    registry,
    initialize: async (previous?: ProjectAddressT | null) => {
      // Existing durable effect references are reconciliation evidence, never
      // a source from which to reconstruct missing canonical catalog records.
      if (!binding) binding = previous ? await registry.assertBinding(previous.project_id, previous.checkout_id, workspace) : await registry.enrollCheckout(workspace);
      return registry.assertBinding(binding.project_id, binding.checkout_id, workspace);
    },
    current: async () => {
      if (!binding) throw new ProjectRegistryError('PROJECT_NOT_ENROLLED');
      return registry.assertBinding(binding.project_id, binding.checkout_id, workspace);
    },
    assertAddress: async (address: ProjectAddressT) => {
      if (!binding || address.project_id !== binding.project_id || address.checkout_id !== binding.checkout_id) throw new ProjectRegistryError('PROJECT_SCOPE_MISMATCH');
      return registry.assertBinding(address.project_id, address.checkout_id, workspace);
    }
  });
}
export type ProjectSeat = ReturnType<typeof createProjectSeat>;
const owners = new WeakMap<ExecutionAuthority, ProjectSeat>();
export function bindProjectSeat(authority: ExecutionAuthority, seat: ProjectSeat) {
  if (owners.has(authority)) throw new Error('Project seat already bound to Authority');
  owners.set(authority, seat);
}
export function projectSeatForAuthority(authority: ExecutionAuthority) { return owners.get(authority); }
