/// <reference lib="dom" />

export const MESSAGES: Record<string, string> = {
  BAD_REQUEST: 'Invalid request',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Not found',
  CONFLICT: 'Conflict',
  PAYLOAD_TOO_LARGE: 'File too large to open',
  INTERNAL: 'Daemon error',
  NOT_READY: 'Still warming up',
  TIMEOUT: 'Timed out',
  CHILD_FAILED: 'Background process failed',
  BAD_RESPONSE: 'Unexpected daemon response',
  COMMIT_FAILED: 'Save failed'
};

export function translateError(code: string, message: string): string {
  const label = MESSAGES[code] ?? message;
  if (message.length > 0 && label !== message) {
    return `${label}: ${message}`;
  }
  return label;
}

export function showToast(root: HTMLElement, code: string, message: string): void {
  const region = root.querySelector<HTMLElement>('[data-aide-toast-region]') ?? (() => {
    const created = document.createElement('div');
    created.dataset.aideToastRegion = 'true';
    created.className = 'aide-toast-region';
    root.appendChild(created);
    return created;
  })();
  const toast = document.createElement('div');
  toast.className = 'aide-toast';
  toast.dataset.level = code === 'OK' || code === 'INFO' ? 'info' : code === 'INTERNAL' || code === 'BAD_RESPONSE' ? 'err' : 'warn';
  toast.setAttribute('role', 'status');
  toast.textContent = translateError(code, message);
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), 8000);
}
