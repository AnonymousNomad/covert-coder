export interface BlockedStateDetails {
  owner: string;
  reason: string;
  currentState: string;
  nextAction: string;
  evidence?: string;
}

export function createBlockedState(details: BlockedStateDetails): HTMLElement {
  const root = document.createElement('aside');
  root.className = 'cockpit-blocked-state';
  root.setAttribute('aria-label', 'Blocked state details');
  const title = document.createElement('h3');
  title.textContent = 'WHY THIS IS BLOCKED / UNKNOWN';
  root.appendChild(title);
  for (const [label, value] of [
    ['Blocked by', details.owner],
    ['Reason', details.reason],
    ['Current state', details.currentState],
    ['Next valid action', details.nextAction],
    ...(details.evidence ? [['Evidence', details.evidence]] : [])
  ]) {
    const row = document.createElement('div');
    row.className = 'cockpit-blocked-state-row';
    const key = document.createElement('span');
    key.textContent = label;
    const content = document.createElement('strong');
    content.textContent = value;
    row.append(key, content);
    root.appendChild(row);
  }
  return root;
}
