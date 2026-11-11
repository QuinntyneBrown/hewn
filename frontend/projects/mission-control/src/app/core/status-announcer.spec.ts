import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANNOUNCE_EVERY_MS, StatusAnnouncer } from './status-announcer';

describe('StatusAnnouncer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('says a project’s first change at once', () => {
    const announcer = new StatusAnnouncer();
    announcer.announce('a', 'Stage 1, Idea, Running');
    expect(announcer.message()).toBe('Stage 1, Idea, Running');
  });

  it('holds a project’s next change until 5 seconds have passed, and the latest wins', () => {
    const announcer = new StatusAnnouncer();
    announcer.announce('a', 'Stage 1, Idea, Running');
    vi.advanceTimersByTime(1_000);
    announcer.announce('a', 'Stage 1, Idea, Complete');
    announcer.announce('a', 'Stage 2, Designs, Running');
    expect(announcer.message()).toBe('Stage 1, Idea, Running');

    vi.advanceTimersByTime(ANNOUNCE_EVERY_MS - 1_001);
    expect(announcer.message()).toBe('Stage 1, Idea, Running');
    vi.advanceTimersByTime(1);
    expect(announcer.message()).toBe('Stage 2, Designs, Running');
  });

  it('throttles each project on its own', () => {
    const announcer = new StatusAnnouncer();
    announcer.announce('a', 'Kiln Booking, stage 1, Idea, Running');
    vi.advanceTimersByTime(1_000);
    announcer.announce('b', 'Tidewater, stage 4, Stack, Running');
    expect(announcer.message()).toBe('Tidewater, stage 4, Stack, Running');
  });

  it('says a change after a quiet 5 seconds at once', () => {
    const announcer = new StatusAnnouncer();
    announcer.announce('a', 'Stage 1, Idea, Running');
    vi.advanceTimersByTime(ANNOUNCE_EVERY_MS);
    announcer.announce('a', 'Stage 1, Idea, Complete');
    expect(announcer.message()).toBe('Stage 1, Idea, Complete');
  });
});
