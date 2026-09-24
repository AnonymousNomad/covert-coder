import '../../../browser/src/main.css';

const host = globalThis as typeof globalThis & { __AIDE_RUNTIME_CONFIG__?: { facadeOrigin: string } };
host.__AIDE_RUNTIME_CONFIG__ = { facadeOrigin: window.location.origin };
const { createModelsPanel } = await import('../../../browser/src/panels/models.ts');
const root = document.querySelector<HTMLElement>('#test-root');
if (!root) throw new Error('isolated Model Manager fixture root is missing');
createModelsPanel(root, {} as never);
