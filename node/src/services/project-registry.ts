import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ProjectCatalog, ProjectCheckout, type ProjectCatalogT, type ProjectCheckoutT } from '../../../common/contracts/project.ts';
import { atomicWriteJson, withFileMutationLock, type AtomicJsonTestHooks } from './atomic-json.ts';

const Identity = z.object({ schema: z.literal('covert.project-catalog-identity.v1'), catalog_id: z.string().uuid() }).strict();
const normalize = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value;
const errorCode = (error: unknown) => typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
export class ProjectRegistryError extends Error {
  readonly code = 'NOT_READY';
  readonly reason: string;
  constructor(reason: string) { super(reason); this.name = 'ProjectRegistryError'; this.reason = reason; }
}

// Canonical identity/binding owner. Enrollment is a trusted composition-root
// operation, not an HTTP/model grant or permission to access another checkout.
// One supervised process; the file lock also covers multiple in-process ports.
export function createProjectRegistry(options: { storageRoot: string; testHooks?: AtomicJsonTestHooks }) {
  const root = path.resolve(options.storageRoot), file = path.join(root, 'catalog.json'), identityFile = path.join(root, 'identity.json');
  // Separate enrollment marker survives loss of the catalog pair. It is
  // recovery metadata owned here, not a signature or independent witness.
  const enrollmentFile = path.join(path.dirname(root), path.basename(root) + '-enrollment.json');
  let seenCatalogId: string | null = null;
  async function safeStorage(create = false) {
    if (create) await fs.mkdir(root, { recursive: true });
    let cursor = root;
    while (true) {
      try {
        if (!(await fs.stat(cursor)).isDirectory() || normalize(await fs.realpath(cursor)) !== normalize(cursor)) throw new ProjectRegistryError('PROJECT_STORAGE_UNSAFE');
        return;
      } catch (error) {
        if (errorCode(error) !== 'ENOENT') throw error;
        const parent = path.dirname(cursor);
        if (parent === cursor) throw new ProjectRegistryError('PROJECT_STORAGE_UNAVAILABLE');
        cursor = parent;
      }
    }
  }
  async function read(target: string): Promise<unknown | null> {
    try {
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new ProjectRegistryError('PROJECT_CATALOG_INVALID');
      return JSON.parse(await fs.readFile(target, 'utf8')) as unknown;
    } catch (error) {
      if (errorCode(error) === 'ENOENT') return null;
      if (error instanceof ProjectRegistryError) throw error;
      throw new ProjectRegistryError('PROJECT_CATALOG_INVALID');
    }
  }
  function validate(value: unknown): ProjectCatalogT {
    const parsed = ProjectCatalog.safeParse(value);
    if (!parsed.success) throw new ProjectRegistryError('PROJECT_CATALOG_INVALID');
    const state = parsed.data;
    const projects = new Set(state.projects.map(project => project.project_id));
    const checkouts = new Set(state.checkouts.map(checkout => checkout.checkout_id));
    const roots = new Set(state.checkouts.map(checkout => normalize(checkout.root)));
    if (projects.size !== state.projects.length || checkouts.size !== state.checkouts.length || roots.size !== state.checkouts.length ||
      state.checkouts.some(checkout => !projects.has(checkout.project_id) || !path.isAbsolute(checkout.root) || path.resolve(checkout.root) !== checkout.root)) throw new ProjectRegistryError('PROJECT_CATALOG_INVALID');
    if (Buffer.byteLength(JSON.stringify(state, null, 2) + '\n') > 2 * 1024 * 1024) throw new ProjectRegistryError('PROJECT_CATALOG_CAPACITY');
    return state;
  }
  async function load(): Promise<ProjectCatalogT | null> {
    await safeStorage();
    const rawEnrollment = await read(enrollmentFile), rawIdentity = await read(identityFile), rawState = await read(file);
    if (rawEnrollment === null && rawIdentity === null && rawState === null && seenCatalogId === null) return null;
    const identity = Identity.safeParse(rawIdentity), enrollment = Identity.safeParse(rawEnrollment);
    if (!identity.success || !enrollment.success || rawState === null) throw new ProjectRegistryError('PROJECT_CATALOG_INVALID');
    const state = validate(rawState);
    if (state.catalog_id !== identity.data.catalog_id || state.catalog_id !== enrollment.data.catalog_id) throw new ProjectRegistryError('PROJECT_CATALOG_INVALID');
    if (seenCatalogId !== null && seenCatalogId !== state.catalog_id) throw new ProjectRegistryError('PROJECT_CATALOG_CHANGED');
    seenCatalogId = state.catalog_id;
    return state;
  }
  async function inspectRoot(checkoutRoot: string) {
    if (!path.isAbsolute(checkoutRoot)) throw new ProjectRegistryError('CHECKOUT_ABSOLUTE_ROOT_REQUIRED');
    try {
      const actual = await fs.realpath(checkoutRoot), stat = await fs.stat(actual, { bigint: true });
      if (!stat.isDirectory() || stat.ino <= 0n) throw new ProjectRegistryError('CHECKOUT_IDENTITY_UNAVAILABLE');
      return { root: actual, root_device: String(stat.dev), root_inode: String(stat.ino) };
    } catch (error) {
      if (error instanceof ProjectRegistryError) throw error;
      throw new ProjectRegistryError('CHECKOUT_UNAVAILABLE');
    }
  }
  function checkRoot(binding: ProjectCheckoutT, observed: Awaited<ReturnType<typeof inspectRoot>>) {
    if (normalize(binding.root) !== normalize(observed.root) || binding.root_device !== observed.root_device || binding.root_inode !== observed.root_inode) throw new ProjectRegistryError('CHECKOUT_ROOT_CHANGED');
  }
  const locked = <T>(run: () => Promise<T>) => withFileMutationLock(file, run);
  return {
    // Explicit project_id attaches another checkout to an existing project;
    // never infer sameness from Git URL, directory name or a workbench label.
    enrollCheckout: (checkoutRoot: string, projectId?: string): Promise<ProjectCheckoutT> => locked(async () => {
      const observed = await inspectRoot(checkoutRoot), loaded = await load();
      const existing = loaded?.checkouts.find(checkout => normalize(checkout.root) === normalize(observed.root));
      if (existing) {
        if (projectId !== undefined && existing.project_id !== projectId) throw new ProjectRegistryError('PROJECT_SCOPE_MISMATCH');
        checkRoot(existing, observed);
        return existing;
      }
      if (projectId !== undefined && !loaded?.projects.some(project => project.project_id === projectId)) throw new ProjectRegistryError('PROJECT_NOT_FOUND');
      const createdAt = new Date().toISOString(), id = projectId ?? randomUUID();
      const binding = ProjectCheckout.parse({ ...observed, project_id: id, checkout_id: randomUUID(), created_at: createdAt });
      const state = loaded ?? { schema: 'covert.project-catalog.v1' as const, catalog_id: randomUUID(), revision: 0, projects: [], checkouts: [] };
      const next = validate({ ...state, revision: state.revision + 1, projects: projectId === undefined ? [...state.projects, { project_id: id, created_at: createdAt }] : state.projects, checkouts: [...state.checkouts, binding] });
      await safeStorage(true);
      // A surviving identity with missing/failed catalog requires recovery;
      // it is never treated as first run or silently assigned new IDs.
      if (loaded === null) {
        const identity = { schema: 'covert.project-catalog-identity.v1', catalog_id: next.catalog_id };
        await atomicWriteJson(enrollmentFile, identity, { validate: value => { Identity.parse(value); } });
        await atomicWriteJson(identityFile, identity, { validate: value => { Identity.parse(value); } });
      }
      await atomicWriteJson(file, next, { validate: value => { validate(value); }, ...(options.testHooks ? { testHooks: options.testHooks } : {}) });
      seenCatalogId = next.catalog_id;
      return binding;
    }),
    assertBinding: (projectId: string, checkoutId: string, checkoutRoot: string): Promise<ProjectCheckoutT> => locked(async () => {
      const state = await load(), binding = state?.checkouts.find(checkout => checkout.checkout_id === checkoutId);
      if (!binding || binding.project_id !== projectId) throw new ProjectRegistryError('PROJECT_SCOPE_MISMATCH');
      const observed = await inspectRoot(checkoutRoot);
      if (normalize(binding.root) !== normalize(observed.root)) throw new ProjectRegistryError('PROJECT_SCOPE_MISMATCH');
      checkRoot(binding, observed);
      return binding;
    }),
    list: (): Promise<ProjectCatalogT> => locked(async () => {
      const state = await load();
      if (!state) throw new ProjectRegistryError('PROJECT_NOT_ENROLLED');
      return state;
    })
  };
}
export type ProjectRegistry = ReturnType<typeof createProjectRegistry>;
