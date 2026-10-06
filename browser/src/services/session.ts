import { SessionFile, type SessionFileT } from '../../../common/contracts/session.ts';
import { api } from './api.ts';

const SAVE_DEBOUNCE_MS = 500;

export class SessionService {
  current: SessionFileT;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<SessionFileT> | null = null;
  private readonly onSaveFailure: (error: unknown) => void;

  constructor(onSaveFailure: (error: unknown) => void, initial: SessionFileT = { version: 1, tabs: [] }) {
    this.onSaveFailure = onSaveFailure;
    this.current = initial;
  }

  async restore(): Promise<SessionFileT> {
    const session = await api.sessionGet();
    const parsed = SessionFile.safeParse(session);
    this.current = parsed.success ? parsed.data : this.current;
    return this.current;
  }

  set(updater: (prev: SessionFileT) => SessionFileT): void {
    this.current = updater(this.current);
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush().catch(() => { /* flush reports the failure through onSaveFailure. */ });
    }, SAVE_DEBOUNCE_MS);
  }

  async flush(): Promise<SessionFileT> {
    if (this.saving !== null) return this.saving;
    const snapshot = this.current;
    this.saving = api
      .sessionPut(snapshot)
      .catch(error => {
        try { this.onSaveFailure(error); }
        catch { /* Preserve the original save failure if the reporter also fails. */ }
        throw error;
      })
      .then(saved => {
        this.current = saved;
        return saved;
      })
      .finally(() => {
        this.saving = null;
      });
    return this.saving;
  }
}
