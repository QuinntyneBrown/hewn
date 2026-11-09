import { Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'ok' | 'warn' | 'danger';

/** A link (router commands) or a button (run) under the toast's text. */
export interface ToastAction {
  label: string;
  link?: unknown[];
  queryParams?: Record<string, unknown>;
  run?: () => void;
}

export interface ToastMessage {
  tone: ToastTone;
  title: string;
  text: string;
  actions?: ToastAction[];
}

export interface Toast extends ToastMessage {
  id: number;
}

/** How long each tone stays, per the design system's toast page. Danger toasts stay until dismissed. */
export const TOAST_MS: Record<ToastTone, number> = {
  info: 6_000,
  ok: 6_000,
  warn: 10_000,
  danger: Number.POSITIVE_INFINITY,
};

interface Timer {
  left: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

/**
 * News from the live event stream about something the person may not be looking at. A toast never holds the only
 * copy of what it says; it waits while hovered or focused, then leaves.
 */
@Injectable({ providedIn: 'root' })
export class Toasts {
  readonly items = signal<Toast[]>([]);
  private readonly timers = new Map<number, Timer>();
  private next = 1;

  show(message: ToastMessage): number {
    const id = this.next++;
    this.items.update((items) => [...items, { ...message, id }]);
    this.timers.set(id, { left: TOAST_MS[message.tone], startedAt: 0, handle: null });
    this.resume(id);
    return id;
  }

  pause(id: number): void {
    const timer = this.timers.get(id);
    if (!timer?.handle) return;
    clearTimeout(timer.handle);
    timer.handle = null;
    timer.left -= Date.now() - timer.startedAt;
  }

  resume(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || timer.handle || timer.left === Number.POSITIVE_INFINITY) return;
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => this.dismiss(id), Math.max(0, timer.left));
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    this.timers.delete(id);
    this.items.update((items) => items.filter((t) => t.id !== id));
  }
}
