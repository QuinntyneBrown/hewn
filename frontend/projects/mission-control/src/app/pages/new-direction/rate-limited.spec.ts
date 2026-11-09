import { describe, expect, it } from 'vitest';
import { rateLimitedText } from './rate-limited';

describe('rateLimitedText', () => {
  it('says how many were submitted and when the Owner can submit again, as the mock does (L2-043 AC4)', () => {
    expect(rateLimitedText(10, 42)).toBe(
      'You’ve submitted 10 in the last minute. You can submit again in 42 seconds; nothing you typed is lost.',
    );
  });

  it('says one second, not one seconds', () => {
    expect(rateLimitedText(10, 1)).toBe(
      'You’ve submitted 10 in the last minute. You can submit again in 1 second; nothing you typed is lost.',
    );
  });
});
