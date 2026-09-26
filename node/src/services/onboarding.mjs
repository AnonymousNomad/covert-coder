// Resumable Covert setup progress with atomic persistence.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { OnboardingState } from '../../../common/contracts/onboarding.ts';

const STEP_ORDER = ["welcome", "local_intelligence", "providers", "workflow", "security", "workspace", "verify", "finish"];
const LEGACY_STEP_MAP = {
  welcome: "welcome",
  privacy: "local_intelligence",
  byok_optin: "providers",
  desktop_optin: "security",
  system_map: "verify"
};
const LEGACY_STEP_IDS = new Set(["privacy", "byok_optin", "desktop_optin", "system_map"]);

function makeDefaultState() {
  const now = Date.now();
  const completed = {};
  for (const s of STEP_ORDER) completed[s] = { skipped: false, completed_at: null };
  return {
    current_step: "welcome",
    completed,
    user_choices: {},
    walkthrough_complete: false,
    deferred: false,
    started_at: now,
    updated_at: now
  };
}

function nextStepName(current) {
  const i = STEP_ORDER.indexOf(current);
  if (i < 0 || i >= STEP_ORDER.length - 1) return current;
  return STEP_ORDER[i + 1];
}

async function readState(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const value = JSON.parse(raw);
    const hasLegacyProgress = value && typeof value === "object" && (
      (typeof value.current_step === "string" && !STEP_ORDER.includes(value.current_step)) ||
      (value.completed && Object.keys(value.completed).some((step) => LEGACY_STEP_IDS.has(step)))
    );
    if (hasLegacyProgress) {
      const migratedStep = LEGACY_STEP_MAP[value.current_step];
      if (!migratedStep) return makeDefaultState();
      const migrated = makeDefaultState();
      migrated.current_step = migratedStep;
      migrated.user_choices = value.user_choices && typeof value.user_choices === "object" ? value.user_choices : {};
      migrated.walkthrough_complete = value.walkthrough_complete === true;
      migrated.deferred = value.deferred === true;
      migrated.started_at = Number.isInteger(value.started_at) ? value.started_at : migrated.started_at;
      migrated.updated_at = Number.isInteger(value.updated_at) ? value.updated_at : migrated.updated_at;
      for (const [legacyStep, newStep] of Object.entries(LEGACY_STEP_MAP)) {
        const status = value.completed?.[legacyStep];
        if (status && typeof status === "object" && typeof status.skipped === "boolean" && (status.completed_at === null || Number.isInteger(status.completed_at))) {
          migrated.completed[newStep] = status;
        }
      }
      return OnboardingState.parse(migrated);
    }
    return OnboardingState.parse(value);
  } catch (error) {
    if (error && error.code === "ENOENT") return makeDefaultState();
    // Corrupt state: reset (atomic write protects the next save).
    return makeDefaultState();
  }
}

