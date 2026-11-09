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

  it('keeps a danger toast until it is dismissed, with its actions', () => {
    const toasts = new Toasts();
    const retried: string[] = [];
    const id = toasts.show({
      tone: 'danger',
      title: 'Parcel Post is blocked',
      text: 'Requirements failed after 3 retries. Other projects keep running.',
      actions: [
        { label: 'Open log', link: ['/projects', 'p1'], queryParams: { stage: 5 } },
        { label: 'Retry stage', run: () => retried.push('p1') },
      ],
    });

    vi.advanceTimersByTime(60 * 60_000);
    expect(toasts.items().map((t) => t.actions?.map((a) => a.label))).toEqual([
      ['Open log', 'Retry stage'],
    ]);
    toasts.items()[0]!.actions![1]!.run!();
    expect(retried).toEqual(['p1']);
    toasts.dismiss(id);
    expect(toasts.items()).toHaveLength(0);
  });
});
