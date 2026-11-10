import { describe, expect, it } from 'vitest';
import { connectionBanner, connectionState } from './connection-banner';

describe('connectionBanner', () => {
  const now = 1_000_000;

  it('says Reconnecting with the seconds to the next attempt and where catch-up starts (L2-032 AC1)', () => {
    expect(
      connectionBanner({ state: 'reconnecting', nextAttemptAt: now + 9_400 }, now, 48_213, null),
    ).toEqual({
      tone: 'warn',
      text: 'Reconnecting… next attempt in 10 s. Missed events will catch up from #48,213.',
    });
    expect(
      connectionBanner({ state: 'reconnecting', nextAttemptAt: now }, now, null, null)?.text,
    ).toBe('Reconnecting…');
  });

  it('says the connection is lost, with Retry now, once it retries every 30 seconds', () => {
    expect(
      connectionBanner({ state: 'offline', nextAttemptAt: now + 30_000 }, now, 7, null),
    ).toEqual({
      tone: 'danger',
      text: 'Connection lost. Retrying every 30 s; agents keep working and nothing is lost.',
      retry: true,
    });
  });

  it('says what a reconnect caught up, then nothing once live (L2-032 AC3)', () => {
    const live = { state: 'live' } as const;
    expect(connectionBanner(live, now, 48_213, { count: 14, from: 48_200, to: 48_213 })).toEqual({
      tone: 'ok',
      text: 'Reconnected. Caught up 14 missed events, #48,200 to #48,213.',
    });
    expect(connectionBanner(live, now, 9, { count: 1, from: 9, to: 9 })?.text).toBe(
      'Reconnected. Caught up 1 missed event, #9.',
    );
    expect(connectionBanner(live, now, 9, { count: 0, from: null, to: null })?.text).toBe(
      'Reconnected. Nothing was missed.',
    );
    expect(connectionBanner(live, now, 9, null)).toBeNull();
  });

  it('says it is connecting while the first connection is slow', () => {
    expect(connectionBanner({ state: 'connecting' }, now, null, null)).toEqual({
      tone: 'info',
      text: 'Connecting to Mission Control… live updates start in a moment.',
    });
  });
});

describe('connectionState', () => {
  it('labels the sidebar dot so status is never colour alone', () => {
    expect(connectionState({ state: 'live' })).toEqual({ label: 'Live', dot: '' });
    expect(connectionState({ state: 'reconnecting', nextAttemptAt: 0 })).toEqual({
      label: 'Reconnecting…',
      dot: 'dot--warn pulse',
    });
    expect(connectionState({ state: 'offline', nextAttemptAt: 0 })).toEqual({
      label: 'Offline',
      dot: 'dot--danger',
    });
    expect(connectionState({ state: 'connecting' })).toEqual({
      label: 'Connecting…',
      dot: 'dot--warn pulse',
    });
  });
});
