// Type declarations for node/src/services/resident-worker-bridge.mjs
// (Resident → worker bridge — proposal-only delegation contract.)

export interface WorkerCandidate {
  id: string;
  roles: string[];
  overlap: number;
}

export interface WorkerAssignment {
  objective: string;
  workflow_stage: string;
  requested_role: 'planner' | 'coder' | 'reviewer' | 'specialist';
  task: string;
  constraints: string[];
  canonical_project_state: string | null;
  required_skills: string[];
  required_evidence: string[];
  authority_requirements: 'proposal-only';
  return_contract: string;
  target?: string;
  delegation: string;
}

export declare function loadRoleContracts(): Promise<Record<string, { sop?: string; must?: string[]; must_not?: string[] }>>;
export declare function selectWorker(projection: unknown, role: 'planner' | 'coder' | 'reviewer' | 'specialist'): WorkerCandidate | null;
export declare function buildWorkerAssignment(input: {
  objective: string;
  workflowStage: string;
  requestedRole: WorkerAssignment['requested_role'];
  task: string;
  constraints?: string[];
  canonicalProjectState?: string | null;
  requiredSkills?: string[];
  requiredEvidence?: string[];
  authorityRequirements?: 'proposal-only';
  returnContract?: string;
  scratchTarget?: string | null;
}): WorkerAssignment;
export declare function runWorker(options: {
  assignment: WorkerAssignment;
  endpoint: string;
  modelId: string;
  roleContracts: Record<string, { sop?: string; must?: string[]; must_not?: string[] }>;
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; system: string; user: string; latency_ms: number; modelId: string }>;
export declare function extractCode(text: string): string | null;
export declare function methodologyFirewall(residentText: string, workerText: string): {
  worker_context_has_resident_sops: boolean;
  resident_context_has_worker_contract: boolean;
  clean: boolean;
};
