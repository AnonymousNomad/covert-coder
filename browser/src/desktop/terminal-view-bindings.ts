/** In-memory display bindings. This registry grants no process or Authority ownership. */
export class TerminalViewBindings {
  private readonly sessions = new Map<string, string>();
  private readonly views = new Map<string, string>();

  availableTo(viewId: string, sessionId: string): boolean {
    const owner = this.sessions.get(sessionId);
    return owner === undefined || owner === viewId;
  }

  claim(viewId: string, sessionId: string): boolean {
    if (!viewId || !sessionId || viewId.length > 128 || sessionId.length > 128) return false;
    if (!this.availableTo(viewId, sessionId)) return false;
    const current = this.views.get(viewId);
    if (current !== undefined && current !== sessionId) return false;
    if (current === undefined && this.views.size >= 8) return false;
    this.views.set(viewId, sessionId);
    this.sessions.set(sessionId, viewId);
    return true;
  }

  release(viewId: string, sessionId: string): void {
    if (this.views.get(viewId) !== sessionId || this.sessions.get(sessionId) !== viewId) return;
    this.views.delete(viewId);
    this.sessions.delete(sessionId);
  }
}