async function writeStateAtomic(filePath, state) {
  state.updated_at = Date.now();
  const partial = filePath + ".partial";
  // Ensure the parent directory exists (first write on a fresh workspace).
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(partial, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(partial, filePath);
}

// Stale-transition conflict: the durable state no longer matches the
// precondition that was bound into the approved operation. This is a state
// conflict, not an authorization forgery; routes map it to CONFLICT.
export class OnboardingConflictError extends Error {
  constructor(message = "onboarding state changed before this transition executed") {
    super(message);
    this.name = "ONBOARDING_CONFLICT";
  }
}

export function createOnboardingService({ workspace }) {
  if (!workspace) throw new Error("workspace is required");
  const stateFile = path.join(workspace, ".aide", "onboarding-state.json");

  // Per-service FIFO critical section. It holds compare -> derive -> durable
  // write as one serialized operation so a stale approved transition can never
  // observe or act on state that another writer changed underneath it. It is
  // not authority: it grants nothing, persists nothing, and never crosses
  // service/workspace instances. Failures release the queue.
  let queue = Promise.resolve();
  function critical(operation) {
    const run = queue.then(operation);
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  function assertExpectedStep(current, expected) {
    if (expected && expected.from_step !== undefined && current.current_step !== expected.from_step) {
      throw new OnboardingConflictError(`approved from_step ${expected.from_step} does not match current step ${current.current_step}`);
    }
  }

  async function getState() {
    return readState(stateFile);
  }

  async function setState(next) {
    // Full-state replacement keeps exact-replacement semantics, but it
    // participates in the same critical section so it can never interleave
    // between another transition's compare and durable write.
    return critical(async () => {
      const parsed = OnboardingState.parse(next);
      await fs.mkdir(path.dirname(stateFile), { recursive: true });
      await writeStateAtomic(stateFile, parsed);
      return parsed;
    });
  }

  async function nextStep(partial, expected = {}) {
    return critical(async () => {
      const current = await readState(stateFile);
      assertExpectedStep(current, expected);
      if (expected.walkthrough_complete !== undefined && current.walkthrough_complete !== expected.walkthrough_complete) {
        throw new OnboardingConflictError(`approved walkthrough_complete ${expected.walkthrough_complete} does not match current state ${current.walkthrough_complete}`);
      }
      if (expected.deferred !== undefined && current.deferred !== expected.deferred) {
        throw new OnboardingConflictError(`approved deferred ${expected.deferred} does not match current state ${current.deferred}`);
      }
      if (partial && typeof partial === "object") {
        Object.assign(current.user_choices, partial);
      }
      current.completed[current.current_step] = { skipped: false, completed_at: Date.now() };
      current.deferred = false;
      const advanced = nextStepName(current.current_step);
      current.current_step = advanced;
      await writeStateAtomic(stateFile, current);
      return { state: current, advanced_to: current.current_step };
    });
  }

  async function skipStep(partial, expected = {}) {
    return critical(async () => {
      const current = await readState(stateFile);
      assertExpectedStep(current, expected);
      if (expected.walkthrough_complete !== undefined && current.walkthrough_complete !== expected.walkthrough_complete) {
        throw new OnboardingConflictError(`approved walkthrough_complete ${expected.walkthrough_complete} does not match current state ${current.walkthrough_complete}`);
      }
      if (expected.deferred !== undefined && current.deferred !== expected.deferred) {
        throw new OnboardingConflictError(`approved deferred ${expected.deferred} does not match current state ${current.deferred}`);
      }
      if (partial && typeof partial === "object") {
        Object.assign(current.user_choices, partial);
      }
      current.completed[current.current_step] = { skipped: true, completed_at: Date.now() };
      current.deferred = false;
      current.current_step = nextStepName(current.current_step);
      await writeStateAtomic(stateFile, current);
      return { state: current, advanced_to: current.current_step };
    });
  }

  async function complete(expected = {}) {
    return critical(async () => {
      const current = await readState(stateFile);
      assertExpectedStep(current, expected);
      if (current.current_step !== "finish") {
        throw new OnboardingConflictError(`setup can only complete from the finish step; current step is ${current.current_step}`);
      }
      if (expected.walkthrough_complete !== undefined && current.walkthrough_complete !== expected.walkthrough_complete) {
        throw new OnboardingConflictError(`approved walkthrough_complete ${expected.walkthrough_complete} does not match current state ${current.walkthrough_complete}`);
      }
      if (expected.deferred !== undefined && current.deferred !== expected.deferred) {
        throw new OnboardingConflictError(`approved deferred ${expected.deferred} does not match current state ${current.deferred}`);
      }
      current.completed.finish = { skipped: false, completed_at: Date.now() };
      current.walkthrough_complete = true;
      current.deferred = false;
      await writeStateAtomic(stateFile, current);
      return current;
    });
  }

  async function restart(expected = {}) {
    return critical(async () => {
      const current = await readState(stateFile);
      assertExpectedStep(current, expected);
      if (expected.walkthrough_complete !== undefined && current.walkthrough_complete !== expected.walkthrough_complete) {
        throw new OnboardingConflictError(`approved walkthrough_complete ${expected.walkthrough_complete} does not match current state ${current.walkthrough_complete}`);
      }
      if (expected.deferred !== undefined && current.deferred !== expected.deferred) {
        throw new OnboardingConflictError(`approved deferred ${expected.deferred} does not match current state ${current.deferred}`);
      }
      const restarted = makeDefaultState();
      restarted.user_choices = current.user_choices;
      await writeStateAtomic(stateFile, restarted);
      return restarted;
    });
  }

  async function defer(expected = {}) {
    return critical(async () => {
      const current = await readState(stateFile);
      assertExpectedStep(current, expected);
      if (expected.walkthrough_complete !== undefined && current.walkthrough_complete !== expected.walkthrough_complete) {
        throw new OnboardingConflictError(`approved walkthrough_complete ${expected.walkthrough_complete} does not match current state ${current.walkthrough_complete}`);
      }
      if (expected.deferred !== undefined && current.deferred !== expected.deferred) {
        throw new OnboardingConflictError(`approved deferred ${expected.deferred} does not match current state ${current.deferred}`);
      }
      current.deferred = true;
      await writeStateAtomic(stateFile, current);
      return current;
    });
  }

  async function resume(expected = {}) {
    return critical(async () => {
      const current = await readState(stateFile);
      assertExpectedStep(current, expected);
      if (expected.walkthrough_complete !== undefined && current.walkthrough_complete !== expected.walkthrough_complete) {
        throw new OnboardingConflictError(`approved walkthrough_complete ${expected.walkthrough_complete} does not match current state ${current.walkthrough_complete}`);
      }
      if (expected.deferred !== undefined && current.deferred !== expected.deferred) {
        throw new OnboardingConflictError(`approved deferred ${expected.deferred} does not match current state ${current.deferred}`);
      }
      current.deferred = false;
      await writeStateAtomic(stateFile, current);
      return current;
    });
  }

  return { getState, setState, nextStep, skipStep, complete, restart, defer, resume };
}
