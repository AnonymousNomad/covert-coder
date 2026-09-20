import type { EdgeCommandResponseT, VoiceCommandResponseT } from '../../../common/contracts/mobile.ts';

export interface CipherVoiceService {
  capabilities(): unknown;
  classify(transcript: string): { category: 'read' | 'mutate' | 'high-risk' | 'unknown'; command: string | null; response: string };
  command(input: unknown): Promise<VoiceCommandResponseT>;
}

export declare function createCipherVoiceService(options?: {
  bridge?: { command(input: unknown): Promise<EdgeCommandResponseT> };
}): CipherVoiceService;
