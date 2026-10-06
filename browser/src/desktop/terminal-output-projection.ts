/** Display projection only. Output offsets and snapshots belong to the terminal service. */
interface Frame { data: string; endOffset: number }
export class TerminalOutputProjection {
  private offset: number | null = null;
  private recovering = true;
  private pending: Frame[] = [];
  private characters = 0;
  get pendingCharacters(): number { return this.characters; }
  beginSnapshot(): void { this.recovering = true; }
  private buffer(frame: Frame): void {
    this.pending.push(frame);
    this.characters += frame.data.length;
    while (this.characters > 262144 && this.pending.length > 0) this.characters -= this.pending.shift()!.data.length;
  }
  accept(frame: Frame): { append: string; needsSnapshot: boolean } {
    if (!Number.isSafeInteger(frame.endOffset) || frame.endOffset < frame.data.length) return { append: '', needsSnapshot: true };
    if (this.recovering || this.offset === null) { this.buffer(frame); return { append: '', needsSnapshot: false }; }
    if (frame.endOffset <= this.offset) return { append: '', needsSnapshot: false };
    const start = frame.endOffset - frame.data.length;
    if (start > this.offset) { this.buffer(frame); this.recovering = true; return { append: '', needsSnapshot: true }; }
    const append = frame.data.slice(this.offset - start);
    this.offset = frame.endOffset;
    return { append, needsSnapshot: false };
  }
  restore(snapshot: { output: string; endOffset: number }): { reset: string; append: string; needsSnapshot: boolean } {
    if (!Number.isSafeInteger(snapshot.endOffset) || snapshot.endOffset < snapshot.output.length || snapshot.output.length > 262144) throw new Error('invalid canonical output snapshot');
    this.offset = snapshot.endOffset;
    this.recovering = false;
    const pending = this.pending.sort((a, b) => a.endOffset - b.endOffset);
    this.pending = [];
    this.characters = 0;
    let append = '', needsSnapshot = false;
    for (const frame of pending) { const result = this.accept(frame); append += result.append; needsSnapshot ||= result.needsSnapshot; }
    return { reset: snapshot.output, append, needsSnapshot };
  }
}
