const READ_PATTERNS = [
  { pattern: /what(?:'s| is)\s+covert\s+doing|workload|status/i, command: 'status.read', response: 'Covert status is available in the authenticated command center.' },
  { pattern: /release\s+status|verification|verify/i, command: 'verification.read', response: 'The verification summary is available from the shared Resident state.' },
  { pattern: /what\s+failed|failures?|errors?/i, command: 'notifications.read', response: 'Recent failures are available from the shared notification projection.' },
  { pattern: /worker|model|provider/i, command: 'workers.read', response: 'Worker and model state is available from the shared Workstation projection.' },
  { pattern: /resident|project\s+status/i, command: 'resident.read', response: 'Resident state is available from the authenticated Workstation projection.' }
];

const MUTATING_PATTERNS = [
  { pattern: /start|resume|run|begin/i, command: 'workflow.start' },
  { pattern: /pause/i, command: 'workflow.pause' },
  { pattern: /stop|cancel/i, command: 'workflow.stop' },
  { pattern: /approve|reject/i, command: 'approval.submit' }
];

export function createCipherVoiceService({ bridge } = {}) {
  function capabilities() {
    return {
      input_available: true,
      push_to_talk_available: true,
      custom_hotword_available: false,
      assistant_role_available: false,
      supported_invocations: ['in-app-push-to-talk', 'widget', 'quick-action', 'assistant-role', 'app-intent', 'siri'],
      limitations: ['Speech capture and platform invocation remain client responsibilities.', 'Custom hotword is not implemented; voice input is not an always-listening authority path.']
    };
  }

  function classify(transcript) {
    const text = String(transcript ?? '').trim();
    const read = READ_PATTERNS.find(item => item.pattern.test(text));
    if (read) return { category: 'read', command: read.command, response: read.response };
    const mutation = MUTATING_PATTERNS.find(item => item.pattern.test(text));
    if (mutation) return { category: mutation.command === 'workflow.stop' || mutation.command === 'approval.submit' ? 'high-risk' : 'mutate', command: mutation.command, response: 'This command requires explicit confirmation through the normal authority policy.' };
    return { category: 'unknown', command: null, response: 'Cipher could not map that request to a bounded Covert capability.' };
  }

  async function command({ transcript, confirmation = false }) {
    const classified = classify(transcript);
    if (!classified.command) return { accepted: false, category: classified.category, requires_confirmation: false, response_text: classified.response, snapshot: null };
    if (classified.category !== 'read' && confirmation !== true) return { accepted: false, category: classified.category, requires_confirmation: true, response_text: classified.response, snapshot: null };
    const result = await bridge.command({ command: classified.command, confirmation });
    return { accepted: result.accepted, category: classified.category, requires_confirmation: result.requires_confirmation, response_text: result.accepted ? classified.response : result.reason, snapshot: result.snapshot };
  }

  return Object.freeze({ capabilities, classify, command });
}
