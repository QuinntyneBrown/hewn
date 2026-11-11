import { Injectable, signal } from '@angular/core';

/** A project's stage changes are announced at most once every 5 seconds (L2-047 AC3). */
export const ANNOUNCE_EVERY_MS = 5_000;

interface ProjectSlot {
  /** When this project was last announced. */
  at: number;
  /** The latest change waiting for the project's 5 seconds to pass. */
  pending: string | null;
  timer: ReturnType<typeof setTimeout> | null;
}

/**
 * The one polite live region's text, shared by every page (the shell renders it). A project's first stage change
 * is said at once; changes within its next 5 seconds wait, and only the latest of them is said when the time is up.
 * Each project is throttled on its own, so a change in one never holds back another.
 */
@Injectable({ providedIn: 'root' })
export class StatusAnnouncer {
  private readonly text = signal('');
  readonly message = this.text.asReadonly();
  private readonly slots = new Map<string, ProjectSlot>();

  announce(projectId: string, message: string): void {
    const now = Date.now();
    const slot = this.slots.get(projectId);
    if (!slot || now - slot.at >= ANNOUNCE_EVERY_MS) {
      if (slot?.timer) clearTimeout(slot.timer);
      this.slots.set(projectId, { at: now, pending: null, timer: null });
      this.text.set(message);
      return;
    }
    slot.pending = message;
    slot.timer ??= setTimeout(
      () => {
        slot.timer = null;
        if (slot.pending === null) return;
        slot.at = Date.now();
        this.text.set(slot.pending);
        slot.pending = null;
      },
      slot.at + ANNOUNCE_EVERY_MS - now,
    );
  }
}
