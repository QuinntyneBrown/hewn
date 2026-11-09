import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toasts, TOAST_MS } from './toasts';

describe('Toasts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a toast and removes it after its time (10 s for a warning)', () => {
    const toasts = new Toasts();
    toasts.show({
      tone: 'warn',
      title: 'Kiln Booking at 80% of budget',
      text: '$200.00 of $250.00.',
    });

    expect(toasts.items().map((t) => t.title)).toEqual(['Kiln Booking at 80% of budget']);
    vi.advanceTimersByTime(TOAST_MS.warn - 1);
    expect(toasts.items()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts.items()).toHaveLength(0);
  });

  it('waits while paused (hovered or focused) and resumes with the time it had left', () => {
    const toasts = new Toasts();
    const id = toasts.show({ tone: 'warn', title: 'A', text: 'B' });

    vi.advanceTimersByTime(4_000);
    toasts.pause(id);
    vi.advanceTimersByTime(60_000);
    expect(toasts.items()).toHaveLength(1);
    toasts.resume(id);
    vi.advanceTimersByTime(TOAST_MS.warn - 4_000);
    expect(toasts.items()).toHaveLength(0);
  });

  it('dismisses a toast at once', () => {
    const toasts = new Toasts();
    const id = toasts.show({ tone: 'warn', title: 'A', text: 'B' });

    toasts.dismiss(id);

    expect(toasts.items()).toHaveLength(0);
  });
});
