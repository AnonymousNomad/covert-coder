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
  const rows: Array<[string, string]> = [
    ['Blocked by', details.owner],
    ['Reason', details.reason],
    ['Current state', details.currentState],
    ['Next valid action', details.nextAction]
  ];
  if (details.evidence) rows.push(['Evidence', details.evidence]);
  for (const [label, value] of rows) {
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
