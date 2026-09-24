export const DEVELOPER_SPECIALS = [
  { id: 'high-volume', category: 'HIGH-VOLUME ENGINEERING', summary: 'Separate planning, implementation, and independent review only when the work benefits from distinct responsibilities.' },
  { id: 'low-cost', category: 'LOW-COST DEVELOPMENT', summary: 'Start with the least expensive available intelligence that has evidence for the required role; escalate only when the task or evidence calls for it.' },
  { id: 'local-first', category: 'LOCAL-FIRST', summary: 'Prefer an available local model when its resource fit and role evidence satisfy the task.' },
  { id: 'planning', category: 'PLANNING', summary: 'Use a planning role when task complexity warrants a separate plan; do not add a planner to every small change.' },
  { id: 'independent-review', category: 'INDEPENDENT REVIEW', summary: 'Use a distinct reviewer when the change risk or acceptance contract justifies another pass.' },
  { id: 'offline', category: 'OFFLINE WORK', summary: 'Constrain the candidate set to installed local intelligence and keep provider egress out of the workflow.' }
] as const;
